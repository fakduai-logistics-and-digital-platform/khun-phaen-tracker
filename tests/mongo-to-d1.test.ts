import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import * as converter from "../scripts/mongo-to-d1.mjs";

const { convert, newId, nextRun, parseCsvExport, parseExport, uuidv5 }: any = converter;

const oid = (n: number) => n.toString(16).padStart(24, "0");
const NOW = Date.UTC(2026, 10, 6, 3, 0, 0); // Friday 10:00 in Bangkok

function fixture() {
  return {
    users: [
      { _id: oid(1), user_id: "AAAAAAAA-1111-4111-8111-111111111111", email: "owner@example.test", role: "admin", is_active: true, password_hash: "$2b$12$hash", setup_token: null, discord_id: "", created_at: "2026-01-01T00:00:00.123456Z" },
      { _id: oid(2), user_id: "bbbbbbbb-2222-4222-8222-222222222222", email: "invite@example.test", role: "user", is_active: false, setup_token: "pending-token", discord_id: "", created_at: "2026-01-02T00:00:00Z" },
    ],
    user_profiles: [{ _id: "p1", user_id: "AAAAAAAA-1111-4111-8111-111111111111", first_name: "O'Neil", last_name: "", nickname: "Boss", position: "QA Tester" }],
    workspaces: [
      { _id: oid(10), owner_id: oid(1), room_code: "11111111-0000-4000-8000-000000000000", name: "Main", created_at: "2026-01-01T00:00:00Z",
        notification_config: { enabled: true, days: [1, 2, 3, 4, 5], time: "09:00", discord_webhook_url: "https://discord.test/hook", line_notify_token: "legacy", notify_on_create: true, notify_on_status_change: [], last_sent_at: null },
        mcp_config: { enabled: true } },
      { _id: oid(11), owner_id: oid(99), room_code: "22222222-0000-4000-8000-000000000000", name: "Orphan", created_at: "2026-01-01T00:00:00Z" },
    ],
    assignees: [
      { _id: oid(20), workspace_id: oid(10), name: "Owner", color: "#000", user_id: oid(1), created_at: "2026-01-01T00:00:00Z" },
      { _id: oid(21), workspace_id: oid(10), name: "Gone user", color: "#111", user_id: oid(98), created_at: "2026-01-01T00:00:00Z" },
      { _id: oid(22), workspace_id: oid(11), name: "In orphan", color: "#222", user_id: "", created_at: "2026-01-01T00:00:00Z" },
    ],
    sprints: [{ _id: oid(30), workspace_id: oid(10), name: "S1", start_date: "2026-01-01", end_date: "2026-01-14", status: "active", created_at: "2026-01-01T00:00:00Z" }],
    test_suites: [{ _id: "suite-legacy", workspace_id: oid(10), title: "Suite", description: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }],
    test_cases: [{ _id: "cccccccc-3333-4333-8333-333333333333", workspace_id: oid(10), suite_id: "suite-legacy", name: "Case", status: "actual", priority: "high", fixed: "no", assign_dev: oid(77), assign_tester: oid(20), test_no: 7, classic_steps: [], step_format: "classic", attachments: null, dev_note: null, test_note: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }],
    tasks: [
      { _id: oid(40), workspace_id: oid(10), title: "It's done", task_number: 12, status: "done", assignee_ids: [oid(20), oid(76)], sprint_id: oid(30), testcase_id: "cccccccc-3333-4333-8333-333333333333", start_date: "2026-01-03", created_at: "2026-01-03T00:00:00Z", updated_at: "2026-01-04T00:00:00Z" },
      { _id: oid(41), workspace_id: oid(10), title: "No assignees", task_number: 3, status: "todo", assignee_ids: null, created_at: "2026-01-03T00:00:00Z", updated_at: "2026-01-03T00:00:00Z" },
    ],
    test_runs: [{ _id: "dddddddd-4444-4444-8444-444444444444", workspace_id: oid(10), name: "Run", status: "completed", created_by: oid(97), default_assignee: oid(75), operating_system: "", description: null, test_cases: [{ test_case_id: "cccccccc-3333-4333-8333-333333333333", status: "passed" }], created_at: "2026-01-05T00:00:00Z", updated_at: "2026-01-05T00:00:00Z" }],
    task_comments: [
      { _id: oid(50), workspace_id: oid(10), task_id: oid(40), content: "ok", created_by: oid(1), images: [{ id: "i1", filename: "a.png", file_key: "ws/task/a.png", mime_type: "image/png", size: 3, uploaded_at: "2026-01-04T00:00:00Z", uploader_id: oid(1) }], reactions: [], created_at: "2026-01-04T00:00:00Z", updated_at: "2026-01-04T00:00:00Z" },
      { _id: oid(51), workspace_id: oid(10), task_id: oid(49), content: "orphan", created_by: oid(1), images: [{ id: "i2", file_key: "ws/gone/b.png" }], created_at: "2026-01-04T00:00:00Z", updated_at: "2026-01-04T00:00:00Z" },
    ],
    notifications: [
      { _id: oid(60), recipient_user_id: oid(1), workspace_id: oid(10), source_type: "task", source_id: oid(40), source_title: "It's done", assignment_ids: [oid(20)], recipient_user_ids: [oid(1)], actor_user_id: oid(2), actor_name: "Inv", created_at: "2026-01-04T00:00:00Z", read_at: "2026-01-05T00:00:00Z" },
      { _id: oid(61), recipient_user_id: oid(96), workspace_id: oid(10), source_type: "task", source_id: oid(40), source_title: "x", assignment_ids: [], recipient_user_ids: [], created_at: "2026-01-04T00:00:00Z" },
    ],
    app_settings: [{ _id: oid(70), key: "ai" }],
  };
}
const rows = (sql: string, table: string) => sql.split("\n").filter(line => line.startsWith(`INSERT INTO ${table}(`));
const payloads = (sql: string) => rows(sql, "documents").map(line => JSON.parse(line.match(/'(\{.*\})'/)![1].replaceAll("''", "'")));

describe("mongo-to-d1", () => {
  it("maps ids deterministically and keeps existing UUIDs", () => {
    expect(uuidv5(oid(10))).toBe(uuidv5(oid(10)));
    expect(uuidv5(oid(10))).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newId("CCCCCCCC-3333-4333-8333-333333333333")).toBe("cccccccc-3333-4333-8333-333333333333");
    expect(convert(fixture(), NOW).sql).toBe(convert(fixture(), NOW).sql);
  });

  it("reads EJSON arrays and NDJSON", () => {
    const array = parseExport(JSON.stringify([{ _id: { $oid: oid(1) }, n: { $numberLong: "5" }, d: { $date: "2026-01-01T00:00:00Z" }, u: { $binary: { base64: Buffer.alloc(16, 1).toString("base64"), subType: "04" } } }]));
    expect(array[0]).toEqual({ _id: oid(1), n: 5, d: "2026-01-01T00:00:00.000Z", u: "01010101-0101-0101-0101-010101010101" });
    expect(parseExport(`{"a":1}\n{"a":2}\n`)).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("reads DBX CSV exports: flattened columns, EJSON parent columns and per-field types", () => {
    const csv = [
      "_id,title,task_number,discord_id,is_archived,notes,assignee_ids[0],assignee_ids[1],assignee_ids,checklist[0].text,checklist[0].completed,cfg.days[0],cfg.enabled",
      `${oid(1)},"[Bug] multi
line, ""quoted""",12,123456,true,,${oid(2)},${oid(3)},"[""${oid(2)}"",""${oid(3)}""]",Write,false,1,true`,
      `${oid(4)},Plain,3,,false,note,,,[],,,,`,
    ].join("\n");
    const [first, second] = parseCsvExport(csv);
    expect(first).toEqual({ _id: oid(1), title: '[Bug] multi\nline, "quoted"', task_number: 12, discord_id: "123456", is_archived: true,
      assignee_ids: [oid(2), oid(3)], checklist: [{ text: "Write", completed: false }], cfg: { days: ["1"], enabled: true } });
    expect(second).toEqual({ _id: oid(4), title: "Plain", task_number: 3, is_archived: false, notes: "note", assignee_ids: [] });
  });

  it("imports users with their bcrypt hash, profile, and hashed pending setup token", () => {
    const { sql } = convert(fixture(), NOW);
    const users = rows(sql, "users");
    expect(users).toHaveLength(2);
    expect(users[0]).toContain("'aaaaaaaa-1111-4111-8111-111111111111'");
    expect(users[0]).toContain("'$2b$12$hash'");
    expect(users[0]).toContain("O''Neil");
    expect(users[0]).toContain("'2026-01-01T00:00:00.123Z'");
    expect(users[1]).toContain(createHash("sha256").update("pending-token").digest("hex"));
    expect(sql).not.toContain("pending-token");
  });

  it("skips workspaces whose owner is gone, with everything inside them", () => {
    const { sql, report } = convert(fixture(), NOW);
    expect(rows(sql, "workspaces")).toHaveLength(1);
    expect(sql).not.toContain("Orphan");
    expect(report.skipped["workspaces (owner no longer exists)"]).toBe(1);
    expect(report.skipped["assignees (workspace not imported)"]).toBe(1);
  });

  it("remaps references and cleans ones that point at deleted records", () => {
    const { sql, report } = convert(fixture(), NOW);
    const docs = payloads(sql);
    const ws = uuidv5(oid(10));
    const task = docs.find(d => d.title === "It's done");
    expect(task).toMatchObject({ workspace_id: ws, assignee_ids: [uuidv5(oid(20))], sprint_id: uuidv5(oid(30)), testcase_id: "cccccccc-3333-4333-8333-333333333333", task_number: 12, attachments: [] });
    expect(docs.find(d => d.title === "No assignees").assignee_ids).toEqual([]);
    expect(docs.find(d => d.name === "Gone user").user_id).toBeNull();
    expect(docs.find(d => d.name === "Owner").user_id).toBe("aaaaaaaa-1111-4111-8111-111111111111");
    expect(docs.find(d => d.name === "Case")).toMatchObject({ suite_id: uuidv5("suite-legacy"), assign_dev: "unassigned", assign_tester: uuidv5(oid(20)), attachments: [] });
    expect(docs.find(d => d.name === "Run")).toMatchObject({ created_by: null, default_assignee: "unassigned" });
    expect(report.cleaned["tasks.assignee_ids (assignee no longer exists, removed)"]).toBe(1);
  });

  it("keeps comment files referenced and reports files of skipped comments", () => {
    const { sql, report } = convert(fixture(), NOW);
    const comment = payloads(sql).find(d => d.content === "ok");
    expect(comment.task_id).toBe(uuidv5(oid(40)));
    expect(rows(sql, "stored_objects")).toHaveLength(1);
    expect(rows(sql, "stored_objects")[0]).toContain("'ws/task/a.png'");
    expect(report.unreferencedFiles).toEqual(["ws/gone/b.png"]);
  });

  it("seeds counters, delivery dedupe, notifications and schedules", () => {
    const { sql, report } = convert(fixture(), NOW);
    const ws = uuidv5(oid(10));
    expect(sql).toContain(`INSERT INTO counters(workspace_id,kind,value) VALUES('${ws}','tasks',12);`);
    expect(sql).toContain(`INSERT INTO counters(workspace_id,kind,value) VALUES('${ws}','test-cases',7);`);
    expect(rows(sql, "assignment_deliveries")).toHaveLength(2);
    expect(rows(sql, "notifications")).toHaveLength(1);
    expect(report.skipped["notifications (recipient no longer exists)"]).toBe(1);
    expect(sql).not.toContain("legacy");
    expect(rows(sql, "notification_schedules")[0]).toContain(String(Date.UTC(2026, 10, 9, 2, 0, 0) / 1000));
  });

  it("computes the next Bangkok-time run like the Worker", () => {
    const config = { enabled: true, days: [5], time: "09:00" };
    const friday0830 = Date.UTC(2026, 10, 6, 1, 30) / 1000;
    expect(nextRun(config, friday0830)).toBe(Date.UTC(2026, 10, 6, 2, 0) / 1000);
    expect(nextRun(config, Date.UTC(2026, 10, 6, 2, 0) / 1000)).toBe(Date.UTC(2026, 10, 13, 2, 0) / 1000);
    expect(nextRun({ ...config, enabled: false }, friday0830)).toBeNull();
  });
});
