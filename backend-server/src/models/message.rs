use serde::{Deserialize, Serialize};
use crate::models::room::PeerInfo;

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum ClientMessage {
    Join {
        room_code: String,
        peer_id: String,
        is_host: bool,
        metadata: Option<serde_json::Value>,
    },
    Leave,
    Broadcast { data: String },
    SyncDocument { document: String },
    RequestSync,
    Ping,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    Connected { peer_id: String, room_code: String },
    PeerJoined { peer: PeerInfo },
    PeerLeft { peer_id: String },
    Data { from: String, data: String },
    DocumentSync { document: String },
    Error { message: String },
    RoomInfo {
        room_code: String,
        host_id: String,
        peers: Vec<PeerInfo>,
    },
    Pong,
}

#[derive(Debug, Clone)]
pub enum SystemEvent {
    RoomCreated { room_id: String },
    RoomClosed { room_id: String },
    Shutdown,
}
