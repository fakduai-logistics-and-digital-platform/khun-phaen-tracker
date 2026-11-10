use crate::{auth, auth::User, db, http, workspaces};
use serde_json::{json, Value};
use worker::*;

const MAX_BATCH: usize = 20;
const TASK_TYPES: [&str; 6] = ["feature", "bug", "optimize", "refactor", "docs", "chore"];
/// Agents may only file work under these two categories.
const CATEGORIES: [&str; 2] = ["งานหลัก", "งานรอง"];
const INSTRUCTIONS: &str = "Rules for tasks created or edited through this server: \
1) A task is assigned to the owner of the API key by default. If the key belongs to the workspace owner or an admin, pass `assignees` (an array of assignee names or ids, see list_assignees) in the task to assign it to other people instead; other keys cannot assign to anyone else. \
2) task_type is required on create and must be one of: feature, bug, optimize, refactor, docs, chore. \
3) project is required on create: use the exact name of an existing project (call list_projects first). \
4) category is required on create and must be \"งานหลัก\" (main work) or \"งานรอง\" (secondary work). \
5) Leave progress updates and questions as task comments with add_task_comment; they are written as the key owner. \
6) Tasks are always linked to the workspace's latest sprint; sprint_id is set by the server and cannot be changed. \
Pick task_type and category from what the work actually is; ask the user when unsure.";
const PROTOCOL: &str = "2025-03-26";

fn tool(name: &str, description: &str, properties: Value, required: &[&str]) -> Value {
    json!({"name":name,"description":description,"inputSchema":{"type":"object","properties":properties,"required":required}})
}

fn tools() -> Vec<Value> {
    let ws = json!({"type":"string","description":"Workspace id"});
    vec![
        tool("list_workspaces", "List the workspaces the key owner can access", json!({}), &[]),
        tool(
            "list_tasks",
            "List tasks in a workspace. Optional filters: status, priority, project, search, page, limit",
            json!({"workspace_id":ws,"status":{"type":"string"},"priority":{"type":"string"},"project":{"type":"string"},"search":{"type":"string"},"page":{"type":"number"},"limit":{"type":"number"}}),
            &["workspace_id"],
        ),
        tool(
            "list_my_tasks",
            "List tasks assigned to the key owner across all workspaces. Optional filters: status, page, limit",
            json!({"status":{"type":"string"},"page":{"type":"number"},"limit":{"type":"number"}}),
            &[],
        ),
        tool(
            "update_task_status",
            "Report progress by moving a task to a new status",
            json!({"workspace_id":ws,"task_id":{"type":"string"},"status":{"type":"string","enum":["pending","todo","in-progress","in-test","done"]}}),
            &["workspace_id", "task_id", "status"],
        ),
        tool(
            "list_task_comments",
            "List the comments on a task, oldest first. Optional: page, limit",
            json!({"workspace_id":ws,"task_id":{"type":"string"},"page":{"type":"number"},"limit":{"type":"number"}}),
            &["workspace_id", "task_id"],
        ),
        tool(
            "add_task_comment",
            "Post a comment on a task as the API key owner. Use it for progress updates, findings and questions",
            json!({"workspace_id":ws,"task_id":{"type":"string"},"content":{"type":"string","description":"Comment text, up to 10000 characters"}}),
            &["workspace_id", "task_id", "content"],
        ),
        tool("get_task", "Get one task", json!({"workspace_id":ws,"task_id":{"type":"string"}}), &["workspace_id", "task_id"]),
        tool(
            "create_task",
            "Create a task linked to the latest sprint (set automatically). It is assigned to the API key owner unless the key belongs to the workspace owner or an admin and `assignees` (array of assignee names or ids from list_assignees) is given. `task` needs: title, project (exact name from list_projects), task_type (feature|bug|optimize|refactor|docs|chore) and category (\"งานหลัก\" main work or \"งานรอง\" secondary work). Optional: notes, status, priority, project, due_date, checklist",
            json!({"workspace_id":ws,"task":{"type":"object"}}),
            &["workspace_id", "task"],
        ),
        tool(
            "update_task",
            "Update fields of a task. `updates` holds only the fields to change: title, notes (progress notes), status, priority, due_date (YYYY-MM-DD), project (exact name from list_projects), task_type (feature|bug|optimize|refactor|docs|chore), category (\"งานหลัก\"|\"งานรอง\"), checklist (full array of {id,text,completed}). Workspace owner and admin keys may also pass `assignees` (array of assignee names or ids) to reassign. The sprint cannot be changed",
            json!({"workspace_id":ws,"task_id":{"type":"string"},"updates":{"type":"object"}}),
            &["workspace_id", "task_id", "updates"],
        ),
        tool("list_projects", "List projects in a workspace", json!({"workspace_id":ws}), &["workspace_id"]),
        tool("list_sprints", "List sprints in a workspace", json!({"workspace_id":ws}), &["workspace_id"]),
        tool("list_assignees", "List assignees (members) in a workspace", json!({"workspace_id":ws}), &["workspace_id"]),
        tool(
            "list_test_suites",
            "List test suites in a workspace, optionally for one project (project_id, or \"none\")",
            json!({"workspace_id":ws,"project_id":{"type":"string"}}),
            &["workspace_id"],
        ),
        tool(
            "list_test_cases",
            "List test cases in a workspace. Optional filters: project_id, suite_id, search, page, limit",
            json!({"workspace_id":ws,"project_id":{"type":"string"},"suite_id":{"type":"string"},"search":{"type":"string"},"page":{"type":"number"},"limit":{"type":"number"}}),
            &["workspace_id"],
        ),
        tool(
            "get_test_case",
            "Get one test case with its steps (classic_steps or gherkin_steps), expected result and notes",
            json!({"test_case_id":{"type":"string"}}),
            &["test_case_id"],
        ),
        tool(
            "create_test_suite",
            "Create a test suite (needs QA or admin role)",
            json!({"workspace_id":ws,"title":{"type":"string"},"description":{"type":"string"},"project_id":{"type":"string"}}),
            &["workspace_id", "title"],
        ),
        tool(
            "create_test_case",
            "Create a test case (needs QA or admin role). `test_case` fields: name (required), suite_id, project_id, description, preconditions, postconditions, input, expected_result, priority (low|medium|high), status (draft|...), step_format (classic|gherkin), classic_steps [{action,data,expected}], gherkin_steps [{keyword: given|when|then|and, text}]",
            json!({"workspace_id":ws,"test_case":{"type":"object"}}),
            &["workspace_id", "test_case"],
        ),
        tool(
            "update_test_case",
            "Update fields of a test case (needs QA or admin role): name, description, preconditions, expected_result, priority, status, step_format, classic_steps, gherkin_steps, test_note, dev_note, suite_id",
            json!({"test_case_id":{"type":"string"},"updates":{"type":"object"}}),
            &["test_case_id", "updates"],
        ),
        tool("list_test_runs", "List test runs in a workspace", json!({"workspace_id":ws}), &["workspace_id"]),
        tool(
            "get_test_run",
            "Get a test run with each case's result status",
            json!({"workspace_id":ws,"run_id":{"type":"string"}}),
            &["workspace_id", "run_id"],
        ),
        tool(
            "report_test_result",
            "Record the result of one test case inside a test run (e.g. after an automated test ran)",
            json!({"workspace_id":ws,"run_id":{"type":"string"},"test_case_id":{"type":"string"},"status":{"type":"string","enum":["pending","passed","failed","blocked","skipped","invalid"]}}),
            &["workspace_id", "run_id", "test_case_id", "status"],
        ),
    ]
}

fn arg<'a>(args: &'a Value, key: &str) -> std::result::Result<&'a str, String> {
    let value = http::text(args, key);
    if value.is_empty() || value.contains(['/', '?', '#']) {
        return Err(format!("Missing or invalid argument: {key}"));
    }
    Ok(value)
}

fn query_of(args: &Value, keys: &[&str]) -> String {
    let pairs: Vec<String> = keys
        .iter()
        .filter_map(|k| {
            let v = match &args[*k] {
                Value::String(s) if !s.is_empty() => s.clone(),
                Value::Number(n) => n.to_string(),
                _ => return None,
            };
            Some(format!("{k}={}", js_sys::encode_uri_component(&v)))
        })
        .collect();
    if pairs.is_empty() {
        String::new()
    } else {
        format!("?{}", pairs.join("&"))
    }
}

/// Maps a tool call to an internal API request: (method, path, optional body).
fn plan(name: &str, args: &Value) -> std::result::Result<(Method, String, Option<Value>), String> {
    let base = |args: &Value| arg(args, "workspace_id").map(|id| format!("/api/workspaces/{id}"));
    Ok(match name {
        "list_workspaces" => (Method::Get, "/api/workspaces".into(), None),
        "list_tasks" => {
            let mut path = format!("{}/tasks", base(args)?);
            let query: Vec<String> = ["status", "priority", "project", "search", "page", "limit"]
                .iter()
                .filter_map(|k| {
                    let v = match &args[*k] {
                        Value::String(s) if !s.is_empty() => s.clone(),
                        Value::Number(n) => n.to_string(),
                        _ => return None,
                    };
                    Some(format!("{k}={}", js_sys::encode_uri_component(&v)))
                })
                .collect();
            if !query.is_empty() {
                path = format!("{path}?{}", query.join("&"));
            }
            (Method::Get, path, None)
        }
        "list_my_tasks" => {
            let query: Vec<String> = ["status", "page", "limit"]
                .iter()
                .filter_map(|k| {
                    let v = match &args[*k] {
                        Value::String(s) if !s.is_empty() => s.clone(),
                        Value::Number(n) => n.to_string(),
                        _ => return None,
                    };
                    Some(format!("{k}={}", js_sys::encode_uri_component(&v)))
                })
                .collect();
            let path = if query.is_empty() {
                "/api/my/tasks".to_owned()
            } else {
                format!("/api/my/tasks?{}", query.join("&"))
            };
            (Method::Get, path, None)
        }
        "update_task_status" => {
            let status = arg(args, "status")?;
            if !["pending", "todo", "in-progress", "in-test", "done"].contains(&status) {
                return Err("Invalid status".into());
            }
            (
                Method::Patch,
                format!("{}/tasks/{}", base(args)?, arg(args, "task_id")?),
                Some(json!({"status": status})),
            )
        }
        "list_task_comments" => (
            Method::Get,
            format!(
                "{}/tasks/{}/comments{}",
                base(args)?,
                arg(args, "task_id")?,
                query_of(args, &["page", "limit"])
            ),
            None,
        ),
        "add_task_comment" => {
            let content = http::text(args, "content").trim();
            if content.is_empty() || content.chars().count() > 10_000 {
                return Err("content is required (max 10000 characters)".into());
            }
            // The comments endpoint reads multipart form data, so the text travels as one form field.
            let boundary = format!("kp{}", db::id().replace('-', ""));
            let form = format!(
                "--{boundary}\r\nContent-Disposition: form-data; name=\"content\"\r\n\r\n{content}\r\n--{boundary}--\r\n"
            );
            (
                Method::Post,
                format!("{}/tasks/{}/comments", base(args)?, arg(args, "task_id")?),
                Some(Value::String(form)),
            )
        }
        "get_task" => (Method::Get, format!("{}/tasks/{}", base(args)?, arg(args, "task_id")?), None),
        "create_task" => (Method::Post, format!("{}/tasks", base(args)?), Some(args["task"].clone())),
        "update_task" => (
            Method::Patch,
            format!("{}/tasks/{}", base(args)?, arg(args, "task_id")?),
            Some(args["updates"].clone()),
        ),
        "list_projects" => (Method::Get, format!("{}/projects", base(args)?), None),
        "list_sprints" => (Method::Get, format!("{}/sprints", base(args)?), None),
        "list_assignees" => (Method::Get, format!("{}/assignees", base(args)?), None),
        "list_test_suites" => (
            Method::Get,
            format!("{}/test-suites{}", base(args)?, query_of(args, &["project_id"])),
            None,
        ),
        "list_test_cases" => (
            Method::Get,
            format!(
                "{}/test-cases{}",
                base(args)?,
                query_of(args, &["project_id", "suite_id", "search", "page", "limit"])
            ),
            None,
        ),
        "get_test_case" => (Method::Get, format!("/api/test-cases/{}", arg(args, "test_case_id")?), None),
        "create_test_suite" => (
            Method::Post,
            format!("{}/test-suites", base(args)?),
            Some(json!({"title":args["title"],"description":args["description"],"project_id":args["project_id"]})),
        ),
        "create_test_case" => (Method::Post, format!("{}/test-cases", base(args)?), Some(args["test_case"].clone())),
        "update_test_case" => (
            Method::Patch,
            format!("/api/test-cases/{}", arg(args, "test_case_id")?),
            Some(args["updates"].clone()),
        ),
        "list_test_runs" => (Method::Get, format!("{}/test-runs", base(args)?), None),
        "get_test_run" => (Method::Get, format!("{}/test-runs/{}", base(args)?, arg(args, "run_id")?), None),
        "report_test_result" => (
            Method::Patch,
            format!(
                "{}/test-runs/{}/cases/{}/status",
                base(args)?,
                arg(args, "run_id")?,
                arg(args, "test_case_id")?
            ),
            Some(json!({"status": arg(args, "status")?})),
        ),
        _ => return Err(format!("Unknown tool: {name}")),
    })
}

fn one_of(task: &serde_json::Map<String, Value>, key: &str, allowed: &[&str]) -> std::result::Result<(), String> {
    match task.get(key).and_then(Value::as_str) {
        Some(v) if allowed.contains(&v) => Ok(()),
        _ => Err(format!("{key} must be one of: {}", allowed.join(", "))),
    }
}

/// The assignee profile of the key owner and the workspace's latest sprint.
struct Assignment {
    owner_assignee: String,
    sprint: String,
    can_assign_others: bool,
}

async fn assignment(env: &Env, user: &User, workspace: &str) -> Result<std::result::Result<Assignment, String>> {
    let Some(w) = workspaces::access(env, user, workspace).await? else {
        return Ok(Err("Access denied to this workspace".into()));
    };
    if w.owner_id == user.id {
        crate::documents::ensure_owner_assignee(env, &w.id, user).await?;
    }
    let db = env.d1("DB")?;
    let assignee: Option<Value> = db::first(
        &db,
        "SELECT id FROM documents WHERE workspace_id=? AND kind='assignees' AND json_extract(payload,'$.user_id')=? LIMIT 1",
        &[w.id.clone().into(), user.id.clone().into()],
    )
    .await?;
    let sprint: Option<Value> = db::first(
        &db,
        "SELECT id FROM documents WHERE workspace_id=? AND kind='sprints' ORDER BY json_extract(payload,'$.start_date') DESC, created_at DESC LIMIT 1",
        &[w.id.clone().into()],
    )
    .await?;
    let (Some(assignee), Some(sprint)) = (
        assignee.and_then(|v| v["id"].as_str().map(str::to_owned)),
        sprint.and_then(|v| v["id"].as_str().map(str::to_owned)),
    ) else {
        return Ok(Err(
            "This workspace needs a sprint and an assignee profile for the key owner before tasks can be filed".into(),
        ));
    };
    Ok(Ok(Assignment {
        owner_assignee: assignee,
        sprint,
        can_assign_others: w.managed_by(user),
    }))
}

/// Turns assignee names or ids into assignee ids; the error lists the valid names so the agent can correct itself.
async fn resolve_assignees(env: &Env, workspace: &str, wanted: &Value) -> std::result::Result<Vec<String>, String> {
    let wanted: Vec<&str> = wanted
        .as_array()
        .map(|list| list.iter().filter_map(Value::as_str).map(str::trim).filter(|s| !s.is_empty()).collect())
        .ok_or("assignees must be an array of assignee names or ids")?;
    let known = crate::records::values(env, workspace, "assignees")
        .await
        .map_err(|_| "Could not load the workspace assignees".to_string())?;
    let mut ids = Vec::new();
    for want in wanted {
        let found = known.iter().find(|a| {
            a["id"].as_str() == Some(want)
                || a["name"].as_str().is_some_and(|n| n.trim().to_lowercase() == want.to_lowercase())
        });
        match found.and_then(|a| a["id"].as_str()) {
            Some(id) => {
                if !ids.iter().any(|existing| existing == id) {
                    ids.push(id.to_owned());
                }
            }
            None => {
                let names: Vec<&str> = known.iter().filter_map(|a| a["name"].as_str()).collect();
                return Err(format!("Unknown assignee \"{want}\". Valid assignees: {}", names.join(", ")));
            }
        }
    }
    if ids.is_empty() {
        return Err("assignees must name at least one assignee".into());
    }
    Ok(ids)
}

/// `project` must name an existing project of the workspace; the error lists the valid names for the agent.
async fn check_project(env: &Env, workspace: &str, project: Option<&str>) -> std::result::Result<(), String> {
    let names: Vec<String> = crate::records::values(env, workspace, "projects")
        .await
        .map_err(|_| "Could not load the workspace projects".to_string())?
        .iter()
        .filter_map(|p| p["name"].as_str().map(str::to_owned))
        .collect();
    match project {
        Some(p) if names.iter().any(|n| n == p) => Ok(()),
        _ => Err(format!("project is required and must be one of: {}", names.join(", "))),
    }
}

/// Applies the task rules on top of what the agent sent; the agent cannot override assignee or sprint.
async fn prepare(env: &Env, user: &User, name: &str, args: &Value) -> std::result::Result<Value, String> {
    let mut args = args.clone();
    match name {
        "create_task" => {
            let mut task = args["task"].as_object().cloned().ok_or("task must be an object")?;
            if task.get("title").and_then(Value::as_str).is_none_or(|t| t.trim().is_empty()) {
                return Err("title is required".into());
            }
            one_of(&task, "task_type", &TASK_TYPES)?;
            one_of(&task, "category", &CATEGORIES)?;
            let workspace = arg(&args, "workspace_id")?.to_owned();
            let slot = assignment(env, user, &workspace)
                .await
                .map_err(|_| "Could not resolve the assignee and sprint".to_string())??;
            check_project(env, &workspace, task.get("project").and_then(Value::as_str)).await?;
            let assignee_ids = match task.remove("assignees") {
                Some(wanted) if slot.can_assign_others => resolve_assignees(env, &workspace, &wanted).await?,
                Some(_) => return Err("Only the workspace owner or an admin can assign tasks to other people".into()),
                None => vec![slot.owner_assignee],
            };
            task.remove("assignee_id");
            task.insert("assignee_ids".into(), json!(assignee_ids));
            task.insert("sprint_id".into(), json!(slot.sprint));
            args["task"] = Value::Object(task);
        }
        "update_task" => {
            let mut updates = args["updates"].as_object().cloned().ok_or("updates must be an object")?;
            for locked in ["assignee_ids", "assignee_id", "sprint_id"] {
                updates.remove(locked);
            }
            if let Some(wanted) = updates.remove("assignees") {
                let workspace = arg(&args, "workspace_id")?.to_owned();
                let slot = assignment(env, user, &workspace)
                    .await
                    .map_err(|_| "Could not resolve the assignee and sprint".to_string())??;
                if !slot.can_assign_others {
                    return Err("Only the workspace owner or an admin can assign tasks to other people".into());
                }
                updates.insert("assignee_ids".into(), json!(resolve_assignees(env, &workspace, &wanted).await?));
            }
            if updates.contains_key("project") {
                let workspace = arg(&args, "workspace_id")?.to_owned();
                check_project(env, &workspace, updates.get("project").and_then(Value::as_str)).await?;
            }
            if updates.contains_key("task_type") {
                one_of(&updates, "task_type", &TASK_TYPES)?;
            }
            if updates.contains_key("category") {
                one_of(&updates, "category", &CATEGORIES)?;
            }
            args["updates"] = Value::Object(updates);
        }
        _ => {}
    }
    Ok(args)
}

async fn call_tool(req: &Request, env: &Env, user: &User, name: &str, args: &Value) -> Value {
    let args = &match prepare(env, user, name, args).await {
        Ok(args) => args,
        Err(message) => return json!({"isError":true,"content":[{"type":"text","text":message}]}),
    };
    let (method, path, body) = match plan(name, args) {
        Ok(p) => p,
        Err(message) => return json!({"isError":true,"content":[{"type":"text","text":message}]}),
    };
    // Replay the call through the normal router with the caller's own credentials, so every
    // permission check applies exactly as it does for the web app.
    let result: Result<(u16, String)> = async {
        let headers = Headers::new();
        let multipart = body.as_ref().and_then(Value::as_str).and_then(|form| {
            form.lines()
                .next()
                .and_then(|line| line.strip_prefix("--"))
                .map(|boundary| format!("multipart/form-data; boundary={boundary}"))
        });
        headers.set("Content-Type", multipart.as_deref().unwrap_or("application/json"))?;
        if let Some(v) = req.headers().get("Authorization")? {
            headers.set("Authorization", &v)?;
        }
        let mut init = RequestInit::new();
        init.with_method(method).with_headers(headers);
        if let Some(body) = body {
            let text = match (&multipart, body.as_str()) {
                (Some(_), Some(form)) => form.to_owned(),
                _ => body.to_string(),
            };
            init.with_body(Some(text.into()));
        }
        let mut inner = Request::new_with_init(&format!("https://internal{path}"), &init)?;
        let mut response = Box::pin(crate::route(&mut inner, env)).await?;
        Ok((response.status_code(), response.text().await?))
    }
    .await;
    match result {
        Ok((status, text)) => {
            json!({"isError":!(200..300).contains(&status),"content":[{"type":"text","text":text}]})
        }
        Err(_) => json!({"isError":true,"content":[{"type":"text","text":"Request failed"}]}),
    }
}

fn rpc_error(id: &Value, code: i64, message: &str) -> Value {
    json!({"jsonrpc":"2.0","id":id,"error":{"code":code,"message":message}})
}

async fn dispatch(req: &Request, env: &Env, user: &User, message: &Value) -> Option<Value> {
    let id = message.get("id").cloned()?;
    let params = &message["params"];
    let result = match message["method"].as_str().unwrap_or_default() {
        "initialize" => json!({
            "protocolVersion": PROTOCOL,
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "khun-phaen-tracker", "version": "1.0.0"},
            "instructions": INSTRUCTIONS,
        }),
        "ping" => json!({}),
        "tools/list" => json!({"tools": tools()}),
        "tools/call" => call_tool(req, env, user, http::text(params, "name"), &params["arguments"]).await,
        _ => return Some(rpc_error(&id, -32601, "Method not found")),
    };
    Some(json!({"jsonrpc":"2.0","id":id,"result":result}))
}

/// Streamable-HTTP MCP endpoint (JSON responses only). Authenticated with a personal API key.
pub async fn handle(req: &mut Request, env: &Env) -> Result<Response> {
    if req.method() != Method::Post {
        return http::error(405, "Use POST with a JSON-RPC body");
    }
    let Some(user) = auth::authenticate(req, env).await? else {
        return http::error(401, "Missing or invalid API key");
    };
    if let Some(token) = auth::token(req).filter(|t| crate::api_keys::is_key(t)) {
        if let Some(wait) = crate::api_keys::throttle(env, &token).await? {
            let response = http::error(429, "API key rate limit exceeded; slow down")?;
            response.headers().set("Retry-After", &wait.to_string())?;
            return Ok(response);
        }
    }
    let body = http::body(req).await?;
    if let Some(batch) = body.as_array() {
        if batch.len() > MAX_BATCH {
            return http::error(400, "Too many requests in one batch");
        }
        let mut out = Vec::new();
        for message in batch {
            if let Some(reply) = dispatch(req, env, &user, message).await {
                out.push(reply);
            }
        }
        return if out.is_empty() {
            Ok(Response::empty()?.with_status(202))
        } else {
            http::ok(json!(out))
        };
    }
    match dispatch(req, env, &user, &body).await {
        Some(reply) => http::ok(reply),
        None => Ok(Response::empty()?.with_status(202)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn task_type_and_category_are_restricted() {
        let task = json!({"task_type":"bug","category":"งานหลัก"});
        let task = task.as_object().unwrap();
        assert!(one_of(task, "task_type", &TASK_TYPES).is_ok());
        assert!(one_of(task, "category", &CATEGORIES).is_ok());
        let bad = json!({"task_type":"meeting","category":"ประชุม"});
        let bad = bad.as_object().unwrap();
        assert!(one_of(bad, "task_type", &TASK_TYPES).is_err());
        assert!(one_of(bad, "category", &CATEGORIES).is_err());
        assert!(one_of(&serde_json::Map::new(), "category", &CATEGORIES).is_err());
    }

    #[test]
    fn locked_fields_are_not_exposed_to_agents() {
        for tool in tools() {
            let props = tool["inputSchema"]["properties"].as_object().unwrap();
            assert!(!props.contains_key("assignee_ids") && !props.contains_key("sprint_id"));
        }
    }
}
