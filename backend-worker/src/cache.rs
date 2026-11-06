use worker::*;
/// Public QA pages may be this many seconds stale. KV's free tier allows 1k writes a day, so cache
/// misses must stay rare; every KV failure falls back to D1 instead of failing the request.
const PUBLIC_TTL: u64 = 300;
pub fn public_key(req: &Request) -> Result<Option<String>> {
    let url = req.url()?;
    let key = match url.query() {
        Some(q) => format!("public:{}?{q}", url.path()),
        None => format!("public:{}", url.path()),
    };
    Ok((key.len() <= 512).then_some(key))
}
pub async fn get(env: &Env, key: &str) -> Option<String> {
    env.kv("CACHE").ok()?.get(key).text().await.ok().flatten()
}
pub async fn put(env: &Env, key: &str, body: &str) {
    if let Ok(builder) = env.kv("CACHE").and_then(|kv| kv.put(key, body).map_err(Into::into)) {
        let _ = builder.expiration_ttl(PUBLIC_TTL).execute().await;
    }
}
pub fn json(body: String) -> Result<Response> {
    let mut response = Response::ok(body)?;
    response.headers_mut().set("Content-Type", "application/json")?;
    Ok(response)
}
