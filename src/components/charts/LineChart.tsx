export type Point = { date: number; value: number };

export default function LineChart({
  points,
  height = 130,
}: {
  points: Point[];
  height?: number;
}) {
  const width = 600;
  if (!points || points.length < 2) {
    return (
      <div className="empty-state" style={{ padding: "24px 0", fontSize: 13 }}>
        Pas encore assez d'historique pour tracer une courbe. Un point est
        enregistré à chaque jour d'utilisation et à chaque mise à jour des prix.
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.12 || 1;
  const yMin = min - pad;
  const yMax = max + pad;
  const stepX = width / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p.value - yMin) / (yMax - yMin)) * height;
    return [x, y] as const;
  });

  const pathD = coords
    .map((c, i) => (i === 0 ? "M" : "L") + c[0].toFixed(1) + " " + c[1].toFixed(1))
    .join(" ");
  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;
  const last = coords[coords.length - 1];

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--coll-accent)" stopOpacity={0.35} />
          <stop offset="100%" stopColor="var(--coll-accent)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#chart-grad)" />
      <path
        d={pathD}
        fill="none"
        stroke="var(--coll-accent)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r={3.5} fill="var(--coll-accent)" />
    </svg>
  );
}
