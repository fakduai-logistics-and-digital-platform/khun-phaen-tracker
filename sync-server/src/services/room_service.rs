use std::time::Duration as StdDuration;
use tracing::info;
use crate::state::SharedState;
use rand::Rng;

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
