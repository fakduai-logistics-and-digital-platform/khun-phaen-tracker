use crate::{db, http, records, settings, workspaces::Workspace};
use chrono::{Datelike, TimeZone};
use serde::Deserialize;
use serde_json::{json, Value};
use worker::*;
pub fn next_run(config: &Value, after: i64) -> Option<i64> {
    if config["enabled"] != true {
        return None;
    }
    let time = chrono::NaiveTime::parse_from_str(http::text(config, "time"), "%H:%M").ok()?;
    let offset = chrono::FixedOffset::east_opt(7 * 3600)?;
    let now = chrono::DateTime::from_timestamp(after, 0)?.with_timezone(&offset);
    let days = config["days"].as_array()?;
    for n in 0..=7 {
        let date = now.date_naive() + chrono::Duration::days(n);
        if !days
            .iter()
            .any(|d| d.as_u64() == Some(date.weekday().num_days_from_sunday() as u64))
        {
            continue;
        }
        let stamp = offset
            .from_local_datetime(&date.and_time(time))
            .single()?
            .timestamp();
        if stamp > after {
            return Some(stamp);
        }
    }
    None
}
fn valid_webhook(env: &Env, text: &str) -> bool {
    let Ok(url) = Url::parse(text) else {
        return false;
    };
    if !url.username().is_empty() || url.password().is_some() || url.fragment().is_some() {
        return false;
    }
    let test_origin = http::setting(env, "NOTIFICATION_WEBHOOK_ORIGIN");
    if !test_origin.is_empty() && url.origin().ascii_serialization() == test_origin {
        return true;
    }
    url.scheme() == "https"
        && matches!(url.host_str(), Some("discord.com" | "discordapp.com"))
        && url.path().starts_with("/api/webhooks/")
}
pub async fn configure(req: &mut Request, env: &Env, workspace: &Workspace) -> Result<Response> {
    let old = workspace
        .notification_config
        .as_ref()
        .map(|s| serde_json::from_str::<Value>(s))
        .transpose()?
        .unwrap_or(json!({}));
    let mut config = settings::decrypt(env, &old)?;
    if config.as_object().is_none_or(|o| o.is_empty()) {
        config = json!({"enabled":false,"days":[1,2,3,4,5],"time":"09:00","notify_on_create":false,"notify_on_status_change":[],"discord_webhook_url":null,"line_notify_token":null,"last_sent_at":null});
    }
    if req.method() == Method::Get {
        return http::ok(json!({"success":true,"config":config}));
    }
    if req.method() != Method::Put {
        return http::error(405, "Method not allowed");
    }
    let input = http::body(req).await?;
    let patch = records::pick(
        &input,
        &[
            "enabled",
            "days",
            "time",
            "notify_on_create",
            "notify_on_status_change",
            "discord_webhook_url",
            "line_notify_token",
        ],
    );
    records::merge(&mut config, &patch);
    if !config["enabled"].is_boolean()
        || !config["notify_on_create"].is_boolean()
        || chrono::NaiveTime::parse_from_str(http::text(&config, "time"), "%H:%M").is_err()
    {
        return http::error(400, "Invalid notification schedule");
    }
    if !config["days"]
        .as_array()
        .is_some_and(|days| days.iter().all(|v| v.as_u64().is_some_and(|n| n <= 6)))
    {
        return http::error(400, "Schedule days must be between 0 and 6");
    }
    if !config["notify_on_status_change"]
        .as_array()
        .is_some_and(|a| {
            a.iter().all(|v| {
                v.as_str().is_some_and(|s| {
                    ["pending", "todo", "in-progress", "in-test", "tested", "done"].contains(&s)
                })
            })
        })
    {
        return http::error(400, "Invalid notification task status");
    }
    if !http::text(&config, "line_notify_token").trim().is_empty() {
        return http::error(
            400,
            "LINE Notify was retired on 2025-03-31; use a supported webhook",
        );
    }
    let webhook = http::text(&config, "discord_webhook_url");
    if !webhook.is_empty() && !valid_webhook(env, webhook) {
        return http::error(400, "Use a Discord webhook URL");
    }
    if config["enabled"] == true && webhook.is_empty() {
        return http::error(400, "An enabled schedule requires a webhook");
    }
    let db = env.d1("DB")?;
    let encrypted = settings::encrypt(env, &config)?;
    let mut writes = vec![db::statement(
        &db,
        "UPDATE workspaces SET notification_config=? WHERE id=?",
        &[encrypted.to_string().into(), workspace.id.clone().into()],
    )?];
    if let Some(next) = next_run(&config, db::now()) {
        writes.push(db::statement(&db,"INSERT INTO notification_schedules(workspace_id,next_run_at) VALUES(?,?) ON CONFLICT(workspace_id) DO UPDATE SET next_run_at=excluded.next_run_at,claimed_until=0",&[workspace.id.clone().into(),next.into()])?)
    } else {
        writes.push(db::statement(
            &db,
            "DELETE FROM notification_schedules WHERE workspace_id=?",
            &[workspace.id.clone().into()],
        )?);
    }
    db.batch(writes).await?;
    http::ok(json!({"success":true,"config":config}))
}
pub fn webhook_statement(
    env: &Env,
    db: &D1Database,
    workspace: &str,
    event: &str,
    url: &str,
    payload: Value,
    scheduled: Option<i64>,
) -> Result<D1PreparedStatement> {
    let encrypted = settings::encrypt(env, &json!({"discord_webhook_url":url}))?;
    db::statement(db,"INSERT OR IGNORE INTO webhook_jobs(id,event_key,workspace_id,url,payload,scheduled_for,created_at) VALUES(?,?,?,?,?,?,?)",&[db::id().into(),event.into(),workspace.into(),http::text(&encrypted,"discord_webhook_url").into(),payload.to_string().into(),scheduled.into(),db::timestamp().into()])
}
pub fn task_event(
    env: &Env,
    db: &D1Database,
    w: &Workspace,
    task: &Value,
    created: bool,
    old_status: &str,
) -> Result<Option<D1PreparedStatement>> {
    let Some(raw) = &w.notification_config else {
        return Ok(None);
    };
    let config = settings::decrypt(env, &serde_json::from_str::<Value>(raw)?)?;
    if config["enabled"] != true {
        return Ok(None);
    }
    let status = http::text(task, "status");
    let selected = if created {
        config["notify_on_create"] == true
    } else {
        status != old_status
            && config["notify_on_status_change"]
                .as_array()
                .is_some_and(|a| a.iter().any(|v| v.as_str() == Some(status)))
    };
    let url = http::text(&config, "discord_webhook_url");
    if !selected || url.is_empty() {
        return Ok(None);
    }
    let description = format!(
        "{}\nTask: {}\nProject: {}\nStatus: {}",
        if created {
            "Task created"
        } else {
            "Task status changed"
        },
        http::text(task, "title"),
        http::text(task, "project"),
        status
    )
    .chars()
    .take(4000)
    .collect::<String>();
    let payload = json!({"username":"Khun Phaen Alerts","allowed_mentions":{"parse":[]},"embeds":[{"title":format!("Alert for Workspace: {}",w.name),"description":description,"color":5195493}]});
    let event = format!(
        "task:{}:{}:{status}",
        http::text(task, "id"),
        http::text(task, "updated_at")
    );
    Ok(Some(webhook_statement(
        env, db, &w.id, &event, url, payload, None,
    )?))
}
pub async fn enqueue_due(env: &Env) -> Result<()> {
    let db = env.d1("DB")?;
    let now = db::now();
    let rows:Vec<Value>=db::all(&db,"SELECT workspace_id FROM notification_schedules WHERE next_run_at<=? AND claimed_until<=? ORDER BY next_run_at LIMIT 3",&[now.into(),now.into()]).await?;
    for row in rows {
        let ws = http::text(&row, "workspace_id");
        let claimed:Option<Value>=db::first(&db,"UPDATE notification_schedules SET claimed_until=? WHERE workspace_id=? AND next_run_at<=? AND claimed_until<=? RETURNING next_run_at",&[(now+120).into(),ws.into(),now.into(),now.into()]).await?;
        let Some(claimed) = claimed else { continue };
        let Some(workspace) =
            db::first::<Workspace>(&db, "SELECT * FROM workspaces WHERE id=?", &[ws.into()])
                .await?
        else {
            continue;
        };
        let config = workspace
            .notification_config
            .as_ref()
            .map(|v| serde_json::from_str::<Value>(v))
            .transpose()?
            .unwrap_or(json!({}));
        let config = settings::decrypt(env, &config)?;
        let Some(next) = next_run(&config, now) else {
            db::run(
                &db,
                "DELETE FROM notification_schedules WHERE workspace_id=?",
                &[ws.into()],
            )
            .await?;
            continue;
        };
        let mut report = crate::statistics::daily(env, ws).await?;
        let report: Value = report.json().await?;
        let lines = report["tasks"]
            .as_array()
            .into_iter()
            .flatten()
            .map(|t| format!("• [{}] {}", http::text(t, "status"), http::text(t, "title")))
            .collect::<Vec<_>>()
            .join("\n");
        let payload = json!({"username":"Khun Phaen Daily Report","allowed_mentions":{"parse":[]},"embeds":[{"title":workspace.name,"description":if lines.is_empty(){"No active tasks".into()}else{lines.chars().take(4000).collect::<String>()},"color":5195493}]});
        let scheduled = claimed["next_run_at"].as_i64().unwrap_or(now);
        let event = format!("daily:{ws}:{scheduled}");
        db.batch(vec![webhook_statement(env,&db,ws,&event,http::text(&config,"discord_webhook_url"),payload,Some(scheduled))?,db::statement(&db,"UPDATE notification_schedules SET next_run_at=?,claimed_until=0 WHERE workspace_id=?",&[next.into(),ws.into()])?]).await?;
    }
    Ok(())
}
pub async fn deliver_due(env: &Env) -> Result<()> {
    let db = env.d1("DB")?;
    let now = db::now();
    #[derive(Deserialize)]
    struct Job {
        id: String,
        workspace_id: String,
        url: String,
        payload: String,
        attempts: i64,
        scheduled_for: Option<i64>,
    }
    let jobs:Vec<Job>=db::all(&db,"SELECT * FROM webhook_jobs WHERE dead=0 AND next_attempt<=? AND claimed_until<=? ORDER BY created_at LIMIT 3",&[now.into(),now.into()]).await?;
    for job in jobs {
        let claimed: Option<Value> = db::first(
            &db,
            "UPDATE webhook_jobs SET claimed_until=? WHERE id=? AND claimed_until<=? RETURNING id",
            &[(now + 120).into(), job.id.clone().into(), now.into()],
        )
        .await?;
        if claimed.is_none() {
            continue;
        }
        let config = settings::decrypt(env, &json!({"discord_webhook_url":job.url}))?;
        let url = http::text(&config, "discord_webhook_url");
        let headers = Headers::new();
        headers.set("Content-Type", "application/json")?;
        let response = if valid_webhook(env, url) {
            Fetch::Request(Request::new_with_init(
                url,
                RequestInit::new()
                    .with_method(Method::Post)
                    .with_headers(headers)
                    .with_redirect(RequestRedirect::Manual)
                    .with_body(Some(job.payload.into())),
            )?)
            .send()
            .await
        } else {
            Err(Error::RustError("Invalid webhook".into()))
        };
        if response.is_ok_and(|r| (200..300).contains(&r.status_code())) {
            let mut writes = vec![db::statement(
                &db,
                "DELETE FROM webhook_jobs WHERE id=?",
                &[job.id.into()],
            )?];
            if job.scheduled_for.is_some() {
                writes.push(db::statement(&db,"UPDATE workspaces SET notification_config=json_set(notification_config,'$.last_sent_at',?) WHERE id=?",&[db::timestamp().into(),job.workspace_id.into()])?);
            }
            db.batch(writes).await?;
        } else {
            let attempts = job.attempts + 1;
            let wait = (60i64.saturating_mul(1i64 << attempts.min(6))).min(3600);
            db::run(&db,"UPDATE webhook_jobs SET attempts=?,next_attempt=?,claimed_until=0,dead=? WHERE id=?",&[attempts.into(),(now+wait).into(),i32::from(attempts>=8).into(),job.id.into()]).await?;
        }
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn schedule_uses_thailand_time_and_weekdays() {
        let config = json!({"enabled":true,"time":"09:00","days":[1,2,3,4,5]});
        let friday = chrono::DateTime::parse_from_rfc3339("2026-11-06T03:00:00Z")
            .unwrap()
            .timestamp();
        let next = next_run(&config, friday).unwrap();
        assert_eq!(
            chrono::DateTime::from_timestamp(next, 0)
                .unwrap()
                .to_rfc3339(),
            "2026-11-09T02:00:00+00:00"
        );
    }
    #[test]
    fn disabled_and_invalid_schedules_do_not_run() {
        assert_eq!(next_run(&json!({"enabled":false}), 0), None);
        assert_eq!(
            next_run(&json!({"enabled":true,"time":"99:99","days":[1]}), 0),
            None
        );
    }
}
