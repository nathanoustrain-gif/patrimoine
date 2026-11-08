import { useLocation } from "react-router-dom";

const LABELS: Record<string, string> = {
  collection: "Collection",
  patrimoine: "Patrimoine",
  parametres: "Réglages",
};

export default function Header() {
  const { pathname } = useLocation();
  const section = pathname.split("/")[1] || "collection";
  return (
    <header className="app-header">
      <div className="brand">
        <span className="mark">Patrimoine</span>
        <span className="dot" />
      </div>
      <span className="ctx">{LABELS[section] ?? ""}</span>
    </header>
  );
}
