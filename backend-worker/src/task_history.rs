use crate::{auth::User, db, documents, http, qa_history, records};
use serde_json::{json, Value};
use worker::*;

const KIND: &str = "task-history";
const LIST_LIMIT: i64 = 100;
const TRACKED: &[&str] = &[
    "title",
    "status",
    "priority",
    "category",
    "task_type",
    "project",
    "assignee_ids",
    "sprint_id",
    "start_date",
    "due_date",
    "duration_minutes",
    "notes",
    "checklist",
    "links",
    "testcase_id",
    "is_archived",
];

/// Treat missing, null and empty values as the same "empty" so untouched fields never show as changed.
fn normalized(field: &str, value: &Value) -> Value {
    match (field, value) {
        ("is_archived", v) => json!(v.as_bool().unwrap_or(false)),
        ("assignee_ids", Value::Array(ids)) => {
            let mut ids: Vec<String> = ids
                .iter()
                .filter_map(|v| v.as_str().map(str::to_owned))
                .collect();
            ids.sort();
            if ids.is_empty() {
                json!("")
            } else {
                json!(ids)
            }
        }
        (_, Value::Null) => json!(""),
        (_, Value::Array(items)) if items.is_empty() => json!(""),
        (_, other) => other.clone(),
    }
}

async fn name_of(env: &Env, ws: &str, kind: &str, key: &str, id: &str) -> String {
    match documents::get(env, ws, kind, id).await {
        Ok(Some(doc)) => http::text(&doc, key).to_owned(),
        _ => id.to_owned(),
    }
}

async fn readable(env: &Env, ws: &str, field: &str, value: &Value) -> Value {
    match (field, value) {
        ("assignee_ids", Value::Array(ids)) => {
            let mut names = Vec::new();
            for id in ids.iter().filter_map(Value::as_str) {
                names.push(name_of(env, ws, "assignees", "name", id).await);
            }
            json!(names.join(", "))
        }
        ("sprint_id", Value::String(id)) if !id.is_empty() => {
            json!(name_of(env, ws, "sprints", "name", id).await)
        }
        (_, Value::String(text)) => json!(text.chars().take(200).collect::<String>()),
        // Notes, checklists and links can be large; the history only records that they changed.
        (_, Value::Array(_) | Value::Object(_)) => Value::Null,
        (_, other) => other.clone(),
    }
}

/// Fields whose value differs between the two versions of a task, with readable before/after values.
pub async fn changes(env: &Env, ws: &str, before: &Value, after: &Value) -> Vec<Value> {
    let mut out = Vec::new();
    for field in TRACKED {
        let (old, new) = (
            normalized(field, &before[*field]),
            normalized(field, &after[*field]),
        );
        if old != new {
            out.push(json!({
                "field": field,
                "from": readable(env, ws, field, &old).await,
                "to": readable(env, ws, field, &new).await,
            }));
        }
    }
    out
}

pub fn entry_statement(
    db: &D1Database,
    ws: &str,
    task_id: &str,
    user: &User,
    action: &str,
    changes: Vec<Value>,
) -> Result<D1PreparedStatement> {
    let mut value = json!({
        "task_id": task_id,
        "user_id": user.id,
        "user_name": qa_history::display_name(user),
        "action": action,
        "changes": changes,
        "at": db::timestamp(),
    });
    let id = db::id();
    records::identity(&mut value, ws, &id);
    records::insert_statement(db, KIND, &value, Some(task_id))
}

pub async fn list(env: &Env, ws: &str, task_id: &str) -> Result<Vec<Value>> {
    let rows: Vec<documents::Document> = db::all(
        &env.d1("DB")?,
        "SELECT payload FROM documents WHERE workspace_id=? AND kind=? AND parent_id=? ORDER BY created_at DESC,id LIMIT ?",
        &[ws.into(), KIND.into(), task_id.into(), LIST_LIMIT.into()],
    )
    .await?;
    rows.into_iter()
        .map(|r| serde_json::from_str(&r.payload).map_err(Into::into))
        .collect()
}
