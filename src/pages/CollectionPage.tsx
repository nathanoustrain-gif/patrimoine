import { useState } from "react";
import { IconWealth } from "../components/Icons";
import CardsTab from "../components/cards/CardsTab";
import SealedTab from "../components/sealed/SealedTab";

type Tab = "cartes" | "scelle" | "tableau";

const TABS: { key: Tab; label: string }[] = [
  { key: "cartes", label: "Cartes" },
  { key: "scelle", label: "Scellé" },
  { key: "tableau", label: "Tableau de bord" },
];

export default function CollectionPage() {
  const [tab, setTab] = useState<Tab>("cartes");

  return (
    <div className="collection-scope">
      <div className="page-title">
        <div>
          <h1>Collection</h1>
          <div className="sub">Cartes Pokémon & produits scellés</div>
        </div>
      </div>

      <div className="segmented">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "active" : ""}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "cartes" && <CardsTab />}

      {tab === "scelle" && <SealedTab />}

      {tab === "tableau" && (
        <div className="empty-state">
          <div className="icon">
            <IconWealth size={46} />
          </div>
          <h3>Tableau de bord</h3>
          <p>
            Valeur totale, coût d'achat, plus-value, répartition cartes/scellé et
            historique de la valeur dans le temps.
          </p>
          <span className="tag">à venir</span>
        </div>
      )}
    </div>
  );
}
