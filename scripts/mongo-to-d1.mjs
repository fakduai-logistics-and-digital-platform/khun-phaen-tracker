// @ts-nocheck -- plain Node script; imported by tests/mongo-to-d1.test.ts, which would otherwise pull it into checkJs.
// Convert a MongoDB export (one <collection>.json — EJSON array or NDJSON — or DBX <collection>.csv per collection) into SQL for an
// empty D1 database that has migrations 0001-0004 applied. Reads files only; never connects to MongoDB.
// Usage: node scripts/mongo-to-d1.mjs <export-dir> <out-dir>
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Fixed namespace: the same ObjectId always maps to the same UUID, so the import can be re-run safely.
const NAMESPACE = '3d0a8c52-6b1e-4f43-9c47-2b8f6e1d7a90';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLLECTIONS = ['users', 'user_profiles', 'workspaces', 'assignees', 'assignee_groups', 'projects', 'sprints', 'milestones',
  'checklist_templates', 'test_suites', 'test_cases', 'tasks', 'test_runs', 'task_comments', 'notifications', 'app_settings'];

export function uuidv5(name) {
  const ns = Buffer.from(NAMESPACE.replaceAll('-', ''), 'hex');
  const bytes = createHash('sha1').update(Buffer.concat([ns, Buffer.from(name, 'utf8')])).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export const newId = legacy => (UUID.test(String(legacy)) ? String(legacy).toLowerCase() : uuidv5(String(legacy)));

function fromEjson(value) {
  if (Array.isArray(value)) return value.map(fromEjson);
  if (!value || typeof value !== 'object') return value;
  if ('$oid' in value) return value.$oid;
  if ('$uuid' in value) return value.$uuid.toLowerCase();
  if ('$numberLong' in value || '$numberInt' in value || '$numberDouble' in value) return Number(value.$numberLong ?? value.$numberInt ?? value.$numberDouble);
  if ('$date' in value) return new Date(typeof value.$date === 'object' ? Number(value.$date.$numberLong) : value.$date).toISOString();
  if ('$binary' in value) {
    const bytes = Buffer.from(value.$binary.base64 ?? value.$binary, 'base64');
    if (bytes.length === 16) return [...bytes.toString('hex')].map((c, i) => ([8, 12, 16, 20].includes(i) ? `-${c}` : c)).join('');
    return bytes.toString('base64');
  }
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fromEjson(v)]));
}
export function parseExport(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const raw = trimmed.startsWith('[') ? JSON.parse(trimmed) : trimmed.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  return raw.map(fromEjson);
}
// DBX CSV export: nested values are flattened into `a.b` / `a[0].b` columns, and a parent column may also hold the
// whole value as EJSON. CSV loses types, so numbers and booleans are restored by field name only (some text looks numeric).
const NUMBER_FIELDS = new Set(['task_number', 'duration_minutes', 'test_no', 'archived_count', 'size']);
const BOOLEAN_FIELDS = new Set(['is_archived', 'is_active', 'is_hidden', 'completed', 'enabled', 'notify_on_create']);
function csvRows(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1 || r[0] !== '');
}
function typed(key, value) {
  if (NUMBER_FIELDS.has(key) && /^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (BOOLEAN_FIELDS.has(key) && /^(true|false)$/.test(value)) return value === 'true';
  return value;
}
const isEmpty = value => value === undefined || (value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(isEmpty));
function compact(value) {
  if (Array.isArray(value)) return value.map(compact).filter(v => !isEmpty(v));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, compact(v)]).filter(([, v]) => v !== undefined));
  return value;
}
export function parseCsvExport(text) {
  const [head, ...rows] = csvRows(text.replace(/^﻿/, ''));
  if (!head) return [];
  const paths = head.map(column => column.split(/\.|\[(\d+)\]/).filter(p => p !== undefined && p !== '').map(p => (/^\d+$/.test(p) ? Number(p) : p)));
  return rows.map(row => {
    const flat = {};
    const parents = {};
    paths.forEach((path, i) => {
      const value = row[i] ?? '';
      if (value === '') return;
      if (path.length === 1) {
        if (/^[[{]/.test(value) && paths.some(p => p.length > 1 && p[0] === path[0]) || (path[0] === '_id' && value.startsWith('{'))) {
          try { parents[path[0]] = fromEjson(JSON.parse(value)); return; } catch { /* plain text that starts with a bracket */ }
        }
        if (/^\[\]$|^\{\}$/.test(value)) { parents[path[0]] = JSON.parse(value); return; }
      }
      let node = flat;
      path.forEach((part, depth) => {
        if (depth === path.length - 1) node[part] = typed(String(part), value);
        else node = node[part] ??= typeof path[depth + 1] === 'number' ? [] : {};
      });
    });
    return { ...compact(flat), ...parents };
  });
}
function timestamp(value, fallback) {
  if (typeof value !== 'string' || !value) return fallback;
  const date = new Date(value.replace(/(\.\d{3})\d+/, '$1'));
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}
const sql = value => (value === null || value === undefined ? 'NULL' : typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`);
const insert = (table, row) => `INSERT INTO ${table}(${Object.keys(row).join(',')}) VALUES(${Object.values(row).map(sql).join(',')});`;

/** Pure conversion so it can be unit-tested without MongoDB or D1. */
export function convert(data, now = Date.now()) {
  const c = name => data[name] || [];
  const report = { imported: {}, skipped: {}, cleaned: {}, notes: [] };
  const count = (bucket, key, n = 1) => { report[bucket][key] = (report[bucket][key] || 0) + n; };
  const out = [];

  const profiles = new Map(c('user_profiles').map(p => [p.user_id, p]));
  const userIds = new Map();
  const activeUsers = new Set();
  for (const u of c('users')) {
    const id = newId(u.user_id || u._id);
    userIds.set(String(u._id), id);
    userIds.set(String(u.user_id), id);
    if (u.is_active) activeUsers.add(id);
    const p = profiles.get(u.user_id) || {};
    out.push(insert('users', {
      id, email: u.email, role: u.role === 'admin' ? 'admin' : 'user', password_hash: u.password_hash || null,
      setup_token_hash: u.setup_token ? createHash('sha256').update(u.setup_token).digest('hex') : null,
      is_active: u.is_active ? 1 : 0, discord_id: u.discord_id || null, created_at: timestamp(u.created_at, new Date(now).toISOString()),
      profile: JSON.stringify({ first_name: p.first_name || '', last_name: p.last_name || '', nickname: p.nickname || '', position: p.position || '' }),
    }));
    count('imported', 'users');
  }
  const user = legacy => (legacy ? userIds.get(String(legacy)) || null : null);

  const workspaces = new Map();
  const schedules = [];
  for (const w of c('workspaces')) {
    const owner = user(w.owner_id);
    if (!owner) { count('skipped', 'workspaces (owner no longer exists)'); continue; }
    const id = newId(w._id);
    workspaces.set(String(w._id), id);
    let config = w.notification_config || null;
    if (config) {
      if (config.line_notify_token) count('cleaned', 'workspaces.line_notify_token (LINE Notify retired)');
      config = { ...config, line_notify_token: '' };
      const next = nextRun(config, Math.floor(now / 1000));
      if (next) schedules.push({ workspace_id: id, next_run_at: next });
    }
    if (w.mcp_config) count('cleaned', 'workspaces.mcp_config (not supported by the Worker)');
    out.push(insert('workspaces', {
      id, owner_id: owner, room_code: w.room_code || id, name: w.name, short_name: w.short_name || null, color: w.color || null,
      icon: w.icon || null, notification_config: config ? JSON.stringify(config) : null, created_at: timestamp(w.created_at, new Date(now).toISOString()),
    }));
    count('imported', 'workspaces');
  }
  const workspace = legacy => workspaces.get(String(legacy));

  const ids = { assignees: new Map(), sprints: new Map(), suites: new Map(), cases: new Map(), tasks: new Map() };
  const assigneeUser = new Map();
  const documents = [];
  const counters = new Map();
  const deliveries = [];
  const objects = [];
  function doc(kind, legacy, fields, parent = null) {
    const ws = workspace(legacy.workspace_id);
    if (!ws) { count('skipped', `${kind} (workspace not imported)`); return null; }
    const id = newId(legacy._id);
    const created = timestamp(legacy.created_at, new Date(now).toISOString());
    const payload = { ...fields, id, _id: id, workspace_id: ws, created_at: created, updated_at: timestamp(legacy.updated_at, created) };
    documents.push({ id, workspace_id: ws, kind, parent_id: parent, payload, created_at: payload.created_at, updated_at: payload.updated_at });
    count('imported', kind);
    return payload;
  }

  for (const a of c('assignees')) {
    const linked = user(a.user_id);
    if (a.user_id && !linked) count('cleaned', 'assignees.user_id (user no longer exists, unlinked)');
    const value = doc('assignees', a, { name: a.name, color: a.color || '#6366F1', discord_id: a.discord_id ?? undefined, user_id: linked });
    if (value) { ids.assignees.set(String(a._id), value.id); if (linked) assigneeUser.set(value.id, linked); }
  }
  const assignee = legacy => ids.assignees.get(String(legacy));
  for (const g of c('assignee_groups')) {
    doc('assignee-groups', g, { name: g.name, assignee_ids: (g.assignee_ids || []).map(assignee).filter(Boolean) });
  }
  for (const p of c('projects')) doc('projects', p, { name: p.name, short_name: p.short_name ?? undefined, repo_url: p.repo_url ?? undefined });
  for (const s of c('sprints')) {
    const value = doc('sprints', s, { name: s.name, start_date: s.start_date, end_date: s.end_date, status: s.status, completed_at: s.completed_at ?? undefined, archived_count: s.archived_count ?? undefined });
    if (value) ids.sprints.set(String(s._id), value.id);
  }
  for (const m of c('milestones')) doc('milestones', m, { title: m.title, description: m.description ?? '', target_date: m.target_date, is_hidden: Boolean(m.is_hidden) });
  for (const t of c('checklist_templates')) doc('checklist-templates', t, { name: t.name, items: t.items || [] });
  for (const s of c('test_suites')) {
    const value = doc('test-suites', s, { title: s.title, description: s.description ?? null });
    if (value) ids.suites.set(String(s._id), value.id);
  }
  const keepAssignee = (value, field) => {
    if (!value || value === 'unassigned') return 'unassigned';
    const mapped = assignee(value);
    if (!mapped) count('cleaned', `${field} (assignee no longer exists, set unassigned)`);
    return mapped || 'unassigned';
  };
  const maxNumber = (ws, kind, n) => { const key = `${ws}|${kind}`; counters.set(key, Math.max(counters.get(key) || 0, Number(n) || 0)); };
  for (const tc of c('test_cases')) {
    const value = doc('test-cases', tc, {
      suite_id: tc.suite_id && tc.suite_id !== 'unassigned' ? ids.suites.get(String(tc.suite_id)) || '' : '',
      name: tc.name, description: tc.description ?? '', preconditions: tc.preconditions ?? '', postconditions: tc.postconditions ?? '',
      input: tc.input ?? '', expected_result: tc.expected_result ?? '', actual_result: tc.actual_result ?? '', status: tc.status,
      priority: tc.priority, fixed: tc.fixed, assign_dev: keepAssignee(tc.assign_dev, 'test_cases.assign_dev'),
      assign_tester: keepAssignee(tc.assign_tester, 'test_cases.assign_tester'), dev_note: tc.dev_note ?? null, test_note: tc.test_note ?? null,
      step_format: tc.step_format || 'classic', gherkin_steps: tc.gherkin_steps ?? null, classic_steps: tc.classic_steps || [],
      test_no: Number(tc.test_no), attachments: tc.attachments || [],
    });
    if (!value) continue;
    ids.cases.set(String(tc._id), value.id);
    maxNumber(value.workspace_id, 'test-cases', value.test_no);
    for (const a of new Set([value.assign_dev, value.assign_tester])) {
      const u = assigneeUser.get(a);
      if (u && activeUsers.has(u)) deliveries.push({ document_id: value.id, user_id: u });
    }
  }
  for (const t of c('tasks')) {
    const legacyIds = Array.isArray(t.assignee_ids) ? t.assignee_ids : [];
    const assignees = legacyIds.map(assignee).filter(Boolean);
    if (assignees.length < legacyIds.length) count('cleaned', 'tasks.assignee_ids (assignee no longer exists, removed)', legacyIds.length - assignees.length);
    const { _id, workspace_id, created_at, updated_at, assignee_ids, sprint_id, testcase_id, task_number, ...rest } = t;
    const value = doc('tasks', t, {
      ...rest, task_number: Number(task_number), assignee_ids: assignees,
      sprint_id: sprint_id ? ids.sprints.get(String(sprint_id)) || null : null,
      testcase_id: testcase_id ? ids.cases.get(String(testcase_id)) || null : null,
      attachments: t.attachments || [],
    });
    if (!value) continue;
    ids.tasks.set(String(_id), value.id);
    maxNumber(value.workspace_id, 'tasks', value.task_number);
    for (const a of new Set(assignees)) {
      const u = assigneeUser.get(a);
      if (u && activeUsers.has(u)) deliveries.push({ document_id: value.id, user_id: u });
    }
  }
  for (const r of c('test_runs')) {
    if (r.created_by && !user(r.created_by)) count('cleaned', 'test_runs.created_by (user no longer exists, cleared)');
    doc('test-runs', r, {
      name: r.name, description: r.description ?? null, default_assignee: keepAssignee(r.default_assignee, 'test_runs.default_assignee'),
      operating_system: r.operating_system ?? '', status: r.status, created_by: user(r.created_by),
      test_cases: (r.test_cases || []).map(tc => ({ test_case_id: ids.cases.get(String(tc.test_case_id)) || newId(tc.test_case_id), status: tc.status })),
    });
  }
  for (const cm of c('task_comments')) {
    const task = ids.tasks.get(String(cm.task_id));
    if (!task) {
      count('skipped', 'task_comments (task no longer exists)');
      for (const image of cm.images || []) (report.unreferencedFiles ||= []).push(image.file_key);
      continue;
    }
    if (cm.created_by && !user(cm.created_by)) count('cleaned', 'task_comments.created_by (user no longer exists, cleared)');
    const images = (cm.images || []).map(i => ({ ...i, uploader_id: user(i.uploader_id) || null }));
    const value = doc('comments', cm, { content: cm.content, images, reactions: cm.reactions || [], task_id: task, created_by: user(cm.created_by) }, task);
    for (const image of images) objects.push({ file_key: image.file_key, workspace_id: value.workspace_id, document_id: value.id, metadata: JSON.stringify(image), created_at: value.created_at });
  }

  for (const d of documents) out.push(insert('documents', { ...d, payload: JSON.stringify(d.payload) }));
  for (const [key, value] of counters) {
    const [workspace_id, kind] = key.split('|');
    out.push(insert('counters', { workspace_id, kind, value }));
  }
  for (const n of c('notifications')) {
    const recipient = user(n.recipient_user_id);
    const ws = workspace(n.workspace_id);
    if (!recipient) { count('skipped', 'notifications (recipient no longer exists)'); continue; }
    if (!ws) { count('skipped', 'notifications (workspace not imported)'); continue; }
    const id = newId(n._id);
    const created = timestamp(n.created_at, new Date(now).toISOString());
    const source = n.source_type === 'test_case' ? ids.cases.get(String(n.source_id)) : ids.tasks.get(String(n.source_id));
    const meta = {
      id, source_type: n.source_type, source_id: source || newId(n.source_id), source_title: n.source_title, workspace_id: ws,
      suite_id: n.suite_id ? ids.suites.get(String(n.suite_id)) || null : undefined,
      assignment_ids: (n.assignment_ids || []).map(assignee).filter(Boolean),
      recipient_user_ids: (n.recipient_user_ids || []).map(user).filter(Boolean),
      actor_user_id: user(n.actor_user_id), actor_name: n.actor_name, created_at: created,
    };
    out.push(insert('notifications', { id, recipient_user_id: recipient, workspace_id: ws, payload: JSON.stringify(meta), read_at: n.read_at ? timestamp(n.read_at) : null, created_at: created }));
    count('imported', 'notifications');
  }
  const seen = new Set();
  for (const d of deliveries) {
    const key = `${d.document_id}|${d.user_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(insert('assignment_deliveries', d));
  }
  report.imported.assignment_deliveries = seen.size;
  for (const o of objects) out.push(insert('stored_objects', o));
  report.imported.stored_objects = objects.length;
  for (const s of schedules) out.push(insert('notification_schedules', s));
  report.imported.notification_schedules = schedules.length;
  if (c('app_settings').length) report.notes.push('app_settings (AI/storage) are not imported: the Worker encrypts them with CONFIG_ENCRYPTION_KEY. Re-enter them in Settings after import.');
  report.notes.push('Sessions are not imported: every user signs in again with their existing password.');
  return { sql: `${out.join('\n')}\n`, report };
}

/** Same rule as backend-worker/src/schedules.rs next_run (Asia/Bangkok, UTC+7, no DST). */
export function nextRun(config, after) {
  if (config.enabled !== true || !Array.isArray(config.days)) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(config.time || '');
  if (!match) return null;
  const offset = 7 * 3600;
  const local = new Date((after + offset) * 1000);
  for (let n = 0; n <= 7; n++) {
    const day = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + n));
    if (!config.days.some(d => Number(d) === day.getUTCDay())) continue;
    const stamp = Math.floor(day.getTime() / 1000) + Number(match[1]) * 3600 + Number(match[2]) * 60 - offset;
    if (stamp > after) return stamp;
  }
  return null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Usage: node scripts/mongo-to-d1.mjs <export-dir> <out-dir>');
  const data = {};
  for (const name of COLLECTIONS) {
    try { data[name] = parseExport(await readFile(join(input, `${name}.json`), 'utf8')); continue; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    try { data[name] = parseCsvExport(await readFile(join(input, `${name}.csv`), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; data[name] = []; }
  }
  const { sql: text, report } = convert(data);
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'import.sql'), text, { mode: 0o600 });
  await writeFile(join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ imported: report.imported, skipped: report.skipped, cleaned: report.cleaned }, null, 2));
}
