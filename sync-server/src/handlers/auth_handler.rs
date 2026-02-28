use axum::{
    extract::{State, Json},
    response::IntoResponse,
};
use axum_extra::extract::cookie::CookieJar;
use jsonwebtoken::{decode, DecodingKey, Validation};
use mongodb::bson::oid::ObjectId;

use crate::models::auth::{AuthRequest, Claims};
use crate::repositories::user_repo::UserRepository;
use crate::services::auth_service::AuthService;
use crate::state::SharedState;

pub async fn register_handler(
    State(state): State<SharedState>,
    Json(payload): Json<AuthRequest>,
) -> axum::response::Response {
    let user_repo = UserRepository::new(&state.db);

    match AuthService::register(&user_repo, payload).await {
        Ok(_) => axum::Json(serde_json::json!({ "success": true })).into_response(),
        Err(e) => {
            let status = if e == "User already exists" {
                axum::http::StatusCode::BAD_REQUEST
            } else {
                axum::http::StatusCode::INTERNAL_SERVER_ERROR
            };
            (
                status,
                axum::Json(serde_json::json!({ "error": e })),
            ).into_response()
        }
    }
}

pub async fn login_handler(
    State(state): State<SharedState>,
    Json(payload): Json<AuthRequest>,
) -> axum::response::Response {
    let user_repo = UserRepository::new(&state.db);

    match AuthService::login(&user_repo, payload, &state.jwt_secret).await {
        Ok((email, token)) => axum::Json(serde_json::json!({ "success": true, "email": email, "token": token })).into_response(),
        Err(e) => (
            axum::http::StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": e })),
        ).into_response(),
    }
}

pub async fn logout_handler() -> axum::response::Response {
    axum::Json(serde_json::json!({ "success": true })).into_response()
}

pub async fn me_handler(
    State(state): State<SharedState>,
    jar: CookieJar,
    req: axum::extract::Request,
) -> axum::response::Response {
    let auth_header = req.headers().get("Authorization").and_then(|h| h.to_str().ok());
    
    // First try to get token from Authorization: Bearer <token>
    let token = if let Some(header) = auth_header {
        if header.starts_with("Bearer ") {
            Some(header[7..].to_string())
        } else {
            None
        }
    } else {
        // Fallback to cookie
        jar.get("_khun_ph_token").map(|c| c.value().to_string())
    };

    let token_str = match token {
        Some(t) => t,
        None => return (
            axum::http::StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": "Not logged in" })),
        ).into_response(),
    };

    let token_data = match decode::<Claims>(
        &token_str,
        &DecodingKey::from_secret(state.jwt_secret.as_ref()),
        &Validation::default(),
    ) {
        Ok(c) => c,
        Err(_) => return (
            axum::http::StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": "Invalid token" })),
        ).into_response(),
    };

    let user_id = ObjectId::parse_str(&token_data.claims.sub).unwrap();
    let user_repo = UserRepository::new(&state.db);

    match user_repo.find_by_id(&user_id).await {
        Ok(Some(user)) => axum::Json(serde_json::json!({ "email": user.email })).into_response(),
        Ok(None) => (
            axum::http::StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": "User not found" })),
        ).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("Database error: {}", e) })),
        ).into_response(),
    }
}

pub fn extract_user_id(
    headers: &axum::http::HeaderMap,
    jar: &CookieJar,
    secret: &str,
) -> Option<ObjectId> {
    let auth_header = headers.get("Authorization").and_then(|h| h.to_str().ok());
    
    let token = if let Some(header) = auth_header {
        if header.starts_with("Bearer ") {
            Some(header[7..].to_string())
        } else {
            None
        }
    } else {
        jar.get("_khun_ph_token").map(|c| c.value().to_string())
    };

    let token_str = token?;
    
    let token_data = decode::<Claims>(
        &token_str,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::default(),
    ).ok()?;

    ObjectId::parse_str(&token_data.claims.sub).ok()
}

