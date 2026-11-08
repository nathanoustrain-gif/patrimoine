/* ============================================================
   Service cartes — TCGdex (api.tcgdex.net)
   - Gratuit, sans clé, CORS, multilingue (FR/EN…)
   - Prix Cardmarket en EUR, mis à jour quotidiennement
   - Couvre les nouveaux sets (contrairement à pokemontcg.io)
   ============================================================ */

const BASE = "https://api.tcgdex.net/v2";

export type Lang = "fr" | "en";

/** Résultat bref de recherche (l'API ne renvoie que id/nom/image). */
export interface CardBrief {
  apiId: string;
  name: string;
  image?: string;
}

/** Carte détaillée (avec prix). */
export interface ApiCard {
  apiId: string;
  apiLang: string;
  name: string;
  setName?: string;
  number?: string;
  image?: string;
  imageLarge?: string;
  marketPrice?: number; // EUR (Cardmarket)
  marketPriceDate?: number;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Les images TCGdex sont des bases sans extension : on ajoute qualité + format. */
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

/** Recherche par nom (partielle), dans la langue choisie. */
export async function searchCards(
  term: string,
  lang: Lang = "fr",
): Promise<{ total: number; cards: CardBrief[] }> {
  if (!term.trim()) return { total: 0, cards: [] };
  const data = await tcgFetch(
    `/${lang}/cards?name=${encodeURIComponent(term.trim())}`,
  );
  const arr: any[] = Array.isArray(data) ? data : [];
  return {
    total: arr.length,
    cards: arr.slice(0, 60).map((c) => ({
      apiId: c.id,
      name: c.name,
      image: imgUrl(c.image, "low"),
    })),
  };
}

/** Détail complet d'une carte (set, numéro, prix). */
export async function fetchCardDetail(
  apiId: string,
  lang: Lang | string = "fr",
): Promise<ApiCard | null> {
  const c = await tcgFetch(`/${lang}/cards/${encodeURIComponent(apiId)}`);
  if (!c || !c.id) return null;
  const cm = c.pricing?.cardmarket;
  const price = cm
    ? (cm.trend ?? cm.avg30 ?? cm.avg ?? cm.avg7 ?? undefined)
    : undefined;
  let date: number | undefined;
  if (cm?.updated) {
    const t = new Date(cm.updated).getTime();
    if (!Number.isNaN(t)) date = t;
  }
  return {
    apiId: c.id,
    apiLang: String(lang),
    name: c.name,
    setName: c.set?.name,
    number: c.localId ? String(c.localId) : undefined,
    image: imgUrl(c.image, "low"),
    imageLarge: imgUrl(c.image, "high"),
    marketPrice: typeof price === "number" ? price : undefined,
    marketPriceDate: date,
  };
}
