PRAGMA foreign_keys = ON;
CREATE TABLE users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('admin','user')), password_hash TEXT,
  setup_token_hash TEXT UNIQUE, is_active INTEGER NOT NULL DEFAULT 0,
  profile TEXT NOT NULL DEFAULT '{}', discord_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE auth_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
  room_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, short_name TEXT,
  color TEXT, icon TEXT, notification_config TEXT, created_at TEXT NOT NULL
);
CREATE INDEX workspaces_owner ON workspaces(owner_id);
CREATE TABLE workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY(workspace_id,user_id)
);
CREATE INDEX workspace_members_user ON workspace_members(user_id,workspace_id);
-- JSON retains flexible task/checklist payloads, while indexed columns scope every query.
CREATE TABLE documents (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, parent_id TEXT, payload TEXT NOT NULL CHECK(json_valid(payload)),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX documents_workspace_kind ON documents(workspace_id,kind,created_at,id);
CREATE INDEX documents_parent ON documents(workspace_id,kind,parent_id,created_at);
CREATE INDEX documents_assignee_user ON documents(workspace_id,kind,json_extract(payload,'$.user_id'));
CREATE INDEX documents_task_status ON documents(workspace_id,kind,json_extract(payload,'$.status'));
CREATE UNIQUE INDEX documents_task_number ON documents(workspace_id,kind,json_extract(payload,'$.task_number')) WHERE kind='tasks';
CREATE TABLE counters (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, value INTEGER NOT NULL, PRIMARY KEY(workspace_id,kind)
);
CREATE TABLE realtime_tickets (
  token_hash TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL
);
CREATE TABLE notifications (
  id TEXT PRIMARY KEY, recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  payload TEXT NOT NULL CHECK(json_valid(payload)), read_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX notifications_recipient ON notifications(recipient_user_id,created_at);
