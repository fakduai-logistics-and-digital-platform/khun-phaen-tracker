use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, Path, State, Json},
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use rand::Rng;
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::{sync::Arc, time::Duration as StdDuration};
use tokio::sync::broadcast;
use tracing::{info, warn};
use uuid::Uuid;
use mongodb::{Client, Database, Collection, bson::{doc, oid::ObjectId}};
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use axum_extra::extract::cookie::{Cookie, CookieJar};
use bcrypt::{hash, verify, DEFAULT_COST};
use dotenv::dotenv;
use tower_governor::{key_extractor::KeyExtractor, errors::GovernorError};

type SharedState = Arc<AppState>;

pub struct AppState {
    pub db: Database,
    pub rooms: DashMap<String, Room>,
    pub room_idle_timeout_seconds: u64,
    pub system_tx: broadcast::Sender<SystemEvent>,
    pub jwt_secret: String,
}

#[derive(Debug)]
pub struct Room {
    pub id: String,
    pub host_id: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub tx: broadcast::Sender<RoomEvent>,
    pub peers: DashMap<String, PeerInfo>,
    pub document_state: Option<String>,
    pub last_sync: chrono::DateTime<chrono::Utc>,
    pub empty_since: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    pub id: String,
    pub joined_at: chrono::DateTime<chrono::Utc>,
    pub is_host: bool,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RoomEvent {
    PeerJoined { peer: PeerInfo },
    PeerLeft { peer_id: String },
    DataSync { from: String, data: String },
    DocumentUpdate { from: String, document: String },
    HostChanged { new_host_id: String },
}

#[derive(Debug, Clone)]
pub enum SystemEvent {
    RoomCreated { room_id: String },
    RoomClosed { room_id: String },
    Shutdown,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum ClientMessage {
    Join {
        room_code: String,
        peer_id: String,
        is_host: bool,
        metadata: Option<serde_json::Value>,
    },
    Leave,
    Broadcast { data: String },
    SyncDocument { document: String },
    RequestSync,
    Ping,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    Connected { peer_id: String, room_code: String },
    PeerJoined { peer: PeerInfo },
    PeerLeft { peer_id: String },
    Data { from: String, data: String },
    DocumentSync { document: String },
    Error { message: String },
    RoomInfo {
        room_code: String,
        host_id: String,
        peers: Vec<PeerInfo>,
    },
    Pong,
}

#[derive(Clone, Copy)]
struct IpHeaderKeyExtractor;

impl KeyExtractor for IpHeaderKeyExtractor {
    type Key = String;

    fn extract<B>(&self, req: &axum::http::Request<B>) -> Result<Self::Key, GovernorError> {
        req.headers()
            .get("x-forwarded-for")
            .and_then(|h| h.to_str().ok())
            .and_then(|s| s.split(',').next())
            .map(|s| s.trim().to_string())
            .or_else(|| {
                req.headers()
                    .get("x-real-ip")
                    .and_then(|h| h.to_str().ok())
                    .map(|s| s.to_string())
            })
            .ok_or(GovernorError::UnableToExtractKey)
            .or_else(|_| Ok("unknown".to_string()))
    }
}



#[derive(Debug, Serialize, Deserialize)]
pub struct User {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub email: String,
    pub password_hash: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // user_id
    pub exp: usize,
}

#[derive(Deserialize)]
pub struct AuthRequest {
    pub email: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct CreateRoomRequest {
    pub desired_room_code: Option<String>,
    pub desired_host_id: Option<String>,
}

#[tokio::main]
async fn main() {
    dotenv().ok();
    tracing_subscriber::fmt::init();

    info!("🚀 Starting Khun Phaen Sync Server...");

    let room_idle_timeout_seconds = std::env::var("ROOM_IDLE_TIMEOUT_SECONDS")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(3600); 

    if room_idle_timeout_seconds == 0 {
        info!("🕒 Empty room retention: disabled (rooms kept until server restart)");
    } else {
        info!(
            "🕒 Empty room retention configured: {}s (default is 3600s)",
            room_idle_timeout_seconds
        );
    }

    let mongodb_uri = std::env::var("MONGODB_URI")
        .unwrap_or_else(|_| "mongodb://localhost:27017".to_string());
    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "default_secret_keep_it_safe".to_string());
    let db_name = std::env::var("DB_NAME")
        .unwrap_or_else(|_| "tracker-db".to_string());

    info!("🔌 Connecting to MongoDB at {}...", mongodb_uri);
    let mongo_client = Client::with_uri_str(&mongodb_uri).await.expect("Failed to connect to MongoDB");
    let db = mongo_client.database(&db_name);
    info!("✅ Connected to database: {}", db_name);

    let (system_tx, _) = broadcast::channel(100);
    let state = Arc::new(AppState {
        db,
        rooms: DashMap::new(),
        room_idle_timeout_seconds,
        system_tx: system_tx.clone(),
        jwt_secret,
    });
    
    if room_idle_timeout_seconds > 0 {
        spawn_room_cleanup_task(state.clone());
    }

    let governor_conf = Arc::new(
        tower_governor::governor::GovernorConfigBuilder::default()
            .key_extractor(IpHeaderKeyExtractor)
            .per_second(2)
            .burst_size(5)
            .finish()
            .unwrap(),
    );

    let app = Router::new()
        .route("/", get(root_handler))
        .route("/health", get(health_check))
        .route("/api/auth/register", post(register_handler))
        .route("/api/auth/login", post(login_handler))
        .route("/api/auth/logout", post(logout_handler))
        .route("/api/auth/me", get(me_handler))
        .route(
            "/api/rooms", 
            post(create_room).layer(tower_governor::GovernorLayer {
                config: governor_conf,
            }),
        )
        .route("/api/rooms/:room_code", get(get_room_info))
        .route("/ws", get(ws_handler))
        .layer(
            tower_http::cors::CorsLayer::new()
                .allow_origin("http://localhost:5173".parse::<axum::http::HeaderValue>().unwrap())
                .allow_methods([axum::http::Method::GET, axum::http::Method::POST, axum::http::Method::PUT, axum::http::Method::DELETE])
                .allow_headers([axum::http::header::CONTENT_TYPE, axum::http::header::AUTHORIZATION])
                .allow_credentials(true),
        )
        .with_state(state);

    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3001);

    let addr = format!("0.0.0.0:{}", port);
    info!("📡 Server listening on http://{}", addr);
    info!("🔗 WebSocket endpoint: ws://{}/ws", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal(system_tx))
        .await
        .unwrap();
}

async fn shutdown_signal(tx: broadcast::Sender<SystemEvent>) {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    info!("🛑 Signal received, starting graceful shutdown...");
    let _ = tx.send(SystemEvent::Shutdown);
}

async fn root_handler() -> impl IntoResponse {
    axum::Json(serde_json::json!({
        "name": "Khun Phaen Sync Server",
        "version": "0.1.0",
        "status": "running",
        "websocket": "/ws",
        "api": {
            "create_room": "POST /api/rooms",
            "room_info": "GET /api/rooms/:room_code"
        }
    }))
}

async fn health_check(State(state): State<SharedState>) -> impl IntoResponse {
    axum::Json(serde_json::json!({
        "status": "healthy",
        "rooms": state.rooms.len(),
        "timestamp": chrono::Utc::now()
    }))
}

async fn register_handler(
    State(state): State<SharedState>,
    Json(payload): Json<AuthRequest>,
) -> axum::response::Response {
    let users: Collection<User> = state.db.collection("users");

    // Check if user already exists
    let existing_user = match users.find_one(doc! { "email": &payload.email }, None).await {
        Ok(user) => user,
        Err(e) => {
            return (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                axum::Json(serde_json::json!({ "error": format!("Database error: {}", e) })),
            ).into_response();
        }
    };

    if existing_user.is_some() {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({ "error": "User already exists" })),
        ).into_response();
    }

    // Hash password
    let password_hash = hash(payload.password, DEFAULT_COST).unwrap();

    let new_user = User {
        id: None,
        email: payload.email,
        password_hash,
        created_at: chrono::Utc::now(),
    };

    match users.insert_one(new_user, None).await {
        Ok(_) => axum::Json(serde_json::json!({ "success": true })).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": e.to_string() })),
        ).into_response(),
    }
}

async fn login_handler(
    State(state): State<SharedState>,
    jar: CookieJar,
    Json(payload): Json<AuthRequest>,
) -> axum::response::Response {
    let users: Collection<User> = state.db.collection("users");

    let user = match users.find_one(doc! { "email": &payload.email }, None).await {
        Ok(Some(u)) => u,
        Ok(None) => return (
            axum::http::StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": "Invalid email or password" })),
        ).into_response(),
        Err(e) => return (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("Database error: {}", e) })),
        ).into_response(),
    };

    if !verify(payload.password, &user.password_hash).unwrap() {
        return (
            axum::http::StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": "Invalid email or password" })),
        ).into_response();
    }

    // Generate JWT
    let expiration = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::days(7))
        .expect("valid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        sub: user.id.unwrap().to_hex(),
        exp: expiration,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.jwt_secret.as_ref()),
    ).unwrap();

    // Create cookie
    let cookie = Cookie::build(("_khun_ph_token", token))
        .path("/")
        .http_only(true)
        .max_age(time::Duration::hours(24 * 7))
        .build();

    (jar.add(cookie), axum::Json(serde_json::json!({ "success": true, "email": user.email }))).into_response()
}

async fn logout_handler(jar: CookieJar) -> axum::response::Response {
    let cookie = Cookie::build(("_khun_ph_token", ""))
        .path("/")
        .max_age(time::Duration::seconds(0))
        .build();
    (jar.add(cookie), axum::Json(serde_json::json!({ "success": true }))).into_response()
}

async fn me_handler(
    State(state): State<SharedState>,
    jar: CookieJar,
) -> axum::response::Response {
    let token = match jar.get("_khun_ph_token").map(|c| c.value()) {
        Some(t) => t,
        None => return (
            axum::http::StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": "Not logged in" })),
        ).into_response(),
    };

    let token_data = match decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.jwt_secret.as_ref()),
        &Validation::default(),
    ) {
        Ok(c) => c,
        Err(_) => return (
            axum::http::StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": "Invalid token" })),
        ).into_response(),
    };

    let user_id = ObjectId::parse_str(&token_data.claims.sub).unwrap();
    let users: Collection<User> = state.db.collection("users");

    match users.find_one(doc! { "_id": user_id }, None).await {
        Ok(Some(user)) => axum::Json(serde_json::json!({ "email": user.email })).into_response(),
        Ok(None) => (
            axum::http::StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": "User not found" })),
        ).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("Database error: {}", e) })),
        ).into_response(),
    }
}

async fn create_room(
    State(state): State<SharedState>,
    payload: Option<Json<CreateRoomRequest>>,
) -> impl IntoResponse {
    let (requested_code, requested_host_id) = if let Some(Json(req)) = payload {
        (req.desired_room_code, req.desired_host_id)
    } else {
        (None, None)
    };

    let room_code = requested_code.unwrap_or_else(generate_room_code);

    // If room already exists, return it (idempotent/recovery)
    if let Some(room) = state.rooms.get(&room_code) {
        return axum::Json(serde_json::json!({
            "success": true,
            "room_code": room_code,
            "room_id": room.id,
            "host_id": room.host_id,
            "websocket_url": format!("ws://localhost:3001/ws"),
            "restored": true,
            "has_document": room.document_state.is_some()
        }));
    }

    // Try to load from MongoDB
    let rooms_coll = state.db.collection::<serde_json::Value>("rooms");
    let existing_room_doc = match rooms_coll.find_one(doc! { "room_code": &room_code }, None).await {
        Ok(doc) => doc,
        Err(e) => {
            warn!("Database error checking room {}: {}", room_code, e);
            None
        }
    };
    let document_state = existing_room_doc.and_then(|d| d.get("document").and_then(|v| v.as_str().map(|s| s.to_string())));

    let room_id = Uuid::new_v4().to_string();
    let host_id = requested_host_id.unwrap_or_else(|| format!("host_{}", generate_random_id()));

    let (tx, _) = broadcast::channel(256);

    let room = Room {
        id: room_id.clone(),
        host_id: host_id.clone(),
        created_at: chrono::Utc::now(),
        tx,
        peers: DashMap::new(),
        document_state,
        last_sync: chrono::Utc::now(),
        empty_since: Some(chrono::Utc::now()), 
    };

    state.rooms.insert(room_code.clone(), room);

    info!("🆕 Room created: {} (host: {})", room_code, host_id);

    axum::Json(serde_json::json!({
        "success": true,
        "room_code": room_code,
        "room_id": room_id,
        "host_id": host_id,
        "websocket_url": format!("ws://localhost:3001/ws"),
    }))
}

async fn get_room_info(
    Path(room_code): Path<String>,
    State(state): State<SharedState>,
) -> impl IntoResponse {
    match state.rooms.get(&room_code) {
        Some(room) => {
            let peers: Vec<PeerInfo> = room
                .peers
                .iter()
                .map(|entry| entry.value().clone())
                .collect();

            axum::Json(serde_json::json!({
                "success": true,
                "room_code": room_code,
                "host_id": room.host_id,
                "peers": peers,
                "created_at": room.created_at,
                "peer_count": peers.len(),
            }))
        }
        None => axum::Json(serde_json::json!({
            "success": false,
            "error": "Room not found"
        })),
    }
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<SharedState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: SharedState) {
    let mut current_room: Option<String> = None;
    let mut current_peer_id: Option<String> = None;
    let mut room_rx: Option<broadcast::Receiver<RoomEvent>> = None;
    
    let mut system_rx = state.system_tx.subscribe();

    info!("🔌 New WebSocket connection");

    loop {
        tokio::select! {
            msg = socket.recv() => {
                match msg {
                    Some(Ok(msg)) => {
                        match msg {
                            Message::Text(text) => {
                                if text.len() < 200 {
                                    info!("📨 Received: {}", text);
                                } else {
                                    info!("📨 Received (len={}): {}...", text.len(), &text[0..50]);
                                }
                                
                                match serde_json::from_str::<ClientMessage>(&text) {
                                    Ok(client_msg) => {
                                        match handle_client_message(
                                            &mut socket,
                                            &state,
                                            &client_msg,
                                            &mut current_room,
                                            &mut current_peer_id,
                                            &mut room_rx,
                                        )
                                        .await
                                        {
                                            Ok(should_close) => {
                                                if should_close {
                                                    break;
                                                }
                                            }
                                            Err(e) => {
                                                warn!("Error handling message: {}", e);
                                                let error_msg = ServerMessage::Error {
                                                    message: e.to_string(),
                                                };
                                                let _ = socket
                                                    .send(Message::Text(
                                                        serde_json::to_string(&error_msg).unwrap(),
                                                    ))
                                                    .await;
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        warn!("❌ Invalid message format: {}", e);
                                        let error_msg = ServerMessage::Error {
                                            message: format!("Invalid message format: {}", e),
                                        };
                                        let _ = socket
                                            .send(Message::Text(
                                                serde_json::to_string(&error_msg).unwrap(),
                                            ))
                                            .await;
                                    }
                                }
                            }
                            Message::Close(_) => {
                                info!("🔌 Client closed connection");
                                break;
                            }
                            _ => {}
                        }
                    }
                    Some(Err(e)) => {
                        warn!("WebSocket error: {}", e);
                        break;
                    }
                    None => {
                        info!("🔌 WebSocket stream ended");
                        break;
                    }
                }
            }

            event = async {
                if let Some(ref mut rx) = room_rx {
                    rx.recv().await
                } else {
                    futures::future::pending().await
                }
            } => {
                if let Ok(event) = event {
                    if let Err(e) = forward_room_event(&mut socket, event, current_peer_id.as_ref()).await {
                        warn!("Failed to forward room event: {}", e);
                    }
                }
            }

            sys_msg = system_rx.recv() => {
                match sys_msg {
                    Ok(SystemEvent::Shutdown) => {
                        info!("🛑 Server shutting down, closing connection for peer: {:?}", current_peer_id);
                        let _ = socket.send(Message::Close(None)).await;
                        break;
                    }
                    _ => {}
                }
            }
        }
    }

    if let (Some(room_code), Some(peer_id)) = (current_room, current_peer_id) {
        leave_room(&state, &room_code, &peer_id).await;
    }
}

async fn forward_room_event(
    socket: &mut WebSocket,
    event: RoomEvent,
    current_peer_id: Option<&String>,
) -> Result<(), String> {
    let server_msg = match event {
        RoomEvent::PeerJoined { peer } => {
            Some(ServerMessage::PeerJoined { peer })
        }
        RoomEvent::PeerLeft { peer_id } => {
            Some(ServerMessage::PeerLeft { peer_id })
        }
        RoomEvent::DataSync { from, data } => {
            if Some(&from) == current_peer_id {
                None
            } else {
                Some(ServerMessage::Data { from, data })
            }
        }
        RoomEvent::DocumentUpdate { from, document } => {
            if Some(&from) == current_peer_id {
                None
            } else {
                info!("📄 Document update from {}, broadcasting to peers", from);
                Some(ServerMessage::DocumentSync { document })
            }
        }
        RoomEvent::HostChanged { new_host_id } => {
            info!("👑 Host changed to: {}", new_host_id);
            None 
        }
    };

    if let Some(msg) = server_msg {
        let json = serde_json::to_string(&msg).map_err(|e| e.to_string())?;
        socket.send(Message::Text(json)).await.map_err(|e| e.to_string())?;
    }

    Ok(())
}

async fn handle_client_message(
    socket: &mut WebSocket,
    state: &SharedState,
    msg: &ClientMessage,
    current_room: &mut Option<String>,
    current_peer_id: &mut Option<String>,
    room_rx: &mut Option<broadcast::Receiver<RoomEvent>>,
) -> Result<bool, String> {
    match msg {
        ClientMessage::Join {
            room_code,
            peer_id,
            is_host,
            metadata,
        } => {
            if let Some(mut room) = state.rooms.get_mut(room_code) {
                if room.empty_since.is_some() {
                    room.empty_since = None;
                    info!("🔄 Room revived: {}", room_code);
                }

                *room_rx = Some(room.tx.subscribe());
                
                let peer_info = PeerInfo {
                    id: peer_id.clone(),
                    joined_at: chrono::Utc::now(),
                    is_host: *is_host,
                    metadata: metadata.clone(),
                };

                room.peers.insert(peer_id.clone(), peer_info.clone());

                let event = RoomEvent::PeerJoined { peer: peer_info };
                let _ = room.tx.send(event);

                let peers: Vec<PeerInfo> = room
                    .peers
                    .iter()
                    .map(|entry| entry.value().clone())
                    .collect();

                let response = ServerMessage::RoomInfo {
                    room_code: room_code.clone(),
                    host_id: room.host_id.clone(),
                    peers,
                };
                socket
                    .send(Message::Text(
                        serde_json::to_string(&response).unwrap(),
                    ))
                    .await
                    .map_err(|e| e.to_string())?;

                let connected = ServerMessage::Connected {
                    peer_id: peer_id.clone(),
                    room_code: room_code.clone(),
                };
                socket
                    .send(Message::Text(
                        serde_json::to_string(&connected).unwrap(),
                    ))
                    .await
                    .map_err(|e| e.to_string())?;

                *current_room = Some(room_code.clone());
                *current_peer_id = Some(peer_id.clone());

                info!(
                    "👤 Peer joined: {} in room {} (host: {})",
                    current_peer_id.as_ref().unwrap(),
                    current_room.as_ref().unwrap(),
                    is_host
                );

                if let Some(doc) = &room.document_state {
                    let sync = ServerMessage::DocumentSync {
                        document: doc.clone(),
                    };
                    socket
                        .send(Message::Text(serde_json::to_string(&sync).unwrap()))
                        .await
                        .map_err(|e| e.to_string())?;
                }

                Ok(false)
            } else {
                Err("Room not found".to_string())
            }
        }

        ClientMessage::Leave => {
            *room_rx = None; 
            if let (Some(room_code), Some(peer_id)) = (current_room.take(), current_peer_id.take()) {
                leave_room(state, &room_code, &peer_id).await;
                return Ok(true); 
            }
            Ok(false)
        }

        ClientMessage::Broadcast { data } => {
            if let (Some(room_code), Some(peer_id)) = (current_room.as_ref(), current_peer_id.as_ref()) {
                if let Some(room) = state.rooms.get(room_code) {
                    let event = RoomEvent::DataSync {
                        from: peer_id.clone(),
                        data: data.clone(),
                    };
                    let _ = room.tx.send(event);
                }
            }
            Ok(false)
        }

        ClientMessage::SyncDocument { document } => {
            if let (Some(room_code), Some(peer_id)) = (current_room.as_ref(), current_peer_id.as_ref()) {
                if let Some(mut room) = state.rooms.get_mut(room_code) {
                    room.document_state = Some(document.clone());
                    room.last_sync = chrono::Utc::now();

                    let event = RoomEvent::DocumentUpdate {
                        from: peer_id.clone(),
                        document: document.clone(),
                    };
                    let _ = room.tx.send(event);

                    // Persist to MongoDB
                    let rooms_coll = state.db.collection::<serde_json::Value>("rooms");
                    let room_code_clone = room_code.clone();
                    let document_clone = document.clone();
                    tokio::spawn(async move {
                        let filter = doc! { "room_code": room_code_clone };
                        let update = doc! {
                            "$set": {
                                "document": document_clone,
                                "last_sync": mongodb::bson::DateTime::now()
                            },
                        };
                        let options = mongodb::options::UpdateOptions::builder().upsert(true).build();
                        let _ = rooms_coll.update_one(filter, update, options).await;
                    });

                    info!("📄 Document synced by {} in room {}", peer_id, room_code);
                }
            }
            Ok(false)
        }

        ClientMessage::RequestSync => {
            if let Some(room_code) = current_room.as_ref() {
                if let Some(room) = state.rooms.get(room_code) {
                    if let Some(doc) = &room.document_state {
                        let sync = ServerMessage::DocumentSync {
                            document: doc.clone(),
                        };
                        socket
                            .send(Message::Text(serde_json::to_string(&sync).unwrap()))
                            .await
                            .map_err(|e| e.to_string())?;
                        info!("📄 Sent document to peer upon request in room {}", room_code);
                    } else {
                        let sync = ServerMessage::DocumentSync {
                            document: String::new(),
                        };
                        socket
                            .send(Message::Text(serde_json::to_string(&sync).unwrap()))
                            .await
                            .map_err(|e| e.to_string())?;
                        info!("📄 Sent empty document (no data yet) in room {}", room_code);
                    }
                }
            }
            Ok(false)
        }

        ClientMessage::Ping => {
            let pong = ServerMessage::Pong;
            socket
                .send(Message::Text(serde_json::to_string(&pong).unwrap()))
                .await
                .map_err(|e| e.to_string())?;
            Ok(false)
        }
    }
}

async fn leave_room(state: &SharedState, room_code: &str, peer_id: &str) {
    if let Some(mut room) = state.rooms.get_mut(room_code) {
        room.peers.remove(peer_id);

        let event = RoomEvent::PeerLeft {
            peer_id: peer_id.to_string(),
        };
        let _ = room.tx.send(event);

        info!("👤 Peer left: {} from room {}", peer_id, room_code);

        if room.peers.is_empty() {
            room.empty_since = Some(chrono::Utc::now());
            if state.room_idle_timeout_seconds == 0 {
                info!("🕒 Room {} is empty; keeping indefinitely", room_code);
            } else {
                info!(
                    "🕒 Room {} is empty; keeping for {}s before cleanup",
                    room_code, state.room_idle_timeout_seconds
                );
            }
        }
    }
}

fn spawn_room_cleanup_task(state: SharedState) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(StdDuration::from_secs(60));

        loop {
            interval.tick().await;

            let now = chrono::Utc::now();
            let timeout_seconds = state.room_idle_timeout_seconds as i64;

            let stale_rooms: Vec<String> = state
                .rooms
                .iter()
                .filter_map(|entry| {
                    let room = entry.value();
                    let empty_since = room.empty_since.as_ref()?;
                    let idle_seconds = now.signed_duration_since(empty_since.clone()).num_seconds();
                    if idle_seconds >= timeout_seconds {
                        Some(entry.key().clone())
                    } else {
                        None
                    }
                })
                .collect();

            for room_code in stale_rooms {
                if state.rooms.remove(&room_code).is_some() {
                    info!("🗑️ Room removed after idle timeout: {}", room_code);
                }
            }
        }
    });
}

fn generate_room_code() -> String {
    const CHARS: &[u8] = b"ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let mut rng = rand::thread_rng();
    let mut result = String::new();
    for _ in 0..6 {
        let idx = rng.gen_range(0..CHARS.len());
        result.push(CHARS[idx] as char);
    }
    result
}

fn generate_random_id() -> String {
    uuid::Uuid::new_v4().to_string()[..8].to_string()
}
