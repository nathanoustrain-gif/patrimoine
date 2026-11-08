/* ============================================================
   Données de marché
   - Crypto : CoinGecko (recherche + prix EUR, sans clé, CORS OK)
   - Actions / ETF : Twelve Data (clé API requise)
   ============================================================ */

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface CoinResult {
  id: string; // coingeckoId
  name: string;
  symbol: string;
  thumb?: string;
}

async function cgFetch(path: string): Promise<any> {
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch("https://api.coingecko.com/api/v3" + path);
      if (res.ok) return await res.json();
      if (res.status === 429) await delay(900 * (i + 1)); // rate limit
    } catch {
      /* retry */
    }
    await delay(300 + i * 300);
  }
  throw new Error("CoinGecko ne répond pas. Réessayez dans un instant.");
}

export async function searchCoins(query: string): Promise<CoinResult[]> {
  if (!query.trim()) return [];
  const data = await cgFetch("/search?query=" + encodeURIComponent(query.trim()));
  return (data.coins ?? []).slice(0, 8).map((c: any) => ({
    id: c.id,
    name: c.name,
    symbol: (c.symbol || "").toUpperCase(),
    thumb: c.thumb,
  }));
}

/** Prix EUR par coingeckoId. */
export async function fetchCryptoPrices(
  ids: string[],
): Promise<Record<string, number>> {
  const uniq = [...new Set(ids)].filter(Boolean);
  if (uniq.length === 0) return {};
  const data = await cgFetch(
    "/simple/price?ids=" + uniq.join(",") + "&vs_currencies=eur",
  );
  const out: Record<string, number> = {};
  uniq.forEach((id) => {
    if (data[id] && typeof data[id].eur === "number") out[id] = data[id].eur;
  });
  return out;
}

const TD = "https://api.twelvedata.com";

/**
 * Prix par ticker via Twelve Data, convertis en EUR.
 * 1) /quote → prix (close) + devise de chaque titre
 * 2) /exchange_rate → taux devise→EUR pour les devises ≠ EUR
 * Si le taux manque, le prix est gardé tel quel (pas de conversion).
 */
export async function fetchStockPrices(
  symbols: string[],
  apiKey: string,
): Promise<Record<string, number>> {
  const uniq = [...new Set(symbols)].filter(Boolean);
  if (uniq.length === 0) return {};

  // 1) Cotations (prix + devise)
  const qRes = await fetch(
    TD +
      "/quote?symbol=" +
      encodeURIComponent(uniq.join(",")) +
      "&apikey=" +
      encodeURIComponent(apiKey),
  );
  const qData = await qRes.json();
  const quotes: Record<string, any> =
    uniq.length === 1 ? { [uniq[0]]: qData } : qData;

  const info: Record<string, { price: number; currency: string }> = {};
  const currencies = new Set<string>();
  for (const sym of uniq) {
    const q = quotes[sym];
    const raw = q && (q.close ?? q.price);
    if (raw !== undefined && raw !== null && !q?.code) {
      const currency = (q.currency || "EUR").toUpperCase();
      info[sym] = { price: parseFloat(raw), currency };
      if (currency !== "EUR") currencies.add(currency);
    }
  }

  // 2) Taux de change vers EUR
  const rates: Record<string, number> = { EUR: 1 };
  if (currencies.size > 0) {
    const cur = [...currencies];
    const pairs = cur.map((c) => `${c}/EUR`).join(",");
    try {
      const fxRes = await fetch(
        TD +
          "/exchange_rate?symbol=" +
          encodeURIComponent(pairs) +
          "&apikey=" +
          encodeURIComponent(apiKey),
      );
      const fx = await fxRes.json();
      if (cur.length === 1) {
        if (fx.rate) rates[cur[0]] = fx.rate;
      } else {
        for (const c of cur) {
          const k = `${c}/EUR`;
          if (fx[k]?.rate) rates[c] = fx[k].rate;
        }
      }
    } catch {
      /* pas de conversion si l'appel échoue */
    }
  }

  const out: Record<string, number> = {};
  for (const sym of uniq) {
    const i = info[sym];
    if (i) out[sym] = i.price * (rates[i.currency] ?? 1);
  }
  return out;
}
