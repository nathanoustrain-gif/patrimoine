import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Card } from "../../db/db";
import { fmtEUR, fmtDate } from "../../lib/format";
import { fetchCardDetail, relinkCard } from "../../lib/tcgcards";
import { upsertTodaySnapshot, cardPrice } from "../../lib/collection";
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

  // Répare une carte sans prix : complète via son id, ou la relie à TCGdex
  // (id cassé ou absent). Renvoie "updated" | "relinked" | "none".
  async function repairCard(c: Card): Promise<"updated" | "relinked" | "none"> {
    if (c.apiId) {
      const d = await fetchCardDetail(c.apiId, c.apiLang || "fr");
      if (d) {
        // id valide : on met à jour le prix si dispo, mais on ne relie pas.
        if (d.marketPrice != null) {
          await db.cards.update(c.id, {
            marketPrice: d.marketPrice,
            marketPriceDate: d.marketPriceDate,
            priceLang: d.priceLang,
            updatedAt: Date.now(),
          });
          return "updated";
        }
        return "none";
      }
    }
    // pas d'id, ou id introuvable dans TCGdex → reliaison par nom + numéro + extension
    const rl = await relinkCard(c);
    if (rl && rl.marketPrice != null) {
      await db.cards.update(c.id, { ...rl, updatedAt: Date.now() });
      return "relinked";
    }
    return "none";
  }

  // Auto-remplissage en arrière-plan des cartes sans prix à l'ouverture.
  useEffect(() => {
    if (!cards || healed) return;
    const missing = cards.filter(
      (c) => c.marketPrice == null && c.manualPrice == null && c.name,
    );
    setHealed(true);
    if (missing.length === 0) return;
    (async () => {
      let relinked = 0;
      for (const c of missing) {
        try {
          if ((await repairCard(c)) === "relinked") relinked++;
        } catch {
          /* on continue */
        }
      }
      if (relinked > 0) flash(`${relinked} carte(s) reliée(s) et prix récupérés`);
    })();
  }, [cards, healed]);

  if (!cards) return null;

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
        if (c.apiId && c.marketPrice != null) {
          // carte déjà reliée et cotée : simple rafraîchissement
          const fresh = await fetchCardDetail(c.apiId, c.apiLang || "fr");
          if (fresh && fresh.marketPrice != null) {
            await db.cards.update(c.id, {
              marketPrice: fresh.marketPrice,
              marketPriceDate: fresh.marketPriceDate,
              priceLang: fresh.priceLang,
              updatedAt: Date.now(),
            });
            updated++;
          }
        } else {
          // carte sans prix : réparation (complétion ou reliaison)
          const res = await repairCard(c);
          if (res === "updated") updated++;
          else if (res === "relinked") relinked++;
          else notFound++;
        }
      } catch {
        notFound++;
      }
    }
    await upsertTodaySnapshot();
    setRefreshing(false);
    const parts = [];
    if (updated) parts.push(`${updated} à jour`);
    if (relinked) parts.push(`${relinked} reliée(s)`);
    if (notFound) parts.push(`${notFound} sans cote`);
    flash(parts.length ? parts.join(" · ") : "Rien à mettre à jour");
  }

  return (
    <div>
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
