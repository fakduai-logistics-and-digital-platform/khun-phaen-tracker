use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

// ===== Attachment Model =====
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: String,
    pub filename: String,
    pub file_key: String,
    pub mime_type: String,
    pub size: i64,
    pub uploaded_at: String,
    pub uploader_id: String,
}

// ===== Comment Model =====
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommentImage {
    pub id: String,
    pub filename: String,
    pub file_key: String,
    pub mime_type: String,
    pub size: i64,
    pub uploaded_at: String,
    pub uploader_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommentReaction {
    pub emoji: String,
    pub user_id: String,
    pub reacted_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommentDocument {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub workspace_id: ObjectId,
    pub task_id: ObjectId,
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub images: Vec<CommentImage>,
    #[serde(default)]
    pub reactions: Vec<CommentReaction>,
    pub created_by: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Default)]
pub struct CreateCommentMultipart {
    pub content: String,
    pub images: Vec<CommentImage>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCommentRequest {
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct ToggleCommentReactionRequest {
    pub emoji: String,
}

// ===== Task Document =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDocument {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub workspace_id: ObjectId,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub task_number: Option<i64>,
    #[serde(default)]
    pub project: String,
    #[serde(default)]
    pub duration_minutes: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub start_date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub due_date: Option<String>,
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(default = "default_category")]
    pub category: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attachments: Option<Vec<Attachment>>,
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

fn default_status() -> String {
    "todo".to_string()
}
fn default_category() -> String {
    "อื่นๆ".to_string()
}

#[derive(Debug, Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    #[serde(default)]
    pub project: String,
    #[serde(default)]
    pub duration_minutes: i64,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub due_date: Option<String>,
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
    pub start_date: Option<String>,
    pub date: Option<String>,
    pub end_date: Option<Option<String>>,
    pub due_date: Option<Option<String>>,
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

fn default_color() -> String {
    "#6366F1".to_string()
}

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

// ===== Assignee Group Document =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssigneeGroupDocument {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub workspace_id: ObjectId,
    pub name: String,
    #[serde(default)]
    pub assignee_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAssigneeGroupRequest {
    pub name: String,
    #[serde(default)]
    pub assignee_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAssigneeGroupRequest {
    pub name: Option<String>,
    pub assignee_ids: Option<Vec<String>>,
}

// ===== Sprint Document =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SprintDocument {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub workspace_id: ObjectId,
    pub name: String,
    pub start_date: String,
    pub end_date: String,
    #[serde(default = "default_sprint_status")]
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub archived_count: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
}

fn default_sprint_status() -> String {
    "planned".to_string()
}

#[derive(Debug, Deserialize)]
pub struct CreateSprintRequest {
    pub name: String,
    pub start_date: String,
    pub end_date: String,
    #[serde(default = "default_sprint_status")]
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSprintRequest {
    pub name: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub status: Option<String>,
    pub completed_at: Option<Option<String>>,
    pub archived_count: Option<i64>,
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
    pub due_start_date: Option<String>,
    pub due_end_date: Option<String>,
    pub due_preset: Option<String>,
    pub include_archived: Option<bool>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
    pub page: Option<u64>,
    pub limit: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct PaginatedTaskResponse {
    pub success: bool,
    pub tasks: Vec<TaskDocument>,
    pub total: u64,
    pub page: u64,
    pub limit: u64,
    pub pages: u64,
}

#[derive(Debug, Deserialize, Default)]
pub struct CommentPaginationQuery {
    pub page: Option<u64>,
    pub limit: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct PaginatedCommentResponse {
    pub success: bool,
    pub comments: Vec<CommentDocument>,
    pub total: u64,
    pub page: u64,
    pub limit: u64,
    pub pages: u64,
}

#[derive(Debug, Serialize)]
pub struct PaginatedCommentImageResponse {
    pub success: bool,
    pub images: Vec<CommentImage>,
    pub total: u64,
    pub page: u64,
    pub limit: u64,
    pub pages: u64,
}
// ===== Checklist Template Document =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChecklistTemplateDocument {
    #[serde(rename = "_id")]
    pub id: String, // UUID
    pub workspace_id: ObjectId,
    pub name: String,
    pub items: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateChecklistTemplateRequest {
    pub name: String,
    pub items: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateChecklistTemplateRequest {
    pub name: Option<String>,
    pub items: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct ChecklistTemplateResponse {
    pub success: bool,
    pub templates: Vec<ChecklistTemplateDocument>,
}
