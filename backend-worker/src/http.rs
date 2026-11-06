use futures_util::StreamExt;
use serde_json::{json, Value};
use worker::*;

pub fn error(status: u16, message: &str) -> Result<Response> {
    Ok(Response::from_json(&json!({"error":message}))?.with_status(status))
}
pub fn ok(value: Value) -> Result<Response> {
    Response::from_json(&value)
}
pub fn setting(env: &Env, key: &str) -> String {
    env.var(key).map(|v| v.to_string()).unwrap_or_default()
}
pub fn secret(env: &Env, key: &str) -> Result<String> {
    Ok(env.secret(key)?.to_string())
}
pub fn text<'a>(v: &'a Value, key: &str) -> &'a str {
    v.get(key).and_then(Value::as_str).unwrap_or("")
}
pub async fn bytes(req: &mut Request, limit: usize) -> Result<Vec<u8>> {
    if req
        .headers()
        .get("Content-Length")?
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(0)
        > limit
    {
        return Err(Error::RustError("Request too large".into()));
    }
    let mut stream = req.stream()?;
    let mut body = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        if body.len() + chunk.len() > limit {
            return Err(Error::RustError("Request too large".into()));
        }
        body.extend_from_slice(&chunk);
    }
    Ok(body)
}
pub async fn body(req: &mut Request) -> Result<Value> {
    serde_json::from_slice(&bytes(req, 262144).await?)
        .map_err(|_| Error::RustError("Invalid JSON body".into()))
}
/// `ALLOWED_ORIGIN` is `*` (any origin) or a comma-separated list. Any origin is safe only because
/// authentication is bearer-token only (see `auth::token`): browsers never attach it cross-site.
pub fn origin_allowed(allowed: &str, origin: &str) -> bool {
    allowed
        .split(',')
        .map(str::trim)
        .any(|entry| entry == "*" || entry == origin)
}
pub fn cors(response: Response, origin: Option<&str>, env: &Env) -> Result<Response> {
    let h = Headers::new();
    for (key, value) in response.headers().entries() {
        h.set(&key, &value)?;
    }
    if !h.has("Cache-Control")? {
        h.set("Cache-Control", "no-store")?;
    }
    h.set("Vary", "Origin")?;
    if let Some(origin) = origin.filter(|o| origin_allowed(&setting(env, "ALLOWED_ORIGIN"), o)) {
        h.set("Access-Control-Allow-Origin", origin)?;
        h.set("Access-Control-Allow-Credentials", "true")?;
        h.set(
            "Access-Control-Allow-Methods",
            "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        )?;
        h.set(
            "Access-Control-Allow-Headers",
            "Content-Type,Authorization,X-Setup-Token",
        )?;
    }
    Ok(response.with_headers(h))
}

pub async fn bytes_from_response(response: &mut Response, limit: usize) -> Result<Vec<u8>> {
    let mut stream = response.stream()?;
    let mut out = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        if out.len() + chunk.len() > limit {
            return Err(Error::RustError("Upstream response too large".into()));
        }
        out.extend_from_slice(&chunk);
    }
    Ok(out)
}

/// Convert domain failures before crossing a Durable Object RPC boundary.
pub fn failure(err: Error) -> Result<Response> {
    let message = err.to_string();
    if message == "Request too large" {
        error(413, &message)
    } else if message == "Storage is not configured" {
        error(503, &message)
    } else if message.starts_with("AI provider")
        || message == "Invalid AI provider response"
        || message == "Upstream response too large"
    {
        error(502, &message)
    } else if message.starts_with("RustFS") || message == "Invalid RustFS response" {
        error(502, &message)
    } else if message.starts_with("Invalid multipart")
        || message.starts_with("Invalid or oversized multipart")
        || message.starts_with("Too many files")
        || message == "Only image files are allowed"
    {
        error(400, &message)
    } else if message == "Invalid JSON body" {
        error(400, &message)
    } else {
        console_error!("Worker request failed (details suppressed)");
        error(500, "Request failed")
    }
}

#[cfg(test)]
mod tests {
    use super::origin_allowed;
    #[test]
    fn origin_list_and_wildcard() {
        assert!(origin_allowed("*", "http://localhost:3100"));
        assert!(origin_allowed(
            "https://a.example, http://localhost:3100",
            "http://localhost:3100"
        ));
        assert!(!origin_allowed("https://a.example", "https://evil.example"));
        assert!(!origin_allowed("", "https://a.example"));
    }
}
