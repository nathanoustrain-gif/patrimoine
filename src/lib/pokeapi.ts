/* ============================================================
   Service API pokemontcg.io (v2)
   - Recherche de cartes (anglais uniquement côté API)
   - Prix Cardmarket en EUR
   - L'API renvoie des 500 par intermittence → retry robuste
   ============================================================ */

const BASE = "https://api.pokemontcg.io/v2";

export interface ApiCard {
  apiId: string;
  name: string;
  setName?: string;
  series?: string;
  number?: string;
  image?: string;
  imageLarge?: string;
  /** prix de marché retenu (trend > avg30 > averageSellPrice), en EUR */
  marketPrice?: number;
  /** date de MAJ Cardmarket (timestamp) */
  marketPriceDate?: number;
}

export interface SearchResult {
  total: number;
  cards: ApiCard[];
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Construit la requête Lucene : chaque mot en préfixe, combinés en ET. */
function buildQuery(term: string): string {
  const cleaned = term.trim().replace(/[^\p{L}\p{N}\s'-]/gu, " ");
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  return words.map((w) => `name:${w.replace(/'/g, "")}*`).join(" ");
}

/** Prix Cardmarket retenu + date. */
function extractPrice(card: any): { price?: number; date?: number } {
  const p = card.cardmarket?.prices;
  if (!p) return {};
  const price =
    p.trendPrice ?? p.avg30 ?? p.averageSellPrice ?? p.avg7 ?? p.avg1 ?? undefined;
  let date: number | undefined;
  const u = card.cardmarket?.updatedAt; // "YYYY/MM/DD"
  if (u) {
    const t = new Date(u.replace(/\//g, "-")).getTime();
    if (!Number.isNaN(t)) date = t;
  }
  return { price: typeof price === "number" ? price : undefined, date };
}

function mapCard(card: any): ApiCard {
  const { price, date } = extractPrice(card);
  return {
    apiId: card.id,
    name: card.name,
    setName: card.set?.name,
    series: card.set?.series,
    number: card.number,
    image: card.images?.small,
    imageLarge: card.images?.large,
    marketPrice: price,
    marketPriceDate: date,
  };
}

/** Fetch avec retry (l'API 500 souvent). Lève une erreur après N essais. */
async function apiFetch(path: string, apiKey?: string): Promise<any> {
  const headers: Record<string, string> = {};
  if (apiKey) headers["X-Api-Key"] = apiKey;
  let lastStatus = 0;
  for (let i = 0; i < 6; i++) {
    try {
      const res = await fetch(BASE + path, { headers });
      if (res.ok) return await res.json();
      lastStatus = res.status;
      if (res.status === 404) return null;
    } catch {
      /* erreur réseau / CORS transitoire → on retente */
    }
    await delay(300 + i * 350);
  }
  throw new Error(
    "L'API pokemontcg.io ne répond pas (" +
      (lastStatus || "réseau") +
      "). Réessayez dans un instant.",
  );
}

/** Recherche de cartes par nom (partiel). page commence à 1. */
export async function searchCards(
  term: string,
  page = 1,
  apiKey?: string,
): Promise<SearchResult> {
  const q = buildQuery(term);
  if (!q) return { total: 0, cards: [] };
  const data = await apiFetch(
    `/cards?q=${encodeURIComponent(q)}&page=${page}&pageSize=24`,
    apiKey,
  );
  if (!data) return { total: 0, cards: [] };
  return {
    total: data.totalCount ?? 0,
    cards: (data.data ?? []).map(mapCard),
  };
}

/** Récupère une carte par son id API (pour rafraîchir le prix). */
export async function fetchCardById(
  apiId: string,
  apiKey?: string,
): Promise<ApiCard | null> {
  const data = await apiFetch(`/cards/${encodeURIComponent(apiId)}`, apiKey);
  if (!data?.data) return null;
  return mapCard(data.data);
}
