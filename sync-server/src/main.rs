mod handlers;
mod models;
mod repositories;
mod services;
mod state;

use axum::{
    extract::State,
    response::IntoResponse,
    routing::{get, post, put, delete},
    Router,
};
use dashmap::DashMap;
use dotenv::dotenv;
use mongodb::Client;
use std::sync::Arc;
use tokio::sync::broadcast;
use tower_governor::{errors::GovernorError, key_extractor::KeyExtractor};
use tracing::info;

use crate::models::message::SystemEvent;
use crate::services::room_service::spawn_room_cleanup_task;
use crate::state::AppState;

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

    let mongodb_uri =
        std::env::var("MONGODB_URI").unwrap_or_else(|_| "mongodb://localhost:27017".to_string());
    let jwt_secret =
        std::env::var("JWT_SECRET").unwrap_or_else(|_| "default_secret_keep_it_safe".to_string());
    let db_name = std::env::var("DB_NAME").unwrap_or_else(|_| "tracker-db".to_string());

    info!("🔌 Connecting to MongoDB...");
    let mongo_client = Client::with_uri_str(&mongodb_uri)
        .await
        .expect("Failed to connect to MongoDB");
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
        .route("/api/auth/register", post(handlers::auth_handler::register_handler))
        .route("/api/auth/login", post(handlers::auth_handler::login_handler))
        .route("/api/auth/logout", post(handlers::auth_handler::logout_handler))
        .route("/api/auth/me", get(handlers::auth_handler::me_handler))
        .route(
            "/api/rooms",
            post(handlers::room_handler::create_room).layer(tower_governor::GovernorLayer {
                config: governor_conf,
            }),
        )
        .route("/api/rooms/:room_code", get(handlers::room_handler::get_room_info))
        .route("/api/workspaces", get(handlers::workspace_handler::get_workspaces_handler))
        .route("/api/workspaces", post(handlers::workspace_handler::create_workspace_handler))
        .route("/api/workspaces/:id", put(handlers::workspace_handler::update_workspace_handler))
        .route("/api/workspaces/:id", delete(handlers::workspace_handler::delete_workspace_handler))
        // Data routes (workspace-scoped)
        .route("/api/workspaces/:ws_id/tasks", get(handlers::data_handler::list_tasks))
        .route("/api/workspaces/:ws_id/tasks", post(handlers::data_handler::create_task))
        .route("/api/workspaces/:ws_id/tasks/:task_id", put(handlers::data_handler::update_task))
        .route("/api/workspaces/:ws_id/tasks/:task_id", delete(handlers::data_handler::delete_task))
        .route("/api/workspaces/:ws_id/projects", get(handlers::data_handler::list_projects))
        .route("/api/workspaces/:ws_id/projects", post(handlers::data_handler::create_project))
        .route("/api/workspaces/:ws_id/projects/:project_id", put(handlers::data_handler::update_project))
        .route("/api/workspaces/:ws_id/projects/:project_id", delete(handlers::data_handler::delete_project))
        .route("/api/workspaces/:ws_id/assignees", get(handlers::data_handler::list_assignees))
        .route("/api/workspaces/:ws_id/assignees", post(handlers::data_handler::create_assignee))
        .route("/api/workspaces/:ws_id/assignees/:assignee_id", put(handlers::data_handler::update_assignee))
        .route("/api/workspaces/:ws_id/assignees/:assignee_id", delete(handlers::data_handler::delete_assignee))
        .route("/ws", get(handlers::ws_handler::ws_handler))
        .layer(
            tower_http::cors::CorsLayer::new()
                .allow_origin("http://localhost:5173".parse::<axum::http::HeaderValue>().unwrap())
                .allow_methods([
                    axum::http::Method::GET,
                    axum::http::Method::POST,
                    axum::http::Method::PUT,
                    axum::http::Method::DELETE,
                ])
                .allow_headers([
                    axum::http::header::CONTENT_TYPE,
                    axum::http::header::AUTHORIZATION,
                ])
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

async fn health_check(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    axum::Json(serde_json::json!({
        "status": "healthy",
        "rooms": state.rooms.len(),
        "timestamp": chrono::Utc::now()
    }))
}
