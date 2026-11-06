use crate::{db, http};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use worker::*;

#[derive(Clone, Deserialize, Serialize)]
pub struct User {
    pub id: String,
    pub email: String,
    pub role: String,
    pub is_active: i32,
    pub password_hash: Option<String>,
    pub profile: String,
    pub discord_id: Option<String>,
    pub created_at: String,
}
impl User {
    pub fn public(&self) -> Value {
        json!({"id":self.id,"user_id":self.id,"email":self.email,"role":self.role,
            "is_active":self.is_active!=0,"discord_id":self.discord_id,"created_at":self.created_at,
            "profile":serde_json::from_str::<Value>(&self.profile).unwrap_or(json!({}))})
    }
}
pub fn digest(value: &str) -> String {
    format!("{:x}", Sha256::digest(value.as_bytes()))
}
pub fn token(req: &Request) -> Option<String> {
    req.headers()
        .get("Authorization")
        .ok()
        .flatten()
        .and_then(|v| v.strip_prefix("Bearer ").map(str::to_owned))
}
pub async fn authenticate(req: &Request, env: &Env) -> Result<Option<User>> {
    let Some(token) = token(req) else {
        return Ok(None);
    };
    db::first(&env.d1("DB")?, "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.is_active=1", &[digest(&token).into(),db::now().into()]).await
}
// All password work runs in a DO, whose CPU allowance supports bcrypt at its normal cost.
#[durable_object]
pub struct AuthService {
    env: Env,
}
impl DurableObject for AuthService {
    fn new(_state: State, env: Env) -> Self {
        Self { env }
    }
    async fn fetch(&self, mut req: Request) -> Result<Response> {
        let db = self.env.d1("DB")?;
        let path = req.path();
        let input = http::body(&mut req).await?;
        if path == "/login" || path == "/setup-password" {
            // Atomic, persistent limiter, scoped by caller IP before expensive password work.
            #[derive(Deserialize)]
            struct Attempts {
                attempts: i32,
            }
            let ip = req.headers().get("X-Client-IP")?.unwrap_or_default();
            let key = digest(&format!(
                "{}:{}:{}",
                path,
                ip,
                if path == "/login" {
                    http::text(&input, "email").trim().to_lowercase()
                } else {
                    String::new()
                }
            ));
            let count: Option<Attempts> = db::first(&db,"INSERT INTO auth_attempts(key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END, expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING attempts",&[key.into(),(db::now()+300).into(),db::now().into(),db::now().into()]).await?;
            if count.map(|v| v.attempts > 10).unwrap_or(true) {
                return http::error(429, "Too many attempts; try again later");
            }
        }
        if path == "/me" || path.starts_with("/users/") {
            return crate::users::edit(&req, &self.env, &input).await;
        }
        match path.as_str() {
            "/login" => {
                let email = http::text(&input, "email").trim().to_lowercase();
                let user: Option<User> = db::first(
                    &db,
                    "SELECT * FROM users WHERE email=? AND is_active=1",
                    &[email.into()],
                )
                .await?;
                if http::text(&input, "password").is_empty()
                    || http::text(&input, "password").len() > 72
                {
                    return http::error(401, "Invalid email or password");
                }
                let valid = user
                    .as_ref()
                    .and_then(|u| u.password_hash.as_ref())
                    .map(|h| bcrypt::verify(http::text(&input, "password"), h).unwrap_or(false))
                    .unwrap_or(false);
                if !valid {
                    return http::error(401, "Invalid email or password");
                }
                let user = user.ok_or_else(|| Error::RustError("Missing user".into()))?;
                let token = format!("{}{}", db::id(), db::id());
                db::run(
                    &db,
                    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)",
                    &[
                        digest(&token).into(),
                        user.id.clone().into(),
                        (db::now() + 604800).into(),
                    ],
                )
                .await?;
                let mut output = user.public();
                output["success"] = json!(true);
                output["token"] = json!(token);
                http::ok(output)
            }
            "/invite" => {
                let exists: Option<Value> =
                    db::first(&db, "SELECT id FROM users LIMIT 1", &[]).await?;
                let actor = authenticate(&req, &self.env).await?;
                let role = if exists.is_none() {
                    let expected = http::secret(&self.env, "INITIAL_SETUP_TOKEN")?;
                    let supplied = req.headers().get("X-Setup-Token")?.unwrap_or_default();
                    if expected.len() < 24 || digest(&supplied) != digest(&expected) {
                        return http::error(403, "Valid setup token required");
                    }
                    "admin"
                } else {
                    if !actor.is_some_and(|u| u.role == "admin") {
                        return http::error(403, "Admin access required");
                    }
                    if http::text(&input, "role") == "admin" {
                        "admin"
                    } else {
                        "user"
                    }
                };
                let email = http::text(&input, "email").trim().to_lowercase();
                if !email.contains('@') || email.len() > 254 {
                    return http::error(400, "Invalid email");
                }
                if db::first::<Value>(
                    &db,
                    "SELECT id FROM users WHERE email=?",
                    &[email.clone().into()],
                )
                .await?
                .is_some()
                {
                    return http::error(409, "Email is already registered");
                }
                let password = http::text(&input, "password");
                if !password.is_empty() && !(12..=72).contains(&password.len()) {
                    return http::error(400, "Password must be 12–72 bytes");
                }
                let setup = format!("{}{}", db::id(), db::id());
                let hash = if password.is_empty() {
                    None
                } else {
                    Some(
                        bcrypt::hash(password, bcrypt::DEFAULT_COST)
                            .map_err(|e| Error::RustError(e.to_string()))?,
                    )
                };
                let profile = json!({"first_name":input["first_name"],"last_name":input["last_name"],"nickname":input["nickname"],"position":input["position"]});
                let id = db::id();
                // The first-admin check is repeated inside the INSERT to prevent concurrent bootstrap races.
                let is_first = exists.is_none();
                let result=db::statement(&db,"INSERT INTO users(id,email,role,password_hash,setup_token_hash,is_active,profile,discord_id,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE ?=0 OR NOT EXISTS(SELECT 1 FROM users)",&[id.into(),email.into(),role.into(),hash.clone().into(),if hash.is_none(){Some(digest(&setup))}else{None}.into(),i32::from(hash.is_some()).into(),profile.to_string().into(),input["discord_id"].as_str().map(str::to_owned).into(),db::timestamp().into(),i32::from(is_first).into()])?.run().await?;
                if result.meta()?.and_then(|m| m.changes).unwrap_or(0) == 0 {
                    return http::error(409, "Initialization already completed");
                }
                if hash.is_some() {
                    http::ok(json!({"success":true,"activated":true}))
                } else {
                    http::ok(
                        json!({"success":true,"setup_link":format!("/setup-password?token={setup}")}),
                    )
                }
            }
            "/setup-password" => {
                let password = http::text(&input, "password");
                if !(12..=72).contains(&password.len()) {
                    return http::error(400, "Password must be 12–72 bytes");
                }
                let hash = bcrypt::hash(password, bcrypt::DEFAULT_COST)
                    .map_err(|e| Error::RustError(e.to_string()))?;
                let updated:Option<Value>=db::first(&db,"UPDATE users SET password_hash=?,setup_token_hash=NULL,is_active=1 WHERE setup_token_hash=? RETURNING email",&[hash.into(),digest(http::text(&input,"token")).into()]).await?;
                match updated {
                    Some(u) => http::ok(json!({"success":true,"email":u["email"]})),
                    None => http::error(400, "Invalid setup token"),
                }
            }
            _ => http::error(404, "Not found"),
        }
    }
}
