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
// OKX a des entités régionales : une clé n'est reconnue que sur son domaine.
// EEA (Europe) → eea.okx.com, global → www.okx.com, US → us.okx.com.
const OKX_HOSTS = [
  "https://eea.okx.com",
  "https://www.okx.com",
  "https://us.okx.com",
];

async function okxSignedGet(host, path, key, secret, pass) {
  const ts = new Date().toISOString();
  const sign = b64(await hmac(enc.encode(secret), ts + "GET" + path, "SHA-256"));
  const res = await fetch(host + path, {
    headers: {
      "OK-ACCESS-KEY": key,
      "OK-ACCESS-SIGN": sign,
      "OK-ACCESS-TIMESTAMP": ts,
      "OK-ACCESS-PASSPHRASE": pass,
    },
  });
  return res.json();
}

// Endpoint public OKX (prix de marché) — pas besoin de signer.
async function okxPublic(host, path) {
  try {
    const res = await fetch(host + path);
    return await res.json();
  } catch {
    return null;
  }
}
async function tickerLast(host, instId) {
  const d = await okxPublic(host, "/api/v5/market/ticker?instId=" + instId);
  const p = parseFloat(d?.data?.[0]?.last);
  return p > 0 ? p : null;
}
// Taux USD→EUR via un pair EUR d'OKX (repli 0.92).
async function usdEurRate(host) {
  return (
    (await tickerLast(host, "USDT-EUR")) ||
    (await tickerLast(host, "USDC-EUR")) ||
    0.92
  );
}
// Valorise un montant d'un actif en EUR via les tickers OKX (pour le funding).
async function ccyToEur(host, ccy, amt, rate) {
  if (ccy === "EUR") return amt;
  // OKX Earn flexible : jeton "LY" + sous-jacent (ex. LYUSDC → USDC).
  const base = ccy.startsWith("LY") && ccy.length > 2 ? ccy.slice(2) : ccy;
  if (base === "EUR") return amt;
  const eurPair = await tickerLast(host, base + "-EUR");
  if (eurPair) return amt * eurPair;
  const usdtPair = await tickerLast(host, base + "-USDT");
  if (usdtPair) return amt * usdtPair * rate;
  if (/USDT|USDC|DAI|^USD$/i.test(base)) return amt * rate; // stablecoins ≈ 1 USD
  return null;
}

async function okxBalances(env, acct) {
  const key = env[`OKX_${acct}_KEY`];
  const secret = env[`OKX_${acct}_SECRET`];
  const pass = env[`OKX_${acct}_PASS`];
  if (!key || !secret || !pass) throw new Error("OKX secrets manquants: " + acct);

  // Détecte le bon domaine régional via /account/balance.
  let host = null;
  let trading = null;
  let lastErr = "";
  for (const h of OKX_HOSTS) {
    const d = await okxSignedGet(h, "/api/v5/account/balance", key, secret, pass);
    if (d.code === "0") {
      host = h;
      trading = d;
      break;
    }
    lastErr = d.msg || d.code || "";
    if (String(d.code) !== "50119") throw new Error("OKX: " + lastErr);
  }
  if (!host) throw new Error("OKX: clé introuvable (région ?) " + lastErr);

  const rate = await usdEurRate(host);
  const bySym = {}; // symbol -> { amount, eur, hasEur }
  const addAsset = (sym, amount, eur) => {
    if (!sym || (!amount && !eur)) return;
    if (!bySym[sym]) bySym[sym] = { amount: 0, eur: 0, hasEur: false };
    bySym[sym].amount += amount;
    if (eur != null) {
      bySym[sym].eur += eur;
      bySym[sym].hasEur = true;
    }
  };

  // Compte trading/unifié : OKX fournit déjà la valeur en USD (eqUsd).
  (trading.data?.[0]?.details || []).forEach((d) => {
    const amt = parseFloat(d.eq) || 0;
    const usd = parseFloat(d.eqUsd) || 0;
    if (!amt && !usd) return;
    addAsset(d.ccy, amt, usd * rate);
  });

  // Compte de financement (funding) : valorisé via les tickers OKX.
  try {
    const funding = await okxSignedGet(
      host,
      "/api/v5/asset/balances",
      key,
      secret,
      pass,
    );
    for (const d of funding.data || []) {
      const amt = parseFloat(d.bal) || 0;
      if (!amt) continue;
      addAsset(d.ccy, amt, await ccyToEur(host, d.ccy, amt, rate));
    }
  } catch {
    /* funding optionnel */
  }

  let totalEur = 0;
  const assets = Object.entries(bySym).map(([symbol, v]) => {
    const eur = v.hasEur ? v.eur : null;
    if (eur != null) totalEur += eur;
    return { symbol, amount: v.amount, eur };
  });
  assets.sort((a, b) => (b.eur || 0) - (a.eur || 0));
  return { assets, totalEur };
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
  // Kraken n'a pas de valeur USD intégrée : conversion via CoinGecko (toEur).
  return toEur(totals);
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
      const { assets, totalEur } =
        ex === "okx"
          ? await okxBalances(env, acct)
          : await krakenBalances(env, acct);
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
