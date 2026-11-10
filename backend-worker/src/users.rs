use crate::{
    auth::{self, User},
    db, http, workspaces,
};
use serde_json::{json, Value};
use worker::*;
pub async fn list(req: &Request, env: &Env, user: &User) -> Result<Response> {
    if user.role != "admin" {
        let q = crate::records::query(req)?;
        let workspace = q
            .get("workspace_id")
            .map(String::as_str)
            .unwrap_or_default();
        if !workspaces::access(env, user, workspace)
            .await?
            .is_some_and(|w| w.owner_id == user.id)
        {
            return http::error(403, "Admin or workspace owner required");
        }
    }
    let users: Vec<User> =
        db::all(&env.d1("DB")?, "SELECT * FROM users ORDER BY email", &[]).await?;
    http::ok(json!({"success":true,"users":users.iter().map(User::public).collect::<Vec<_>>()}))
}
/// Called inside AuthService so password hashing uses the DO CPU allowance.
pub async fn edit(req: &Request, env: &Env, input: &Value) -> Result<Response> {
    let Some(actor) = auth::authenticate(req, env).await? else {
        return http::error(401, "Not logged in");
    };
    let path = req.path();
    let own = path == "/me";
    let target = if own {
        actor.id.as_str()
    } else {
        path.trim_start_matches("/users/")
    };
    if !own && actor.role != "admin" {
        return http::error(403, "Admin required");
    }
    let db = env.d1("DB")?;
    let Some(current) =
        db::first::<User>(&db, "SELECT * FROM users WHERE id=?", &[target.into()]).await?
    else {
        return http::error(404, "User not found");
    };
    if req.method() == Method::Delete {
        if actor.id == target {
            return http::error(400, "Cannot delete your own account");
        }
        let owns: Option<Value> = db::first(
            &db,
            "SELECT id FROM workspaces WHERE owner_id=? LIMIT 1",
            &[target.into()],
        )
        .await?;
        if owns.is_some() {
            return http::error(
                409,
                "Delete or transfer owned workspaces before deleting this user",
            );
        }
        db.batch(vec![db::statement(&db,"UPDATE documents SET payload=json_set(payload,'$.user_id',NULL) WHERE kind='assignees' AND json_extract(payload,'$.user_id')=?",&[target.into()])?,db::statement(&db,"DELETE FROM users WHERE id=?",&[target.into()])?]).await?;
        return http::ok(json!({"success":true}));
    }
    let mut profile = serde_json::from_str::<Value>(&current.profile).unwrap_or(json!({}));
    for field in ["first_name", "last_name", "nickname", "position"] {
        if let Some(value) = input.get(field) {
            if !(value.is_null() || value.as_str().is_some_and(|s| s.len() <= 200)) {
                return http::error(400, "Invalid profile field");
            }
            if field == "position"
                && value.as_str() == Some("QA Tester")
                && actor.role != "admin"
                && profile[field] != *value
            {
                return http::error(403, "Only an admin can grant QA permissions");
            }
            profile[field] = value.clone();
        }
    }
    let email = if !own {
        input
            .get("email")
            .and_then(Value::as_str)
            .unwrap_or(&current.email)
            .trim()
            .to_lowercase()
    } else {
        current.email.clone()
    };
    if !email.contains('@') || email.len() > 254 {
        return http::error(400, "Invalid email");
    }
    if db::first::<Value>(
        &db,
        "SELECT id FROM users WHERE email=? AND id<>?",
        &[email.clone().into(), target.into()],
    )
    .await?
    .is_some()
    {
        return http::error(409, "Email is already registered");
    }
    let role = if own {
        current.role.as_str()
    } else {
        input
            .get("role")
            .and_then(Value::as_str)
            .unwrap_or(&current.role)
    };
    if !["admin", "user"].contains(&role) {
        return http::error(400, "Invalid role");
    }
    let active = if own {
        current.is_active
    } else {
        input
            .get("is_active")
            .and_then(Value::as_bool)
            .map(i32::from)
            .unwrap_or(current.is_active)
    };
    let password = http::text(input, "password");
    if !password.is_empty() && !(8..=72).contains(&password.len()) {
        return http::error(400, "Password must be 8–72 bytes");
    }
    let hash = if password.is_empty() {
        current.password_hash
    } else {
        Some(
            bcrypt::hash(password, bcrypt::DEFAULT_COST)
                .map_err(|e| Error::RustError(e.to_string()))?,
        )
    };
    let discord = input
        .get("discord_id")
        .map(|v| v.as_str().map(str::to_owned))
        .unwrap_or(current.discord_id);
    let result=db::statement(&db,"UPDATE users SET email=?,role=?,is_active=?,profile=?,discord_id=?,password_hash=? WHERE id=? AND (role<>'admin' OR (?='admin' AND ?=1) OR (SELECT COUNT(*) FROM users WHERE role='admin' AND is_active=1)>1)",&[email.into(),role.into(),active.into(),profile.to_string().into(),discord.into(),hash.into(),target.into(),role.into(),active.into()])?.run().await?;
    if result.meta()?.and_then(|m| m.changes).unwrap_or(0) == 0 {
        return http::error(409, "The last active administrator must remain active");
    }
    if !password.is_empty() {
        db::run(
            &db,
            "DELETE FROM sessions WHERE user_id=? AND token_hash<>?",
            &[
                target.into(),
                auth::digest(&auth::token(req).unwrap_or_default()).into(),
            ],
        )
        .await?;
    }
    http::ok(json!({"success":true}))
}
