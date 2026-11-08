/* ============================================================
   Patrimoine — backend crypto (Cloudflare Worker)

   Rôle : garder les clés API (lecture seule) OKX / Kraken côté serveur,
   signer les requêtes, et renvoyer les soldes convertis en EUR.
   L'app (GitHub Pages) appelle ce Worker ; les secrets ne quittent jamais
   le Worker.

   Comptes configurés via des secrets wrangler (voir README).
   Appel : GET /balances?account=okx-me   (en-tête X-Auth: <CLIENT_TOKEN>)
   Réponse : { account, assets:[{symbol, amount, eur}], totalEur, updatedAt }
   ============================================================ */

const enc = new TextEncoder();

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "X-Auth, Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });
}

/* ---------- Crypto helpers (Web Crypto) ---------- */
function b64(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64decode(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function hmac(keyData, msg, hash) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, enc.encode(msg));
}
async function sha256(msg) {
  return crypto.subtle.digest("SHA-256", enc.encode(msg));
}

/* ---------- OKX ---------- */
async function okxGet(path, env, acct) {
  const key = env[`OKX_${acct}_KEY`];
  const secret = env[`OKX_${acct}_SECRET`];
  const pass = env[`OKX_${acct}_PASS`];
  if (!key || !secret || !pass) throw new Error("OKX secrets manquants: " + acct);
  const ts = new Date().toISOString();
  const prehash = ts + "GET" + path;
  const sign = b64(await hmac(enc.encode(secret), prehash, "SHA-256"));
  const res = await fetch("https://www.okx.com" + path, {
    headers: {
      "OK-ACCESS-KEY": key,
      "OK-ACCESS-SIGN": sign,
      "OK-ACCESS-TIMESTAMP": ts,
      "OK-ACCESS-PASSPHRASE": pass,
    },
  });
  return res.json();
}

async function okxBalances(env, acct) {
  const totals = {}; // symbol -> amount
  const add = (ccy, amt) => {
    const a = parseFloat(amt);
    if (!ccy || !a) return;
    totals[ccy] = (totals[ccy] || 0) + a;
  };
  // Compte de trading
  const trading = await okxGet("/api/v5/account/balance", env, acct);
  if (trading.code !== "0") throw new Error("OKX: " + (trading.msg || trading.code));
  (trading.data?.[0]?.details || []).forEach((d) => add(d.ccy, d.eq));
  // Compte de financement (funding)
  try {
    const funding = await okxGet("/api/v5/asset/balances", env, acct);
    (funding.data || []).forEach((d) => add(d.ccy, d.bal));
  } catch {
    /* funding optionnel */
  }
  return totals;
}

/* ---------- Kraken ---------- */
async function krakenBalances(env, acct) {
  const key = env[`KRAKEN_${acct}_KEY`];
  const secret = env[`KRAKEN_${acct}_SECRET`];
  if (!key || !secret) throw new Error("Kraken secrets manquants: " + acct);
  const path = "/0/private/Balance";
  const nonce = String(Date.now() * 1000);
  const postData = "nonce=" + nonce;
  // signature : HMAC-SHA512( path + SHA256(nonce + postData), base64decode(secret) )
  const hashDigest = new Uint8Array(await sha256(nonce + postData));
  const pathBytes = enc.encode(path);
  const msg = new Uint8Array(pathBytes.length + hashDigest.length);
  msg.set(pathBytes, 0);
  msg.set(hashDigest, pathBytes.length);
  const keyObj = await crypto.subtle.importKey(
    "raw",
    b64decode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sign = b64(await crypto.subtle.sign("HMAC", keyObj, msg));
  const res = await fetch("https://api.kraken.com" + path, {
    method: "POST",
    headers: {
      "API-Key": key,
      "API-Sign": sign,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: postData,
  });
  const data = await res.json();
  if (data.error && data.error.length) throw new Error("Kraken: " + data.error.join(", "));
  const totals = {};
  for (const [asset, amt] of Object.entries(data.result || {})) {
    const a = parseFloat(amt);
    if (!a) continue;
    totals[normalizeKraken(asset)] = (totals[normalizeKraken(asset)] || 0) + a;
  }
  return totals;
}

// Kraken préfixe ses actifs (XXBT, XETH, ZEUR…). On normalise en symboles usuels.
function normalizeKraken(a) {
  const map = {
    XXBT: "BTC",
    XBT: "BTC",
    XETH: "ETH",
    XXRP: "XRP",
    XLTC: "LTC",
    XXLM: "XLM",
    XXDG: "DOGE",
    ZEUR: "EUR",
    ZUSD: "USD",
    ZGBP: "GBP",
  };
  if (map[a]) return map[a];
  // retire un préfixe X/Z d'actifs à 4 lettres
  if (/^[XZ][A-Z]{3,}$/.test(a) && a.length >= 4) return a.slice(1);
  return a.replace(/\.(F|S|M|HOLD)$/i, ""); // variantes staking
}

/* ---------- Conversion EUR (CoinGecko) ---------- */
const CG_ID = {
  BTC: "bitcoin", ETH: "ethereum", USDT: "tether", USDC: "usd-coin",
  SOL: "solana", XRP: "ripple", ADA: "cardano", DOGE: "dogecoin",
  DOT: "polkadot", MATIC: "matic-network", POL: "polygon-ecosystem-token",
  LTC: "litecoin", LINK: "chainlink", AVAX: "avalanche-2", TRX: "tron",
  BNB: "binancecoin", ATOM: "cosmos", UNI: "uniswap", XLM: "stellar",
  ALGO: "algorand", BCH: "bitcoin-cash", DAI: "dai", SHIB: "shiba-inu",
  NEAR: "near", APT: "aptos", ARB: "arbitrum", OP: "optimism",
  FIL: "filecoin", ICP: "internet-computer", ETC: "ethereum-classic",
  SUI: "sui", PEPE: "pepe", RENDER: "render-token", INJ: "injective-protocol",
  TON: "the-open-network", USD: "usd-coin",
};

async function toEur(totals) {
  const ids = [];
  for (const sym of Object.keys(totals)) {
    if (sym === "EUR") continue;
    const id = CG_ID[sym];
    if (id && !ids.includes(id)) ids.push(id);
  }
  let prices = {};
  if (ids.length) {
    try {
      const r = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=" +
          ids.join(",") + "&vs_currencies=eur",
      );
      prices = await r.json();
    } catch {
      /* pas de prix → eur null */
    }
  }
  const assets = [];
  let totalEur = 0;
  for (const [sym, amount] of Object.entries(totals)) {
    let eur = null;
    if (sym === "EUR") eur = amount;
    else {
      const id = CG_ID[sym];
      const p = id && prices[id] ? prices[id].eur : null;
      if (typeof p === "number") eur = amount * p;
    }
    if (eur != null) totalEur += eur;
    assets.push({ symbol: sym, amount, eur });
  }
  assets.sort((a, b) => (b.eur || 0) - (a.eur || 0));
  return { assets, totalEur };
}

/* ---------- Router ---------- */
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    // Origines autorisées (facultatif) : ALLOWED_ORIGINS = "https://...,http://localhost:5173"
    const allowList = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const allowed = allowList.length === 0 || allowList.includes(origin);
    const allowOrigin = allowed ? origin || "*" : allowList[0] || "*";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors(allowOrigin) });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/balances") {
      return json({ error: "not found" }, 404, allowOrigin);
    }

    // Auth simple par jeton partagé
    if (env.CLIENT_TOKEN && request.headers.get("X-Auth") !== env.CLIENT_TOKEN) {
      return json({ error: "unauthorized" }, 401, allowOrigin);
    }

    const account = (url.searchParams.get("account") || "").trim();
    const m = /^(okx|kraken)-([a-z0-9]+)$/i.exec(account);
    if (!m) return json({ error: "compte invalide" }, 400, allowOrigin);
    const ex = m[1].toLowerCase();
    const acct = m[2].toUpperCase();

    try {
      const totals =
        ex === "okx" ? await okxBalances(env, acct) : await krakenBalances(env, acct);
      const { assets, totalEur } = await toEur(totals);
      return json(
        { account, assets, totalEur, updatedAt: Date.now() },
        200,
        allowOrigin,
      );
    } catch (e) {
      return json({ error: String(e.message || e) }, 502, allowOrigin);
    }
  },
};
