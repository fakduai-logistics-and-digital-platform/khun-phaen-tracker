export interface RecentEntry {
  id: string;
  name: string;
  timestamp: number;
}

export type ViewMode = "grid" | "list";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const loadPinned = () => readJson<string[]>("pinned-workspaces", []);
export const savePinned = (ids: string[]) => localStorage.setItem("pinned-workspaces", JSON.stringify(ids));

export const loadRecent = () => readJson<RecentEntry[]>("recent-workspaces", []);
export const saveRecent = (entries: RecentEntry[]) =>
  localStorage.setItem("recent-workspaces", JSON.stringify(entries));

export function loadViewMode(): ViewMode {
  const raw = localStorage.getItem("dashboard-view-mode");
  return raw === "list" ? "list" : "grid";
}
export const saveViewMode = (mode: ViewMode) => localStorage.setItem("dashboard-view-mode", mode);
