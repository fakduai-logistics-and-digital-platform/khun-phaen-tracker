use axum::{
    extract::{State, Json, Path},
    response::IntoResponse,
    http::HeaderMap,
};
use axum_extra::extract::cookie::CookieJar;

use crate::models::workspace::{CreateWorkspaceRequest, UpdateWorkspaceRequest};
use crate::repositories::workspace_repo::WorkspaceRepository;
use crate::repositories::room_repo::RoomRepository;
use crate::repositories::data_repo::DataRepository;
use crate::services::workspace_service::WorkspaceService;
use crate::state::SharedState;
use crate::handlers::auth_handler::extract_user_id;
use mongodb::bson::oid::ObjectId;

pub async fn get_workspaces_handler(
    State(state): State<SharedState>,
    headers: HeaderMap,
    jar: CookieJar,
) -> axum::response::Response {
    let user_id = match extract_user_id(&headers, &jar, &state.jwt_secret) {
        Some(id) => id,
        None => return (
            axum::http::StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": "Not logged in" })),
        ).into_response(),
    };

    let workspace_repo = WorkspaceRepository::new(&state.db);
    let data_repo = DataRepository::new(&state.db);
    let assigned_ws_ids = data_repo.find_assigned_workspaces(&user_id.to_hex())
        .await
        .unwrap_or_default();

    match WorkspaceService::get_user_workspaces(&workspace_repo, &user_id, assigned_ws_ids).await {
        Ok(workspaces) => {
            let workspaces_json: Vec<_> = workspaces.into_iter().map(|w| {
                serde_json::json!({
                    "id": w.id.map(|id| id.to_hex()).unwrap_or_default(),
                    "name": w.name,
                    "owner_id": w.owner_id.to_hex(),
                    "room_code": w.room_code,
                    "created_at": w.created_at,
                })
            }).collect();
            axum::Json(serde_json::json!({ "success": true, "workspaces": workspaces_json })).into_response()
        },
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": e })),
        ).into_response(),
    }
}

pub async fn create_workspace_handler(
    State(state): State<SharedState>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(payload): Json<CreateWorkspaceRequest>,
) -> axum::response::Response {
    let user_id = match extract_user_id(&headers, &jar, &state.jwt_secret) {
        Some(id) => id,
        None => return (
            axum::http::StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": "Not logged in" })),
        ).into_response(),
    };

    let workspace_repo = WorkspaceRepository::new(&state.db);
    match WorkspaceService::create_workspace(&workspace_repo, &user_id, payload).await {
        Ok(workspace) => {
            let workspace_json = serde_json::json!({
                "id": workspace.id.map(|id| id.to_hex()).unwrap_or_default(),
                "name": workspace.name,
                "owner_id": workspace.owner_id.to_hex(),
                "room_code": workspace.room_code,
                "created_at": workspace.created_at,
            });
            axum::Json(serde_json::json!({ "success": true, "workspace": workspace_json })).into_response()
        },
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": e })),
        ).into_response(),
    }
}

pub async fn update_workspace_handler(
    State(state): State<SharedState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(payload): Json<UpdateWorkspaceRequest>,
) -> axum::response::Response {
    let user_id = match extract_user_id(&headers, &jar, &state.jwt_secret) {
        Some(id) => id,
        None => return (
            axum::http::StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": "Not logged in" })),
        ).into_response(),
    };

    let workspace_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({ "error": "Invalid workspace ID syntax" })),
        ).into_response(),
    };

    let workspace_repo = WorkspaceRepository::new(&state.db);

    // Only the owner can update a workspace
    match workspace_repo.find_by_id(&workspace_id).await {
        Ok(Some(ws)) if ws.owner_id != user_id => {
            return (axum::http::StatusCode::FORBIDDEN, axum::Json(serde_json::json!({ "error": "Only the workspace owner can update this workspace" }))).into_response();
        },
        Ok(None) => {
            return (axum::http::StatusCode::NOT_FOUND, axum::Json(serde_json::json!({ "error": "Workspace not found" }))).into_response();
        },
        Err(_) => {
            return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, axum::Json(serde_json::json!({ "error": "Database error" }))).into_response();
        },
        _ => {}
    }

    match WorkspaceService::update_workspace(&workspace_repo, &user_id, &workspace_id, payload).await {
        Ok(true) => axum::Json(serde_json::json!({ "success": true })).into_response(),
        Ok(false) => (
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Workspace not found" })),
        ).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": e })),
        ).into_response(),
    }
}

pub async fn delete_workspace_handler(
    State(state): State<SharedState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    jar: CookieJar,
) -> axum::response::Response {
    let user_id = match extract_user_id(&headers, &jar, &state.jwt_secret) {
        Some(id) => id,
        None => return (
            axum::http::StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": "Not logged in" })),
        ).into_response(),
    };

    let workspace_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({ "error": "Invalid workspace ID syntax" })),
        ).into_response(),
    };

    let workspace_repo = WorkspaceRepository::new(&state.db);

    // Only the owner can delete a workspace
    match workspace_repo.find_by_id(&workspace_id).await {
        Ok(Some(ws)) if ws.owner_id != user_id => {
            return (axum::http::StatusCode::FORBIDDEN, axum::Json(serde_json::json!({ "error": "Only the workspace owner can delete this workspace" }))).into_response();
        },
        Ok(None) => {
            return (axum::http::StatusCode::NOT_FOUND, axum::Json(serde_json::json!({ "error": "Workspace not found" }))).into_response();
        },
        Err(_) => {
            return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, axum::Json(serde_json::json!({ "error": "Database error" }))).into_response();
        },
        _ => {}
    }

    let room_repo = RoomRepository::new(&state.db);
    match WorkspaceService::delete_workspace(&workspace_repo, &room_repo, &state.rooms, &user_id, &workspace_id).await {
        Ok(true) => axum::Json(serde_json::json!({ "success": true })).into_response(),
        Ok(false) => (
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Workspace not found" })),
        ).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": e })),
        ).into_response(),
    }
}

pub async fn check_workspace_access_handler(
    State(state): State<SharedState>,
    Path(room_code): Path<String>,
    headers: HeaderMap,
    jar: CookieJar,
) -> axum::response::Response {
    let user_id = match extract_user_id(&headers, &jar, &state.jwt_secret) {
        Some(id) => id,
        None => return (
            axum::http::StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": "Not logged in" })),
        ).into_response(),
    };

    use futures::StreamExt;
    let mut cursor = match state.db.collection::<crate::models::workspace::Workspace>("workspaces")
        .find(mongodb::bson::doc! { "room_code": &room_code }, None).await {
        Ok(c) => c,
        Err(_) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, axum::Json(serde_json::json!({ "error": "Db error" }))).into_response()
    };
    
    let ws = cursor.next().await.and_then(|r| r.ok());

    match ws {
        Some(w) => {
            if w.owner_id == user_id {
                return axum::Json(serde_json::json!({ "success": true, "has_access": true })).into_response();
            }
            if let Some(id) = w.id {
                let data_repo = crate::repositories::data_repo::DataRepository::new(&state.db);
                if let Ok(assigned) = data_repo.find_assigned_workspaces(&user_id.to_hex()).await {
                    if assigned.contains(&id) {
                        return axum::Json(serde_json::json!({ "success": true, "has_access": true })).into_response();
                    }
                }
            }
            axum::Json(serde_json::json!({ "success": true, "has_access": false })).into_response()
        },
        None => axum::Json(serde_json::json!({ "success": false, "error": "Workspace not found" })).into_response()
    }
}

pub async fn get_notification_config_handler(
    State(state): State<SharedState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    jar: CookieJar,
) -> axum::response::Response {
    let user_id = match extract_user_id(&headers, &jar, &state.jwt_secret) {
        Some(id) => id,
        None => return (axum::http::StatusCode::UNAUTHORIZED, axum::Json(serde_json::json!({ "error": "Not logged in" }))).into_response(),
    };

    let workspace_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (axum::http::StatusCode::BAD_REQUEST, axum::Json(serde_json::json!({ "error": "Invalid workspace ID syntax" }))).into_response(),
    };

    let workspace_repo = WorkspaceRepository::new(&state.db);
    match workspace_repo.find_by_id(&workspace_id).await {
        Ok(Some(ws)) => {
            // Check access
            if ws.owner_id != user_id {
                return (axum::http::StatusCode::FORBIDDEN, axum::Json(serde_json::json!({ "error": "Forbidden" }))).into_response();
            }
            axum::Json(serde_json::json!({ "success": true, "config": ws.notification_config })).into_response()
        },
        Ok(None) => (axum::http::StatusCode::NOT_FOUND, axum::Json(serde_json::json!({ "error": "Workspace not found" }))).into_response(),
        Err(e) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, axum::Json(serde_json::json!({ "error": e.to_string() }))).into_response(),
    }
}

pub async fn update_notification_config_handler(
    State(state): State<SharedState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(payload): Json<crate::models::workspace::UpdateNotificationConfigRequest>,
) -> axum::response::Response {
    let user_id = match extract_user_id(&headers, &jar, &state.jwt_secret) {
        Some(id) => id,
        None => return (axum::http::StatusCode::UNAUTHORIZED, axum::Json(serde_json::json!({ "error": "Not logged in" }))).into_response(),
    };

    let workspace_id = match ObjectId::parse_str(&id) {
        Ok(oid) => oid,
        Err(_) => return (axum::http::StatusCode::BAD_REQUEST, axum::Json(serde_json::json!({ "error": "Invalid workspace ID syntax" }))).into_response(),
    };

    let config = crate::models::workspace::NotificationConfig {
        discord_webhook_url: payload.discord_webhook_url,
        enabled: payload.enabled,
        days: payload.days,
        time: payload.time,
        last_sent_at: None, // Preserve existing value if possible? Better lookup first.
    };

    let workspace_repo = WorkspaceRepository::new(&state.db);
    
    // Preserve last_sent_at
    let existing = match workspace_repo.find_by_id(&workspace_id).await {
        Ok(Some(ws)) => {
            if ws.owner_id != user_id {
                return (axum::http::StatusCode::FORBIDDEN, axum::Json(serde_json::json!({ "error": "Forbidden" }))).into_response();
            }
            ws
        },
        _ => return (axum::http::StatusCode::NOT_FOUND, axum::Json(serde_json::json!({ "error": "Workspace not found" }))).into_response(),
    };

    let mut final_config = config;
    if let Some(c) = existing.notification_config {
        final_config.last_sent_at = c.last_sent_at;
    }

    match WorkspaceService::update_notification_config(&workspace_repo, &user_id, &workspace_id, final_config).await {
        Ok(true) => axum::Json(serde_json::json!({ "success": true })).into_response(),
        Ok(_) => (axum::http::StatusCode::NOT_FOUND, axum::Json(serde_json::json!({ "error": "Not found" }))).into_response(),
        Err(e) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, axum::Json(serde_json::json!({ "error": e }))).into_response(),
    }
}
