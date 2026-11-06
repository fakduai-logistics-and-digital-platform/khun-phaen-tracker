-- Reverse index of tasks.assignee_ids, kept in sync by triggers so every write path (handlers, cascades, import) stays consistent.
CREATE TABLE task_assignees (
 task_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 assignee_id TEXT NOT NULL,
 workspace_id TEXT NOT NULL,
 PRIMARY KEY(task_id,assignee_id)
) WITHOUT ROWID;
CREATE INDEX task_assignees_assignee ON task_assignees(assignee_id,workspace_id);
INSERT OR IGNORE INTO task_assignees(task_id,assignee_id,workspace_id)
 SELECT d.id,ids.value,d.workspace_id FROM documents d,json_each(json_extract(d.payload,'$.assignee_ids')) ids WHERE d.kind='tasks' AND ids.value IS NOT NULL;
CREATE TRIGGER task_assignees_insert AFTER INSERT ON documents WHEN new.kind='tasks' BEGIN
 INSERT OR IGNORE INTO task_assignees(task_id,assignee_id,workspace_id)
  SELECT new.id,value,new.workspace_id FROM json_each(json_extract(new.payload,'$.assignee_ids')) WHERE value IS NOT NULL;
END;
-- Only fires when the assignee list (or the row's kind/workspace) actually changes, so ordinary task edits write nothing extra.
CREATE TRIGGER task_assignees_update AFTER UPDATE OF payload,kind,workspace_id ON documents
 WHEN (old.kind='tasks' OR new.kind='tasks') AND (old.kind IS NOT new.kind OR old.workspace_id IS NOT new.workspace_id OR json_extract(old.payload,'$.assignee_ids') IS NOT json_extract(new.payload,'$.assignee_ids')) BEGIN
 DELETE FROM task_assignees WHERE task_id=old.id;
 INSERT OR IGNORE INTO task_assignees(task_id,assignee_id,workspace_id)
  SELECT new.id,value,new.workspace_id FROM json_each(json_extract(new.payload,'$.assignee_ids')) WHERE new.kind='tasks' AND value IS NOT NULL;
END;
