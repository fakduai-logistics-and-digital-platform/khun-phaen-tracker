use axum::{
    extract::{Json, Path, Query, State},
    http::HeaderMap,
    response::IntoResponse,
};
use axum_extra::extract::cookie::CookieJar;
use mongodb::bson::{oid::ObjectId, Document};
use crate::handlers::auth_handler::extract_user_id;
use crate::handlers::common::{verify_workspace_access, is_duplicate_key_error};
use crate::models::data::*;
use crate::repositories::data_repo::DataRepository;
use crate::repositories::workspace_repo::WorkspaceRepository;
use crate::state::SharedState;

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

pub async fn list_my_tasks(
    State(state): State<SharedState>,
    Query(filter): Query<TaskFilterQuery>,
    headers: HeaderMap,
    jar: CookieJar,
) -> axum::response::Response {
    let user_id = match extract_user_id(&headers, &jar, &state.jwt_secret) {
        Some(id) => id,
        None => {
            return (
                axum::http::StatusCode::UNAUTHORIZED,
                axum::Json(serde_json::json!({ "error": "Not logged in" })),
            )
                .into_response()
        }
    };

    let workspace_repo = WorkspaceRepository::new(&state.db);
    let data_repo = DataRepository::new(&state.db);
    let assigned_ws_ids = data_repo
        .find_assigned_workspaces(&user_id.to_hex())
        .await
        .unwrap_or_default();

    let workspaces = match crate::services::workspace_service::WorkspaceService::get_user_workspaces(
        &workspace_repo,
        &user_id,
        assigned_ws_ids,
    )
    .await
    {
        Ok(items) => items,
        Err(error) => {
            return (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                axum::Json(serde_json::json!({ "error": error })),
            )
                .into_response()
        }
    };

    let workspace_ids: Vec<ObjectId> = workspaces.iter().filter_map(|ws| ws.id).collect();
    if workspace_ids.is_empty() {
        return axum::Json(PaginatedTaskResponse {
            success: true,
            tasks: Vec::new(),
            total: 0,
            page: filter.page.unwrap_or(1).max(1),
            limit: filter.limit.unwrap_or(20),
            pages: 0,
        })
        .into_response();
    }

    let assignee_ids_by_workspace = match data_repo
        .find_user_assignee_ids_by_workspace_ids(&user_id.to_hex(), &workspace_ids)
        .await
    {
        Ok(map) => map,
        Err(error) => {
            return (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                axum::Json(serde_json::json!({ "error": format!("{}", error) })),
            )
                .into_response()
        }
    };

    if assignee_ids_by_workspace.is_empty() {
        return axum::Json(PaginatedTaskResponse {
            success: true,
            tasks: Vec::new(),
            total: 0,
            page: filter.page.unwrap_or(1).max(1),
            limit: filter.limit.unwrap_or(20),
            pages: 0,
        })
        .into_response();
    }

    match data_repo
        .find_tasks_by_workspace_assignees(&assignee_ids_by_workspace, &filter)
        .await
    {
        Ok((tasks, total)) => {
            let limit = filter.limit.unwrap_or(20);
            let page = filter.page.unwrap_or(1).max(1);
            let pages = (total as f64 / limit as f64).ceil() as u64;
            let workspace_map: std::collections::HashMap<String, _> = workspaces
                .into_iter()
                .filter_map(|workspace| workspace.id.map(|id| (id.to_hex(), workspace)))
                .collect();
            let assignee_map: std::collections::HashMap<(String, String), crate::models::data::AssigneeDocument> =
                data_repo
                    .find_assignees_by_workspace_ids(&workspace_ids)
                    .await
                    .unwrap_or_default()
                    .into_iter()
                    .filter_map(|assignee| {
                        assignee.id.map(|id| {
                            (
                                (assignee.workspace_id.to_hex(), id.to_hex()),
                                assignee,
                            )
                        })
                    })
                    .collect();

            let enriched_tasks: Vec<serde_json::Value> = tasks
                .into_iter()
                .map(|task| {
                    let ws_id = task.workspace_id.to_hex();
                    let workspace = workspace_map.get(&ws_id);
                    let assignees = task
                        .assignee_ids
                        .clone()
                        .unwrap_or_default()
                        .into_iter()
                        .filter_map(|assignee_id| {
                            assignee_map
                                .get(&(ws_id.clone(), assignee_id.clone()))
                                .map(|assignee| {
                                    serde_json::json!({
                                        "_id": assignee.id.map(|id| id.to_hex()),
                                        "name": assignee.name,
                                        "color": assignee.color,
                                        "discord_id": assignee.discord_id,
                                        "user_id": assignee.user_id,
                                        "email": serde_json::Value::Null,
                                        "created_at": assignee.created_at,
                                    })
                                })
                        })
                        .collect::<Vec<_>>();

                    serde_json::json!({
                        "_id": task.id.map(|id| id.to_hex()),
                        "workspace_id": ws_id,
                        "workspace_name": workspace.map(|ws| ws.name.clone()).unwrap_or_default(),
                        "workspace_short_name": workspace.and_then(|ws| ws.short_name.clone()),
                        "workspace_color": workspace.and_then(|ws| ws.color.clone()),
                        "workspace_icon": workspace.and_then(|ws| ws.icon.clone()),
                        "title": task.title,
                        "task_number": task.task_number,
                        "project": task.project,
                        "duration_minutes": task.duration_minutes,
                        "start_date": task.start_date,
                        "date": task.date,
                        "end_date": task.end_date,
                        "due_date": task.due_date,
                        "status": task.status,
                        "priority": task.priority,
                        "category": task.category,
                        "notes": task.notes,
                        "attachments": task.attachments,
                        "assignee_ids": task.assignee_ids,
                        "assignees": assignees,
                        "sprint_id": task.sprint_id,
                        "is_archived": task.is_archived,
                        "checklist": task.checklist,
                        "links": task.links,
                        "created_at": task.created_at,
                        "updated_at": task.updated_at,
                    })
                })
                .collect();

            axum::Json(serde_json::json!({
                "success": true,
                "tasks": enriched_tasks,
                "total": total,
                "page": page,
                "limit": limit,
                "pages": pages,
            }))
            .into_response()
        }
        Err(error) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", error) })),
        )
            .into_response(),
    }
}

pub async fn get_next_task_number(
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
    match repo.get_next_task_number(&ws_oid).await {
        Ok(next_number) => {
            axum::Json(serde_json::json!({ "success": true, "next_task_number": next_number }))
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

    let repo = DataRepository::new(&state.db);
    let next_task_number = match repo.get_next_task_number(&ws_oid).await {
        Ok(v) => v,
        Err(e) => {
            return (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                axum::Json(serde_json::json!({ "error": format!("{}", e) })),
            )
                .into_response()
        }
    };

    for attempt in 0..3 {
        let task_number = if attempt == 0 {
            next_task_number
        } else {
            match repo.get_next_task_number(&ws_oid).await {
                Ok(v) => v,
                Err(e) => {
                    return (
                        axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                        axum::Json(serde_json::json!({ "error": format!("{}", e) })),
                    )
                        .into_response()
                }
            }
        };

        let task = TaskDocument {
            id: None,
            workspace_id: ws_oid,
            title: payload.title.clone(),
            task_number: Some(task_number),
            project: payload.project.clone(),
            duration_minutes: payload.duration_minutes,
            start_date: Some(resolved_start_date.clone()),
            date: Some(resolved_start_date.clone()),
            end_date: resolved_due_date.clone(),
            due_date: resolved_due_date.clone(),
            status: payload.status.clone(),
            priority: payload.priority.clone(),
            task_type: payload.task_type.clone(),
            category: payload.category.clone(),
            notes: payload.notes.clone(),
            assignee_ids: payload.assignee_ids.clone(),
            sprint_id: payload.sprint_id.clone(),
            attachments: None,
            is_archived: payload.is_archived,
            checklist: payload.checklist.clone(),
            links: payload.links.clone(),
            testcase_id: payload.testcase_id.clone(),
            created_at: None,
            updated_at: None,
        };

        match repo.create_task(task).await {
            Ok(created) => {
                let ws_repo = WorkspaceRepository::new(&state.db);
                if let Ok(Some(ws)) = ws_repo.find_by_id(&ws_oid).await {
                    crate::services::notification_service::notify_task_created(
                        &state, &ws, &created,
                    )
                    .await;
                }

                return axum::Json(serde_json::json!({ "success": true, "task": created }))
                    .into_response();
            }
            Err(e) if attempt < 2 && is_duplicate_key_error(&e) => continue,
            Err(e) => {
                return (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    axum::Json(serde_json::json!({ "error": format!("{}", e) })),
                )
                    .into_response()
            }
        }
    }

    (
        axum::http::StatusCode::INTERNAL_SERVER_ERROR,
        axum::Json(serde_json::json!({
            "error": "Failed to allocate a unique task number for this workspace"
        })),
    )
        .into_response()
}

pub async fn get_task(
    State(state): State<SharedState>,
    Path((ws_id, task_id)): Path<(String, String)>,
    headers: HeaderMap,
    jar: CookieJar,
) -> axum::response::Response {
    let _ws_oid = match verify_workspace_access(&state, &headers, &jar, &ws_id).await {
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
    match repo.find_task_by_id(&task_oid).await {
        Ok(Some(task)) => axum::Json(serde_json::json!({
            "success": true,
            "task": task,
        }))
        .into_response(),
        Ok(None) => (
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
    if let Some(v) = payload.status.clone() {
        updates.insert("status", v);
    }
    if let Some(v) = payload.priority.clone() {
        updates.insert("priority", v);
    }
    if let Some(v) = payload.task_type {
        match v {
            Some(t) => {
                updates.insert("task_type", t);
            }
            None => {
                updates.insert("task_type", mongodb::bson::Bson::Null);
            }
        }
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
    if let Some(v) = payload.links {
        match v {
            Some(l) => {
                let bson_val = mongodb::bson::to_bson(&l).unwrap_or(mongodb::bson::Bson::Null);
                updates.insert("links", bson_val);
            }
            None => {
                updates.insert("links", mongodb::bson::Bson::Null);
            }
        }
    }
    if let Some(v) = payload.testcase_id {
        match v {
            Some(tc_id) => {
                updates.insert("testcase_id", tc_id);
            }
            None => {
                updates.insert("testcase_id", mongodb::bson::Bson::Null);
            }
        }
    }

    let repo = DataRepository::new(&state.db);

    // Fetch old task before update to know what changed
    let old_task = match repo.find_task_by_id(&task_oid).await {
        Ok(Some(t)) if t.workspace_id == ws_oid => Some(t),
        _ => None,
    };

    if old_task.is_none() {
        return (
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Task not found" })),
        )
            .into_response();
    }

    if old_task.as_ref().and_then(|t| t.task_number).is_none()
        && !updates.contains_key("task_number")
    {
        match repo.get_next_task_number(&ws_oid).await {
            Ok(v) => {
                updates.insert("task_number", v);
            }
            Err(e) => {
                return (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    axum::Json(serde_json::json!({ "error": format!("{}", e) })),
                )
                    .into_response()
            }
        }
    }

    if updates.is_empty() {
        return axum::Json(serde_json::json!({ "success": true, "message": "No changes" }))
            .into_response();
    }

    let should_purge_comments_after_archive = if archive_flag == Some(true) {
        old_task.as_ref().map(|t| !t.is_archived).unwrap_or(false)
    } else {
        false
    };

    match repo.update_task(&task_oid, &ws_oid, updates).await {
        Ok(true) => {
            if should_purge_comments_after_archive {
                if let Err(e) = purge_task_comment_assets(&state, &repo, &ws_oid, &task_oid).await {
                    tracing::error!(
                        "Task archived but failed to purge comments/assets: {}",
                        e
                    );
                }
            }

            // Check status change & trigger notification
            if let (Some(old_t), Some(new_status)) = (&old_task, &payload.status) {
                if old_t.status != *new_status {
                    let ws_repo = WorkspaceRepository::new(&state.db);
                    if let Ok(Some(ws)) = ws_repo.find_by_id(&ws_oid).await {
                        if let Ok(Some(updated_t)) = repo.find_task_by_id(&task_oid).await {
                            crate::services::notification_service::notify_task_status_changed(
                                &state, &ws, &updated_t,
                            )
                            .await;
                        }
                    }
                }
            }

            let updated_task = repo.find_task_by_id(&task_oid).await.ok().flatten();
            axum::Json(serde_json::json!({ "success": true, "task": updated_task })).into_response()
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
    let task = match repo.find_task_by_id(&task_oid).await {
        Ok(Some(t)) if t.workspace_id == ws_oid => t,
        Ok(Some(_)) => {
            return (
                axum::http::StatusCode::FORBIDDEN,
                axum::Json(
                    serde_json::json!({ "error": "Task does not belong to this workspace" }),
                ),
            )
                .into_response()
        }
        Ok(None) => {
            return (
                axum::http::StatusCode::NOT_FOUND,
                axum::Json(serde_json::json!({ "error": "Task not found" })),
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

    if let Err(e) = purge_task_comment_assets(&state, &repo, &ws_oid, &task_oid).await {
        tracing::error!(
            "Failed to purge comments/assets before deleting task: {}",
            e
        );
    }
    if let Err(e) = purge_task_attachments(&state, &task).await {
        tracing::error!(
            "Failed to purge attachments before deleting task: {}",
            e
        );
    }

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

    let storage = state.storage_snapshot().await;
    if let Some(client) = &storage.client {
        for comment in &comments {
            for image in &comment.images {
                if let Err(e) = client
                    .delete_object()
                    .bucket(&storage.bucket)
                    .key(&image.file_key)
                    .send()
                    .await
                {
                    tracing::warn!(
                        "Failed to delete task comment image: {:?}",
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

async fn purge_task_attachments(state: &SharedState, task: &TaskDocument) -> Result<(), String> {
    let storage = state.storage_snapshot().await;
    if let Some(client) = &storage.client {
        if let Some(attachments) = &task.attachments {
            for attachment in attachments {
                if let Err(e) = client
                    .delete_object()
                    .bucket(&storage.bucket)
                    .key(&attachment.file_key)
                    .send()
                    .await
                {
                    tracing::warn!(
                        "Failed to delete task attachment: {:?}",
                        e
                    );
                }
            }
        }
    }

    Ok(())
}
