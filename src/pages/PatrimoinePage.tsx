import { IconWealth } from "../components/Icons";

export default function PatrimoinePage() {
  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Patrimoine</h1>
          <div className="sub">Vue d'ensemble de ton patrimoine</div>
        </div>
      </div>

      <div className="card">
        <div className="empty-state" style={{ padding: "40px 16px" }}>
          <div className="icon">
            <IconWealth size={46} />
          </div>
          <h3>Vue de patrimoine global</h3>
          <p>
            Comptes, bourse, crypto et objets de valeur seront regroupés ici après
            le module Collection.
          </p>
          <span className="tag">à venir</span>
        </div>
      </div>
    </div>
  );
}
