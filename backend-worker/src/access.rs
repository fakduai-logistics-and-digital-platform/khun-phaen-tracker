//! Sign-in with Cloudflare Access.
//!
//! An Access application protects only `/api/auth/access/login`. Access authenticates the visitor with the
//! configured identity provider and forwards the request with a signed `Cf-Access-Jwt-Assertion` header. This
//! module verifies that JWT, matches its email to an existing active user, creates a normal session and sends the
//! browser back to the frontend with the session token in the URL fragment (fragments are never sent to servers).
//! Nothing here creates users.
use crate::{auth, db, http};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rsa::{BigUint, Pkcs1v15Sign, RsaPublicKey};
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use worker::*;

const CLOCK_SKEW_SECONDS: i64 = 30;

#[derive(Deserialize)]
pub struct Jwk {
    kid: String,
    kty: String,
    n: String,
    e: String,
}
#[derive(Deserialize)]
pub struct Jwks {
    keys: Vec<Jwk>,
}

struct Config {
    team: String,
    aud: String,
    return_origins: Vec<String>,
}

fn config(env: &Env) -> Option<Config> {
    let team = http::setting(env, "ACCESS_TEAM_DOMAIN")
        .trim()
        .trim_start_matches("https://")
        .trim_end_matches('/')
        .to_owned();
    let aud = http::setting(env, "ACCESS_AUD").trim().to_owned();
    if team.is_empty() || aud.is_empty() {
        return None;
    }
    let return_origins = http::setting(env, "ACCESS_RETURN_ORIGINS")
        .split(',')
        .map(|v| v.trim().trim_end_matches('/').to_owned())
        .filter(|v| !v.is_empty())
        .collect();
    Some(Config {
        team,
        aud,
        return_origins,
    })
}

fn decode(part: &str) -> std::result::Result<Vec<u8>, &'static str> {
    URL_SAFE_NO_PAD.decode(part).map_err(|_| "Malformed token")
}

/// Verifies an Access JWT (RS256) and returns the lowercase email claim.
pub fn verify(
    token: &str,
    jwks: &Jwks,
    team: &str,
    aud: &str,
    now: i64,
) -> std::result::Result<String, &'static str> {
    let mut parts = token.split('.');
    let (Some(header), Some(payload), Some(signature), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return Err("Malformed token");
    };
    let header_part = header;
    let header: Value = serde_json::from_slice(&decode(header_part)?).map_err(|_| "Malformed token")?;
    if header.get("alg").and_then(Value::as_str) != Some("RS256") {
        return Err("Unsupported algorithm");
    }
    let kid = header.get("kid").and_then(Value::as_str).unwrap_or_default();
    let jwk = jwks
        .keys
        .iter()
        .find(|k| k.kid == kid && k.kty == "RSA")
        .ok_or("Unknown signing key")?;
    let key = RsaPublicKey::new(
        BigUint::from_bytes_be(&decode(&jwk.n)?),
        BigUint::from_bytes_be(&decode(&jwk.e)?),
    )
    .map_err(|_| "Invalid signing key")?;
    let signed = format!("{header_part}.{payload}");
    key.verify(
        Pkcs1v15Sign::new::<Sha256>(),
        &Sha256::digest(signed.as_bytes()),
        &decode(signature)?,
    )
    .map_err(|_| "Invalid signature")?;

    let claims: Value = serde_json::from_slice(&decode(payload)?).map_err(|_| "Malformed token")?;
    if claims.get("iss").and_then(Value::as_str) != Some(&format!("https://{team}")) {
        return Err("Wrong issuer");
    }
    let audience_ok = match claims.get("aud") {
        Some(Value::String(v)) => v == aud,
        Some(Value::Array(list)) => list.iter().any(|v| v.as_str() == Some(aud)),
        _ => false,
    };
    if !audience_ok {
        return Err("Wrong audience");
    }
    let exp = claims.get("exp").and_then(Value::as_i64).ok_or("Missing expiry")?;
    if exp + CLOCK_SKEW_SECONDS < now {
        return Err("Token expired");
    }
    if claims
        .get("nbf")
        .and_then(Value::as_i64)
        .is_some_and(|nbf| nbf - CLOCK_SKEW_SECONDS > now)
    {
        return Err("Token not yet valid");
    }
    let email = claims
        .get("email")
        .and_then(Value::as_str)
        .map(|v| v.trim().to_lowercase())
        .filter(|v| v.contains('@'))
        .ok_or("Missing email")?;
    Ok(email)
}

/// `return` must be an absolute URL whose origin is listed in ACCESS_RETURN_ORIGINS (no open redirect).
fn return_url(req: &Request, config: &Config) -> Option<Url> {
    let url = req.url().ok()?;
    let value = url.query_pairs().find(|(k, _)| k == "return")?.1.into_owned();
    let target = Url::parse(&value).ok()?;
    let origin = target.origin().ascii_serialization();
    config
        .return_origins
        .iter()
        .any(|allowed| *allowed == origin)
        .then_some(target)
}

fn redirect(mut target: Url, key: &str, value: &str, fragment: bool) -> Result<Response> {
    if fragment {
        target.set_fragment(Some(&format!("{key}={value}")));
    } else {
        target.query_pairs_mut().append_pair(key, value);
    }
    let mut response = Response::redirect_with_status(target, 302)?;
    response.headers_mut().set("Cache-Control", "no-store")?;
    response.headers_mut().set("Referrer-Policy", "no-referrer")?;
    Ok(response)
}

async fn signing_keys(config: &Config) -> Result<Jwks> {
    let mut init = RequestInit::new();
    init.with_cf_properties(CfProperties {
        cache_ttl: Some(3600),
        cache_everything: Some(true),
        ..CfProperties::default()
    });
    let request = Request::new_with_init(
        &format!("https://{}/cdn-cgi/access/certs", config.team),
        &init,
    )?;
    Fetch::Request(request).send().await?.json().await
}

pub fn status(env: &Env) -> Result<Response> {
    http::ok(json!({"enabled": config(env).is_some()}))
}

pub async fn login(req: &Request, env: &Env) -> Result<Response> {
    let Some(config) = config(env) else {
        return http::error(404, "Cloudflare Access sign-in is not enabled");
    };
    let Some(target) = return_url(req, &config) else {
        return http::error(400, "Invalid return URL");
    };
    let Some(assertion) = req.headers().get("Cf-Access-Jwt-Assertion")? else {
        // Access did not run in front of this path, so there is no identity to trust.
        return http::error(401, "Cloudflare Access assertion missing");
    };
    let email = match verify(&assertion, &signing_keys(&config).await?, &config.team, &config.aud, db::now()) {
        Ok(email) => email,
        Err(_) => return redirect(target, "access_error", "denied", false),
    };
    let database = env.d1("DB")?;
    let user: Option<auth::User> = db::first(
        &database,
        "SELECT * FROM users WHERE email=? AND is_active=1",
        &[email.into()],
    )
    .await?;
    let Some(user) = user else {
        return redirect(target, "access_error", "not_registered", false);
    };
    let token = format!("{}{}", db::id(), db::id());
    db::run(
        &database,
        "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)",
        &[
            auth::digest(&token).into(),
            user.id.into(),
            (db::now() + 604800).into(),
        ],
    )
    .await?;
    redirect(target, "access_token", &token, true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rsa::traits::PublicKeyParts;
    use rsa::RsaPrivateKey;

    const TEAM: &str = "acme.cloudflareaccess.com";
    const AUD: &str = "aud-tag-1";
    const NOW: i64 = 1_800_000_000;

    fn b64(bytes: &[u8]) -> String {
        URL_SAFE_NO_PAD.encode(bytes)
    }

    fn fixture() -> (RsaPrivateKey, Jwks) {
        let key = RsaPrivateKey::new(&mut rand::thread_rng(), 2048).unwrap();
        let jwks = Jwks {
            keys: vec![Jwk {
                kid: "k1".into(),
                kty: "RSA".into(),
                n: b64(&key.n().to_bytes_be()),
                e: b64(&key.e().to_bytes_be()),
            }],
        };
        (key, jwks)
    }

    fn sign(key: &RsaPrivateKey, header: Value, claims: Value) -> String {
        let signing = format!("{}.{}", b64(header.to_string().as_bytes()), b64(claims.to_string().as_bytes()));
        let signature = key
            .sign(Pkcs1v15Sign::new::<Sha256>(), &Sha256::digest(signing.as_bytes()))
            .unwrap();
        format!("{signing}.{}", b64(&signature))
    }

    fn claims() -> Value {
        json!({"iss": format!("https://{TEAM}"), "aud": [AUD], "exp": NOW + 600, "email": "Boss@Example.com"})
    }

    fn header() -> Value {
        json!({"alg": "RS256", "kid": "k1"})
    }

    #[test]
    fn accepts_valid_token_and_lowercases_email() {
        let (key, jwks) = fixture();
        let token = sign(&key, header(), claims());
        assert_eq!(verify(&token, &jwks, TEAM, AUD, NOW), Ok("boss@example.com".into()));
    }

    #[test]
    fn rejects_bad_tokens() {
        let (key, jwks) = fixture();
        let (other, _) = fixture();
        let bad = |token: String| verify(&token, &jwks, TEAM, AUD, NOW).unwrap_err();

        assert_eq!(bad(sign(&other, header(), claims())), "Invalid signature");
        assert_eq!(bad(sign(&key, json!({"alg": "none", "kid": "k1"}), claims())), "Unsupported algorithm");
        assert_eq!(bad(sign(&key, json!({"alg": "RS256", "kid": "zzz"}), claims())), "Unknown signing key");
        assert_eq!(bad(sign(&key, header(), json!({"iss": "https://evil.example", "aud": [AUD], "exp": NOW + 60, "email": "a@b.c"}))), "Wrong issuer");
        assert_eq!(bad(sign(&key, header(), json!({"iss": format!("https://{TEAM}"), "aud": ["other"], "exp": NOW + 60, "email": "a@b.c"}))), "Wrong audience");
        assert_eq!(bad(sign(&key, header(), json!({"iss": format!("https://{TEAM}"), "aud": [AUD], "exp": NOW - 600, "email": "a@b.c"}))), "Token expired");
        assert_eq!(bad(sign(&key, header(), json!({"iss": format!("https://{TEAM}"), "aud": [AUD], "exp": NOW + 60}))), "Missing email");
        assert_eq!(bad("not.a.jwt.at.all".into()), "Malformed token");
        assert_eq!(bad("onlyone".into()), "Malformed token");
    }

    #[test]
    fn rejects_tampered_payload() {
        let (key, jwks) = fixture();
        let token = sign(&key, header(), claims());
        let mut parts: Vec<_> = token.split('.').map(str::to_owned).collect();
        parts[1] = b64(json!({"iss": format!("https://{TEAM}"), "aud": [AUD], "exp": NOW + 600, "email": "attacker@example.com"}).to_string().as_bytes());
        assert_eq!(verify(&parts.join("."), &jwks, TEAM, AUD, NOW), Err("Invalid signature"));
    }

    #[test]
    fn accepts_string_audience() {
        let (key, jwks) = fixture();
        let token = sign(&key, header(), json!({"iss": format!("https://{TEAM}"), "aud": AUD, "exp": NOW + 60, "email": "a@b.c"}));
        assert_eq!(verify(&token, &jwks, TEAM, AUD, NOW), Ok("a@b.c".into()));
    }
}
