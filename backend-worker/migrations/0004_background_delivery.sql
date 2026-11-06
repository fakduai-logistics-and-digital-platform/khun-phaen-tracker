CREATE TABLE webhook_jobs (
 id TEXT PRIMARY KEY, event_key TEXT NOT NULL UNIQUE,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 url TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)),
 attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0,
 claimed_until INTEGER NOT NULL DEFAULT 0, dead INTEGER NOT NULL DEFAULT 0,
 scheduled_for INTEGER, created_at TEXT NOT NULL
);
CREATE INDEX webhook_jobs_due ON webhook_jobs(dead,next_attempt,claimed_until);
