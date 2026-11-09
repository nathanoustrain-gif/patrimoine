import { db, type Card } from "../db/db";
import { cardPrice } from "./collection";

/* ============================================================
   Alertes de prix sur les cartes (bandeau dans l'app).
   - Chaque carte peut définir un seuil haut (alertAbove) et/ou bas
     (alertBelow) sur son prix effectif.
   - Déclenchement "sur front" + acquittement : une alerte passe en
     attente quand le prix entre dans la zone, reste silencieuse une
     fois « vue », et peut se re-déclencher si le prix ressort puis
     rentre à nouveau (ou change de côté).
   ============================================================ */

export type AlertHit = {
  card: Card;
  side: "above" | "below";
  price: number;
  threshold: number;
};

function hitSide(c: Card, price: number): "above" | "below" | null {
  if (c.alertAbove != null && price >= c.alertAbove) return "above";
  if (c.alertBelow != null && price <= c.alertBelow) return "below";
  return null;
}

/** Recalcule l'état d'alerte de chaque carte selon son prix courant. */
export async function checkAlerts(): Promise<void> {
  const cards = await db.cards.toArray();
  for (const c of cards) {
    const hasThreshold = c.alertAbove != null || c.alertBelow != null;
    const price = cardPrice(c);
    const m = hasThreshold && price > 0 ? hitSide(c, price) : null;
    if (m == null) {
      if (c.alertHit)
        await db.cards.update(c.id, { alertHit: undefined, alertSeen: undefined });
    } else if (c.alertHit !== m) {
      // Nouveau franchissement (ou changement de côté) → en attente.
      await db.cards.update(c.id, { alertHit: m, alertSeen: false });
    }
  }
}

/** Cartes dont l'alerte est déclenchée et pas encore acquittée. */
export function pendingAlerts(cards: Card[]): AlertHit[] {
  const out: AlertHit[] = [];
  for (const c of cards) {
    if (c.alertHit && !c.alertSeen) {
      out.push({
        card: c,
        side: c.alertHit,
        price: cardPrice(c),
        threshold: c.alertHit === "above" ? c.alertAbove! : c.alertBelow!,
      });
    }
  }
  return out;
}

/** Acquitte (« vu ») toutes les alertes en attente. */
export async function ackAlerts(cards: Card[]): Promise<void> {
  const ids = cards
    .filter((c) => c.alertHit && !c.alertSeen)
    .map((c) => c.id);
  await Promise.all(ids.map((id) => db.cards.update(id, { alertSeen: true })));
}
