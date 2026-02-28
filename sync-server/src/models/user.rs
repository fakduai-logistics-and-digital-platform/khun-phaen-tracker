use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

fn default_user_id() -> String {
    uuid::Uuid::now_v7().to_string()
}

#[derive(Debug, Serialize, Deserialize)]
pub struct User {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(default = "default_user_id")]
    pub user_id: String,
    pub email: String,
    pub password_hash: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}
