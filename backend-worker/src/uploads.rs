//! Stream multipart fields one at a time: a 100 MiB multi-file request never becomes a single Wasm allocation.
use crate::{auth::User, db, http, s3_client};
use futures_util::StreamExt;
use serde_json::{json, Value};
use std::collections::HashMap;
use worker::*;
#[derive(Default)]
pub struct Upload {
    pub files: Vec<Value>,
    pub fields: HashMap<String, String>,
}
pub async fn read(
    req: &mut Request,
    env: &Env,
    user: &User,
    prefix: &str,
    names: &[&str],
    images_only: bool,
) -> Result<Upload> {
    let content_type = req.headers().get("Content-Type")?.unwrap_or_default();
    let boundary = multer::parse_boundary(content_type)
        .map_err(|_| Error::RustError("Invalid multipart form".into()))?;
    // Workers runs on one thread. Its Send wrappers adapt the JS stream to multer's Send bound.
    let stream = futures_util::stream::unfold(
        worker::send::SendWrapper::new(req.stream()?),
        |mut stream| {
            worker::send::SendFuture::new(async move {
                stream.next().await.map(|chunk| {
                    (
                        chunk
                            .map(bytes::Bytes::from)
                            .map_err(|_| std::io::Error::other("Upload stream failed")),
                        stream,
                    )
                })
            })
        },
    );
    let constraints = multer::Constraints::new().size_limit(
        multer::SizeLimit::new()
            .whole_stream(105 * 1024 * 1024)
            .per_field(10 * 1024 * 1024),
    );
    let mut multipart = multer::Multipart::with_constraints(stream, boundary, constraints);
    let mut out = Upload::default();
    let result:Result<()>=async{
  loop{
   let field=match multipart.next_field().await{Ok(Some(field))=>field,Ok(None)=>break,Err(_)=>return Err(Error::RustError("Invalid or oversized multipart form".into()))};
   let name=field.name().unwrap_or_default().to_owned();
   if field.file_name().is_none(){if name=="content"{let bytes=field.bytes().await.map_err(|_|Error::RustError("Invalid multipart form".into()))?;if bytes.len()>262144{return Err(Error::RustError("Request too large".into()))}out.fields.insert(name,String::from_utf8(bytes.to_vec()).map_err(|_|Error::RustError("Invalid multipart form".into()))?);}continue}
   if !names.contains(&name.as_str()){continue}
   if out.files.len()>=10{return Err(Error::RustError("Too many files (maximum 10)".into()))}
   let filename=field.file_name().unwrap_or("file").to_owned();let mime=field.content_type().map(ToString::to_string).unwrap_or_else(||"application/octet-stream".into());
   if images_only&&!mime.starts_with("image/"){return Err(Error::RustError("Only image files are allowed".into()))}
   let bytes=field.bytes().await.map_err(|_|Error::RustError("Request too large".into()))?;if bytes.is_empty(){continue}
   let id=db::id();let key=format!("{prefix}/{id}");
   out.files.push(json!({"id":id,"filename":filename,"file_key":key,"mime_type":mime,"size":bytes.len(),"uploader_id":user.id,"uploaded_at":db::timestamp()}));
   let response=s3_client::request(env,Method::Put,&key,Some(bytes.to_vec()),&mime).await?;
   if !(200..300).contains(&response.status_code()){return Err(Error::RustError("RustFS request failed".into()))}
  }Ok(())
 }.await;
    if let Err(error) = result {
        cleanup(env, &out.files).await;
        return Err(error);
    }
    Ok(out)
}
pub fn registration(
    db: &D1Database,
    workspace: &str,
    document: &str,
    files: &[Value],
) -> Result<Vec<D1PreparedStatement>> {
    files.iter().map(|file|crate::db::statement(db,"INSERT INTO stored_objects(file_key,workspace_id,document_id,metadata,created_at) VALUES(?,?,?,?,?)",&[http::text(file,"file_key").into(),workspace.into(),document.into(),file.to_string().into(),db::timestamp().into()])).collect()
}
pub async fn cleanup(env: &Env, files: &[Value]) {
    let Ok(db) = env.d1("DB") else { return };
    for file in files {
        let key = http::text(file, "file_key");
        if db::run(
            &db,
            "INSERT OR IGNORE INTO storage_delete_jobs(file_key) VALUES(?)",
            &[key.into()],
        )
        .await
        .is_err()
        {
            console_error!("Could not record pending file cleanup");
        }
        if s3_client::request(env, Method::Delete, key, None, "")
            .await
            .is_ok_and(|r| (200..300).contains(&r.status_code()))
        {
            let _ = db::run(
                &db,
                "DELETE FROM storage_delete_jobs WHERE file_key=?",
                &[key.into()],
            )
            .await;
        }
    }
}
