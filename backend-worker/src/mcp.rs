use crate::{auth, http};
use serde_json::{json, Value};
use worker::*;

const MAX_BATCH: usize = 20;
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
        tool("get_task", "Get one task", json!({"workspace_id":ws,"task_id":{"type":"string"}}), &["workspace_id", "task_id"]),
        tool(
            "create_task",
            "Create a task. `task` holds fields such as title, notes, status, priority, project, due_date, assignee_ids",
            json!({"workspace_id":ws,"task":{"type":"object"}}),
            &["workspace_id", "task"],
        ),
        tool(
            "update_task",
            "Update fields of a task. `updates` holds only the fields to change: title, notes (progress notes), status, priority, due_date (YYYY-MM-DD), project, assignee_ids, checklist (full array of {id,text,completed})",
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

async fn call_tool(req: &Request, env: &Env, name: &str, args: &Value) -> Value {
    let (method, path, body) = match plan(name, args) {
        Ok(p) => p,
        Err(message) => return json!({"isError":true,"content":[{"type":"text","text":message}]}),
    };
    // Replay the call through the normal router with the caller's own credentials, so every
    // permission check applies exactly as it does for the web app.
    let result: Result<(u16, String)> = async {
        let headers = Headers::new();
        headers.set("Content-Type", "application/json")?;
        if let Some(v) = req.headers().get("Authorization")? {
            headers.set("Authorization", &v)?;
        }
        let mut init = RequestInit::new();
        init.with_method(method).with_headers(headers);
        if let Some(body) = body {
            init.with_body(Some(body.to_string().into()));
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

async fn dispatch(req: &Request, env: &Env, message: &Value) -> Option<Value> {
    let id = message.get("id").cloned()?;
    let params = &message["params"];
    let result = match message["method"].as_str().unwrap_or_default() {
        "initialize" => json!({
            "protocolVersion": PROTOCOL,
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "khun-phaen-tracker", "version": "1.0.0"},
        }),
        "ping" => json!({}),
        "tools/list" => json!({"tools": tools()}),
        "tools/call" => call_tool(req, env, http::text(params, "name"), &params["arguments"]).await,
        _ => return Some(rpc_error(&id, -32601, "Method not found")),
    };
    Some(json!({"jsonrpc":"2.0","id":id,"result":result}))
}

/// Streamable-HTTP MCP endpoint (JSON responses only). Authenticated with a personal API key.
pub async fn handle(req: &mut Request, env: &Env) -> Result<Response> {
    if req.method() != Method::Post {
        return http::error(405, "Use POST with a JSON-RPC body");
    }
    if auth::authenticate(req, env).await?.is_none() {
        return http::error(401, "Missing or invalid API key");
    }
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
            if let Some(reply) = dispatch(req, env, message).await {
                out.push(reply);
            }
        }
        return if out.is_empty() {
            Ok(Response::empty()?.with_status(202))
        } else {
            http::ok(json!(out))
        };
    }
    match dispatch(req, env, &body).await {
        Some(reply) => http::ok(reply),
        None => Ok(Response::empty()?.with_status(202)),
    }
}
