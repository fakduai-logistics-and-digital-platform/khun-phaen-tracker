use crate::{db, http, s3_client};
use serde_json::Value;
use worker::*;
async fn cleanup(env: &Env) -> Result<()> {
    let db = env.d1("DB")?;
    let now = db::now();
    let jobs:Vec<Value>=db::all(&db,"SELECT file_key,attempts FROM storage_delete_jobs WHERE next_attempt<=? ORDER BY next_attempt LIMIT 5",&[now.into()]).await?;
    for job in jobs {
        let key = http::text(&job, "file_key");
        if s3_client::request(env, Method::Delete, key, None, "")
            .await
            .is_ok_and(|r| (200..300).contains(&r.status_code()))
        {
            db::run(
                &db,
                "DELETE FROM storage_delete_jobs WHERE file_key=?",
                &[key.into()],
            )
            .await?;
        } else {
            let attempts = job["attempts"].as_i64().unwrap_or(0) + 1;
            db::run(
                &db,
                "UPDATE storage_delete_jobs SET attempts=?,next_attempt=? WHERE file_key=?",
                &[
                    attempts.into(),
                    (now + (60i64.saturating_mul(1i64 << attempts.min(6))).min(3600)).into(),
                    key.into(),
                ],
            )
            .await?;
        }
    }
    Ok(())
}
#[durable_object]
pub struct Scheduler {
    env: Env,
}
impl DurableObject for Scheduler {
    fn new(_state: State, env: Env) -> Self {
        Self { env }
    }
    async fn fetch(&self, _req: Request) -> Result<Response> {
        crate::schedules::enqueue_due(&self.env).await?;
        crate::schedules::deliver_due(&self.env).await?;
        cleanup(&self.env).await?;
        // Bounded operational metadata; never scan or delete the MongoDB database.
        let db = self.env.d1("DB")?;
        db::run(
            &db,
            "DELETE FROM auth_attempts WHERE expires_at<?",
            &[(db::now() - 86400).into()],
        )
        .await?;
        db::run(
            &db,
            "DELETE FROM sessions WHERE expires_at<=?",
            &[db::now().into()],
        )
        .await?;
        http::ok(serde_json::json!({"success":true}))
    }
}
