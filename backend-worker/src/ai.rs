use crate::{auth, db, documents, http, records, settings, workspaces};
use serde_json::{json, Value};
use worker::*;
async fn call(url: &str, key: &str, body: Option<Value>) -> Result<Response> {
    let headers = Headers::new();
    headers.set("Authorization", &format!("Bearer {key}"))?;
    headers.set("Content-Type", "application/json")?;
    let mut init = RequestInit::new();
    init.with_method(if body.is_some() {
        Method::Post
    } else {
        Method::Get
    })
    .with_headers(headers)
    .with_redirect(RequestRedirect::Manual);
    if let Some(body) = body {
        init.with_body(Some(body.to_string().into()));
    }
    Fetch::Request(Request::new_with_init(url, &init)?)
        .send()
        .await
        .map_err(|_| Error::RustError("AI provider request failed".into()))
}
async fn json_response(mut response: Response) -> Result<Value> {
    if !(200..300).contains(&response.status_code()) {
        return Err(Error::RustError("AI provider request failed".into()));
    }
    let bytes = http::bytes_from_response(&mut response, 8 * 1024 * 1024).await?;
    serde_json::from_slice(&bytes)
        .map_err(|_| Error::RustError("Invalid AI provider response".into()))
}
fn configured(config: &Value, prefix: &str) -> bool {
    ["url", "model"].iter().all(|suffix| {
        config[format!("{prefix}_{suffix}")]
            .as_str()
            .is_some_and(|v| !v.is_empty())
    })
}
async fn completion(config: &Value, system: &str, prompt: &str) -> Result<String> {
    let url = http::text(config, "llm_url");
    let url = if url.ends_with("/chat/completions") {
        url.into()
    } else {
        format!("{}/chat/completions", url.trim_end_matches('/'))
    };
    let body=json_response(call(&url,http::text(config,"llm_api_key"),Some(json!({"model":config["llm_model"],"messages":[{"role":"system","content":system},{"role":"user","content":prompt}],"temperature":0.7,"max_tokens":800,"stream":false}))).await?).await?;
    body["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| Error::RustError("Invalid AI provider response".into()))
}
pub async fn handle(
    req: &mut Request,
    env: &Env,
    user: &auth::User,
    parts: &[&str],
) -> Result<Response> {
    let config = settings::effective(env, "ai").await?;
    if parts.get(1) == Some(&"admin") {
        if user.role != "admin" {
            return http::error(403, "Admin required");
        }
        if req.method() != Method::Get {
            return http::error(405, "Method not allowed");
        }
        let prefix = if parts.get(3) == Some(&"embeddings-models") {
            "embeddings"
        } else {
            "llm"
        };
        let url = config[format!("{prefix}_url")].as_str().unwrap_or_default();
        if url.is_empty() {
            return http::error(503, "AI provider is not configured");
        }
        let base = url
            .trim_end_matches('/')
            .trim_end_matches("/embeddings")
            .trim_end_matches("/chat/completions");
        let body = json_response(
            call(
                &format!("{base}/models"),
                config[format!("{prefix}_api_key")]
                    .as_str()
                    .unwrap_or_default(),
                None,
            )
            .await?,
        )
        .await?;
        let models = body["data"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|m| m["id"].as_str())
            .collect::<Vec<_>>();
        return http::ok(json!({"success":true,"models":models}));
    }
    let ws = parts[2];
    if workspaces::access(env, user, ws).await?.is_none() {
        return http::error(403, "Access denied");
    }
    if req.method() != Method::Post {
        return http::error(405, "Method not allowed");
    }
    let input = http::body(req).await?;
    match parts.get(4).copied() {
        Some("text-to-speech") => {
            let text = http::text(&input, "text").trim();
            if text.is_empty() || text.len() > 20000 {
                return http::error(400, "Text required (max 20000 bytes)");
            }
            if !configured(&config, "tts") {
                return http::error(503, "TTS provider is not configured");
            }
            let response = call(
                http::text(&config, "tts_url"),
                http::text(&config, "tts_api_key"),
                Some(json!({"model":config["tts_model"],"input":text})),
            )
            .await?;
            if response.status_code() != 200 {
                return http::error(502, "TTS provider request failed");
            }
            let headers = Headers::new();
            headers.set("Content-Type", "audio/mpeg")?;
            Ok(response.with_headers(headers))
        }
        Some("generate-speech") => {
            let content = http::text(&input, "report_content").trim();
            if content.is_empty() {
                return http::error(400, "report_content required");
            }
            if !configured(&config, "llm") {
                return http::error(503, "LLM provider is not configured");
            }
            let script=completion(&config,"Write a concise natural Thai spoken summary of the supplied report, suitable for a 30–60 second presentation. Return only the script.",content).await?;
            http::ok(json!({"success":true,"script":script}))
        }
        Some("tasks") if parts.get(5) == Some(&"generate") => {
            let prompt = http::text(&input, "prompt").trim();
            if prompt.is_empty() {
                return http::error(400, "prompt required");
            }
            if !configured(&config, "llm") {
                return http::error(503, "LLM provider is not configured");
            }
            let projects = records::values(env, ws, "projects").await?;
            let assignees = records::values(env, ws, "assignees").await?;
            let context = json!({"projects":projects.iter().map(|p|&p["name"]).collect::<Vec<_>>(),"assignees":assignees.iter().map(|a|&a["name"]).collect::<Vec<_>>()});
            let system=format!("Generate one task as valid JSON with title (Feature:/Bugfix:/Improvement:/Refactor:/Docs:/Test: prefix), category, priority (urgent/high/medium/low/none), notes (requirements and technical considerations), project, and checklist (3–5 actionable strings). Do not perform actions. Workspace context: {context}");
            let response = completion(&config, &system, prompt).await?;
            let candidate = response
                .find('{')
                .zip(response.rfind('}'))
                .filter(|(a, b)| a <= b)
                .map(|(a, b)| &response[a..=b])
                .unwrap_or(&response);
            let task=serde_json::from_str::<Value>(candidate).ok().filter(Value::is_object).unwrap_or_else(||json!({"title":prompt,"category":"feature","priority":"medium","notes":response,"project":"","checklist":["Design implementation approach","Implement functionality","Write tests","Update documentation"]}));
            http::ok(json!({"success":true,"task":task,"ai_response":response}))
        }
        Some("tasks") if parts.get(5) == Some(&"chat") => search(env, ws, &config, &input).await,
        _ => http::error(404, "Not found"),
    }
}
async fn search(env: &Env, ws: &str, config: &Value, input: &Value) -> Result<Response> {
    let message = http::text(input, "message").trim();
    if message.is_empty() {
        return http::error(400, "message required");
    }
    if !configured(config, "embeddings") {
        return http::error(503, "Embeddings provider is not configured");
    }
    let limit = input["limit"].as_u64().unwrap_or(5).clamp(1, 20) as usize;
    let task_limit = input["task_limit"].as_u64().unwrap_or(100).clamp(1, 500);
    let rows:Vec<documents::Document>=db::all(&env.d1("DB")?,"SELECT payload FROM documents WHERE workspace_id=? AND kind='tasks' AND COALESCE(json_extract(payload,'$.is_archived'),0)=0 ORDER BY updated_at DESC,id DESC LIMIT ?",&[ws.into(),task_limit.into()]).await?;
    let tasks = rows
        .into_iter()
        .map(|r| serde_json::from_str::<Value>(&r.payload))
        .collect::<std::result::Result<Vec<_>, _>>()?;
    let mut texts = vec![message.to_owned()];
    texts.extend(tasks.iter().map(|t| {
        [
            "title", "project", "status", "priority", "category", "notes",
        ]
        .iter()
        .map(|key| format!("{key}: {}", http::text(t, key)))
        .collect::<Vec<_>>()
        .join("\n")
        .chars()
        .take(4000)
        .collect::<String>()
    }));
    // Batched embeddings stay within Free's subrequest limit even for 500 candidate tasks.
    let mut vectors = Vec::new();
    for batch in texts.chunks(64) {
        let body = json_response(
            call(
                http::text(config, "embeddings_url"),
                http::text(config, "embeddings_api_key"),
                Some(json!({"model":config["embeddings_model"],"input":batch})),
            )
            .await?,
        )
        .await?;
        let Some(data) = body["data"].as_array() else {
            return http::error(502, "Invalid embeddings response");
        };
        if data.len() != batch.len() {
            return http::error(502, "Invalid embeddings response");
        }
        let mut data = data.iter().enumerate().collect::<Vec<_>>();
        data.sort_by_key(|(i, v)| v["index"].as_u64().unwrap_or(*i as u64));
        for (_, item) in data {
            let Some(vector) = item["embedding"]
                .as_array()
                .map(|a| a.iter().filter_map(Value::as_f64).collect::<Vec<_>>())
            else {
                return http::error(502, "Invalid embeddings response");
            };
            if vector.is_empty() {
                return http::error(502, "Empty embedding vector");
            }
            vectors.push(vector);
        }
    }
    let Some(query) = vectors.first() else {
        return http::error(502, "Missing query embedding");
    };
    let mut scored = Vec::new();
    for (i, task) in tasks.into_iter().enumerate() {
        let vector = &vectors[i + 1];
        if query.len() != vector.len() {
            return http::error(502, "Embedding dimensions do not match");
        }
        scored.push(json!({"task":task,"score":cosine(query,vector),"text":texts[i+1]}));
    }
    scored.sort_by(|a, b| {
        b["score"]
            .as_f64()
            .unwrap_or(0.0)
            .total_cmp(&a["score"].as_f64().unwrap_or(0.0))
    });
    scored.truncate(limit);
    http::ok(
        json!({"success":true,"answer":if scored.is_empty(){"ไม่เจอ task ที่เกี่ยวข้อง".into()}else{format!("เจอ task ที่เกี่ยวข้อง {} รายการ",scored.len())},"results":scored}),
    )
}
fn cosine(a: &[f64], b: &[f64]) -> f64 {
    let dot = a.iter().zip(b).map(|(a, b)| a * b).sum::<f64>();
    let norm = (a.iter().map(|x| x * x).sum::<f64>() * b.iter().map(|x| x * x).sum::<f64>()).sqrt();
    if norm == 0.0 {
        0.0
    } else {
        dot / norm
    }
}
#[durable_object]
pub struct AiGateway {
    env: Env,
}
impl DurableObject for AiGateway {
    fn new(_state: State, env: Env) -> Self {
        Self { env }
    }
    async fn fetch(&self, mut req: Request) -> Result<Response> {
        let Some(user) = auth::authenticate(&req, &self.env).await? else {
            return http::error(401, "Not logged in");
        };
        let path = req.path();
        let parts = path.trim_matches('/').split('/').collect::<Vec<_>>();
        match handle(&mut req, &self.env, &user, &parts).await {
            Ok(response) => Ok(response),
            Err(error) => http::failure(error),
        }
    }
}
pub async fn forward(req: &mut Request, env: &Env, scope: &str) -> Result<Response> {
    env.durable_object("AI")?
        .id_from_name(scope)?
        .get_stub()?
        .fetch_with_request(std::mem::replace(
            req,
            Request::new("https://internal/consumed", Method::Get)?,
        ))
        .await
}
