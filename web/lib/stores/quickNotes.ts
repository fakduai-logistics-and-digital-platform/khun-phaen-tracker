import { writable } from "@/lib/store";

const STORAGE_KEY = "khu-phaen-quick-notes-v2";
/** The single-note format used before notes had a list; imported once as the first note. */
const LEGACY_KEY = "khu-phaen-quick-notes-v1";

export type QuickNote = {
  id: string;
  /** Editor HTML. */
  content: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

function load(): QuickNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy?.trim()) {
      const now = new Date().toISOString();
      return [{ id: crypto.randomUUID(), content: legacy, pinned: false, created_at: now, updated_at: now }];
    }
  } catch (error) {
    console.error("Failed to load quick notes:", error);
  }
  return [];
}

function createQuickNotesStore() {
  const store = writable<QuickNote[]>(load());

  function commit(notes: QuickNote[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch (error) {
      console.error("Failed to save quick notes:", error);
    }
    store.set(notes);
  }

  function current(): QuickNote[] {
    let value: QuickNote[] = [];
    store.subscribe((v) => (value = v))();
    return value;
  }

  return {
    subscribe: store.subscribe,
    add(content = ""): QuickNote {
      const now = new Date().toISOString();
      const note: QuickNote = { id: crypto.randomUUID(), content, pinned: false, created_at: now, updated_at: now };
      commit([note, ...current()]);
      return note;
    },
    update(id: string, content: string) {
      commit(
        current().map((note) => (note.id === id ? { ...note, content, updated_at: new Date().toISOString() } : note)),
      );
    },
    duplicate(id: string): QuickNote | null {
      const source = current().find((note) => note.id === id);
      return source ? this.add(source.content) : null;
    },
    togglePin(id: string) {
      commit(current().map((note) => (note.id === id ? { ...note, pinned: !note.pinned } : note)));
    },
    remove(id: string) {
      commit(current().filter((note) => note.id !== id));
    },
  };
}

export const quickNotes = createQuickNotesStore();

/** Plain text of a note, one line per block, for titles and previews. */
export function noteText(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, " ");
  const doc = new DOMParser().parseFromString(
    html.replace(/<\/(p|h[1-6]|li|div|blockquote|pre)>/gi, "\n$&"),
    "text/html",
  );
  return (doc.body.textContent ?? "").replace(/\n{2,}/g, "\n").trim();
}
