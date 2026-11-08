import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Sealed } from "../../db/db";
import { fmtEUR } from "../../lib/format";
import { sortItems, SortSelect, type SortKey } from "../SortSelect";
import Sheet from "../Sheet";
import SealedForm from "./SealedForm";
import { IconBox, IconPlus } from "../Icons";

export default function SealedTab() {
  const items = useLiveQuery(() => db.sealed.orderBy("name").toArray(), []);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Sealed | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>(
    () => (localStorage.getItem("sealedSort") as SortKey) || "nom",
  );

  function changeSort(s: SortKey) {
    setSort(s);
    localStorage.setItem("sealedSort", s);
  }

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 2600);
  }

  if (!items) return null;

  const sorted = sortItems(items, sort, (s) => s.marketPrice || 0, "type");

  const totalValue = items.reduce(
    (s, c) => s + c.quantity * (c.marketPrice || 0),
    0,
  );
  const totalCost = items.reduce(
    (s, c) => s + c.quantity * (c.purchasePrice || 0),
    0,
  );
  const pv = totalValue - totalCost;

  return (
    <div>
      <div className="toolbar">
        <button className="btn primary" onClick={() => setAddOpen(true)}>
          <span className="btn-ic">
            <IconPlus size={16} /> Ajouter un produit
          </span>
        </button>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="icon">
            <IconBox size={46} />
          </div>
          <h3>Aucun produit scellé</h3>
          <p>
            ETB, bundles, displays, coffrets… avec quantité, prix d'achat et valeur
            de marché (saisie à la main).
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

          <div className="sort-row">
            <SortSelect value={sort} onChange={changeSort} extensionLabel="Type" />
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
                    <IconBox size={36} />
                  )}
                  {c.quantity > 1 && <span className="qty">×{c.quantity}</span>}
                  {c.type && <span className="type-badge">{c.type}</span>}
                </div>
                <div className="info">
                  <div className="nm">{c.name}</div>
                  <div className="st">{c.setName || "—"}</div>
                  <div className="pr mono">
                    {c.marketPrice != null ? fmtEUR(c.marketPrice) : "prix ?"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <Sheet
        open={addOpen}
        title="Ajouter un produit scellé"
        onClose={() => setAddOpen(false)}
      >
        <SealedForm onDone={() => setAddOpen(false)} />
      </Sheet>

      <Sheet
        open={!!editing}
        title="Modifier le produit"
        onClose={() => setEditing(null)}
      >
        {editing && (
          <SealedForm
            initial={editing}
            onDone={() => setEditing(null)}
            onDelete={async () => {
              await db.sealed.delete(editing.id);
              setEditing(null);
              flash("Produit supprimé");
            }}
          />
        )}
      </Sheet>

      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
