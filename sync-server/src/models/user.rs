use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

fn default_user_id() -> String {
    uuid::Uuid::now_v7().to_string()
}

fn default_is_active() -> bool {
    false
}

fn default_role() -> String {
    "user".to_string()
}

fn default_created_at() -> chrono::DateTime<chrono::Utc> {
    chrono::Utc::now()
}

#[derive(Debug, Serialize, Deserialize)]
pub struct User {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(default = "default_user_id")]
    pub user_id: String,
    pub email: String,
    #[serde(default = "default_role")]
    pub role: String, // "admin", "user"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password_hash: Option<String>,
    #[serde(default = "default_created_at")]
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub setup_token: Option<String>,
    #[serde(default = "default_is_active")]
    pub is_active: bool,
}
