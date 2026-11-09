import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Card } from "../../db/db";
import { fmtEUR, fmtDate } from "../../lib/format";
import { fetchCardDetail, relinkCard, type ApiCard } from "../../lib/tcgcards";
import { upsertTodaySnapshot, cardPrice } from "../../lib/collection";
import { recordAllToday, deleteCardHistory } from "../../lib/pricehistory";
import { pendingAlerts, ackAlerts, checkAlerts } from "../../lib/alerts";
import { sortItems, SortSelect, type SortKey } from "../SortSelect";
import Sheet from "../Sheet";
import CardSearch from "./CardSearch";
import CardAddForm from "./CardAddForm";
import { IconCards, IconPlus } from "../Icons";

export default function CardsTab() {
  const cards = useLiveQuery(() => db.cards.orderBy("name").toArray(), []);
  const [searchOpen, setSearchOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [editing, setEditing] = useState<Card | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>(
    () => (localStorage.getItem("cardsSort") as SortKey) || "nom",
  );

  function changeSort(s: SortKey) {
    setSort(s);
    localStorage.setItem("cardsSort", s);
  }

  const [healed, setHealed] = useState(false);

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 2600);
  }

  // Image scrydex reconstruite (série 30 ans, non imagée dans TCGdex).
  function scrydex30thImage(c: Card): { image?: string; imageLarge?: string } {
    const m = /^(30th-c|30th)-/.exec(c.apiId || "");
    if (!m || !c.number) return {};
    const prefix = m[1] === "30th-c" ? "me55c" : "me55";
    const base = `https://images.scrydex.com/pokemon/${prefix}-${c.number}`;
    return { image: base + "/small", imageLarge: base + "/large" };
  }

  // Met à jour une carte depuis TCGdex : prix, nom/extension localisés (français),
  // et image si manquante (TCGdex, sinon scrydex).
  function buildUpdate(c: Card, d: ApiCard): Partial<Card> {
    const u: Partial<Card> = { updatedAt: Date.now() };
    if (d.marketPrice != null) {
      u.marketPrice = d.marketPrice;
      u.marketPriceDate = d.marketPriceDate;
      u.priceLang = d.priceLang;
    }
    if (d.name && d.name !== c.name) u.name = d.name;
    if (d.setName && d.setName !== c.setName) u.setName = d.setName;
    if (!c.image) {
      if (d.image) {
        u.image = d.image;
        u.imageLarge = d.imageLarge;
      } else {
        const sx = scrydex30thImage(c);
        if (sx.image) {
          u.image = sx.image;
          u.imageLarge = sx.imageLarge;
        }
      }
    }
    return u;
  }

  // Répare une carte : complète via son id (prix/nom/image), ou la relie à
  // TCGdex. Renvoie "fixed" | "relinked" | "none".
  async function repairCard(c: Card): Promise<"fixed" | "relinked" | "none"> {
    if (c.apiId) {
      const d = await fetchCardDetail(c.apiId, c.apiLang || "fr");
      if (d) {
        await db.cards.update(c.id, buildUpdate(c, d));
        return "fixed";
      }
    }
    const rl = await relinkCard(c);
    if (rl && rl.marketPrice != null) {
      await db.cards.update(c.id, { ...rl, updatedAt: Date.now() });
      return "relinked";
    }
    return "none";
  }

  // Auto-réparation en arrière-plan des cartes sans prix OU sans image.
  useEffect(() => {
    if (!cards || healed) return;
    setHealed(true);
    // Point d'historique du jour avec les prix actuels (un par carte/jour),
    // puis vérification des seuils d'alerte.
    recordAllToday().then(() => checkAlerts());
    const todo = cards.filter(
      (c) =>
        c.manualPrice == null &&
        c.name &&
        (c.marketPrice == null || !c.image),
    );
    if (todo.length === 0) return;
    (async () => {
      let n = 0;
      for (const c of todo) {
        try {
          const r = await repairCard(c);
          if (r !== "none") n++;
        } catch {
          /* on continue */
        }
      }
      if (n > 0) {
        flash(`${n} carte(s) réparée(s)`);
        // Ré-enregistre le point du jour avec les prix réparés, puis alertes.
        recordAllToday().then(() => checkAlerts());
      }
    })();
  }, [cards, healed]);

  if (!cards) return null;

  const alerts = pendingAlerts(cards);
  const sorted = sortItems(cards, sort, cardPrice, "setName");
  const totalValue = cards.reduce((s, c) => s + c.quantity * cardPrice(c), 0);
  const totalCost = cards.reduce(
    (s, c) => s + c.quantity * (c.purchasePrice || 0),
    0,
  );
  const pv = totalValue - totalCost;
  const lastUpdate = cards.reduce(
    (m, c) => (c.marketPriceDate && c.marketPriceDate > m ? c.marketPriceDate : m),
    0,
  );

  async function refreshPrices() {
    setRefreshing(true);
    let updated = 0;
    let relinked = 0;
    let notFound = 0;
    for (const c of cards!) {
      if (c.manualPrice != null) continue; // prix forcé : on n'y touche pas
      try {
        const res = await repairCard(c);
        if (res === "fixed") updated++;
        else if (res === "relinked") relinked++;
        else notFound++;
      } catch {
        notFound++;
      }
    }
    await upsertTodaySnapshot();
    await recordAllToday();
    await checkAlerts();
    setRefreshing(false);
    const parts = [];
    if (updated) parts.push(`${updated} à jour`);
    if (relinked) parts.push(`${relinked} reliée(s)`);
    if (notFound) parts.push(`${notFound} sans cote`);
    flash(parts.length ? parts.join(" · ") : "Rien à mettre à jour");
  }

  return (
    <div>
      {alerts.length > 0 && (
        <div className="alert-banner">
          <div className="ab-head">
            <strong>
              🔔 {alerts.length} carte{alerts.length > 1 ? "s" : ""} au seuil de
              prix
            </strong>
            <button className="btn small" onClick={() => ackAlerts(cards!)}>
              Vu
            </button>
          </div>
          <ul>
            {alerts.map((a) => (
              <li key={a.card.id}>
                <span className="ab-name">{a.card.name}</span>
                <span className="ab-val mono">
                  {fmtEUR(a.price)}{" "}
                  <span className={a.side === "above" ? "pos" : "neg"}>
                    {a.side === "above" ? "≥" : "≤"} {fmtEUR(a.threshold)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="toolbar">
        <button className="btn primary" onClick={() => setSearchOpen(true)}>
          <span className="btn-ic">
            <IconPlus size={16} /> Rechercher une carte
          </span>
        </button>
        <button className="btn" onClick={() => setManualOpen(true)}>
          Saisie manuelle
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="empty-state">
          <div className="icon">
            <IconCards size={46} />
          </div>
          <h3>Aucune carte pour l'instant</h3>
          <p>
            Recherchez une carte par nom : l'image, l'extension et le prix du marché
            seront récupérés automatiquement.
          </p>
        </div>
      ) : (
        <>
          <div className="stat-strip">
            <div>
              <span className="k">Valeur marché</span>
              <span className="v mono">{fmtEUR(totalValue)}</span>
            </div>
            <div>
              <span className="k">Coût d'achat</span>
              <span className="v mono">{fmtEUR(totalCost)}</span>
            </div>
            <div>
              <span className="k">Plus-value</span>
              <span className={"v mono " + (pv >= 0 ? "pos" : "neg")}>
                {(pv >= 0 ? "+" : "") + fmtEUR(pv)}
              </span>
            </div>
          </div>

          <div className="refresh-row">
            <span className="muted">
              {lastUpdate ? "Prix marché maj " + fmtDate(lastUpdate) : ""}
            </span>
            <button className="btn small" onClick={refreshPrices} disabled={refreshing}>
              {refreshing ? "Mise à jour…" : "Réparer / rafraîchir les prix"}
            </button>
          </div>

          <div className="sort-row">
            <SortSelect value={sort} onChange={changeSort} extensionLabel="Extension" />
          </div>

          <div className="showcase-grid">
            {sorted.map((c) => (
              <button
                key={c.id}
                className="showcase-item tappable"
                onClick={() => setEditing(c)}
              >
                <div className="thumb">
                  {c.image ? (
                    <img src={c.image} alt={c.name} loading="lazy" />
                  ) : (
                    <IconCards size={34} />
                  )}
                  {c.quantity > 1 && <span className="qty">×{c.quantity}</span>}
                </div>
                <div className="info">
                  <div className="nm">{c.name}</div>
                  <div className="st">
                    {c.setName || "—"}
                    {c.number ? " · " + c.number : ""}
                    <span className="lang">{c.language}</span>
                  </div>
                  <div className="pr mono">{fmtEUR(cardPrice(c))}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <Sheet
        open={searchOpen}
        title="Rechercher une carte"
        onClose={() => setSearchOpen(false)}
      >
        <CardSearch onClose={() => setSearchOpen(false)} />
      </Sheet>

      <Sheet
        open={manualOpen}
        title="Saisie manuelle"
        onClose={() => setManualOpen(false)}
      >
        <CardAddForm manual onDone={() => setManualOpen(false)} />
      </Sheet>

      <Sheet
        open={!!editing}
        title="Modifier la carte"
        onClose={() => setEditing(null)}
      >
        {editing && (
          <CardAddForm
            initial={editing}
            onDone={() => setEditing(null)}
            onDelete={async () => {
              await db.cards.delete(editing.id);
              await deleteCardHistory(editing.id);
              setEditing(null);
              flash("Carte supprimée");
            }}
          />
        )}
      </Sheet>

      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
