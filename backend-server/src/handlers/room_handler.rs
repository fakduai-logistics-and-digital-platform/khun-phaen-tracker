use axum::{
    extract::{Path, State, Json},
    response::IntoResponse,
};
use dashmap::DashMap;
use tokio::sync::broadcast;
use tracing::{info, warn};
use uuid::Uuid;

use crate::models::room::{CreateRoomRequest, PeerInfo, Room};
use crate::repositories::room_repo::RoomRepository;
use crate::services::room_service::{generate_random_id, generate_room_code};
use crate::state::SharedState;

pub async fn create_room(
    State(state): State<SharedState>,
    payload: Option<Json<CreateRoomRequest>>,
) -> impl IntoResponse {
    let (requested_code, requested_host_id) = if let Some(Json(req)) = payload {
        (req.desired_room_code, req.desired_host_id)
    } else {
        (None, None)
    };

    let room_code = requested_code.unwrap_or_else(generate_room_code);

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

    let room_repo = RoomRepository::new(&state.db);
    let existing_room_doc = match room_repo.find_by_code(&room_code).await {
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

pub async fn get_room_info(
    Path(room_code): Path<String>,
    State(state): State<SharedState>,
) -> impl IntoResponse {
    let _ = crate::services::room_service::ensure_room_exists(&state, &room_code).await;
    
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
