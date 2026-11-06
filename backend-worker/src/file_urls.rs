use crate::{auth::User, db, http, s3_client, workspaces};
use hmac::{Hmac, Mac};
use serde_json::{json, Value};
use sha2::Sha256;
use std::collections::HashMap;
use wasm_bindgen::{JsCast, JsValue};
use worker::*;

/// `<img src>` cannot send a bearer token, so the API signs short-lived file URLs after its normal
/// access check. Expiry is rounded to the hour so URLs stay stable and the browser can cache them;
/// a URL therefore stays valid for 1–2 hours after access is revoked.
const THUMB_WIDTH: &str = "320";
const THUMB_TYPES: [&str; 4] = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_SOURCE: usize = 20 * 1024 * 1024;

fn signer(env: &Env) -> Result<Hmac<Sha256>> {
    let secret = http::secret(env, "CONFIG_ENCRYPTION_KEY")?;
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes())
        .map_err(|_| Error::RustError("Invalid signing key".into()))?;
    mac.update(b"file-url:v1\n");
    Ok(mac)
}
fn signature(env: &Env, key: &str, exp: i64) -> Result<String> {
    let mut mac = signer(env)?;
    mac.update(format!("{exp}\n{key}").as_bytes());
    Ok(mac.finalize().into_bytes()[..16]
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect())
}
pub fn verify(env: &Env, key: &str, exp: &str, sig: &str) -> Result<bool> {
    let Ok(exp) = exp.parse::<i64>() else {
        return Ok(false);
    };
    if exp < db::now() || sig.len() != 32 || !sig.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Ok(false);
    }
    let bytes: Vec<u8> = (0..16)
        .filter_map(|i| u8::from_str_radix(&sig[i * 2..i * 2 + 2], 16).ok())
        .collect();
    let mut mac = signer(env)?;
    mac.update(format!("{exp}\n{key}").as_bytes());
    Ok(mac.verify_truncated_left(&bytes).is_ok())
}

/// POST /api/files/sign {keys:[...]} → {urls:{key:path}} for the keys the caller may read.
pub async fn sign(req: &mut Request, env: &Env, user: &User) -> Result<Response> {
    let input = http::body(req).await?;
    let keys: Vec<String> = input["keys"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|v| v.as_str().map(str::to_owned))
        .take(200)
        .collect();
    #[derive(serde::Deserialize)]
    struct Row {
        file_key: String,
        workspace_id: String,
    }
    let rows: Vec<Row> = db::all(&env.d1("DB")?,"SELECT o.file_key,o.workspace_id FROM stored_objects o WHERE o.file_key IN(SELECT value FROM json_each(?)) AND EXISTS(SELECT 1 FROM documents d WHERE d.id=o.document_id)",&[json!(keys).to_string().into()]).await?;
    let mut allowed = HashMap::new();
    let exp = (db::now() / 3600 + 2) * 3600;
    let mut urls = serde_json::Map::new();
    for row in rows {
        if !allowed.contains_key(&row.workspace_id) {
            let ok = workspaces::access(env, user, &row.workspace_id)
                .await?
                .is_some();
            allowed.insert(row.workspace_id.clone(), ok);
        }
        if allowed[&row.workspace_id] {
            let sig = signature(env, &row.file_key, exp)?;
            urls.insert(
                row.file_key.clone(),
                json!(format!("/api/files/{}?exp={exp}&sig={sig}", row.file_key)),
            );
        }
    }
    http::ok(json!({"success":true,"urls":Value::Object(urls)}))
}

/// Serves a signed file. With `w=320`, image types get a WebP thumbnail that is generated once by
/// the Images binding and stored next to the original, so later requests cost no transformation.
pub async fn serve(env: &Env, key: &str, query: &HashMap<String, String>) -> Result<Response> {
    #[derive(serde::Deserialize)]
    struct Object {
        metadata: String,
    }
    let object: Option<Object> = db::first(&env.d1("DB")?,"SELECT o.metadata FROM stored_objects o WHERE o.file_key=? AND EXISTS(SELECT 1 FROM documents d WHERE d.id=o.document_id)",&[key.into()]).await?;
    let Some(object) = object else {
        return http::error(404, "File not found");
    };
    let mime = serde_json::from_str::<Value>(&object.metadata)
        .ok()
        .and_then(|m| m["mime_type"].as_str().map(str::to_owned))
        .unwrap_or_default();
    if query.get("w").map(String::as_str) == Some(THUMB_WIDTH)
        && THUMB_TYPES.contains(&mime.as_str())
    {
        let thumb_key = thumb_key(key);
        let mut cached = s3_client::request(env, Method::Get, &thumb_key, None, "").await?;
        if cached.status_code() == 200 {
            let bytes = cached.bytes().await?;
            return image(bytes, "image/webp");
        }
        let mut original = s3_client::request(env, Method::Get, key, None, "").await?;
        if original.status_code() != 200 {
            return http::error(502, "RustFS download failed");
        }
        let source = http::bytes_from_response(&mut original, MAX_SOURCE).await?;
        match thumbnail(env, &source).await {
            Ok(bytes) => {
                let _ = s3_client::request(
                    env,
                    Method::Put,
                    &thumb_key,
                    Some(bytes.clone()),
                    "image/webp",
                )
                .await;
                return image(bytes, "image/webp");
            }
            // Over the Images quota or an unreadable image: the original still renders.
            Err(_) => return image(source, &mime),
        }
    }
    let response = s3_client::request(env, Method::Get, key, None, "").await?;
    if response.status_code() != 200 {
        return http::error(502, "RustFS download failed");
    }
    let headers = Headers::new();
    for (k, v) in response.headers().entries() {
        headers.set(&k, &v)?;
    }
    headers.set("X-Content-Type-Options", "nosniff")?;
    headers.set("Content-Disposition", "attachment")?;
    headers.set("Cache-Control", "private, max-age=3600")?;
    Ok(response.with_headers(headers))
}
pub fn thumb_key(key: &str) -> String {
    format!("thumbs/{THUMB_WIDTH}/{key}.webp")
}
fn image(bytes: Vec<u8>, mime: &str) -> Result<Response> {
    let mut response = Response::from_bytes(bytes)?;
    let headers = response.headers_mut();
    headers.set("Content-Type", mime)?;
    headers.set("X-Content-Type-Options", "nosniff")?;
    headers.set("Cache-Control", "private, max-age=3600")?;
    Ok(response)
}

/// workers-rs has no Images wrapper, so this calls
/// `env.IMAGES.input(stream).transform({width}).output({format:"image/webp"})` through JS.
async fn thumbnail(env: &Env, source: &[u8]) -> Result<Vec<u8>> {
    use js_sys::{Function, Promise, Reflect};
    use wasm_bindgen_futures::JsFuture;
    let js = |e: JsValue| Error::RustError(format!("Images binding failed: {e:?}"));
    let call = |target: &JsValue, name: &str, args: &[JsValue]| -> Result<JsValue> {
        let f: Function = Reflect::get(target, &name.into())
            .map_err(js)?
            .dyn_into()
            .map_err(js)?;
        f.apply(target, &args.iter().collect::<js_sys::Array>())
            .map_err(js)
    };
    let images = Reflect::get(env, &"IMAGES".into()).map_err(js)?;
    if images.is_undefined() {
        return Err(Error::RustError("Images binding is not configured".into()));
    }
    let body: web_sys::Response = Response::from_bytes(source.to_vec())?.into();
    let stream: JsValue = body.body().map(Into::into).unwrap_or(JsValue::NULL);
    let handle = call(&images, "input", &[stream])?;
    let options = js_sys::Object::new();
    Reflect::set(&options, &"width".into(), &320.into()).map_err(js)?;
    Reflect::set(&options, &"fit".into(), &"scale-down".into()).map_err(js)?;
    let handle = call(&handle, "transform", &[options.into()])?;
    let output = js_sys::Object::new();
    Reflect::set(&output, &"format".into(), &"image/webp".into()).map_err(js)?;
    let result = JsFuture::from(Promise::from(call(&handle, "output", &[output.into()])?))
        .await
        .map_err(js)?;
    let response: web_sys::Response = call(&result, "response", &[])?.dyn_into().map_err(js)?;
    let mut response = Response::from(response);
    if response.status_code() != 200 {
        return Err(Error::RustError("Images binding failed".into()));
    }
    response.bytes().await
}
