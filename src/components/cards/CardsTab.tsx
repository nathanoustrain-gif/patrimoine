import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Card } from "../../db/db";
import { fmtEUR, fmtDate } from "../../lib/format";
import { fetchCardDetail } from "../../lib/tcgcards";
import { upsertTodaySnapshot } from "../../lib/collection";
import Sheet from "../Sheet";
import CardSearch from "./CardSearch";
import CardAddForm from "./CardAddForm";
import { IconCards, IconPlus } from "../Icons";

function effPrice(c: Card): number {
  return c.manualPrice ?? c.marketPrice ?? 0;
}

export default function CardsTab() {
  const cards = useLiveQuery(() => db.cards.orderBy("name").toArray(), []);
  const [searchOpen, setSearchOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [editing, setEditing] = useState<Card | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 2600);
  }

  if (!cards) return null;

  const totalValue = cards.reduce((s, c) => s + c.quantity * effPrice(c), 0);
  const totalCost = cards.reduce(
    (s, c) => s + c.quantity * (c.purchasePrice || 0),
    0,
  );
  const pv = totalValue - totalCost;
  const hasApi = cards.some((c) => c.apiId);
  const lastUpdate = cards.reduce(
    (m, c) => (c.marketPriceDate && c.marketPriceDate > m ? c.marketPriceDate : m),
    0,
  );

  async function refreshPrices() {
    setRefreshing(true);
    let n = 0;
    for (const c of cards!) {
      if (!c.apiId) continue;
      try {
        const fresh = await fetchCardDetail(c.apiId, c.apiLang || "fr");
        if (fresh && fresh.marketPrice != null) {
          await db.cards.update(c.id, {
            marketPrice: fresh.marketPrice,
            marketPriceDate: fresh.marketPriceDate,
            updatedAt: Date.now(),
          });
          n++;
        }
      } catch {
        /* ignore, on continue */
      }
    }
    if (n > 0) await upsertTodaySnapshot();
    setRefreshing(false);
    flash(n > 0 ? `${n} prix mis à jour` : "Aucun prix mis à jour");
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

          {hasApi && (
            <div className="refresh-row">
              <span className="muted">
                {lastUpdate ? "Prix marché maj " + fmtDate(lastUpdate) : ""}
              </span>
              <button className="btn small" onClick={refreshPrices} disabled={refreshing}>
                {refreshing ? "Rafraîchissement…" : "Rafraîchir les prix"}
              </button>
            </div>
          )}

          <div className="showcase-grid">
            {cards.map((c) => (
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
                  <div className="pr mono">{fmtEUR(effPrice(c))}</div>
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
