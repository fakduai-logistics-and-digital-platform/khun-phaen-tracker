-- Task lists filter on archive state and sort by updated_at; this lets them stop at LIMIT instead of reading every task.
CREATE INDEX documents_task_active ON documents(workspace_id,COALESCE(json_extract(payload,'$.is_archived'),0),json_extract(payload,'$.updated_at'),id) WHERE kind='tasks';
-- My Tasks starts from the caller's assignee rows, which are otherwise only indexed per workspace.
CREATE INDEX documents_assignee_by_user ON documents(json_extract(payload,'$.user_id'),workspace_id) WHERE kind='assignees';
