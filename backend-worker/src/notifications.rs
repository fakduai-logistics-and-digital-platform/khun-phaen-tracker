//! Assignment notifications are created from committed domain data, never client-supplied recipients.
use crate::{auth::User, db, http, realtime, records, workspaces};
use serde::Deserialize;
use serde_json::{json, Value};
use worker::*;
#[derive(Default)]
pub struct Plan {
    pub statements: Vec<D1PreparedStatement>,
    pub recipients: Vec<String>,
}
pub async fn plan(env: &Env, actor: &User, value: &Value, kind: &str) -> Result<Plan> {
    if !matches!(kind, "tasks" | "test-cases") {
        return Ok(Plan::default());
    }
    let workspace = http::text(value, "workspace_id");
    let id = http::text(value, "id");
    let ids: Vec<String> = if kind == "tasks" {
        value["assignee_ids"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
            .map(str::to_owned)
            .collect()
    } else {
        ["assign_dev", "assign_tester"]
            .iter()
            .filter_map(|key| value[*key].as_str())
            .filter(|s| !s.is_empty() && *s != "unassigned")
            .map(str::to_owned)
            .collect()
    };
    let db = env.d1("DB")?;
    #[derive(Deserialize)]
    struct Recipient {
        user_id: String,
    }
    let recipients:Vec<Recipient>=db::all(&db,"SELECT DISTINCT u.id user_id FROM documents a JOIN users u ON u.id=json_extract(a.payload,'$.user_id') AND u.is_active=1 WHERE a.workspace_id=? AND a.kind='assignees' AND a.id IN(SELECT value FROM json_each(?))",&[workspace.into(),json!(ids).to_string().into()]).await?;
    let active = recipients
        .into_iter()
        .map(|r| r.user_id)
        .collect::<Vec<_>>();
    let existing: Vec<Recipient> = db::all(
        &db,
        "SELECT user_id FROM assignment_deliveries WHERE document_id=?",
        &[id.into()],
    )
    .await?;
    let mut plan = Plan::default();
    plan.statements.push(db::statement(&db,"DELETE FROM assignment_deliveries WHERE document_id=? AND user_id NOT IN(SELECT value FROM json_each(?))",&[id.into(),json!(active).to_string().into()])?);
    for user in &active {
        if existing.iter().any(|r| r.user_id == *user) {
            continue;
        }
        if *user != actor.id {
            let notification_id = db::id();
            let meta = json!({"id":notification_id,"source_type":if kind=="tasks"{"task"}else{"test_case"},"source_id":id,"source_title":if kind=="tasks"{&value["title"]}else{&value["name"]},"workspace_id":workspace,"suite_id":value.get("suite_id"),"assignment_ids":ids,"recipient_user_ids":active,"actor_user_id":actor.id,"actor_name":records::display_name(actor),"created_at":value["updated_at"]});
            plan.statements.push(db::statement(&db,"INSERT INTO notifications(id,recipient_user_id,workspace_id,payload,created_at) SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM assignment_deliveries WHERE document_id=? AND user_id=?)",&[notification_id.into(),user.clone().into(),workspace.into(),meta.to_string().into(),http::text(value,"updated_at").into(),id.into(),user.clone().into()])?);
            plan.recipients.push(user.clone());
        }
        plan.statements.push(db::statement(
            &db,
            "INSERT OR IGNORE INTO assignment_deliveries(document_id,user_id) VALUES(?,?)",
            &[id.into(), user.clone().into()],
        )?);
    }
    Ok(plan)
}
/// Notifications for people tagged with `@Name` in a comment. Recipients are never taken from the client: the
/// text is matched against the workspace's assignees, and only active linked users are notified, once per comment.
pub async fn mention_plan(
    env: &Env,
    actor: &User,
    workspace: &str,
    task: &Value,
    comment_id: &str,
    content: &str,
) -> Result<Plan> {
    let mut named: Vec<(String, String)> = records::values(env, workspace, "assignees")
        .await?
        .iter()
        .filter_map(|a| {
            let user = a["user_id"].as_str().filter(|s| !s.is_empty())?;
            let name = a["name"].as_str().map(str::trim).filter(|s| !s.is_empty())?;
            Some((name.to_lowercase(), user.to_owned()))
        })
        .collect();
    // Longest names first, and matched text is removed, so "@Big Boss" is not also read as "@Big".
    named.sort_by_key(|(name, _)| std::cmp::Reverse(name.chars().count()));
    let mut rest = content.to_lowercase();
    let mut tagged: Vec<String> = Vec::new();
    for (name, user) in &named {
        let tag = format!("@{name}");
        if rest.contains(&tag) {
            rest = rest.replace(&tag, "");
            if *user != actor.id && !tagged.contains(user) {
                tagged.push(user.clone());
            }
        }
    }
    let mut plan = Plan::default();
    if tagged.is_empty() {
        return Ok(plan);
    }
    let db = env.d1("DB")?;
    #[derive(Deserialize)]
    struct Recipient {
        user_id: String,
    }
    let active: Vec<Recipient> = db::all(
        &db,
        "SELECT id user_id FROM users WHERE is_active=1 AND id IN(SELECT value FROM json_each(?))",
        &[json!(tagged).to_string().into()],
    )
    .await?;
    let already: Vec<Recipient> = db::all(
        &db,
        "SELECT recipient_user_id user_id FROM notifications WHERE json_extract(payload,'$.comment_id')=?",
        &[comment_id.into()],
    )
    .await?;
    let now = db::timestamp();
    let excerpt: String = content.trim().chars().take(140).collect();
    for recipient in active {
        if already.iter().any(|r| r.user_id == recipient.user_id) {
            continue;
        }
        let id = db::id();
        let meta = json!({"id":id,"kind":"mention","comment_id":comment_id,"excerpt":excerpt,"source_type":"task","source_id":http::text(task,"id"),"source_title":task["title"],"workspace_id":workspace,"assignment_ids":[],"recipient_user_ids":[&recipient.user_id],"actor_user_id":actor.id,"actor_name":records::display_name(actor),"created_at":now});
        plan.statements.push(db::statement(
            &db,
            "INSERT INTO notifications(id,recipient_user_id,workspace_id,payload,created_at) VALUES(?,?,?,?,?)",
            &[id.into(), recipient.user_id.clone().into(), workspace.into(), meta.to_string().into(), now.clone().into()],
        )?);
        plan.recipients.push(recipient.user_id);
    }
    Ok(plan)
}
pub async fn deliver(env: &Env, users: &[String]) {
    for user in users {
        realtime::publish_user(
            env,
            user,
            json!({"entity":"notification","action":"refresh","timestamp":Date::now().as_millis()}),
        )
        .await;
    }
}
const ACCESS:&str="EXISTS(SELECT 1 FROM workspaces w WHERE w.id=n.workspace_id AND (w.owner_id=n.recipient_user_id OR EXISTS(SELECT 1 FROM workspace_members m WHERE m.workspace_id=w.id AND m.user_id=n.recipient_user_id) OR EXISTS(SELECT 1 FROM documents a WHERE a.workspace_id=w.id AND a.kind='assignees' AND json_extract(a.payload,'$.user_id')=n.recipient_user_id)))";
pub async fn handle(req: &mut Request, env: &Env, user: &User, parts: &[&str]) -> Result<Response> {
    let db = env.d1("DB")?;
    if parts.len() == 2 && req.method() == Method::Get {
        #[derive(Deserialize)]
        struct Item {
            payload: String,
            read_at: Option<String>,
        }
        let rows:Vec<Item>=db::all(&db,&format!("SELECT n.payload,n.read_at FROM notifications n WHERE n.recipient_user_id=? AND {ACCESS} ORDER BY n.created_at DESC,n.id DESC LIMIT 100"),&[user.id.clone().into()]).await?;
        let mut values = Vec::new();
        for row in rows {
            let mut value: Value = serde_json::from_str(&row.payload)?;
            value["read_at"] = json!(row.read_at);
            values.push(value);
        }
        return http::ok(json!({"success":true,"notifications":values}));
    }
    if parts.len() == 2 && req.method() == Method::Post {
        let input = http::body(req).await?;
        let kind = match http::text(&input, "source_type") {
            "task" => "tasks",
            "test_case" => "test-cases",
            _ => return http::error(400, "Invalid notification source"),
        };
        let Some(row) = records::locate(env, kind, http::text(&input, "source_id")).await? else {
            return http::error(404, "Source not found");
        };
        if workspaces::access(env, user, &row.workspace_id)
            .await?
            .is_none()
        {
            return http::error(403, "Access denied");
        }
        let plan = plan(env, user, &row.value()?, kind).await?;
        if !plan.statements.is_empty() {
            db.batch(plan.statements).await?;
        }
        deliver(env, &plan.recipients).await;
        return http::ok(json!({"success":true}));
    }
    let id = parts.get(2).copied().unwrap_or_default();
    if id == "read-all" && req.method() == Method::Post {
        db::run(&db,&format!("UPDATE notifications AS n SET read_at=COALESCE(read_at,?) WHERE n.recipient_user_id=? AND {ACCESS}"),&[db::timestamp().into(),user.id.clone().into()]).await?;
    } else {
        let owned:Option<Value>=db::first(&db,&format!("SELECT n.id FROM notifications n WHERE n.id=? AND n.recipient_user_id=? AND {ACCESS}"),&[id.into(),user.id.clone().into()]).await?;
        if owned.is_none() {
            return http::error(404, "Notification not found");
        }
        if req.method() == Method::Delete && parts.len() == 3 {
            db::run(
                &db,
                "DELETE FROM notifications WHERE id=? AND recipient_user_id=?",
                &[id.into(), user.id.clone().into()],
            )
            .await?;
        } else if req.method() == Method::Patch && parts.get(3) == Some(&"read") {
            db::run(&db,"UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND recipient_user_id=?",&[db::timestamp().into(),id.into(),user.id.clone().into()]).await?;
        } else {
            return http::error(405, "Method not allowed");
        }
    }
    deliver(env, &[user.id.clone()]).await;
    http::ok(json!({"success":true}))
}
