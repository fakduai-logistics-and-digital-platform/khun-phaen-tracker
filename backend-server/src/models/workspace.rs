use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationConfig {
    pub discord_webhook_url: Option<String>,
    pub enabled: bool,
    pub days: Vec<u8>, // 0=Sun, 1=Mon, ..., 6=Sat
    pub time: String,  // "HH:MM"
    pub last_sent_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    pub owner_id: ObjectId,
    pub room_code: String,
    pub notification_config: Option<NotificationConfig>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Deserialize)]
pub struct CreateWorkspaceRequest {
    pub name: String,
}

#[derive(Deserialize)]
pub struct UpdateWorkspaceRequest {
    pub name: String,
}

#[derive(Deserialize)]
pub struct UpdateNotificationConfigRequest {
    pub discord_webhook_url: Option<String>,
    pub enabled: bool,
    pub days: Vec<u8>,
    pub time: String,
}
