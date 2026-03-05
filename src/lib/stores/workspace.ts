import { writable, get } from "svelte/store";
import type { FilterOptions, Sprint, Task } from "$lib/types";
import {
  getAssigneeStats,
  getAssignees,
  getCategories,
  getProjectStats,
  getProjects,
  getProjectsList,
  getStatsFromTasks,
  getTasks,
} from "$lib/db";
import { sprints } from "$lib/stores/sprintStore";

/**
 * Stores the current workspace's MongoDB _id ($oid string).
 * Set when user enters a workspace from the dashboard.
 */
export const currentWorkspaceId = writable<string | null>(null);
export const currentWorkspaceName = writable<string>("");
export const currentWorkspaceOwnerId = writable<string | null>(null);
export const currentWorkspaceColor = writable<string | null>(null);
export const currentWorkspaceIcon = writable<string | null>(null);
export const currentWorkspaceShortName = writable<string | null>(null);

const WS_KEY = "current-workspace-id";
const WS_NAME_KEY = "current-workspace-name";
const WS_OWNER_KEY = "current-workspace-owner-id";
const WS_COLOR_KEY = "current-workspace-color";
const WS_ICON_KEY = "current-workspace-icon";
const WS_SHORT_NAME_KEY = "current-workspace-short-name";

/** Load workspace ID from localStorage on init */
export function loadWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem(WS_KEY);
  const name = localStorage.getItem(WS_NAME_KEY);
  const ownerId = localStorage.getItem(WS_OWNER_KEY);
  const color = localStorage.getItem(WS_COLOR_KEY);
  const icon = localStorage.getItem(WS_ICON_KEY);
  const shortName = localStorage.getItem(WS_SHORT_NAME_KEY);

  if (id) currentWorkspaceId.set(id);
  if (name) currentWorkspaceName.set(name);
  if (ownerId) currentWorkspaceOwnerId.set(ownerId);
  if (color) currentWorkspaceColor.set(color);
  if (icon) currentWorkspaceIcon.set(icon);
  if (shortName) currentWorkspaceShortName.set(shortName);

  return id;
}

/** Set and persist workspace ID + name */
export function setWorkspaceId(
  id: string,
  name?: string,
  ownerId?: string,
  color?: string,
  icon?: string,
  shortName?: string,
) {
  currentWorkspaceId.set(id);
  localStorage.setItem(WS_KEY, id);
  if (name) {
    currentWorkspaceName.set(name);
    localStorage.setItem(WS_NAME_KEY, name);
  }
  if (ownerId) {
    currentWorkspaceOwnerId.set(ownerId);
    localStorage.setItem(WS_OWNER_KEY, ownerId);
  }
  if (color) {
    currentWorkspaceColor.set(color);
    localStorage.setItem(WS_COLOR_KEY, color);
  } else {
    currentWorkspaceColor.set(null);
    localStorage.removeItem(WS_COLOR_KEY);
  }
  if (icon) {
    currentWorkspaceIcon.set(icon);
    localStorage.setItem(WS_ICON_KEY, icon);
  } else {
    currentWorkspaceIcon.set(null);
    localStorage.removeItem(WS_ICON_KEY);
  }
  if (shortName) {
    currentWorkspaceShortName.set(shortName);
    localStorage.setItem(WS_SHORT_NAME_KEY, shortName);
  } else {
    currentWorkspaceShortName.set(null);
    localStorage.removeItem(WS_SHORT_NAME_KEY);
  }
}

/** Clear workspace ID (e.g. on logout) */
export function clearWorkspaceId() {
  currentWorkspaceId.set(null);
  localStorage.removeItem(WS_KEY);
  currentWorkspaceName.set("");
  localStorage.removeItem(WS_NAME_KEY);
  currentWorkspaceOwnerId.set(null);
  localStorage.removeItem(WS_OWNER_KEY);
  currentWorkspaceColor.set(null);
  localStorage.removeItem(WS_COLOR_KEY);
  currentWorkspaceIcon.set(null);
  localStorage.removeItem(WS_ICON_KEY);
  currentWorkspaceShortName.set(null);
  localStorage.removeItem(WS_SHORT_NAME_KEY);
}

/** Get current workspace ID synchronously (throws if not set) */
export function getWorkspaceId(): string {
  const id = get(currentWorkspaceId);
  if (!id) throw new Error("No workspace selected");
  return id;
}

export type WorkspaceDataLoadResult = {
  failedApis: string[];
  paginatedTasks: Task[];
  totalTasks: number;
  totalPages: number;
  allTasks: Task[];
  monthlySummaryTasks: Task[];
  categories?: string[];
  projects?: string[];
  projectList?: {
    id?: string | number;
    name: string;
    repo_url?: string;
    created_at?: string;
  }[];
  assignees?: any[];
  workerStats?: { id: string; taskCount: number }[];
  projectStats?: { id: string; taskCount: number }[];
  stats?: {
    total: number;
    pending: number;
    todo: number;
    in_progress: number;
    in_test: number;
    done: number;
    total_minutes: number;
  };
};

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function buildTaskFilters(
  filters: FilterOptions,
  sprintList: Sprint[],
  currentPage: number,
  pageSize: number,
): FilterOptions {
  const taskFilters: FilterOptions = { ...filters };
  const preset = filters.dueDatePreset || "all";
  const today = new Date();
  const todayYmd = today.toISOString().split("T")[0];

  taskFilters.dueStartDate = "";
  taskFilters.dueEndDate = "";
  taskFilters.dueDatePreset = preset;

  if (preset === "next_day") {
    taskFilters.dueStartDate = todayYmd;
    taskFilters.dueEndDate = addDays(today, 1).toISOString().split("T")[0];
  }
  if (preset === "next_week") {
    taskFilters.dueStartDate = todayYmd;
    taskFilters.dueEndDate = addDays(today, 7).toISOString().split("T")[0];
  }
  if (preset === "next_month") {
    taskFilters.dueStartDate = todayYmd;
    taskFilters.dueEndDate = addDays(today, 30).toISOString().split("T")[0];
  }
  if (filters.sprint_id && filters.sprint_id !== "all") {
    const selectedSprint = sprintList.find(
      (s) => String(s.id) === String(filters.sprint_id),
    );
    if (selectedSprint?.status === "completed") {
      taskFilters.includeArchived = true;
    }
  }

  taskFilters.page = currentPage;
  taskFilters.limit = pageSize;
  return taskFilters;
}

export async function loadWorkspaceData(params: {
  filters: FilterOptions;
  currentPage: number;
  pageSize: number;
}): Promise<WorkspaceDataLoadResult> {
  const allTasksPromise = getTasks({ includeArchived: true, limit: 1000 });
  const categoriesPromise = getCategories();
  const projectsPromise = getProjects();
  const assigneesPromise = getAssignees(true);
  const workerStatsPromise = getAssigneeStats();
  const projectStatsPromise = getProjectStats();
  const projectListPromise = getProjectsList();

  const taskFilters = buildTaskFilters(
    params.filters,
    get(sprints),
    params.currentPage,
    params.pageSize,
  );
  const paginatedPromise = getTasks(taskFilters);

  const [
    paginatedRes,
    allRes,
    categoriesRes,
    projectsRes,
    assigneesRes,
    workerStatsRes,
    projectStatsRes,
    projectListRes,
  ] = await Promise.allSettled([
    paginatedPromise,
    allTasksPromise,
    categoriesPromise,
    projectsPromise,
    assigneesPromise,
    workerStatsPromise,
    projectStatsPromise,
    projectListPromise,
  ]);

  const failedApis: string[] = [];

  let paginatedTasks: Task[] = [];
  let totalTasks = 0;
  let totalPages = 1;
  if (paginatedRes.status === "fulfilled") {
    const valueAny: any = paginatedRes.value;
    if (!Array.isArray(valueAny)) {
      paginatedTasks = valueAny.tasks;
      totalTasks = valueAny.total;
      totalPages = valueAny.pages;
    } else {
      paginatedTasks = valueAny;
      totalTasks = valueAny.length;
      totalPages = Math.ceil(totalTasks / params.pageSize) || 1;
    }
  } else {
    failedApis.push("tasks");
  }

  let allTasks: Task[] = [];
  let stats: WorkspaceDataLoadResult["stats"] | undefined;
  if (allRes.status === "fulfilled") {
    const all = allRes.value;
    allTasks = Array.isArray(all) ? all : all.tasks;
    stats = getStatsFromTasks(allTasks);
  } else {
    failedApis.push("all tasks");
  }

  return {
    failedApis,
    paginatedTasks,
    totalTasks,
    totalPages,
    allTasks,
    monthlySummaryTasks: allTasks,
    categories:
      categoriesRes.status === "fulfilled"
        ? categoriesRes.value
        : (failedApis.push("categories"), undefined),
    projects:
      projectsRes.status === "fulfilled"
        ? projectsRes.value
        : (failedApis.push("projects"), undefined),
    projectList:
      projectListRes.status === "fulfilled"
        ? projectListRes.value
        : (failedApis.push("project list"), undefined),
    assignees:
      assigneesRes.status === "fulfilled"
        ? assigneesRes.value
        : (failedApis.push("assignees"), undefined),
    workerStats:
      workerStatsRes.status === "fulfilled"
        ? workerStatsRes.value
        : (failedApis.push("assignee stats"), undefined),
    projectStats:
      projectStatsRes.status === "fulfilled"
        ? projectStatsRes.value
        : (failedApis.push("project stats"), undefined),
    stats,
  };
}
