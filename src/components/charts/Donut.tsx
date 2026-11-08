import { fmtEUR } from "../../lib/format";

export type DonutDatum = { label: string; value: number; color: string };

export default function Donut({
  data,
  size = 150,
}: {
  data: DonutDatum[];
  size?: number;
}) {
  const parts = data.filter((d) => d.value > 0);
  const total = parts.reduce((s, d) => s + d.value, 0);

  if (total <= 0) {
    return <div className="empty-state" style={{ padding: "20px 0" }}>Pas encore de données</div>;
  }

  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  let angle = -90;

  const arcs = parts.map((d, i) => {
    const frac = d.value / total;
    const sweep = frac * 360;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const large = sweep > 180 ? 1 : 0;
    const x1 = cx + r * Math.cos((start * Math.PI) / 180);
    const y1 = cy + r * Math.sin((start * Math.PI) / 180);
    const x2 = cx + r * Math.cos((end * Math.PI) / 180);
    const y2 = cy + r * Math.sin((end * Math.PI) / 180);
    // cas d'une seule part = cercle plein
    const path =
      frac >= 0.9999
        ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`
        : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return (
      <path key={i} d={path} fill={d.color} stroke="var(--ink)" strokeWidth={1.5} />
    );
  });

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs}
        <circle cx={cx} cy={cy} r={r * 0.56} fill="var(--surface)" />
      </svg>
      <div className="legend">
        {parts.map((d, i) => (
          <div key={i} className="legend-row">
            <span className="dot" style={{ background: d.color }} />
            <span className="lb">{d.label}</span>
            <span className="mono vl">{fmtEUR(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
