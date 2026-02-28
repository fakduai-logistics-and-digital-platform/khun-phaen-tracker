use axum::{
    extract::{State, Json},
    response::IntoResponse,
};
use axum_extra::extract::cookie::CookieJar;
use jsonwebtoken::{decode, DecodingKey, Validation};
use mongodb::bson::oid::ObjectId;

use crate::models::auth::{AuthRequest, Claims, InviteRequest, SetupPasswordPayload, SetupPasswordRequest, UpdateProfileRequest};
use crate::repositories::user_repo::UserRepository;
use crate::repositories::profile_repo::ProfileRepository;
use crate::services::auth_service::AuthService;
use crate::state::SharedState;

pub async fn invite_handler(
    State(state): State<SharedState>,
    jar: CookieJar,
    headers: axum::http::HeaderMap,
    Json(payload): Json<InviteRequest>,
) -> axum::response::Response {
    let user_repo = UserRepository::new(&state.db);
    let profile_repo = ProfileRepository::new(&state.db);

    // If no users exist yet, allow the first invite only with a valid setup token
    let user_count = match user_repo.count().await {
        Ok(c) => c,
        Err(_) => 0,
    };

    if user_count == 0 {
        let setup_token = std::env::var("INITIAL_SETUP_TOKEN").ok();
        let provided_token = headers.get("X-Setup-Token").and_then(|h| h.to_str().ok());

        if setup_token.is_none() || provided_token != setup_token.as_deref() {
            return (
                axum::http::StatusCode::FORBIDDEN,
                axum::Json(serde_json::json!({ 
                    "error": "System initialization requires a valid setup token. Check INITIAL_SETUP_TOKEN in environment." 
                })),
            ).into_response();
        }
    } else {
        let claims = match extract_claims(&headers, &jar, &state.jwt_secret) {
            Some(c) => c,
            None => return (
                axum::http::StatusCode::UNAUTHORIZED,
                axum::Json(serde_json::json!({ "error": "Unauthorized" })),
            ).into_response(),
        };

        if claims.role != "admin" {
            return (
                axum::http::StatusCode::FORBIDDEN,
                axum::Json(serde_json::json!({ "error": "Admin access required" })),
            ).into_response();
        }
    }

    match AuthService::invite(&user_repo, &profile_repo, payload).await {
        Ok(token) => {
            if token == "ACTV" {
                axum::Json(serde_json::json!({ 
                    "success": true, 
                    "message": "User account created and activated successfully",
                    "activated": true
                })).into_response()
            } else {
                axum::Json(serde_json::json!({ 
                    "success": true, 
                    "message": "Invitation created successfully",
                    "setup_link": format!("/setup-password?token={}", token)
                })).into_response()
            }
        },
        Err(e) => (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({ "error": e })),
        ).into_response()
    }
}

pub async fn setup_password_handler(
    State(state): State<SharedState>,
    Json(payload): Json<SetupPasswordPayload>,
) -> axum::response::Response {
    let user_repo = UserRepository::new(&state.db);

    match AuthService::setup_password(&user_repo, &payload.token, &payload.password).await {
        Ok(email) => axum::Json(serde_json::json!({ "success": true, "email": email })).into_response(),
        Err(e) => (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({ "error": e })),
        ).into_response()
    }
}

pub async fn get_setup_info_handler(
    State(state): State<SharedState>,
    axum::extract::Query(payload): axum::extract::Query<SetupPasswordRequest>,
) -> axum::response::Response {
    let user_repo = UserRepository::new(&state.db);

    match AuthService::get_setup_info(&user_repo, &payload.token).await {
        Ok(email) => axum::Json(serde_json::json!({ "success": true, "email": email })).into_response(),
        Err(e) => (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({ "error": e })),
        ).into_response()
    }
}

pub async fn login_handler(
    State(state): State<SharedState>,
    Json(payload): Json<AuthRequest>,
) -> axum::response::Response {
    let user_repo = UserRepository::new(&state.db);
    let profile_repo = ProfileRepository::new(&state.db);

    match AuthService::login(&user_repo, &profile_repo, payload, &state.jwt_secret).await {
        Ok((id, user_id, email, role, token, profile)) => axum::Json(serde_json::json!({ 
            "success": true, 
            "id": id, 
            "user_id": user_id, 
            "email": email, 
            "role": role,
            "token": token,
            "profile": profile 
        })).into_response(),
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
    headers: axum::http::HeaderMap,
) -> axum::response::Response {
    let auth_header = headers.get("Authorization").and_then(|h| h.to_str().ok());
    
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
    let profile_repo = ProfileRepository::new(&state.db);

    match user_repo.find_by_id(&user_id).await {
        Ok(Some(user)) => {
            let profile = profile_repo.find_by_user_id(&user.user_id).await.ok().flatten();
            
            axum::Json(serde_json::json!({ 
                "success": true,
                "id": user.id.unwrap().to_hex(),
                "user_id": user.user_id,
                "email": user.email,
                "role": user.role,
                "discord_id": user.discord_id,
                "profile": profile
            })).into_response()
        },
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

pub async fn list_users_handler(
    State(state): State<SharedState>,
    jar: CookieJar,
    headers: axum::http::HeaderMap,
) -> axum::response::Response {
    let claims = match extract_claims(&headers, &jar, &state.jwt_secret) {
        Some(c) => c,
        None => return (
            axum::http::StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": "Unauthorized" })),
        ).into_response(),
    };

    if claims.role != "admin" {
        return (
            axum::http::StatusCode::FORBIDDEN,
            axum::Json(serde_json::json!({ "error": "Admin access required" })),
        ).into_response();
    }

    let user_repo = UserRepository::new(&state.db);
    let profile_repo = ProfileRepository::new(&state.db);

    match AuthService::list_all_users(&user_repo, &profile_repo).await {
        Ok(users) => axum::Json(serde_json::json!({ "success": true, "users": users })).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": e })),
        ).into_response()
    }
}

pub fn extract_user_id(
    headers: &axum::http::HeaderMap,
    jar: &CookieJar,
    secret: &str,
) -> Option<ObjectId> {
    let claims = extract_claims(headers, jar, secret)?;
    ObjectId::parse_str(&claims.sub).ok()
}

pub fn extract_claims(
    headers: &axum::http::HeaderMap,
    jar: &CookieJar,
    secret: &str,
) -> Option<Claims> {
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
    
    decode::<Claims>(
        &token_str,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::default(),
    ).ok().map(|data| data.claims)
}

pub async fn delete_user_handler(
    State(state): State<SharedState>,
    jar: CookieJar,
    headers: axum::http::HeaderMap,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> axum::response::Response {
    let claims = match extract_claims(&headers, &jar, &state.jwt_secret) {
        Some(c) => c,
        None => return (
            axum::http::StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": "Unauthorized" })),
        ).into_response(),
    };

    if claims.role != "admin" {
        return (
            axum::http::StatusCode::FORBIDDEN,
            axum::Json(serde_json::json!({ "error": "Admin access required" })),
        ).into_response();
    }

    let user_repo = UserRepository::new(&state.db);
    let profile_repo = ProfileRepository::new(&state.db);

    match AuthService::delete_user(&user_repo, &profile_repo, &id).await {
        Ok(_) => axum::Json(serde_json::json!({ "success": true })).into_response(),
        Err(e) => (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({ "error": e })),
        ).into_response()
    }
}

pub async fn update_me_handler(
    State(state): State<SharedState>,
    jar: CookieJar,
    headers: axum::http::HeaderMap,
    Json(payload): Json<UpdateProfileRequest>,
) -> axum::response::Response {
    let user_id = match extract_user_id(&headers, &jar, &state.jwt_secret) {
        Some(id) => id,
        None => return (
            axum::http::StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": "Unauthorized" })),
        ).into_response(),
    };

    let user_repo = UserRepository::new(&state.db);
    let profile_repo = ProfileRepository::new(&state.db);

    match AuthService::update_profile(&user_repo, &profile_repo, &user_id, payload).await {
        Ok(_) => axum::Json(serde_json::json!({ "success": true })).into_response(),
        Err(e) => (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({ "error": e })),
        ).into_response()
    }
}

pub async fn update_user_handler(
    State(state): State<SharedState>,
    jar: CookieJar,
    headers: axum::http::HeaderMap,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(payload): Json<crate::models::auth::UpdateUserRequest>,
) -> axum::response::Response {
    let claims = match extract_claims(&headers, &jar, &state.jwt_secret) {
        Some(c) => c,
        None => return (
            axum::http::StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": "Unauthorized" })),
        ).into_response(),
    };

    if claims.role != "admin" {
        return (
            axum::http::StatusCode::FORBIDDEN,
            axum::Json(serde_json::json!({ "error": "Admin access required" })),
        ).into_response();
    }

    let user_repo = UserRepository::new(&state.db);
    let profile_repo = ProfileRepository::new(&state.db);

    match AuthService::update_user(&user_repo, &profile_repo, &id, payload).await {
        Ok(_) => axum::Json(serde_json::json!({ "success": true })).into_response(),
        Err(e) => (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({ "error": e })),
        ).into_response()
    }
}
