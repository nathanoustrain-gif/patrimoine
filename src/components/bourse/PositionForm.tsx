import { useState } from "react";
import { db, uid, type Account, type Position } from "../../db/db";
import { typeLabel } from "../../lib/patrimoine";
import { searchCoins, type CoinResult } from "../../lib/market";

type Props = {
  accounts: Account[];
  initial?: Position;
  onDone: () => void;
  onDelete?: () => void;
};

export default function PositionForm({
  accounts,
  initial,
  onDone,
  onDelete,
}: Props) {
  const tradable = accounts.filter(
    (a) => a.type === "courtage" || a.type === "crypto",
  );

  const [confirmDel, setConfirmDel] = useState(false);
  const [accountId, setAccountId] = useState(
    initial?.accountId ?? tradable[0]?.id ?? "",
  );
  const [symbol, setSymbol] = useState(initial?.symbol ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [coingeckoId, setCoingeckoId] = useState(initial?.coingeckoId ?? "");
  const [quantity, setQuantity] = useState(
    initial?.quantity != null ? String(initial.quantity) : "",
  );
  const [avgBuyPrice, setAvgBuyPrice] = useState(
    initial?.avgBuyPrice != null ? String(initial.avgBuyPrice) : "",
  );
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CoinResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const account = accounts.find((a) => a.id === accountId);
  const assetType = account?.type === "crypto" ? "crypto" : "stock";

  async function runSearch() {
    if (!search.trim()) return;
    setSearching(true);
    try {
      setResults(await searchCoins(search));
    } catch {
      setResults([]);
    }
    setSearching(false);
  }

  function pickCoin(c: CoinResult) {
    setSymbol(c.symbol);
    setName(c.name);
    setCoingeckoId(c.id);
    setResults([]);
    setSearch("");
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!accountId || !symbol.trim() || !quantity) return;
    setSaving(true);
    const pos: Position = {
      id: initial?.id ?? uid(),
      accountId,
      assetType,
      symbol: symbol.trim().toUpperCase(),
      name: name.trim() || symbol.trim().toUpperCase(),
      coingeckoId: assetType === "crypto" ? coingeckoId || null : null,
      quantity: parseFloat(quantity) || 0,
      avgBuyPrice: avgBuyPrice ? parseFloat(avgBuyPrice) : null,
      currentPrice: initial?.currentPrice ?? null,
      lastPriceUpdate: initial?.lastPriceUpdate ?? null,
    };
    await db.positions.put(pos);
    setSaving(false);
    onDone();
  }

  if (tradable.length === 0) {
    return (
      <div className="empty-state" style={{ padding: "24px 0" }}>
        <p>
          Crée d'abord un compte « Compte titres / courtage » ou « Wallet crypto »
          dans l'onglet Comptes.
        </p>
        <button className="btn" onClick={onDone}>
          Fermer
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card-form">
      <div className="field-row">
        <div className="field">
          <label>Compte</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {tradable.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({typeLabel(a.type)})
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ maxWidth: 120 }}>
          <label>Quantité</label>
          <input
            type="number"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>
      </div>

      {assetType === "crypto" && (
        <div className="field">
          <label>Rechercher une crypto</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ex : bitcoin, ethereum…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runSearch();
                }
              }}
            />
            <button type="button" className="btn" onClick={runSearch}>
              {searching ? "…" : "Chercher"}
            </button>
          </div>
          {results.length > 0 && (
            <div className="coin-results">
              {results.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className="coin-row"
                  onClick={() => pickCoin(c)}
                >
                  {c.thumb && <img src={c.thumb} alt="" />}
                  <span>
                    {c.name} <span className="sym">({c.symbol})</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {coingeckoId && (
            <p className="picked-note">
              Sélectionné : {name} ({symbol})
            </p>
          )}
        </div>
      )}

      <div className="field-row">
        <div className="field">
          <label>
            {assetType === "crypto" ? "Symbole" : "Symbole (ticker Twelve Data)"}
          </label>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder={assetType === "crypto" ? "Ex : BTC" : "Ex : AAPL, MC.PA"}
            required
            readOnly={assetType === "crypto" && !!coingeckoId}
          />
        </div>
        <div className="field">
          <label>Prix moyen d'achat (€)</label>
          <input
            type="number"
            step="any"
            value={avgBuyPrice}
            onChange={(e) => setAvgBuyPrice(e.target.value)}
            placeholder="optionnel"
          />
        </div>
      </div>

      {assetType === "stock" && (
        <div className="field">
          <label>Nom (optionnel)</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Apple Inc."
          />
        </div>
      )}

      <div className="form-actions">
        {onDelete ? (
          confirmDel ? (
            <button type="button" className="btn danger" onClick={onDelete}>
              Confirmer la suppression
            </button>
          ) : (
            <button
              type="button"
              className="btn danger-ghost"
              onClick={() => setConfirmDel(true)}
            >
              Supprimer
            </button>
          )
        ) : (
          <button type="button" className="btn" onClick={onDone}>
            Annuler
          </button>
        )}
        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? "…" : initial ? "Enregistrer" : "Ajouter la position"}
        </button>
      </div>
    </form>
  );
}
