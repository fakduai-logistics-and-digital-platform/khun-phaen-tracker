use std::sync::Arc;
use tokio::time::{sleep, Duration};
use chrono::{Datelike, Timelike, Utc, FixedOffset};
use crate::state::AppState;
use crate::repositories::workspace_repo::WorkspaceRepository;
use crate::repositories::data_repo::DataRepository;
use crate::models::data::TaskFilterQuery;
use tracing::{info, error};

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
            if !config.enabled { continue; }
            
            // Check if today is one of the scheduled days
            if !config.days.contains(&current_day) { continue; }
            
            // Check if it's the right time
            if config.time != current_time_str { continue; }
            
            // Check if already sent recently
            if let Some(last_sent) = config.last_sent_at {
                if (now_utc - last_sent).num_minutes() < 55 {
                    continue;
                }
            }
            
            // Send notification
            if let Some(id) = ws.id {
                info!("📢 Sending daily summary for workspace: {} ({})", ws.name, id);
                if let Err(e) = send_daily_summary_to_discord(&id, &ws.name, config.discord_webhook_url.as_deref(), &data_repo).await {
                    error!("❌ Failed to send notification for workspace {}: {}", ws.name, e);
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
    data_repo: &DataRepository
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let url = match webhook_url {
        Some(u) => u,
        None => return Ok(()),
    };
    
    // Fetch non-archived tasks
    let filter = TaskFilterQuery {
        status: None, // Will default to active
        category: Some("all".to_string()),
        project: Some("all".to_string()),
        assignee_id: Some("all".to_string()),
        sprint_id: Some("all".to_string()),
        start_date: None,
        end_date: None,
        search: None,
        include_archived: Some(false),
    };
    
    let tasks = data_repo.find_tasks(workspace_id, &filter).await?;
    
    if tasks.is_empty() {
        return Ok(()); // Nothing to report
    }
    
    let offset = FixedOffset::east_opt(7 * 3600).unwrap();
    let today_str = Utc::now().with_timezone(&offset).format("%Y-%m-%d").to_string();
    
    let mut done_tasks = Vec::new();
    let mut pending_tasks = Vec::new();
    
    for t in tasks {
        if t.status == "done" {
            done_tasks.push(t);
        } else {
            pending_tasks.push(t);
        }
    }
    
    let mut content = format!("📊 **Daily Summary: {}** - {}\n\n", workspace_name, today_str);
    
    if !done_tasks.is_empty() {
        content.push_str(&format!("🎯 **Completed Today ({})**\n", done_tasks.len()));
        for t in done_tasks.iter().take(15) {
            content.push_str(&format!("• ✅ {}\n", t.title));
        }
        if done_tasks.len() > 15 {
            content.push_str(&format!("... and {} more\n", done_tasks.len() - 15));
        }
        content.push_str("\n");
    }
    
    if !pending_tasks.is_empty() {
        content.push_str(&format!("⏳ **Pending Tasks ({})**\n", pending_tasks.len()));
        for t in pending_tasks.iter().take(15) {
            let icon = match t.status.as_str() {
                "in-progress" => "🔄",
                "in-test" => "🧪",
                _ => "📝",
            };
            content.push_str(&format!("• {} {}\n", icon, t.title));
        }
        if pending_tasks.len() > 15 {
            content.push_str(&format!("... and {} more\n", pending_tasks.len() - 15));
        }
    }
    
    let discord_payload = serde_json::json!({
        "username": "Khun Phaen Reporter",
        "avatar_url": "https://raw.githubusercontent.com/watchakorn-18k/khu-phaen-tracker-offline/main/static/logo.png",
        "embeds": [
            {
                "title": format!("Report for {}", workspace_name),
                "description": content,
                "color": 0x4F46E5,
                "footer": {
                    "text": "Khun Phaen Task Tracker ✨"
                },
                "timestamp": Utc::now().to_rfc3339()
            }
        ]
    });
    
    let client = reqwest::Client::new();
    let res = client.post(url)
        .json(&discord_payload)
        .send()
        .await?;
        
    if !res.status().is_success() {
        return Err(format!("Discord API returned error: {}", res.status()).into());
    }
    
    Ok(())
}
