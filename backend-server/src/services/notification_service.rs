use crate::models::data::TaskFilterQuery;
use crate::repositories::data_repo::DataRepository;
use crate::repositories::user_repo::UserRepository;
use crate::repositories::workspace_repo::WorkspaceRepository;
use crate::state::AppState;
use chrono::{Datelike, FixedOffset, Timelike, Utc};
use mongodb::bson::oid::ObjectId;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::time::{sleep, Duration};
use tracing::{error, info};

pub fn spawn_notification_service_task(state: Arc<AppState>) {
    tokio::spawn(async move {
        info!("🔔 Notification service started (Thailand Time: UTC+7)");
        loop {
            // Check every minute
            check_and_send_notifications(&state).await;
            sleep(Duration::from_secs(60)).await;
        }
    });
}

async fn check_and_send_notifications(state: &Arc<AppState>) {
    let workspace_repo = WorkspaceRepository::new(&state.db);
    let data_repo = DataRepository::new(&state.db);
    let user_repo = UserRepository::new(&state.db);

    // Use Thailand Time (UTC+7)
    let offset = FixedOffset::east_opt(7 * 3600).unwrap();
    let now_utc = Utc::now();
    let now_th = now_utc.with_timezone(&offset);

    let current_day = now_th.weekday().num_days_from_sunday() as u8; // 0=Sun
    let current_time_str = format!("{:02}:{:02}", now_th.hour(), now_th.minute());

    let workspaces = match workspace_repo.find_all_notifications().await {
        Ok(ws) => ws,
        Err(e) => {
            error!("❌ Failed to fetch workspaces for notifications: {}", e);
            return;
        }
    };

    for ws in workspaces {
        if let Some(config) = &ws.notification_config {
            if !config.enabled {
                continue;
            }

            // Check if today is one of the scheduled days
            if !config.days.contains(&current_day) {
                continue;
            }

            // Check if it's the right time
            if config.time != current_time_str {
                continue;
            }

            // Check if already sent recently
            if let Some(last_sent) = config.last_sent_at {
                if (now_utc - last_sent).num_minutes() < 55 {
                    continue;
                }
            }

            // Send notification
            if let Some(id) = ws.id {
                info!(
                    "📢 Sending daily summary for workspace: {} ({})",
                    ws.name, id
                );
                if let Err(e) = send_daily_summary_to_discord(
                    &id,
                    &ws.name,
                    config.discord_webhook_url.as_deref(),
                    &data_repo,
                    &user_repo,
                )
                .await
                {
                    error!(
                        "❌ Failed to send notification for workspace {}: {}",
                        ws.name, e
                    );
                } else {
                    // Update last sent (using UTC for storage)
                    let _ = workspace_repo.update_last_sent(&id, now_utc).await;
                }
            }
        }
    }
}

async fn send_daily_summary_to_discord(
    workspace_id: &mongodb::bson::oid::ObjectId,
    workspace_name: &str,
    webhook_url: Option<&str>,
    data_repo: &DataRepository,
    user_repo: &UserRepository,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let url = match webhook_url {
        Some(u) => u,
        None => return Ok(()),
    };

    // Fetch specifically for daily report
    let tasks = data_repo.find_daily_report_tasks(workspace_id).await?;
    let assignees = data_repo.find_assignees(workspace_id).await.unwrap_or_default();
    let assignee_map: HashMap<String, crate::models::data::AssigneeDocument> = assignees
        .into_iter()
        .filter_map(|a| a.id.map(|id| (id.to_hex(), a)))
        .collect();
    let user_discord_map = build_user_discord_map(&assignee_map, user_repo).await;

    if tasks.is_empty() {
        return Ok(()); // Nothing to report
    }

    let offset = FixedOffset::east_opt(7 * 3600).unwrap();
    let now_th = Utc::now().with_timezone(&offset);
    let today_str = now_th.format("%Y-%m-%d").to_string();
    let time_str = now_th.format("%H:%M").to_string();

    let mut done_tasks = Vec::new();
    let mut pending_tasks = Vec::new();
    let mut in_progress_count = 0;
    let mut in_test_count = 0;
    let mut todo_count = 0;

    for t in tasks {
        if t.status == "done" {
            done_tasks.push(t);
        } else {
            match t.status.as_str() {
                "in-progress" => in_progress_count += 1,
                "in-test" => in_test_count += 1,
                _ => todo_count += 1,
            }
            pending_tasks.push(t);
        }
    }

    let total_pending = pending_tasks.len();
    let total_done = done_tasks.len();

    // Build Discord Embed Description (Matching Aesthetic Logic)
    let mut description = format!(
        "📊 **Daily Progress Summary**\n📅 Date: `{}` | 🕒 Time: `{}`\n\n",
        today_str, time_str
    );

    description.push_str("```\n");
    description.push_str("Status      | Count\n");
    description.push_str("------------|------\n");
    description.push_str(&format!("✅ Completed  | {:<4}\n", total_done));
    description.push_str(&format!("🔄 In Progress| {:<4}\n", in_progress_count));
    description.push_str(&format!("🧪 In Test    | {:<4}\n", in_test_count));
    description.push_str(&format!("📝 To Do      | {:<4}\n", todo_count));
    description.push_str("```\n\n");

    if !done_tasks.is_empty() {
        description.push_str("🎯 **Recently Completed**\n");
        for t in done_tasks.iter().take(10) {
            description.push_str(&format!(
                "• ✅ {}{}\n",
                t.title,
                format_task_assignees(t, &assignee_map, &user_discord_map)
            ));
        }
        if done_tasks.len() > 10 {
            description.push_str(&format!("*... and {} more*\n", done_tasks.len() - 10));
        }
        description.push_str("\n");
    }

    if !pending_tasks.is_empty() {
        description.push_str("⏳ **Pending Tasks**\n");
        // Sort pending by status priority implicitly handled by repo order
        for t in pending_tasks.iter().take(10) {
            let icon = match t.status.as_str() {
                "in-progress" => "🔄",
                "in-test" => "🧪",
                _ => "📝",
            };
            description.push_str(&format!(
                "• {} {}{}\n",
                icon,
                t.title,
                format_task_assignees(t, &assignee_map, &user_discord_map)
            ));
        }
        if pending_tasks.len() > 10 {
            description.push_str(&format!("*... and {} more*\n", pending_tasks.len() - 10));
        }
    }

    let discord_payload = serde_json::json!({
        "username": "Khun Phaen Reporter",
        "avatar_url": "https://raw.githubusercontent.com/watchakorn-18k/khu-phaen-tracker-offline/main/static/logo.png",
        "embeds": [
            {
                "title": format!("Report for Workspace: {}", workspace_name),
                "description": description,
                "color": 0x4F46E5,
                "footer": {
                    "text": "Khun Phaen Task Tracker – Official Report"
                },
                "timestamp": Utc::now().to_rfc3339()
            }
        ]
    });

    let client = reqwest::Client::new();
    let res = client.post(url).json(&discord_payload).send().await?;

    if !res.status().is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Discord API returned error: {} - {}", body, body).into());
    }

    Ok(())
}

fn format_task_assignees(
    task: &crate::models::data::TaskDocument,
    assignee_map: &HashMap<String, crate::models::data::AssigneeDocument>,
    user_discord_map: &HashMap<String, String>,
) -> String {
    let ids = match &task.assignee_ids {
        Some(v) if !v.is_empty() => v,
        _ => return String::new(),
    };

    let mut parts: Vec<String> = Vec::new();
    for id in ids {
        if let Some(assignee) = assignee_map.get(id) {
            if let Some(discord_id) = assignee.discord_id.as_deref() {
                let mention_id = normalize_discord_mention_id(discord_id);
                if !mention_id.is_empty() {
                    parts.push(format!("<@{}>", mention_id));
                    continue;
                }
            }
            if let Some(user_id_hex) = assignee.user_id.as_deref() {
                if let Some(discord_id) = user_discord_map.get(user_id_hex) {
                    let mention_id = normalize_discord_mention_id(discord_id);
                    if !mention_id.is_empty() {
                        parts.push(format!("<@{}>", mention_id));
                        continue;
                    }
                }
            }
            parts.push(assignee.name.clone());
        }
    }

    if parts.is_empty() {
        String::new()
    } else {
        format!(" — 👤 {}", parts.join(", "))
    }
}

async fn build_user_discord_map(
    assignee_map: &HashMap<String, crate::models::data::AssigneeDocument>,
    user_repo: &UserRepository,
) -> HashMap<String, String> {
    let mut user_discord_map = HashMap::new();
    let mut user_ids: Vec<String> = assignee_map
        .values()
        .filter_map(|a| a.user_id.clone())
        .collect();
    user_ids.sort();
    user_ids.dedup();

    for user_id_hex in user_ids {
        if let Ok(user_oid) = ObjectId::parse_str(&user_id_hex) {
            if let Ok(Some(user)) = user_repo.find_by_id(&user_oid).await {
                if let Some(discord_id) = user.discord_id {
                    user_discord_map.insert(user_id_hex, discord_id);
                }
            }
        }
    }
    user_discord_map
}

fn normalize_discord_mention_id(raw: &str) -> String {
    raw.trim()
        .trim_start_matches("<@")
        .trim_start_matches('!')
        .trim_end_matches('>')
        .to_string()
}
