const STORAGE_KEY = "khun-phaen:api-keys";

/** Keys created in this browser, by key id. Only the server's hash is stored elsewhere, so this is the only way to refill a command later. */
export function readStoredKeys(): Record<string, string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(keys: Record<string, string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    /* Storage can be unavailable; the guide then asks for the key to be pasted. */
  }
}

export function rememberKey(id: string, key: string) {
  write({ ...readStoredKeys(), [id]: key });
}

/** Drops stored keys that are no longer active on the server. */
export function keepOnly(activeIds: string[]) {
  const stored = readStoredKeys();
  const kept = Object.fromEntries(Object.entries(stored).filter(([id]) => activeIds.includes(id)));
  if (Object.keys(kept).length !== Object.keys(stored).length) write(kept);
  return kept;
}
