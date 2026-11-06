use serde::de::DeserializeOwned;
use wasm_bindgen::JsValue;
use worker::*;

pub fn statement(db: &D1Database, sql: &str, args: &[JsValue]) -> Result<D1PreparedStatement> {
    // wasm-bindgen maps Option::None to undefined; SQL nullable columns require null.
    let args = args
        .iter()
        .map(|v| -> Result<JsValue> {
            if v.is_undefined() {
                return Ok(JsValue::NULL);
            }
            if v.is_bigint() {
                let encoded = js_sys::BigInt::from(v.clone())
                    .to_string(10)
                    .map_err(|_| Error::RustError("Invalid SQL integer".into()))?
                    .as_string()
                    .unwrap_or_default();
                let number = encoded
                    .parse::<f64>()
                    .map_err(|_| Error::RustError("Invalid SQL integer".into()))?;
                if number.abs() > 9_007_199_254_740_991.0 {
                    return Err(Error::RustError(
                        "SQL integer exceeds JavaScript safe range".into(),
                    ));
                }
                return Ok(JsValue::from_f64(number));
            }
            Ok(v.clone())
        })
        .collect::<Result<Vec<_>>>()?;
    db.prepare(sql).bind(&args)
}
pub async fn first<T: DeserializeOwned>(
    db: &D1Database,
    sql: &str,
    args: &[JsValue],
) -> Result<Option<T>> {
    statement(db, sql, args)?.first(None).await
}
pub async fn all<T: DeserializeOwned>(
    db: &D1Database,
    sql: &str,
    args: &[JsValue],
) -> Result<Vec<T>> {
    statement(db, sql, args)?.all().await?.results()
}
pub async fn run(db: &D1Database, sql: &str, args: &[JsValue]) -> Result<()> {
    let result = statement(db, sql, args)?.run().await?;
    if !result.success() {
        return Err(Error::RustError("Database write failed".into()));
    }
    Ok(())
}
pub fn now() -> i64 {
    (Date::now().as_millis() / 1000) as i64
}
pub fn timestamp() -> String {
    js_sys::Date::new_0()
        .to_iso_string()
        .as_string()
        .unwrap_or_default()
}
pub fn id() -> String {
    uuid::Uuid::new_v4().to_string()
}
