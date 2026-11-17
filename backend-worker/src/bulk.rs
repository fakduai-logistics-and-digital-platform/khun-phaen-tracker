//! Bulk task creation for CSV imports: one request and one D1 transaction instead of one request per row.
use crate::{auth::User, db, documents, http, records, realtime, workspaces};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashSet;
use worker::*;

pub const MAX_BULK_TASKS: usize = 100;

#[derive(Deserialize)]
struct Counter {
    total: i64,
}

fn task_defaults() -> Value {
    json!({"project":"","duration_minutes":0,"status":"todo","priority":"none","category":"อื่นๆ","notes":"","is_archived":false,"assignee_ids":[],"attachments":[]})
}

/// Builds one task from untrusted input, or explains why it is rejected.
fn build_task(
    input: &Value,
    assignees: &HashSet<String>,
    sprints: &HashSet<String>,
) -> std::result::Result<Value, &'static str> {
    if !input.is_object() {
        return Err("Task must be an object");
    }
    let mut value = task_defaults();
    records::merge(&mut value, &documents::clean("tasks", input));
    let start = value
        .get("start_date")
        .filter(|v| !v.is_null())
        .or(value.get("date"))
        .cloned();
    match start.as_ref().and_then(Value::as_str) {
        Some(s) if !s.is_empty() => {
            value["start_date"] = json!(s);
            value["date"] = json!(s);
        }
        _ => return Err("start_date required"),
    }
    if input.get("due_date").is_some() {
        value["end_date"] = input["due_date"].clone();
    } else if input.get("end_date").is_some() {
        value["due_date"] = input["end_date"].clone();
    }
    if let Some(error) = crate::cascades::validate_task_shape(&value) {
        return Err(error);
    }
    if let Some(ids) = value.get("assignee_ids").and_then(Value::as_array) {
        if ids
            .iter()
            .any(|id| !id.as_str().is_some_and(|s| assignees.contains(s)))
        {
            return Err("Assignee does not belong to this workspace");
        }
    }
    if let Some(sprint) = value["sprint_id"].as_str().filter(|s| !s.is_empty()) {
        if !sprints.contains(sprint) {
            return Err("Sprint does not belong to this workspace");
        }
    }
    Ok(value)
}

fn ids(values: Vec<Value>) -> HashSet<String> {
    values
        .iter()
        .filter_map(|v| v["id"].as_str().map(str::to_owned))
        .collect()
}

/// `POST /workspaces/{ws}/tasks/bulk` with `{"tasks":[...]}`. Valid rows are written together;
/// invalid rows are reported by index and skipped. Imported rows skip per-task history,
/// assignment notifications and schedule jobs, which would otherwise multiply D1 writes.
pub async fn create_tasks(
    req: &mut Request,
    env: &Env,
    w: &workspaces::Workspace,
    _user: &User,
) -> Result<Response> {
    let input = http::body(req).await?;
    let Some(rows) = input["tasks"].as_array() else {
        return http::error(400, "tasks array required");
    };
    if rows.is_empty() {
        return http::error(400, "tasks array is empty");
    }
    if rows.len() > MAX_BULK_TASKS {
        return http::error(400, "Too many tasks in one request (max 100)");
    }
    let assignees = ids(records::values(env, &w.id, "assignees").await?);
    let sprints = ids(records::values(env, &w.id, "sprints").await?);
    let mut valid = Vec::new();
    let mut failed = Vec::new();
    for (index, row) in rows.iter().enumerate() {
        match build_task(row, &assignees, &sprints) {
            Ok(value) => valid.push(value),
            Err(error) => failed.push(json!({"index":index,"error":error})),
        }
    }
    if valid.is_empty() {
        return http::ok(json!({"success":true,"created":0,"failed":failed}));
    }
    let db = env.d1("DB")?;
    let count = valid.len() as i64;
    let counter: Option<Counter> = db::first(&db,"INSERT INTO counters(workspace_id,kind,value) VALUES(?,'tasks',?) ON CONFLICT(workspace_id,kind) DO UPDATE SET value=value+excluded.value RETURNING value AS total",&[w.id.clone().into(),(count as f64).into()]).await?;
    let last = counter
        .ok_or_else(|| Error::RustError("Task number allocation failed".into()))?
        .total;
    let first = last - count + 1;
    let now = db::timestamp();
    let mut writes = Vec::with_capacity(valid.len());
    for (offset, value) in valid.iter_mut().enumerate() {
        let id = db::id();
        value["id"] = json!(id);
        value["_id"] = json!(id);
        value["workspace_id"] = json!(w.id);
        value["task_number"] = json!(first + offset as i64);
        value["created_at"] = json!(now);
        value["updated_at"] = json!(now);
        writes.push(records::insert_statement(&db, "tasks", value, None)?);
    }
    db.batch(writes).await?;
    realtime::publish(env, &w.id, "task", "bulk-create", "", json!({"count":count})).await;
    http::ok(json!({"success":true,"created":count,"failed":failed}))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn set(items: &[&str]) -> HashSet<String> {
        items.iter().map(|s| (*s).to_owned()).collect()
    }

    #[test]
    fn applies_defaults_and_mirrors_dates() {
        let task = build_task(
            &json!({"title":"A","date":"2026-01-02","due_date":"2026-01-05"}),
            &set(&[]),
            &set(&[]),
        )
        .unwrap();
        assert_eq!(task["status"], "todo");
        assert_eq!(task["start_date"], "2026-01-02");
        assert_eq!(task["end_date"], "2026-01-05");
    }

    #[test]
    fn rejects_bad_rows() {
        let none = set(&[]);
        assert!(build_task(&json!({"title":"A"}), &none, &none).is_err());
        assert!(build_task(&json!({"title":"","date":"2026-01-02"}), &none, &none).is_err());
        assert!(build_task(
            &json!({"title":"A","date":"2026-01-02","status":"bogus"}),
            &none,
            &none
        )
        .is_err());
        assert!(build_task(
            &json!({"title":"A","date":"2026-01-02","assignee_ids":["x"]}),
            &none,
            &none
        )
        .is_err());
        assert!(build_task(
            &json!({"title":"A","date":"2026-01-02","sprint_id":"s"}),
            &none,
            &none
        )
        .is_err());
    }

    #[test]
    fn accepts_known_references_and_ignores_forged_fields() {
        let task = build_task(
            &json!({"title":"A","date":"2026-01-02","assignee_ids":["a1"],"sprint_id":"s1","id":"forged","task_number":9}),
            &set(&["a1"]),
            &set(&["s1"]),
        )
        .unwrap();
        assert_eq!(task["assignee_ids"], json!(["a1"]));
        assert!(task.get("id").is_none());
        assert!(task.get("task_number").is_none());
    }
}
