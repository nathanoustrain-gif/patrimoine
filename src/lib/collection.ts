import { db, type Card, type Sealed, type Snapshot } from "../db/db";

/** Prix de marché effectif d'une carte (prix forcé prioritaire). */
export function cardPrice(c: Card): number {
  return c.manualPrice ?? c.marketPrice ?? 0;
}

export function sealedPrice(s: Sealed): number {
  return s.marketPrice ?? 0;
}

export interface Totals {
  cardsValue: number;
  sealedValue: number;
  totalValue: number;
  cardsCost: number;
  sealedCost: number;
  totalCost: number;
  pv: number;
  pvPct: number | null;
}

export function computeTotals(cards: Card[], sealed: Sealed[]): Totals {
  const cardsValue = cards.reduce((s, c) => s + c.quantity * cardPrice(c), 0);
  const sealedValue = sealed.reduce((s, c) => s + c.quantity * sealedPrice(c), 0);
  const cardsCost = cards.reduce(
    (s, c) => s + c.quantity * (c.purchasePrice || 0),
    0,
  );
  const sealedCost = sealed.reduce(
    (s, c) => s + c.quantity * (c.purchasePrice || 0),
    0,
  );
  const totalValue = cardsValue + sealedValue;
  const totalCost = cardsCost + sealedCost;
  const pv = totalValue - totalCost;
  return {
    cardsValue,
    sealedValue,
    totalValue,
    cardsCost,
    sealedCost,
    totalCost,
    pv,
    pvPct: totalCost > 0 ? (pv / totalCost) * 100 : null,
  };
}

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Enregistre (ou met à jour) l'instantané du jour avec les valeurs courantes.
 * Un seul snapshot par jour, mis à jour avec la dernière valeur connue.
 */
export async function upsertTodaySnapshot(): Promise<void> {
  const [cards, sealed] = await Promise.all([
    db.cards.toArray(),
    db.sealed.toArray(),
  ]);
  if (cards.length === 0 && sealed.length === 0) return;
  const t = computeTotals(cards, sealed);
  const snap: Snapshot = {
    id: "snap-" + dayKey(),
    date: Date.now(),
    cardsValue: t.cardsValue,
    sealedValue: t.sealedValue,
    totalValue: t.totalValue,
    totalCost: t.totalCost,
  };
  await db.snapshots.put(snap);
}
