use crate::{auth, db, http, workspaces};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use worker::*;

#[derive(Serialize, Deserialize)]
struct Connection {
    user_id: String,
    workspace_id: String,
    expires_at: i64,
    session_hash: String,
}
#[durable_object]
pub struct WorkspaceRoom {
    state: State,
    env: Env,
}
impl DurableObject for WorkspaceRoom {
    fn new(state: State, env: Env) -> Self {
        Self { state, env }
    }
    async fn fetch(&self, mut req: Request) -> Result<Response> {
        // Only Worker-internal fetches reach these endpoints. Public routes never proxy arbitrary paths.
        match req.path().as_str() {
            "/connect" => {
                let connection: Connection = serde_json::from_str(
                    &req.headers().get("X-Verified-Connection")?.ok_or_else(|| {
                        Error::RustError("Missing internal connection metadata".into())
                    })?,
                )?;
                let pair = WebSocketPair::new()?;
                pair.server.serialize_attachment(&connection)?;
                self.state.accept_web_socket(&pair.server);
                pair.server.send(&json!({"type":"room_info","peers":self.state.get_websockets().iter().map(|_|"member").collect::<Vec<_>>()}))?;
                Response::from_websocket(pair.client)
            }
            "/publish" => {
                let event: Value = req.json().await?;
                for ws in self.state.get_websockets() {
                    let connection = ws.deserialize_attachment::<Connection>()?;
                    if let Some(c) = connection {
                        let user: Option<auth::User> = db::first(
                            &self.env.d1("DB")?,
                            "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.user_id=? AND s.expires_at>? AND u.is_active=1",
                            &[c.session_hash.into(),c.user_id.into(),db::now().into()],
                        )
                        .await?;
                        let allowed = if let Some(user) = user {
                            c.workspace_id.is_empty()
                                || workspaces::access(&self.env, &user, &c.workspace_id)
                                    .await?
                                    .is_some()
                        } else {
                            false
                        };
                        if !allowed || c.expires_at <= db::now() {
                            let _ = ws.close(Some(1008), Some("Session expired or access revoked"));
                            continue;
                        }
                        let _ = ws.send(&json!({"type":"data","data":event.to_string()}));
                    }
                }
                Response::empty()
            }
            _ => http::error(404, "Not found"),
        }
    }
    async fn websocket_message(
        &self,
        ws: WebSocket,
        _message: WebSocketIncomingMessage,
    ) -> Result<()> {
        // No peer-provided changes are accepted; all writes go through authenticated HTTP APIs.
        if let Some(c) = ws.deserialize_attachment::<Connection>()? {
            if c.expires_at <= db::now() {
                ws.close(Some(1008), Some("Session expired"))?;
            }
        }
        Ok(())
    }
    async fn websocket_close(
        &self,
        ws: WebSocket,
        code: usize,
        reason: String,
        _clean: bool,
    ) -> Result<()> {
        ws.close(
            Some(if code == 1005 || code == 1006 || code == 1015 {
                1000
            } else {
                code as u16
            }),
            Some(reason),
        )
    }
}
pub async fn ticket(env: &Env, user: &auth::User, room: &str, session: &str) -> Result<Response> {
    let Some(w) = workspaces::access(env, user, room).await? else {
        return http::error(403, "Access denied");
    };
    let token = format!("{}{}", db::id(), db::id());
    let db = env.d1("DB")?;
    db::run(
        &db,
        "DELETE FROM realtime_tickets WHERE expires_at<=?",
        &[db::now().into()],
    )
    .await?;
    db::run(
        &db,
        "INSERT INTO realtime_tickets(token_hash,workspace_id,user_id,expires_at,session_hash) VALUES(?,?,?,?,?)",
        &[
            auth::digest(&token).into(),
            w.id.into(),
            user.id.clone().into(),
            (db::now() + 30).into(),
            auth::digest(session).into(),
        ],
    )
    .await?;
    http::ok(json!({"ticket":token}))
}
pub async fn upgrade(req: &Request, env: &Env) -> Result<Response> {
    if req.method() != Method::Get || req.headers().get("Upgrade")?.as_deref() != Some("websocket")
    {
        return http::error(400, "WebSocket upgrade required");
    }
    let token = req
        .url()?
        .query_pairs()
        .find(|(k, _)| k == "ticket")
        .map(|(_, v)| v.into_owned())
        .unwrap_or_default();
    #[derive(Deserialize)]
    struct Ticket {
        workspace_id: String,
        user_id: String,
        session_hash: String,
    }
    let t:Option<Ticket>=db::first(&env.d1("DB")?,"DELETE FROM realtime_tickets WHERE token_hash=? AND expires_at>? RETURNING workspace_id,user_id,session_hash",&[auth::digest(&token).into(),db::now().into()]).await?;
    let t = if t.is_some() {
        t
    } else {
        db::first(&env.d1("DB")?,"DELETE FROM personal_tickets WHERE token_hash=? AND expires_at>? RETURNING '' workspace_id,user_id,session_hash",&[auth::digest(&token).into(),db::now().into()]).await?
    };
    let Some(t) = t else {
        return http::error(401, "Invalid or expired ticket");
    };
    let user: Option<auth::User> = db::first(
        &env.d1("DB")?,
        "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.user_id=? AND s.expires_at>? AND u.is_active=1",
        &[t.session_hash.clone().into(),t.user_id.clone().into(),db::now().into()],
    )
    .await?;
    let Some(user) = user else {
        return http::error(401, "Not logged in");
    };
    if !t.workspace_id.is_empty()
        && workspaces::access(env, &user, &t.workspace_id)
            .await?
            .is_none()
    {
        return http::error(403, "Access denied");
    }
    let headers = Headers::new();
    headers.set("Upgrade", "websocket")?;
    headers.set(
        "X-Verified-Connection",
        &serde_json::to_string(&Connection {
            user_id: t.user_id,
            workspace_id: t.workspace_id.clone(),
            expires_at: db::now() + 3600,
            session_hash: t.session_hash,
        })?,
    )?;
    let internal = Request::new_with_init(
        "https://internal/connect",
        RequestInit::new()
            .with_method(Method::Get)
            .with_headers(headers),
    )?;
    env.durable_object("WORKSPACES")?
        .id_from_name(&if t.workspace_id.is_empty() {
            format!("user:{}", user.id)
        } else {
            t.workspace_id.clone()
        })?
        .get_stub()?
        .fetch_with_request(internal)
        .await
}
pub async fn publish(
    env: &Env,
    workspace: &str,
    entity: &str,
    action: &str,
    id: &str,
    data: Value,
) {
    let event = json!({"entity":entity,"action":action,"id":id,"data":data,"timestamp":Date::now().as_millis()});
    let result = async {
        let req = Request::new_with_init(
            "https://internal/publish",
            RequestInit::new()
                .with_method(Method::Post)
                .with_body(Some(event.to_string().into())),
        )?;
        env.durable_object("WORKSPACES")?
            .id_from_name(workspace)?
            .get_stub()?
            .fetch_with_request(req)
            .await
    }
    .await;
    if result.is_err() {
        console_warn!("Realtime publish failed; clients recover by refetching API state");
    }
}

pub async fn personal_ticket(env: &Env, user: &auth::User, session: &str) -> Result<Response> {
    let token = format!("{}{}", db::id(), db::id());
    let db = env.d1("DB")?;
    db::run(
        &db,
        "DELETE FROM personal_tickets WHERE expires_at<=?",
        &[db::now().into()],
    )
    .await?;
    db::run(
        &db,
        "INSERT INTO personal_tickets(token_hash,user_id,session_hash,expires_at) VALUES(?,?,?,?)",
        &[
            auth::digest(&token).into(),
            user.id.clone().into(),
            auth::digest(session).into(),
            (db::now() + 30).into(),
        ],
    )
    .await?;
    http::ok(json!({"ticket":token}))
}
pub async fn publish_user(env: &Env, user: &str, event: Value) {
    let result = async {
        let req = Request::new_with_init(
            "https://internal/publish",
            RequestInit::new()
                .with_method(Method::Post)
                .with_body(Some(event.to_string().into())),
        )?;
        env.durable_object("WORKSPACES")?
            .id_from_name(&format!("user:{user}"))?
            .get_stub()?
            .fetch_with_request(req)
            .await
    }
    .await;
    if result.is_err() {
        console_warn!(
            "Personal realtime delivery failed; persisted notifications are fetched on reconnect"
        );
    }
}
