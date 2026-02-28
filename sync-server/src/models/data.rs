use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

// ===== Task Document =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDocument {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub workspace_id: ObjectId,
    pub title: String,
    #[serde(default)]
    pub project: String,
    #[serde(default)]
    pub duration_minutes: i64,
    pub date: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_date: Option<String>,
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(default = "default_category")]
    pub category: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assignee_ids: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sprint_id: Option<String>,
    #[serde(default)]
    pub is_archived: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub checklist: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

fn default_status() -> String { "todo".to_string() }
fn default_category() -> String { "อื่นๆ".to_string() }

#[derive(Debug, Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    #[serde(default)]
    pub project: String,
    #[serde(default)]
    pub duration_minutes: i64,
    pub date: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_date: Option<String>,
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(default = "default_category")]
    pub category: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub assignee_ids: Option<Vec<String>>,
    #[serde(default)]
    pub sprint_id: Option<String>,
    #[serde(default)]
    pub is_archived: bool,
    #[serde(default)]
    pub checklist: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTaskRequest {
    pub title: Option<String>,
    pub project: Option<String>,
    pub duration_minutes: Option<i64>,
    pub date: Option<String>,
    pub end_date: Option<Option<String>>,
    pub status: Option<String>,
    pub category: Option<String>,
    pub notes: Option<String>,
    pub assignee_ids: Option<Option<Vec<String>>>,
    pub sprint_id: Option<Option<String>>,
    pub is_archived: Option<bool>,
    pub checklist: Option<Option<serde_json::Value>>,
}

// ===== Project Document =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectDocument {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub workspace_id: ObjectId,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repo_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
    #[serde(default)]
    pub repo_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub repo_url: Option<Option<String>>,
}

// ===== Assignee Document =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssigneeDocument {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub workspace_id: ObjectId,
    pub name: String,
    #[serde(default = "default_color")]
    pub color: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub discord_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
}

fn default_color() -> String { "#6366F1".to_string() }

#[derive(Debug, Deserialize)]
pub struct CreateAssigneeRequest {
    pub name: String,
    #[serde(default = "default_color")]
    pub color: String,
    #[serde(default)]
    pub discord_id: Option<String>,
    #[serde(default)]
    pub user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAssigneeRequest {
    pub name: Option<String>,
    pub color: Option<String>,
    pub discord_id: Option<Option<String>>,
    pub user_id: Option<Option<String>>,
}

// ===== Filter / Query =====

#[derive(Debug, Deserialize, Default)]
pub struct TaskFilterQuery {
    pub status: Option<String>,
    pub category: Option<String>,
    pub project: Option<String>,
    pub assignee_id: Option<String>,
    pub sprint_id: Option<String>,
    pub search: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub include_archived: Option<bool>,
}
