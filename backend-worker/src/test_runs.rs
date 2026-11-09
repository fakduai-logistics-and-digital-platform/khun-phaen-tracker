use crate::{auth::User, db, documents, http, qa_history, realtime, records, workspaces};
use serde_json::{json, Value};
use worker::*;
pub fn stats(cases: &Value) -> Value {
    let mut out =
        json!({"total":0,"pending":0,"passed":0,"failed":0,"blocked":0,"skipped":0,"invalid":0});
    for case in cases.as_array().into_iter().flatten() {
        let status = http::text(case, "status");
        let key = if ["passed", "failed", "blocked", "skipped", "invalid"].contains(&status) {
            status
        } else {
            "pending"
        };
        out[key] = json!(out[key].as_i64().unwrap_or(0) + 1);
        out["total"] = json!(out["total"].as_i64().unwrap_or(0) + 1);
    }
    out
}
pub async fn detail(env: &Env, ws: &str, mut run: Value) -> Result<Value> {
    let ids = run["test_cases"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|c| c["test_case_id"].as_str())
        .collect::<Vec<_>>();
    let rows:Vec<documents::Document>=db::all(&env.d1("DB")?,"SELECT payload FROM documents WHERE workspace_id=? AND kind='test-cases' AND id IN(SELECT value FROM json_each(?))",&[ws.into(),json!(ids).to_string().into()]).await?;
    let cases = rows
        .into_iter()
        .map(|r| serde_json::from_str::<Value>(&r.payload))
        .collect::<std::result::Result<Vec<_>, _>>()?;
    run["stats"] = stats(&run["test_cases"]);
    for entry in run["test_cases"].as_array_mut().into_iter().flatten() {
        entry["test_case"] = cases
            .iter()
            .find(|c| c["id"] == entry["test_case_id"])
            .cloned()
            .unwrap_or(Value::Null);
    }
    Ok(run)
}
pub async fn latest(env: &Env, ws: &str) -> Result<Value> {
    let row:Option<documents::Document>=db::first(&env.d1("DB")?,"SELECT payload FROM documents WHERE workspace_id=? AND kind='test-runs' ORDER BY created_at DESC,id DESC LIMIT 1",&[ws.into()]).await?;
    match row {
        Some(row) => detail(env, ws, serde_json::from_str(&row.payload)?).await,
        None => Ok(Value::Null),
    }
}
pub async fn handle(req: &mut Request, env: &Env, user: &User, parts: &[&str]) -> Result<Response> {
    let ws = parts[2];
    if workspaces::access(env, user, ws).await?.is_none() {
        return http::error(403, "Access denied");
    }
    let db = env.d1("DB")?;
    let id = parts.get(4).copied();
    if id.is_none() && req.method() == Method::Get {
        let q = records::query(req)?;
        let (page, limit) = records::page(&q, 10, 100);
        let total: Option<Value> = db::first(
            &db,
            "SELECT COUNT(*) total FROM documents WHERE workspace_id=? AND kind='test-runs'",
            &[ws.into()],
        )
        .await?;
        let rows:Vec<documents::Document>=db::all(&db,"SELECT payload FROM documents WHERE workspace_id=? AND kind='test-runs' ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?",&[ws.into(),limit.into(),((page-1)*limit).into()]).await?;
        let mut runs = Vec::new();
        for row in rows {
            let mut v: Value = serde_json::from_str(&row.payload)?;
            v["stats"] = stats(&v["test_cases"]);
            runs.push(v);
        }
        return http::ok(
            json!({"data":runs,"total":total.map(|v|v["total"].clone()).unwrap_or(json!(0)),"page":page,"limit":limit}),
        );
    }
    if id.is_none() && req.method() == Method::Post {
        let input = http::body(req).await?;
        if http::text(&input, "name").trim().is_empty() {
            return http::error(400, "Run name required");
        }
        let Some(ids) = input["test_case_ids"].as_array() else {
            return http::error(400, "test_case_ids must be an array");
        };
        if ids.len() > 1000 {
            return http::error(400, "Too many test cases in one run");
        }
        let unique = ids
            .iter()
            .filter_map(Value::as_str)
            .collect::<std::collections::HashSet<_>>();
        if unique.len() != ids.len() {
            return http::error(400, "Test case IDs must be unique strings");
        }
        let count:Option<Value>=db::first(&db,"SELECT COUNT(*) total FROM documents WHERE workspace_id=? AND kind='test-cases' AND id IN(SELECT value FROM json_each(?))",&[ws.into(),json!(ids).to_string().into()]).await?;
        if count.and_then(|v| v["total"].as_u64()) != Some(ids.len() as u64) {
            return http::error(400, "Test case does not belong to this workspace");
        }
        let assignee = http::text(&input, "default_assignee");
        if !assignee.is_empty()
            && assignee != "unassigned"
            && documents::get(env, ws, "assignees", assignee)
                .await?
                .is_none()
        {
            return http::error(400, "Assignee does not belong to this workspace");
        }
        let mut value = json!({"name":input["name"],"description":input["description"],"default_assignee":if assignee.is_empty(){"unassigned"}else{assignee},"operating_system":input.get("operating_system").cloned().unwrap_or(json!("")),"status":"running","test_cases":ids.iter().map(|id|json!({"test_case_id":id,"status":"pending"})).collect::<Vec<_>>(),"created_by":user.id});
        let id = db::id();
        records::identity(&mut value, ws, &id);
        db.batch(vec![records::insert_statement(
            &db,
            "test-runs",
            &value,
            None,
        )?])
        .await?;
        realtime::publish(env, ws, "test_run", "create", &id, value.clone()).await;
        return Ok(http::ok(value)?.with_status(201));
    }
    let id = id.unwrap_or_default();
    let Some(run) = documents::get(env, ws, "test-runs", id).await? else {
        return http::error(404, "Test run not found");
    };
    if req.method() == Method::Get && parts.len() == 5 {
        return http::ok(detail(env, ws, run).await?);
    }
    if req.method() == Method::Delete && parts.len() == 5 {
        db::run(
            &db,
            "DELETE FROM documents WHERE id=? AND workspace_id=? AND kind='test-runs'",
            &[id.into(), ws.into()],
        )
        .await?;
        realtime::publish(env, ws, "test_run", "delete", id, Value::Null).await;
        return Ok(Response::empty()?.with_status(204));
    }
    if req.method() != Method::Patch {
        return http::error(405, "Method not allowed");
    }
    let input = http::body(req).await?;
    let status = http::text(&input, "status");
    let mut writes = Vec::new();
    if parts.len() == 6 && parts[5] == "status" {
        if !["running", "completed", "aborted"].contains(&status) {
            return http::error(400, "Invalid run status");
        }
        writes.push(records::patch_statement(
            &db,
            ws,
            "test-runs",
            id,
            &json!({"status":status,"updated_at":db::timestamp()}),
        )?);
    } else if parts.len() == 8 && parts[5] == "cases" && parts[7] == "status" {
        if ![
            "pending", "passed", "failed", "blocked", "skipped", "invalid",
        ]
        .contains(&status)
        {
            return http::error(400, "Invalid run case status");
        }
        let tc = parts[6];
        if !run["test_cases"]
            .as_array()
            .is_some_and(|a| a.iter().any(|c| http::text(c, "test_case_id") == tc))
        {
            return http::error(404, "Case not in this test run");
        }
        let Some(case) = documents::get(env, ws, "test-cases", tc).await? else {
            return http::error(404, "Test case not found");
        };
        // Resolve the array position inside SQL so simultaneous case updates do not replace each other.
        writes.push(db::statement(&db,"UPDATE documents SET payload=json_set(payload,'$.test_cases['||(SELECT key FROM json_each(json_extract(payload,'$.test_cases')) WHERE json_extract(value,'$.test_case_id')=? LIMIT 1)||'].status',?,'$.updated_at',?),updated_at=? WHERE id=? AND workspace_id=? AND kind='test-runs'",&[tc.into(),status.into(),db::timestamp().into(),db::timestamp().into(),id.into(),ws.into()])?);
        if ["passed", "failed"].contains(&status) {
            if http::text(&case, "status") != status {
                writes.push(qa_history::entry_statement(
                    &db,
                    ws,
                    tc,
                    user,
                    "run",
                    vec![json!({"field":"status","from":http::text(&case,"status"),"to":status})],
                )?);
            }
            writes.push(records::patch_statement(
                &db,
                ws,
                "test-cases",
                tc,
                &{
                    let now = db::timestamp();
                    json!({"status":status,"updated_at":now,"status_changed_at":now,"passed_at":if status=="passed"{json!(now)}else{Value::Null}})
                },
            )?);
        }
    } else {
        return http::error(404, "Not found");
    }
    db.batch(writes).await?;
    realtime::publish(env, ws, "test_run", "update", id, json!({"id":id})).await;
    if parts.len() == 8 {
        realtime::publish(env, ws, "test_case", "refresh", parts[6], Value::Null).await;
    }
    http::ok(json!({"success":true}))
}
pub async fn summary(env: &Env, ws: &str) -> Result<Response> {
    if db::first::<Value>(
        &env.d1("DB")?,
        "SELECT id FROM workspaces WHERE id=?",
        &[ws.into()],
    )
    .await?
    .is_none()
    {
        return http::error(404, "Workspace not found");
    }
    let db = env.d1("DB")?;
    let counts:Option<Value>=db::first(&db,"SELECT SUM(kind='tasks' AND COALESCE(json_extract(payload,'$.is_archived'),0)=0 AND json_extract(payload,'$.status')<>'done') active_tasks,SUM(kind='test-cases') test_cases,SUM(kind='assignees') teammates FROM documents WHERE workspace_id=?",&[ws.into()]).await?;
    let mut out = counts.unwrap_or(json!({}));
    for field in ["active_tasks", "test_cases", "teammates"] {
        if out[field].is_null() {
            out[field] = json!(0)
        }
    }
    let samples:Vec<Value>=db::all(&db,"SELECT id,json_extract(payload,'$.test_no') test_no,json_extract(payload,'$.name') name,json_extract(payload,'$.priority') priority,json_extract(payload,'$.status') status,json_extract(payload,'$.fixed') fixed FROM documents WHERE workspace_id=? AND kind='test-cases' ORDER BY test_no,id LIMIT 3",&[ws.into()]).await?;
    out["sample_cases"] = json!(samples);
    let latest = latest(env, ws).await?;
    out["latest_run"] = if latest.is_null() {
        Value::Null
    } else {
        records::pick(
            &latest,
            &["id", "name", "status", "stats", "created_at", "updated_at"],
        )
    };
    http::ok(out)
}
