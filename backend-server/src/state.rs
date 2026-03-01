use dashmap::DashMap;
use mongodb::Database;
use std::sync::Arc;
use tokio::sync::broadcast;

use crate::models::{message::SystemEvent, room::Room};

pub type SharedState = Arc<AppState>;

pub struct AppState {
    pub db: Database,
    pub rooms: DashMap<String, Room>,
    pub room_idle_timeout_seconds: u64,
    pub system_tx: broadcast::Sender<SystemEvent>,
    pub jwt_secret: String,
    pub storage_client: Option<aws_sdk_s3::Client>,
    pub storage_bucket: String,
}
