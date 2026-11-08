import { useEffect, useState } from "react";
import { db } from "../db/db";
import { getSetting, setSetting, SETTINGS_KEYS } from "../lib/settings";

const TABLES = ["cards", "sealed", "snapshots", "settings"] as const;

export default function SettingsPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [tdKey, setTdKey] = useState("");

  useEffect(() => {
    getSetting<string>(SETTINGS_KEYS.twelveDataApiKey, "").then((v) =>
      setTdKey(v ?? ""),
    );
  }, []);

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 2600);
  }

  async function saveTdKey() {
    await setSetting(SETTINGS_KEYS.twelveDataApiKey, tdKey.trim());
    flash("Clé Twelve Data enregistrée");
  }

  async function exportBackup() {
    const dump: Record<string, unknown[]> = {};
    for (const t of TABLES) {
      dump[t] = await db.table(t).toArray();
    }
    const payload = {
      app: "patrimoine",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: dump,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "patrimoine-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(url);
    flash("Sauvegarde exportée");
  }

  async function importBackup(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const data = parsed.data ?? parsed;
      for (const t of TABLES) {
        if (Array.isArray(data[t])) {
          await db.table(t).bulkPut(data[t]);
        }
      }
      flash("Import terminé — rechargez la page");
    } catch {
      flash("Fichier invalide");
    }
    ev.target.value = "";
  }

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Réglages</h1>
          <div className="sub">Sauvegarde & préférences</div>
        </div>
      </div>

      <div className="card">
        <h2 className="section">Clé API Twelve Data</h2>
        <p style={{ color: "var(--paper-dim)", fontSize: 13.5, marginTop: 0, marginBottom: 16 }}>
          Nécessaire pour rafraîchir les prix des actions / ETF (onglet Patrimoine →
          Bourse & Crypto). Les cryptos (CoinGecko) n'en ont pas besoin. Clé gratuite
          sur twelvedata.com.
        </p>
        <div className="field">
          <label>Clé API</label>
          <input
            value={tdKey}
            onChange={(e) => setTdKey(e.target.value)}
            placeholder="Votre clé Twelve Data (optionnel)"
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn primary" onClick={saveTdKey}>
            Enregistrer
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="section">Sauvegarde des données</h2>
        <p style={{ color: "var(--paper-dim)", fontSize: 13.5, marginTop: 0, marginBottom: 16 }}>
          Toutes tes données restent en local dans ce navigateur (IndexedDB).
          Exporte régulièrement une sauvegarde JSON pour ne rien perdre.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn" onClick={exportBackup}>
            Exporter (JSON)
          </button>
          <label className="btn" style={{ cursor: "pointer" }}>
            Importer un backup
            <input
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={importBackup}
            />
          </label>
        </div>
      </div>

      <div className="card">
        <h2 className="section">À propos</h2>
        <p style={{ color: "var(--paper-dim)", fontSize: 13.5, margin: 0 }}>
          Patrimoine — suivi de collection et de patrimoine. Données 100% locales,
          sans compte ni serveur.
        </p>
      </div>

      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
