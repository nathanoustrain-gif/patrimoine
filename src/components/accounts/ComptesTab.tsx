import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Account } from "../../db/db";
import { fmtEUR, fmtDate } from "../../lib/format";
import { ACCOUNT_TYPES, accountValue } from "../../lib/patrimoine";
import { syncExchangeAccounts, exchangeLabel } from "../../lib/exchanges";
import Sheet from "../Sheet";
import AccountForm from "./AccountForm";
import { IconPlus } from "../Icons";

export default function ComptesTab() {
  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  const positions = useLiveQuery(() => db.positions.toArray(), []);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 3200);
  }

  async function syncExchanges() {
    setSyncing(true);
    const { updated, errors } = await syncExchangeAccounts();
    setSyncing(false);
    flash(
      `${updated} compte(s) exchange à jour` +
        (errors ? ` · ${errors} en erreur` : ""),
    );
  }

  if (!accounts || !positions) return null;

  const own = accounts.filter((a) => !a.shared);
  const shared = accounts.filter((a) => a.shared);
  const hasExchange = accounts.some((a) => a.exchange);

  function renderRow(a: Account) {
    return (
      <div className="acc-row" key={a.id}>
        <button className="acc-main" onClick={() => setEditing(a)}>
          <span className="nm">
            {a.name}
            {a.institution && <span className="inst"> · {a.institution}</span>}
            {a.exchange && (
              <span className="tag" style={{ marginLeft: 8 }}>
                {exchangeLabel(a.exchange)}
              </span>
            )}
            {a.shared && (
              <span className="tag" style={{ marginLeft: 8 }}>
                {a.sharedWith ? "Partagé · " + a.sharedWith : "Partagé"}
              </span>
            )}
            {a.exchange && a.exchangeError && (
              <span className="inst" style={{ color: "var(--loss)", display: "block" }}>
                ⚠ {a.exchangeError}
              </span>
            )}
            {a.exchange && !a.exchangeError && a.exchangeUpdated && (
              <span className="inst" style={{ display: "block" }}>
                maj {fmtDate(a.exchangeUpdated)}
              </span>
            )}
          </span>
          <span className="mono val">{fmtEUR(accountValue(a, positions!))}</span>
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="toolbar">
        <button className="btn primary" onClick={() => setAddOpen(true)}>
          <span className="btn-ic">
            <IconPlus size={16} /> Ajouter un compte
          </span>
        </button>
        {hasExchange && (
          <button className="btn" onClick={syncExchanges} disabled={syncing}>
            {syncing ? "Synchro…" : "Rafraîchir soldes"}
          </button>
        )}
      </div>

      {accounts.length === 0 ? (
        <div className="empty-state">
          <h3>Aucun compte</h3>
          <p>
            Ajoute tes comptes (courant, épargne, livret, courtage, wallet crypto)
            pour suivre leur solde et les inclure dans ton patrimoine.
          </p>
        </div>
      ) : (
        <>
          {ACCOUNT_TYPES.map((t) => {
            const list = own.filter((a) => a.type === t.value);
            if (list.length === 0) return null;
            const subtotal = list.reduce(
              (s, a) => s + accountValue(a, positions),
              0,
            );
            return (
              <div className="card" key={t.value}>
                <h2 className="section">
                  {t.label} — {fmtEUR(subtotal)}
                </h2>
                <div className="acc-list">{list.map(renderRow)}</div>
              </div>
            );
          })}

          {shared.length > 0 && (
            <div className="card">
              <h2 className="section">
                Comptes partagés —{" "}
                {fmtEUR(
                  shared.reduce((s, a) => s + accountValue(a, positions), 0),
                )}{" "}
                (hors patrimoine)
              </h2>
              <div className="acc-list">{shared.map(renderRow)}</div>
            </div>
          )}
        </>
      )}

      <Sheet open={addOpen} title="Nouveau compte" onClose={() => setAddOpen(false)}>
        <AccountForm onDone={() => setAddOpen(false)} />
      </Sheet>

      <Sheet
        open={!!editing}
        title="Modifier le compte"
        onClose={() => setEditing(null)}
      >
        {editing && (
          <AccountForm
            initial={editing}
            onDone={() => setEditing(null)}
            onDelete={async () => {
              await db.accounts.delete(editing.id);
              setEditing(null);
              flash("Compte supprimé");
            }}
          />
        )}
      </Sheet>

      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
