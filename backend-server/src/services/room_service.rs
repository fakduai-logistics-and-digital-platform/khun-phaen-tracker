use std::time::Duration as StdDuration;
use tracing::{info, warn};
use crate::state::SharedState;
use rand::Rng;
use crate::models::room::Room;
use crate::repositories::room_repo::RoomRepository;
use crate::repositories::workspace_repo::WorkspaceRepository;
use dashmap::DashMap;
use tokio::sync::broadcast;

pub fn spawn_room_cleanup_task(state: SharedState) {
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

pub fn generate_room_code() -> String {
    const CHARS: &[u8] = b"ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let mut rng = rand::thread_rng();
    let mut result = String::new();
    for _ in 0..6 {
        let idx = rng.gen_range(0..CHARS.len());
        result.push(CHARS[idx] as char);
    }
    result
}

pub fn generate_random_id() -> String {
    uuid::Uuid::new_v4().to_string()[..8].to_string()
}

pub async fn ensure_room_exists(state: &SharedState, room_code: &str) -> Result<(), String> {
    if state.rooms.contains_key(room_code) {
        return Ok(());
    }

    // Check if room code exists in workspaces collection or in rooms collection
    let room_repo = RoomRepository::new(&state.db);
    let workspace_repo = WorkspaceRepository::new(&state.db);

    let existing_room_doc = room_repo.find_by_code(room_code).await.ok().flatten();
    let workspace_doc = workspace_repo.find_by_room_code(room_code).await.ok().flatten();

    // If it doesn't exist in either, we'll only allow it if it's a 6-char generated code
    // actually, let's be more permissive for now and let the system create it if it's a valid request.
    // However, the rule of thumb is: if it's a UUID, it MUST be in the workspace collection.
    
    let is_valid = if room_code.len() == 36 && room_code.contains('-') {
        // Looks like a UUID
        workspace_doc.is_some() || existing_room_doc.is_some()
    } else {
        // Might be a legacy 6-char code or other
        true 
    };

    if !is_valid {
        return Err("Invalid room code".to_string());
    }

    let document_state = existing_room_doc.and_then(|d| d.get("document").and_then(|v| v.as_str().map(|s| s.to_string())));

    let room_id = uuid::Uuid::new_v4().to_string();
    let host_id = format!("host_{}", generate_random_id());

    let (tx, _) = broadcast::channel(256);

    let room = Room {
        id: room_id,
        host_id,
        created_at: chrono::Utc::now(),
        tx,
        peers: DashMap::new(),
        document_state,
        last_sync: chrono::Utc::now(),
        empty_since: Some(chrono::Utc::now()),
    };

    state.rooms.insert(room_code.to_string(), room);
    info!("🆕 Room auto-initialized: {}", room_code);
    Ok(())
}
