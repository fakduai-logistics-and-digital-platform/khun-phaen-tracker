use crate::models::data::Attachment;
use crate::repositories::data_repo::DataRepository;
use crate::state::AppState;
use aws_sdk_s3::primitives::ByteStream;
use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::{header, StatusCode},
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use mongodb::bson::{doc, oid::ObjectId};
use std::sync::Arc;
use uuid::Uuid;

pub async fn upload_attachment(
    State(state): State<Arc<AppState>>,
    Path((ws_id_str, task_id_str)): Path<(String, String)>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let ws_id = match ObjectId::parse_str(&ws_id_str) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid workspace ID"})),
            )
        }
    };
    let task_id = match ObjectId::parse_str(&task_id_str) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid task ID"})),
            )
        }
    };

    let client = match &state.storage_client {
        Some(c) => c,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "Storage is disabled"})),
            )
        }
    };

    let data_repo = DataRepository::new(&state.db);
    let task = match data_repo.find_task_by_id(&task_id).await {
        Ok(Some(t)) => t,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Task not found"})),
            )
        }
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": e.to_string()})),
            )
        }
    };

    if task.workspace_id != ws_id {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"error": "Task does not belong to this workspace"})),
        );
    }

    let mut attached_files = Vec::new();

    while let Some(field) = multipart.next_field().await.unwrap_or(None) {
        let file_name = field.file_name().unwrap_or("unknown.file").to_string();
        let mime_type = field
            .content_type()
            .unwrap_or("application/octet-stream")
            .to_string();

        let file_bytes = match field.bytes().await {
            Ok(b) => b,
            Err(_) => continue,
        };

        if file_bytes.is_empty() {
            continue;
        }

        let file_uuid = Uuid::now_v7().to_string();
        let file_key = format!("{}/{}/{}", ws_id_str, task_id_str, file_uuid);

        let upload_res = client
            .put_object()
            .bucket(&state.storage_bucket)
            .key(&file_key)
            .content_type(&mime_type)
            .body(ByteStream::from(file_bytes.clone()))
            .send()
            .await;

        match upload_res {
            Ok(_) => {
                let attachment = Attachment {
                    id: file_uuid,
                    filename: file_name,
                    file_key,
                    mime_type,
                    size: file_bytes.len() as i64,
                    uploaded_at: Utc::now().to_rfc3339(),
                    uploader_id: "system".to_string(), // In a real app we'd extract user_id from token
                };
                attached_files.push(attachment);
            }
            Err(e) => {
                tracing::error!("Failed to upload file to S3: {:?}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": "Storage error"})),
                );
            }
        }
    }

    if attached_files.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "No valid files received"})),
        );
    }

    let mut current_attachments = task.attachments.unwrap_or_default();
    current_attachments.extend(attached_files.clone());

    if let Ok(attachments_bson) = mongodb::bson::to_bson(&current_attachments) {
        let updates = doc! { "attachments": attachments_bson };
        if let Err(e) = data_repo.update_task(&task_id, &ws_id, updates).await {
            tracing::error!("Failed to update task attachments: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Failed to update db"})),
            );
        }
    }

    (
        StatusCode::OK,
        Json(serde_json::json!({"success": true, "attachments": attached_files})),
    )
}

pub async fn download_attachment(
    State(state): State<Arc<AppState>>,
    Path(file_key): Path<String>, // format: {ws_id}/{task_id}/{file_uuid}
) -> impl IntoResponse {
    let client = match &state.storage_client {
        Some(c) => c,
        None => return (StatusCode::SERVICE_UNAVAILABLE, "Storage disabled").into_response(),
    };

    let resp = match client
        .get_object()
        .bucket(&state.storage_bucket)
        .key(&file_key)
        .send()
        .await
    {
        Ok(r) => r,
        Err(err) => {
            tracing::error!("S3 get error: {:?}", err);
            return (StatusCode::NOT_FOUND, "File not found").into_response();
        }
    };

    let content_type = resp
        .content_type()
        .unwrap_or("application/octet-stream")
        .to_string();
    let content_length = resp.content_length().unwrap_or(0);

    let stream = resp.body.into_async_read();
    let body = Body::from_stream(tokio_util::io::ReaderStream::new(stream));

    (
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, content_type),
            (header::CONTENT_LENGTH, content_length.to_string()),
        ],
        body,
    )
        .into_response()
}

pub async fn delete_attachment(
    State(state): State<Arc<AppState>>,
    Path((ws_id_str, task_id_str, attachment_id)): Path<(String, String, String)>,
) -> impl IntoResponse {
    let ws_id = match ObjectId::parse_str(&ws_id_str) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid workspace ID"})),
            )
        }
    };
    let task_id = match ObjectId::parse_str(&task_id_str) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid task ID"})),
            )
        }
    };

    let data_repo = DataRepository::new(&state.db);
    let task = match data_repo.find_task_by_id(&task_id).await {
        Ok(Some(t)) => t,
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Task not found"})),
            )
        }
    };

    if task.workspace_id != ws_id {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"error": "Forbidden"})),
        );
    }

    let mut attachments = task.attachments.unwrap_or_default();

    // Find the file key to delete from S3
    let mut file_key_to_delete = None;
    attachments.retain(|a| {
        if a.id == attachment_id {
            file_key_to_delete = Some(a.file_key.clone());
            false
        } else {
            true
        }
    });

    if let Some(file_key) = file_key_to_delete {
        if let Some(client) = &state.storage_client {
            let _ = client
                .delete_object()
                .bucket(&state.storage_bucket)
                .key(&file_key)
                .send()
                .await;
        }

        if let Ok(attachments_bson) = mongodb::bson::to_bson(&attachments) {
            let updates = doc! { "attachments": attachments_bson };
            let _ = data_repo.update_task(&task_id, &ws_id, updates).await;
        }

        (StatusCode::OK, Json(serde_json::json!({"success": true})))
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Attachment not found"})),
        )
    }
}
