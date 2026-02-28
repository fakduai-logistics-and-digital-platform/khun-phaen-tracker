use axum::{
    extract::{State, Json},
    response::IntoResponse,
    http::HeaderMap,
};
use axum_extra::extract::cookie::CookieJar;

use crate::models::workspace::CreateWorkspaceRequest;
use crate::repositories::workspace_repo::WorkspaceRepository;
use crate::services::workspace_service::WorkspaceService;
use crate::state::SharedState;
use crate::handlers::auth_handler::extract_user_id;

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
