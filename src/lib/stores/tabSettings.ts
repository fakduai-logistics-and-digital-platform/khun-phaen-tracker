import { writable } from "svelte/store";

export type TabId = "list" | "calendar" | "kanban" | "table" | "gantt" | "workload";

export interface TabConfig {
  id: TabId;
  label: string;
  icon: string;
  enabled: boolean;
}

const DEFAULT_TABS: TabConfig[] = [
  { id: "list", label: "รายการ", icon: "List", enabled: true },
  { id: "calendar", label: "ปฏิทิน", icon: "CalendarDays", enabled: true },
  { id: "kanban", label: "Kanban", icon: "Columns3", enabled: true },
  { id: "table", label: "ตาราง", icon: "Table", enabled: true },
  { id: "gantt", label: "แผนงาน", icon: "GanttChart", enabled: true },
  { id: "workload", label: "Workload", icon: "UsersRound", enabled: true },
];

const STORAGE_KEY = "tab-settings-v2";

function createTabSettingsStore() {
  const normalizeTabs = (tabs: unknown): TabConfig[] | null => {
    if (!Array.isArray(tabs)) {
      return null;
    }

    const defaultById = new Map(DEFAULT_TABS.map((tab) => [tab.id, tab]));
    const normalized: TabConfig[] = [];
    const seen = new Set<TabId>();

    for (const candidate of tabs) {
      if (!candidate || typeof candidate !== "object") return null;
      const raw = candidate as Partial<TabConfig>;
      if (typeof raw.id !== "string" || typeof raw.icon !== "string" || typeof raw.label !== "string") {
        return null;
      }
      const defaults = defaultById.get(raw.id as TabId);
      if (!defaults) return null;
      if (seen.has(defaults.id)) continue;
      seen.add(defaults.id);
      normalized.push({
        id: defaults.id,
        icon: raw.icon,
        label: raw.label,
        enabled: typeof raw.enabled === "boolean" ? raw.enabled : true,
      });
    }

    for (const tab of DEFAULT_TABS) {
      if (!seen.has(tab.id)) {
        normalized.push({ ...tab });
      }
    }

    if (normalized.length !== DEFAULT_TABS.length) return null;
    return normalized;
  };

  // Load from localStorage
  const loadFromStorage = (): TabConfig[] => {
    if (typeof window === "undefined") return DEFAULT_TABS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const normalized = normalizeTabs(parsed);
        if (normalized) return normalized;
      }
    } catch (e) {
      console.error("Failed to load tab settings:", e);
    }
    return DEFAULT_TABS;
  };

  const { subscribe, set, update } = writable<TabConfig[]>(loadFromStorage());

  return {
    subscribe,
    set: (tabs: TabConfig[]) => {
      set(tabs);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
      }
    },
    moveUp: (index: number) => {
      update((tabs) => {
        if (index <= 0) return tabs;
        const newTabs = [...tabs];
        [newTabs[index - 1], newTabs[index]] = [
          newTabs[index],
          newTabs[index - 1],
        ];
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newTabs));
        }
        return newTabs;
      });
    },
    moveDown: (index: number) => {
      update((tabs) => {
        if (index >= tabs.length - 1) return tabs;
        const newTabs = [...tabs];
        [newTabs[index], newTabs[index + 1]] = [
          newTabs[index + 1],
          newTabs[index],
        ];
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newTabs));
        }
        return newTabs;
      });
    },
    reset: () => {
      set(DEFAULT_TABS);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TABS));
      }
    },
  };
}

export const tabSettings = createTabSettingsStore();
