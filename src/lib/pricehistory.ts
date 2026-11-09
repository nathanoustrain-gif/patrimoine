import { db, type PriceHistory } from "../db/db";
import { cardPrice } from "./collection";
import type { Point } from "../components/charts/LineChart";

/* ============================================================
   Historique des prix par carte.
   TCGdex ne fournit pas les prix passés : l'historique démarre
   maintenant et se remplit jour après jour (un point par carte
   et par jour, mis à jour avec le dernier prix connu du jour).
   ============================================================ */

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Enregistre (ou met à jour) le point de prix du jour pour une carte. */
export async function recordCardToday(cardId: string): Promise<void> {
  const c = await db.cards.get(cardId);
  if (!c) return;
  const price = cardPrice(c);
  if (price <= 0) return; // pas de prix connu → rien à historiser
  const day = dayKey();
  await db.priceHistory.put({ id: cardId + ":" + day, cardId, date: day, price });
}

/** Enregistre le point du jour pour toutes les cartes ayant un prix. */
export async function recordAllToday(): Promise<void> {
  const cards = await db.cards.toArray();
  const day = dayKey();
  const points: PriceHistory[] = [];
  for (const c of cards) {
    const price = cardPrice(c);
    if (price > 0)
      points.push({ id: c.id + ":" + day, cardId: c.id, date: day, price });
  }
  if (points.length) await db.priceHistory.bulkPut(points);
}

/** Historique d'une carte, trié par date, au format attendu par LineChart. */
export async function getCardHistory(cardId: string): Promise<Point[]> {
  const rows = await db.priceHistory.where("cardId").equals(cardId).toArray();
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows.map((r) => ({ date: new Date(r.date).getTime(), value: r.price }));
}

/** Supprime l'historique d'une carte (à la suppression de la carte). */
export async function deleteCardHistory(cardId: string): Promise<void> {
  await db.priceHistory.where("cardId").equals(cardId).delete();
}
