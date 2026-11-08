import { useState } from "react";
import { IconCards, IconBox, IconWealth, IconPlus } from "../components/Icons";

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

      {tab === "cartes" && (
        <div className="empty-state">
          <div className="icon">
            <IconCards size={46} />
          </div>
          <h3>Aucune carte pour l'instant</h3>
          <p>
            Recherchez une carte par nom ou extension : l'image, le set et le prix
            du marché seront récupérés automatiquement.
          </p>
          <button className="btn primary" disabled>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <IconPlus size={16} /> Ajouter une carte
            </span>
          </button>
          <p style={{ marginTop: 14, fontSize: 12 }} className="accent">
            Recherche de cartes — prochaine étape
          </p>
        </div>
      )}

      {tab === "scelle" && (
        <div className="empty-state">
          <div className="icon">
            <IconBox size={46} />
          </div>
          <h3>Aucun produit scellé</h3>
          <p>
            ETB, bundles, displays, coffrets… avec quantité, prix d'achat et valeur
            de marché.
          </p>
          <button className="btn primary" disabled>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <IconPlus size={16} /> Ajouter un produit
            </span>
          </button>
          <p style={{ marginTop: 14, fontSize: 12 }} className="accent">
            Stock scellé — étape suivante
          </p>
        </div>
      )}

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
