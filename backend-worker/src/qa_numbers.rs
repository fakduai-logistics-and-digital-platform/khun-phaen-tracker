use crate::{db, qa_query, records};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashSet;
use wasm_bindgen::JsValue;
use worker::*;

/// Test case numbers are unique per project; cases without a project share one sequence.
fn scope(workspace: &str, project: &str) -> (String, Vec<JsValue>) {
    let mut filter = "d.workspace_id=? AND d.kind='test-cases'".to_owned();
    let mut args: Vec<JsValue> = vec![workspace.into()];
    qa_query::project_clause(
        &mut filter,
        &mut args,
        if project.is_empty() { "none" } else { project },
    );
    (filter, args)
}
/// Number from the request, if it is a positive integer.
pub fn requested(value: &Value) -> Option<i64> {
    value["test_no"]
        .as_i64()
        .or_else(|| value["test_no"].as_str()?.trim().parse().ok())
        .filter(|n| *n > 0)
}
/// Numbers already used by the project's cases, optionally ignoring some case ids.
pub async fn used(
    env: &Env,
    workspace: &str,
    project: &str,
    ignore: &[&str],
) -> Result<HashSet<i64>> {
    #[derive(Deserialize)]
    struct Num {
        id: String,
        num: Option<i64>,
    }
    let (filter, args) = scope(workspace, project);
    let rows: Vec<Num> = db::all(
        &env.d1("DB")?,
        &format!(
            "SELECT d.id id,json_extract(d.payload,'$.test_no') num FROM documents d WHERE {filter}"
        ),
        &args,
    )
    .await?;
    Ok(rows
        .into_iter()
        .filter(|r| !ignore.contains(&r.id.as_str()))
        .filter_map(|r| r.num)
        .collect())
}
pub async fn next(env: &Env, workspace: &str, project: &str) -> Result<i64> {
    Ok(used(env, workspace, project, &[])
        .await?
        .into_iter()
        .max()
        .unwrap_or(0)
        + 1)
}
/// `Some(error)` when `number` is invalid or already taken by another case of the project.
pub async fn check(
    env: &Env,
    workspace: &str,
    project: &str,
    number: i64,
    own_id: Option<&str>,
) -> Result<Option<&'static str>> {
    let ignore: Vec<&str> = own_id.into_iter().collect();
    if used(env, workspace, project, &ignore)
        .await?
        .contains(&number)
    {
        return Ok(Some("Test case number already exists in this project"));
    }
    Ok(None)
}
/// Renumbers a project's cases 1..n in their current order; returns how many numbers changed.
pub async fn renumber(env: &Env, workspace: &str, project: &str) -> Result<usize> {
    #[derive(Deserialize)]
    struct Item {
        id: String,
        num: Option<i64>,
    }
    let db = env.d1("DB")?;
    let (filter, args) = scope(workspace, project);
    let rows: Vec<Item> = db::all(
        &db,
        &format!("SELECT d.id id,json_extract(d.payload,'$.test_no') num FROM documents d WHERE {filter} ORDER BY num,d.id"),
        &args,
    )
    .await?;
    let now = db::timestamp();
    let mut writes = Vec::new();
    // Ascending order never moves a case onto a number a later case still holds, so the unique index stays satisfied.
    for (index, row) in rows.iter().enumerate() {
        let number = index as i64 + 1;
        if row.num != Some(number) {
            writes.push(records::patch_statement(
                &db,
                workspace,
                "test-cases",
                &row.id,
                &json!({"test_no":number,"updated_at":now}),
            )?);
        }
    }
    let changed = writes.len();
    if changed > 0 {
        db.batch(writes).await?;
    }
    Ok(changed)
}
