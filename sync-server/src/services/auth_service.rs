use crate::models::{auth::AuthRequest, auth::Claims, user::User};
use crate::repositories::user_repo::UserRepository;
use bcrypt::{hash, verify, DEFAULT_COST};
use jsonwebtoken::{encode, EncodingKey, Header};

pub struct AuthService;

impl AuthService {
    pub async fn register(user_repo: &UserRepository, payload: AuthRequest) -> Result<String, String> {
        let existing = user_repo.find_by_email(&payload.email).await.map_err(|e| format!("Database error: {}", e))?;
        if existing.is_some() {
            return Err("User already exists".to_string());
        }

        let password_hash = hash(payload.password, DEFAULT_COST).map_err(|e| e.to_string())?;

        let new_user = User {
            id: None,
            email: payload.email,
            password_hash,
            created_at: chrono::Utc::now(),
        };

        let user_id = user_repo.create(new_user).await.map_err(|e| e.to_string())?;
        Ok(user_id.to_hex())
    }

    pub async fn login(user_repo: &UserRepository, payload: AuthRequest, jwt_secret: &str) -> Result<(String, String, String), String> {
        let user = user_repo.find_by_email(&payload.email).await.map_err(|e| format!("Database error: {}", e))?
            .ok_or_else(|| "Invalid email or password".to_string())?;

        if !verify(payload.password, &user.password_hash).map_err(|e| e.to_string())? {
            return Err("Invalid email or password".to_string());
        }

        let expiration = chrono::Utc::now()
            .checked_add_signed(chrono::Duration::days(7))
            .expect("valid timestamp")
            .timestamp() as usize;

        let claims = Claims {
            sub: user.id.unwrap().to_hex(),
            exp: expiration,
        };

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(jwt_secret.as_ref()),
        ).map_err(|e| e.to_string())?;

        Ok((user.id.unwrap().to_hex(), user.email, token))
    }
}
