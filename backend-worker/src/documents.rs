use crate::{auth::User, db, http, realtime, workspaces};
use serde::Deserialize;
use serde_json::{json, Value};
use worker::*;

#[derive(Deserialize)]
pub struct Document {
    pub payload: String,
}
#[derive(Deserialize)]
struct Count {
    total: i64,
}
const TASK_FIELDS: &[&str] = &[
    "title",
    "project",
    "duration_minutes",
    "start_date",
    "date",
    "end_date",
    "due_date",
    "status",
    "priority",
    "task_type",
    "category",
    "notes",
    "assignee_ids",
    "sprint_id",
    "is_archived",
    "checklist",
    "links",
    "testcase_id",
];
pub fn fields(kind: &str) -> Option<&'static [&'static str]> {
    match kind {
        "tasks" => Some(TASK_FIELDS),
        "projects" => Some(&["name", "short_name", "repo_url"]),
        "assignees" => Some(&["name", "color", "discord_id", "user_id"]),
        "assignee-groups" => Some(&["name", "assignee_ids"]),
        "sprints" => Some(&[
            "name",
            "start_date",
            "end_date",
            "status",
            "completed_at",
            "archived_count",
        ]),
        "milestones" => Some(&["title", "description", "target_date", "is_hidden"]),
        "checklist-templates" => Some(&["name", "items", "checklist", "description"]),
        _ => None,
    }
}
pub fn clean(kind: &str, input: &Value) -> Value {
    let mut out = json!({});
    for key in fields(kind).unwrap_or(&[]) {
        if let Some(value) = input.get(*key) {
            out[*key] = value.clone();
        }
    }
    out
}
pub fn entity(kind: &str) -> &str {
    match kind {
        "tasks" => "task",
        "projects" => "project",
        "assignees" => "assignee",
        "sprints" => "sprint",
        "assignee-groups" => "group",
        "checklist-templates" => "template",
        "milestones" => "milestone",
        _ => kind,
    }
}
pub async fn get(env: &Env, workspace: &str, kind: &str, id: &str) -> Result<Option<Value>> {
    let row: Option<Document> = db::first(
        &env.d1("DB")?,
        "SELECT payload FROM documents WHERE id=? AND workspace_id=? AND kind=?",
        &[id.into(), workspace.into(), kind.into()],
    )
    .await?;
    row.map(|r| serde_json::from_str(&r.payload).map_err(Into::into))
        .transpose()
}
pub async fn handle(req: &mut Request, env: &Env, user: &User, parts: &[&str]) -> Result<Response> {
    let Some(w) = workspaces::access(env, user, parts[2]).await? else {
        return http::error(403, "Access denied");
    };
    let kind = parts[3];
    let Some(_) = fields(kind) else {
        return http::error(404, "Unknown collection");
    };
    let db = env.d1("DB")?;
    let method = req.method();
    let item = parts.get(4).copied();
    if method == Method::Get && item == Some("stats") && matches!(kind, "projects" | "assignees") {
        return crate::statistics::counts(env, &w.id, kind).await;
    }
    if method == Method::Get && item == Some("next-number") && kind == "tasks" {
        let count:Option<Count>=db::first(&db,"SELECT COALESCE((SELECT value FROM counters WHERE workspace_id=? AND kind='tasks'),0)+1 AS total",&[w.id.clone().into()]).await?;
        return http::ok(
            json!({"success":true,"next_task_number":count.map(|v|v.total).unwrap_or(1)}),
        );
    }
    if method == Method::Get && kind == "tasks" && (item.is_none() || item == Some("stats")) {
        return crate::task_query::list(req, env, Some(&w.id), user).await;
    }
    if method == Method::Get && item.is_none() {
        if kind == "assignees" && w.owner_id == user.id {
            ensure_owner_assignee(env, &w.id, user).await?;
        }
        return list(env, &w.id, kind).await;
    }
    if method == Method::Get {
        return match get(env, &w.id, kind, item.unwrap_or_default()).await? {
            Some(value) => {
                let mut output = json!({"success":true});
                output[entity(kind)] = value;
                http::ok(output)
            }
            None => http::error(404, "Record not found"),
        };
    }
    if method == Method::Delete {
        let id = item.unwrap_or_default();
        let Some(old) = get(env, &w.id, kind, id).await? else {
            return http::error(404, "Record not found");
        };
        if kind == "assignees" && !old["user_id"].is_null() && !w.managed_by(user) {
            return http::error(
                403,
                "Only the owner or an admin may remove linked workspace members",
            );
        }
        crate::cascades::delete(env, &w.id, kind, id, &old).await?;
        realtime::publish(env, &w.id, entity(kind), "delete", id, Value::Null).await;
        return http::ok(json!({"success":true}));
    }
    if !matches!(method, Method::Post | Method::Put | Method::Patch) {
        return http::error(405, "Method not allowed");
    }
    let input = http::body(req).await?;
    let creating = method == Method::Post && item.is_none();
    if method == Method::Post && !creating {
        return http::error(404, "Not found");
    }
    let id = if creating {
        db::id()
    } else {
        item.unwrap_or_default().to_owned()
    };
    let mut value = if creating {
        match kind {
            "tasks" => {
                json!({"project":"","duration_minutes":0,"status":"todo","priority":"none","category":"อื่นๆ","notes":"","is_archived":false,"assignee_ids":[],"attachments":[]})
            }
            "sprints" => json!({"status":"planned"}),
            "assignees" => json!({"color":"#6366F1"}),
            _ => json!({}),
        }
    } else {
        let Some(value) = get(env, &w.id, kind, &id).await? else {
            return http::error(404, "Record not found");
        };
        value
    };
    let old_status = http::text(&value, "status").to_owned();
    let old_user = http::text(&value, "user_id").to_owned();
    let old_name = value
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned();
    let patch = clean(kind, &input);
    for (key, val) in patch.as_object().into_iter().flatten() {
        value[key] = val.clone();
    }
    let name = if kind == "tasks" || kind == "milestones" {
        "title"
    } else {
        "name"
    };
    if http::text(&value, name).trim().is_empty() {
        return http::error(400, "Title or name required");
    }
    if kind == "tasks" {
        let start = value
            .get("start_date")
            .filter(|v| !v.is_null())
            .or(value.get("date"))
            .cloned();
        if creating
            && start
                .as_ref()
                .and_then(Value::as_str)
                .unwrap_or("")
                .is_empty()
        {
            return http::error(400, "start_date required");
        }
        if let Some(start) = start {
            value["start_date"] = start.clone();
            value["date"] = start;
        }
        if input.get("due_date").is_some() {
            value["end_date"] = input["due_date"].clone();
        } else if input.get("end_date").is_some() {
            value["due_date"] = input["end_date"].clone();
        }
        if creating {
            let number:Option<Count>=db::first(&db,"INSERT INTO counters(workspace_id,kind,value) VALUES(?,'tasks',1) ON CONFLICT(workspace_id,kind) DO UPDATE SET value=value+1 RETURNING value AS total",&[w.id.clone().into()]).await?;
            value["task_number"] = json!(
                number
                    .ok_or_else(|| Error::RustError("Task number allocation failed".into()))?
                    .total
            );
        }
    }
    // Assignment creates workspace access, so only the owner can change linked users.
    if kind == "assignees"
        && input.get("user_id").is_some()
        && http::text(&input, "user_id") != old_user
        && !w.managed_by(user)
    {
        return http::error(
            403,
            "Only the workspace owner or an admin may change linked users",
        );
    }
    if kind == "assignees" {
        if let Some(linked) = value["user_id"].as_str().filter(|s| !s.is_empty()) {
            let found: Option<Count> = db::first(
                &db,
                "SELECT COUNT(*) AS total FROM users WHERE id=? AND is_active=1",
                &[linked.into()],
            )
            .await?;
            if found.is_none_or(|v| v.total != 1) {
                return http::error(400, "Unknown linked user");
            }
        }
    }
    if kind == "tasks" {
        if let Some(error) = crate::cascades::validate_task(env, &w.id, &value).await? {
            return http::error(400, error);
        }
    }
    value["id"] = json!(id);
    value["_id"] = json!(id);
    value["workspace_id"] = json!(w.id);
    value["updated_at"] = json!(db::timestamp());
    if creating {
        value["created_at"] = json!(db::timestamp());
    }
    let write = if creating {
        crate::records::insert_statement(&db, kind, &value, None)?
    } else {
        let mut patch = clean(kind, &input);
        if kind == "tasks" {
            if input.get("start_date").is_some() || input.get("date").is_some() {
                patch["start_date"] = value["start_date"].clone();
                patch["date"] = value["date"].clone();
            }
            if input.get("due_date").is_some() || input.get("end_date").is_some() {
                patch["due_date"] = value["due_date"].clone();
                patch["end_date"] = value["end_date"].clone();
            }
        }
        patch["updated_at"] = value["updated_at"].clone();
        crate::records::patch_statement(&db, &w.id, kind, &id, &patch)?
    };
    let mut writes = vec![write];
    if kind == "projects"
        && !creating
        && input.get("name").is_some()
        && old_name != http::text(&value, "name")
    {
        writes.push(db::statement(&db,"UPDATE documents SET payload=json_set(payload,'$.project',?,'$.updated_at',?),updated_at=? WHERE workspace_id=? AND kind='tasks' AND json_extract(payload,'$.project')=?",&[http::text(&value,"name").into(),db::timestamp().into(),db::timestamp().into(),w.id.clone().into(),old_name.into()])?);
    }
    let plan = if kind == "tasks" && (creating || input.get("assignee_ids").is_some()) {
        crate::notifications::plan(env, user, &value, kind).await?
    } else {
        crate::notifications::Plan::default()
    };
    writes.extend(plan.statements);
    if kind == "tasks" {
        if let Some(job) =
            crate::schedules::task_event(env, &db, &w, &value, creating, &old_status)?
        {
            writes.push(job)
        }
    }
    db.batch(writes).await?;
    value = get(env, &w.id, kind, &id)
        .await?
        .ok_or_else(|| Error::RustError("Record disappeared".into()))?;
    crate::notifications::deliver(env, &plan.recipients).await;
    realtime::publish(
        env,
        &w.id,
        entity(kind),
        if creating { "create" } else { "update" },
        &id,
        value.clone(),
    )
    .await;
    let mut output = json!({"success":true});
    if kind == "milestones" {
        return http::ok(value);
    }
    output[entity(kind)] = value;
    http::ok(output)
}
pub(crate) async fn ensure_owner_assignee(env: &Env, workspace: &str, user: &User) -> Result<()> {
    let db = env.d1("DB")?;
    let found: Option<Count> = db::first(
        &db,
        "SELECT COUNT(*) AS total FROM documents WHERE workspace_id=? AND kind='assignees' AND json_extract(payload,'$.user_id')=?",
        &[workspace.into(), user.id.clone().into()],
    )
    .await?;
    if found.is_some_and(|v| v.total > 0) {
        return Ok(());
    }
    let profile = serde_json::from_str::<Value>(&user.profile).unwrap_or(json!({}));
    let name = ["nickname", "first_name"]
        .iter()
        .filter_map(|k| profile[*k].as_str().map(str::trim))
        .find(|s| !s.is_empty())
        .map(str::to_owned)
        .unwrap_or_else(|| user.email.split('@').next().unwrap_or("Owner").to_owned());
    let mut value = json!({"name":name,"color":"#6366F1","user_id":user.id});
    crate::records::identity(&mut value, workspace, &db::id());
    let id = http::text(&value, "id");
    value["id"] = json!(id);
    crate::records::insert_statement(&db, "assignees", &value, None)?
        .run()
        .await?;
    Ok(())
}
async fn list(env: &Env, workspace: &str, kind: &str) -> Result<Response> {
    let values = crate::records::values(env, workspace, kind).await?;
    if kind == "milestones" {
        return http::ok(json!(values));
    }
    let mut output = json!({"success":true});
    output[match kind {
        "assignee-groups" => "groups",
        "checklist-templates" => "templates",
        _ => kind,
    }] = json!(values);
    http::ok(output)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn writes_cannot_override_ownership_or_ids() {
        let input = json!({"id":"forged","workspace_id":"other","task_number":1,"title":"kept","attachments":[{"file_key":"other"}]});
        assert_eq!(clean("tasks", &input), json!({"title":"kept"}));
    }
    #[test]
    fn explicit_null_is_retained() {
        assert_eq!(
            clean("tasks", &json!({"sprint_id":null})),
            json!({"sprint_id":null})
        );
    }
}
