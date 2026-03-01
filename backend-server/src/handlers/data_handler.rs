use axum::{
    extract::{Json, Multipart, Path, Query, State},
    http::HeaderMap,
    response::IntoResponse,
};
use axum_extra::extract::cookie::CookieJar;
use chrono::Utc;
use mongodb::bson::{doc, oid::ObjectId, Document};
use uuid::Uuid;

use crate::handlers::auth_handler::extract_user_id;
use crate::models::data::*;
use crate::models::data::{CommentDocument, CommentImage};
use crate::repositories::data_repo::DataRepository;
use crate::repositories::workspace_repo::WorkspaceRepository;
use crate::state::SharedState;
use futures::StreamExt;

const MAX_COMMENT_IMAGES: usize = 10;
const MAX_COMMENT_IMAGE_SIZE_BYTES: usize = 10 * 1024 * 1024;
const ALLOWED_COMMENT_REACTION_EMOJIS: [&str; 10] =
    ["👍", "❤️", "🔥", "🎉", "😂", "😮", "😢", "👀", "✅", "🚀"];

/// Helper: verify user owns workspace and return workspace_id as ObjectId
async fn verify_workspace_access(
    state: &SharedState,
    headers: &HeaderMap,
    jar: &CookieJar,
    ws_id_str: &str,
) -> Result<ObjectId, axum::response::Response> {
    // Auth check
    let user_id = extract_user_id(headers, jar, &state.jwt_secret).ok_or_else(|| {
        (
            axum::http::StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": "Not logged in" })),
        )
            .into_response()
    })?;

    // Parse workspace_id
    let ws_oid = ObjectId::parse_str(ws_id_str).map_err(|_| {
        (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({ "error": "Invalid workspace ID" })),
        )
            .into_response()
    })?;

    // Check ownership
    let ws_repo = WorkspaceRepository::new(&state.db);
    let ws = ws_repo.find_by_id(&ws_oid).await.map_err(|_| {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": "Database error" })),
        )
            .into_response()
    })?;

    match ws {
        Some(w) => {
            if w.owner_id == user_id {
                return Ok(ws_oid);
            }
            if let Some(id) = w.id {
                let data_repo = DataRepository::new(&state.db);
                if let Ok(assigned) = data_repo.find_assigned_workspaces(&user_id.to_hex()).await {
                    if assigned.contains(&id) {
                        return Ok(ws_oid);
                    }
                }
            }
            Err((
                axum::http::StatusCode::FORBIDDEN,
                axum::Json(serde_json::json!({ "error": "Access denied to this workspace" })),
            )
                .into_response())
        }
        None => Err((
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Workspace not found" })),
        )
            .into_response()),
    }
}

async fn verify_task_belongs_to_workspace(
    repo: &DataRepository,
    ws_oid: &ObjectId,
    task_oid: &ObjectId,
) -> Result<(), axum::response::Response> {
    let task = repo.find_task_by_id(task_oid).await.map_err(|_| {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": "Database error" })),
        )
            .into_response()
    })?;

    match task {
        Some(t) if &t.workspace_id == ws_oid => Ok(()),
        Some(_) => Err((
            axum::http::StatusCode::FORBIDDEN,
            axum::Json(serde_json::json!({ "error": "Task does not belong to this workspace" })),
        )
            .into_response()),
        None => Err((
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Task not found" })),
        )
            .into_response()),
    }
}

async fn purge_task_comment_assets(
    state: &SharedState,
    repo: &DataRepository,
    ws_oid: &ObjectId,
    task_oid: &ObjectId,
) -> Result<(), String> {
    let comments = repo
        .find_comments_by_task(ws_oid, task_oid)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(client) = &state.storage_client {
        for comment in &comments {
            for image in &comment.images {
                if let Err(e) = client
                    .delete_object()
                    .bucket(&state.storage_bucket)
                    .key(&image.file_key)
                    .send()
                    .await
                {
                    tracing::warn!(
                        "Failed to delete archived-task comment image {}: {:?}",
                        image.file_key,
                        e
                    );
                }
            }
        }
    }

    repo.delete_comments_by_task(ws_oid, task_oid)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn list_tasks(
    State(state): State<SharedState>,
    Path(ws_id): Path<String>,
    Query(filter): Query<TaskFilterQuery>,
    headers: HeaderMap,
    jar: CookieJar,
) -> axum::response::Response {
    let ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let repo = DataRepository::new(&state.db);
    match repo.find_tasks(&ws_oid, &filter).await {
        Ok((tasks, total)) => {
            let limit = filter.limit.unwrap_or(20);
            let page = filter.page.unwrap_or(1).max(1);
            let pages = (total as f64 / limit as f64).ceil() as u64;

            axum::Json(PaginatedTaskResponse {
                success: true,
                tasks,
                total,
                page,
                limit,
                pages,
            })
            .into_response()
        }
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}

pub async fn create_task(
    State(state): State<SharedState>,
    Path(ws_id): Path<String>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(payload): Json<CreateTaskRequest>,
) -> axum::response::Response {
    let ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let resolved_start_date = match payload
        .start_date
        .clone()
        .or(payload.date.clone())
        .map(|v| v.trim().to_string())
    {
        Some(v) if !v.is_empty() => v,
        _ => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": "start_date (or date) is required" })),
            )
                .into_response()
        }
    };

    let resolved_due_date = payload.due_date.clone().or(payload.end_date.clone());

    let task = TaskDocument {
        id: None,
        workspace_id: ws_oid,
        title: payload.title,
        project: payload.project,
        duration_minutes: payload.duration_minutes,
        start_date: Some(resolved_start_date.clone()),
        date: resolved_start_date,
        end_date: resolved_due_date.clone(),
        due_date: resolved_due_date,
        status: payload.status,
        category: payload.category,
        notes: payload.notes,
        assignee_ids: payload.assignee_ids,
        sprint_id: payload.sprint_id,
        attachments: None,
        is_archived: payload.is_archived,
        checklist: payload.checklist,
        created_at: None,
        updated_at: None,
    };

    let repo = DataRepository::new(&state.db);
    match repo.create_task(task).await {
        Ok(created) => {
            axum::Json(serde_json::json!({ "success": true, "task": created })).into_response()
        }
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}

pub async fn update_task(
    State(state): State<SharedState>,
    Path((ws_id, task_id)): Path<(String, String)>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(payload): Json<UpdateTaskRequest>,
) -> axum::response::Response {
    let ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let task_oid = match ObjectId::parse_str(&task_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": "Invalid task ID" })),
            )
                .into_response()
        }
    };

    let archive_flag = payload.is_archived;

    // Build update document from provided fields only
    let mut updates = Document::new();
    if let Some(v) = payload.title {
        updates.insert("title", v);
    }
    if let Some(v) = payload.project {
        updates.insert("project", v);
    }
    if let Some(v) = payload.duration_minutes {
        updates.insert("duration_minutes", v);
    }
    if let Some(v) = payload.start_date {
        updates.insert("start_date", v.clone());
        updates.insert("date", v);
    }
    if let Some(v) = payload.date {
        updates.insert("start_date", v.clone());
        updates.insert("date", v);
    }
    if let Some(v) = payload.end_date {
        updates.insert("end_date", v.clone());
        updates.insert("due_date", v);
    }
    if let Some(v) = payload.due_date {
        updates.insert("due_date", v.clone());
        updates.insert("end_date", v);
    }
    if let Some(v) = payload.status {
        updates.insert("status", v);
    }
    if let Some(v) = payload.category {
        updates.insert("category", v);
    }
    if let Some(v) = payload.notes {
        updates.insert("notes", v);
    }
    if let Some(v) = payload.assignee_ids {
        match v {
            Some(ids) => {
                updates.insert("assignee_ids", ids);
            }
            None => {
                updates.insert("assignee_ids", mongodb::bson::Bson::Null);
            }
        }
    }
    if let Some(v) = payload.sprint_id {
        match v {
            Some(s) => {
                updates.insert("sprint_id", s);
            }
            None => {
                updates.insert("sprint_id", mongodb::bson::Bson::Null);
            }
        }
    }
    if let Some(v) = archive_flag {
        updates.insert("is_archived", v);
    }
    if let Some(v) = payload.checklist {
        match v {
            Some(c) => {
                let bson_val = mongodb::bson::to_bson(&c).unwrap_or(mongodb::bson::Bson::Null);
                updates.insert("checklist", bson_val);
            }
            None => {
                updates.insert("checklist", mongodb::bson::Bson::Null);
            }
        }
    }

    if updates.is_empty() {
        return axum::Json(serde_json::json!({ "success": true, "message": "No changes" }))
            .into_response();
    }

    let repo = DataRepository::new(&state.db);
    let should_purge_comments_after_archive = if archive_flag == Some(true) {
        match repo.find_task_by_id(&task_oid).await {
            Ok(Some(task)) if task.workspace_id == ws_oid => !task.is_archived,
            Ok(Some(_)) => false,
            Ok(None) => false,
            Err(_) => false,
        }
    } else {
        false
    };

    match repo.update_task(&task_oid, &ws_oid, updates).await {
        Ok(true) => {
            if should_purge_comments_after_archive {
                if let Err(e) = purge_task_comment_assets(&state, &repo, &ws_oid, &task_oid).await {
                    tracing::error!(
                        "Task archived but failed to purge comments/assets for task {}: {}",
                        task_id,
                        e
                    );
                }
            }
            axum::Json(serde_json::json!({ "success": true })).into_response()
        }
        Ok(false) => (
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Task not found" })),
        )
            .into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}

pub async fn delete_task(
    State(state): State<SharedState>,
    Path((ws_id, task_id)): Path<(String, String)>,
    headers: HeaderMap,
    jar: CookieJar,
) -> axum::response::Response {
    let ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let task_oid = match ObjectId::parse_str(&task_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": "Invalid task ID" })),
            )
                .into_response()
        }
    };

    let repo = DataRepository::new(&state.db);
    match repo.delete_task(&task_oid, &ws_oid).await {
        Ok(true) => axum::Json(serde_json::json!({ "success": true })).into_response(),
        Ok(false) => (
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Task not found" })),
        )
            .into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}

pub async fn list_task_comments(
    State(state): State<SharedState>,
    Path((ws_id, task_id)): Path<(String, String)>,
    Query(query): Query<CommentPaginationQuery>,
    headers: HeaderMap,
    jar: CookieJar,
) -> axum::response::Response {
    let ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };
    let task_oid = match ObjectId::parse_str(&task_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": "Invalid task ID" })),
            )
                .into_response()
        }
    };
    let repo = DataRepository::new(&state.db);
    if let Err(resp) = verify_task_belongs_to_workspace(&repo, &ws_oid, &task_oid).await {
        return resp;
    }
    let _ = repo.ensure_comment_indexes().await;
    let limit = query.limit.unwrap_or(10).max(1);
    let page = query.page.unwrap_or(1).max(1);

    match repo
        .find_comments_by_task_paginated(&ws_oid, &task_oid, page, limit)
        .await
    {
        Ok((comments, total)) => {
            let pages = (total as f64 / limit as f64).ceil() as u64;
            axum::Json(PaginatedCommentResponse {
                success: true,
                comments,
                total,
                page,
                limit,
                pages,
            })
            .into_response()
        }
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}

pub async fn create_task_comment(
    State(state): State<SharedState>,
    Path((ws_id, task_id)): Path<(String, String)>,
    headers: HeaderMap,
    jar: CookieJar,
    mut multipart: Multipart,
) -> axum::response::Response {
    let ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };
    let task_oid = match ObjectId::parse_str(&task_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": "Invalid task ID" })),
            )
                .into_response()
        }
    };
    let user_id = match extract_user_id(&headers, &jar, &state.jwt_secret) {
        Some(id) => id.to_hex(),
        None => {
            return (
                axum::http::StatusCode::UNAUTHORIZED,
                axum::Json(serde_json::json!({ "error": "Not logged in" })),
            )
                .into_response()
        }
    };
    let repo = DataRepository::new(&state.db);
    if let Err(resp) = verify_task_belongs_to_workspace(&repo, &ws_oid, &task_oid).await {
        return resp;
    }
    let _ = repo.ensure_comment_indexes().await;

    let mut content = String::new();
    let mut images = Vec::<CommentImage>::new();
    while let Some(field) = match multipart.next_field().await {
        Ok(v) => v,
        Err(_) => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": "Invalid multipart payload" })),
            )
                .into_response()
        }
    } {
        let name = field.name().unwrap_or_default().to_string();
        if name == "content" {
            if let Ok(value) = field.text().await {
                content = value;
            }
            continue;
        }

        if name != "images" && name != "images[]" {
            continue;
        }
        if images.len() >= MAX_COMMENT_IMAGES {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": format!("Maximum {} images per comment", MAX_COMMENT_IMAGES) })),
            )
                .into_response();
        }

        let mime_type = field.content_type().unwrap_or("").to_string();
        let filename = field.file_name().unwrap_or("comment-image").to_string();
        if !mime_type.starts_with("image/") {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": "Only image files are allowed" })),
            )
                .into_response();
        }
        let file_bytes = match field.bytes().await {
            Ok(bytes) => bytes,
            Err(_) => {
                return (
                    axum::http::StatusCode::BAD_REQUEST,
                    axum::Json(serde_json::json!({ "error": "Failed to read image file" })),
                )
                    .into_response()
            }
        };
        if file_bytes.is_empty() {
            continue;
        }
        if file_bytes.len() > MAX_COMMENT_IMAGE_SIZE_BYTES {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": "Image exceeds 10MB limit" })),
            )
                .into_response();
        }
        let client = match &state.storage_client {
            Some(c) => c,
            None => {
                return (
                    axum::http::StatusCode::SERVICE_UNAVAILABLE,
                    axum::Json(serde_json::json!({ "error": "Storage is disabled" })),
                )
                    .into_response()
            }
        };
        let image_id = Uuid::now_v7().to_string();
        let file_key = format!("{}/{}/comments/{}", ws_id, task_id, image_id);
        if let Err(e) = client
            .put_object()
            .bucket(&state.storage_bucket)
            .key(&file_key)
            .content_type(&mime_type)
            .body(aws_sdk_s3::primitives::ByteStream::from(file_bytes.clone()))
            .send()
            .await
        {
            tracing::error!("Failed to upload comment image: {:?}", e);
            return (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                axum::Json(serde_json::json!({ "error": "Storage error" })),
            )
                .into_response();
        }
        images.push(CommentImage {
            id: image_id,
            filename,
            file_key,
            mime_type,
            size: file_bytes.len() as i64,
            uploaded_at: Utc::now().to_rfc3339(),
            uploader_id: user_id.clone(),
        });
    }

    if content.trim().is_empty() && images.is_empty() {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(
                serde_json::json!({ "error": "Comment must include text or at least one image" }),
            ),
        )
            .into_response();
    }

    let comment = CommentDocument {
        id: None,
        workspace_id: ws_oid,
        task_id: task_oid,
        content: content.trim().to_string(),
        images,
        reactions: vec![],
        created_by: user_id,
        created_at: None,
        updated_at: None,
    };
    match repo.create_comment(comment).await {
        Ok(created) => {
            axum::Json(serde_json::json!({ "success": true, "comment": created })).into_response()
        }
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}

pub async fn list_comment_images(
    State(state): State<SharedState>,
    Path((ws_id, task_id, comment_id)): Path<(String, String, String)>,
    Query(query): Query<CommentPaginationQuery>,
    headers: HeaderMap,
    jar: CookieJar,
) -> axum::response::Response {
    let ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };
    let task_oid = match ObjectId::parse_str(&task_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": "Invalid task ID" })),
            )
                .into_response()
        }
    };
    let comment_oid = match ObjectId::parse_str(&comment_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": "Invalid comment ID" })),
            )
                .into_response()
        }
    };
    let repo = DataRepository::new(&state.db);
    if let Err(resp) = verify_task_belongs_to_workspace(&repo, &ws_oid, &task_oid).await {
        return resp;
    }
    let limit = query.limit.unwrap_or(6).max(1);
    let page = query.page.unwrap_or(1).max(1);
    match repo
        .find_comment_images_paginated(&ws_oid, &task_oid, &comment_oid, page, limit)
        .await
    {
        Ok(Some((images, total))) => {
            let pages = (total as f64 / limit as f64).ceil() as u64;
            axum::Json(PaginatedCommentImageResponse {
                success: true,
                images,
                total,
                page,
                limit,
                pages,
            })
            .into_response()
        }
        Ok(None) => (
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Comment not found" })),
        )
            .into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}

pub async fn delete_task_comment(
    State(state): State<SharedState>,
    Path((ws_id, task_id, comment_id)): Path<(String, String, String)>,
    headers: HeaderMap,
    jar: CookieJar,
) -> axum::response::Response {
    let ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };
    let task_oid = match ObjectId::parse_str(&task_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": "Invalid task ID" })),
            )
                .into_response()
        }
    };
    let comment_oid = match ObjectId::parse_str(&comment_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": "Invalid comment ID" })),
            )
                .into_response()
        }
    };

    let repo = DataRepository::new(&state.db);
    if let Err(resp) = verify_task_belongs_to_workspace(&repo, &ws_oid, &task_oid).await {
        return resp;
    }
    let comment = match repo
        .find_comment_by_id(&ws_oid, &task_oid, &comment_oid)
        .await
    {
        Ok(Some(c)) => c,
        Ok(None) => {
            return (
                axum::http::StatusCode::NOT_FOUND,
                axum::Json(serde_json::json!({ "error": "Comment not found" })),
            )
                .into_response()
        }
        Err(e) => {
            return (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                axum::Json(serde_json::json!({ "error": format!("{}", e) })),
            )
                .into_response()
        }
    };

    if let Some(client) = &state.storage_client {
        for image in &comment.images {
            if let Err(e) = client
                .delete_object()
                .bucket(&state.storage_bucket)
                .key(&image.file_key)
                .send()
                .await
            {
                tracing::warn!("Failed to delete comment image {}: {:?}", image.file_key, e);
            }
        }
    }

    match repo.delete_comment(&ws_oid, &task_oid, &comment_oid).await {
        Ok(Some(_)) => axum::Json(serde_json::json!({ "success": true })).into_response(),
        Ok(None) => (
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Comment not found" })),
        )
            .into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}

pub async fn update_task_comment(
    State(state): State<SharedState>,
    Path((ws_id, task_id, comment_id)): Path<(String, String, String)>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(payload): Json<UpdateCommentRequest>,
) -> axum::response::Response {
    let ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };
    let task_oid = match ObjectId::parse_str(&task_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": "Invalid task ID" })),
            )
                .into_response()
        }
    };
    let comment_oid = match ObjectId::parse_str(&comment_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": "Invalid comment ID" })),
            )
                .into_response()
        }
    };
    let repo = DataRepository::new(&state.db);
    if let Err(resp) = verify_task_belongs_to_workspace(&repo, &ws_oid, &task_oid).await {
        return resp;
    }
    match repo
        .update_comment_content(
            &ws_oid,
            &task_oid,
            &comment_oid,
            payload.content.trim().to_string(),
        )
        .await
    {
        Ok(true) => axum::Json(serde_json::json!({ "success": true })).into_response(),
        Ok(false) => (
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Comment not found" })),
        )
            .into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}

pub async fn toggle_task_comment_reaction(
    State(state): State<SharedState>,
    Path((ws_id, task_id, comment_id)): Path<(String, String, String)>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(payload): Json<ToggleCommentReactionRequest>,
) -> axum::response::Response {
    let ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };
    let task_oid = match ObjectId::parse_str(&task_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": "Invalid task ID" })),
            )
                .into_response()
        }
    };
    let comment_oid = match ObjectId::parse_str(&comment_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": "Invalid comment ID" })),
            )
                .into_response()
        }
    };
    let user_id = match extract_user_id(&headers, &jar, &state.jwt_secret) {
        Some(id) => id.to_hex(),
        None => {
            return (
                axum::http::StatusCode::UNAUTHORIZED,
                axum::Json(serde_json::json!({ "error": "Not logged in" })),
            )
                .into_response()
        }
    };

    let emoji = payload.emoji.trim();
    if !ALLOWED_COMMENT_REACTION_EMOJIS.contains(&emoji) {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({ "error": "Unsupported emoji" })),
        )
            .into_response();
    }

    let repo = DataRepository::new(&state.db);
    if let Err(resp) = verify_task_belongs_to_workspace(&repo, &ws_oid, &task_oid).await {
        return resp;
    }

    match repo
        .toggle_comment_reaction(&ws_oid, &task_oid, &comment_oid, &user_id, emoji)
        .await
    {
        Ok(Some(comment)) => {
            axum::Json(serde_json::json!({ "success": true, "comment": comment })).into_response()
        }
        Ok(None) => (
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Comment not found" })),
        )
            .into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}

// ===== PROJECTS =====

pub async fn list_projects(
    State(state): State<SharedState>,
    Path(ws_id): Path<String>,
    headers: HeaderMap,
    jar: CookieJar,
) -> axum::response::Response {
    let ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let repo = DataRepository::new(&state.db);
    match repo.find_projects(&ws_oid).await {
        Ok(projects) => {
            axum::Json(serde_json::json!({ "success": true, "projects": projects })).into_response()
        }
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}

pub async fn create_project(
    State(state): State<SharedState>,
    Path(ws_id): Path<String>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(payload): Json<CreateProjectRequest>,
) -> axum::response::Response {
    let ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let project = ProjectDocument {
        id: None,
        workspace_id: ws_oid,
        name: payload.name,
        repo_url: payload.repo_url,
        created_at: None,
    };

    let repo = DataRepository::new(&state.db);
    match repo.create_project(project).await {
        Ok(created) => {
            axum::Json(serde_json::json!({ "success": true, "project": created })).into_response()
        }
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}

pub async fn update_project(
    State(state): State<SharedState>,
    Path((ws_id, project_id)): Path<(String, String)>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(payload): Json<UpdateProjectRequest>,
) -> axum::response::Response {
    let ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let proj_oid = match ObjectId::parse_str(&project_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": "Invalid project ID" })),
            )
                .into_response()
        }
    };

    let mut updates = Document::new();
    if let Some(v) = payload.name {
        updates.insert("name", v);
    }
    if let Some(v) = payload.repo_url {
        match v {
            Some(url) => {
                updates.insert("repo_url", url);
            }
            None => {
                updates.insert("repo_url", mongodb::bson::Bson::Null);
            }
        }
    }

    if updates.is_empty() {
        return axum::Json(serde_json::json!({ "success": true })).into_response();
    }

    let repo = DataRepository::new(&state.db);
    match repo.update_project(&proj_oid, &ws_oid, updates).await {
        Ok(true) => axum::Json(serde_json::json!({ "success": true })).into_response(),
        Ok(false) => (
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Project not found" })),
        )
            .into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}

pub async fn delete_project(
    State(state): State<SharedState>,
    Path((ws_id, project_id)): Path<(String, String)>,
    headers: HeaderMap,
    jar: CookieJar,
) -> axum::response::Response {
    let ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let proj_oid = match ObjectId::parse_str(&project_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": "Invalid project ID" })),
            )
                .into_response()
        }
    };

    let repo = DataRepository::new(&state.db);
    match repo.delete_project(&proj_oid, &ws_oid).await {
        Ok(true) => axum::Json(serde_json::json!({ "success": true })).into_response(),
        Ok(false) => (
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Project not found" })),
        )
            .into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}

// ===== ASSIGNEES =====

pub async fn list_assignees(
    State(state): State<SharedState>,
    Path(ws_id): Path<String>,
    headers: HeaderMap,
    jar: CookieJar,
) -> axum::response::Response {
    let ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let repo = DataRepository::new(&state.db);
    match repo.find_assignees(&ws_oid).await {
        Ok(assignees) => axum::Json(serde_json::json!({ "success": true, "assignees": assignees }))
            .into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}

pub async fn create_assignee(
    State(state): State<SharedState>,
    Path(ws_id): Path<String>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(payload): Json<CreateAssigneeRequest>,
) -> axum::response::Response {
    let ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let mut discord_id = payload.discord_id;

    // If user_id is provided but discord_id is not, try to pull it from the user
    if let (Some(u_id), None) = (&payload.user_id, &discord_id) {
        // Find user by user_id (string UUID)
        let mut cursor = state
            .db
            .collection::<crate::models::user::User>("users")
            .find(doc! { "user_id": u_id }, None)
            .await
            .unwrap();
        if let Some(Ok(user)) = cursor.next().await {
            discord_id = user.discord_id;
        }
    }

    let assignee = AssigneeDocument {
        id: None,
        workspace_id: ws_oid,
        name: payload.name,
        color: payload.color,
        discord_id,
        user_id: payload.user_id,
        created_at: None,
    };

    let repo = DataRepository::new(&state.db);
    match repo.create_assignee(assignee).await {
        Ok(created) => {
            axum::Json(serde_json::json!({ "success": true, "assignee": created })).into_response()
        }
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}

pub async fn update_assignee(
    State(state): State<SharedState>,
    Path((ws_id, assignee_id)): Path<(String, String)>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(payload): Json<UpdateAssigneeRequest>,
) -> axum::response::Response {
    let ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let assignee_oid = match ObjectId::parse_str(&assignee_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": "Invalid assignee ID" })),
            )
                .into_response()
        }
    };

    let mut updates = Document::new();
    if let Some(v) = payload.name {
        updates.insert("name", v);
    }
    if let Some(v) = payload.color {
        updates.insert("color", v);
    }
    if let Some(v) = payload.discord_id.as_ref() {
        match v {
            Some(d) => {
                updates.insert("discord_id", d);
            }
            None => {
                updates.insert("discord_id", mongodb::bson::Bson::Null);
            }
        }
    }
    if let Some(v) = payload.user_id.as_ref() {
        match v {
            Some(u) => {
                updates.insert("user_id", &u);
                // If discord_id is not being updated, try to pull it from the user
                if payload.discord_id.is_none() {
                    let mut cursor = state
                        .db
                        .collection::<crate::models::user::User>("users")
                        .find(doc! { "user_id": &u }, None)
                        .await
                        .unwrap();
                    if let Some(Ok(user)) = cursor.next().await {
                        if let Some(d_id) = user.discord_id {
                            updates.insert("discord_id", d_id);
                        }
                    }
                }
            }
            None => {
                updates.insert("user_id", mongodb::bson::Bson::Null);
            }
        }
    }

    if updates.is_empty() {
        return axum::Json(serde_json::json!({ "success": true })).into_response();
    }

    let repo = DataRepository::new(&state.db);
    match repo.update_assignee(&assignee_oid, &ws_oid, updates).await {
        Ok(true) => axum::Json(serde_json::json!({ "success": true })).into_response(),
        Ok(false) => (
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Assignee not found" })),
        )
            .into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}

pub async fn delete_assignee(
    State(state): State<SharedState>,
    Path((ws_id, assignee_id)): Path<(String, String)>,
    headers: HeaderMap,
    jar: CookieJar,
) -> axum::response::Response {
    let ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let assignee_oid = match ObjectId::parse_str(&assignee_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": "Invalid assignee ID" })),
            )
                .into_response()
        }
    };

    let repo = DataRepository::new(&state.db);
    match repo.delete_assignee(&assignee_oid, &ws_oid).await {
        Ok(true) => axum::Json(serde_json::json!({ "success": true })).into_response(),
        Ok(false) => (
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Assignee not found" })),
        )
            .into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}

// ===== SPRINTS =====

pub async fn list_sprints(
    State(state): State<SharedState>,
    Path(ws_id): Path<String>,
    headers: HeaderMap,
    jar: CookieJar,
) -> axum::response::Response {
    let ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let repo = DataRepository::new(&state.db);
    match repo.find_sprints(&ws_oid).await {
        Ok(sprints) => {
            axum::Json(serde_json::json!({ "success": true, "sprints": sprints })).into_response()
        }
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}

pub async fn create_sprint(
    State(state): State<SharedState>,
    Path(ws_id): Path<String>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(payload): Json<CreateSprintRequest>,
) -> axum::response::Response {
    let ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let sprint = SprintDocument {
        id: None,
        workspace_id: ws_oid,
        name: payload.name,
        start_date: payload.start_date,
        end_date: payload.end_date,
        status: payload.status,
        completed_at: None,
        archived_count: None,
        created_at: None,
    };

    let repo = DataRepository::new(&state.db);
    match repo.create_sprint(sprint).await {
        Ok(created) => {
            axum::Json(serde_json::json!({ "success": true, "sprint": created })).into_response()
        }
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}

pub async fn update_sprint(
    State(state): State<SharedState>,
    Path((ws_id, sprint_id)): Path<(String, String)>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(payload): Json<UpdateSprintRequest>,
) -> axum::response::Response {
    let ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let sprint_oid = match ObjectId::parse_str(&sprint_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": "Invalid sprint ID" })),
            )
                .into_response()
        }
    };

    let mut updates = Document::new();
    if let Some(v) = payload.name {
        updates.insert("name", v);
    }
    if let Some(v) = payload.start_date {
        updates.insert("start_date", v);
    }
    if let Some(v) = payload.end_date {
        updates.insert("end_date", v);
    }
    if let Some(v) = payload.status {
        updates.insert("status", v);
    }
    if let Some(v) = payload.completed_at {
        match v {
            Some(d) => {
                updates.insert("completed_at", d);
            }
            None => {
                updates.insert("completed_at", mongodb::bson::Bson::Null);
            }
        }
    }
    if let Some(v) = payload.archived_count {
        updates.insert("archived_count", v);
    }

    if updates.is_empty() {
        return axum::Json(serde_json::json!({ "success": true })).into_response();
    }

    let repo = DataRepository::new(&state.db);
    match repo.update_sprint(&sprint_oid, &ws_oid, updates).await {
        Ok(true) => axum::Json(serde_json::json!({ "success": true })).into_response(),
        Ok(false) => (
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Sprint not found" })),
        )
            .into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}

pub async fn delete_sprint(
    State(state): State<SharedState>,
    Path((ws_id, sprint_id)): Path<(String, String)>,
    headers: HeaderMap,
    jar: CookieJar,
) -> axum::response::Response {
    let ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let sprint_oid = match ObjectId::parse_str(&sprint_id) {
        Ok(id) => id,
        Err(_) => {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                axum::Json(serde_json::json!({ "error": "Invalid sprint ID" })),
            )
                .into_response()
        }
    };

    let repo = DataRepository::new(&state.db);
    match repo.delete_sprint(&sprint_oid, &ws_oid).await {
        Ok(true) => axum::Json(serde_json::json!({ "success": true })).into_response(),
        Ok(false) => (
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Sprint not found" })),
        )
            .into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}
pub async fn daily_report(
    State(state): State<SharedState>,
    Path(ws_id): Path<String>,
    headers: HeaderMap,
    jar: CookieJar,
) -> axum::response::Response {
    let ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
        Ok(id) => id,
        Err(resp) => return resp,
    };

    let repo = DataRepository::new(&state.db);
    match repo.find_daily_report_tasks(&ws_oid).await {
        Ok(tasks) => axum::Json(serde_json::json!({
            "success": true,
            "tasks": tasks
        }))
        .into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        )
            .into_response(),
    }
}
