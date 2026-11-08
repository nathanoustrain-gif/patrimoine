import { useState } from "react";
import OverviewTab from "../components/patrimoine/OverviewTab";
import ComptesTab from "../components/accounts/ComptesTab";
import BourseTab from "../components/bourse/BourseTab";

type Tab = "overview" | "comptes" | "bourse";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Vue d'ensemble" },
  { key: "comptes", label: "Comptes" },
  { key: "bourse", label: "Bourse & Crypto" },
];

export default function PatrimoinePage() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Patrimoine</h1>
          <div className="sub">Comptes, placements et collection réunis</div>
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

      {tab === "overview" && <OverviewTab />}
      {tab === "comptes" && <ComptesTab />}
      {tab === "bourse" && <BourseTab />}
    </div>
  );
}
