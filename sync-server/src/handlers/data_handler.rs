use axum::{
    extract::{State, Json, Path, Query},
    response::IntoResponse,
    http::HeaderMap,
};
use axum_extra::extract::cookie::CookieJar;
use mongodb::bson::{doc, oid::ObjectId, Document};

use crate::models::data::*;
use crate::repositories::data_repo::DataRepository;
use crate::repositories::workspace_repo::WorkspaceRepository;
use crate::state::SharedState;
use crate::handlers::auth_handler::extract_user_id;

/// Helper: verify user owns workspace and return workspace_id as ObjectId
async fn verify_workspace_access(
    state: &SharedState,
    headers: &HeaderMap,
    jar: &CookieJar,
    ws_id_str: &str,
) -> Result<ObjectId, axum::response::Response> {
    // Auth check
    let user_id = extract_user_id(headers, jar, &state.jwt_secret)
        .ok_or_else(|| (
            axum::http::StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": "Not logged in" })),
        ).into_response())?;

    // Parse workspace_id
    let ws_oid = ObjectId::parse_str(ws_id_str).map_err(|_| (
        axum::http::StatusCode::BAD_REQUEST,
        axum::Json(serde_json::json!({ "error": "Invalid workspace ID" })),
    ).into_response())?;

    // Check ownership
    let ws_repo = WorkspaceRepository::new(&state.db);
    let ws = ws_repo.find_by_id(&ws_oid).await.map_err(|_| (
        axum::http::StatusCode::INTERNAL_SERVER_ERROR,
        axum::Json(serde_json::json!({ "error": "Database error" })),
    ).into_response())?;

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
            ).into_response())
        },
        None => Err((
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Workspace not found" })),
        ).into_response()),
    }
}

// ===== TASKS =====

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
        Ok(tasks) => axum::Json(serde_json::json!({ "success": true, "tasks": tasks })).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        ).into_response(),
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

    let task = TaskDocument {
        id: None,
        workspace_id: ws_oid,
        title: payload.title,
        project: payload.project,
        duration_minutes: payload.duration_minutes,
        date: payload.date,
        end_date: payload.end_date,
        status: payload.status,
        category: payload.category,
        notes: payload.notes,
        assignee_ids: payload.assignee_ids,
        sprint_id: payload.sprint_id,
        is_archived: payload.is_archived,
        checklist: payload.checklist,
        created_at: None,
        updated_at: None,
    };

    let repo = DataRepository::new(&state.db);
    match repo.create_task(task).await {
        Ok(created) => axum::Json(serde_json::json!({ "success": true, "task": created })).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        ).into_response(),
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
        Err(_) => return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({ "error": "Invalid task ID" })),
        ).into_response(),
    };

    // Build update document from provided fields only
    let mut updates = Document::new();
    if let Some(v) = payload.title { updates.insert("title", v); }
    if let Some(v) = payload.project { updates.insert("project", v); }
    if let Some(v) = payload.duration_minutes { updates.insert("duration_minutes", v); }
    if let Some(v) = payload.date { updates.insert("date", v); }
    if let Some(v) = payload.end_date { updates.insert("end_date", v); }
    if let Some(v) = payload.status { updates.insert("status", v); }
    if let Some(v) = payload.category { updates.insert("category", v); }
    if let Some(v) = payload.notes { updates.insert("notes", v); }
    if let Some(v) = payload.assignee_ids {
        match v {
            Some(ids) => { updates.insert("assignee_ids", ids); },
            None => { updates.insert("assignee_ids", mongodb::bson::Bson::Null); },
        }
    }
    if let Some(v) = payload.sprint_id {
        match v {
            Some(s) => { updates.insert("sprint_id", s); },
            None => { updates.insert("sprint_id", mongodb::bson::Bson::Null); },
        }
    }
    if let Some(v) = payload.is_archived { updates.insert("is_archived", v); }
    if let Some(v) = payload.checklist {
        match v {
            Some(c) => {
                let bson_val = mongodb::bson::to_bson(&c).unwrap_or(mongodb::bson::Bson::Null);
                updates.insert("checklist", bson_val);
            },
            None => { updates.insert("checklist", mongodb::bson::Bson::Null); },
        }
    }

    if updates.is_empty() {
        return axum::Json(serde_json::json!({ "success": true, "message": "No changes" })).into_response();
    }

    let repo = DataRepository::new(&state.db);
    match repo.update_task(&task_oid, &ws_oid, updates).await {
        Ok(true) => axum::Json(serde_json::json!({ "success": true })).into_response(),
        Ok(false) => (
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Task not found" })),
        ).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        ).into_response(),
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
        Err(_) => return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({ "error": "Invalid task ID" })),
        ).into_response(),
    };

    let repo = DataRepository::new(&state.db);
    match repo.delete_task(&task_oid, &ws_oid).await {
        Ok(true) => axum::Json(serde_json::json!({ "success": true })).into_response(),
        Ok(false) => (
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Task not found" })),
        ).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        ).into_response(),
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
        Ok(projects) => axum::Json(serde_json::json!({ "success": true, "projects": projects })).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        ).into_response(),
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
        Ok(created) => axum::Json(serde_json::json!({ "success": true, "project": created })).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        ).into_response(),
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
        Err(_) => return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({ "error": "Invalid project ID" })),
        ).into_response(),
    };

    let mut updates = Document::new();
    if let Some(v) = payload.name { updates.insert("name", v); }
    if let Some(v) = payload.repo_url {
        match v {
            Some(url) => { updates.insert("repo_url", url); },
            None => { updates.insert("repo_url", mongodb::bson::Bson::Null); },
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
        ).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        ).into_response(),
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
        Err(_) => return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({ "error": "Invalid project ID" })),
        ).into_response(),
    };

    let repo = DataRepository::new(&state.db);
    match repo.delete_project(&proj_oid, &ws_oid).await {
        Ok(true) => axum::Json(serde_json::json!({ "success": true })).into_response(),
        Ok(false) => (
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Project not found" })),
        ).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        ).into_response(),
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
        Ok(assignees) => axum::Json(serde_json::json!({ "success": true, "assignees": assignees })).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        ).into_response(),
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

    let assignee = AssigneeDocument {
        id: None,
        workspace_id: ws_oid,
        name: payload.name,
        color: payload.color,
        discord_id: payload.discord_id,
        user_id: payload.user_id,
        created_at: None,
    };

    let repo = DataRepository::new(&state.db);
    match repo.create_assignee(assignee).await {
        Ok(created) => axum::Json(serde_json::json!({ "success": true, "assignee": created })).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        ).into_response(),
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
        Err(_) => return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({ "error": "Invalid assignee ID" })),
        ).into_response(),
    };

    let mut updates = Document::new();
    if let Some(v) = payload.name { updates.insert("name", v); }
    if let Some(v) = payload.color { updates.insert("color", v); }
    if let Some(v) = payload.discord_id {
        match v {
            Some(d) => { updates.insert("discord_id", d); },
            None => { updates.insert("discord_id", mongodb::bson::Bson::Null); },
        }
    }
    if let Some(v) = payload.user_id {
        match v {
            Some(u) => { updates.insert("user_id", u); },
            None => { updates.insert("user_id", mongodb::bson::Bson::Null); },
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
        ).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        ).into_response(),
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
        Err(_) => return (
            axum::http::StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({ "error": "Invalid assignee ID" })),
        ).into_response(),
    };

    let repo = DataRepository::new(&state.db);
    match repo.delete_assignee(&assignee_oid, &ws_oid).await {
        Ok(true) => axum::Json(serde_json::json!({ "success": true })).into_response(),
        Ok(false) => (
            axum::http::StatusCode::NOT_FOUND,
            axum::Json(serde_json::json!({ "error": "Assignee not found" })),
        ).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": format!("{}", e) })),
        ).into_response(),
    }
}
