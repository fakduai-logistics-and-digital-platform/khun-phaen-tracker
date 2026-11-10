-- Personal API keys for agents and the MCP endpoint. Only a SHA-256 of the key is stored.
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_used_at INTEGER,
  revoked_at TEXT
);
CREATE INDEX idx_api_keys_user ON api_keys(user_id, created_at);
