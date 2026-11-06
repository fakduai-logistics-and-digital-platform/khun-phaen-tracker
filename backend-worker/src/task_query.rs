use crate::{auth::User, db, documents::Document, http, records};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use wasm_bindgen::JsValue;
use worker::*;
/// Tasks assigned to the caller (bound twice). Both subqueries run once, so only tasks in the caller's
/// workspaces are scanned and each assignee id is matched against a small in-memory list.
pub const MY_TASKS: &str = "d.kind='tasks' AND d.workspace_id IN(SELECT workspace_id FROM documents WHERE kind='assignees' AND json_extract(payload,'$.user_id')=?) AND EXISTS(SELECT 1 FROM json_each(json_extract(d.payload,'$.assignee_ids')) ids WHERE (d.workspace_id,ids.value) IN(SELECT workspace_id,id FROM documents WHERE kind='assignees' AND json_extract(payload,'$.user_id')=?))";
#[derive(Default)]
pub struct Filter {
    pub sql: String,
    pub args: Vec<String>,
}
impl Filter {
    fn add(&mut self, sql: &str, value: Option<String>) {
        self.sql.push_str(" AND ");
        self.sql.push_str(sql);
        if let Some(v) = value {
            self.args.push(v);
        }
    }
}
pub fn build(q: &HashMap<String, String>, today: &str) -> Filter {
    let mut f = Filter::default();
    let status = q.get("status").map(String::as_str);
    match status {
        Some("archived") => f.add("json_extract(d.payload,'$.is_archived')=1", None),
        Some("active") => f.add(
            "COALESCE(json_extract(d.payload,'$.is_archived'),0)=0",
            None,
        ),
        Some("today") => {
            f.add(
                "COALESCE(json_extract(d.payload,'$.is_archived'),0)=0",
                None,
            );
            f.add("(json_extract(d.payload,'$.status')<>'done' OR json_extract(d.payload,'$.updated_at')>=?)",Some(format!("{today}T00:00:00")));
        }
        Some("all") => {}
        Some(s) => f.add("json_extract(d.payload,'$.status')=?", Some(s.into())),
        None => {
            if q.get("include_archived").map(String::as_str) != Some("true") {
                f.add(
                    "COALESCE(json_extract(d.payload,'$.is_archived'),0)=0",
                    None,
                )
            }
        }
    }
    for key in ["category", "priority", "project"] {
        if let Some(v) = q.get(key).filter(|v| v.as_str() != "all") {
            f.add(
                &format!("json_extract(d.payload,'$.{key}')=?"),
                Some(v.clone()),
            );
        }
    }
    if let Some(v) = q.get("sprint_id").filter(|v| v.as_str() != "all") {
        if v == "none" || v == "unassigned" {
            f.add(
                "COALESCE(json_extract(d.payload,'$.sprint_id'),'')=''",
                None,
            )
        } else {
            f.add("json_extract(d.payload,'$.sprint_id')=?", Some(v.clone()))
        }
    }
    if let Some(v) = q.get("assignee_id").filter(|v| v.as_str() != "all") {
        if v == "none" || v == "unassigned" {
            f.add(
                "COALESCE(json_array_length(json_extract(d.payload,'$.assignee_ids')),0)=0",
                None,
            )
        } else {
            f.add("EXISTS(SELECT 1 FROM json_each(json_extract(d.payload,'$.assignee_ids')) WHERE value=?)",Some(v.clone()))
        }
    }
    if let Some(v) = q.get("search").filter(|v| !v.is_empty()) {
        f.add(
            "instr(lower(json_extract(d.payload,'$.title')),lower(?))>0",
            Some(v.clone()),
        );
    }
    for (param, field, cmp) in [
        ("start_date", "date", ">="),
        ("end_date", "date", "<="),
        ("due_start_date", "due_date", ">="),
        ("due_end_date", "due_date", "<="),
    ] {
        if let Some(v) = q.get(param).filter(|v| !v.is_empty()) {
            f.add(
                &format!("json_extract(d.payload,'$.{field}'){cmp}?"),
                Some(v.clone()),
            );
        }
    }
    match q.get("due_preset").map(String::as_str) {
        Some("no_dates") => f.add("COALESCE(json_extract(d.payload,'$.due_date'),'')=''", None),
        Some("overdue") => {
            f.add("COALESCE(json_extract(d.payload,'$.due_date'),'')<>'' AND json_extract(d.payload,'$.due_date')<?",Some(today.into()));
            f.add("json_extract(d.payload,'$.status')<>'done' AND COALESCE(json_extract(d.payload,'$.is_archived'),0)=0",None);
        }
        Some(p @ ("next_day" | "next_week" | "next_month")) => {
            let days = match p {
                "next_day" => 1,
                "next_week" => 7,
                _ => 30,
            };
            if let Ok(start) = chrono::NaiveDate::parse_from_str(today, "%Y-%m-%d") {
                let end = start + chrono::Duration::days(days);
                f.add(
                    "json_extract(d.payload,'$.due_date')>=?",
                    Some(today.into()),
                );
                f.add(
                    "json_extract(d.payload,'$.due_date')<=?",
                    Some(end.to_string()),
                );
            }
        }
        _ => {}
    }
    f
}
pub async fn list(
    req: &Request,
    env: &Env,
    workspace: Option<&str>,
    user: &User,
) -> Result<Response> {
    let q = records::query(req)?;
    let (page, limit) = records::page(&q, 20, 1000);
    let today = db::timestamp()[..10].to_owned();
    let filter = build(&q, &today);
    let (mut sql, mut args): (String, Vec<JsValue>) = if let Some(ws) = workspace {
        (
            "d.kind='tasks' AND d.workspace_id=?".into(),
            vec![ws.into()],
        )
    } else {
        (MY_TASKS.into(),vec![user.id.clone().into(),user.id.clone().into()])
    };
    sql.push_str(&filter.sql);
    args.extend(filter.args.into_iter().map(JsValue::from));
    let db = env.d1("DB")?;
    #[derive(Deserialize)]
    struct Count {
        total: i64,
    }
    let count: Option<Count> = db::first(
        &db,
        &format!("SELECT COUNT(*) AS total FROM documents d WHERE {sql}"),
        &args,
    )
    .await?;
    let total = count.map(|v| v.total).unwrap_or(0);
    if req.path().ends_with("/stats") {
        let stats:Option<Value>=db::first(&db,&format!("SELECT COUNT(*) total,SUM(json_extract(d.payload,'$.status')='pending') pending,SUM(json_extract(d.payload,'$.status')='todo') todo,SUM(json_extract(d.payload,'$.status')='in-progress') in_progress,SUM(json_extract(d.payload,'$.status')='in-test') in_test,SUM(json_extract(d.payload,'$.status')='done') done,COALESCE(SUM(json_extract(d.payload,'$.duration_minutes')),0) total_minutes FROM documents d WHERE {sql}"),&args).await?;
        let mut stats = stats.unwrap_or(json!({}));
        for k in ["pending", "todo", "in_progress", "in_test", "done"] {
            if stats[k].is_null() {
                stats[k] = json!(0)
            }
        }
        return http::ok(json!({"success":true,"stats":stats}));
    }
    let sort = q
        .get("sort_by")
        .map(String::as_str)
        .filter(|s| {
            [
                "date",
                "title",
                "created_at",
                "updated_at",
                "start_date",
                "due_date",
                "task_number",
                "priority",
                "status",
            ]
            .contains(s)
        })
        .unwrap_or("updated_at");
    let direction = if matches!(q.get("sort_order").map(String::as_str), Some("asc" | "1")) {
        "ASC"
    } else {
        "DESC"
    };
    args.extend([limit.into(), ((page - 1) * limit).into()]);
    // Page ids first so the assignee lookups run only for the returned rows, not every match.
    let order = format!("json_extract(d.payload,'$.{sort}') {direction},d.id DESC");
    let rows:Vec<Document>=db::all(&db,&format!("SELECT json_set(d.payload,'$.workspace_name',w.name,'$.workspace_short_name',w.short_name,'$.workspace_color',w.color,'$.workspace_icon',w.icon,'$.assignees',json(COALESCE((SELECT json_group_array(json(a.payload)) FROM json_each(json_extract(d.payload,'$.assignee_ids')) ids CROSS JOIN documents a ON a.id=ids.value WHERE a.kind='assignees' AND a.workspace_id=d.workspace_id),'[]'))) payload FROM (SELECT d.id FROM documents d WHERE {sql} ORDER BY {order} LIMIT ? OFFSET ?) p CROSS JOIN documents d ON d.id=p.id JOIN workspaces w ON w.id=d.workspace_id ORDER BY {order}"),&args).await?;
    let values = rows
        .into_iter()
        .map(|r| serde_json::from_str::<Value>(&r.payload))
        .collect::<std::result::Result<Vec<_>, _>>()?;
    http::ok(
        json!({"success":true,"tasks":values,"total":total,"page":page,"limit":limit,"pages":(total+limit-1)/limit}),
    )
}
