import Dexie, { type EntityTable } from "dexie";

/* ============================================================
   Modèle de données — V1 (module Collection prioritaire)
   Stockage 100% local via IndexedDB.
   ============================================================ */

/** Carte à l'unité */
export interface Card {
  id: string;
  /** id de la carte dans l'API TCGdex (si trouvée automatiquement) */
  apiId?: string;
  /** langue utilisée pour l'API (fr/en…), pour rafraîchir le bon prix */
  apiLang?: string;
  name: string;
  setName?: string;
  /** numéro dans l'extension, ex : "25/102" */
  number?: string;
  /** URL de l'image (petite / grande) */
  image?: string;
  imageLarge?: string;
  language: string; // "EN", "FR", "JP"...
  condition: string; // "NM", "EX"...
  quantity: number;
  purchasePrice?: number;
  purchaseDate?: string; // ISO yyyy-mm-dd
  /** prix de marché récupéré via l'API (Cardmarket) */
  marketPrice?: number;
  marketPriceDate?: number; // timestamp de la dernière MAJ
  /** langue d'où provient le prix (peut différer de la langue de la carte) */
  priceLang?: string;
  /** prix saisi/forcé à la main (prioritaire sur le prix API s'il est défini) */
  manualPrice?: number;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

/** Produit scellé (ETB, bundle, display, coffret...) */
export interface Sealed {
  id: string;
  name: string;
  setName?: string;
  type?: string; // "ETB", "Bundle", "Display", "Coffret"...
  image?: string;
  quantity: number;
  purchasePrice?: number; // unitaire
  purchaseDate?: string;
  purchaseLocation?: string;
  /** prix de marché saisi à la main en V1 */
  marketPrice?: number;
  marketPriceDate?: number;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

/** Instantané de la valeur de la collection, pris à chaque MAJ des prix */
export interface Snapshot {
  id: string;
  date: number; // timestamp
  cardsValue: number;
  sealedValue: number;
  totalValue: number;
  totalCost: number;
}

/** Réglages clé/valeur (clé API, préférences...) */
export interface Setting {
  key: string;
  value: unknown;
}

/** Compte (courant, épargne, livret, courtage, wallet crypto) */
export interface Account {
  id: string;
  name: string;
  type: string; // courant | epargne | livretA | courtage | crypto
  institution?: string;
  /** solde de référence (ou solde si aucune position) */
  balance: number;
  /** compte partagé : exclu du patrimoine total, affiché à part */
  shared?: boolean;
  sharedWith?: string;
  createdAt: number;
}

/** Position bourse / crypto rattachée à un compte courtage/crypto */
export interface Position {
  id: string;
  accountId: string;
  assetType: string; // stock | crypto
  symbol: string;
  name: string;
  coingeckoId?: string | null;
  quantity: number;
  avgBuyPrice?: number | null;
  currentPrice?: number | null;
  lastPriceUpdate?: number | null;
}

export const db = new Dexie("PatrimoineDB") as Dexie & {
  cards: EntityTable<Card, "id">;
  sealed: EntityTable<Sealed, "id">;
  snapshots: EntityTable<Snapshot, "id">;
  settings: EntityTable<Setting, "key">;
  accounts: EntityTable<Account, "id">;
  positions: EntityTable<Position, "id">;
};

db.version(1).stores({
  cards: "id, name, setName, language",
  sealed: "id, name, setName, type",
  snapshots: "id, date",
  settings: "key",
});

db.version(2).stores({
  accounts: "id, type",
  positions: "id, accountId, assetType",
});

/** Identifiant court unique */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
