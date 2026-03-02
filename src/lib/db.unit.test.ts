import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SQLITE_HEADER = new TextEncoder().encode("SQLite format 3\u0000");

type Row = Record<string, any>;

const state = {
  tasks: [] as Row[],
  assignees: [] as Row[],
  projects: [] as Row[],
  lastInsertId: 0,
  executedSql: [] as string[],
};

function resetState() {
  state.tasks = [];
  state.assignees = [];
  state.projects = [];
  state.lastInsertId = 0;
  state.executedSql = [];
}

function normalize(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

function splitCsvColumns(raw: string): string[] {
  return raw.split(",").map((x) => x.trim());
}

function toTaskJoinRow(task: Row): Row {
  const a = state.assignees.find(
    (x) => Number(x.id) === Number(task.assignee_id),
  );
  return {
    ...task,
    a_id: a?.id ?? null,
    a_name: a?.name ?? null,
    a_color: a?.color ?? null,
    a_created_at: a?.created_at ?? null,
  };
}

function sortByDateDesc(rows: Row[]): Row[] {
  return [...rows].sort((a, b) => {
    const dateCmp = String(b.date || "").localeCompare(String(a.date || ""));
    if (dateCmp !== 0) return dateCmp;
    return String(b.created_at || "").localeCompare(String(a.created_at || ""));
  });
}

function evaluateSelect(sql: string, bind: any[]): Row[] {
  const n = normalize(sql);

  if (n.startsWith("select * from tasks order by date desc")) {
    return sortByDateDesc(state.tasks);
  }
  if (n === "select * from tasks") {
    return [...state.tasks];
  }
  if (n.startsWith("select id from tasks")) {
    return state.tasks.map((t) => ({ id: t.id }));
  }
  if (n.includes("from tasks t") && n.includes("where t.id = ?")) {
    const id = Number(bind[0]);
    const row = state.tasks.find((t) => Number(t.id) === id);
    return row ? [toTaskJoinRow(row)] : [];
  }
  if (n.includes("from tasks t") && n.includes("where t.sprint_id = ?")) {
    const sprintId = Number(bind[0]);
    return sortByDateDesc(
      state.tasks.filter((t) => Number(t.sprint_id) === sprintId),
    ).map(toTaskJoinRow);
  }
  if (n.includes("from tasks t") && n.includes("where 1=1")) {
    let i = 0;
    let rows = [...state.tasks];

    if (n.includes("and t.date >= ?")) {
      const v = bind[i++];
      rows = rows.filter((r) => String(r.date) >= String(v));
    }
    if (n.includes("and t.date <= ?")) {
      const v = bind[i++];
      rows = rows.filter((r) => String(r.date) <= String(v));
    }
    if (
      n.includes(
        "t.status != 'done' or (t.status = 'done' and date(t.updated_at",
      )
    ) {
      const todayStr = new Date().toISOString().split("T")[0];
      rows = rows.filter((r) => {
        if (String(r.status) !== "done") return true;
        const upd = String(r.updated_at || "");
        const updDate = upd.includes("T")
          ? upd.split("T")[0]
          : upd.split(" ")[0];
        return updDate === todayStr;
      });
    } else if (n.includes("and t.status = ?")) {
      const v = bind[i++];
      rows = rows.filter((r) => String(r.status) === String(v));
    }
    if (n.includes("and t.category = ?")) {
      const v = bind[i++];
      rows = rows.filter((r) => String(r.category) === String(v));
    }
    if (n.includes("and t.project = ?")) {
      const v = bind[i++];
      rows = rows.filter((r) => String(r.project) === String(v));
    }
    if (n.includes("and t.assignee_id is null"))
      rows = rows.filter((r) => r.assignee_id == null);
    else if (n.includes("and t.assignee_id = ?")) {
      const v = bind[i++];
      rows = rows.filter((r) => Number(r.assignee_id) === Number(v));
    }
    if (n.includes("and t.sprint_id is null"))
      rows = rows.filter((r) => r.sprint_id == null);
    else if (n.includes("and t.sprint_id = ?")) {
      const v = bind[i++];
      rows = rows.filter((r) => Number(r.sprint_id) === Number(v));
    }
    if (n.includes("and t.is_archived = 1"))
      rows = rows.filter((r) => Number(r.is_archived || 0) === 1);
    else if (n.includes("and t.is_archived = 0"))
      rows = rows.filter((r) => Number(r.is_archived || 0) === 0);
    if (n.includes("lower(t.title) like lower(?)")) {
      const q1 = String(bind[i++] || "")
        .replaceAll("%", "")
        .toLowerCase();
      const q2 = String(bind[i++] || "")
        .replaceAll("%", "")
        .toLowerCase();
      rows = rows.filter(
        (r) =>
          String(r.title || "")
            .toLowerCase()
            .includes(q1) ||
          String(r.notes || "")
            .toLowerCase()
            .includes(q2),
      );
    }

    return sortByDateDesc(rows).map(toTaskJoinRow);
  }

  if (
    n.startsWith(
      "select count(*) as count from tasks where sprint_id = ? and is_archived = 1",
    )
  ) {
    const sprintId = Number(bind[0]);
    return [
      {
        count: state.tasks.filter(
          (t) =>
            Number(t.sprint_id) === sprintId && Number(t.is_archived) === 1,
        ).length,
      },
    ];
  }
  if (n.startsWith("select count(*) as count from tasks")) {
    return [{ count: state.tasks.length }];
  }
  if (
    n.startsWith("select status, count(*) as count from tasks group by status")
  ) {
    const by = new Map<string, number>();
    for (const t of state.tasks)
      by.set(String(t.status), (by.get(String(t.status)) || 0) + 1);
    return Array.from(by.entries()).map(([status, count]) => ({
      status,
      count,
    }));
  }
  if (n.startsWith("select max(created_at) as last from tasks")) {
    const last = state.tasks.reduce<string | null>((acc, cur) => {
      if (!cur.created_at) return acc;
      if (!acc || String(cur.created_at) > acc) return String(cur.created_at);
      return acc;
    }, null);
    return [{ last }];
  }
  if (n.includes("count(*) as total") && n.includes("sum(case when status")) {
    const total = state.tasks.length;
    const todo = state.tasks.filter((t) => t.status === "todo").length;
    const in_progress = state.tasks.filter(
      (t) => t.status === "in-progress",
    ).length;
    const done = state.tasks.filter((t) => t.status === "done").length;
    const total_minutes = state.tasks.reduce(
      (s, t) => s + (Number(t.duration_minutes) || 0),
      0,
    );
    return [{ total, todo, in_progress, done, total_minutes }];
  }

  if (n.startsWith("select name from projects where id = ?")) {
    const id = Number(bind[0]);
    const p = state.projects.find((x) => Number(x.id) === id);
    return p ? [{ name: p.name }] : [];
  }
  if (n.startsWith("select name from projects order by name")) {
    return [...state.projects]
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .map((p) => ({ name: p.name }));
  }
  if (n.startsWith("select * from projects order by name")) {
    return [...state.projects].sort((a, b) =>
      String(a.name).localeCompare(String(b.name)),
    );
  }
  if (
    n.includes("from projects p") &&
    n.includes("left join tasks t on p.name = t.project")
  ) {
    return [...state.projects]
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .map((p) => ({
        id: p.id,
        taskCount: state.tasks.filter((t) => t.project === p.name).length,
      }));
  }

  if (n.startsWith("select distinct category from tasks")) {
    const categories = Array.from(
      new Set(state.tasks.map((t) => t.category).filter(Boolean)),
    );
    return categories
      .sort((a, b) => String(a).localeCompare(String(b)))
      .map((category) => ({ category }));
  }

  if (n.startsWith("select * from assignees order by name")) {
    return [...state.assignees].sort((a, b) =>
      String(a.name).localeCompare(String(b.name)),
    );
  }
  if (n.startsWith("select id, name from assignees")) {
    return state.assignees.map((a) => ({ id: a.id, name: a.name }));
  }
  if (
    n.includes("from assignees a") &&
    n.includes("left join tasks t on a.id = t.assignee_id")
  ) {
    return [...state.assignees]
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .map((a) => ({
        id: a.id,
        taskCount: state.tasks.filter(
          (t) => Number(t.assignee_id) === Number(a.id),
        ).length,
      }));
  }

  if (
    n.includes("select t.*, a.name as assignee_name") &&
    n.includes("from tasks t")
  ) {
    return sortByDateDesc(state.tasks).map((t) => {
      const a = state.assignees.find(
        (x) => Number(x.id) === Number(t.assignee_id),
      );
      return { ...t, assignee_name: a?.name ?? null };
    });
  }

  if (n.startsWith("select last_insert_rowid() as id")) {
    return [{ id: state.lastInsertId }];
  }

  return [];
}

class FakeStmt {
  private bindValues: any[] = [];
  private rows: Row[] = [];
  private idx = -1;
  private current: Row | null = null;

  constructor(private readonly sql: string) {}

  bind(values: any[]) {
    this.bindValues = values;
    this.rows = evaluateSelect(this.sql, this.bindValues);
    this.idx = -1;
  }

  step(): boolean {
    if (this.rows.length === 0)
      this.rows = evaluateSelect(this.sql, this.bindValues);
    this.idx += 1;
    this.current = this.rows[this.idx] || null;
    return this.current !== null;
  }

  get(): Row {
    return this.current || {};
  }

  finalize() {}
}

class FakeDB {
  pointer = 1;

  constructor(_name: string, _mode: string) {}

  checkRc(rc: number) {
    if (rc !== 0) throw new Error(`SQLite error: ${rc}`);
  }

  exec(input: string | { sql: string; bind?: any[] }) {
    const sql = typeof input === "string" ? input : input.sql;
    const bind = (typeof input === "string" ? [] : input.bind) || [];
    const n = normalize(sql);
    state.executedSql.push(n);

    if (
      n.startsWith("create table") ||
      n.startsWith("alter table") ||
      n === "begin transaction" ||
      n === "commit" ||
      n === "rollback"
    ) {
      return;
    }

    if (n === "delete from tasks") {
      state.tasks = [];
      return;
    }
    if (n === "delete from projects") {
      state.projects = [];
      return;
    }
    if (n === "delete from assignees") {
      state.assignees = [];
      return;
    }
    if (n.startsWith("delete from tasks where id = ?")) {
      const id = Number(bind[0]);
      state.tasks = state.tasks.filter((t) => Number(t.id) !== id);
      return;
    }
    if (n.startsWith("delete from tasks where id not in (")) {
      const keep = new Set(bind.map((x) => Number(x)));
      state.tasks = state.tasks.filter((t) => keep.has(Number(t.id)));
      return;
    }
    if (n.startsWith("delete from assignees where id not in")) {
      const used = new Set(
        state.tasks
          .map((t) => Number(t.assignee_id))
          .filter((x) => !Number.isNaN(x) && x > 0),
      );
      state.assignees = state.assignees.filter((a) => used.has(Number(a.id)));
      return;
    }
    if (n.startsWith("delete from projects where name not in")) {
      const used = new Set(
        state.tasks.map((t) => String(t.project || "")).filter((x) => x),
      );
      state.projects = state.projects.filter((p) => used.has(String(p.name)));
      return;
    }

    const insertTaskMatch = sql.match(
      /(insert|replace)\s+into\s+tasks\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i,
    );
    if (insertTaskMatch) {
      const isReplace = insertTaskMatch[1].toLowerCase() === "replace";
      const cols = splitCsvColumns(insertTaskMatch[2]);
      const row: Row = {};
      cols.forEach((c, i) => (row[c] = bind[i]));

      if (!row.id) row.id = ++state.lastInsertId;
      else state.lastInsertId = Math.max(state.lastInsertId, Number(row.id));
      if (!row.created_at) row.created_at = new Date().toISOString();
      if (!row.updated_at) row.updated_at = row.created_at;
      if (row.is_archived == null) row.is_archived = 0;

      if (isReplace)
        state.tasks = state.tasks.filter(
          (t) => Number(t.id) !== Number(row.id),
        );
      state.tasks.push(row);
      return;
    }

    const insertProjectMatch = sql.match(
      /(insert|replace)\s+into\s+projects\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i,
    );
    if (insertProjectMatch) {
      const isReplace = insertProjectMatch[1].toLowerCase() === "replace";
      const cols = splitCsvColumns(insertProjectMatch[2]);
      const row: Row = {};
      cols.forEach((c, i) => (row[c] = bind[i]));
      if (!row.id) row.id = ++state.lastInsertId;
      if (!row.created_at) row.created_at = new Date().toISOString();
      if (isReplace)
        state.projects = state.projects.filter(
          (p) => Number(p.id) !== Number(row.id),
        );
      state.projects.push(row);
      return;
    }

    const insertAssigneeMatch = sql.match(
      /(insert|replace)\s+into\s+assignees\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i,
    );
    if (insertAssigneeMatch) {
      const isReplace = insertAssigneeMatch[1].toLowerCase() === "replace";
      const cols = splitCsvColumns(insertAssigneeMatch[2]);
      const row: Row = {};
      cols.forEach((c, i) => (row[c] = bind[i]));
      if (!row.id) row.id = ++state.lastInsertId;
      if (!row.created_at) row.created_at = new Date().toISOString();
      if (!row.color) row.color = "#6366F1";
      if (isReplace)
        state.assignees = state.assignees.filter(
          (a) => Number(a.id) !== Number(row.id),
        );
      state.assignees.push(row);
      return;
    }

    const updateTaskById = sql.match(
      /update\s+tasks\s+set\s+([\s\S]+?)\s+where\s+id\s*=\s*\?/i,
    );
    if (updateTaskById) {
      const setPart = updateTaskById[1];
      const id = Number(bind[bind.length - 1]);
      const target = state.tasks.find((t) => Number(t.id) === id);
      if (!target) return;
      const assignments = setPart.split(",").map((x) => x.trim());
      let i = 0;
      for (const assignment of assignments) {
        if (/updated_at\s*=\s*current_timestamp/i.test(assignment)) {
          target.updated_at = new Date().toISOString();
          continue;
        }
        const m = assignment.match(/^([a-z_]+)\s*=\s*\?$/i);
        if (m) target[m[1]] = bind[i++];
      }
      return;
    }

    if (n.startsWith("update tasks set project = ? where project = ?")) {
      const [nextName, oldName] = bind;
      for (const t of state.tasks)
        if (t.project === oldName) t.project = nextName;
      return;
    }
    if (n.startsWith('update tasks set project = "" where project = ?')) {
      const oldName = bind[0];
      for (const t of state.tasks) if (t.project === oldName) t.project = "";
      return;
    }
    if (
      n.startsWith("update tasks set assignee_id = null where assignee_id = ?")
    ) {
      const id = Number(bind[0]);
      for (const t of state.tasks)
        if (Number(t.assignee_id) === id) t.assignee_id = null;
      return;
    }
    if (n.startsWith("update tasks set is_archived = 1 where sprint_id = ?")) {
      const sprintId = Number(bind[0]);
      for (const t of state.tasks) {
        if (
          Number(t.sprint_id) === sprintId &&
          t.status === "done" &&
          Number(t.is_archived || 0) === 0
        )
          t.is_archived = 1;
      }
      return;
    }

    if (n.startsWith("update projects set")) {
      const id = Number(bind[bind.length - 1]);
      const target = state.projects.find((p) => Number(p.id) === id);
      if (!target) return;
      if (n.includes("name = ?")) target.name = bind[0];
      if (n.includes("created_at = ?"))
        target.created_at = bind[1] ?? target.created_at;
      return;
    }
    if (n.startsWith("delete from projects where id = ?")) {
      const id = Number(bind[0]);
      state.projects = state.projects.filter((p) => Number(p.id) !== id);
      return;
    }

    if (n.startsWith("update assignees set")) {
      const id = Number(bind[bind.length - 1]);
      const target = state.assignees.find((a) => Number(a.id) === id);
      if (!target) return;
      let i = 0;
      if (n.includes("name = ?")) target.name = bind[i++];
      if (n.includes("color = ?")) target.color = bind[i++];
      if (n.includes("created_at = ?")) target.created_at = bind[i++];
      return;
    }
    if (n.startsWith("delete from assignees where id = ?")) {
      const id = Number(bind[0]);
      state.assignees = state.assignees.filter((a) => Number(a.id) !== id);
    }
  }

  selectValue(sql: string): number {
    const n = normalize(sql);
    if (n.startsWith("select last_insert_rowid()")) return state.lastInsertId;
    if (n.startsWith("select count(*) from tasks")) return state.tasks.length;
    return 0;
  }

  selectObjects(sql: string): Row[] {
    const n = normalize(sql);
    if (n.startsWith("pragma table_info(tasks)"))
      return [{ name: "updated_at" }];
    return [];
  }

  prepare(sql: string) {
    return new FakeStmt(sql);
  }

  close() {}
}

const fakeSqlite = {
  oo1: { DB: FakeDB },
  wasm: { allocFromTypedArray: () => 1 },
  capi: {
    SQLITE_DESERIALIZE_FREEONCLOSE: 1,
    sqlite3_deserialize: () => 0,
    sqlite3_js_db_export: () => SQLITE_HEADER,
  },
};

vi.mock("@sqlite.org/sqlite-wasm", () => ({
  default: vi.fn(async () => fakeSqlite),
}));

vi.mock("./stores/storage", () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    initCompression: vi.fn(),
    compressionReady: { subscribe: () => () => {} },
  };
});

vi.mock("./stores/crdt-sync", () => ({
  syncTaskToCRDT: vi.fn(),
  deleteTaskFromCRDT: vi.fn(),
  initCRDT: vi.fn(),
}));

vi.mock("svelte/store", () => ({
  get: () => false,
}));

import {
  addAssignee,
  addProject,
  addTask,
  archiveTasksBySprint,
  cleanupDB,
  cleanupLegacyDatabaseStorage,
  closeDB,
  deleteAssignee,
  deleteProject,
  deleteTask,
  exportAllData,
  exportFilteredSQLiteBinary,
  exportSQLiteBinary,
  exportToCSV,
  getAssigneeStats,
  getAssignees,
  getCategories,
  getProjectStats,
  getProjects,
  getProjectsList,
  getStats,
  getTaskById,
  getTaskStats,
  getTasks,
  getTasksBySprint,
  importAllData,
  importFromCSV,
  initDB,
  mergeAllData,
  mergeTasksFromCSV,
  updateAssignee,
  updateProject,
  updateTask,
} from "./db";

class LocalStorageMock {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  get length(): number {
    return this.store.size;
  }
}

beforeEach(async () => {
  resetState();
  (globalThis as any).window = { addEventListener: vi.fn() };
  (globalThis as any).localStorage = new LocalStorageMock();
  (globalThis as any).atob = (s: string) =>
    Buffer.from(s, "base64").toString("binary");
  (globalThis as any).btoa = (s: string) =>
    Buffer.from(s, "binary").toString("base64");
  await initDB();
});

afterEach(async () => {
  await closeDB();
  vi.restoreAllMocks();
});

async function seedCoreData() {
  await addProject({ name: "Core" });
  await addProject({ name: "Edge" });
  await addAssignee({ name: "Alice", color: "#ff0000" });
  await addAssignee({ name: "Bob", color: "#00ff00" });
  const assignees = await getAssignees();
  const aliceId = assignees.find((a) => a.name === "Alice")?.id ?? null;
  const bobId = assignees.find((a) => a.name === "Bob")?.id ?? null;

  const t1 = await addTask({
    title: "Task 1",
    project: "Core",
    duration_minutes: 30,
    date: "2026-02-10",
    status: "todo",
    category: "งานหลัก",
    notes: "first",
    assignee_id: aliceId,
    sprint_id: 11,
    is_archived: false,
    updated_at: "2026-02-10T00:00:00.000Z",
  });
  const t2 = await addTask({
    title: "Task 2",
    project: "Core",
    duration_minutes: 15,
    date: "2026-02-11",
    status: "done",
    category: "งานรอง",
    notes: "second",
    assignee_id: bobId,
    sprint_id: 11,
    is_archived: false,
    updated_at: "2026-02-11T00:00:00.000Z",
  });
  const t3 = await addTask({
    title: "Task 3",
    project: "Edge",
    duration_minutes: 45,
    date: "2026-02-12",
    status: "in-progress",
    category: "อื่นๆ",
    notes: "third keyword",
    assignee_id: null,
    sprint_id: null,
    is_archived: true,
    updated_at: "2026-02-12T00:00:00.000Z",
  });

  return { t1, t2, t3, aliceId, bobId };
}

describe("db helpers and lifecycle", () => {
  it("supports cleanup and re-init paths", async () => {
    cleanupDB();
    await expect(getTasks()).rejects.toThrow("DB not initialized");
    await initDB();
    expect(await getTasks()).toEqual([]);
    await closeDB();
    await expect(getTasks()).rejects.toThrow("DB not initialized");
    await initDB();
    expect(await getTasks()).toEqual([]);
  });

  it("cleans legacy keys from localStorage", () => {
    localStorage.setItem("task-tracker-db", "legacy");
    localStorage.setItem("task-tracker-db-backup-before-v2", "backup");
    localStorage.setItem("task-tracker-db-migrated-to-v2", "flag");
    cleanupLegacyDatabaseStorage();
    expect(localStorage.getItem("task-tracker-db")).toBeNull();
    expect(localStorage.getItem("task-tracker-db-backup-before-v2")).toBeNull();
    expect(localStorage.getItem("task-tracker-db-migrated-to-v2")).toBeNull();
  });
});

describe("task features", () => {
  it("covers add/get/update/delete/filter/stats/bySprint/archive", async () => {
    const { t1, t2, t3, aliceId } = await seedCoreData();

    const allDefault = await getTasks();
    expect(allDefault.map((x) => x.id)).toEqual([t2, t1]);

    const allWithArchived = await getTasks({ includeArchived: true });
    expect(allWithArchived).toHaveLength(3);

    expect((await getTasks({ status: "todo" })).map((t) => t.id)).toEqual([t1]);
    expect((await getTasks({ status: "archived" })).map((t) => t.id)).toEqual([
      t3,
    ]);
    expect(
      (await getTasks({ category: "งานหลัก", includeArchived: true })).map(
        (t) => t.id,
      ),
    ).toEqual([t1]);
    const coreTasks = (await getTasks({ project: "Core" })).map((t) => t.id);
    expect(coreTasks).toContain(t1);
    expect((await getTasks({ assignee_id: aliceId })).map((t) => t.id)).toEqual(
      [t1],
    );
    expect(
      (await getTasks({ assignee_id: null, includeArchived: true })).map(
        (t) => t.id,
      ),
    ).toEqual([t3]);
    const sprint11Tasks = (await getTasks({ sprint_id: 11 })).map((t) => t.id);
    expect(sprint11Tasks).toContain(t1);
    expect(
      (await getTasks({ search: "keyword", includeArchived: true })).map(
        (t) => t.id,
      ),
    ).toEqual([t3]);

    const byId = await getTaskById(t1);
    expect(byId?.title).toBe("Task 1");

    await updateTask(t1, {
      status: "done",
      notes: "edited",
      is_archived: true,
    });
    expect((await getTaskById(t1))?.status).toBe("done");
    expect((await getTaskById(t1))?.is_archived).toBe(true);

    const sprintTasks = await getTasksBySprint(11);
    expect(sprintTasks).toHaveLength(2);
    const archivedCount = await archiveTasksBySprint(11);
    expect(archivedCount).toBe(2);

    const stats = await getStats();
    expect(stats.total).toBe(3);
    expect(stats.done).toBe(2);

    const syncStats = getTaskStats();
    expect(syncStats.total).toBe(3);
    expect(syncStats.byStatus.done).toBe(2);

    await deleteTask(t2);
    expect(
      (await getTasks({ includeArchived: true })).map((t) => t.id),
    ).toEqual([t3, t1]);
  });
});

describe("project and assignee features", () => {
  it("covers project CRUD/stats", async () => {
    const { t1 } = await seedCoreData();
    expect(await getProjects()).toEqual(["Core", "Edge"]);
    expect((await getProjectsList()).map((x) => x.name)).toEqual([
      "Core",
      "Edge",
    ]);
    const categories = await getCategories();
    expect(categories).toHaveLength(3);
    expect(new Set(categories)).toEqual(
      new Set(["งานหลัก", "งานรอง", "อื่นๆ"]),
    );

    const pstats = await getProjectStats();
    expect(pstats).toEqual([
      { id: expect.any(Number), taskCount: 2 },
      { id: expect.any(Number), taskCount: 1 },
    ]);

    const core = (await getProjectsList()).find((p) => p.name === "Core");
    expect(core).toBeTruthy();
    await updateProject(core!.id!, { name: "CoreX" });
    expect((await getTaskById(t1))?.project).toBe("CoreX");

    await deleteProject(core!.id!);
    expect((await getTaskById(t1))?.project).toBe("");
  });

  it("covers assignee CRUD/stats and detach tasks on delete", async () => {
    const { t1, aliceId } = await seedCoreData();
    const assignees = await getAssignees();
    expect(assignees.map((x) => x.name)).toEqual(["Alice", "Bob"]);

    const astats = await getAssigneeStats();
    expect(astats).toEqual([
      { id: expect.any(Number), taskCount: 1 },
      { id: expect.any(Number), taskCount: 1 },
    ]);

    await updateAssignee(aliceId!, { name: "AliceX", color: "#111111" });
    expect((await getAssignees()).find((x) => x.id === aliceId)?.name).toBe(
      "AliceX",
    );

    await deleteAssignee(aliceId!);
    expect((await getTaskById(t1))?.assignee_id).toBeNull();
  });
});

describe("import export and merge features", () => {
  it("covers importFromCSV/exportToCSV/mergeTasksFromCSV", async () => {
    const imported = await importFromCSV(
      [
        "id,title,project,duration_minutes,date,status,category,notes,assignee_id,sprint_id,is_archived,created_at",
        '1,CSV One,Core,10,2026-02-10,todo,งานหลัก,"note,comma",,,0,2026-02-10T00:00:00.000Z',
        "2,CSV Two,Core,20,2026-02-11,done,อื่นๆ,ok,,,0,2026-02-11T00:00:00.000Z",
      ].join("\n"),
    );
    expect(imported).toBe(2);
    expect(await exportToCSV()).toContain('"note,comma"');

    const merged = await mergeTasksFromCSV(
      [
        "id,title,project,duration_minutes,date,status,category,notes,assignee_id,sprint_id,is_archived,created_at",
        "1,CSV One Updated,Core,10,2026-02-10,done,งานหลัก,changed,,,0,2026-02-12T00:00:00.000Z",
        "2,CSV Two,Core,20,2026-02-11,done,อื่นๆ,ok,,,0,2026-02-09T00:00:00.000Z",
        "3,CSV Three,Edge,5,2026-02-12,todo,อื่นๆ,new,,,0,2026-02-12T00:00:00.000Z",
      ].join("\n"),
    );
    expect(merged).toEqual({ added: 1, updated: 1, unchanged: 1 });
    expect((await getTasks({ includeArchived: true })).length).toBe(3);
  });

  it("covers exportAllData/importAllData/mergeAllData including fallback paths", async () => {
    await seedCoreData();
    localStorage.setItem(
      "sprints-data-v1",
      JSON.stringify([
        {
          id: 11,
          name: "S11",
          start_date: "2026-02-01",
          end_date: "2026-02-14",
          status: "active",
          created_at: "2026-02-01T00:00:00.000Z",
        },
      ]),
    );

    const full = await exportAllData();
    expect(full).toContain("# TASKS");
    expect(full).toContain("# PROJECTS");
    expect(full).toContain("# ASSIGNEES");
    expect(full).toContain("# SPRINTS");

    const imported = await importAllData(
      [
        "id,title,project,duration_minutes,date,status,category,notes,assignee_id,sprint_id,is_archived,created_at",
        "99,Fallback import,Core,7,2026-02-20,todo,อื่นๆ,,,,0,2026-02-20T00:00:00.000Z",
      ].join("\n"),
    );
    expect(imported).toEqual({
      tasks: 1,
      projects: 0,
      assignees: 0,
      sprints: 0,
    });

    const mergedFallback = await mergeAllData(
      [
        "id,title,project,duration_minutes,date,status,category,notes,assignee_id,sprint_id,is_archived,created_at",
        "99,Fallback merged,Core,7,2026-02-20,done,อื่นๆ,,,,0,2026-02-21T00:00:00.000Z",
      ].join("\n"),
    );
    expect(mergedFallback.tasks.updated).toBe(1);

    const mergedSectioned = await mergeAllData(
      [
        "# PROJECTS",
        "id,name,created_at",
        "1,Core Z,2026-02-01T00:00:00.000Z",
        "",
        "# ASSIGNEES",
        "id,name,color,created_at",
        "1,Alice Z,#222222,2026-02-01T00:00:00.000Z",
        "",
        "# TASKS",
        "id,title,project,duration_minutes,date,status,category,notes,assignee_id,assignee_name,sprint_id,is_archived,created_at",
        "1,Task Z,Core Z,10,2026-02-22,done,อื่นๆ,,1,,11,1,2026-02-22T00:00:00.000Z",
        "",
        "# SPRINTS",
        "id,name,start_date,end_date,status,created_at",
        "11,S11 Updated,2026-02-01,2026-02-14,completed,2026-02-01T00:00:00.000Z",
      ].join("\n"),
    );
    expect(
      mergedSectioned.projects.updated + mergedSectioned.projects.added,
    ).toBeGreaterThanOrEqual(1);
    expect(
      mergedSectioned.assignees.updated + mergedSectioned.assignees.added,
    ).toBeGreaterThanOrEqual(1);
    expect(
      mergedSectioned.tasks.updated + mergedSectioned.tasks.added,
    ).toBeGreaterThanOrEqual(1);
  });
});

describe("binary export features", () => {
  it("covers exportSQLiteBinary and exportFilteredSQLiteBinary paths", async () => {
    await seedCoreData();
    const binary = await exportSQLiteBinary();
    expect(ArrayBuffer.isView(binary)).toBe(true);
    expect(binary.length).toBeGreaterThan(0);

    const allFiltered = await exportFilteredSQLiteBinary([]);
    expect(ArrayBuffer.isView(allFiltered)).toBe(true);

    const someFiltered = await exportFilteredSQLiteBinary([1]);
    expect(ArrayBuffer.isView(someFiltered)).toBe(true);

    expect(
      state.executedSql.some((s) =>
        s.startsWith("delete from tasks where id not in"),
      ),
    ).toBe(true);
    expect(
      state.executedSql.some((s) =>
        s.startsWith("delete from assignees where id not in"),
      ),
    ).toBe(true);
    expect(
      state.executedSql.some((s) =>
        s.startsWith("delete from projects where name not in"),
      ),
    ).toBe(true);
  });
});
