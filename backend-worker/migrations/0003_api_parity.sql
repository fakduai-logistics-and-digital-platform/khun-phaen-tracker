-- New API schema only. This does not read or import MongoDB data.
CREATE TABLE settings (key TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK(json_valid(payload)), updated_at TEXT NOT NULL);
CREATE UNIQUE INDEX documents_case_number ON documents(workspace_id,kind,json_extract(payload,'$.test_no')) WHERE kind='test-cases';
CREATE INDEX documents_case_suite ON documents(workspace_id,kind,json_extract(payload,'$.suite_id'),json_extract(payload,'$.test_no'));
CREATE TABLE personal_tickets (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE, expires_at INTEGER NOT NULL
);
CREATE TABLE assignment_deliveries (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY(document_id,user_id)
);
CREATE TABLE stored_objects (
  file_key TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  metadata TEXT NOT NULL CHECK(json_valid(metadata)), created_at TEXT NOT NULL
);
CREATE INDEX stored_objects_document ON stored_objects(document_id);
CREATE TABLE storage_delete_jobs (file_key TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0);
CREATE TABLE notification_schedules (
 workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
 next_run_at INTEGER NOT NULL, claimed_until INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX notification_schedule_due ON notification_schedules(next_run_at,claimed_until);
CREATE INDEX personal_tickets_expiry ON personal_tickets(expires_at);
