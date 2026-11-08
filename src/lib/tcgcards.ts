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

function firstToken(name: string): string {
  const t = (name || "").split(/[\s\-–—]+/).filter(Boolean);
  return t[0] || name;
}

function tokenize(s?: string): string[] {
  return (s || "")
    .toLowerCase()
    .split(/[^a-z0-9àâäéèêëïîôöùûüç]+/i)
    .filter((t) => t.length >= 2);
}

/** Nombre de mots d'extension en commun (recoupement). */
function setScore(a?: string, b?: string): number {
  if (!a || !b) return 0;
  const A = new Set(tokenize(a));
  let n = 0;
  for (const t of tokenize(b)) if (A.has(t)) n++;
  return n;
}

const setsCache: Record<string, { id: string; name: string }[]> = {};
async function getSets(lang: string): Promise<{ id: string; name: string }[]> {
  if (setsCache[lang]) return setsCache[lang];
  const data = await tcgFetch(`/${lang}/sets`);
  const arr = (Array.isArray(data) ? data : []).map((s: any) => ({
    id: s.id,
    name: s.name,
  }));
  setsCache[lang] = arr;
  return arr;
}

async function findSetId(setName: string, lang: string): Promise<string | null> {
  if (!setName) return null;
  const sets = await getSets(lang);
  let best: { id: string; score: number } | null = null;
  for (const s of sets) {
    const sc = setScore(setName, s.name);
    if (sc > 0 && (!best || sc > best.score)) best = { id: s.id, score: sc };
  }
  return best ? best.id : null;
}

/** Choisit le meilleur candidat : exige un recoupement d'extension (sécurité). */
function pickBest(
  dets: ApiCard[],
  cardSetName: string | undefined,
  num: string,
  needNum: boolean,
): ApiCard | null {
  if (dets.length === 0) return null;
  let pool = dets;
  if (needNum && num) {
    const nm = pool.filter((d) => normNum(d.number) === num);
    if (nm.length) pool = nm;
  }
  let best: ApiCard | null = null;
  let bestScore = 0;
  for (const d of pool) {
    const sc = setScore(cardSetName, d.setName);
    if (sc > bestScore) {
      bestScore = sc;
      best = d;
    }
  }
  return bestScore >= 1 ? best : null;
}

export interface RelinkResult {
  apiId: string;
  apiLang: string;
  name?: string;
  marketPrice?: number;
  marketPriceDate?: number;
  priceLang?: string;
  image?: string;
  imageLarge?: string;
  setName?: string;
  number?: string;
}

/**
 * Relie une carte d'une ancienne source (id incompatible) à TCGdex.
 * Les métadonnées des anciennes cartes sont en ANGLAIS → on fait la
 * correspondance en anglais : nom (1er mot) + numéro, puis par extension si la
 * numérotation diffère (ex. Classic Collection). Le prix est ensuite récupéré
 * dans la langue de la carte (avec repli). Une correspondance d'extension est
 * exigée pour éviter toute fausse association.
 */
export async function relinkCard(card: {
  name: string;
  number?: string;
  setName?: string;
  language?: string;
  image?: string;
  imageLarge?: string;
}): Promise<RelinkResult | null> {
  if (!card.name) return null;
  const MATCH = "en";
  const priceLang = LANG_MAP[card.language || ""] || "fr";
  const num = normNum(card.number);
  const term = firstToken(card.name).toLowerCase();

  async function detailsFor(ids: string[]): Promise<ApiCard[]> {
    const out: ApiCard[] = [];
    for (const id of ids.slice(0, 15)) {
      if (isPocket(id)) continue;
      const d = await fetchCardDetail(id, MATCH);
      if (d) out.push(d);
    }
    return out;
  }

  let chosen: ApiCard | null = null;

  // 1) nom (1er mot) + numéro
  if (num) {
    const byNum = await tcgFetch(
      `/${MATCH}/cards?name=${encodeURIComponent(term)}&localId=${encodeURIComponent(num)}`,
    );
    const ids = (Array.isArray(byNum) ? byNum : []).map((c: any) => c.id);
    chosen = pickBest(await detailsFor(ids), card.setName, num, true);
  }

  // 2) par extension (numérotation différente entre sources)
  if (!chosen && card.setName) {
    const setId = await findSetId(card.setName, MATCH);
    if (setId) {
      const setData = await tcgFetch(`/${MATCH}/sets/${setId}`);
      const matchCards = ((setData && setData.cards) || []).filter((c: any) => {
        const n = (c.name || "").toLowerCase();
        return (
          n === term ||
          n.startsWith(term + " ") ||
          n.startsWith(term + "-") ||
          n.includes(term)
        );
      });
      const ids = matchCards.map((c: any) => c.id);
      chosen = pickBest(await detailsFor(ids), card.setName, num, false);
    }
  }

  if (!chosen) return null;

  // Détail dans la langue de la carte : prix + nom/extension localisés (français).
  const loc = await fetchCardDetail(chosen.apiId, priceLang);
  const src = loc || chosen;
  return {
    apiId: chosen.apiId,
    apiLang: priceLang,
    name: src.name || card.name,
    marketPrice: src.marketPrice ?? chosen.marketPrice,
    marketPriceDate: src.marketPriceDate ?? chosen.marketPriceDate,
    priceLang: src.priceLang ?? chosen.priceLang,
    // On garde l'image existante (scrydex, qui fonctionne) si elle est là ;
    // TCGdex n'a pas d'image pour toutes les cartes.
    image: card.image || src.image || chosen.image,
    imageLarge: card.imageLarge || src.imageLarge || chosen.imageLarge,
    setName: src.setName || card.setName,
    number: card.number || chosen.number,
  };
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
