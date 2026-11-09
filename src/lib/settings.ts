import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";

export async function getSetting<T = unknown>(
  key: string,
  fallback?: T,
): Promise<T | undefined> {
  const row = await db.settings.get(key);
  return (row ? (row.value as T) : fallback) ?? fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

/** Hook réactif sur un réglage. */
export function useSetting<T = unknown>(key: string, fallback?: T): T | undefined {
  return useLiveQuery(async () => {
    const row = await db.settings.get(key);
    return (row ? (row.value as T) : fallback) ?? fallback;
  }, [key]);
}

export const SETTINGS_KEYS = {
  pokeApiKey: "pokeApiKey",
  twelveDataApiKey: "twelveDataApiKey",
  cryptoWorkerUrl: "cryptoWorkerUrl",
  cryptoWorkerToken: "cryptoWorkerToken",
} as const;
