use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    pub owner_id: ObjectId,
    pub room_code: String,
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
