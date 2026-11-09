use crate::{db, documents::Document, http, records};
use serde_json::{json, Value};
use wasm_bindgen::JsValue;
use worker::*;
const NO_PROJECT: &str = "NOT EXISTS(SELECT 1 FROM documents p WHERE p.id=json_extract(d.payload,'$.project_id') AND p.kind='projects' AND p.workspace_id=d.workspace_id)";
/// `project_id` query value, or `None` for "all projects".
pub fn project_param(q: &std::collections::HashMap<String, String>) -> Option<String> {
    q.get("project_id")
        .filter(|v| !v.is_empty() && v.as_str() != "all")
        .cloned()
}
fn project_clause(filter: &mut String, args: &mut Vec<JsValue>, project: &str) {
    if project == "none" || project == "unassigned" {
        filter.push_str(&format!(" AND {NO_PROJECT}"));
    } else {
        filter.push_str(" AND json_extract(d.payload,'$.project_id')=?");
        args.push(project.into());
    }
}
pub async fn list(req: &Request, env: &Env, workspace: &str, all: bool) -> Result<Response> {
    let q = records::query(req)?;
    let (page, limit) = records::page(&q, 10, 1000);
    let mut filter = "d.workspace_id=? AND d.kind='test-cases'".to_owned();
    let mut args: Vec<JsValue> = vec![workspace.into()];
    if let Some(v) = q
        .get("suite_id")
        .filter(|v| !v.is_empty() && v.as_str() != "all")
    {
        if v == "none" || v == "unassigned" {
            filter.push_str(" AND NOT EXISTS(SELECT 1 FROM documents s WHERE s.id=json_extract(d.payload,'$.suite_id') AND s.kind='test-suites' AND s.workspace_id=d.workspace_id)");
        } else {
            filter.push_str(" AND json_extract(d.payload,'$.suite_id')=?");
            args.push(v.clone().into());
        }
    }
    if let Some(project) = project_param(&q) {
        project_clause(&mut filter, &mut args, &project);
    }
    for field in ["priority", "status", "fixed", "assign_dev"] {
        if let Some(v) = q
            .get(field)
            .filter(|v| !v.is_empty() && v.as_str() != "all")
        {
            let parts = v
                .split(',')
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .collect::<Vec<_>>();
            filter.push_str(&format!(" AND COALESCE(json_extract(d.payload,'$.{field}'),'unassigned') IN(SELECT value FROM json_each(?))"));
            args.push(json!(parts).to_string().into());
        }
    }
    if let Some(search) = q.get("q").filter(|v| !v.is_empty()) {
        let field = q.get("field").map(String::as_str).unwrap_or("all");
        let fields: &[&str] = match field {
            "title" | "name" => &["name"],
            "comments" => &["test_note", "dev_note"],
            "description" => &["description"],
            "preconditions" => &["preconditions"],
            "postconditions" => &["postconditions"],
            "steps" | "id" | "test_no" => &[],
            _ => &[
                "name",
                "description",
                "preconditions",
                "postconditions",
                "test_note",
                "dev_note",
            ],
        };
        let mut options = Vec::new();
        for field in fields {
            options.push(format!(
                "instr(lower(COALESCE(json_extract(d.payload,'$.{field}'),'')),lower(?))>0"
            ));
            args.push(search.clone().into());
        }
        if matches!(field, "steps" | "all") {
            options.push("EXISTS(SELECT 1 FROM json_each(json_extract(d.payload,'$.classic_steps')) WHERE instr(lower(COALESCE(json_extract(value,'$.action'),'')||' '||COALESCE(json_extract(value,'$.expected'),'')),lower(?))>0)".into());
            args.push(search.clone().into());
            options.push("EXISTS(SELECT 1 FROM json_each(json_extract(d.payload,'$.gherkin_steps')) WHERE instr(lower(COALESCE(json_extract(value,'$.text'),'')),lower(?))>0)".into());
            args.push(search.clone().into());
        }
        if matches!(field, "id" | "test_no" | "all") && search.parse::<i64>().is_ok() {
            options.push("json_extract(d.payload,'$.test_no')=CAST(? AS INTEGER)".into());
            args.push(search.clone().into());
        }
        filter.push_str(&format!(
            " AND ({})",
            if options.is_empty() {
                "0".into()
            } else {
                options.join(" OR ")
            }
        ));
    }
    let suffix = if all {
        String::new()
    } else {
        args.extend([limit.into(), ((page - 1) * limit).into()]);
        " LIMIT ? OFFSET ?".into()
    };
    let rows:Vec<Document>=db::all(&env.d1("DB")?,&format!("SELECT d.payload FROM documents d WHERE {filter} ORDER BY json_extract(d.payload,'$.test_no'),d.id{suffix}"),&args).await?;
    let values = rows
        .into_iter()
        .map(|r| serde_json::from_str::<Value>(&r.payload))
        .collect::<std::result::Result<Vec<_>, _>>()?;
    http::ok(json!(values))
}
pub async fn counts(env: &Env, workspace: &str, project: Option<&str>) -> Result<Value> {
    let mut filter = "d.workspace_id=? AND d.kind='test-cases'".to_owned();
    let mut args: Vec<JsValue> = vec![workspace.into()];
    if let Some(project) = project {
        project_clause(&mut filter, &mut args, project);
    }
    let rows:Vec<Value>=db::all(&env.d1("DB")?,&format!("SELECT COALESCE(json_extract(d.payload,'$.suite_id'),'') suite,COUNT(*) count FROM documents d WHERE {filter} GROUP BY suite"),&args).await?;
    let mut out = json!({});
    for row in rows {
        out[http::text(&row, "suite")] = row["count"].clone();
    }
    Ok(out)
}
pub async fn suites(env: &Env, workspace: &str, project: Option<&str>) -> Result<Response> {
    let mut suites = records::values(env, workspace, "test-suites").await?;
    if let Some(project) = project {
        let existing: Vec<String> = records::values(env, workspace, "projects")
            .await?
            .iter()
            .map(|p| http::text(p, "id").to_owned())
            .collect();
        suites.retain(|suite| {
            let id = http::text(suite, "project_id");
            if project == "none" || project == "unassigned" {
                id.is_empty() || !existing.iter().any(|p| p == id)
            } else {
                id == project
            }
        });
    }
    let counts = counts(env, workspace, project).await?;
    let mut unassigned = 0;
    for (key, count) in counts.as_object().into_iter().flatten() {
        if let Some(suite) = suites.iter_mut().find(|s| http::text(s, "id") == key) {
            suite["case_count"] = count.clone();
        } else {
            unassigned += count.as_i64().unwrap_or(0);
        }
    }
    for suite in &mut suites {
        if suite["case_count"].is_null() {
            suite["case_count"] = json!(0)
        }
    }
    if unassigned > 0 {
        suites.push(json!({"id":"unassigned","_id":"unassigned","title":"Unassigned","description":null,"case_count":unassigned}))
    }
    http::ok(json!(suites))
}
