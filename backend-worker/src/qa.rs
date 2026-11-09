use crate::{
    auth::User, cascades, db, documents, http, qa_history, qa_query, realtime, records, workspaces,
};
use serde_json::{json, Value};
use worker::*;
const FIELDS: &[&str] = &[
    "suite_id",
    "project_id",
    "name",
    "description",
    "preconditions",
    "postconditions",
    "input",
    "expected_result",
    "actual_result",
    "status",
    "priority",
    "fixed",
    "assign_dev",
    "assign_tester",
    "dev_note",
    "test_note",
    "step_format",
    "gherkin_steps",
    "classic_steps",
];
pub async fn workspace(
    req: &mut Request,
    env: &Env,
    user: Option<&User>,
    workspace: &str,
    kind: &str,
    item: Option<&str>,
) -> Result<Response> {
    if let Some(user) = user {
        if workspaces::access(env, user, workspace).await?.is_none() {
            return http::error(403, "Access denied");
        }
    } else if req.method() != Method::Get {
        return http::error(401, "Not logged in");
    }
    if db::first::<Value>(
        &env.d1("DB")?,
        "SELECT id FROM workspaces WHERE id=?",
        &[workspace.into()],
    )
    .await?
    .is_none()
    {
        return http::error(404, "Workspace not found");
    }
    if req.method() == Method::Get {
        if kind == "test-suites" {
            let project = qa_query::project_param(&records::query(req)?);
            return qa_query::suites(env, workspace, project.as_deref()).await;
        }
        return match item {
            Some("counts") => {
                let project = qa_query::project_param(&records::query(req)?);
                http::ok(qa_query::counts(env, workspace, project.as_deref()).await?)
            }
            Some("next-number") => http::ok(
                json!({"next_number":records::next_number(env,workspace,"test-cases",false).await?}),
            ),
            None | Some("all") | Some("all-test-cases") => {
                qa_query::list(req, env, workspace, item.is_some()).await
            }
            _ => http::error(404, "Not found"),
        };
    }
    let Some(user) = user else {
        return http::error(401, "Not logged in");
    };
    if req.method() != Method::Post || item.is_some() {
        return http::error(405, "Method not allowed");
    }
    if !records::qa(user) {
        return http::error(403, "Admin or QA permissions required");
    }
    let input = http::body(req).await?;
    let mut value = if kind == "test-suites" {
        records::pick(&input, &["title", "description", "project_id"])
    } else {
        let mut value = json!({"suite_id":"","project_id":"","status":"draft","priority":"medium","fixed":"no","assign_dev":"unassigned","assign_tester":"unassigned","step_format":"classic","classic_steps":[],"gherkin_steps":null,"attachments":[]});
        records::merge(&mut value, &records::pick(&input, FIELDS));
        value
    };
    if http::text(
        &value,
        if kind == "test-suites" {
            "title"
        } else {
            "name"
        },
    )
    .trim()
    .is_empty()
    {
        return http::error(400, "Title or name required");
    }
    if kind == "test-suites" {
        let project = normalized_project(&value);
        if let Some(error) = check_project(env, workspace, &project).await? {
            return http::error(400, error);
        }
        value["project_id"] = json!(project);
    }
    if kind == "test-cases" {
        if let Some(error) = validate(env, workspace, &mut value).await? {
            return http::error(400, error);
        }
        value["test_no"] = json!(records::next_number(env, workspace, kind, true).await?);
        if value["status"] == "passed" {
            value["passed_at"] = json!(db::timestamp());
            value["status_changed_at"] = value["passed_at"].clone();
        }
    }
    let id = db::id();
    records::identity(&mut value, workspace, &id);
    let db = env.d1("DB")?;
    let mut writes = vec![records::insert_statement(&db, kind, &value, None)?];
    if kind == "test-cases" {
        writes.push(qa_history::entry_statement(
            &db,
            workspace,
            &id,
            user,
            "create",
            Vec::new(),
        )?);
    }
    let plan = crate::notifications::plan(env, user, &value, kind).await?;
    writes.extend(plan.statements);
    db.batch(writes).await?;
    crate::notifications::deliver(env, &plan.recipients).await;
    realtime::publish(
        env,
        workspace,
        if kind == "test-cases" {
            "test_case"
        } else {
            "test_suite"
        },
        "create",
        &id,
        value.clone(),
    )
    .await;
    Ok(http::ok(value)?.with_status(201))
}
pub async fn resource(
    req: &mut Request,
    env: &Env,
    user: &User,
    kind: &str,
    id: &str,
    action: Option<&str>,
) -> Result<Response> {
    if kind == "test-suites" && id == "unassigned" {
        let q = records::query(req)?;
        let ws = q
            .get("workspace_id")
            .map(String::as_str)
            .unwrap_or_default();
        if ws.is_empty() {
            return http::error(400, "workspace_id is required for the unassigned suite");
        }
        if workspaces::access(env, user, ws).await?.is_none() {
            return http::error(403, "Access denied");
        }
        return delete_suite(req, env, user, ws, id).await;
    }
    let Some(row) = records::locate(env, kind, id).await? else {
        return http::error(404, "Record not found");
    };
    let ws = &row.workspace_id;
    if workspaces::access(env, user, ws).await?.is_none() {
        return http::error(403, "Access denied");
    }
    let mut value = row.value()?;
    if kind == "test-cases" && action == Some("history") && req.method() == Method::Get {
        return http::ok(json!(qa_history::list(env, ws, id).await?));
    }
    if req.method() == Method::Get && action.is_none() {
        return http::ok(value);
    }
    if kind == "test-suites" {
        if req.method() == Method::Delete {
            return delete_suite(req, env, user, ws, id).await;
        }
        if !records::qa(user) {
            return http::error(403, "Admin or QA permissions required");
        }
        let input = http::body(req).await?;
        let mut patch = json!({"updated_at":db::timestamp()});
        if input.get("title").is_some() {
            let title = http::text(&input, "title").trim().to_owned();
            if title.is_empty() {
                return http::error(400, "Suite title required");
            }
            patch["title"] = json!(title);
        }
        let moving = input.get("project_id").is_some();
        if moving {
            let project = normalized_project(&input);
            if let Some(error) = check_project(env, ws, &project).await? {
                return http::error(400, error);
            }
            patch["project_id"] = json!(project);
        }
        if patch.as_object().is_some_and(|p| p.len() == 1) {
            return http::error(400, "Nothing to update");
        }
        let db = env.d1("DB")?;
        let mut writes = vec![records::patch_statement(
            &db,
            ws,
            "test-suites",
            id,
            &patch,
        )?];
        if moving {
            let cases: Vec<records::Row> = db::all(
                &db,
                "SELECT * FROM documents WHERE workspace_id=? AND kind='test-cases' AND json_extract(payload,'$.suite_id')=?",
                &[ws.as_str().into(), id.into()],
            )
            .await?;
            for case in cases {
                writes.push(records::patch_statement(
                    &db,
                    ws,
                    "test-cases",
                    &case.id,
                    &json!({"project_id":patch["project_id"],"updated_at":patch["updated_at"]}),
                )?);
            }
        }
        db.batch(writes).await?;
        realtime::publish(env, ws, "test_suite", "update", id, patch).await;
        if moving {
            realtime::publish(env, ws, "test_case", "refresh", id, Value::Null).await;
        }
        return http::ok(json!({"success":true}));
    }
    if req.method() == Method::Delete {
        if !records::qa(user) {
            return http::error(403, "Admin or QA permissions required");
        }
        cascades::delete(env, ws, kind, id, &value).await?;
        realtime::publish(env, ws, "test_case", "delete", id, Value::Null).await;
        return http::ok(json!({"success":true}));
    }
    if action == Some("convert-to-task") && req.method() == Method::Post {
        return convert(env, user, ws, &value).await;
    }
    if req.method() != Method::Patch {
        return http::error(405, "Method not allowed");
    }
    let mut input = http::body(req).await?;
    let fields: &[&str] = match action {
        None => FIELDS,
        Some("steps") => &["step_format", "classic_steps", "gherkin_steps"],
        Some("status") => &["status"],
        Some("fixed") => &["fixed"],
        Some("assign-dev") => &["assign_dev"],
        Some("priority") => &["priority"],
        Some("assign-tester") => &["assign_tester"],
        Some("notes") => &["dev_note", "test_note"],
        _ => return http::error(404, "Not found"),
    };
    if !records::qa(user) {
        match action {
            Some("fixed") => {}
            Some("notes") => {
                // Legacy contract: a non-QA save keeps dev_note and ignores test_note.
                if let Some(fields) = input.as_object_mut() {
                    fields.remove("test_note");
                }
            }
            Some("assign-dev") => {
                let selected = http::text(&input, "assign_dev");
                if !selected.is_empty() && selected != "unassigned" {
                    let mine = documents::get(env, ws, "assignees", selected)
                        .await?
                        .is_some_and(|a| http::text(&a, "user_id") == user.id);
                    if !mine {
                        return http::error(403, "You may only assign yourself");
                    }
                }
            }
            _ => return http::error(403, "Admin or QA permissions required"),
        }
    }
    let previous_status = http::text(&value, "status").to_owned();
    let before = value.clone();
    let mut patch = records::pick(&input, fields);
    records::merge(&mut value, &patch);
    if let Some(error) = validate(env, ws, &mut value).await? {
        return http::error(400, error);
    }
    if input.get("suite_id").is_some() || input.get("project_id").is_some() {
        patch["project_id"] = value["project_id"].clone();
    }
    if input.get("step_format").is_some() {
        patch["gherkin_steps"] = value["gherkin_steps"].clone();
        patch["classic_steps"] = value["classic_steps"].clone();
    }
    patch["updated_at"] = json!(db::timestamp());
    value["updated_at"] = patch["updated_at"].clone();
    if input.get("status").is_some() && http::text(&value, "status") != previous_status {
        // Remember when the status changed and, for "passed", when the tester marked it.
        patch["status_changed_at"] = patch["updated_at"].clone();
        patch["passed_at"] = if http::text(&value, "status") == "passed" {
            patch["updated_at"].clone()
        } else {
            Value::Null
        };
        value["status_changed_at"] = patch["status_changed_at"].clone();
        value["passed_at"] = patch["passed_at"].clone();
    }
    let db = env.d1("DB")?;
    let mut writes = vec![records::patch_statement(&db, ws, kind, id, &patch)?];
    let changed = qa_history::changes(env, ws, &before, &value).await;
    if !changed.is_empty() {
        writes.push(qa_history::entry_statement(
            &db, ws, id, user, "update", changed,
        )?);
    }
    let plan = if input.get("assign_dev").is_some() || input.get("assign_tester").is_some() {
        crate::notifications::plan(env, user, &value, kind).await?
    } else {
        crate::notifications::Plan::default()
    };
    writes.extend(plan.statements);
    db.batch(writes).await?;
    crate::notifications::deliver(env, &plan.recipients).await;
    realtime::publish(env, ws, "test_case", "update", id, value).await;
    http::ok(json!({"success":true}))
}
fn normalized_project(value: &Value) -> String {
    let id = http::text(value, "project_id").trim();
    if id == "none" || id == "unassigned" {
        String::new()
    } else {
        id.to_owned()
    }
}
async fn check_project(env: &Env, ws: &str, project: &str) -> Result<Option<&'static str>> {
    if !project.is_empty()
        && documents::get(env, ws, "projects", project)
            .await?
            .is_none()
    {
        return Ok(Some("Project does not belong to this workspace"));
    }
    Ok(None)
}
async fn validate(env: &Env, ws: &str, value: &mut Value) -> Result<Option<&'static str>> {
    for (key, allowed) in [
        ("priority", &["low", "medium", "high", "urgent"] as &[&str]),
        ("fixed", &["no", "yes"]),
        ("step_format", &["classic", "gherkin"]),
    ] {
        if !value[key].as_str().is_some_and(|v| allowed.contains(&v)) {
            return Ok(Some("Invalid test case field"));
        }
    }
    if !value["status"].as_str().is_some_and(|v| {
        [
            "draft",
            "actual",
            "deprecated",
            "ready",
            "passed",
            "failed",
            "blocked",
            "skipped",
            "pending",
            "invalid",
            "not-run",
        ]
        .contains(&v)
    }) {
        return Ok(Some("Invalid test case status"));
    }
    if http::text(value, "name").trim().is_empty() {
        return Ok(Some("Test case name required"));
    }
    let mut project = normalized_project(value);
    if let Some(suite) = value["suite_id"]
        .as_str()
        .filter(|s| !s.is_empty() && *s != "unassigned")
    {
        // A case always lives in the project of its suite.
        let Some(found) = documents::get(env, ws, "test-suites", suite).await? else {
            return Ok(Some("Suite does not belong to this workspace"));
        };
        project = normalized_project(&found);
        if check_project(env, ws, &project).await?.is_some() {
            // The suite points at a deleted project: treat the case as project-less instead of blocking saves.
            project.clear();
        }
    } else {
        value["suite_id"] = json!("")
    }
    if let Some(error) = check_project(env, ws, &project).await? {
        return Ok(Some(error));
    }
    value["project_id"] = json!(project);
    for field in ["assign_dev", "assign_tester"] {
        if let Some(id) = value[field]
            .as_str()
            .filter(|s| !s.is_empty() && *s != "unassigned")
        {
            if documents::get(env, ws, "assignees", id).await?.is_none() {
                return Ok(Some("Assignee does not belong to this workspace"));
            }
        }
    }
    if value["step_format"] == "classic" {
        value["gherkin_steps"] = Value::Null;
    } else {
        value["classic_steps"] = Value::Null;
    }
    for field in ["classic_steps", "gherkin_steps"] {
        if !value[field].is_null() && !value[field].is_array() {
            return Ok(Some("Invalid test steps"));
        }
    }
    Ok(None)
}
async fn delete_suite(
    req: &Request,
    env: &Env,
    user: &User,
    ws: &str,
    id: &str,
) -> Result<Response> {
    if req.method() != Method::Delete {
        return http::error(405, "Method not allowed");
    }
    if !records::qa(user) {
        return http::error(403, "Admin or QA permissions required");
    }
    let q = records::query(req)?;
    let delete = q.get("mode").map(String::as_str) == Some("delete");
    let condition = if id == "unassigned" {
        "NOT EXISTS(SELECT 1 FROM documents s WHERE s.id=json_extract(d.payload,'$.suite_id') AND s.kind='test-suites' AND s.workspace_id=d.workspace_id)"
    } else {
        "json_extract(d.payload,'$.suite_id')=?"
    };
    let mut args = vec![ws.into()];
    if id != "unassigned" {
        args.push(id.into());
    }
    let db = env.d1("DB")?;
    let rows:Vec<records::Row>=db::all(&db,&format!("SELECT * FROM documents d WHERE d.workspace_id=? AND d.kind='test-cases' AND {condition}"),&args).await?;
    let mut statements = Vec::new();
    for row in rows {
        if delete {
            statements.extend(cascades::delete_statements(&db, ws, "test-cases", &row.id)?)
        } else {
            statements.push(records::patch_statement(
                &db,
                ws,
                "test-cases",
                &row.id,
                &json!({"suite_id":"","updated_at":db::timestamp()}),
            )?);
        }
    }
    if id != "unassigned" {
        statements.push(db::statement(
            &db,
            "DELETE FROM documents WHERE id=? AND workspace_id=? AND kind='test-suites'",
            &[id.into(), ws.into()],
        )?);
    }
    if !statements.is_empty() {
        db.batch(statements).await?;
    }
    realtime::publish(env, ws, "test_case", "refresh", id, Value::Null).await;
    http::ok(json!({"success":true}))
}
async fn convert(env: &Env, user: &User, ws: &str, case: &Value) -> Result<Response> {
    let assignees = records::values(env, ws, "assignees").await?;
    let assignee = assignees
        .iter()
        .find(|a| http::text(a, "user_id") == user.id)
        .map(|a| http::text(a, "id").to_owned());
    let input = json!({"title":format!("กำลังแก้: {}",http::text(case,"name")),"notes":task_notes(case),"start_date":&db::timestamp()[..10],"priority":case["priority"],"category":"อื่นๆ","project":"อื่นๆ","testcase_id":case["id"],"assignee_ids":assignee.into_iter().collect::<Vec<_>>()});
    let mut req = Request::new_with_init(
        "https://internal/task",
        RequestInit::new()
            .with_method(Method::Post)
            .with_body(Some(input.to_string().into())),
    )?;
    let mut result =
        documents::handle(&mut req, env, user, &["api", "workspaces", ws, "tasks"]).await?;
    if result.status_code() != 200 {
        return Ok(result);
    }
    let result: Value = result.json().await?;
    Ok(http::ok(json!({"success":true,"task_id":result["task"]["id"]}))?.with_status(201))
}
fn task_notes(case: &Value) -> String {
    let mut notes = format!(
        "Test case #{}: {}\n\n",
        case["test_no"],
        http::text(case, "name")
    );
    for field in [
        "description",
        "preconditions",
        "postconditions",
        "input",
        "expected_result",
        "actual_result",
        "dev_note",
        "test_note",
    ] {
        let text = http::text(case, field);
        if !text.is_empty() {
            notes.push_str(&format!("{field}:\n{text}\n\n"));
        }
    }
    for field in ["classic_steps", "gherkin_steps"] {
        for step in case[field].as_array().into_iter().flatten() {
            notes.push_str(&format!(
                "{} {} {}\n",
                http::text(step, "keyword"),
                http::text(step, "action"),
                http::text(step, "text")
            ));
            if let Some(expected) = step["expected"].as_str() {
                notes.push_str(&format!("Expected: {expected}\n"));
            }
        }
    }
    notes
}
