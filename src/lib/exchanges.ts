import { getSetting, SETTINGS_KEYS } from "./settings";
import { db } from "../db/db";

/* Comptes exchange disponibles (doivent correspondre aux secrets du Worker). */
export const EXCHANGE_ACCOUNTS = [
  { value: "okx-me", label: "OKX (moi)" },
  { value: "okx-papa", label: "OKX (papa)" },
  { value: "kraken-me", label: "Kraken" },
];

export function exchangeLabel(v?: string): string {
  return EXCHANGE_ACCOUNTS.find((e) => e.value === v)?.label ?? v ?? "";
}

export interface ExchangeAsset {
  symbol: string;
  amount: number;
  eur: number | null;
}
export interface ExchangeBalance {
  assets: ExchangeAsset[];
  totalEur: number;
  updatedAt: number;
}

/** Appelle le Worker Cloudflare pour récupérer les soldes d'un compte exchange. */
export async function fetchExchangeBalance(
  account: string,
): Promise<ExchangeBalance> {
  const url = (await getSetting<string>(SETTINGS_KEYS.cryptoWorkerUrl, "")) || "";
  const token = (await getSetting<string>(SETTINGS_KEYS.cryptoWorkerToken, "")) || "";
  if (!url) {
    throw new Error("Configure l'URL du backend crypto dans Réglages.");
  }
  const base = url.replace(/\/+$/, "");
  const res = await fetch(
    `${base}/balances?account=${encodeURIComponent(account)}`,
    { headers: token ? { "X-Auth": token } : {} },
  );
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    throw new Error("Réponse invalide du backend (" + res.status + ").");
  }
  if (!res.ok || data.error) {
    throw new Error(data.error || "Erreur backend (" + res.status + ").");
  }
  return {
    assets: Array.isArray(data.assets) ? data.assets : [],
    totalEur: typeof data.totalEur === "number" ? data.totalEur : 0,
    updatedAt: data.updatedAt || Date.now(),
  };
}

/** Récupère et enregistre les soldes de tous les comptes exchange. */
export async function syncExchangeAccounts(): Promise<{
  updated: number;
  errors: number;
}> {
  const accounts = await db.accounts.toArray();
  const list = accounts.filter((a) => a.exchange);
  let updated = 0;
  let errors = 0;
  for (const a of list) {
    try {
      const b = await fetchExchangeBalance(a.exchange!);
      await db.accounts.update(a.id, {
        exchangeValue: b.totalEur,
        exchangeAssets: b.assets,
        exchangeUpdated: b.updatedAt,
        exchangeError: undefined,
      });
      updated++;
    } catch (e) {
      await db.accounts.update(a.id, {
        exchangeError: e instanceof Error ? e.message : "erreur",
      });
      errors++;
    }
  }
  return { updated, errors };
}
