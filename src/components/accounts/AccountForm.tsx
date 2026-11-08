import { useState } from "react";
import { db, uid, type Account } from "../../db/db";
import { ACCOUNT_TYPES } from "../../lib/patrimoine";

type Props = {
  initial?: Account;
  onDone: () => void;
  onDelete?: () => void;
};

export default function AccountForm({ initial, onDone, onDelete }: Props) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.type ?? "courant");
  const [institution, setInstitution] = useState(initial?.institution ?? "");
  const [balance, setBalance] = useState(
    initial?.balance != null ? String(initial.balance) : "0",
  );
  const [shared, setShared] = useState(!!initial?.shared);
  const [sharedWith, setSharedWith] = useState(initial?.sharedWith ?? "");
  const [saving, setSaving] = useState(false);

  const isTradable = type === "courtage" || type === "crypto";

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const account: Account = {
      id: initial?.id ?? uid(),
      name: name.trim(),
      type,
      institution: institution.trim() || undefined,
      balance: parseFloat(balance) || 0,
      shared,
      sharedWith: shared ? sharedWith.trim() || undefined : undefined,
      createdAt: initial?.createdAt ?? Date.now(),
    };
    await db.accounts.put(account);
    setSaving(false);
    onDone();
  }

  return (
    <form onSubmit={submit} className="card-form">
      <div className="field">
        <label>Nom</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex : Livret A Boursorama"
          required
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Établissement (optionnel)</label>
          <input
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="Ex : Boursorama"
          />
        </div>
      </div>

      <div className="field">
        <label>
          {isTradable ? "Solde de référence (si aucune position)" : "Solde actuel (€)"}
        </label>
        <input
          type="number"
          step="0.01"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
        />
      </div>

      {isTradable && (
        <p className="market-note" style={{ marginTop: -4 }}>
          Dès que tu ajouteras des positions dans Bourse & Crypto, la valeur du
          compte sera calculée automatiquement à partir de celles-ci.
        </p>
      )}

      <div className="field">
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            style={{ width: "auto" }}
            checked={shared}
            onChange={(e) => setShared(e.target.checked)}
          />
          Compte partagé (exclu du patrimoine total, affiché à part)
        </label>
      </div>

      {shared && (
        <div className="field">
          <label>Partagé avec (optionnel)</label>
          <input
            value={sharedWith}
            onChange={(e) => setSharedWith(e.target.value)}
            placeholder="Ex : Mon père"
          />
        </div>
      )}

      <div className="form-actions">
        {onDelete ? (
          confirmDel ? (
            <button type="button" className="btn danger" onClick={onDelete}>
              Confirmer la suppression
            </button>
          ) : (
            <button
              type="button"
              className="btn danger-ghost"
              onClick={() => setConfirmDel(true)}
            >
              Supprimer
            </button>
          )
        ) : (
          <button type="button" className="btn" onClick={onDone}>
            Annuler
          </button>
        )}
        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? "…" : initial ? "Enregistrer" : "Ajouter le compte"}
        </button>
      </div>
    </form>
  );
}
