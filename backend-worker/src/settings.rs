use crate::{auth::User, db, http};
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use worker::*;
fn secret_field(key: &str) -> bool {
    key.ends_with("api_key")
        || matches!(
            key,
            "access_key" | "secret_key" | "discord_webhook_url" | "line_notify_token"
        )
}
fn cipher(env: &Env) -> Result<Aes256Gcm> {
    let key = http::secret(env, "CONFIG_ENCRYPTION_KEY")?;
    if key.len() < 32 {
        return Err(Error::RustError(
            "CONFIG_ENCRYPTION_KEY must be configured".into(),
        ));
    }
    Aes256Gcm::new_from_slice(&Sha256::digest(key.as_bytes()))
        .map_err(|_| Error::RustError("Invalid configuration encryption key".into()))
}
pub fn encrypt(env: &Env, value: &Value) -> Result<Value> {
    let mut out = value.clone();
    for (k, v) in out.as_object_mut().into_iter().flatten() {
        if secret_field(k) {
            if let Some(text) = v.as_str().filter(|s| !s.is_empty()) {
                let mut nonce = [0u8; 12];
                getrandom::getrandom(&mut nonce)
                    .map_err(|_| Error::RustError("Secure random unavailable".into()))?;
                let bytes = cipher(env)?
                    .encrypt(Nonce::from_slice(&nonce), text.as_bytes())
                    .map_err(|_| Error::RustError("Configuration encryption failed".into()))?;
                let mut payload = nonce.to_vec();
                payload.extend(bytes);
                *v = json!(format!("enc:v1:{}", STANDARD.encode(payload)));
            }
        }
    }
    Ok(out)
}
pub fn decrypt(env: &Env, value: &Value) -> Result<Value> {
    let mut out = value.clone();
    for (k, v) in out.as_object_mut().into_iter().flatten() {
        if secret_field(k) {
            if let Some(text) = v.as_str().and_then(|s| s.strip_prefix("enc:v1:")) {
                let bytes = STANDARD
                    .decode(text)
                    .map_err(|_| Error::RustError("Invalid encrypted configuration".into()))?;
                if bytes.len() < 13 {
                    return Err(Error::RustError("Invalid encrypted configuration".into()));
                }
                let plain = cipher(env)?
                    .decrypt(Nonce::from_slice(&bytes[..12]), &bytes[12..])
                    .map_err(|_| Error::RustError("Configuration decryption failed".into()))?;
                *v = json!(String::from_utf8(plain)
                    .map_err(|_| Error::RustError("Invalid configuration encoding".into()))?);
            }
        }
    }
    Ok(out)
}
pub async fn load(env: &Env, key: &str) -> Result<Value> {
    #[derive(serde::Deserialize)]
    struct Row {
        payload: String,
    }
    let row = db::first::<Row>(
        &env.d1("DB")?,
        "SELECT payload FROM settings WHERE key=?",
        &[key.into()],
    )
    .await?;
    match row {
        Some(r) => decrypt(env, &serde_json::from_str::<Value>(&r.payload)?),
        None => Ok(json!({})),
    }
}
pub async fn save(env: &Env, key: &str, value: &Value) -> Result<()> {
    let encrypted = encrypt(env, value)?;
    db::run(&env.d1("DB")?,"INSERT INTO settings(key,payload,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at",&[key.into(),encrypted.to_string().into(),db::timestamp().into()]).await
}
pub async fn effective(env: &Env, key: &str) -> Result<Value> {
    let stored = load(env, key).await?;
    let mut out = json!({});
    if key == "storage" {
        for (field, name, default) in [
            ("provider", "STORAGE_PROVIDER", "env"),
            ("endpoint", "STORAGE_URL", ""),
            ("bucket", "STORAGE_BUCKET", "khunphaen-assets"),
            ("region", "STORAGE_REGION", "us-east-1"),
            ("access_key", "RUSTFS_ACCESS_KEY", ""),
            ("secret_key", "RUSTFS_SECRET_KEY", ""),
        ] {
            let value = env
                .secret(name)
                .map(|v| v.to_string())
                .or_else(|_| env.var(name).map(|v| v.to_string()))
                .unwrap_or_else(|_| default.into());
            out[field] = json!(value);
        }
    } else {
        for (prefix, env_prefix) in [
            ("embeddings", "AI_EMBEDDINGS"),
            ("llm", "AI_LLM"),
            ("tts", "AI_TTS"),
        ] {
            for suffix in ["url", "api_key", "model"] {
                let name = format!("{env_prefix}_{}", suffix.to_uppercase());
                let val = env
                    .secret(&name)
                    .map(|v| v.to_string())
                    .or_else(|_| env.var(&name).map(|v| v.to_string()))
                    .ok();
                out[format!("{prefix}_{suffix}")] = json!(val);
            }
        }
    }
    for (k, v) in stored.as_object().into_iter().flatten() {
        out[k] = v.clone();
    }
    Ok(out)
}
pub fn valid_url(text: &str) -> bool {
    Url::parse(text).ok().is_some_and(|u| {
        matches!(u.scheme(), "http" | "https")
            && u.host_str().is_some()
            && u.username().is_empty()
            && u.password().is_none()
            && u.fragment().is_none()
    })
}
pub async fn handle(
    req: &mut Request,
    env: &Env,
    user: &User,
    kind: &str,
    reset: bool,
) -> Result<Response> {
    if user.role != "admin" {
        return http::error(403, "Admin required");
    }
    if reset && req.method() == Method::Post {
        db::run(
            &env.d1("DB")?,
            "DELETE FROM settings WHERE key=?",
            &[kind.into()],
        )
        .await?;
    } else if req.method() == Method::Put {
        let input = http::body(req).await?;
        let fields: &[&str] = if kind == "storage" {
            &[
                "provider",
                "endpoint",
                "bucket",
                "region",
                "access_key",
                "secret_key",
            ]
        } else {
            &[
                "embeddings_url",
                "embeddings_api_key",
                "embeddings_model",
                "llm_url",
                "llm_api_key",
                "llm_model",
                "tts_url",
                "tts_api_key",
                "tts_model",
            ]
        };
        let mut value = crate::records::pick(&input, fields);
        for (k, v) in value.as_object().into_iter().flatten() {
            if !v.is_null() && !v.is_string() {
                return http::error(400, "Configuration values must be strings");
            }
            if (k.ends_with("_url") || k == "endpoint")
                && v.as_str().is_some_and(|s| !s.is_empty() && !valid_url(s))
            {
                return http::error(400, "Invalid provider URL");
            }
        }
        if kind == "storage" {
            if !["env", "s3"].contains(&http::text(&value, "provider")) {
                return http::error(400, "Invalid storage provider");
            }
            for key in ["bucket", "region", "access_key", "secret_key"] {
                if http::text(&value, key).trim().is_empty() {
                    return http::error(400, "Storage bucket, region and credentials are required");
                }
            }
            if http::text(&value, "endpoint").is_empty() {
                return http::error(400, "RustFS endpoint required");
            }
        }
        value["updated_at"] = json!(db::timestamp());
        save(env, kind, &value).await?;
    } else if req.method() != Method::Get {
        return http::error(405, "Method not allowed");
    }
    http::ok(json!({"success":true,"config":effective(env,kind).await?}))
}
