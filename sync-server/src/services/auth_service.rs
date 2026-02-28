use crate::models::{auth::AuthRequest, auth::Claims, auth::InviteRequest, user::User, profile::UserProfile};
use mongodb::bson::oid::ObjectId;
use crate::repositories::{user_repo::UserRepository, profile_repo::ProfileRepository};
use bcrypt::{hash, verify, DEFAULT_COST};
use jsonwebtoken::{encode, EncodingKey, Header};

pub struct AuthService;

impl AuthService {
    pub async fn invite(
        user_repo: &UserRepository, 
        profile_repo: &ProfileRepository, 
        payload: InviteRequest
    ) -> Result<String, String> {
        let email = payload.email.clone();
        let existing = user_repo.find_by_email(&email).await.map_err(|e| format!("Database error: {}", e))?;
        if existing.is_some() {
            return Err("User already exists".to_string());
        }

        let mut setup_token = None;
        let mut password_hash = None;
        let mut is_active = false;

        if let Some(pwd) = payload.password {
            if !pwd.is_empty() {
                password_hash = Some(hash(pwd, DEFAULT_COST).map_err(|e| e.to_string())?);
                is_active = true;
            }
        }

        if !is_active {
            setup_token = Some(rand::Rng::sample_iter(&mut rand::thread_rng(), &rand::distributions::Alphanumeric)
                .take(32)
                .map(char::from)
                .collect::<String>());
        }

        let role = payload.role.unwrap_or_else(|| "user".to_string());
        
        let user_id = uuid::Uuid::now_v7().to_string();
        
        // Create User
        let new_user = User {
            id: None,
            user_id: user_id.clone(),
            email,
            role,
            password_hash,
            created_at: chrono::Utc::now(),
            setup_token: setup_token.clone(),
            is_active,
        };

        user_repo.create(new_user).await.map_err(|e| e.to_string())?;

        // Create Profile
        let profile_id = uuid::Uuid::now_v7().to_string();
        let new_profile = UserProfile {
            profile_id,
            user_id: user_id.clone(),
            first_name: payload.first_name,
            last_name: payload.last_name,
            nickname: payload.nickname,
            position: payload.position,
        };

        profile_repo.create(new_profile).await.map_err(|e| e.to_string())?;

        Ok(setup_token.unwrap_or_else(|| "ACTV".to_string())) // Return "ACTV" if already active
    }

    pub async fn get_setup_info(user_repo: &UserRepository, token: &str) -> Result<String, String> {
        let user = user_repo.find_by_setup_token(token).await
            .map_err(|e| format!("Database error: {}", e))?
            .ok_or_else(|| "Invalid or expired token".to_string())?;

        Ok(user.email)
    }

    pub async fn setup_password(user_repo: &UserRepository, token: &str, password: &str) -> Result<String, String> {
        let mut user = user_repo.find_by_setup_token(token).await
            .map_err(|e| format!("Database error: {}", e))?
            .ok_or_else(|| "Invalid or expired token".to_string())?;

        let password_hash = hash(password, DEFAULT_COST).map_err(|e| e.to_string())?;
        
        user.password_hash = Some(password_hash);
        user.setup_token = None;
        user.is_active = true;

        user_repo.update(&user).await.map_err(|e| format!("Database error: {}", e))?;
        
        Ok(user.email)
    }

    pub async fn login(
        user_repo: &UserRepository, 
        profile_repo: &ProfileRepository,
        payload: AuthRequest, 
        jwt_secret: &str
    ) -> Result<(String, String, String, String, String, Option<UserProfile>), String> {
        let user = user_repo.find_by_email(&payload.email).await.map_err(|e| format!("Database error: {}", e))?
            .ok_or_else(|| "Invalid email or password".to_string())?;

        if !user.is_active {
            return Err("Account not activated. Please use the link sent to your email.".to_string());
        }

        let password_hash = user.password_hash.as_ref().ok_or("User has no password set".to_string())?;
        if !verify(payload.password, password_hash).map_err(|e| e.to_string())? {
            return Err("Invalid email or password".to_string());
        }

        let expiration = chrono::Utc::now()
            .checked_add_signed(chrono::Duration::days(7))
            .expect("valid timestamp")
            .timestamp() as usize;

        let claims = Claims {
            sub: user.id.unwrap().to_hex(),
            role: user.role.clone(),
            exp: expiration,
        };

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(jwt_secret.as_ref()),
        ).map_err(|e| e.to_string())?;

        let profile = profile_repo.find_by_user_id(&user.user_id).await.ok().flatten();

        Ok((user.id.unwrap().to_hex(), user.user_id, user.email, user.role, token, profile))
    }

    pub async fn list_all_users(user_repo: &UserRepository, profile_repo: &ProfileRepository) -> Result<Vec<serde_json::Value>, String> {
        let users = user_repo.find_all().await.map_err(|e| format!("Database error: {}", e))?;
        let mut user_list = Vec::new();

        for user in users {
            let profile = profile_repo.find_by_user_id(&user.user_id).await.ok().flatten();
            user_list.push(serde_json::json!({
                "id": user.id.unwrap().to_hex(),
                "user_id": user.user_id,
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active,
                "created_at": user.created_at,
                "setup_token": user.setup_token,
                "profile": profile
            }));
        }

        Ok(user_list)
    }

    pub async fn delete_user(user_repo: &UserRepository, profile_repo: &ProfileRepository, id_str: &str) -> Result<(), String> {
        let oid = ObjectId::parse_str(id_str).map_err(|_| "Invalid User ID format".to_string())?;
        
        let user = user_repo.find_by_id(&oid).await.map_err(|e| format!("Database error: {}", e))?
            .ok_or_else(|| "User not found".to_string())?;

        // Delete profile first
        profile_repo.delete_by_user_id(&user.user_id).await.map_err(|e| format!("Database error: {}", e))?;
        
        // Delete user
        user_repo.delete_by_id(&oid).await.map_err(|e| format!("Database error: {}", e))?;

        Ok(())
    }
}
