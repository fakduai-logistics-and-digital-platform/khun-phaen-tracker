use crate::{db, documents::Document, http};
use serde_json::{json, Value};
use worker::*;
pub async fn counts(env: &Env, workspace: &str, kind: &str) -> Result<Response> {
    // Count from the task side once, instead of rescanning every task for each project or assignee.
    let counts = if kind == "projects" {
        "SELECT json_extract(t.payload,'$.project') k,COUNT(*) n FROM documents t WHERE t.workspace_id=? AND t.kind='tasks' GROUP BY k"
    } else {
        "SELECT ids.value k,COUNT(DISTINCT t.id) n FROM documents t,json_each(json_extract(t.payload,'$.assignee_ids')) ids WHERE t.workspace_id=? AND t.kind='tasks' GROUP BY k"
    };
    let key = if kind == "projects" {
        "json_extract(m.payload,'$.name')"
    } else {
        "m.id"
    };
    let rows:Vec<Value>=db::all(&env.d1("DB")?,&format!("SELECT m.id,COALESCE(c.n,0) taskCount FROM documents m LEFT JOIN ({counts}) c ON c.k={key} WHERE m.workspace_id=? AND m.kind=? ORDER BY m.id"),&[workspace.into(),workspace.into(),kind.into()]).await?;
    http::ok(json!({"success":true,"stats":rows}))
}
pub async fn daily(env: &Env, workspace: &str) -> Result<Response> {
    let cutoff = chrono::DateTime::from_timestamp(db::now() - 86400, 0)
        .map(|d| d.to_rfc3339())
        .unwrap_or_default();
    let rows:Vec<Document>=db::all(&env.d1("DB")?,"SELECT payload FROM documents WHERE workspace_id=? AND kind='tasks' AND COALESCE(json_extract(payload,'$.is_archived'),0)=0 AND (json_extract(payload,'$.status')<>'done' OR json_extract(payload,'$.updated_at')>=?) ORDER BY json_extract(payload,'$.status'),json_extract(payload,'$.updated_at') DESC",&[workspace.into(),cutoff.into()]).await?;
    let tasks = rows
        .into_iter()
        .map(|r| serde_json::from_str::<Value>(&r.payload))
        .collect::<std::result::Result<Vec<_>, _>>()?;
    http::ok(json!({"success":true,"tasks":tasks}))
}

pub async fn archive(
    _req: &Request,
    env: &Env,
    user: &crate::auth::User,
    parts: &[&str],
) -> Result<Response> {
    let ws = parts[2];
    let sprint = parts[4];
    if crate::workspaces::access(env, user, ws).await?.is_none() {
        return http::error(403, "Access denied");
    }
    if crate::documents::get(env, ws, "sprints", sprint)
        .await?
        .is_none()
    {
        return http::error(404, "Sprint not found");
    }
    let result=db::statement(&env.d1("DB")?,"UPDATE documents SET payload=json_set(payload,'$.is_archived',json('true'),'$.updated_at',?),updated_at=? WHERE workspace_id=? AND kind='tasks' AND json_extract(payload,'$.sprint_id')=? AND json_extract(payload,'$.status')='done' AND COALESCE(json_extract(payload,'$.is_archived'),0)=0",&[db::timestamp().into(),db::timestamp().into(),ws.into(),sprint.into()])?.run().await?;
    let count = result.meta()?.and_then(|m| m.changes).unwrap_or(0);
    crate::realtime::publish(env, ws, "task", "refresh", "", Value::Null).await;
    http::ok(json!({"success":true,"archived_count":count}))
}
