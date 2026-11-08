import { useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { fmtEUR, fmtDate } from "../../lib/format";
import {
  computeTotals,
  cardPrice,
  sealedPrice,
  upsertTodaySnapshot,
} from "../../lib/collection";
import Donut from "../charts/Donut";
import LineChart from "../charts/LineChart";

type Mover = { name: string; sub: string; pv: number; pvPct: number | null };

export default function DashboardTab() {
  const cards = useLiveQuery(() => db.cards.toArray(), []);
  const sealed = useLiveQuery(() => db.sealed.toArray(), []);
  const snapshots = useLiveQuery(() => db.snapshots.toArray(), []);

  // Enregistre l'instantané du jour dès que des données existent.
  useEffect(() => {
    if (cards && sealed && (cards.length > 0 || sealed.length > 0)) {
      upsertTodaySnapshot();
    }
  }, [cards, sealed]);

  const totals = useMemo(
    () => computeTotals(cards ?? [], sealed ?? []),
    [cards, sealed],
  );

  const movers = useMemo<Mover[]>(() => {
    const list: Mover[] = [];
    (cards ?? []).forEach((c) => {
      if (c.purchasePrice == null) return;
      const value = c.quantity * cardPrice(c);
      const cost = c.quantity * c.purchasePrice;
      if (cost <= 0 || value <= 0) return;
      list.push({
        name: c.name,
        sub: (c.setName || "") + (c.number ? " · " + c.number : ""),
        pv: value - cost,
        pvPct: cost > 0 ? ((value - cost) / cost) * 100 : null,
      });
    });
    (sealed ?? []).forEach((s) => {
      if (s.purchasePrice == null) return;
      const value = s.quantity * sealedPrice(s);
      const cost = s.quantity * s.purchasePrice;
      if (cost <= 0 || value <= 0) return;
      list.push({
        name: s.name,
        sub: s.type || "Scellé",
        pv: value - cost,
        pvPct: cost > 0 ? ((value - cost) / cost) * 100 : null,
      });
    });
    return list;
  }, [cards, sealed]);

  const gains = useMemo(
    () => movers.filter((m) => m.pv > 0).sort((a, b) => b.pv - a.pv).slice(0, 3),
    [movers],
  );
  const losses = useMemo(
    () => movers.filter((m) => m.pv < 0).sort((a, b) => a.pv - b.pv).slice(0, 3),
    [movers],
  );

  const chartPoints = useMemo(
    () =>
      (snapshots ?? [])
        .slice()
        .sort((a, b) => a.date - b.date)
        .map((s) => ({ date: s.date, value: s.totalValue })),
    [snapshots],
  );
  const firstValue = chartPoints[0]?.value;
  const historyDelta =
    chartPoints.length >= 2 ? totals.totalValue - (firstValue ?? 0) : null;

  if (!cards || !sealed) return null;

  const empty = cards.length === 0 && sealed.length === 0;
  if (empty) {
    return (
      <div className="empty-state">
        <h3>Tableau de bord</h3>
        <p>
          Ajoute des cartes ou des produits scellés pour voir ici la valeur totale,
          la répartition, tes meilleures plus-values et l'évolution dans le temps.
        </p>
      </div>
    );
  }

  const donutData = [
    { label: "Cartes", value: totals.cardsValue, color: "var(--coll-accent)" },
    { label: "Scellé", value: totals.sealedValue, color: "var(--gold)" },
  ];

  return (
    <div>
      {/* Valeur totale */}
      <div className="card dash-hero">
        <h2 className="section">Valeur totale du marché</h2>
        <div className="stat-big mono">{fmtEUR(totals.totalValue)}</div>
        <div className={"pv-line mono " + (totals.pv >= 0 ? "pos" : "neg")}>
          {(totals.pv >= 0 ? "+" : "") + fmtEUR(totals.pv)}
          {totals.pvPct != null && (
            <span> ({(totals.pv >= 0 ? "+" : "") + totals.pvPct.toFixed(1)}%)</span>
          )}
          <span className="muted"> sur {fmtEUR(totals.totalCost)} investis</span>
        </div>
      </div>

      {/* Sous-stats */}
      <div className="stat-strip">
        <div>
          <span className="k">Cartes</span>
          <span className="v mono">{fmtEUR(totals.cardsValue)}</span>
        </div>
        <div>
          <span className="k">Scellé</span>
          <span className="v mono">{fmtEUR(totals.sealedValue)}</span>
        </div>
        <div>
          <span className="k">Coût total</span>
          <span className="v mono">{fmtEUR(totals.totalCost)}</span>
        </div>
      </div>

      {/* Répartition */}
      <div className="card">
        <h2 className="section">Répartition cartes / scellé</h2>
        <Donut data={donutData} />
      </div>

      {/* Historique */}
      <div className="card">
        <h2 className="section">Évolution de la valeur</h2>
        <LineChart points={chartPoints} />
        {historyDelta != null && (
          <div
            className={"pv-line mono " + (historyDelta >= 0 ? "pos" : "neg")}
            style={{ marginTop: 10 }}
          >
            {(historyDelta >= 0 ? "+" : "") + fmtEUR(historyDelta)} depuis le{" "}
            {fmtDate(chartPoints[0].date)}
          </div>
        )}
      </div>

      {/* Tops */}
      {(gains.length > 0 || losses.length > 0) && (
        <div className="card">
          <h2 className="section">Top plus-values & moins-values</h2>
          <div className="movers">
            {gains.map((m, i) => (
              <MoverRow key={"g" + i} m={m} />
            ))}
            {losses.map((m, i) => (
              <MoverRow key={"l" + i} m={m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MoverRow({ m }: { m: Mover }) {
  const pos = m.pv >= 0;
  return (
    <div className="mover-row">
      <div className="mv-name">
        <div className="nm">{m.name}</div>
        {m.sub && <div className="sb">{m.sub}</div>}
      </div>
      <div className={"mv-pv mono " + (pos ? "pos" : "neg")}>
        {(pos ? "+" : "") + fmtEUR(m.pv)}
        {m.pvPct != null && (
          <span className="pct"> {(pos ? "+" : "") + m.pvPct.toFixed(0)}%</span>
        )}
      </div>
    </div>
  );
}
