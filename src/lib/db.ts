const DB_NAME = "frameo";
const DB_VERSION = 1;
const STORE_NAME = "store";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getStore(mode: IDBTransactionMode = "readonly") {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, mode);
  return { store: tx.objectStore(STORE_NAME), tx, db };
}

async function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const db = {
  async get<T>(key: string): Promise<T | undefined> {
    const { store, db: idb } = await getStore("readonly");
    try {
      return await promisify(store.get(key)) as T | undefined;
    } finally {
      idb.close();
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    const { store, tx, db: idb } = await getStore("readwrite");
    return new Promise((resolve, reject) => {
      store.put(value, key);
      tx.oncomplete = () => { idb.close(); resolve(); };
      tx.onerror = () => { idb.close(); reject(tx.error); };
    });
  },

  async remove(key: string): Promise<void> {
    const { store, tx, db: idb } = await getStore("readwrite");
    return new Promise((resolve, reject) => {
      store.delete(key);
      tx.oncomplete = () => { idb.close(); resolve(); };
      tx.onerror = () => { idb.close(); reject(tx.error); };
    });
  },

  async keys(): Promise<string[]> {
    const { store, db: idb } = await getStore("readonly");
    try {
      return await promisify(store.getAllKeys()) as string[];
    } finally {
      idb.close();
    }
  },
};

/**
 * Two-way sync between localStorage and IndexedDB.
 *
 * 1. Forward — mirrors the current localStorage values into IndexedDB so a
 *    durable copy always exists.
 * 2. Backward — if a key is missing from localStorage (e.g. WebView2 cleared
 *    it between sessions), restores it from IndexedDB, so the library,
 *    settings and positions survive a localStorage wipe.
 *
 * localStorage stays the primary layer (stores read it synchronously);
 * IndexedDB is the durable backup. Both passes are idempotent, so this is
 * safe to run on every app start.
 */
export async function migrateFromLocalStorage(): Promise<void> {
  const keys = [
    "frameo.items",
    "frameo.settings",
    "frameo.positions",
    "frameo.groups",
  ];

  // Forward: localStorage -> IndexedDB. Only needed once (or again after a
  // wipe removed the flag) — the store persistence effects keep IndexedDB in
  // sync with localStorage on every change after that.
  if (localStorage.getItem("frameo.dbMigrated") !== "v1") {
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          await db.set(key, JSON.parse(raw));
        } catch {
          // If a value can't be parsed, skip it.
        }
      }
    }
    localStorage.setItem("frameo.dbMigrated", "v1");
  }

  // Backward: IndexedDB -> localStorage, only for keys localStorage lost.
  for (const key of keys) {
    if (localStorage.getItem(key) === null) {
      try {
        const value = await db.get(key);
        if (value !== undefined) {
          localStorage.setItem(key, JSON.stringify(value));
        }
      } catch {
        // Ignore — localStorage is the primary layer anyway.
      }
    }
  }
}
