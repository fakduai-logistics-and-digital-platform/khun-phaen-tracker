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
use crate::models::message::SystemEvent;
use crate::models::user::User;
use crate::models::profile::UserProfile;
use crate::repositories::user_repo::UserRepository;
use crate::repositories::profile_repo::ProfileRepository;
use crate::services::room_service::spawn_room_cleanup_task;
use crate::state::AppState;
use bcrypt::{hash, DEFAULT_COST};
use tower_governor::{errors::GovernorError, key_extractor::KeyExtractor};
use tracing::info;

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
    
    // Start automated notifications service
    crate::services::notification_service::spawn_notification_service_task(state.clone());

    // Check and create initial admin if needed
    check_and_create_initial_admin(&state.db).await;

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
        .route("/api/auth/invite", post(handlers::auth_handler::invite_handler))
        .route("/api/auth/setup-info", get(handlers::auth_handler::get_setup_info_handler))
        .route("/api/auth/setup-password", post(handlers::auth_handler::setup_password_handler))
        .route("/api/auth/login", post(handlers::auth_handler::login_handler))
        .route("/api/auth/logout", post(handlers::auth_handler::logout_handler))
        .route("/api/auth/me", get(handlers::auth_handler::me_handler))
        .route("/api/auth/me", put(handlers::auth_handler::update_me_handler))
        .route("/api/auth/users", get(handlers::auth_handler::list_users_handler))
        .route("/api/auth/users/:id", put(handlers::auth_handler::update_user_handler))
        .route("/api/auth/users/:id", delete(handlers::auth_handler::delete_user_handler))
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
        .route("/api/workspaces/:id/notifications", get(handlers::workspace_handler::get_notification_config_handler))
        .route("/api/workspaces/:id/notifications", put(handlers::workspace_handler::update_notification_config_handler))
        .route("/api/workspaces/:id", delete(handlers::workspace_handler::delete_workspace_handler))
        .route("/api/workspaces/access/:room_code", get(handlers::workspace_handler::check_workspace_access_handler))
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
        .route("/api/workspaces/:ws_id/sprints", get(handlers::data_handler::list_sprints))
        .route("/api/workspaces/:ws_id/sprints", post(handlers::data_handler::create_sprint))
        .route("/api/workspaces/:ws_id/sprints/:sprint_id", put(handlers::data_handler::update_sprint))
        .route("/api/workspaces/:ws_id/sprints/:sprint_id", delete(handlers::data_handler::delete_sprint))
        .route("/ws", get(handlers::ws_handler::ws_handler))
        .layer(
            tower_http::cors::CorsLayer::new()
                .allow_origin([
                    "http://localhost:5173".parse::<axum::http::HeaderValue>().unwrap(),
                    "http://localhost:4173".parse::<axum::http::HeaderValue>().unwrap(),
                    "http://localhost:8080".parse::<axum::http::HeaderValue>().unwrap(),
                    "https://fakduai-logistics-and-digital-platform.github.io".parse::<axum::http::HeaderValue>().unwrap(),
                ])
                .allow_methods([
                    axum::http::Method::GET,
                    axum::http::Method::POST,
                    axum::http::Method::PUT,
                    axum::http::Method::DELETE,
                ])
                .allow_headers([
                    axum::http::header::CONTENT_TYPE,
                    axum::http::header::AUTHORIZATION,
                    "x-setup-token".parse::<axum::http::HeaderName>().unwrap(),
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

async fn check_and_create_initial_admin(db: &mongodb::Database) {
    let user_repo = UserRepository::new(db);
    let profile_repo = ProfileRepository::new(db);

    match user_repo.count().await {
        Ok(0) => {
            info!("🆕 No users found in database. Initializing system...");
            
            let email = std::env::var("INITIAL_ADMIN_EMAIL")
                .unwrap_or_else(|_| "admin@example.com".to_string());
            let password = std::env::var("INITIAL_ADMIN_PASSWORD")
                .unwrap_or_else(|_| "admin1234".to_string());
            let nickname = std::env::var("INITIAL_ADMIN_NICKNAME")
                .unwrap_or_else(|_| "Admin".to_string());

            let password_hash = hash(password, 10).expect("Failed to hash password");
            let user_id = uuid::Uuid::now_v7().to_string();

            let new_user = User {
                id: None,
                user_id: user_id.clone(),
                email: email.clone(),
                role: "admin".to_string(),
                password_hash: Some(password_hash),
                created_at: chrono::Utc::now(),
                setup_token: None,
                is_active: true,
                discord_id: None,
            };

            if let Err(e) = user_repo.create(new_user).await {
                tracing::error!("❌ Failed to create initial admin user: {}", e);
                return;
            }

            let new_profile = UserProfile {
                profile_id: uuid::Uuid::now_v7().to_string(),
                user_id,
                first_name: None,
                last_name: None,
                nickname: Some(nickname),
                position: Some("System Administrator".to_string()),
            };

            if let Err(e) = profile_repo.create(new_profile).await {
                tracing::error!("❌ Failed to create initial admin profile: {}", e);
                return;
            }

            info!("✅ System initialized successfully!");
            info!("📧 Admin Email: {}", email);
            info!("🔒 Password: [HIDDEN] (Check INITIAL_ADMIN_PASSWORD in .env)");
        }
        Ok(n) => info!("ℹ️ System already has {} users. Skipping initialization.", n),
        Err(e) => tracing::error!("❌ Failed to check user count: {}", e),
    }
}
