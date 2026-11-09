import type { Account, Position } from "../db/db";

export const ACCOUNT_TYPES = [
  { value: "courant", label: "Compte courant", color: "#8fa3b8" },
  { value: "epargne", label: "Épargne", color: "#5fa888" },
  { value: "livretA", label: "Livret A", color: "#cda451" },
  { value: "courtage", label: "Compte titres / courtage", color: "#c66a4d" },
  { value: "crypto", label: "Wallet crypto", color: "#8b6fb0" },
];

export function typeLabel(v: string): string {
  return ACCOUNT_TYPES.find((t) => t.value === v)?.label ?? v;
}

export function typeColor(v: string): string {
  return ACCOUNT_TYPES.find((t) => t.value === v)?.color ?? "#8fa3b8";
}

/**
 * Valeur d'un compte : pour courtage/crypto, somme des positions liées
 * dès qu'il en a au moins une ; sinon le solde de référence saisi à la main.
 */
export function accountValue(account: Account, positions: Position[]): number {
  // Compte exchange auto : valeur = dernier total récupéré via le Worker.
  if (account.exchange) return account.exchangeValue || 0;
  if (account.type === "courtage" || account.type === "crypto") {
    const linked = positions.filter((p) => p.accountId === account.id);
    if (linked.length > 0) {
      return linked.reduce(
        (s, p) => s + p.quantity * (p.currentPrice || 0),
        0,
      );
    }
  }
  return account.balance || 0;
}

/** Total des comptes non partagés. */
export function accountsTotal(
  accounts: Account[],
  positions: Position[],
): number {
  return accounts
    .filter((a) => !a.shared)
    .reduce((s, a) => s + accountValue(a, positions), 0);
}

/** Total des comptes partagés (hors patrimoine). */
export function sharedTotal(
  accounts: Account[],
  positions: Position[],
): number {
  return accounts
    .filter((a) => a.shared)
    .reduce((s, a) => s + accountValue(a, positions), 0);
}
