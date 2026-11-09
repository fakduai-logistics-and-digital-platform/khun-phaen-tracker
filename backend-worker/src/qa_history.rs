use crate::{auth::User, db, documents, http, records};
use serde_json::{json, Value};
use worker::*;

const KIND: &str = "test-case-history";
const TRACKED: &[&str] = &[
    "name",
    "description",
    "preconditions",
    "postconditions",
    "input",
    "expected_result",
    "actual_result",
    "status",
    "priority",
    "fixed",
    "assign_dev",
    "assign_tester",
    "dev_note",
    "test_note",
    "suite_id",
    "project_id",
    "step_format",
    "classic_steps",
    "gherkin_steps",
];

pub fn display_name(user: &User) -> String {
    let profile: Value = serde_json::from_str(&user.profile).unwrap_or_else(|_| json!({}));
    ["nickname", "first_name"]
        .iter()
        .map(|k| http::text(&profile, k).trim().to_owned())
        .find(|v| !v.is_empty())
        .unwrap_or_else(|| user.email.clone())
}

/// Treat missing, null and empty text as the same "empty" value so untouched fields never show as changed.
fn normalized(value: &Value) -> Value {
    match value {
        Value::Null => json!(""),
        other => other.clone(),
    }
}

async fn readable(env: &Env, ws: &str, field: &str, value: &Value) -> Value {
    let id = value.as_str().unwrap_or_default();
    let (kind, name_key) = match field {
        "assign_dev" | "assign_tester" => ("assignees", "name"),
        "suite_id" => ("test-suites", "title"),
        "project_id" => ("projects", "name"),
        _ => {
            return match value {
                Value::String(text) => json!(text.chars().take(200).collect::<String>()),
                // Step lists are large; the history only records that they changed.
                Value::Array(_) | Value::Object(_) => Value::Null,
                other => other.clone(),
            };
        }
    };
    if id.is_empty() || id == "unassigned" {
        return json!("");
    }
    match documents::get(env, ws, kind, id).await {
        Ok(Some(doc)) => json!(http::text(&doc, name_key)),
        _ => json!(id),
    }
}

/// Fields whose value differs between the two versions of a test case, with readable before/after values.
pub async fn changes(env: &Env, ws: &str, before: &Value, after: &Value) -> Vec<Value> {
    let mut out = Vec::new();
    for field in TRACKED {
        let (old, new) = (normalized(&before[*field]), normalized(&after[*field]));
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
    case_id: &str,
    user: &User,
    action: &str,
    changes: Vec<Value>,
) -> Result<D1PreparedStatement> {
    let mut value = json!({
        "case_id": case_id,
        "user_id": user.id,
        "user_name": display_name(user),
        "action": action,
        "changes": changes,
        "at": db::timestamp(),
    });
    let id = db::id();
    records::identity(&mut value, ws, &id);
    records::insert_statement(db, KIND, &value, Some(case_id))
}

pub async fn list(env: &Env, ws: &str, case_id: &str) -> Result<Vec<Value>> {
    let rows: Vec<documents::Document> = db::all(
        &env.d1("DB")?,
        "SELECT payload FROM documents WHERE workspace_id=? AND kind=? AND parent_id=? ORDER BY created_at DESC,id LIMIT 50",
        &[ws.into(), KIND.into(), case_id.into()],
    )
    .await?;
    rows.into_iter()
        .map(|r| serde_json::from_str(&r.payload).map_err(Into::into))
        .collect()
}
