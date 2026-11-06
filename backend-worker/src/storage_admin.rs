use crate::{auth::User, db, http, records, s3_client, settings};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use worker::*;
#[derive(Deserialize, Default)]
#[serde(rename_all = "PascalCase")]
struct Listing {
    #[serde(default)]
    contents: Vec<Object>,
    #[serde(default)]
    next_continuation_token: Option<String>,
}
#[derive(Deserialize, Serialize, Default)]
#[serde(rename_all = "PascalCase")]
struct Object {
    key: String,
    #[serde(default)]
    size: u64,
    #[serde(default)]
    last_modified: Option<String>,
    #[serde(default, rename = "ETag")]
    etag: Option<String>,
}
async fn objects(env: &Env) -> Result<Vec<Object>> {
    let mut out = Vec::new();
    let mut token: Option<String> = None;
    let mut seen = std::collections::HashSet::new();
    loop {
        let mut query = vec![("list-type".into(), "2".into())];
        if let Some(token) = &token {
            query.push(("continuation-token".into(), token.clone()));
        }
        let mut response = s3_client::with_query(env, Method::Get, "", None, "", &query).await?;
        if response.status_code() != 200 {
            return Err(Error::RustError("RustFS request failed".into()));
        }
        let body = crate::http::bytes_from_response(&mut response, 4 * 1024 * 1024).await?;
        let text = String::from_utf8(body)
            .map_err(|_| Error::RustError("Invalid RustFS response".into()))?;
        let listing: Listing = quick_xml::de::from_str(&text)
            .map_err(|_| Error::RustError("Invalid RustFS response".into()))?;
        out.extend(listing.contents);
        token = listing.next_continuation_token.filter(|s| !s.is_empty());
        if token.is_none() {
            break;
        }
        if seen.len() >= 100 || !seen.insert(token.clone().unwrap_or_default()) {
            return Err(Error::RustError(
                "RustFS listing exceeded safe inspection limit".into(),
            ));
        }
    }
    out.sort_by(|a, b| {
        b.last_modified
            .cmp(&a.last_modified)
            .then(a.key.cmp(&b.key))
    });
    Ok(out)
}
pub async fn handle(req: &mut Request, env: &Env, user: &User, parts: &[&str]) -> Result<Response> {
    if user.role != "admin" {
        return http::error(403, "Admin required");
    }
    let config = settings::effective(env, "storage").await?;
    match parts.get(3).copied() {
        Some("stats") if req.method() == Method::Get => {
            let objects = objects(env).await?;
            let used = objects.iter().map(|o| o.size).sum::<u64>();
            let quota = http::setting(env, "STORAGE_QUOTA_GB")
                .parse::<u64>()
                .ok()
                .map(|v| v.saturating_mul(1024 * 1024 * 1024));
            http::ok(
                json!({"success":true,"provider":config["provider"],"bucket":config["bucket"],"region":config["region"],"endpoint":config["endpoint"],"used_bytes":used,"quota_bytes":quota,"remaining_bytes":quota.map(|q|q.saturating_sub(used)),"usage_percent":quota.map(|q|if q==0{0}else{((used as f64/q as f64)*100.0).round()as u64}),"object_count":objects.len()}),
            )
        }
        Some("objects") if req.method() == Method::Get => {
            let q = records::query(req)?;
            let (page, limit) = records::page(&q, 10, 100);
            let objects = objects(env).await?;
            let total = objects.len() as i64;
            let pages = ((total + limit - 1) / limit).max(1);
            let page = page.min(pages);
            let values=objects.into_iter().skip(((page-1)*limit)as usize).take(limit as usize).map(|o|json!({"key":o.key,"size_bytes":o.size,"last_modified":o.last_modified,"etag":o.etag})).collect::<Vec<_>>();
            http::ok(
                json!({"success":true,"bucket":config["bucket"],"objects":values,"total":total,"page":page,"limit":limit,"pages":pages}),
            )
        }
        Some("objects") if req.method() == Method::Delete && parts.len() >= 5 => {
            let key = decode_key(&parts[4..].join("/"))?;
            delete(env, &key).await?;
            http::ok(json!({"success":true}))
        }
        Some("objects") if req.method() == Method::Post && parts.get(4) == Some(&"bulk-delete") => {
            let input = http::body(req).await?;
            let Some(keys) = input["keys"].as_array() else {
                return http::error(400, "keys must be an array");
            };
            if keys.is_empty() || keys.len() > 1000 || keys.iter().any(|k| !k.is_string()) {
                return http::error(400, "Select 1–1000 object keys");
            }
            let mut deleted = 0;
            let mut failed = Vec::new();
            for key in keys.iter().filter_map(Value::as_str) {
                if delete(env, key).await.is_ok() {
                    deleted += 1
                } else {
                    failed.push(key);
                }
            }
            http::ok(
                json!({"success":failed.is_empty(),"deleted_count":deleted,"failed_keys":failed}),
            )
        }
        _ => http::error(404, "Not found"),
    }
}
fn decode_key(key: &str) -> Result<String> {
    // URL decoding uses the URL parser rather than treating '+' in object keys as a space.
    let query = format!("key={}", key.replace('+', "%2B"));
    Ok(Url::parse(&format!("https://internal/?{query}"))
        .map_err(|_| Error::RustError("Invalid storage key".into()))?
        .query_pairs()
        .next()
        .map(|(_, v)| v.into_owned())
        .unwrap_or_default())
}
async fn delete(env: &Env, key: &str) -> Result<()> {
    let response = s3_client::request(env, Method::Delete, key, None, "").await?;
    if !(200..300).contains(&response.status_code()) {
        return Err(Error::RustError("RustFS request failed".into()));
    }
    let db = env.d1("DB")?;
    // Keep all owning records consistent after an administrator removes an object.
    let files: Vec<Value> = db::all(
        &db,
        "SELECT document_id FROM stored_objects WHERE file_key=?",
        &[key.into()],
    )
    .await?;
    let mut stmts = Vec::new();
    for file in files {
        for field in ["images", "attachments"] {
            stmts.push(db::statement(&db,&format!("UPDATE documents SET payload=json_set(payload,'$.{field}',json(COALESCE((SELECT json_group_array(json(value)) FROM json_each(json_extract(payload,'$.{field}')) WHERE json_extract(value,'$.file_key')<>?),'[]'))) WHERE id=?"),&[key.into(),http::text(&file,"document_id").into()])?);
        }
    }
    stmts.push(db::statement(
        &db,
        "DELETE FROM stored_objects WHERE file_key=?",
        &[key.into()],
    )?);
    db.batch(stmts).await?;
    Ok(())
}
