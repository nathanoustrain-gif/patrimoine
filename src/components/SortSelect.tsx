export type SortKey = "nom" | "prix" | "date" | "cat";

interface Sortable {
  name: string;
  createdAt?: number;
  quantity?: number;
}

/** Tri générique : nom, prix (valeur décroissante), date d'ajout, catégorie. */
export function sortItems<T extends Sortable>(
  items: T[],
  key: SortKey,
  priceFn: (i: T) => number,
  catField: keyof T,
): T[] {
  const arr = [...items];
  arr.sort((a, b) => {
    switch (key) {
      case "prix":
        return (b.quantity || 1) * priceFn(b) - (a.quantity || 1) * priceFn(a);
      case "date":
        return (b.createdAt || 0) - (a.createdAt || 0);
      case "cat":
        return (
          String(a[catField] || "").localeCompare(
            String(b[catField] || ""),
            "fr",
          ) || a.name.localeCompare(b.name, "fr")
        );
      default:
        return a.name.localeCompare(b.name, "fr");
    }
  });
  return arr;
}

export function SortSelect({
  value,
  onChange,
  extensionLabel,
}: {
  value: SortKey;
  onChange: (k: SortKey) => void;
  extensionLabel: string;
}) {
  return (
    <label className="sort-select">
      <span>Trier</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
      >
        <option value="nom">Nom (A→Z)</option>
        <option value="prix">Prix (décroissant)</option>
        <option value="date">Ajout (récent)</option>
        <option value="cat">{extensionLabel}</option>
      </select>
    </label>
  );
}
