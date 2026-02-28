use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use chrono::{DateTime, Utc};

#[derive(Debug)]
pub struct Room {
    pub id: String,
    pub host_id: String,
    pub created_at: DateTime<Utc>,
    pub tx: broadcast::Sender<RoomEvent>,
    pub peers: DashMap<String, PeerInfo>,
    pub document_state: Option<String>,
    pub last_sync: DateTime<Utc>,
    pub empty_since: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    pub id: String,
    pub joined_at: DateTime<Utc>,
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

#[derive(Deserialize)]
pub struct CreateRoomRequest {
    pub desired_room_code: Option<String>,
    pub desired_host_id: Option<String>,
}
