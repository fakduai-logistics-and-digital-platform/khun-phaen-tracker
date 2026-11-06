mod ai;
mod auth;
mod background;
mod cache;
mod schedules;
pub use ai::AiGateway;
pub use background::Scheduler;
mod cascades;
mod comments;
mod db;
mod documents;
mod http;
mod notifications;
mod qa;
mod qa_query;
mod realtime;
mod records;
mod s3_client;
mod settings;
mod statistics;
mod storage;
mod storage_admin;
mod task_query;
mod test_runs;
mod uploads;
mod users;
mod workspaces;
pub use auth::AuthService;
pub use realtime::WorkspaceRoom;
use serde_json::{json, Value};
pub use storage::RustFsService;
use worker::*;

#[event(fetch)]
pub async fn main(mut req: Request, env: Env, _ctx: Context) -> Result<Response> {
    let origin = req.headers().get("Origin")?;
    if origin
        .as_deref()
        .is_some_and(|o| !http::origin_allowed(&http::setting(&env, "ALLOWED_ORIGIN"), o))
    {
        return http::error(403, "Origin not allowed");
    }
    if req.method() == Method::Options {
        return http::cors(Response::empty()?, origin.as_deref(), &env);
    }
    let response = match route(&mut req, &env).await {
        Ok(response) => response,
        Err(err) => http::failure(err)?,
    };
    if response.status_code() == 101 {
        return Ok(response);
    }
    http::cors(response, origin.as_deref(), &env)
}
async fn route(req: &mut Request, env: &Env) -> Result<Response> {
    let path = req.path();
    let parts: Vec<_> = path.trim_matches('/').split('/').collect();
    if req.method() == Method::Get && matches!(path.as_str(), "/" | "/health") {
        return http::ok(
            json!({"status":"ok","service":"khun-phaen-worker","storage":"rustfs","database":"d1"}),
        );
    }
    if path == "/ws" {
        return realtime::upgrade(req, env).await;
    }
    if path == "/api/rooms"
        || path.starts_with("/api/rooms/")
        || path == "/api/notifications/stream"
    {
        return http::error(
            410,
            "Peer sync and SSE have been retired; use backend APIs and realtime tickets",
        );
    }
    if parts.first() != Some(&"api") {
        return http::error(404, "Not found");
    }
    if matches!(req.method(), Method::Post | Method::Put | Method::Patch)
        && !path.ends_with("/attachments")
        && !(path.ends_with("/comments") && req.method() == Method::Post)
        && !req
            .headers()
            .get("Content-Type")?
            .unwrap_or_default()
            .starts_with("application/json")
    {
        return http::error(415, "application/json required");
    }
    if parts.get(1) == Some(&"auth") {
        let action = parts.get(2).copied().unwrap_or_default();
        if (matches!(action, "login" | "invite" | "setup-password") && req.method() == Method::Post)
            || (action == "me" && req.method() == Method::Put)
            || (action == "users"
                && parts.len() == 4
                && matches!(req.method(), Method::Put | Method::Delete))
        {
            // Request headers are copied explicitly. Browser-controlled internal identity headers are ignored.
            let headers = Headers::new();
            headers.set("Content-Type", "application/json")?;
            for key in ["Authorization", "X-Setup-Token"] {
                if let Some(v) = req.headers().get(key)? {
                    headers.set(key, &v)?
                }
            }
            headers.set(
                "X-Client-IP",
                &req.headers()
                    .get("CF-Connecting-IP")?
                    .unwrap_or_else(|| "local".into()),
            )?;
            let body = if req.method() == Method::Delete {
                "{}".to_owned()
            } else {
                http::body(req).await?.to_string()
            };
            if body.len() > 16384 {
                return http::error(413, "Auth body too large");
            }
            let internal = Request::new_with_init(
                &format!(
                    "https://internal/{}",
                    if action == "users" {
                        format!("users/{}", parts[3])
                    } else {
                        action.to_owned()
                    }
                ),
                RequestInit::new()
                    .with_method(req.method())
                    .with_headers(headers)
                    .with_body(Some(body.into())),
            )?;
            return env
                .durable_object("AUTH")?
                .id_from_name("authentication")?
                .get_stub()?
                .fetch_with_request(internal)
                .await;
        }
        if action == "setup-info" && req.method() == Method::Get {
            let token = req
                .url()?
                .query_pairs()
                .find(|(k, _)| k == "token")
                .map(|(_, v)| v.into_owned())
                .unwrap_or_default();
            let user: Option<Value> = db::first(
                &env.d1("DB")?,
                "SELECT email FROM users WHERE setup_token_hash=?",
                &[auth::digest(&token).into()],
            )
            .await?;
            return match user {
                Some(u) => http::ok(json!({"success":true,"email":u["email"]})),
                None => http::error(400, "Invalid setup token"),
            };
        }
        if action == "logout" && req.method() == Method::Post {
            if let Some(token) = auth::token(req) {
                db::run(
                    &env.d1("DB")?,
                    "DELETE FROM sessions WHERE token_hash=?",
                    &[auth::digest(&token).into()],
                )
                .await?;
            }
            return http::ok(json!({"success":true}));
        }
    }
    if parts.len() >= 5
        && parts[1] == "public"
        && parts[2] == "workspaces"
        && req.method() == Method::Get
    {
        let key = cache::public_key(req)?;
        if let Some(body) = match &key {
            Some(k) => cache::get(env, k).await,
            None => None,
        } {
            return cache::json(body);
        }
        if let Some(mut response) = public(req, env, &parts).await? {
            if response.status_code() != 200 {
                return Ok(response);
            }
            let body = response.text().await?;
            if let Some(k) = &key {
                cache::put(env, k, &body).await;
            }
            return cache::json(body);
        }
    }
    let Some(user) = auth::authenticate(req, env).await? else {
        return http::error(401, "Not logged in");
    };
    if path == "/api/auth/me" && req.method() == Method::Get {
        return http::ok(user.public());
    }
    if path == "/api/auth/users" && req.method() == Method::Get {
        return users::list(req, env, &user).await;
    }
    if matches!(path.as_str(), "/api/my/tasks" | "/api/my/tasks/stats")
        && req.method() == Method::Get
    {
        return task_query::list(req, env, None, &user).await;
    }
    if parts.get(1) == Some(&"notifications") {
        if parts.get(2) == Some(&"realtime-ticket") && req.method() == Method::Post {
            return realtime::personal_ticket(env, &user, &auth::token(req).unwrap_or_default())
                .await;
        }
        return notifications::handle(req, env, &user, &parts).await;
    }
    if matches!(parts.get(1), Some(&"test-cases" | &"test-suites")) && parts.len() >= 3 {
        return qa::resource(req, env, &user, parts[1], parts[2], parts.get(3).copied()).await;
    }
    if parts.len() >= 4
        && parts[1] == "admin"
        && matches!(parts[2], "storage" | "ai")
        && parts[3] == "config"
    {
        return settings::handle(req, env, &user, parts[2], parts.get(4) == Some(&"reset")).await;
    }
    if parts.len() >= 4 && parts[1] == "admin" && parts[2] == "storage" {
        return storage::forward(req, env, "admin").await;
    }
    if parts.len() == 4
        && parts[1] == "admin"
        && parts[2] == "ai"
        && matches!(parts[3], "models" | "embeddings-models")
    {
        return ai::forward(req, env, "admin").await;
    }
    if parts.get(1) == Some(&"files") && req.method() == Method::Get {
        return storage::forward(req, env, parts.get(2).copied().unwrap_or_default()).await;
    }
    if parts.get(1) == Some(&"workspaces") {
        if parts.len() >= 5 && parts[3] == "ai" {
            return ai::forward(req, env, parts[2]).await;
        }
        if parts.len() >= 6
            && matches!(parts[3], "tasks" | "test-cases")
            && parts[5] == "attachments"
        {
            return storage::forward(req, env, parts[2]).await;
        }

        if parts.len() >= 6 && parts[3] == "tasks" && parts[5] == "comments" {
            return storage::forward(req, env, parts[2]).await;
        }
        if parts.len() == 6
            && parts[3] == "sprints"
            && parts[5] == "archive"
            && req.method() == Method::Post
        {
            return statistics::archive(req, env, &user, &parts).await;
        }
        if parts.len() >= 4 && parts[3] == "test-runs" {
            return test_runs::handle(req, env, &user, &parts).await;
        }
        if parts.len() >= 4 && matches!(parts[3], "test-cases" | "test-suites") {
            return qa::workspace(
                req,
                env,
                Some(&user),
                parts[2],
                parts[3],
                parts.get(4).copied(),
            )
            .await;
        }
        if parts.len() == 4 && parts[3] == "realtime-ticket" && req.method() == Method::Post {
            return realtime::ticket(env, &user, parts[2], &auth::token(req).unwrap_or_default())
                .await;
        }
        if parts.len() >= 4 && documents::fields(parts[3]).is_some() {
            return documents::handle(req, env, &user, &parts).await;
        }
        return workspaces::handle(req, env, &user, &parts).await;
    }
    http::error(404, "Not found")
}

#[event(scheduled)]
pub async fn scheduled(_event: ScheduledEvent, env: Env, ctx: ScheduleContext) {
    ctx.wait_until(async move {
        let result = async {
            env.durable_object("SCHEDULER")?
                .id_from_name("background")?
                .get_stub()?
                .fetch_with_str("https://internal/tick")
                .await
        }
        .await;
        if result.is_err() {
            console_error!("Scheduled delivery failed; persisted jobs remain available for retry");
        }
    });
}
async fn public(req: &mut Request, env: &Env, parts: &[&str]) -> Result<Option<Response>> {
    if matches!(parts[4], "test-cases" | "test-suites" | "all-test-cases") {
        let all = parts[4] == "all-test-cases";
        return qa::workspace(
            req,
            env,
            None,
            parts[3],
            if all { "test-cases" } else { parts[4] },
            if all { Some("all") } else { parts.get(5).copied() },
        )
        .await
        .map(Some);
    }
    if parts[4] == "summary" {
        return test_runs::summary(env, parts[3]).await.map(Some);
    }
    if parts[4] == "test-runs" && parts.get(5) == Some(&"latest") {
        return http::ok(test_runs::latest(env, parts[3]).await?).map(Some);
    }
    Ok(None)
}
