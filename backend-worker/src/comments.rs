use crate::{auth::User, cascades, db, documents, http, realtime, records, uploads, workspaces};
use serde_json::{json, Value};
use worker::*;
const EMOJI: &[&str] = &["👍", "❤️", "🔥", "🎉", "😂", "😮", "😢", "👀", "✅", "🚀"];
pub async fn handle(req: &mut Request, env: &Env, user: &User, parts: &[&str]) -> Result<Response> {
    let ws = parts[2];
    let task = parts[4];
    if workspaces::access(env, user, ws).await?.is_none() {
        return http::error(403, "Access denied");
    }
    let Some(task_doc) = documents::get(env, ws, "tasks", task).await? else {
        return http::error(404, "Task not found");
    };
    let db = env.d1("DB")?;
    let id = parts.get(6).copied();
    if parts.len() == 6 && req.method() == Method::Get {
        let q = records::query(req)?;
        let (page, limit) = records::page(&q, 10, 100);
        let rows:Vec<documents::Document>=db::all(&db,"SELECT json_set(d.payload,'$.created_by_name',COALESCE(NULLIF(json_extract(u.profile,'$.nickname'),''),NULLIF(trim(COALESCE(json_extract(u.profile,'$.first_name'),'')||' '||COALESCE(json_extract(u.profile,'$.last_name'),'')),''),substr(u.email,1,instr(u.email,'@')-1),'User')) payload FROM documents d LEFT JOIN users u ON u.id=json_extract(d.payload,'$.created_by') WHERE d.workspace_id=? AND d.kind='comments' AND d.parent_id=? ORDER BY d.created_at DESC,d.id DESC LIMIT ? OFFSET ?",&[ws.into(),task.into(),limit.into(),((page-1)*limit).into()]).await?;
        let count:Option<Value>=db::first(&db,"SELECT COUNT(*) total FROM documents WHERE workspace_id=? AND kind='comments' AND parent_id=?",&[ws.into(),task.into()]).await?;
        let total = count.and_then(|c| c["total"].as_i64()).unwrap_or(0);
        let comments = rows
            .into_iter()
            .map(|r| serde_json::from_str::<Value>(&r.payload))
            .collect::<std::result::Result<Vec<_>, _>>()?;
        return http::ok(
            json!({"success":true,"comments":comments,"total":total,"page":page,"limit":limit,"pages":(total+limit-1)/limit}),
        );
    }
    if parts.len() == 6 && req.method() == Method::Post {
        let id = db::id();
        let uploaded = uploads::read(
            req,
            env,
            user,
            &format!("{ws}/{task}/comments/{id}"),
            &["images", "images[]"],
            true,
        )
        .await?;
        let content = uploaded
            .fields
            .get("content")
            .map(|s| s.trim())
            .unwrap_or_default();
        if content.is_empty() && uploaded.files.is_empty() {
            return http::error(400, "Comment text or image required");
        }
        let mut value = json!({"content":content,"images":uploaded.files,"reactions":[],"task_id":task,"created_by":user.id,"created_by_name":records::display_name(user)});
        records::identity(&mut value, ws, &id);
        let mut statements = vec![records::insert_statement(
            &db,
            "comments",
            &value,
            Some(task),
        )?];
        statements.extend(uploads::registration(&db, ws, &id, &uploaded.files)?);
        let mentions = crate::notifications::mention_plan(env, user, ws, &task_doc, &id, content).await?;
        statements.extend(mentions.statements);
        if let Err(error) = db.batch(statements).await {
            uploads::cleanup(env, &uploaded.files).await;
            return Err(error);
        }
        realtime::publish(env, ws, "comment", "create", &id, value.clone()).await;
        crate::notifications::deliver(env, &mentions.recipients).await;
        return http::ok(json!({"success":true,"comment":value}));
    }
    let id = id.unwrap_or_default();
    let Some(row) = records::locate(env, "comments", id).await? else {
        return http::error(404, "Comment not found");
    };
    if row.workspace_id != ws || row.parent_id.as_deref() != Some(task) {
        return http::error(404, "Comment not found in this task");
    }
    let mut value = row.value()?;
    if parts.get(7) == Some(&"images") && req.method() == Method::Get {
        let q = records::query(req)?;
        let (page, limit) = records::page(&q, 6, 100);
        let images = value["images"].as_array().cloned().unwrap_or_default();
        let total = images.len() as i64;
        let slice = images
            .into_iter()
            .skip(((page - 1) * limit) as usize)
            .take(limit as usize)
            .collect::<Vec<_>>();
        return http::ok(
            json!({"success":true,"images":slice,"total":total,"page":page,"limit":limit,"pages":(total+limit-1)/limit}),
        );
    }
    if req.method() == Method::Delete && parts.len() == 7 {
        cascades::delete(env, ws, "comments", id, &value).await?;
        realtime::publish(env, ws, "comment", "delete", id, Value::Null).await;
        return http::ok(json!({"success":true}));
    }
    let input = http::body(req).await?;
    if req.method() == Method::Put && parts.len() == 7 {
        let Some(content) = input["content"].as_str() else {
            return http::error(400, "Comment content required");
        };
        if content.trim().is_empty() && value["images"].as_array().is_none_or(|v| v.is_empty()) {
            return http::error(400, "A comment cannot be empty");
        }
        let mut statements = vec![records::patch_statement(
            &db,
            ws,
            "comments",
            id,
            &json!({"content":content.trim(),"updated_at":db::timestamp()}),
        )?];
        // Tagging someone while editing notifies them too, but nobody is notified twice for one comment.
        let mentions = crate::notifications::mention_plan(env, user, ws, &task_doc, id, content).await?;
        statements.extend(mentions.statements);
        db.batch(statements).await?;
        crate::notifications::deliver(env, &mentions.recipients).await;
    } else if req.method() == Method::Post && parts.get(7) == Some(&"reactions") {
        let emoji = http::text(&input, "emoji");
        if !EMOJI.contains(&emoji) {
            return http::error(400, "Unsupported reaction");
        }
        let reaction = json!({"emoji":emoji,"user_id":user.id,"reacted_at":db::timestamp()});
        // Toggle against the current SQL value, not a read/modify/write snapshot.
        db::run(&db,"UPDATE documents SET payload=json_set(payload,'$.reactions',json(CASE WHEN EXISTS(SELECT 1 FROM json_each(json_extract(payload,'$.reactions')) WHERE json_extract(value,'$.emoji')=? AND json_extract(value,'$.user_id')=?) THEN COALESCE((SELECT json_group_array(json(value)) FROM json_each(json_extract(payload,'$.reactions')) WHERE NOT(json_extract(value,'$.emoji')=? AND json_extract(value,'$.user_id')=?)),'[]') ELSE json_insert(COALESCE(json_extract(payload,'$.reactions'),'[]'),'$[#]',json(?)) END),'$.updated_at',?),updated_at=? WHERE id=? AND workspace_id=? AND kind='comments'",&[emoji.into(),user.id.clone().into(),emoji.into(),user.id.clone().into(),reaction.to_string().into(),db::timestamp().into(),db::timestamp().into(),id.into(),ws.into()]).await?;
    } else {
        return http::error(405, "Method not allowed");
    }
    value = documents::get(env, ws, "comments", id)
        .await?
        .ok_or_else(|| Error::RustError("Comment disappeared".into()))?;
    realtime::publish(env, ws, "comment", "update", id, value.clone()).await;
    http::ok(json!({"success":true,"comment":value}))
}
