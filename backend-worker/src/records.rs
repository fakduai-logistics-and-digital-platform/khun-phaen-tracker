//! D1 record operations shared by the HTTP domain handlers. SQL values are always bound.
use crate::{auth::User, db, http};
use serde::Deserialize;
use serde_json::{json, Value};
use wasm_bindgen::JsValue;
use worker::*;
#[derive(Deserialize)]
pub struct Row {
    pub id: String,
    pub workspace_id: String,
    pub parent_id: Option<String>,
    pub payload: String,
}
impl Row {
    pub fn value(&self) -> Result<Value> {
        Ok(serde_json::from_str(&self.payload)?)
    }
}
pub async fn locate(env: &Env, kind: &str, id: &str) -> Result<Option<Row>> {
    db::first(
        &env.d1("DB")?,
        "SELECT * FROM documents WHERE id=? AND kind=?",
        &[id.into(), kind.into()],
    )
    .await
}
pub fn pick(input: &Value, fields: &[&str]) -> Value {
    let mut out = json!({});
    for field in fields {
        if let Some(v) = input.get(*field) {
            out[*field] = v.clone();
        }
    }
    out
}
pub fn merge(value: &mut Value, patch: &Value) {
    for (k, v) in patch.as_object().into_iter().flatten() {
        value[k] = v.clone();
    }
}
pub fn patch_statement(
    db: &D1Database,
    workspace: &str,
    kind: &str,
    id: &str,
    patch: &Value,
) -> Result<D1PreparedStatement> {
    let fields = patch
        .as_object()
        .ok_or_else(|| Error::RustError("Patch must be an object".into()))?;
    let keys = fields.keys().collect::<Vec<_>>();
    let expr = keys.chunks(12).fold("payload".to_owned(), |base, keys| {
        format!(
            "json_set({base},{})",
            keys.iter()
                .map(|_| "?,json(?)")
                .collect::<Vec<_>>()
                .join(",")
        )
    });
    let mut args: Vec<JsValue> = Vec::new();
    for key in keys {
        args.extend([format!("$.{key}").into(), fields[key].to_string().into()]);
    }
    args.extend([
        db::timestamp().into(),
        id.into(),
        workspace.into(),
        kind.into(),
    ]);
    db::statement(db,&format!("UPDATE documents SET payload={expr},updated_at=? WHERE id=? AND workspace_id=? AND kind=?"),&args)
}
pub fn insert_statement(
    db: &D1Database,
    kind: &str,
    value: &Value,
    parent: Option<&str>,
) -> Result<D1PreparedStatement> {
    db::statement(db,"INSERT INTO documents(id,workspace_id,kind,parent_id,payload,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",&[http::text(value,"id").into(),http::text(value,"workspace_id").into(),kind.into(),parent.map(str::to_owned).into(),value.to_string().into(),http::text(value,"created_at").into(),http::text(value,"updated_at").into()])
}
pub fn identity(value: &mut Value, workspace: &str, id: &str) {
    value["id"] = json!(id);
    value["_id"] = json!(id);
    value["workspace_id"] = json!(workspace);
    value["created_at"] = json!(db::timestamp());
    value["updated_at"] = value["created_at"].clone();
}
pub fn qa(user: &User) -> bool {
    user.role == "admin"
        || serde_json::from_str::<Value>(&user.profile)
            .ok()
            .is_some_and(|p| http::text(&p, "position") == "QA Tester")
}
pub fn display_name(user: &User) -> String {
    let p = serde_json::from_str::<Value>(&user.profile).unwrap_or(json!({}));
    let name = http::text(&p, "nickname").trim();
    if !name.is_empty() {
        return name.into();
    }
    let name = format!(
        "{} {}",
        http::text(&p, "first_name"),
        http::text(&p, "last_name")
    );
    if !name.trim().is_empty() {
        name.trim().into()
    } else {
        user.email.split('@').next().unwrap_or("User").into()
    }
}
pub fn query(req: &Request) -> Result<std::collections::HashMap<String, String>> {
    Ok(req
        .url()?
        .query_pairs()
        .map(|(k, v)| (k.into_owned(), v.into_owned()))
        .collect())
}
pub fn page(q: &std::collections::HashMap<String, String>, default: i64, max: i64) -> (i64, i64) {
    (
        q.get("page")
            .and_then(|v| v.parse().ok())
            .unwrap_or(1)
            .clamp(1, 1_000_000),
        q.get("limit")
            .and_then(|v| v.parse().ok())
            .unwrap_or(default)
            .clamp(1, max),
    )
}
pub async fn values(env: &Env, workspace: &str, kind: &str) -> Result<Vec<Value>> {
    let rows: Vec<crate::documents::Document> = db::all(
        &env.d1("DB")?,
        "SELECT payload FROM documents WHERE workspace_id=? AND kind=? ORDER BY created_at,id",
        &[workspace.into(), kind.into()],
    )
    .await?;
    rows.into_iter()
        .map(|r| serde_json::from_str(&r.payload).map_err(Into::into))
        .collect()
}
