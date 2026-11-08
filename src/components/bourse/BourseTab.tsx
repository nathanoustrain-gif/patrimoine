import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Position } from "../../db/db";
import { fmtEUR, fmtDate } from "../../lib/format";
import { fetchCryptoPrices, fetchStockPrices } from "../../lib/market";
import { useSetting, SETTINGS_KEYS } from "../../lib/settings";
import Sheet from "../Sheet";
import PositionForm from "./PositionForm";
import { IconPlus } from "../Icons";

export default function BourseTab() {
  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  const positions = useLiveQuery(() => db.positions.toArray(), []);
  const apiKey = useSetting<string>(SETTINGS_KEYS.twelveDataApiKey);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 2800);
  }

  if (!accounts || !positions) return null;

  const tradable = accounts.filter(
    (a) => a.type === "courtage" || a.type === "crypto",
  );
  const lastUpdate = positions.reduce(
    (m, p) => (p.lastPriceUpdate && p.lastPriceUpdate > m ? p.lastPriceUpdate : m),
    0,
  );

  async function refreshPrices() {
    setRefreshing(true);
    const stocks = positions!.filter((p) => p.assetType === "stock");
    const cryptos = positions!.filter(
      (p) => p.assetType === "crypto" && p.coingeckoId,
    );

    let stockPrices: Record<string, number> = {};
    let cryptoPrices: Record<string, number> = {};
    const problems: string[] = [];

    if (stocks.length > 0) {
      if (!apiKey) {
        problems.push("clé Twelve Data manquante (Réglages) pour les actions");
      } else {
        try {
          stockPrices = await fetchStockPrices(
            stocks.map((p) => p.symbol),
            apiKey,
          );
        } catch {
          problems.push("erreur prix actions");
        }
      }
    }
    if (cryptos.length > 0) {
      try {
        cryptoPrices = await fetchCryptoPrices(
          cryptos.map((p) => p.coingeckoId!),
        );
      } catch {
        problems.push("erreur prix crypto");
      }
    }

    const now = Date.now();
    let n = 0;
    for (const p of positions!) {
      let newPrice: number | null = null;
      if (p.assetType === "stock" && stockPrices[p.symbol] !== undefined)
        newPrice = stockPrices[p.symbol];
      if (
        p.assetType === "crypto" &&
        p.coingeckoId &&
        cryptoPrices[p.coingeckoId] !== undefined
      )
        newPrice = cryptoPrices[p.coingeckoId];
      if (newPrice !== null) {
        await db.positions.update(p.id, {
          currentPrice: newPrice,
          lastPriceUpdate: now,
        });
        n++;
      }
    }
    setRefreshing(false);
    flash(
      (n > 0 ? `${n} prix mis à jour` : "Aucun prix mis à jour") +
        (problems.length ? " — " + problems.join(", ") : ""),
    );
  }

  return (
    <div>
      <div className="toolbar">
        <button className="btn primary" onClick={() => setAddOpen(true)}>
          <span className="btn-ic">
            <IconPlus size={16} /> Ajouter une position
          </span>
        </button>
        {positions.length > 0 && (
          <button className="btn" onClick={refreshPrices} disabled={refreshing}>
            {refreshing ? "…" : "Rafraîchir"}
          </button>
        )}
      </div>

      {lastUpdate > 0 && (
        <div className="refresh-row" style={{ marginTop: -4 }}>
          <span className="muted">Prix mis à jour : {fmtDate(lastUpdate)}</span>
        </div>
      )}

      {tradable.length === 0 ? (
        <div className="empty-state">
          <h3>Aucun compte de placement</h3>
          <p>
            Crée un compte « Compte titres / courtage » ou « Wallet crypto » dans
            l'onglet Comptes pour y ajouter des positions.
          </p>
        </div>
      ) : positions.length === 0 ? (
        <div className="empty-state">
          <h3>Aucune position</h3>
          <p>
            Ajoute tes actions/ETF (via Twelve Data) et tes cryptos (via CoinGecko).
            La valeur de tes comptes courtage et wallets sera calculée
            automatiquement.
          </p>
        </div>
      ) : (
        tradable.map((acc) => {
          const list = positions.filter((p) => p.accountId === acc.id);
          if (list.length === 0) return null;
          const totalValue = list.reduce(
            (s, p) => s + p.quantity * (p.currentPrice || 0),
            0,
          );
          return (
            <div className="card" key={acc.id}>
              <h2 className="section">
                {acc.name} — {fmtEUR(totalValue)}
              </h2>
              <div className="acc-list">
                {list.map((p) => {
                  const value = p.quantity * (p.currentPrice || 0);
                  const cost =
                    p.avgBuyPrice != null ? p.quantity * p.avgBuyPrice : null;
                  const pl = cost != null ? value - cost : null;
                  const plPct = cost ? (pl! / cost) * 100 : null;
                  return (
                    <div className="acc-row" key={p.id}>
                      <button
                        className="acc-main pos-row"
                        onClick={() => setEditing(p)}
                      >
                        <span className="nm">
                          {p.name}
                          <span className="inst"> · {p.symbol}</span>
                          <span className="pos-qty mono">
                            {p.quantity} ×{" "}
                            {p.currentPrice ? fmtEUR(p.currentPrice) : "—"}
                          </span>
                        </span>
                        <span className="pos-right">
                          <span className="mono val">{fmtEUR(value)}</span>
                          {pl != null && (
                            <span
                              className={"mono pos-pl " + (pl >= 0 ? "pos" : "neg")}
                            >
                              {(pl >= 0 ? "+" : "") + fmtEUR(pl)}
                              {plPct != null && (
                                <span className="pct">
                                  {" "}
                                  {(pl >= 0 ? "+" : "") + plPct.toFixed(1)}%
                                </span>
                              )}
                            </span>
                          )}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      <Sheet
        open={addOpen}
        title="Nouvelle position"
        onClose={() => setAddOpen(false)}
      >
        <PositionForm accounts={accounts} onDone={() => setAddOpen(false)} />
      </Sheet>

      <Sheet
        open={!!editing}
        title="Modifier la position"
        onClose={() => setEditing(null)}
      >
        {editing && (
          <PositionForm
            accounts={accounts}
            initial={editing}
            onDone={() => setEditing(null)}
            onDelete={async () => {
              await db.positions.delete(editing.id);
              setEditing(null);
              flash("Position supprimée");
            }}
          />
        )}
      </Sheet>

      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
