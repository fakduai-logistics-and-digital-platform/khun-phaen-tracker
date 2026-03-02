use crate::models::milestone::{CreateMilestoneRequest, UpdateMilestoneRequest};
use crate::repositories::milestone_repo::MilestoneRepository;
use crate::services::milestone_service::MilestoneService;
use crate::state::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use mongodb::bson::oid::ObjectId;
use std::sync::Arc;

pub async fn list_milestones(
    State(state): State<Arc<AppState>>,
    Path(ws_id): Path<String>,
) -> impl IntoResponse {
    let ws_oid = match ObjectId::parse_str(&ws_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, "Invalid workspace ID").into_response(),
    };

    let repo = MilestoneRepository::new(&state.db);
    let service = MilestoneService::new(repo);

    match service.get_milestones(&ws_oid).await {
        Ok(milestones) => (StatusCode::OK, Json(milestones)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

pub async fn create_milestone(
    State(state): State<Arc<AppState>>,
    Path(ws_id): Path<String>,
    Json(req): Json<CreateMilestoneRequest>,
) -> impl IntoResponse {
    let ws_oid = match ObjectId::parse_str(&ws_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, "Invalid workspace ID").into_response(),
    };

    let repo = MilestoneRepository::new(&state.db);
    let service = MilestoneService::new(repo);

    match service.create_milestone(ws_oid, req).await {
        Ok(milestone) => (StatusCode::CREATED, Json(milestone)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

pub async fn update_milestone(
    State(state): State<Arc<AppState>>,
    Path((ws_id, milestone_id)): Path<(String, String)>,
    Json(req): Json<UpdateMilestoneRequest>,
) -> impl IntoResponse {
    let ws_oid = match ObjectId::parse_str(&ws_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, "Invalid workspace ID").into_response(),
    };

    let repo = MilestoneRepository::new(&state.db);
    let service = MilestoneService::new(repo);

    match service.update_milestone(milestone_id, &ws_oid, req).await {
        Ok(found) => {
            if found {
                StatusCode::OK.into_response()
            } else {
                StatusCode::NOT_FOUND.into_response()
            }
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

pub async fn delete_milestone(
    State(state): State<Arc<AppState>>,
    Path((ws_id, milestone_id)): Path<(String, String)>,
) -> impl IntoResponse {
    let ws_oid = match ObjectId::parse_str(&ws_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, "Invalid workspace ID").into_response(),
    };

    let repo = MilestoneRepository::new(&state.db);
    let service = MilestoneService::new(repo);

    match service.delete_milestone(milestone_id, &ws_oid).await {
        Ok(found) => {
            if found {
                StatusCode::NO_CONTENT.into_response()
            } else {
                StatusCode::NOT_FOUND.into_response()
            }
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}
