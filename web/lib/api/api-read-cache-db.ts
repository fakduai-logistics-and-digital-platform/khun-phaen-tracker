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
    const db = await database();
    const tx = db.transaction(["responses", "meta"], "readwrite");
    const meta = tx.objectStore("meta");
    const revision = (await meta.get("revision")) ?? 0;
    await meta.put(revision + 1, "revision");
    await tx.objectStore("responses").clear();
    await tx.done;
  },
};
