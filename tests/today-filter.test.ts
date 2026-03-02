import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the "today" status filter feature.
 *
 * The "today" filter returns:
 *   - All tasks whose status is NOT 'done' (todo, in-progress, in-test)
 *   - Tasks whose status IS 'done' AND updated_at matches today's date
 *
 * This file uses the same fake-SQLite approach as src/lib/db.unit.test.ts
 * so we can exercise the real getTasks code path end-to-end.
 */

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
    a_discord_id: a?.discord_id ?? null,
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

    const hasTodayFilter = n.includes(
      "t.status != 'done' or (t.status = 'done' and date(t.updated_at",
    );
    const hasStatusBind = n.includes("and t.status = ?");

    // Handle "today" filter: (t.status != 'done' OR (t.status = 'done' AND DATE(t.updated_at, ...) = DATE('now', ...)))
    if (hasTodayFilter) {
      const todayStr = new Date().toISOString().split("T")[0];
      rows = rows.filter((r) => {
        if (String(r.status) !== "done") return true;
        const upd = String(r.updated_at || "");
        const updDate = upd.includes("T")
          ? upd.split("T")[0]
          : upd.split(" ")[0];
        return updDate === todayStr;
      });
    } else if (hasStatusBind) {
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

  if (n.includes("count(*) as total") && n.includes("sum(case when status")) {
    const total = state.tasks.length;
    const todo = state.tasks.filter((t) => t.status === "todo").length;
    const in_progress = state.tasks.filter(
      (t) => t.status === "in-progress",
    ).length;
    const done = state.tasks.filter((t) => t.status === "done").length;
    const in_test = state.tasks.filter((t) => t.status === "in-test").length;
    const total_minutes = state.tasks.reduce(
      (s, t) => s + (Number(t.duration_minutes) || 0),
      0,
    );
    return [{ total, todo, in_progress, in_test, done, total_minutes }];
  }

  if (n.startsWith("select last_insert_rowid() as id")) {
    return [{ id: state.lastInsertId }];
  }

  if (n.startsWith("select distinct category from tasks")) {
    const categories = Array.from(
      new Set(state.tasks.map((t) => t.category).filter(Boolean)),
    );
    return categories.sort().map((category) => ({ category }));
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

  if (n.startsWith("select * from assignees order by name")) {
    return [...state.assignees].sort((a, b) =>
      String(a.name).localeCompare(String(b.name)),
    );
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

    if (
      n.startsWith("update tasks set assignee_id = null where assignee_id = ?")
    ) {
      const id = Number(bind[0]);
      for (const t of state.tasks)
        if (Number(t.assignee_id) === id) t.assignee_id = null;
      return;
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

vi.mock("$lib/stores/storage", () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    initCompression: vi.fn(),
    compressionReady: { subscribe: () => () => {} },
  };
});

vi.mock("$lib/stores/crdt-sync", () => ({
  syncTaskToCRDT: vi.fn(),
  deleteTaskFromCRDT: vi.fn(),
  initCRDT: vi.fn(),
}));

vi.mock("svelte/store", () => ({
  get: () => false,
}));

import { addTask, closeDB, getTasks, initDB } from "$lib/db";

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

// Helper: today's date in YYYY-MM-DD
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Helper: yesterday's date in YYYY-MM-DD
function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function seedTodayFilterData() {
  const today = todayStr();
  const yesterday = yesterdayStr();

  // Task 1: todo (should appear in today filter)
  const t1 = await addTask({
    title: "Pending todo",
    project: "",
    duration_minutes: 0,
    date: yesterday,
    status: "todo",
    category: "งานหลัก",
    notes: "",
  });

  // Task 2: in-progress (should appear in today filter)
  const t2 = await addTask({
    title: "Work in progress",
    project: "",
    duration_minutes: 0,
    date: today,
    status: "in-progress",
    category: "งานหลัก",
    notes: "",
  });

  // Task 3: in-test (should appear in today filter)
  const t3 = await addTask({
    title: "Being tested",
    project: "",
    duration_minutes: 0,
    date: today,
    status: "in-test",
    category: "งานรอง",
    notes: "",
  });

  // Task 4: done, updated TODAY (should appear in today filter)
  const t4 = await addTask({
    title: "Done today",
    project: "",
    duration_minutes: 30,
    date: yesterday,
    status: "done",
    category: "งานหลัก",
    notes: "",
  });

  // Task 5: done, updated YESTERDAY (should NOT appear in today filter)
  const t5 = await addTask({
    title: "Done yesterday",
    project: "",
    duration_minutes: 20,
    date: yesterday,
    status: "done",
    category: "งานรอง",
    notes: "",
  });

  // Task 6: done, updated today but archived (should NOT appear - archived excluded)
  const t6 = await addTask({
    title: "Done today but archived",
    project: "",
    duration_minutes: 10,
    date: today,
    status: "done",
    category: "อื่นๆ",
    notes: "",
    is_archived: true,
  });

  // Manually set updated_at timestamps on the fake state
  // (addTask doesn't include updated_at in INSERT, DB defaults to created_at = now)
  const findTask = (id: number | string) =>
    state.tasks.find((t) => Number(t.id) === Number(id));
  findTask(t1)!.updated_at = `${yesterday}T10:00:00.000Z`;
  findTask(t2)!.updated_at = `${today}T08:00:00.000Z`;
  findTask(t3)!.updated_at = `${today}T09:00:00.000Z`;
  findTask(t4)!.updated_at = `${today}T14:00:00.000Z`;
  findTask(t5)!.updated_at = `${yesterday}T16:00:00.000Z`;
  findTask(t6)!.updated_at = `${today}T12:00:00.000Z`;

  return { t1, t2, t3, t4, t5, t6 };
}

describe('today filter - getTasks({ status: "today" })', () => {
  it("returns all incomplete tasks regardless of date", async () => {
    const { t1, t2, t3 } = await seedTodayFilterData();

    const result = await getTasks({ status: "today" });
    const ids = result.map((t) => t.id);

    // All incomplete statuses should be included
    expect(ids).toContain(t1); // todo
    expect(ids).toContain(t2); // in-progress
    expect(ids).toContain(t3); // in-test
  });

  it("returns done tasks only if updated_at is today", async () => {
    const { t4, t5 } = await seedTodayFilterData();

    const result = await getTasks({ status: "today" });
    const ids = result.map((t) => t.id);

    expect(ids).toContain(t4); // done, updated today -> included
    expect(ids).not.toContain(t5); // done, updated yesterday -> excluded
  });

  it("excludes archived tasks by default", async () => {
    const { t6 } = await seedTodayFilterData();

    const result = await getTasks({ status: "today" });
    const ids = result.map((t) => t.id);

    expect(ids).not.toContain(t6); // done today but archived -> excluded
  });

  it("returns correct total count", async () => {
    await seedTodayFilterData();

    const result = await getTasks({ status: "today" });

    // t1 (todo) + t2 (in-progress) + t3 (in-test) + t4 (done today) = 4
    // t5 (done yesterday) excluded, t6 (archived) excluded
    expect(result).toHaveLength(4);
  });

  it("returns empty when no tasks exist", async () => {
    const result = await getTasks({ status: "today" });
    expect(result).toEqual([]);
  });

  it("works with only done tasks updated today", async () => {
    const today = todayStr();
    const id = await addTask({
      title: "Only done task",
      project: "",
      duration_minutes: 0,
      date: today,
      status: "done",
      category: "อื่นๆ",
      notes: "",
    });
    // Ensure updated_at is set to today
    state.tasks.find((t) => Number(t.id) === Number(id))!.updated_at =
      `${today}T10:00:00.000Z`;

    const result = await getTasks({ status: "today" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(id);
    expect(result[0].status).toBe("done");
  });

  it("works with only incomplete tasks (no done tasks)", async () => {
    await addTask({
      title: "Only todo",
      project: "",
      duration_minutes: 0,
      date: todayStr(),
      status: "todo",
      category: "อื่นๆ",
      notes: "",
    });

    const result = await getTasks({ status: "today" });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("todo");
  });
});

describe("today filter - combined with other filters", () => {
  it("today + category filter", async () => {
    await seedTodayFilterData();

    const result = await getTasks({ status: "today", category: "งานรอง" });
    // t3 (in-test, งานรอง) should match
    // t5 (done yesterday, งานรอง) should not match (done yesterday)
    expect(result.every((t) => t.category === "งานรอง")).toBe(true);
    expect(result.some((t) => t.title === "Being tested")).toBe(true);
  });

  it("today + search filter", async () => {
    await seedTodayFilterData();

    const result = await getTasks({ status: "today", search: "progress" });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Work in progress");
  });
});

describe("today filter - compared with other status filters", () => {
  it("status=all returns more results than status=today", async () => {
    await seedTodayFilterData();

    const allTasks = await getTasks({}); // status defaults to 'all', non-archived
    const todayTasks = await getTasks({ status: "today" });

    // 'all' should include t5 (done yesterday) which 'today' excludes
    expect(allTasks.length).toBeGreaterThan(todayTasks.length);
  });

  it("status=done returns tasks not in status=today", async () => {
    await seedTodayFilterData();

    const doneTasks = await getTasks({ status: "done" });
    const todayTasks = await getTasks({ status: "today" });

    // done filter includes t5 (done yesterday), today filter does not
    const todayIds = new Set(todayTasks.map((t) => t.id));
    const doneOnlyTasks = doneTasks.filter((t) => !todayIds.has(t.id));
    expect(doneOnlyTasks.length).toBeGreaterThan(0);
    expect(doneOnlyTasks.every((t) => t.title === "Done yesterday")).toBe(true);
  });
});

describe("today filter - task properties", () => {
  it("returned tasks have correct assignee info", async () => {
    const today = todayStr();

    // Add assignee
    state.assignees.push({
      id: 1,
      name: "Alice",
      color: "#ff0000",
      discord_id: "alice123",
      created_at: new Date().toISOString(),
    });

    await addTask({
      title: "Assigned task",
      project: "TestProj",
      duration_minutes: 60,
      date: today,
      status: "in-progress",
      category: "งานหลัก",
      notes: "test notes",
      assignee_id: 1,
    });

    const result = await getTasks({ status: "today" });
    expect(result).toHaveLength(1);
    expect(result[0].assignee).toBeTruthy();
    expect(result[0].assignee?.name).toBe("Alice");
    expect(result[0].assignee?.discord_id).toBe("alice123");
  });

  it("returned tasks have updated_at field", async () => {
    const today = todayStr();
    const id = await addTask({
      title: "Has timestamp",
      project: "",
      duration_minutes: 0,
      date: today,
      status: "todo",
      category: "อื่นๆ",
      notes: "",
    });
    state.tasks.find((t) => Number(t.id) === Number(id))!.updated_at =
      `${today}T15:30:00.000Z`;

    const result = await getTasks({ status: "today" });
    expect(result).toHaveLength(1);
    expect(result[0].updated_at).toBeTruthy();
  });
});

describe("DailyReflect filtering logic (pure JS)", () => {
  /**
   * These tests verify the filtering logic used in DailyReflect.svelte's
   * loadTodayData(), extracted as pure functions for testability.
   */

  interface MockTask {
    id: number;
    title: string;
    status: string;
    updated_at: string;
    is_archived?: boolean;
  }

  function filterPendingTasks(tasks: MockTask[]): MockTask[] {
    return tasks.filter((t) => t.status !== "done");
  }

  function filterDoneTodayTasks(tasks: MockTask[]): MockTask[] {
    const now = new Date();
    const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    return tasks.filter((t) => {
      if (t.status !== "done") return false;
      if (t.updated_at) {
        const updatedDate = t.updated_at.includes("T")
          ? t.updated_at.split("T")[0]
          : t.updated_at.split(" ")[0];
        return updatedDate === todayDate;
      }
      return false;
    });
  }

  const today = todayStr();
  const yesterday = yesterdayStr();

  const sampleTasks: MockTask[] = [
    {
      id: 1,
      title: "Todo task",
      status: "todo",
      updated_at: `${yesterday}T10:00:00.000Z`,
    },
    {
      id: 2,
      title: "In progress",
      status: "in-progress",
      updated_at: `${today}T08:00:00.000Z`,
    },
    {
      id: 3,
      title: "In test",
      status: "in-test",
      updated_at: `${today}T09:00:00.000Z`,
    },
    {
      id: 4,
      title: "Done today",
      status: "done",
      updated_at: `${today}T14:00:00.000Z`,
    },
    {
      id: 5,
      title: "Done yesterday",
      status: "done",
      updated_at: `${yesterday}T16:00:00.000Z`,
    },
    { id: 6, title: "Done no timestamp", status: "done", updated_at: "" },
  ];

  it("filterPendingTasks returns only non-done tasks", () => {
    const result = filterPendingTasks(sampleTasks);
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.id)).toEqual([1, 2, 3]);
    expect(result.every((t) => t.status !== "done")).toBe(true);
  });

  it("filterDoneTodayTasks returns only done tasks updated today", () => {
    const result = filterDoneTodayTasks(sampleTasks);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(4);
    expect(result[0].title).toBe("Done today");
  });

  it("filterDoneTodayTasks excludes done tasks with no timestamp", () => {
    const result = filterDoneTodayTasks(sampleTasks);
    expect(result.find((t) => t.id === 6)).toBeUndefined();
  });

  it("filterDoneTodayTasks excludes done tasks updated yesterday", () => {
    const result = filterDoneTodayTasks(sampleTasks);
    expect(result.find((t) => t.id === 5)).toBeUndefined();
  });

  it("combined result matches expected for DailyReflect", () => {
    const pending = filterPendingTasks(sampleTasks);
    const doneToday = filterDoneTodayTasks(sampleTasks);
    const combined = [...pending, ...doneToday];

    expect(combined).toHaveLength(4); // 3 pending + 1 done today
    expect(combined.map((t) => t.id)).toEqual([1, 2, 3, 4]);
  });

  it("handles updated_at with space separator (SQLite format)", () => {
    const tasks: MockTask[] = [
      {
        id: 10,
        title: "Space format",
        status: "done",
        updated_at: `${today} 14:30:00`,
      },
    ];
    const result = filterDoneTodayTasks(tasks);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(10);
  });

  it("handles empty task list", () => {
    expect(filterPendingTasks([])).toEqual([]);
    expect(filterDoneTodayTasks([])).toEqual([]);
  });

  it("handles all tasks done with none today", () => {
    const tasks: MockTask[] = [
      {
        id: 1,
        title: "Old done",
        status: "done",
        updated_at: `${yesterday}T10:00:00.000Z`,
      },
      {
        id: 2,
        title: "Older done",
        status: "done",
        updated_at: "2025-01-01T10:00:00.000Z",
      },
    ];
    expect(filterPendingTasks(tasks)).toEqual([]);
    expect(filterDoneTodayTasks(tasks)).toEqual([]);
  });
});
