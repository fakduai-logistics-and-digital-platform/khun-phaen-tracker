use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // user_id
    pub role: String,
    pub exp: usize,
}

#[derive(Deserialize)]
pub struct AuthRequest {
    pub email: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct InviteRequest {
    pub email: String,
    pub password: Option<String>,
    pub role: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub nickname: Option<String>,
    pub position: Option<String>,
}

#[derive(Deserialize)]
pub struct SetupPasswordRequest {
    pub token: String,
}

#[derive(Deserialize)]
pub struct SetupPasswordPayload {
    pub token: String,
    pub password: String,
}
