import { useState } from "react";
import { db, uid, type Account } from "../../db/db";
import { ACCOUNT_TYPES } from "../../lib/patrimoine";
import { EXCHANGE_ACCOUNTS } from "../../lib/exchanges";
import { fmtEUR } from "../../lib/format";

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
  const [exchange, setExchange] = useState(initial?.exchange ?? "");
  const [saving, setSaving] = useState(false);

  const isCrypto = type === "crypto";
  const isExchange = isCrypto && !!exchange;
  const isTradable = type === "courtage" || (type === "crypto" && !exchange);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const exVal = isCrypto && exchange ? exchange : undefined;
    const account: Account = {
      id: initial?.id ?? uid(),
      name: name.trim(),
      type,
      institution: institution.trim() || undefined,
      balance: parseFloat(balance) || 0,
      shared,
      sharedWith: shared ? sharedWith.trim() || undefined : undefined,
      exchange: exVal,
      // conserve le cache si le compte reste lié au même exchange
      exchangeValue:
        exVal && exVal === initial?.exchange ? initial?.exchangeValue : undefined,
      exchangeAssets:
        exVal && exVal === initial?.exchange ? initial?.exchangeAssets : undefined,
      exchangeUpdated:
        exVal && exVal === initial?.exchange ? initial?.exchangeUpdated : undefined,
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

      {isCrypto && (
        <div className="field">
          <label>Exchange (soldes automatiques, optionnel)</label>
          <select value={exchange} onChange={(e) => setExchange(e.target.value)}>
            <option value="">Aucun (solde/positions manuels)</option>
            {EXCHANGE_ACCOUNTS.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {!isExchange && (
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
      )}

      {isExchange && (
        <p className="market-note" style={{ marginTop: -4 }}>
          Le solde de ce compte sera récupéré automatiquement depuis l'exchange
          (via ton backend crypto, configuré dans Réglages).
        </p>
      )}

      {isExchange && initial?.exchangeAssets && initial.exchangeAssets.length > 0 && (
        <div className="field">
          <label>Détail des actifs</label>
          <div className="holdings">
            {initial.exchangeAssets.map((a) => (
              <div className="holding-row" key={a.symbol}>
                <span className="hsym">{a.symbol}</span>
                <span className="hamt mono">
                  {a.amount.toLocaleString("fr-FR", { maximumFractionDigits: 8 })}
                </span>
                <span className="hval mono">
                  {a.eur != null ? fmtEUR(a.eur) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
