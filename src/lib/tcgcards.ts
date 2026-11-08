/* ============================================================
   Service cartes — TCGdex (api.tcgdex.net)
   - Gratuit, sans clé, CORS, multilingue (FR/EN…)
   - Prix Cardmarket en EUR, mis à jour quotidiennement
   - Repli TCGplayer (USD→EUR approx) si Cardmarket absent
   - Les cartes Pokémon TCG Pocket (jeu mobile, sans cote) sont exclues
   ============================================================ */

const BASE = "https://api.tcgdex.net/v2";
// Taux USD→EUR approximatif, pour le repli TCGplayer uniquement (rare).
const USD_EUR = 0.92;

export type Lang = "fr" | "en";

export interface CardBrief {
  apiId: string;
  name: string;
  image?: string;
}

export interface ApiCard {
  apiId: string;
  apiLang: string;
  name: string;
  setName?: string;
  number?: string;
  image?: string;
  imageLarge?: string;
  marketPrice?: number; // EUR
  marketPriceDate?: number;
  priceSource?: "cardmarket" | "tcgplayer";
  /** langue d'où vient le prix (peut différer de la langue demandée) */
  priceLang?: string;
}

/** Langues de repli pour le prix (Cardmarket EUR couvert surtout en en/fr/de). */
const PRICE_FALLBACK_LANGS = ["en", "fr", "de", "it", "es"];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Carte du jeu mobile Pokémon TCG Pocket (ids A1…, A2b…, P-A…) — pas de cote. */
export function isPocket(id: string): boolean {
  return /^A\d/i.test(id) || /^P-A/i.test(id);
}

function imgUrl(base: string | undefined, quality: "low" | "high"): string | undefined {
  return base ? `${base}/${quality}.webp` : undefined;
}

async function tcgFetch(path: string): Promise<any> {
  let lastStatus = 0;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(BASE + path);
      if (res.ok) return await res.json();
      lastStatus = res.status;
      if (res.status === 404) return null;
    } catch {
      /* retry réseau */
    }
    await delay(300 + i * 300);
  }
  throw new Error(
    "TCGdex ne répond pas (" + (lastStatus || "réseau") + "). Réessayez.",
  );
}

/** Prix retenu : Cardmarket EUR, sinon repli TCGplayer converti en EUR. */
function extractPrice(pricing: any): {
  price?: number;
  date?: number;
  source?: "cardmarket" | "tcgplayer";
} {
  const cm = pricing?.cardmarket;
  const cmPrice = cm ? (cm.trend ?? cm.avg30 ?? cm.avg ?? cm.avg7) : undefined;
  if (typeof cmPrice === "number") {
    let date: number | undefined;
    if (cm.updated) {
      const t = new Date(cm.updated).getTime();
      if (!Number.isNaN(t)) date = t;
    }
    return { price: cmPrice, date, source: "cardmarket" };
  }
  const tp = pricing?.tcgplayer;
  if (tp) {
    const usd =
      tp.holofoil?.marketPrice ??
      tp.normal?.marketPrice ??
      tp["reverse-holofoil"]?.marketPrice;
    if (typeof usd === "number") {
      let date: number | undefined;
      if (tp.updated) {
        const t = new Date(tp.updated).getTime();
        if (!Number.isNaN(t)) date = t;
      }
      return { price: usd * USD_EUR, date, source: "tcgplayer" };
    }
  }
  return {};
}

function mapCard(c: any, lang: string): ApiCard {
  const { price, date, source } = extractPrice(c.pricing);
  return {
    apiId: c.id,
    apiLang: lang,
    name: c.name,
    setName: c.set?.name,
    number: c.localId ? String(c.localId) : undefined,
    image: imgUrl(c.image, "low"),
    imageLarge: imgUrl(c.image, "high"),
    marketPrice: typeof price === "number" ? price : undefined,
    marketPriceDate: date,
    priceSource: source,
  };
}

/** Recherche par nom (partielle, sensible aux accents en FR). */
export async function searchCards(
  term: string,
  lang: Lang = "fr",
): Promise<{ total: number; cards: CardBrief[] }> {
  if (!term.trim()) return { total: 0, cards: [] };
  const data = await tcgFetch(
    `/${lang}/cards?name=${encodeURIComponent(term.trim())}`,
  );
  const arr: any[] = Array.isArray(data) ? data : [];
  const cards = arr
    .filter((c) => !isPocket(c.id))
    .map((c) => ({ apiId: c.id, name: c.name, image: imgUrl(c.image, "low") }));
  return { total: cards.length, cards };
}

/**
 * Détail complet d'une carte (set, numéro, prix).
 * Le prix est cherché dans la langue demandée, puis dans d'autres langues en
 * repli (beaucoup de cartes récentes n'ont le prix Cardmarket qu'en anglais au
 * début). Les données d'affichage (nom, extension, image) restent dans la
 * langue demandée.
 */
export async function fetchCardDetail(
  apiId: string,
  lang: Lang | string = "fr",
): Promise<ApiCard | null> {
  const L = String(lang).toLowerCase();
  const id = encodeURIComponent(apiId);
  let c = await tcgFetch(`/${L}/cards/${id}`);
  // Carte introuvable dans cette langue : repli sur l'anglais pour les données.
  if ((!c || !c.id) && L !== "en") {
    c = await tcgFetch(`/en/cards/${id}`);
    if (c && c.id) return mapCard(c, "en");
  }
  if (!c || !c.id) return null;

  const mapped = mapCard(c, L);
  if (mapped.marketPrice != null) {
    mapped.priceLang = L;
    return mapped;
  }
  // Pas de prix dans cette langue → on cherche dans les autres.
  for (const fl of PRICE_FALLBACK_LANGS) {
    if (fl === L) continue;
    const alt = await tcgFetch(`/${fl}/cards/${id}`);
    if (!alt) continue;
    const { price, date, source } = extractPrice(alt.pricing);
    if (typeof price === "number") {
      mapped.marketPrice = price;
      mapped.marketPriceDate = date;
      mapped.priceSource = source;
      mapped.priceLang = fl;
      break;
    }
  }
  return mapped;
}

const LANG_MAP: Record<string, string> = {
  EN: "en",
  FR: "fr",
  DE: "de",
  IT: "it",
  ES: "es",
  JP: "ja",
};

function normNum(n?: string): string {
  if (!n) return "";
  return String(n).split("/")[0].trim().toLowerCase().replace(/^0+/, "");
}
function setLoose(s?: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function setMatch(a?: string, b?: string): boolean {
  if (!a || !b) return true; // indulgent si une extension manque
  const x = setLoose(a);
  const y = setLoose(b);
  return x === y || x.includes(y) || y.includes(x);
}

export interface RelinkResult {
  apiId: string;
  apiLang: string;
  marketPrice?: number;
  marketPriceDate?: number;
  priceLang?: string;
  image?: string;
  imageLarge?: string;
  setName?: string;
  number?: string;
}

/**
 * Relie une carte d'une ancienne source (id incompatible) à TCGdex :
 * recherche par nom (anglais, comme pokemontcg.io), puis correspondance sur le
 * numéro et l'extension. Renvoie le nouvel id + prix, ou null si pas de match sûr.
 */
export async function relinkCard(card: {
  name: string;
  number?: string;
  setName?: string;
  language?: string;
}): Promise<RelinkResult | null> {
  if (!card.name) return null;
  const priceLangPref = card.language
    ? LANG_MAP[card.language] || "en"
    : "en";
  const targetNum = normNum(card.number);

  // Recherche précise par nom + numéro (localId) quand le numéro est connu.
  let pool: { apiId: string }[] = [];
  if (targetNum) {
    const byNum = await tcgFetch(
      `/en/cards?name=${encodeURIComponent(card.name)}&localId=${encodeURIComponent(targetNum)}`,
    );
    pool = (Array.isArray(byNum) ? byNum : [])
      .filter((c) => !isPocket(c.id))
      .map((c) => ({ apiId: c.id }));
  }
  // Repli : recherche par nom seul (noms exacts d'abord), limitée.
  if (pool.length === 0) {
    const { cards } = await searchCards(card.name, "en");
    const exact = cards.filter(
      (c) => c.name.toLowerCase() === card.name.toLowerCase(),
    );
    pool = (exact.length ? exact : cards).slice(0, 25);
  }

  for (const cand of pool) {
    const d = await fetchCardDetail(cand.apiId, priceLangPref);
    if (!d) continue;
    const numOk = targetNum ? normNum(d.number) === targetNum : false;
    if (numOk && setMatch(card.setName, d.setName)) {
      return {
        apiId: d.apiId,
        apiLang: priceLangPref,
        marketPrice: d.marketPrice,
        marketPriceDate: d.marketPriceDate,
        priceLang: d.priceLang,
        image: d.image,
        imageLarge: d.imageLarge,
        setName: card.setName || d.setName,
        number: card.number || d.number,
      };
    }
  }
  return null;
}

/** Récupère les détails de plusieurs cartes, avec un pool de concurrence. */
export async function fetchManyDetails(
  ids: string[],
  lang: Lang | string = "fr",
  concurrency = 6,
): Promise<Record<string, ApiCard>> {
  const out: Record<string, ApiCard> = {};
  let i = 0;
  async function worker() {
    while (i < ids.length) {
      const id = ids[i++];
      try {
        const d = await fetchCardDetail(id, lang);
        if (d) out[id] = d;
      } catch {
        /* on ignore cette carte */
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, ids.length) }, worker),
  );
  return out;
}
