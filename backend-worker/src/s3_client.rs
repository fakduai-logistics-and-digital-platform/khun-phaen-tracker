use crate::{db, http};
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use worker::*;
fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|v| format!("{v:02x}")).collect()
}
fn hash(bytes: &[u8]) -> String {
    hex(&Sha256::digest(bytes))
}
fn mac(key: &[u8], data: &str) -> Result<Vec<u8>> {
    let mut h = Hmac::<Sha256>::new_from_slice(key)
        .map_err(|_| Error::RustError("Invalid signing key".into()))?;
    h.update(data.as_bytes());
    Ok(h.finalize().into_bytes().to_vec())
}
fn encode(value: &str) -> String {
    value
        .bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (b as char).to_string()
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}
fn signature(secret: &str, region: &str, date: &str, string_to_sign: &str) -> Result<String> {
    let date_key = mac(format!("AWS4{secret}").as_bytes(), date)?;
    let region_key = mac(&date_key, region)?;
    let service_key = mac(&region_key, "s3")?;
    Ok(hex(&mac(
        &mac(&service_key, "aws4_request")?,
        string_to_sign,
    )?))
}
pub async fn with_query(
    env: &Env,
    method: Method,
    key: &str,
    body: Option<Vec<u8>>,
    content_type: &str,
    query: &[(String, String)],
) -> Result<Response> {
    let config = crate::settings::effective(env, "storage").await?;
    let endpoint = http::text(&config, "endpoint");
    let bucket = http::text(&config, "bucket");
    let region = http::text(&config, "region");
    let access = http::text(&config, "access_key");
    let secret = http::text(&config, "secret_key");
    if endpoint.is_empty() || access.is_empty() || secret.is_empty() {
        return Err(Error::RustError("Storage is not configured".into()));
    }
    if key.split('/').any(|p| matches!(p, "." | "..")) {
        return http::error(400, "Invalid storage key");
    }
    let mut url =
        Url::parse(&endpoint).map_err(|_| Error::RustError("Invalid storage URL".into()))?;
    if !matches!(url.scheme(), "http" | "https")
        || url.query().is_some()
        || url.fragment().is_some()
        || !url.username().is_empty()
    {
        return Err(Error::RustError("Invalid storage URL".into()));
    }
    let path = if key.is_empty() {
        format!("/{}", encode(bucket))
    } else {
        format!(
            "/{}/{}",
            encode(bucket),
            key.split('/').map(encode).collect::<Vec<_>>().join("/")
        )
    };
    url.set_path(&path);
    let mut query = query
        .iter()
        .map(|(k, v)| (encode(k), encode(v)))
        .collect::<Vec<_>>();
    query.sort();
    let query = query
        .into_iter()
        .map(|(k, v)| format!("{k}={v}"))
        .collect::<Vec<_>>()
        .join("&");
    if !query.is_empty() {
        url.set_query(Some(&query));
    }
    let host = match url.port() {
        Some(p) => format!("{}:{p}", url.host_str().unwrap_or_default()),
        None => url.host_str().unwrap_or_default().to_owned(),
    };
    let dt = chrono::DateTime::from_timestamp(db::now(), 0)
        .ok_or_else(|| Error::RustError("Invalid clock".into()))?;
    let date = dt.format("%Y%m%d").to_string();
    let timestamp = dt.format("%Y%m%dT%H%M%SZ").to_string();
    let payload_hash = hash(body.as_deref().unwrap_or_default());
    let canonical=format!("{}\n{}\n{}\nhost:{}\nx-amz-content-sha256:{}\nx-amz-date:{}\n\nhost;x-amz-content-sha256;x-amz-date\n{}",method.as_ref(),path,query,host,payload_hash,timestamp,payload_hash);
    let scope = format!("{date}/{region}/s3/aws4_request");
    let to_sign = format!(
        "AWS4-HMAC-SHA256\n{timestamp}\n{scope}\n{}",
        hash(canonical.as_bytes())
    );
    let sig = signature(&secret, &region, &date, &to_sign)?;
    let headers = Headers::new();
    headers.set("x-amz-content-sha256", &payload_hash)?;
    headers.set("x-amz-date", &timestamp)?;
    headers.set("Authorization",&format!("AWS4-HMAC-SHA256 Credential={access}/{scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature={sig}"))?;
    if !content_type.is_empty() {
        headers.set("Content-Type", content_type)?;
    }
    let mut init = RequestInit::new();
    init.with_method(method)
        .with_headers(headers)
        .with_redirect(RequestRedirect::Manual);
    if let Some(body) = body {
        init.with_body(Some(wasm_bindgen::JsValue::from(js_sys::Uint8Array::from(
            body.as_slice(),
        ))));
    }
    Fetch::Request(Request::new_with_init(url.as_str(), &init)?)
        .send()
        .await
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn signing_key_matches_aws_example() {
        // AWS IAM SigV4 documentation's signing key, shared by all AWS services.
        let k = mac(b"AWS4wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY", "20150830").unwrap();
        let k = mac(&k, "us-east-1").unwrap();
        let k = mac(&k, "iam").unwrap();
        assert_eq!(
            hex(&mac(&k, "aws4_request").unwrap()),
            "c4afb1cc5771d871763a393e44b703571b55cc28424d1a5e86da6ed3c154a4b9"
        );
    }
    #[test]
    fn s3_key_encoding_keeps_segments() {
        assert_eq!(encode("a b+ไทย"), "a%20b%2B%E0%B9%84%E0%B8%97%E0%B8%A2");
    }
}

pub async fn request(
    env: &Env,
    method: Method,
    key: &str,
    body: Option<Vec<u8>>,
    content_type: &str,
) -> Result<Response> {
    with_query(env, method, key, body, content_type, &[]).await
}
