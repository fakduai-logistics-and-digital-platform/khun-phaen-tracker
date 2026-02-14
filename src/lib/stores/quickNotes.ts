import { writable } from "svelte/store";

const STORAGE_KEY = "khu-phaen-quick-notes-v1";

function createQuickNotesStore() {
  const loadFromStorage = (): string => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(STORAGE_KEY) || "";
    } catch (e) {
      console.error("Failed to load quick notes:", e);
    }
    return "";
  };

  const { subscribe, set, update } = writable<string>(loadFromStorage());

  return {
    subscribe,
    set: (content: string) => {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, content);
      }
      set(content);
    },
    clear: () => {
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
      set("");
    },
  };
}

export const quickNotes = createQuickNotesStore();
