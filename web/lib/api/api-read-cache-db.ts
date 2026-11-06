import { openDB, type DBSchema } from "idb";

export type CachedRead = { key: string; body: string; savedAt: number; contentType: string };
interface ReadCacheDB extends DBSchema {
  responses: { key: string; value: CachedRead; indexes: { savedAt: number } };
  meta: { key: string; value: number };
}
const database = () =>
  openDB<ReadCacheDB>("khun-phaen-api-cache", 1, {
    upgrade(db) {
      db.createObjectStore("responses", { keyPath: "key" }).createIndex("savedAt", "savedAt");
      db.createObjectStore("meta");
    },
  });
/** Recent responses kept in memory so going back to a page reuses them without a request; any write or refresh empties it. */
const FRESH_MS = 2 * 60 * 1000;
const fresh = new Map<string, { body: string; contentType: string; savedAt: number }>();
let epoch = 0;
export const freshReads = {
  epoch: () => epoch,
  get(key: string) {
    const hit = fresh.get(key);
    if (hit && Date.now() - hit.savedAt <= FRESH_MS) return hit;
    fresh.delete(key);
    return undefined;
  },
  put(key: string, body: string, contentType: string, seenEpoch: number) {
    if (seenEpoch === epoch) fresh.set(key, { body, contentType, savedAt: Date.now() });
  },
};

export const readCache = {
  async revision(): Promise<number> {
    return (await (await database()).get("meta", "revision")) ?? 0;
  },
  async get(key: string): Promise<CachedRead | undefined> {
    return (await database()).get("responses", key);
  },
  async put(entry: CachedRead, revision: number): Promise<void> {
    const db = await database();
    const tx = db.transaction(["responses", "meta"], "readwrite");
    if (((await tx.objectStore("meta").get("revision")) ?? 0) === revision) {
      const store = tx.objectStore("responses");
      await store.put(entry);
      const extra = (await store.count()) - 300;
      let cursor = await store.index("savedAt").openCursor();
      for (let i = 0; cursor && i < extra; i++) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
    }
    await tx.done;
  },
  async clear(): Promise<void> {
    epoch++;
    fresh.clear();
    const db = await database();
    const tx = db.transaction(["responses", "meta"], "readwrite");
    const meta = tx.objectStore("meta");
    const revision = (await meta.get("revision")) ?? 0;
    await meta.put(revision + 1, "revision");
    await tx.objectStore("responses").clear();
    await tx.done;
  },
};
