import { db } from "../db/db";
import { getSetting, setSetting } from "./settings";

/**
 * Recatégorise une fois les produits scellés déjà enregistrés :
 * si le nom contient « demi-display » ou « pokébox », on leur affecte
 * directement la catégorie correspondante.
 */
export async function recategorizeSealed(): Promise<void> {
  const FLAG = "sealedRecat_v1";
  if (await getSetting<boolean>(FLAG, false)) return;
  const items = await db.sealed.toArray();
  for (const s of items) {
    const n = (s.name || "").toLowerCase();
    let type: string | undefined;
    if (/demi[\s-]?display/.test(n)) type = "Demi-display";
    else if (/pok[eé]\s?box/.test(n)) type = "Pokébox";
    if (type && s.type !== type) {
      await db.sealed.update(s.id, { type, updatedAt: Date.now() });
    }
  }
  await setSetting(FLAG, true);
}
