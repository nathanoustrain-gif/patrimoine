/* Icônes SVG inline (pas de dépendance). Style trait, hérite de currentColor. */

type P = { size?: number };
const base = (size = 22) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export function IconCollection({ size }: P) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="4" width="11" height="16" rx="1.5" />
      <path d="M17 7l3.4.9a1 1 0 0 1 .7 1.2l-2.6 9.7a1 1 0 0 1-1.2.7L14 19.4" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M4 17l3-3 2 2 3-3" />
    </svg>
  );
}

export function IconWealth({ size }: P) {
  return (
    <svg {...base(size)}>
      <path d="M3 17l5-5 3 3 5-6 5 5" />
      <path d="M3 21h18" />
    </svg>
  );
}

export function IconSettings({ size }: P) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H2a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1A2 2 0 1 1 5.9 2.6l.1.1a1.6 1.6 0 0 0 1.8.3H8a1.6 1.6 0 0 0 1-1.5V1a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V8a1.6 1.6 0 0 0 1.5 1H23a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </svg>
  );
}

export function IconCards({ size }: P) {
  return (
    <svg {...base(size)}>
      <rect x="4" y="3" width="12" height="16" rx="1.5" />
      <path d="M8 21h11a1 1 0 0 0 1-1V8" />
      <path d="M7 8h6M7 11h6" />
    </svg>
  );
}

export function IconBox({ size }: P) {
  return (
    <svg {...base(size)}>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
    </svg>
  );
}

export function IconPlus({ size }: P) {
  return (
    <svg {...base(size)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
