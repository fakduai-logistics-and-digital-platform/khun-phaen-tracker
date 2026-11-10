use crate::{auth, auth::User, db, http};
use serde_json::{json, Value};
use worker::*;

pub const PREFIX: &str = "kp_";
const MAX_ACTIVE: i64 = 10;
/// Requests one key may make per fixed window. Agents loop fast, so this stops runaway spam, not normal use.
const RATE_LIMIT: i64 = 120;
const RATE_WINDOW_SECS: i64 = 60;

#[derive(serde::Deserialize)]
struct Count {
    total: i64,
}

pub fn is_key(token: &str) -> bool {
    token.starts_with(PREFIX)
}

/// Resolve the owner of an API key, recording last use at most once a minute.
pub async fn authenticate(env: &Env, token: &str) -> Result<Option<User>> {
    let db = env.d1("DB")?;
    let hash = auth::digest(token);
    let user: Option<User> = db::first(
        &db,
        "SELECT u.* FROM api_keys k JOIN users u ON u.id=k.user_id WHERE k.key_hash=? AND k.revoked_at IS NULL AND u.is_active=1",
        &[hash.clone().into()],
    )
    .await?;
    if user.is_some() {
        let now = db::now();
        db::run(
            &db,
            "UPDATE api_keys SET last_used_at=? WHERE key_hash=? AND (last_used_at IS NULL OR last_used_at<?)",
            &[(now as f64).into(), hash.into(), ((now - 60) as f64).into()],
        )
        .await?;
    }
    Ok(user)
}

#[derive(serde::Deserialize)]
struct Hits {
    attempts: i64,
}

/// Fixed-window limiter for a valid API key. Returns the seconds to wait when the key is over its limit.
/// Counted in the existing `auth_attempts` table, one row per key, so it needs no new storage.
pub async fn throttle(env: &Env, token: &str) -> Result<Option<i64>> {
    let now = db::now();
    let row: Option<Hits> = db::first(
        &env.d1("DB")?,
        "INSERT INTO auth_attempts(key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END, expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING attempts",
        &[
            format!("apikey:{}", auth::digest(token)).into(),
            ((now + RATE_WINDOW_SECS) as f64).into(),
            (now as f64).into(),
            (now as f64).into(),
        ],
    )
    .await?;
    Ok(row
        .filter(|r| r.attempts > RATE_LIMIT)
        .map(|_| RATE_WINDOW_SECS))
}

/// `/api/auth/api-keys[/{id}[/revoke]]`. Keys can never manage keys: a session login is required.
pub async fn handle(req: &mut Request, env: &Env, user: &User, parts: &[&str]) -> Result<Response> {
    if auth::token(req).is_some_and(|t| is_key(&t)) {
        return http::error(403, "API keys must be managed from a signed-in session");
    }
    let db = env.d1("DB")?;
    match (req.method(), parts.get(3).copied(), parts.get(4).copied()) {
        (Method::Get, None, _) => {
            let rows: Vec<Value> = db::all(
                &db,
                "SELECT id,name,prefix,created_at,last_used_at,revoked_at FROM api_keys WHERE user_id=? ORDER BY created_at DESC",
                &[user.id.clone().into()],
            )
            .await?;
            http::ok(json!({"success":true,"keys":rows}))
        }
        (Method::Post, None, _) => {
            let input = http::body(req).await?;
            let name = http::text(&input, "name").trim();
            if name.is_empty() || name.chars().count() > 64 {
                return http::error(400, "Key name is required (max 64 characters)");
            }
            let active: Option<Count> = db::first(
                &db,
                "SELECT COUNT(*) AS total FROM api_keys WHERE user_id=? AND revoked_at IS NULL",
                &[user.id.clone().into()],
            )
            .await?;
            if active.is_some_and(|c| c.total >= MAX_ACTIVE) {
                return http::error(400, "Too many active API keys; revoke one first");
            }
            let key = format!("{PREFIX}{}{}", db::id().replace('-', ""), db::id().replace('-', ""));
            let id = db::id();
            let created_at = db::timestamp();
            let prefix: String = key.chars().take(PREFIX.len() + 5).collect();
            db::run(
                &db,
                "INSERT INTO api_keys(id,user_id,name,prefix,key_hash,created_at) VALUES (?,?,?,?,?,?)",
                &[
                    id.clone().into(),
                    user.id.clone().into(),
                    name.into(),
                    prefix.clone().into(),
                    auth::digest(&key).into(),
                    created_at.clone().into(),
                ],
            )
            .await?;
            http::ok(json!({"success":true,"key":key,"item":{"id":id,"name":name,"prefix":prefix,"created_at":created_at,"last_used_at":null,"revoked_at":null}}))
        }
        (Method::Post, Some(id), Some("revoke")) => {
            db::run(
                &db,
                "UPDATE api_keys SET revoked_at=COALESCE(revoked_at,?) WHERE id=? AND user_id=?",
                &[db::timestamp().into(), id.into(), user.id.clone().into()],
            )
            .await?;
            http::ok(json!({"success":true}))
        }
        (Method::Delete, Some(id), None) => {
            db::run(
                &db,
                "DELETE FROM api_keys WHERE id=? AND user_id=?",
                &[id.into(), user.id.clone().into()],
            )
            .await?;
            http::ok(json!({"success":true}))
        }
        _ => http::error(404, "Not found"),
    }
}

#[cfg(test)]
mod tests {
    use super::is_key;
    #[test]
    fn recognises_key_prefix() {
        assert!(is_key("kp_abc"));
        assert!(!is_key("0123abcd"));
    }
}
