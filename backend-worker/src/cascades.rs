use crate::{db, documents, records};
use serde_json::Value;
use worker::*;
/// Schedule file cleanup in the same D1 transaction as deleting records. No credentials or live MongoDB are used.
pub fn delete_statements(
    db: &D1Database,
    workspace: &str,
    kind: &str,
    id: &str,
) -> Result<Vec<D1PreparedStatement>> {
    let mut out = Vec::new();
    out.push(db::statement(db,"INSERT OR IGNORE INTO storage_delete_jobs(file_key) SELECT file_key FROM stored_objects WHERE workspace_id=? AND (document_id=? OR document_id IN (SELECT id FROM documents WHERE workspace_id=? AND parent_id=?))",&[workspace.into(),id.into(),workspace.into(),id.into()])?);
    out.push(db::statement(
        db,
        "DELETE FROM documents WHERE workspace_id=? AND parent_id=?",
        &[workspace.into(), id.into()],
    )?);
    if kind == "test-cases" {
        out.push(db::statement(db,"UPDATE documents SET payload=json_set(payload,'$.testcase_id',NULL) WHERE workspace_id=? AND kind='tasks' AND json_extract(payload,'$.testcase_id')=?",&[workspace.into(),id.into()])?);
    }
    out.push(db::statement(
        db,
        "DELETE FROM documents WHERE id=? AND workspace_id=? AND kind=?",
        &[id.into(), workspace.into(), kind.into()],
    )?);
    Ok(out)
}
pub async fn delete(env: &Env, workspace: &str, kind: &str, id: &str, old: &Value) -> Result<()> {
    let db = env.d1("DB")?;
    let mut stmts = delete_statements(&db, workspace, kind, id)?;
    if kind == "projects" {
        stmts.push(db::statement(&db,"UPDATE documents SET payload=json_set(payload,'$.project',''),updated_at=? WHERE workspace_id=? AND kind='tasks' AND json_extract(payload,'$.project')=?",&[db::timestamp().into(),workspace.into(),crate::http::text(old,"name").into()])?);
    }
    if kind == "sprints" {
        stmts.push(db::statement(&db,"UPDATE documents SET payload=json_set(payload,'$.sprint_id',NULL),updated_at=? WHERE workspace_id=? AND kind='tasks' AND json_extract(payload,'$.sprint_id')=?",&[db::timestamp().into(),workspace.into(),id.into()])?);
    }
    if kind == "assignees" {
        for (field, kinds) in [("assignee_ids", "'tasks','assignee-groups'")] {
            stmts.push(db::statement(&db,&format!("UPDATE documents SET payload=json_set(payload,'$.{field}',json(COALESCE((SELECT json_group_array(value) FROM json_each(json_extract(payload,'$.{field}')) WHERE value<>?),'[]'))) WHERE workspace_id=? AND kind IN ({kinds})"),&[id.into(),workspace.into()])?);
        }
        for field in ["assign_dev", "assign_tester"] {
            stmts.push(db::statement(&db,&format!("UPDATE documents SET payload=json_set(payload,'$.{field}','unassigned') WHERE workspace_id=? AND kind='test-cases' AND json_extract(payload,'$.{field}')=?"),&[workspace.into(),id.into()])?);
        }
    }
    db.batch(stmts).await?;
    Ok(())
}
pub async fn validate_task(
    env: &Env,
    workspace: &str,
    value: &Value,
) -> Result<Option<&'static str>> {
    if !value["title"]
        .as_str()
        .is_some_and(|s| !s.trim().is_empty() && s.len() <= 1000)
    {
        return Ok(Some("A nonempty task title is required (max 1000 bytes)"));
    }
    if !value["status"]
        .as_str()
        .is_some_and(|s| ["pending", "todo", "in-progress", "in-test", "done"].contains(&s))
    {
        return Ok(Some("Invalid task status"));
    }
    if !value["priority"]
        .as_str()
        .is_some_and(|s| ["none", "low", "medium", "high", "urgent"].contains(&s))
    {
        return Ok(Some("Invalid task priority"));
    }
    if !value["duration_minutes"]
        .as_i64()
        .is_some_and(|v| (0..=100_000_000).contains(&v))
        || !value["is_archived"].is_boolean()
    {
        return Ok(Some("Invalid task duration or archive flag"));
    }
    for key in ["start_date", "date", "due_date", "end_date"] {
        if let Some(v) = value.get(key).filter(|v| !v.is_null()) {
            if !v.as_str().is_some_and(|s| {
                s.is_empty()
                    || chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok()
                    || chrono::DateTime::parse_from_rfc3339(s).is_ok()
            }) {
                return Ok(Some("Invalid task date"));
            }
        }
    }
    if let Some(array) = value.get("assignee_ids").filter(|v| !v.is_null()) {
        let Some(ids) = array.as_array() else {
            return Ok(Some("assignee_ids must be an array"));
        };
        if ids.len() > 100 {
            return Ok(Some("Too many assignees"));
        }
        let known = records::values(env, workspace, "assignees").await?;
        if ids
            .iter()
            .any(|id| !id.is_string() || !known.iter().any(|a| a["id"] == *id))
        {
            return Ok(Some("Assignee does not belong to this workspace"));
        }
    }
    if let Some(sprint) = value["sprint_id"].as_str().filter(|s| !s.is_empty()) {
        if documents::get(env, workspace, "sprints", sprint)
            .await?
            .is_none()
        {
            return Ok(Some("Sprint does not belong to this workspace"));
        }
    }
    for key in ["links", "checklist"] {
        if value
            .get(key)
            .is_some_and(|v| !v.is_null() && !v.is_array())
        {
            return Ok(Some("Invalid task collection field"));
        }
    }
    Ok(None)
}
