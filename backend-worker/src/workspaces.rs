use crate::{auth::User, db, http};
use serde::Deserialize;
use serde_json::{json, Value};
use worker::*;

#[derive(Deserialize)]
pub struct Workspace {
    pub id: String,
    pub owner_id: String,
    pub room_code: String,
    pub name: String,
    pub short_name: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub notification_config: Option<String>,
    pub created_at: String,
}
impl Workspace {
    pub fn public(&self) -> Value {
        json!({"id":self.id,"owner_id":self.owner_id,"room_code":self.room_code,"name":self.name,
            "short_name":self.short_name,"color":self.color,"icon":self.icon,"created_at":self.created_at})
    }
}
pub async fn access(env: &Env, user: &User, id: &str) -> Result<Option<Workspace>> {
    db::first(&env.d1("DB")?,"SELECT w.* FROM workspaces w WHERE (w.id=? OR w.room_code=?) AND (w.owner_id=? OR EXISTS(SELECT 1 FROM workspace_members m WHERE m.workspace_id=w.id AND m.user_id=?) OR EXISTS(SELECT 1 FROM documents d WHERE d.workspace_id=w.id AND d.kind='assignees' AND json_extract(d.payload,'$.user_id')=?))",&[id.into(),id.into(),user.id.clone().into(),user.id.clone().into(),user.id.clone().into()]).await
}
pub async fn handle(req: &mut Request, env: &Env, user: &User, parts: &[&str]) -> Result<Response> {
    let db = env.d1("DB")?;
    let method = req.method();
    if parts.len() == 2 {
        if method == Method::Get {
            let rows:Vec<Workspace>=db::all(&db,"SELECT w.* FROM workspaces w WHERE w.owner_id=? OR EXISTS(SELECT 1 FROM workspace_members m WHERE m.workspace_id=w.id AND m.user_id=?) OR EXISTS(SELECT 1 FROM documents d WHERE d.workspace_id=w.id AND d.kind='assignees' AND json_extract(d.payload,'$.user_id')=?) ORDER BY w.created_at DESC",&[user.id.clone().into(),user.id.clone().into(),user.id.clone().into()]).await?;
            return http::ok(
                json!({"success":true,"workspaces":rows.iter().map(Workspace::public).collect::<Vec<_>>()}),
            );
        }
        if method == Method::Post {
            let body = http::body(req).await?;
            let name = http::text(&body, "name").trim();
            if name.is_empty() || name.len() > 200 {
                return http::error(400, "Workspace name required (max 200 bytes)");
            }
            let id = db::id();
            let room = db::id();
            let now = db::timestamp();
            db::run(&db,"INSERT INTO workspaces(id,owner_id,room_code,name,short_name,color,icon,created_at) VALUES(?,?,?,?,?,?,?,?)",&[id.clone().into(),user.id.clone().into(),room.into(),name.into(),body["short_name"].as_str().map(str::to_owned).into(),body["color"].as_str().map(str::to_owned).into(),body["icon"].as_str().map(str::to_owned).into(),now.into()]).await?;
            let w = access(env, user, &id)
                .await?
                .ok_or_else(|| Error::RustError("Workspace create failed".into()))?;
            return http::ok(json!({"success":true,"workspace":w.public()}));
        }
    }
    if parts.get(2) == Some(&"access") {
        let Some(w) = access(env, user, parts.get(3).copied().unwrap_or_default()).await? else {
            return http::error(403, "Access denied");
        };
        return http::ok(json!({"success":true,"has_access":true,"workspace":w.public()}));
    }
    if parts.get(2) == Some(&"stats") {
        let rows:Vec<Value>=db::all(&db,"SELECT w.id,COUNT(d.id) AS count FROM workspaces w LEFT JOIN documents d ON d.workspace_id=w.id AND d.kind='tasks' WHERE w.owner_id=? OR EXISTS(SELECT 1 FROM documents a WHERE a.workspace_id=w.id AND a.kind='assignees' AND json_extract(a.payload,'$.user_id')=?) GROUP BY w.id",&[user.id.clone().into(),user.id.clone().into()]).await?;
        let mut counts = serde_json::Map::new();
        for row in rows {
            if let Some(id) = row["id"].as_str() {
                counts.insert(id.into(), row["count"].clone());
            }
        }
        let mine: Option<Value> = db::first(
            &db,
            &format!(
                "SELECT COUNT(*) total FROM documents d WHERE {}",
                crate::task_query::MY_TASKS
            ),
            &[user.id.clone().into()],
        )
        .await?;
        counts.insert(
            "__my_tasks__".into(),
            mine.map(|m| m["total"].clone()).unwrap_or(json!(0)),
        );
        return http::ok(json!({"success":true,"task_counts":counts}));
    }
    let Some(w) = access(env, user, parts.get(2).copied().unwrap_or_default()).await? else {
        return http::error(403, "Access denied");
    };
    if parts.get(3) == Some(&"daily-report") && method == Method::Get {
        return crate::statistics::daily(env, &w.id).await;
    }
    if w.owner_id != user.id {
        return http::error(403, "Workspace owner required");
    }
    if parts.len() == 3 && method == Method::Delete {
        db.batch(vec![db::statement(&db,"INSERT OR IGNORE INTO storage_delete_jobs(file_key) SELECT file_key FROM stored_objects WHERE workspace_id=?",&[w.id.clone().into()])?,db::statement(&db,"DELETE FROM workspaces WHERE id=? AND owner_id=?",&[w.id.into(),user.id.clone().into()])?]).await?;
        return http::ok(json!({"success":true}));
    }
    if parts.len() == 3 && method == Method::Put {
        let body = http::body(req).await?;
        let name = http::text(&body, "name").trim();
        if name.is_empty() {
            return http::error(400, "Workspace name required");
        }
        db::run(
            &db,
            "UPDATE workspaces SET name=?,short_name=?,color=?,icon=? WHERE id=? AND owner_id=?",
            &[
                name.into(),
                body["short_name"].as_str().map(str::to_owned).into(),
                body["color"].as_str().map(str::to_owned).into(),
                body["icon"].as_str().map(str::to_owned).into(),
                w.id.into(),
                user.id.clone().into(),
            ],
        )
        .await?;
        return http::ok(json!({"success":true}));
    }
    if parts.get(3) == Some(&"notifications") {
        return crate::schedules::configure(req, env, &w).await;
    }
    http::error(404, "Not found")
}
