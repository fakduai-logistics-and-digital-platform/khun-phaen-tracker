use axum::{
    extract::{State, Json, Path},
    response::IntoResponse,
    http::HeaderMap,
};
use axum_extra::extract::cookie::CookieJar;

use crate::models::workspace::{CreateWorkspaceRequest, UpdateWorkspaceRequest};
use crate::repositories::workspace_repo::WorkspaceRepository;
use crate::repositories::room_repo::RoomRepository;
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
    match WorkspaceService::get_user_workspaces(&workspace_repo, &user_id).await {
        Ok(workspaces) => axum::Json(serde_json::json!({ "success": true, "workspaces": workspaces })).into_response(),
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
        Ok(workspace) => axum::Json(serde_json::json!({ "success": true, "workspace": workspace })).into_response(),
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
    match WorkspaceService::update_workspace(&workspace_repo, &user_id, &workspace_id, payload).await {
        Ok(true) => axum::Json(serde_json::json!({ "success": true })).into_response(),
        Ok(false) => (
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Workspace not found or unauthorized to update" })),
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
    let room_repo = RoomRepository::new(&state.db);
    match WorkspaceService::delete_workspace(&workspace_repo, &room_repo, &state.rooms, &user_id, &workspace_id).await {
        Ok(true) => axum::Json(serde_json::json!({ "success": true })).into_response(),
        Ok(false) => (
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Workspace not found or unauthorized to delete" })),
        ).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": e })),
        ).into_response(),
    }
}
