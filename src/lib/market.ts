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

/** Prix par ticker via Twelve Data (clé requise). */
export async function fetchStockPrices(
  symbols: string[],
  apiKey: string,
): Promise<Record<string, number>> {
  const uniq = [...new Set(symbols)].filter(Boolean);
  if (uniq.length === 0) return {};
  const res = await fetch(
    "https://api.twelvedata.com/price?symbol=" +
      encodeURIComponent(uniq.join(",")) +
      "&apikey=" +
      encodeURIComponent(apiKey),
  );
  const data = await res.json();
  const out: Record<string, number> = {};
  if (uniq.length === 1) {
    if (data.price) out[uniq[0]] = parseFloat(data.price);
  } else {
    uniq.forEach((sym) => {
      if (data[sym] && data[sym].price) out[sym] = parseFloat(data[sym].price);
    });
  }
  return out;
}
