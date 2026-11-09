import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { fbStore } from "./firebase";
import { db } from "../db/db";

/* ============================================================
   Synchro cloud (Firestore) — par store, dernier écrit gagne.
   - À la connexion : appariement initial (pull / push / fusion de sécurité).
   - Temps réel : onSnapshot pour recevoir les changements d'un autre appareil.
   - Détection des changements locaux par sondage (hash) → push.
   Modèle : users/{uid}/stores/{store} = { items:[...], updatedAt, device }.
   ============================================================ */

const STORES = [
  "cards",
  "sealed",
  "snapshots",
  "accounts",
  "positions",
  "settings",
] as const;

function keyField(store: string): string {
  return store === "settings" ? "key" : "id";
}

// Identifiant d'appareil (pour ignorer l'écho de nos propres écritures).
function deviceId(): string {
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("deviceId", id);
  }
  return id;
}
const DEVICE = deviceId();

let applyingRemote = false;
let unsubs: Array<() => void> = [];
let poller: ReturnType<typeof setInterval> | null = null;
let activeUid: string | null = null;

function metaKey(uid: string, store: string) {
  return `sync:${uid}:${store}`;
}
function getMeta(uid: string, store: string): {
  syncedAt?: number;
  hash?: string;
  localChangeAt?: number;
} {
  try {
    return JSON.parse(localStorage.getItem(metaKey(uid, store)) || "{}");
  } catch {
    return {};
  }
}
function setMeta(uid: string, store: string, m: object) {
  localStorage.setItem(metaKey(uid, store), JSON.stringify(m));
}

function hashItems(items: any[]): string {
  const key = items[0] && "key" in items[0] ? "key" : "id";
  const stable = [...items].sort((a, b) =>
    String(a[key]).localeCompare(String(b[key])),
  );
  const s = JSON.stringify(stable);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return s.length + ":" + h;
}

function storeRef(uid: string, store: string) {
  return doc(fbStore, "users", uid, "stores", store);
}

async function localItems(store: string): Promise<any[]> {
  return db.table(store).toArray();
}

async function pushStore(uid: string, store: string, items?: any[]) {
  const data = items ?? (await localItems(store));
  const updatedAt = Date.now();
  await setDoc(storeRef(uid, store), { items: data, updatedAt, device: DEVICE });
  setMeta(uid, store, { syncedAt: updatedAt, hash: hashItems(data) });
}

async function applyRemote(
  uid: string,
  store: string,
  remote: { items: any[]; updatedAt: number },
) {
  applyingRemote = true;
  try {
    const items = Array.isArray(remote.items) ? remote.items : [];
    await db.transaction("rw", db.table(store), async () => {
      await db.table(store).clear();
      if (items.length) await db.table(store).bulkPut(items);
    });
    setMeta(uid, store, { syncedAt: remote.updatedAt, hash: hashItems(items) });
  } finally {
    applyingRemote = false;
  }
}

/** Fusion sans perte : union par clé, en cas de doublon le plus récent gagne. */
function mergeItems(local: any[], remote: any[], key: string): any[] {
  const map = new Map<string, any>();
  for (const it of remote) map.set(String(it[key]), it);
  for (const it of local) {
    const k = String(it[key]);
    const ex = map.get(k);
    if (!ex) map.set(k, it);
    else map.set(k, (it.updatedAt || 0) >= (ex.updatedAt || 0) ? it : ex);
  }
  return [...map.values()];
}

async function initialSync(uid: string, store: string) {
  const items = await localItems(store);
  const meta = getMeta(uid, store);
  const snap = await getDoc(storeRef(uid, store));
  const key = keyField(store);

  if (!snap.exists()) {
    if (items.length) await pushStore(uid, store, items);
    else setMeta(uid, store, { syncedAt: 0, hash: hashItems(items) });
    return;
  }
  const remote = snap.data() as { items: any[]; updatedAt: number };

  if (items.length === 0) {
    await applyRemote(uid, store, remote);
    return;
  }

  const localHash = hashItems(items);
  const neverSynced = meta.hash === undefined;
  const localChanged = !neverSynced && localHash !== meta.hash;
  const remoteChanged = remote.updatedAt > (meta.syncedAt || 0);

  if (neverSynced) {
    // Deux jeux de données jamais appariés → fusion de sécurité (aucune perte).
    const merged = mergeItems(items, remote.items || [], key);
    await applyRemote(uid, store, { items: merged, updatedAt: Date.now() });
    await pushStore(uid, store, merged);
  } else if (localChanged && remoteChanged) {
    // Conflit → fusion de sécurité.
    const merged = mergeItems(items, remote.items || [], key);
    await applyRemote(uid, store, { items: merged, updatedAt: Date.now() });
    await pushStore(uid, store, merged);
  } else if (remoteChanged) {
    await applyRemote(uid, store, remote);
  } else if (localChanged) {
    await pushStore(uid, store, items);
  }
}

function subscribe(uid: string, store: string) {
  const unsub = onSnapshot(storeRef(uid, store), (snap) => {
    if (!snap.exists() || applyingRemote) return;
    const remote = snap.data() as {
      items: any[];
      updatedAt: number;
      device?: string;
    };
    const meta = getMeta(uid, store);
    if (remote.device === DEVICE) {
      if (meta.syncedAt !== remote.updatedAt)
        setMeta(uid, store, { ...meta, syncedAt: remote.updatedAt });
      return;
    }
    if (remote.updatedAt !== meta.syncedAt) {
      applyRemote(uid, store, remote);
    }
  });
  unsubs.push(unsub);
}

async function checkLocalChanges(uid: string) {
  if (applyingRemote) return;
  for (const store of STORES) {
    const items = await localItems(store);
    const h = hashItems(items);
    const meta = getMeta(uid, store);
    if (meta.hash !== undefined && h !== meta.hash) {
      setMeta(uid, store, { ...meta, localChangeAt: Date.now() });
      try {
        await pushStore(uid, store, items);
      } catch {
        /* réessaiera au prochain tour */
      }
    }
  }
}

export async function startSync(uid: string) {
  if (activeUid === uid) return;
  stopSync();
  activeUid = uid;
  for (const store of STORES) {
    try {
      await initialSync(uid, store);
    } catch {
      /* on continue les autres stores */
    }
  }
  if (activeUid !== uid) return; // déconnecté entre-temps
  for (const store of STORES) subscribe(uid, store);
  poller = setInterval(() => checkLocalChanges(uid), 4000);
}

export function stopSync() {
  unsubs.forEach((u) => u());
  unsubs = [];
  if (poller) clearInterval(poller);
  poller = null;
  activeUid = null;
}
