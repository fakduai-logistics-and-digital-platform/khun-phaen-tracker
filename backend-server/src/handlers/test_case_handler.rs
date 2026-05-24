use crate::handlers::auth_handler::extract_claims;
use crate::models::data::TaskDocument;
use crate::models::test_case::{
    ClassicStep, CreateTestCaseRequest, CreateTestSuiteRequest, GherkinStep, TestCase,
    TestCaseAttachment,
};
use crate::repositories::data_repo::DataRepository;
use crate::repositories::profile_repo::ProfileRepository;
use crate::repositories::test_case_repo::TestCaseRepository;
use crate::repositories::test_suite_repo::TestSuiteRepository;
use crate::repositories::user_repo::UserRepository;
use crate::services::auth_service::AuthService;
use crate::services::test_case_service::TestCaseService;
use crate::services::test_suite_service::TestSuiteService;
use crate::state::AppState;
use aws_sdk_s3::primitives::ByteStream;
use axum::{
    extract::{Multipart, Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use axum_extra::extract::cookie::CookieJar;
use chrono::Utc;
use mongodb::bson::{doc, oid::ObjectId};
use std::sync::Arc;
use uuid::Uuid;

#[derive(serde::Deserialize)]
pub struct TestCaseQuery {
    pub suite_id: Option<String>,
    pub limit: Option<i64>,
    pub page: Option<u64>,
    pub q: Option<String>,
    pub field: Option<String>,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub fixed: Option<String>,
    pub assign_dev: Option<String>,
}

/// GET /api/workspaces/:ws_id/test-cases
pub async fn list_test_cases(
    State(state): State<Arc<AppState>>,
    Path(ws_id): Path<String>,
    axum::extract::Query(query): axum::extract::Query<TestCaseQuery>,
) -> impl IntoResponse {
    let ws_oid = match ObjectId::parse_str(&ws_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, "Invalid workspace ID").into_response(),
    };

    let repo = TestCaseRepository::new(&state.db);
    let suite_repo = TestSuiteRepository::new(&state.db);
    let service = TestCaseService::new(repo, suite_repo);

    match service.list_test_cases(
        &ws_oid, 
        query.suite_id, 
        query.q, 
        query.field, 
        query.priority,
        query.status,
        query.fixed,
        query.assign_dev,
        query.limit, 
        query.page
    ).await {
        Ok(tcs) => (StatusCode::OK, Json(tcs)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/// GET /api/test-cases/:id
pub async fn get_test_case(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let repo = TestCaseRepository::new(&state.db);

    match repo.find_by_id(&id).await {
        Ok(Some(tc)) => (StatusCode::OK, Json(tc)).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Test case not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/// PATCH /api/test-cases/:id
pub async fn update_test_case(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<serde_json::Value>,
) -> impl IntoResponse {
    let claims = match extract_claims(&headers, &jar, &state.jwt_secret) {
        Some(c) => c,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    let user_repo = UserRepository::new(&state.db);
    let profile_repo = ProfileRepository::new(&state.db);

    if !AuthService::can_mutate_test_cases(&user_repo, &profile_repo, &claims).await {
        return (StatusCode::FORBIDDEN, "Permission denied").into_response();
    }

    let repo = TestCaseRepository::new(&state.db);

    let tc = match repo.find_by_id(&id).await {
        Ok(Some(tc)) => tc,
        Ok(None) => return (StatusCode::NOT_FOUND, "Test case not found").into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    let mut updates = doc! {};
    if let Some(obj) = req.as_object() {
        for (k, v) in obj {
            if k == "id" || k == "_id" || k == "workspace_id" {
                continue;
            }
            if let Ok(bson) = mongodb::bson::to_bson(v) {
                updates.insert(k, bson);
            }
        }
    }

    match repo.update(&id, &tc.workspace_id, updates).await {
        Ok(true) => (StatusCode::OK, "Updated").into_response(),
        Ok(false) => (StatusCode::NOT_FOUND, "Test case not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/// GET /api/workspaces/:ws_id/test-suites
pub async fn list_suites(
    State(state): State<Arc<AppState>>,
    Path(ws_id): Path<String>,
) -> impl IntoResponse {
    let ws_oid = match ObjectId::parse_str(&ws_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, "Invalid workspace ID").into_response(),
    };

    let repo = TestSuiteRepository::new(&state.db);
    let case_repo = TestCaseRepository::new(&state.db);
    let service = TestSuiteService::new(repo, case_repo);

    match service.list_suites(&ws_oid).await {
        Ok(suites) => (StatusCode::OK, Json(suites)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/// POST /api/workspaces/:ws_id/test-suites
pub async fn create_suite(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(ws_id): Path<String>,
    Json(req): Json<CreateTestSuiteRequest>,
) -> impl IntoResponse {
    let claims = match extract_claims(&headers, &jar, &state.jwt_secret) {
        Some(c) => c,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    let user_repo = UserRepository::new(&state.db);
    let profile_repo = ProfileRepository::new(&state.db);

    if !AuthService::can_mutate_test_cases(&user_repo, &profile_repo, &claims).await {
        return (StatusCode::FORBIDDEN, "Permission denied").into_response();
    }

    let ws_oid = match ObjectId::parse_str(&ws_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, "Invalid workspace ID").into_response(),
    };

    let repo = TestSuiteRepository::new(&state.db);
    let case_repo = TestCaseRepository::new(&state.db);
    let service = TestSuiteService::new(repo, case_repo);

    match service.create_suite(ws_oid, req).await {
        Ok(suite) => (StatusCode::CREATED, Json(suite)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

#[derive(serde::Deserialize)]
pub struct UpdateTestSuiteRequest {
    pub title: String,
}

/// PATCH /api/test-suites/:id
pub async fn update_suite(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<UpdateTestSuiteRequest>,
) -> impl IntoResponse {
    let claims = match extract_claims(&headers, &jar, &state.jwt_secret) {
        Some(c) => c,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    let user_repo = UserRepository::new(&state.db);
    let profile_repo = ProfileRepository::new(&state.db);

    if !AuthService::can_mutate_test_cases(&user_repo, &profile_repo, &claims).await {
        return (StatusCode::FORBIDDEN, "Permission denied").into_response();
    }

    let repo = TestSuiteRepository::new(&state.db);
    let case_repo = TestCaseRepository::new(&state.db);
    let service = TestSuiteService::new(repo, case_repo);

    match service.update_suite(&id, req.title.clone()).await {
        Ok(success) => {
            if success {
                tracing::info!("Successfully updated suite: {}", id);
                StatusCode::OK.into_response()
            } else {
                tracing::warn!("Suite not found for update: {}", id);
                (StatusCode::NOT_FOUND, "Suite not found").into_response()
            }
        }
        Err(e) => {
            tracing::error!("Failed to update suite {}: {:?}", id, e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        }
    }
}

#[derive(serde::Deserialize)]
pub struct DeleteTestSuiteQuery {
    pub mode: Option<String>, // "move" or "delete"
}

/// DELETE /api/test-suites/:id
pub async fn delete_suite(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(id): Path<String>,
    axum::extract::Query(query): axum::extract::Query<DeleteTestSuiteQuery>,
) -> impl IntoResponse {
    let claims = match extract_claims(&headers, &jar, &state.jwt_secret) {
        Some(c) => c,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    let user_repo = UserRepository::new(&state.db);
    let profile_repo = ProfileRepository::new(&state.db);

    if !AuthService::can_mutate_test_cases(&user_repo, &profile_repo, &claims).await {
        return (StatusCode::FORBIDDEN, "Permission denied").into_response();
    }

    let repo = TestSuiteRepository::new(&state.db);
    let case_repo = TestCaseRepository::new(&state.db);
    let service = TestSuiteService::new(repo, case_repo);

    let delete_cases = query.mode.as_deref() == Some("delete");

    match service.delete_suite(&id, delete_cases).await {
        Ok(success) => {
            if success {
                StatusCode::NO_CONTENT.into_response()
            } else {
                (StatusCode::NOT_FOUND, "Suite not found").into_response()
            }
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/// GET /api/workspaces/:ws_id/test-cases/next-number
pub async fn get_next_test_case_number(
    State(state): State<Arc<AppState>>,
    Path(ws_id): Path<String>,
) -> impl IntoResponse {
    let ws_oid = match ObjectId::parse_str(&ws_id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid workspace ID"})),
            )
                .into_response()
        }
    };

    let repo = TestCaseRepository::new(&state.db);

    match repo.next_test_no(&ws_oid).await {
        Ok(next_no) => (
            StatusCode::OK,
            Json(serde_json::json!({"next_number": next_no})),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": e.to_string()})),
        )
            .into_response(),
    }
}

/// GET /api/workspaces/:ws_id/test-cases/counts
pub async fn get_test_case_counts(
    State(state): State<Arc<AppState>>,
    Path(ws_id): Path<String>,
) -> impl IntoResponse {
    let ws_oid = match ObjectId::parse_str(&ws_id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid workspace ID"})),
            )
                .into_response()
        }
    };

    let repo = TestCaseRepository::new(&state.db);

    match repo.count_by_workspace(&ws_oid).await {
        Ok(counts) => (StatusCode::OK, Json(serde_json::json!(counts))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": e.to_string()})),
        )
            .into_response(),
    }
}

/// POST /api/workspaces/:ws_id/test-cases
pub async fn create_test_case(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(ws_id): Path<String>,
    Json(req): Json<CreateTestCaseRequest>,
) -> impl IntoResponse {
    let claims = match extract_claims(&headers, &jar, &state.jwt_secret) {
        Some(c) => c,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    let user_repo = UserRepository::new(&state.db);
    let profile_repo = ProfileRepository::new(&state.db);

    if !AuthService::can_mutate_test_cases(&user_repo, &profile_repo, &claims).await {
        return (StatusCode::FORBIDDEN, "Permission denied").into_response();
    }

    let ws_oid = match ObjectId::parse_str(&ws_id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid workspace ID"})),
            )
                .into_response()
        }
    };

    let repo = TestCaseRepository::new(&state.db);
    let suite_repo = TestSuiteRepository::new(&state.db);
    let service = TestCaseService::new(repo, suite_repo);

    match service.create_test_case(ws_oid, req).await {
        Ok(tc) => (StatusCode::CREATED, Json(serde_json::json!(tc)))
            .into_response(),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": e.to_string()})),
        )
            .into_response(),
    }
}

/// POST /api/workspaces/:ws_id/test-cases/:test_case_id/attachments
pub async fn upload_test_case_attachment(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
    Path((ws_id_str, test_case_id)): Path<(String, String)>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let claims = match extract_claims(&headers, &jar, &state.jwt_secret) {
        Some(c) => c,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    let user_repo = UserRepository::new(&state.db);
    let profile_repo = ProfileRepository::new(&state.db);

    if !AuthService::can_mutate_test_cases(&user_repo, &profile_repo, &claims).await {
        return (StatusCode::FORBIDDEN, "Permission denied").into_response();
    }

    let ws_oid = match ObjectId::parse_str(&ws_id_str) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid workspace ID"})),
            )
                .into_response()
        }
    };

    let repo = TestCaseRepository::new(&state.db);
    let suite_repo = TestSuiteRepository::new(&state.db);
    let service = TestCaseService::new(repo, suite_repo);

    let tc = match service.find_by_id(&test_case_id).await {
        Ok(Some(t)) => t,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Test case not found"})),
            )
                .into_response()
        }
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": e.to_string()})),
            )
                .into_response()
        }
    };

    if tc.workspace_id != ws_oid {
        return (
            StatusCode::FORBIDDEN,
            Json(
                serde_json::json!({"error": "Test case does not belong to this workspace"}),
            ),
        )
            .into_response();
    }

    let storage = state.storage_snapshot().await;
    let client = match &storage.client {
        Some(c) => c,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "Storage is disabled"})),
            )
                .into_response()
        }
    };

    let mut attached_files: Vec<TestCaseAttachment> = Vec::new();

    while let Some(field) = multipart.next_field().await.unwrap_or(None) {
        let file_name = field
            .file_name()
            .unwrap_or("unknown.file")
            .to_string();
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
        let file_key = format!(
            "{}/test-cases/{}/{}",
            ws_id_str, test_case_id, file_uuid
        );

        let upload_res = client
            .put_object()
            .bucket(&storage.bucket)
            .key(&file_key)
            .content_type(&mime_type)
            .body(ByteStream::from(file_bytes.clone()))
            .send()
            .await;

        match upload_res {
            Ok(_) => {
                attached_files.push(TestCaseAttachment {
                    id: file_uuid,
                    filename: file_name,
                    file_key,
                    mime_type,
                    size: file_bytes.len() as i64,
                    uploaded_at: Utc::now().to_rfc3339(),
                });
            }
            Err(e) => {
                tracing::error!(
                    "Failed to upload test case attachment: {:?}",
                    e
                );
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": "Storage error"})),
                )
                    .into_response();
            }
        }
    }

    if attached_files.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "No valid files received"})),
        )
            .into_response();
    }

    let mut current = tc.attachments.unwrap_or_default();
    current.extend(attached_files.clone());

    if let Ok(bson) = mongodb::bson::to_bson(&current) {
        let updates = doc! { "attachments": bson };
        if let Err(e) = service
            .update_attachments(&test_case_id, &ws_oid, updates)
            .await
        {
            tracing::error!(
                "Failed to update test case attachments in DB: {:?}",
                e
            );
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Failed to update db"})),
            )
                .into_response();
        }
    }

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "success": true,
            "attachments": attached_files
        })),
    )
        .into_response()
}

#[derive(serde::Deserialize)]
pub struct UpdateTestCaseStepsRequest {
    pub step_format: String,
    pub classic_steps: Option<Vec<crate::models::test_case::ClassicStep>>,
    pub gherkin_steps: Option<Vec<crate::models::test_case::GherkinStep>>,
}

/// PATCH /api/test-cases/:id/steps
pub async fn update_test_case_steps(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<UpdateTestCaseStepsRequest>,
) -> impl IntoResponse {
    let claims = match extract_claims(&headers, &jar, &state.jwt_secret) {
        Some(c) => c,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    let user_repo = UserRepository::new(&state.db);
    let profile_repo = ProfileRepository::new(&state.db);

    if !AuthService::can_mutate_test_cases(&user_repo, &profile_repo, &claims).await {
        return (StatusCode::FORBIDDEN, "Permission denied").into_response();
    }

    let repo = TestCaseRepository::new(&state.db);

    let tc = match repo.find_by_id(&id).await {
        Ok(Some(tc)) => tc,
        Ok(None) => return (StatusCode::NOT_FOUND, "Test case not found").into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    let mut updates = doc! {
        "step_format": &req.step_format,
        "updated_at": Utc::now().to_rfc3339(),
    };

    if req.step_format == "classic" {
        if let Some(steps) = req.classic_steps {
            if let Ok(bson) = mongodb::bson::to_bson(&steps) {
                updates.insert("classic_steps", bson);
                // Clear gherkin steps when switching to classic
                updates.insert("gherkin_steps", mongodb::bson::Bson::Null);
            }
        }
    } else if req.step_format == "gherkin" {
        if let Some(steps) = req.gherkin_steps {
            if let Ok(bson) = mongodb::bson::to_bson(&steps) {
                updates.insert("gherkin_steps", bson);
                // Clear classic steps when switching to gherkin
                updates.insert("classic_steps", mongodb::bson::Bson::Null);
            }
        }
    }

    match repo.update(&id, &tc.workspace_id, updates).await {
        Ok(true) => (StatusCode::OK, "Steps updated").into_response(),
        Ok(false) => (StatusCode::NOT_FOUND, "Test case not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

#[derive(serde::Deserialize)]
pub struct UpdateTestCaseStatusRequest {
    pub status: String,
}

/// PATCH /api/test-cases/:id/status
pub async fn update_test_case_status(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<UpdateTestCaseStatusRequest>,
) -> impl IntoResponse {
    let claims = match extract_claims(&headers, &jar, &state.jwt_secret) {
        Some(c) => c,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    let user_repo = UserRepository::new(&state.db);
    let profile_repo = ProfileRepository::new(&state.db);

    if !AuthService::can_mutate_test_cases(&user_repo, &profile_repo, &claims).await {
        return (StatusCode::FORBIDDEN, "Permission denied").into_response();
    }

    let repo = TestCaseRepository::new(&state.db);

    let tc = match repo.find_by_id(&id).await {
        Ok(Some(tc)) => tc,
        Ok(None) => return (StatusCode::NOT_FOUND, "Test case not found").into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    let updates = doc! {
        "status": req.status,
        "updated_at": Utc::now().to_rfc3339(),
    };

    match repo.update(&id, &tc.workspace_id, updates).await {
        Ok(true) => (StatusCode::OK, "Status updated").into_response(),
        Ok(false) => (StatusCode::NOT_FOUND, "Test case not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

#[derive(serde::Deserialize)]
pub struct UpdateTestCaseFixedRequest {
    pub fixed: String,
}

/// PATCH /api/test-cases/:id/fixed
pub async fn update_test_case_fixed(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<UpdateTestCaseFixedRequest>,
) -> impl IntoResponse {
    let _claims = match extract_claims(&headers, &jar, &state.jwt_secret) {
        Some(c) => c,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    let repo = TestCaseRepository::new(&state.db);

    let tc = match repo.find_by_id(&id).await {
        Ok(Some(tc)) => tc,
        Ok(None) => return (StatusCode::NOT_FOUND, "Test case not found").into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    let updates = doc! {
        "fixed": req.fixed,
        "updated_at": Utc::now().to_rfc3339(),
    };

    match repo.update(&id, &tc.workspace_id, updates).await {
        Ok(true) => (StatusCode::OK, "Fixed status updated").into_response(),
        Ok(false) => (StatusCode::NOT_FOUND, "Test case not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

#[derive(serde::Deserialize)]
pub struct UpdateTestCasePriorityRequest {
    pub priority: String,
}

/// PATCH /api/test-cases/:id/priority
pub async fn update_test_case_priority(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<UpdateTestCasePriorityRequest>,
) -> impl IntoResponse {
    let claims = match extract_claims(&headers, &jar, &state.jwt_secret) {
        Some(c) => c,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    let user_repo = UserRepository::new(&state.db);
    let profile_repo = ProfileRepository::new(&state.db);

    if !AuthService::can_mutate_test_cases(&user_repo, &profile_repo, &claims).await {
        return (StatusCode::FORBIDDEN, "Permission denied").into_response();
    }

    let repo = TestCaseRepository::new(&state.db);

    let tc = match repo.find_by_id(&id).await {
        Ok(Some(tc)) => tc,
        Ok(None) => return (StatusCode::NOT_FOUND, "Test case not found").into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    let updates = doc! {
        "priority": req.priority,
        "updated_at": Utc::now().to_rfc3339(),
    };

    match repo.update(&id, &tc.workspace_id, updates).await {
        Ok(true) => (StatusCode::OK, "Priority updated").into_response(),
        Ok(false) => (StatusCode::NOT_FOUND, "Test case not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

#[derive(serde::Deserialize)]
pub struct UpdateTestCaseAssignTesterRequest {
    pub assign_tester: String,
}

/// PATCH /api/test-cases/:id/assign-tester
pub async fn update_test_case_assign_tester(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<UpdateTestCaseAssignTesterRequest>,
) -> impl IntoResponse {
    let claims = match extract_claims(&headers, &jar, &state.jwt_secret) {
        Some(c) => c,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    let user_repo = UserRepository::new(&state.db);
    let profile_repo = ProfileRepository::new(&state.db);

    if !AuthService::can_mutate_test_cases(&user_repo, &profile_repo, &claims).await {
        return (StatusCode::FORBIDDEN, "Permission denied").into_response();
    }

    let repo = TestCaseRepository::new(&state.db);

    let tc = match repo.find_by_id(&id).await {
        Ok(Some(tc)) => tc,
        Ok(None) => return (StatusCode::NOT_FOUND, "Test case not found").into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    let updates = doc! {
        "assign_tester": req.assign_tester,
        "updated_at": Utc::now().to_rfc3339(),
    };

    match repo.update(&id, &tc.workspace_id, updates).await {
        Ok(true) => (StatusCode::OK, "Assign Tester updated").into_response(),
        Ok(false) => (StatusCode::NOT_FOUND, "Test case not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

#[derive(serde::Deserialize)]
pub struct UpdateTestCaseAssignDevRequest {
    pub assign_dev: String,
}

/// PATCH /api/test-cases/:id/assign-dev
pub async fn update_test_case_assign_dev(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<UpdateTestCaseAssignDevRequest>,
) -> impl IntoResponse {
    let claims = match extract_claims(&headers, &jar, &state.jwt_secret) {
        Some(c) => c,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    let user_repo = UserRepository::new(&state.db);
    let profile_repo = ProfileRepository::new(&state.db);

    let is_admin_or_qa = AuthService::can_mutate_test_cases(&user_repo, &profile_repo, &claims).await;

    let repo = TestCaseRepository::new(&state.db);

    let tc = match repo.find_by_id(&id).await {
        Ok(Some(tc)) => tc,
        Ok(None) => return (StatusCode::NOT_FOUND, "Test case not found").into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    // If not QA/Admin, they can only assign themselves or unassign
    if !is_admin_or_qa && req.assign_dev != "unassigned" {
        let data_repo = crate::repositories::data_repo::DataRepository::new(&state.db);
        let assignees = data_repo.find_assignees(&tc.workspace_id).await.unwrap_or_default();
        
        let is_valid_assignee = assignees.iter().any(|a| {
            a.id.map(|oid| oid.to_hex()) == Some(req.assign_dev.clone())
            && a.user_id == Some(claims.sub.clone())
        });

        if !is_valid_assignee {
            return (StatusCode::FORBIDDEN, "Permission denied. You can only assign yourself.").into_response();
        }
    }

    let updates = doc! {
        "assign_dev": req.assign_dev,
        "updated_at": Utc::now().to_rfc3339(),
    };

    match repo.update(&id, &tc.workspace_id, updates).await {
        Ok(true) => (StatusCode::OK, "Assign Dev updated").into_response(),
        Ok(false) => (StatusCode::NOT_FOUND, "Test case not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

#[derive(serde::Deserialize)]
pub struct UpdateTestCaseNotesRequest {
    pub dev_note: Option<String>,
    pub test_note: Option<String>,
}

/// PATCH /api/test-cases/:id/notes
pub async fn update_test_case_notes(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<UpdateTestCaseNotesRequest>,
) -> impl IntoResponse {
    let claims = match extract_claims(&headers, &jar, &state.jwt_secret) {
        Some(c) => c,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    let user_repo = UserRepository::new(&state.db);
    let profile_repo = ProfileRepository::new(&state.db);

    let is_admin_or_qa = AuthService::can_mutate_test_cases(&user_repo, &profile_repo, &claims).await;

    let repo = TestCaseRepository::new(&state.db);

    let tc = match repo.find_by_id(&id).await {
        Ok(Some(tc)) => tc,
        Ok(None) => return (StatusCode::NOT_FOUND, "Test case not found").into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    let mut updates = doc! {
        "updated_at": Utc::now().to_rfc3339(),
    };

    if let Some(dev_note) = req.dev_note {
        updates.insert("dev_note", dev_note);
    }

    if let Some(test_note) = req.test_note {
        if is_admin_or_qa {
            updates.insert("test_note", test_note);
        }
    }

    match repo.update(&id, &tc.workspace_id, updates).await {
        Ok(true) => (StatusCode::OK, "Notes updated").into_response(),
        Ok(false) => (StatusCode::NOT_FOUND, "Test case not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/// DELETE /api/test-cases/:id
pub async fn delete_test_case(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let claims = match extract_claims(&headers, &jar, &state.jwt_secret) {
        Some(c) => c,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    let user_repo = UserRepository::new(&state.db);
    let profile_repo = ProfileRepository::new(&state.db);

    if !AuthService::can_mutate_test_cases(&user_repo, &profile_repo, &claims).await {
        return (StatusCode::FORBIDDEN, "Permission denied").into_response();
    }

    let repo = TestCaseRepository::new(&state.db);

    match repo.delete(&id).await {
        Ok(true) => (StatusCode::OK, "Test case deleted").into_response(),
        Ok(false) => (StatusCode::NOT_FOUND, "Test case not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/// POST /api/test-cases/:id/convert-to-task
pub async fn convert_test_case_to_task(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let claims = match extract_claims(&headers, &jar, &state.jwt_secret) {
        Some(c) => c,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    let repo = TestCaseRepository::new(&state.db);
    let data_repo = DataRepository::new(&state.db);

    let test_case = match repo.find_by_id(&id).await {
        Ok(Some(tc)) => tc,
        Ok(None) => return (StatusCode::NOT_FOUND, "Test case not found").into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    let next_number = match data_repo.get_next_task_number(&test_case.workspace_id).await {
        Ok(num) => num,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    let title = build_task_title_from_test_case(&test_case);
    let notes = build_task_notes_from_test_case(&test_case);

    // Find assignee for the current user in this workspace
    let assignee_id = match data_repo
        .find_assignee_by_user_id_and_workspace(&claims.sub, &test_case.workspace_id)
        .await
    {
        Ok(Some(a)) => a.id.map(|oid| oid.to_hex()),
        _ => None,
    };

    let task = TaskDocument {
        id: None,
        workspace_id: test_case.workspace_id,
        title,
        task_number: Some(next_number),
        project: "อื่นๆ".to_string(),
        duration_minutes: 0,
        start_date: None,
        date: Some(chrono::Utc::now().format("%Y-%m-%d").to_string()),
        end_date: None,
        due_date: None,
        status: "todo".to_string(),
        priority: test_case.priority,
        task_type: None,
        category: "อื่นๆ".to_string(),
        notes,
        attachments: None,
        assignee_ids: assignee_id.map(|id| vec![id]),
        sprint_id: None,
        is_archived: false,
        checklist: None,
        links: None,
        testcase_id: Some(id.clone()),
        created_at: None,
        updated_at: None,
    };

    match data_repo.create_task(task).await {
        Ok(created_task) => (
            StatusCode::CREATED,
            Json(serde_json::json!({
                "success": true,
                "task_id": created_task.id.unwrap().to_hex()
            })),
        )
            .into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

fn build_task_title_from_test_case(test_case: &TestCase) -> String {
    format!("กำลังแก้: {}", test_case.name)
}

fn build_task_notes_from_test_case(test_case: &TestCase) -> String {
    let mut notes = String::new();

    append_notes_section(
        &mut notes,
        "Test Case",
        &format!(
            "Open: /workspace/{}/test-cases/editor?suite={}&case={}",
            test_case.workspace_id.to_hex(),
            test_case.suite_id,
            test_case.id
        ),
    );
    append_optional_notes_section(&mut notes, "Description", test_case.description.as_deref());
    append_optional_notes_section(
        &mut notes,
        "Pre-conditions",
        test_case.preconditions.as_deref(),
    );
    append_optional_notes_section(
        &mut notes,
        "Post-conditions",
        test_case.postconditions.as_deref(),
    );
    append_optional_notes_section(&mut notes, "Input", test_case.input.as_deref());
    append_optional_notes_section(
        &mut notes,
        "Expected Result",
        test_case.expected_result.as_deref(),
    );

    if let Some(steps) = format_test_steps(test_case) {
        append_notes_section(&mut notes, "Test Steps", &steps);
    }

    notes
}

fn append_optional_notes_section(notes: &mut String, title: &str, value: Option<&str>) {
    if let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) {
        append_notes_section(notes, title, value);
    }
}

fn append_notes_section(notes: &mut String, title: &str, value: &str) {
    if !notes.is_empty() {
        notes.push_str("\n\n");
    }

    notes.push_str(title);
    notes.push('\n');
    notes.push_str(value.trim());
}

fn format_test_steps(test_case: &TestCase) -> Option<String> {
    if test_case.step_format == "gherkin" {
        format_gherkin_steps(test_case.gherkin_steps.as_deref())
    } else {
        format_classic_steps(test_case.classic_steps.as_deref())
    }
}

fn format_gherkin_steps(steps: Option<&[GherkinStep]>) -> Option<String> {
    let formatted_steps: Vec<String> = steps?
        .iter()
        .enumerate()
        .filter_map(|(index, step)| {
            let keyword = step.keyword.trim();
            let text = step.text.trim();
            if keyword.is_empty() && text.is_empty() {
                return None;
            }

            Some(format!("{}. {} {}", index + 1, keyword, text).trim().to_string())
        })
        .collect();

    (!formatted_steps.is_empty()).then(|| formatted_steps.join("\n"))
}

fn format_classic_steps(steps: Option<&[ClassicStep]>) -> Option<String> {
    let formatted_steps: Vec<String> = steps?
        .iter()
        .enumerate()
        .filter_map(|(index, step)| {
            let lines = [
                ("Action", step.action.trim()),
                ("Data", step.data.trim()),
                ("Expected", step.expected.trim()),
            ]
            .into_iter()
            .filter_map(|(label, value)| {
                (!value.is_empty()).then(|| format!("   {}: {}", label, value))
            })
            .collect::<Vec<_>>();

            if lines.is_empty() {
                return None;
            }

            Some(format!("{}.\n{}", index + 1, lines.join("\n")))
        })
        .collect();

    (!formatted_steps.is_empty()).then(|| formatted_steps.join("\n\n"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_case_fixture() -> TestCase {
        TestCase {
            id: "case-123".to_string(),
            workspace_id: ObjectId::parse_str("507f1f77bcf86cd799439011").unwrap(),
            test_no: 7,
            suite_id: "suite-456".to_string(),
            name: "Login fails with invalid password".to_string(),
            description: Some("Verify login validation".to_string()),
            preconditions: Some("User account exists".to_string()),
            postconditions: None,
            input: None,
            expected_result: Some("Login is rejected".to_string()),
            actual_result: None,
            status: "actual".to_string(),
            priority: "high".to_string(),
            fixed: "no".to_string(),
            assign_dev: None,
            assign_tester: None,
            dev_note: None,
            test_note: None,
            step_format: "classic".to_string(),
            gherkin_steps: None,
            classic_steps: Some(vec![ClassicStep {
                action: "Open login page".to_string(),
                data: "email=user@example.com, password=wrong".to_string(),
                expected: "Error message appears".to_string(),
            }]),
            attachments: None,
            created_at: None,
            updated_at: None,
        }
    }

    #[test]
    fn builds_task_title_with_fixing_prefix() {
        let test_case = test_case_fixture();

        assert_eq!(
            build_task_title_from_test_case(&test_case),
            "กำลังแก้: Login fails with invalid password"
        );
    }

    #[test]
    fn builds_task_notes_with_test_case_link_and_classic_steps() {
        let test_case = test_case_fixture();

        let notes = build_task_notes_from_test_case(&test_case);

        assert!(notes.contains("Verify login validation"));
        assert!(notes.contains(
            "Open: /workspace/507f1f77bcf86cd799439011/test-cases/editor?suite=suite-456&case=case-123"
        ));
        assert!(notes.contains("Test Steps\n1.\n   Action: Open login page"));
        assert!(notes.contains("\n   Data: email=user@example.com, password=wrong"));
        assert!(notes.contains("\n   Expected: Error message appears"));
        assert!(!notes.contains("**"));
    }

    #[test]
    fn builds_task_notes_with_gherkin_steps_on_separate_lines() {
        let mut test_case = test_case_fixture();
        test_case.step_format = "gherkin".to_string();
        test_case.classic_steps = None;
        test_case.gherkin_steps = Some(vec![
            GherkinStep {
                keyword: "Given".to_string(),
                text: "the user is on the login page".to_string(),
            },
            GherkinStep {
                keyword: "When".to_string(),
                text: "they submit an invalid password".to_string(),
            },
        ]);

        let notes = build_task_notes_from_test_case(&test_case);

        assert!(notes.contains(
            "Test Steps\n1. Given the user is on the login page\n2. When they submit an invalid password"
        ));
        assert!(!notes.contains("**"));
    }
}

#[derive(serde::Deserialize)]
pub struct AllTestCasesQuery {
    pub suite_id: Option<String>,
    pub q: Option<String>,
    pub field: Option<String>,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub fixed: Option<String>,
    pub assign_dev: Option<String>,
}

/// GET /api/workspaces/:ws_id/test-cases/all
pub async fn get_all_test_cases(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(ws_id): Path<String>,
    axum::extract::Query(query): axum::extract::Query<AllTestCasesQuery>,
) -> impl IntoResponse {
    let _claims = match extract_claims(&headers, &jar, &state.jwt_secret) {
        Some(c) => c,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    let ws_oid = match ObjectId::parse_str(&ws_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, "Invalid workspace ID").into_response(),
    };

    let repo = TestCaseRepository::new(&state.db);

    match repo.find_by_workspace(
        &ws_oid,
        query.suite_id,
        query.q,
        query.field,
        query.priority,
        query.status,
        query.fixed,
        query.assign_dev,
        None,
        None,
    ).await {
        Ok(cases) => (StatusCode::OK, Json(cases)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/// GET /api/public/workspaces/:ws_id/all-test-cases
pub async fn get_all_test_cases_public(
    State(state): State<Arc<AppState>>,
    Path(ws_id): Path<String>,
    axum::extract::Query(query): axum::extract::Query<AllTestCasesQuery>,
) -> impl IntoResponse {
    let ws_oid = match ObjectId::parse_str(&ws_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, "Invalid workspace ID").into_response(),
    };

    let repo = TestCaseRepository::new(&state.db);

    match repo.find_by_workspace(
        &ws_oid,
        query.suite_id,
        query.q,
        query.field,
        query.priority,
        query.status,
        query.fixed,
        query.assign_dev,
        None,
        None,
    ).await {
        Ok(cases) => (StatusCode::OK, Json(cases)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}
