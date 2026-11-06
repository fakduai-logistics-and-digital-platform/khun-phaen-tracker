use crate::{auth::User, db, http};
use serde::Deserialize;
use serde_json::{json, Value};
use worker::*;

/// Workzy is optional: no `WORKZY_API_URL` means the integration is off.
fn base(env: &Env) -> Option<String> {
    let url = http::setting(env, "WORKZY_API_URL").trim_end_matches('/').to_owned();
    (url.starts_with("https://") || url.starts_with("http://localhost") || url.starts_with("http://127.0.0.1"))
        .then_some(url)
}

#[derive(Deserialize)]
struct Link {
    employee_code: String,
    token: String,
}

async fn link(db: &D1Database, user: &User) -> Result<Option<Link>> {
    db::first(
        db,
        "SELECT employee_code,token FROM workzy_links WHERE user_id=?",
        &[user.id.clone().into()],
    )
    .await
}

async fn call(url: &str, method: Method, bearer: Option<&str>, body: Option<Value>) -> Result<(u16, Value)> {
    let headers = Headers::new();
    headers.set("Content-Type", "application/json")?;
    if let Some(token) = bearer {
        headers.set("Authorization", &format!("Bearer {token}"))?;
    }
    let mut init = RequestInit::new();
    init.with_method(method)
        .with_headers(headers)
        .with_redirect(RequestRedirect::Manual);
    if let Some(body) = body {
        init.with_body(Some(body.to_string().into()));
    }
    let mut response = Fetch::Request(Request::new_with_init(url, &init)?)
        .send()
        .await
        .map_err(|_| Error::RustError("Workzy request failed".into()))?;
    let status = response.status_code();
    Ok((status, response.json().await.unwrap_or(Value::Null)))
}

/// The few fields the work-time card needs, taken from Workzy's `work-time-state` response.
pub fn summarize(state: &Value) -> Value {
    let data = &state["data"];
    let session = &data["session"];
    let policy = &data["day"]["policy"];
    json!({
        "connected": true,
        "configured": data["configured"],
        "server_now": data["serverNow"],
        "date": data["day"]["date"],
        "day_target": data["day"]["target"],
        "day_worked": data["day"]["worked"],
        "break_start": policy["breakStart"],
        "break_end": policy["breakEnd"],
        "check_in": session["checkIn"],
        "credited_start": session["creditedStart"],
        "target_at": session["targetAt"],
        "closed_at": session["closedAt"],
    })
}

pub async fn handle(req: &mut Request, env: &Env, user: &User, parts: &[&str]) -> Result<Response> {
    let db = env.d1("DB")?;
    let Some(base) = base(env) else {
        return match (req.method(), parts.get(3)) {
            (Method::Get, None) => http::ok(json!({"enabled":false,"connected":false})),
            _ => http::error(404, "Workzy integration is not enabled"),
        };
    };
    match (req.method(), parts.get(3).copied()) {
        (Method::Get, None) => {
            let linked = link(&db, user).await?;
            http::ok(json!({
                "enabled": true,
                "connected": linked.is_some(),
                "employee_code": linked.map(|l| l.employee_code),
            }))
        }
        (Method::Post, None) => {
            let input = http::body(req).await?;
            let code = http::text(&input, "code").trim().to_owned();
            let password = http::text(&input, "password");
            if code.is_empty() || password.is_empty() || code.len() > 64 || password.len() > 128 {
                return http::error(400, "Employee code and password are required");
            }
            let (status, login) = call(
                &format!("{base}/auth/login"),
                Method::Post,
                None,
                Some(json!({"username": code, "password": password})),
            )
            .await?;
            let jwt = login["data"]["token"].as_str().unwrap_or_default();
            if !(200..300).contains(&status) || jwt.is_empty() {
                return http::error(401, "Invalid Workzy employee code or password");
            }
            if login["data"]["user"]["role"].as_str() != Some("employee") {
                return http::error(403, "Only Workzy employee accounts can be linked");
            }
            let (status, issued) = call(
                &format!("{base}/employee/integration-token"),
                Method::Post,
                Some(jwt),
                Some(json!({})),
            )
            .await?;
            let token = issued["data"]["token"].as_str().unwrap_or_default();
            if status != 201 || token.is_empty() {
                return http::error(502, "Workzy did not issue an integration token");
            }
            let employee_code = login["data"]["user"]["code"].as_str().unwrap_or(&code).to_owned();
            db::run(
                &db,
                "INSERT INTO workzy_links(user_id,employee_code,token,created_at) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET employee_code=excluded.employee_code,token=excluded.token,created_at=excluded.created_at",
                &[user.id.clone().into(), employee_code.clone().into(), token.into(), db::timestamp().into()],
            )
            .await?;
            http::ok(json!({"enabled":true,"connected":true,"employee_code":employee_code}))
        }
        (Method::Delete, None) => {
            db::run(&db, "DELETE FROM workzy_links WHERE user_id=?", &[user.id.clone().into()]).await?;
            http::ok(json!({"enabled":true,"connected":false}))
        }
        (Method::Get, Some("today")) => {
            let Some(linked) = link(&db, user).await? else {
                return http::ok(json!({"connected":false}));
            };
            let (status, state) = call(
                &format!("{base}/integrations/work-time-state"),
                Method::Get,
                Some(&linked.token),
                None,
            )
            .await?;
            if status == 401 {
                // Revoked or replaced on the Workzy side: unlink so the UI offers to reconnect.
                db::run(&db, "DELETE FROM workzy_links WHERE user_id=?", &[user.id.clone().into()]).await?;
                return http::ok(json!({"connected":false}));
            }
            if status != 200 {
                return http::error(502, "Workzy is unavailable");
            }
            http::ok(summarize(&state))
        }
        _ => http::error(404, "Not found"),
    }
}

#[cfg(test)]
mod tests {
    use super::summarize;
    use serde_json::json;

    #[test]
    fn keeps_only_the_card_fields() {
        let state = json!({"data":{
            "configured": true, "serverNow": "2026-11-24T05:00:00.000Z",
            "account": {"balance": 3600},
            "day": {"date":"2026-11-24","target":28800,"worked":0,"policy":{"breakStart":"12:00","breakEnd":"13:00","employeeCodes":[]}},
            "session": {"checkIn":"2026-11-24T02:00:00.000Z","creditedStart":"2026-11-24T02:00:00.000Z","targetAt":"2026-11-24T11:00:00.000Z","closedAt":null}
        }});
        let out = summarize(&state);
        assert_eq!(out["connected"], true);
        assert_eq!(out["day_target"], 28800);
        assert_eq!(out["break_start"], "12:00");
        assert_eq!(out["target_at"], "2026-11-24T11:00:00.000Z");
        assert!(out.get("account").is_none());
    }

    #[test]
    fn no_session_means_not_checked_in() {
        let out = summarize(&json!({"data":{"configured":true,"serverNow":"x","day":null,"session":null}}));
        assert!(out["check_in"].is_null());
        assert!(out["day_target"].is_null());
    }
}
