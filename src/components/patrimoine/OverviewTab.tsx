import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { fmtEUR } from "../../lib/format";
import {
  ACCOUNT_TYPES,
  accountValue,
  accountsTotal,
  sharedTotal,
} from "../../lib/patrimoine";
import { computeTotals } from "../../lib/collection";
import Donut from "../charts/Donut";

export default function OverviewTab() {
  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  const positions = useLiveQuery(() => db.positions.toArray(), []);
  const cards = useLiveQuery(() => db.cards.toArray(), []);
  const sealed = useLiveQuery(() => db.sealed.toArray(), []);

  const ready = accounts && positions && cards && sealed;

  const collectionValue = useMemo(
    () => (cards && sealed ? computeTotals(cards, sealed).totalValue : 0),
    [cards, sealed],
  );

  const accTotal = useMemo(
    () => (accounts && positions ? accountsTotal(accounts, positions) : 0),
    [accounts, positions],
  );
  const shared = useMemo(
    () => (accounts && positions ? sharedTotal(accounts, positions) : 0),
    [accounts, positions],
  );

  const netWorth = accTotal + collectionValue;

  const donutData = useMemo(() => {
    if (!accounts || !positions) return [];
    const byType = ACCOUNT_TYPES.map((t) => ({
      label: t.label,
      value: accounts
        .filter((a) => a.type === t.value && !a.shared)
        .reduce((s, a) => s + accountValue(a, positions), 0),
      color: t.color,
    }));
    return [
      ...byType,
      { label: "Collection", value: collectionValue, color: "#7ea2d6" },
    ];
  }, [accounts, positions, collectionValue]);

  if (!ready) return null;

  const empty =
    accounts.length === 0 && cards.length === 0 && sealed.length === 0;
  if (empty) {
    return (
      <div className="empty-state">
        <h3>Patrimoine total</h3>
        <p>
          Ajoute des comptes ici, et la valeur de ta Collection sera
          automatiquement incluse pour donner ton patrimoine global.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <h2 className="section">Patrimoine total</h2>
        <div className="stat-big mono">{fmtEUR(netWorth)}</div>
        <div className="pv-line">
          <span className="muted">
            Comptes {fmtEUR(accTotal)} · Collection {fmtEUR(collectionValue)}
          </span>
        </div>
      </div>

      <div className="card">
        <h2 className="section">Répartition</h2>
        <Donut data={donutData} />
      </div>

      {shared > 0 && (
        <div className="card">
          <h2 className="section">Comptes partagés (hors total)</h2>
          <div className="stat-big mono" style={{ fontSize: 24 }}>
            {fmtEUR(shared)}
          </div>
          <div className="pv-line">
            <span className="muted">
              Non comptabilisé dans le patrimoine total. Détail dans l'onglet
              Comptes.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
