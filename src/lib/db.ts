/**
 * db.ts — API-backed data layer
 *
 * All data is stored on the server (MongoDB) scoped by workspace_id.
 * This module replaces the previous SQLite WASM / localStorage approach.
 */

import type { Task, Project, Assignee, Sprint, FilterOptions } from "./types";
import { get } from "svelte/store";
import { api } from "./apis";
import { getWorkspaceId, loadWorkspaceId } from "./stores/workspace";
import { broadcastChange } from "./stores/realtime";
import { user as userStore } from "./stores/auth";

// ===== Initialisation =====

let _initialized = false;
let _assigneesCache: Assignee[] | null = null;
let _projectsCache: Project[] | null = null;
let _sprintsCache: Sprint[] | null = null;
let _lastAssigneeFetch = 0;
let _lastProjectFetch = 0;
let _lastSprintFetch = 0;
const CACHE_TTL = 2000; // 2 seconds cache for metadata

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
    user_id: doc.user_id || undefined,
    created_at: doc.created_at || "",
  };
}

function docToSprint(doc: any): Sprint {
  return {
    id: extractId(doc),
    name: doc.name || "",
    start_date: doc.start_date || "",
    end_date: doc.end_date || "",
    status: doc.status || "planned",
    completed_at: doc.completed_at || undefined,
    archived_count: doc.archived_count || undefined,
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
  const newTask = docToTask(data.task);
  _assigneesCache = null; // Invalidate cache in case of new assignee IDs
  broadcastChange("task", "create", newTask.id as string, newTask);
  return newTask.id as string;
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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to update task");
  }
  broadcastChange("task", "update", String(id), payload);
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
    if (filter.assignee_id === "me") {
      const currentUser = get(userStore);
      if (currentUser) {
        const assignees = await getAssignees();
        const myAssignee = assignees.find(
          (a) =>
            a.user_id === currentUser.id || a.user_id === currentUser.user_id,
        );
        if (myAssignee && myAssignee.id) {
          params.assignee_id = String(myAssignee.id);
        } else {
          // If "me" is selected but no assignee record exists for current user,
          // we filter by a dummy ID to return empty results instead of all tasks.
          params.assignee_id = "non-existent-filtered-me";
        }
      }
    } else {
      params.assignee_id = String(filter.assignee_id);
    }
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
  } catch (e) {
    // Assignee enrichment is best-effort
    console.error("Assignee enrichment failed:", e);
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
    if (!task.is_archived && task.id && task.status === "done") {
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
  const now = Date.now();
  if (_projectsCache && now - _lastProjectFetch < CACHE_TTL) {
    return _projectsCache;
  }

  const res = await api.data.projects.list(wsId());
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch projects");
  _projectsCache = (data.projects || []).map(docToProject);
  _lastProjectFetch = now;
  return _projectsCache || [];
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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to create project");
  }
  const newProject = docToProject(data.project);
  _projectsCache = null; // Invalidate
  broadcastChange("project", "create", newProject.id as string, newProject);
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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to update project");
  }
  _projectsCache = null; // Invalidate
  broadcastChange("project", "update", String(id), payload);
}

export async function deleteProject(id: string | number): Promise<void> {
  const res = await api.data.projects.delete(wsId(), String(id));
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to delete project");
  }
  _projectsCache = null; // Invalidate
  broadcastChange("project", "delete", String(id));
}

// ===== Assignee Functions =====

export async function getAssignees(): Promise<Assignee[]> {
  const now = Date.now();
  if (_assigneesCache && now - _lastAssigneeFetch < CACHE_TTL) {
    return _assigneesCache;
  }

  const res = await api.data.assignees.list(wsId());
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch assignees");
  _assigneesCache = (data.assignees || []).map(docToAssignee);
  _lastAssigneeFetch = now;
  return _assigneesCache || [];
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
    user_id: assignee.user_id || null,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to create assignee");
  }
  const newAssignee = docToAssignee(data.assignee);
  _assigneesCache = null; // Invalidate
  broadcastChange("assignee", "create", newAssignee.id as string, newAssignee);
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
  if (updates.user_id !== undefined) payload.user_id = updates.user_id || null;

  const res = await api.data.assignees.update(wsId(), String(id), payload);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to update assignee");
  }
  _assigneesCache = null; // Invalidate
  broadcastChange("assignee", "update", String(id), payload);
}

export async function deleteAssignee(id: string | number): Promise<void> {
  const res = await api.data.assignees.delete(wsId(), String(id));
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to delete assignee");
  }
  _assigneesCache = null; // Invalidate
  broadcastChange("assignee", "delete", String(id));
}

// ===== Sprint Functions =====

export async function getSprints(): Promise<Sprint[]> {
  const now = Date.now();
  if (_sprintsCache && now - _lastSprintFetch < CACHE_TTL) {
    return _sprintsCache;
  }

  const res = await api.data.sprints.list(wsId());
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch sprints");
  _sprintsCache = (data.sprints || []).map(docToSprint);
  _lastSprintFetch = now;
  return _sprintsCache || [];
}

export async function addSprint(
  sprint: Omit<Sprint, "id" | "created_at">,
): Promise<Sprint> {
  const res = await api.data.sprints.create(wsId(), {
    name: sprint.name,
    start_date: sprint.start_date,
    end_date: sprint.end_date,
    status: sprint.status || "planned",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create sprint");
  const newSprint = docToSprint(data.sprint);
  _sprintsCache = null;
  broadcastChange("sprint", "create", newSprint.id as string, newSprint);
  return newSprint;
}

export async function updateSprint(
  id: string | number,
  updates: Partial<Sprint>,
): Promise<void> {
  const payload: Record<string, any> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.start_date !== undefined) payload.start_date = updates.start_date;
  if (updates.end_date !== undefined) payload.end_date = updates.end_date;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.completed_at !== undefined)
    payload.completed_at = updates.completed_at || null;
  if (updates.archived_count !== undefined)
    payload.archived_count = updates.archived_count;

  const res = await api.data.sprints.update(wsId(), String(id), payload);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update sprint");
  _sprintsCache = null;
  broadcastChange("sprint", "update", String(id), payload);
}

export async function deleteSprint(id: string | number): Promise<void> {
  const res = await api.data.sprints.delete(wsId(), String(id));
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to delete sprint");
  }
  _sprintsCache = null;
  broadcastChange("sprint", "delete", String(id));
}

// ===== Stats / Categories =====

export async function getCategories(): Promise<string[]> {
  const tasks = await getTasks({ includeArchived: true });
  const cats = new Set(tasks.map((t) => t.category).filter(Boolean));
  return Array.from(cats).sort();
}

export function getStatsFromTasks(tasks: Task[]) {
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

export async function getStats() {
  const tasks = await getTasks({ includeArchived: true });
  return getStatsFromTasks(tasks);
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
  const sprints = await getSprints();
  return JSON.stringify({ tasks, projects, assignees, sprints }, null, 2);
}

function parseCSV(content: string): Record<string, string[][]> {
  const sections: Record<string, string[][]> = {};
  let currentSection = "";
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("# ")) {
      currentSection = trimmed.substring(2).toUpperCase();
      sections[currentSection] = [];
      continue;
    }

    if (currentSection) {
      const row: string[] = [];
      let currentCell = "";
      let inQuotes = false;
      for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed[i];
        if (char === '"') {
          if (inQuotes && trimmed[i + 1] === '"') {
            currentCell += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === "," && !inQuotes) {
          row.push(currentCell);
          currentCell = "";
        } else {
          currentCell += char;
        }
      }
      row.push(currentCell);
      sections[currentSection].push(row);
    }
  }
  return sections;
}

export async function importAllData(
  csvContent: string,
  _options?: any,
): Promise<{
  tasks: number;
  projects: number;
  assignees: number;
  sprints: number;
}> {
  const sections = parseCSV(csvContent);
  const workspaceId = wsId();

  // Caches for duplicate checking and ID mapping
  const existingProjects = await getProjectsList();
  const existingAssignees = await getAssignees();
  const existingSprints = await getSprints();

  const projectMap = new Map<string, string>(); // oldId -> newId
  const assigneeMap = new Map<string, string>(); // oldId -> newId
  const sprintMap = new Map<string, string>(); // oldId -> newId

  let projectsCount = 0;
  let assigneesCount = 0;
  let sprintsCount = 0;
  let tasksCount = 0;

  // 1. PROJECTS
  if (sections["PROJECTS"] && sections["PROJECTS"].length > 1) {
    const headers = sections["PROJECTS"][0];
    const data = sections["PROJECTS"].slice(1);
    for (const row of data) {
      const p: any = {};
      headers.forEach((h, i) => (p[h] = row[i]));

      const existing = existingProjects.find((ep) => ep.name === p.name);
      if (existing) {
        projectMap.set(String(p.id), String(existing.id));
      } else {
        const resp = await api.data.projects.create(workspaceId, {
          name: p.name,
        });
        if (resp.ok) {
          const body = await resp.json();
          const newId = extractId(body.project);
          projectMap.set(String(p.id), newId);
          projectsCount++;
        }
      }
    }
  }

  // 2. ASSIGNEES
  if (sections["ASSIGNEES"] && sections["ASSIGNEES"].length > 1) {
    const headers = sections["ASSIGNEES"][0];
    const data = sections["ASSIGNEES"].slice(1);
    for (const row of data) {
      const a: any = {};
      headers.forEach((h, i) => (a[h] = row[i]));

      const existing = existingAssignees.find((ea) => ea.name === a.name);
      if (existing) {
        assigneeMap.set(String(a.id), String(existing.id));
      } else {
        const resp = await api.data.assignees.create(workspaceId, {
          name: a.name,
          color: a.color,
        });
        if (resp.ok) {
          const body = await resp.json();
          const newId = extractId(body.assignee);
          assigneeMap.set(String(a.id), newId);
          assigneesCount++;
        }
      }
    }
  }

  // 3. SPRINTS
  if (sections["SPRINTS"] && sections["SPRINTS"].length > 1) {
    const headers = sections["SPRINTS"][0];
    const data = sections["SPRINTS"].slice(1);
    for (const row of data) {
      const s: any = {};
      headers.forEach((h, i) => (s[h] = row[i]));

      const existing = existingSprints.find((es) => es.name === s.name);
      if (existing) {
        sprintMap.set(String(s.id), String(existing.id));
      } else {
        const resp = await api.data.sprints.create(workspaceId, {
          name: s.name,
          start_date: s.start_date,
          end_date: s.end_date,
          status: s.status,
        });
        if (resp.ok) {
          const body = await resp.json();
          const newId = extractId(body.sprint);
          sprintMap.set(String(s.id), newId);
          sprintsCount++;
        }
      }
    }
  }

  // 4. TASKS
  if (sections["TASKS"] && sections["TASKS"].length > 1) {
    const headers = sections["TASKS"][0];
    const data = sections["TASKS"].slice(1);
    for (const row of data) {
      const t: any = {};
      headers.forEach((h, i) => (t[h] = row[i]));

      const payload: any = {
        title: t.title,
        project: t.project,
        duration_minutes: parseInt(t.duration_minutes) || 0,
        date: t.date,
        status: t.status || "todo",
        category: t.category || "อื่นๆ",
        notes: t.notes || "",
        is_archived: t.is_archived === "1" || t.is_archived === "true",
      };

      if (t.assignee_id && assigneeMap.has(String(t.assignee_id))) {
        payload.assignee_ids = [assigneeMap.get(String(t.assignee_id))];
      }

      if (t.sprint_id && sprintMap.has(String(t.sprint_id))) {
        payload.sprint_id = sprintMap.get(String(t.sprint_id));
      }

      const resp = await api.data.tasks.create(workspaceId, payload);
      if (resp.ok) {
        tasksCount++;
      }
    }
  }

  // Reset caches
  _projectsCache = null;
  _assigneesCache = null;
  _sprintsCache = null;

  return {
    tasks: tasksCount,
    projects: projectsCount,
    assignees: assigneesCount,
    sprints: sprintsCount,
  };
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
