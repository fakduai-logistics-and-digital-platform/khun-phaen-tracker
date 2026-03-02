import type { FilterOptions } from "$lib/types";
import type { Sprint } from "$lib/stores/sprintStore";

export const FILTER_STORAGE_KEY = "task-filters";

export const DEFAULT_FILTERS: FilterOptions = {
  dueDatePreset: "all",
  status: "all",
  category: "all",
  project: "all",
  assignee_id: "all",
  sprint_id: "all",
  search: "",
};

export function persistFilters(filters: FilterOptions) {
  if (typeof localStorage === "undefined") return;
  const assigneeValue =
    filters.assignee_id === undefined ? "all" : filters.assignee_id;
  const sprintValue =
    filters.sprint_id === undefined ? "all" : filters.sprint_id;
  const data = {
    dueDatePreset: filters.dueDatePreset || "all",
    status: filters.status || "all",
    category: filters.category || "all",
    project: filters.project || "all",
    assignee_id: assigneeValue,
    sprint_id: sprintValue,
  };
  localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(data));
}

export function restoreFilters(sprints: Sprint[]): FilterOptions {
  if (typeof localStorage === "undefined") return { ...DEFAULT_FILTERS };
  const raw = localStorage.getItem(FILTER_STORAGE_KEY);
  if (!raw) return { ...DEFAULT_FILTERS };

  try {
    const saved = JSON.parse(raw) as Partial<FilterOptions>;
    return {
      ...DEFAULT_FILTERS,
      dueDatePreset: saved.dueDatePreset ?? "all",
      status: saved.status ?? "all",
      category: saved.category ?? "all",
      project: saved.project ?? "all",
      assignee_id: saved.assignee_id !== undefined ? saved.assignee_id : "all",
      sprint_id: normalizeSprintFilterValue(saved.sprint_id, sprints),
    };
  } catch {
    localStorage.removeItem(FILTER_STORAGE_KEY);
    return { ...DEFAULT_FILTERS };
  }
}

export function clearSavedFilters() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(FILTER_STORAGE_KEY);
}

export function normalizeSprintFilterValue(
  value: FilterOptions["sprint_id"],
  sprintList: Sprint[],
): FilterOptions["sprint_id"] {
  if (value === undefined || value === "all" || value === null)
    return value ?? "all";
  return sprintList.some((sprint) => sprint.id === value) ? value : "all";
}
