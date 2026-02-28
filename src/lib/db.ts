/**
 * db.ts — API-backed data layer
 *
 * All data is stored on the server (MongoDB) scoped by workspace_id.
 * This module replaces the previous SQLite WASM / localStorage approach.
 */

import type { Task, Project, Assignee, FilterOptions } from "./types";
import { api } from "./apis";
import { getWorkspaceId, loadWorkspaceId } from "./stores/workspace";
import { broadcastChange } from "./stores/realtime";

// ===== Initialisation =====

let _initialized = false;

export async function initDB(): Promise<void> {
  if (_initialized) return;
  loadWorkspaceId();
  _initialized = true;
  console.log("✅ DB layer initialised (API mode)");
}

export async function closeDB(): Promise<void> {
  _initialized = false;
}

export function cleanupDB(): void {
  // No-op in API mode
}

// Keep exports for backward compat but they're no-ops
export function cleanupLegacyDatabaseStorage(): void {}

// ===== Helper =====

function wsId(): string {
  return getWorkspaceId();
}

function extractId(doc: any): string {
  if (doc._id?.$oid) return doc._id.$oid;
  if (typeof doc._id === "string") return doc._id;
  return "";
}

function docToTask(doc: any): Task {
  return {
    id: extractId(doc),
    title: doc.title || "",
    project: doc.project || "",
    duration_minutes: doc.duration_minutes || 0,
    date: doc.date || "",
    end_date: doc.end_date || undefined,
    status: doc.status || "todo",
    category: doc.category || "อื่นๆ",
    notes: doc.notes || "",
    assignee_ids: doc.assignee_ids || [],
    assignees: [],
    assignee_id: null,
    assignee: null,
    sprint_id: doc.sprint_id || null,
    is_archived: doc.is_archived || false,
    checklist: doc.checklist || undefined,
    created_at: doc.created_at || "",
    updated_at: doc.updated_at || "",
  };
}

function docToProject(doc: any): Project {
  return {
    id: extractId(doc),
    name: doc.name || "",
    repo_url: doc.repo_url || undefined,
    created_at: doc.created_at || "",
  };
}

function docToAssignee(doc: any): Assignee {
  return {
    id: extractId(doc),
    name: doc.name || "",
    color: doc.color || "#6366F1",
    discord_id: doc.discord_id || undefined,
    created_at: doc.created_at || "",
  };
}

// ===== Task Functions =====

export async function addTask(
  task: Omit<Task, "id" | "created_at">,
): Promise<string> {
  const res = await api.data.tasks.create(wsId(), {
    title: task.title,
    project: task.project || "",
    duration_minutes: task.duration_minutes,
    date: task.date,
    end_date: task.end_date || null,
    status: task.status,
    category: task.category || "อื่นๆ",
    notes: task.notes || "",
    assignee_ids: task.assignee_ids?.map(String) || null,
    sprint_id: task.sprint_id ? String(task.sprint_id) : null,
    is_archived: task.is_archived || false,
    checklist: task.checklist || null,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create task");
  const newId = extractId(data.task);
  broadcastChange("task", "create", newId);
  return newId;
}

export async function updateTask(
  id: string | number,
  updates: Partial<Task>,
): Promise<void> {
  const payload: Record<string, any> = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.project !== undefined) payload.project = updates.project;
  if (updates.duration_minutes !== undefined)
    payload.duration_minutes = updates.duration_minutes;
  if (updates.date !== undefined) payload.date = updates.date;
  if (updates.end_date !== undefined)
    payload.end_date = updates.end_date || null;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.assignee_ids !== undefined)
    payload.assignee_ids = updates.assignee_ids?.map(String) || null;
  if (updates.sprint_id !== undefined)
    payload.sprint_id = updates.sprint_id ? String(updates.sprint_id) : null;
  if (updates.is_archived !== undefined)
    payload.is_archived = updates.is_archived;
  if (updates.checklist !== undefined)
    payload.checklist = updates.checklist || null;

  const res = await api.data.tasks.update(wsId(), String(id), payload);
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to update task");
  }
  broadcastChange("task", "update", String(id));
}

export async function deleteTask(id: string | number): Promise<void> {
  const res = await api.data.tasks.delete(wsId(), String(id));
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to delete task");
  }
  broadcastChange("task", "delete", String(id));
}

export async function getTasks(filter?: FilterOptions): Promise<Task[]> {
  const params: Record<string, string> = {};

  if (filter?.status && filter.status !== "all") {
    if (filter.status === "today") {
      const today = new Date().toISOString().split("T")[0];
      params.start_date = today;
      params.end_date = today;
      params.status = "active";
    } else if (filter.status === "active") {
      params.status = "active";
    } else if (filter.status === "archived") {
      params.status = "archived";
    } else {
      params.status = filter.status;
    }
  }
  if (filter?.category && filter.category !== "all")
    params.category = filter.category;
  if (filter?.project && filter.project !== "all")
    params.project = filter.project;
  if (
    filter?.assignee_id &&
    filter.assignee_id !== "all" &&
    filter.assignee_id !== null
  ) {
    params.assignee_id = String(filter.assignee_id);
  }
  if (
    filter?.sprint_id &&
    filter.sprint_id !== "all" &&
    filter.sprint_id !== null
  ) {
    params.sprint_id = String(filter.sprint_id);
  }
  if (filter?.search) params.search = filter.search;
  if (filter?.startDate) params.start_date = filter.startDate;
  if (filter?.endDate) params.end_date = filter.endDate;
  if (filter?.includeArchived) params.include_archived = "true";

  const res = await api.data.tasks.list(wsId(), params);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch tasks");

  const tasks: Task[] = (data.tasks || []).map(docToTask);

  // Enrich with assignee data
  try {
    const assignees = await getAssignees();
    const assigneeMap = new Map(assignees.map((a) => [String(a.id), a]));
    for (const task of tasks) {
      if (task.assignee_ids && task.assignee_ids.length > 0) {
        task.assignees = task.assignee_ids
          .map((aid) => assigneeMap.get(String(aid)))
          .filter(Boolean) as Assignee[];
        task.assignee = task.assignees[0] || null;
        task.assignee_id = task.assignees[0]?.id ?? null;
      }
    }
  } catch {
    // Assignee enrichment is best-effort
  }

  return tasks;
}

export async function getTaskById(id: string | number): Promise<Task | null> {
  // Fetch all tasks and find by id (simple approach)
  const tasks = await getTasks({ includeArchived: true });
  return tasks.find((t) => String(t.id) === String(id)) || null;
}

export async function getTasksBySprint(
  sprintId: number | string,
): Promise<Task[]> {
  return getTasks({ sprint_id: sprintId as any, includeArchived: true });
}

export async function archiveTasksBySprint(
  sprintId: number | string,
): Promise<number> {
  const tasks = await getTasksBySprint(sprintId);
  let count = 0;
  for (const task of tasks) {
    if (!task.is_archived && task.id) {
      await updateTask(task.id, { is_archived: true });
      count++;
    }
  }
  return count;
}

// ===== Project Functions =====

export async function getProjects(): Promise<string[]> {
  const projects = await getProjectsList();
  return projects.map((p) => p.name);
}

export async function getProjectsList(): Promise<Project[]> {
  const res = await api.data.projects.list(wsId());
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch projects");
  return (data.projects || []).map(docToProject);
}

export async function getProjectStats(): Promise<
  { id: string; taskCount: number }[]
> {
  const projects = await getProjectsList();
  const tasks = await getTasks({ includeArchived: true });
  return projects.map((p) => ({
    id: String(p.id),
    taskCount: tasks.filter((t) => t.project === p.name).length,
  }));
}

export async function addProject(
  project: Omit<Project, "id" | "created_at">,
): Promise<void> {
  const res = await api.data.projects.create(wsId(), {
    name: project.name,
    repo_url: project.repo_url || null,
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to create project");
  }
  broadcastChange("project", "create");
}

export async function updateProject(
  id: string | number,
  updates: Partial<Project>,
): Promise<void> {
  const payload: Record<string, any> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.repo_url !== undefined)
    payload.repo_url = updates.repo_url || null;

  const res = await api.data.projects.update(wsId(), String(id), payload);
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to update project");
  }
  broadcastChange("project", "update", String(id));
}

export async function deleteProject(id: string | number): Promise<void> {
  const res = await api.data.projects.delete(wsId(), String(id));
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to delete project");
  }
  broadcastChange("project", "delete", String(id));
}

// ===== Assignee Functions =====

export async function getAssignees(): Promise<Assignee[]> {
  const res = await api.data.assignees.list(wsId());
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch assignees");
  return (data.assignees || []).map(docToAssignee);
}

export async function getAssigneeStats(): Promise<
  { id: string; taskCount: number }[]
> {
  const assignees = await getAssignees();
  const tasks = await getTasks({ includeArchived: true });
  return assignees.map((a) => ({
    id: String(a.id),
    taskCount: tasks.filter((t) =>
      t.assignee_ids?.map(String).includes(String(a.id)),
    ).length,
  }));
}

export async function addAssignee(
  assignee: Omit<Assignee, "id" | "created_at">,
): Promise<void> {
  const res = await api.data.assignees.create(wsId(), {
    name: assignee.name,
    color: assignee.color || "#6366F1",
    discord_id: assignee.discord_id || null,
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to create assignee");
  }
  broadcastChange("assignee", "create");
}

export async function updateAssignee(
  id: string | number,
  updates: Partial<Assignee>,
): Promise<void> {
  const payload: Record<string, any> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.color !== undefined) payload.color = updates.color;
  if (updates.discord_id !== undefined)
    payload.discord_id = updates.discord_id || null;

  const res = await api.data.assignees.update(wsId(), String(id), payload);
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to update assignee");
  }
  broadcastChange("assignee", "update", String(id));
}

export async function deleteAssignee(id: string | number): Promise<void> {
  const res = await api.data.assignees.delete(wsId(), String(id));
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to delete assignee");
  }
  broadcastChange("assignee", "delete", String(id));
}

// ===== Stats / Categories =====

export async function getCategories(): Promise<string[]> {
  const tasks = await getTasks({ includeArchived: true });
  const cats = new Set(tasks.map((t) => t.category).filter(Boolean));
  return Array.from(cats).sort();
}

export async function getStats() {
  const tasks = await getTasks({ includeArchived: true });
  const total = tasks.length;
  const todo = tasks.filter((t) => t.status === "todo").length;
  const in_progress = tasks.filter((t) => t.status === "in-progress").length;
  const in_test = tasks.filter((t) => t.status === "in-test").length;
  const done = tasks.filter((t) => t.status === "done").length;
  const total_minutes = tasks.reduce(
    (sum, t) => sum + (t.duration_minutes || 0),
    0,
  );

  return { total, todo, in_progress, in_test, done, total_minutes };
}

export function getTaskStats(): {
  total: number;
  byStatus: Record<string, number>;
  lastUpdated: string | null;
} {
  // Synchronous version returns defaults; use getTasks for real data
  return { total: 0, byStatus: {}, lastUpdated: null };
}

// ===== Export / Import (simplified for API mode) =====

export async function exportToCSV(): Promise<string> {
  const tasks = await getTasks({ includeArchived: true });
  if (tasks.length === 0) return "";

  const headers = [
    "id",
    "title",
    "project",
    "duration_minutes",
    "date",
    "end_date",
    "status",
    "category",
    "notes",
    "assignee_ids",
    "sprint_id",
    "is_archived",
    "created_at",
    "updated_at",
  ];

  const rows = tasks.map((t) =>
    [
      t.id,
      `"${(t.title || "").replace(/"/g, '""')}"`,
      `"${(t.project || "").replace(/"/g, '""')}"`,
      t.duration_minutes,
      t.date,
      t.end_date || "",
      t.status,
      t.category,
      `"${(t.notes || "").replace(/"/g, '""')}"`,
      t.assignee_ids?.join(";") || "",
      t.sprint_id || "",
      t.is_archived ? 1 : 0,
      t.created_at || "",
      t.updated_at || "",
    ].join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}

export async function importFromCSV(
  _csvContent: string,
  _options: { clearExisting?: boolean } = {},
): Promise<number> {
  console.warn("importFromCSV: Not yet implemented in API mode");
  return 0;
}

export async function mergeTasksFromCSV(
  _csvContent: string,
): Promise<{ added: number; updated: number; unchanged: number }> {
  console.warn("mergeTasksFromCSV: Not yet implemented in API mode");
  return { added: 0, updated: 0, unchanged: 0 };
}

export async function exportAllData(): Promise<string> {
  const tasks = await getTasks({ includeArchived: true });
  const projects = await getProjectsList();
  const assignees = await getAssignees();
  return JSON.stringify({ tasks, projects, assignees }, null, 2);
}

export async function importAllData(
  _csvContent: string,
  _options?: any,
): Promise<{
  tasks: number;
  projects: number;
  assignees: number;
  sprints: number;
}> {
  console.warn("importAllData: Not yet implemented in API mode");
  return { tasks: 0, projects: 0, assignees: 0, sprints: 0 };
}

export async function mergeAllData(_csvContent: string): Promise<any> {
  console.warn("mergeAllData: Not yet implemented in API mode");
  return {
    tasks: { added: 0, updated: 0, unchanged: 0 },
    projects: { added: 0, updated: 0 },
    assignees: { added: 0, updated: 0 },
    sprints: { added: 0, updated: 0 },
  };
}

export async function exportSQLiteBinary(): Promise<Uint8Array> {
  console.warn("exportSQLiteBinary: Not available in API mode");
  return new Uint8Array();
}

export async function exportFilteredSQLiteBinary(
  _taskIds: (string | number)[],
): Promise<Uint8Array> {
  console.warn("exportFilteredSQLiteBinary: Not available in API mode");
  return new Uint8Array();
}

// ===== CRDT Sync Stubs (no longer needed in API mode) =====

export async function applyCRDTTasksToSQLite(
  _crdtTasks: Task[],
): Promise<{ added: number; updated: number }> {
  return { added: 0, updated: 0 };
}
