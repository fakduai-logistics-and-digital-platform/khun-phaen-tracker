import { writable } from "@/lib/store";

export interface ColumnSetting {
  id: string;
  label: string;
  enabled: boolean;
}

const DEFAULT_SETTINGS: ColumnSetting[] = [
  { id: "priority", label: "Priority", enabled: true },
  { id: "project", label: "Project", enabled: true },
  { id: "category", label: "Category", enabled: true },
  { id: "assignee", label: "Assignee", enabled: true },
  { id: "sprint", label: "Sprint", enabled: true },
  { id: "status", label: "Status", enabled: true },
  { id: "date", label: "Due date", enabled: true },
];

const STORAGE_KEY = "column-settings-v1";

function createColumnSettingsStore() {
  const loadFromStorage = (): ColumnSetting[] => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Merge with defaults to ensure new settings are included
          const savedMap = new Map(parsed.map((s) => [s.id, s]));
          return DEFAULT_SETTINGS.map((def) => ({
            ...def,
            enabled: savedMap.has(def.id) ? savedMap.get(def.id).enabled : def.enabled,
          }));
        }
      }
    } catch (e) {
      console.error("Failed to load column settings:", e);
    }
    return DEFAULT_SETTINGS;
  };

  const { subscribe, set, update } = writable<ColumnSetting[]>(loadFromStorage());

  return {
    subscribe,
    toggle: (id: string) => {
      update((settings) => {
        const newSettings = settings.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
        }
        return newSettings;
      });
    },
    reset: () => {
      set(DEFAULT_SETTINGS);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
      }
    },
  };
}

export const columnSettings = createColumnSettingsStore();
