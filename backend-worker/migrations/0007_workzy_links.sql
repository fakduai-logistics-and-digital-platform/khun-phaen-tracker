-- Link between a user and their Workzy employee account. The token is a read-only Workzy integration token;
-- the employee's Workzy password is never stored.
CREATE TABLE workzy_links (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  employee_code TEXT NOT NULL,
  token TEXT NOT NULL,
  created_at TEXT NOT NULL
);
