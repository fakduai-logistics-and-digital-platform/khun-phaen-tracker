use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserProfile {
    #[serde(rename = "_id")]
    pub profile_id: String, // UUID v7
    pub user_id: String,    // Link to User.user_id (UUID v7)
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub nickname: Option<String>,
    pub position: Option<String>,
}
