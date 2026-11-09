import { useEffect, useState } from "react";
import { db } from "../db/db";
import { getSetting, setSetting, SETTINGS_KEYS } from "../lib/settings";
import { useAuthUser, signInGoogle, signOutUser } from "../lib/auth";

const TABLES = ["cards", "sealed", "snapshots", "settings"] as const;

export default function SettingsPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [tdKey, setTdKey] = useState("");
  const [workerUrl, setWorkerUrl] = useState("");
  const [workerToken, setWorkerToken] = useState("");
  const user = useAuthUser();

  useEffect(() => {
    getSetting<string>(SETTINGS_KEYS.twelveDataApiKey, "").then((v) =>
      setTdKey(v ?? ""),
    );
    getSetting<string>(SETTINGS_KEYS.cryptoWorkerUrl, "").then((v) =>
      setWorkerUrl(v ?? ""),
    );
    getSetting<string>(SETTINGS_KEYS.cryptoWorkerToken, "").then((v) =>
      setWorkerToken(v ?? ""),
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

  async function saveCrypto() {
    await setSetting(SETTINGS_KEYS.cryptoWorkerUrl, workerUrl.trim());
    await setSetting(SETTINGS_KEYS.cryptoWorkerToken, workerToken.trim());
    flash("Backend crypto enregistré");
  }

  async function doSignIn() {
    try {
      await signInGoogle();
      flash("Connecté");
    } catch (e) {
      flash(
        "Échec connexion : " +
          (e instanceof Error ? e.message : "réessaie"),
      );
    }
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
        <h2 className="section">Synchronisation cloud</h2>
        {user === undefined ? (
          <p style={{ color: "var(--paper-dim)", fontSize: 13.5, margin: 0 }}>
            Chargement…
          </p>
        ) : user ? (
          <>
            <p style={{ color: "var(--paper-dim)", fontSize: 13.5, marginTop: 0, marginBottom: 14 }}>
              Connecté en tant que <strong style={{ color: "var(--paper)" }}>{user.email}</strong>.
              Tes données se synchroniseront sur tes appareils.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => signOutUser()}>
                Se déconnecter
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: "var(--paper-dim)", fontSize: 13.5, marginTop: 0, marginBottom: 14 }}>
              Connecte-toi pour retrouver ta collection et ton patrimoine sur tous
              tes appareils (PC, téléphone), synchronisés automatiquement.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn primary" onClick={doSignIn}>
                Se connecter avec Google
              </button>
            </div>
          </>
        )}
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
        <h2 className="section">Backend crypto (Cloudflare Worker)</h2>
        <p style={{ color: "var(--paper-dim)", fontSize: 13.5, marginTop: 0, marginBottom: 16 }}>
          Pour récupérer automatiquement tes soldes OKX / Kraken. Colle l'URL de
          ton Worker et le jeton (CLIENT_TOKEN) que tu as défini.
        </p>
        <div className="field">
          <label>URL du Worker</label>
          <input
            value={workerUrl}
            onChange={(e) => setWorkerUrl(e.target.value)}
            placeholder="https://patrimoine-crypto.xxx.workers.dev"
          />
        </div>
        <div className="field">
          <label>Jeton (CLIENT_TOKEN)</label>
          <input
            value={workerToken}
            onChange={(e) => setWorkerToken(e.target.value)}
            placeholder="ton jeton"
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn primary" onClick={saveCrypto}>
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
