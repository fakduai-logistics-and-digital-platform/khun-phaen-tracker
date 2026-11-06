import { writable } from "@/lib/store";

export interface TaskDefaults {
  project: string;
  assignee_id: number | null;
  category: string;
}

const STORAGE_KEY = "task-defaults-v1";

const DEFAULT_VALUES: TaskDefaults = {
  project: "",
  assignee_id: null,
  category: "งานหลัก",
};

function createTaskDefaultsStore() {
  // Load from localStorage
  const loadFromStorage = (): TaskDefaults => {
    if (typeof window === "undefined") return DEFAULT_VALUES;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_VALUES, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error("Failed to load task defaults:", e);
    }
    return DEFAULT_VALUES;
  };

  const { subscribe, set, update } = writable<TaskDefaults>(loadFromStorage());

  return {
    subscribe,
    set: (values: Partial<TaskDefaults>) => {
      update((current) => {
        const newValues = { ...current, ...values };
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newValues));
        }
        return newValues;
      });
    },
    setProject: (project: string) => {
      if (!project) return;
      update((current) => {
        const newValues = { ...current, project };
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newValues));
        }
        return newValues;
      });
    },
    setAssignee: (assignee_id: number | null) => {
      update((current) => {
        const newValues = { ...current, assignee_id };
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newValues));
        }
        return newValues;
      });
    },
    setCategory: (category: string) => {
      if (!category) return;
      update((current) => {
        const newValues = { ...current, category };
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newValues));
        }
        return newValues;
      });
    },
    reset: () => {
      set(DEFAULT_VALUES);
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
    },
  };
}

export const taskDefaults = createTaskDefaultsStore();
