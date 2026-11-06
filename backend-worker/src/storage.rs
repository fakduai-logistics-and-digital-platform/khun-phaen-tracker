use crate::{auth::User, db, documents, http, realtime, records, s3_client, uploads, workspaces};
use serde_json::{json, Value};
use worker::*;
pub async fn attachments(
    req: &mut Request,
    env: &Env,
    user: &User,
    parts: &[&str],
) -> Result<Response> {
    let ws = parts[2];
    let kind = parts[3];
    let id = parts[4];
    if workspaces::access(env, user, ws).await?.is_none() {
        return http::error(403, "Access denied");
    }
    let Some(record) = documents::get(env, ws, kind, id).await? else {
        return http::error(404, "Record not found");
    };
    if kind == "test-cases" && !records::qa(user) {
        return http::error(403, "Admin or QA permissions required");
    }
    let db = env.d1("DB")?;
    if req.method() == Method::Post && parts.len() == 6 {
        let prefix = if kind == "tasks" {
            format!("{ws}/{id}")
        } else {
            format!("{ws}/test-cases/{id}")
        };
        let uploaded = uploads::read(
            req,
            env,
            user,
            &prefix,
            &["files", "file", "attachments"],
            false,
        )
        .await?;
        if uploaded.files.is_empty() {
            return http::error(400, "No files received");
        }
        let mut statements = uploads::registration(&db, ws, id, &uploaded.files)?;
        for file in &uploaded.files {
            statements.push(db::statement(&db,"UPDATE documents SET payload=json_set(payload,'$.attachments',json_insert(COALESCE(json_extract(payload,'$.attachments'),'[]'),'$[#]',json(?)),'$.updated_at',?),updated_at=? WHERE id=? AND workspace_id=? AND kind=?",&[file.to_string().into(),db::timestamp().into(),db::timestamp().into(),id.into(),ws.into(),kind.into()])?);
        }
        if let Err(error) = db.batch(statements).await {
            uploads::cleanup(env, &uploaded.files).await;
            return Err(error);
        }
        realtime::publish(
            env,
            ws,
            if kind == "tasks" { "task" } else { "test_case" },
            "refresh",
            id,
            Value::Null,
        )
        .await;
        return http::ok(json!({"success":true,"attachments":uploaded.files}));
    }
    if req.method() == Method::Delete && parts.len() == 7 {
        let files = record["attachments"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        let Some(file) = files.iter().find(|f| http::text(f, "id") == parts[6]) else {
            return http::error(404, "Attachment not found");
        };
        let key = http::text(file, "file_key");
        db.batch(vec![db::statement(&db,"INSERT OR IGNORE INTO storage_delete_jobs(file_key) VALUES(?)",&[key.into()])?,db::statement(&db,"DELETE FROM stored_objects WHERE file_key=? AND document_id=? AND workspace_id=?",&[key.into(),id.into(),ws.into()])?,db::statement(&db,"UPDATE documents SET payload=json_set(payload,'$.attachments',json(COALESCE((SELECT json_group_array(json(value)) FROM json_each(json_extract(payload,'$.attachments')) WHERE json_extract(value,'$.id')<>?),'[]'))) WHERE id=? AND workspace_id=? AND kind=?",&[parts[6].into(),id.into(),ws.into(),kind.into()])?]).await?;
        uploads::cleanup(env, &[file.clone()]).await;
        realtime::publish(
            env,
            ws,
            if kind == "tasks" { "task" } else { "test_case" },
            "refresh",
            id,
            Value::Null,
        )
        .await;
        return http::ok(json!({"success":true}));
    }
    http::error(405, "Method not allowed")
}
pub async fn download(env: &Env, user: &User, key: &str) -> Result<Response> {
    #[derive(serde::Deserialize)]
    struct Object {
        workspace_id: String,
    }
    let object:Option<Object>=db::first(&env.d1("DB")?,"SELECT o.workspace_id FROM stored_objects o JOIN documents d ON d.id=o.document_id WHERE o.file_key=?",&[key.into()]).await?;
    let Some(object) = object else {
        return http::error(404, "File not found");
    };
    if workspaces::access(env, user, &object.workspace_id)
        .await?
        .is_none()
    {
        return http::error(403, "Access denied");
    }
    let response = s3_client::request(env, Method::Get, key, None, "").await?;
    if response.status_code() != 200 {
        return http::error(502, "RustFS download failed");
    }
    let headers = Headers::new();
    for (k, v) in response.headers().entries() {
        headers.set(&k, &v)?;
    }
    headers.set("X-Content-Type-Options", "nosniff")?;
    headers.set("Content-Disposition", "attachment")?;
    Ok(response.with_headers(headers))
}
#[durable_object]
pub struct RustFsService {
    env: Env,
}
impl DurableObject for RustFsService {
    fn new(_state: State, env: Env) -> Self {
        Self { env }
    }
    async fn fetch(&self, req: Request) -> Result<Response> {
        match self.handle(req).await {
            Ok(response) => Ok(response),
            Err(error) => http::failure(error),
        }
    }
}
impl RustFsService {
    async fn handle(&self, mut req: Request) -> Result<Response> {
        let path = req.path();
        if req.method() == Method::Get {
            if let Some(key) = path.strip_prefix("/api/files/") {
                let query = crate::records::query(&req)?;
                if let (Some(exp), Some(sig)) = (query.get("exp"), query.get("sig")) {
                    if !crate::file_urls::verify(&self.env, key, exp, sig)? {
                        return http::error(403, "Invalid or expired file link");
                    }
                    return crate::file_urls::serve(&self.env, key, &query).await;
                }
            }
        }
        let Some(user) = crate::auth::authenticate(&req, &self.env).await? else {
            return http::error(401, "Not logged in");
        };
        let parts = path.trim_matches('/').split('/').collect::<Vec<_>>();
        if path == "/api/files/sign" && req.method() == Method::Post {
            return crate::file_urls::sign(&mut req, &self.env, &user).await;
        }
        if parts.len() >= 6 && parts[0] == "api" && parts[1] == "workspaces" {
            if parts[3] == "tasks" && parts[5] == "comments" {
                return crate::comments::handle(&mut req, &self.env, &user, &parts).await;
            }
            if matches!(parts[3], "tasks" | "test-cases") && parts[5] == "attachments" {
                return attachments(&mut req, &self.env, &user, &parts).await;
            }
        }
        if parts.len() >= 3
            && parts[0] == "api"
            && parts[1] == "files"
            && req.method() == Method::Get
        {
            return download(&self.env, &user, &parts[2..].join("/")).await;
        }
        if parts.len() >= 4 && parts[1] == "admin" && parts[2] == "storage" {
            return crate::storage_admin::handle(&mut req, &self.env, &user, &parts).await;
        }
        http::error(404, "Not found")
    }
}
pub async fn forward(req: &mut Request, env: &Env, workspace: &str) -> Result<Response> {
    env.durable_object("STORAGE")?
        .id_from_name(workspace)?
        .get_stub()?
        .fetch_with_request(std::mem::replace(
            req,
            Request::new("https://internal/consumed", Method::Get)?,
        ))
        .await
}
