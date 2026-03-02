use crate::models::workspace::Workspace;
use futures::stream::StreamExt;
use mongodb::{
    bson::{doc, oid::ObjectId, Bson, Document},
    Collection, Database,
};

#[derive(Clone)]
pub struct WorkspaceRepository {
    collection: Collection<Workspace>,
}

impl WorkspaceRepository {
    pub fn new(db: &Database) -> Self {
        Self {
            collection: db.collection("workspaces"),
        }
    }

    pub async fn find_by_owner_id(
        &self,
        owner_id: &ObjectId,
    ) -> mongodb::error::Result<Vec<Workspace>> {
        let mut cursor = self
            .collection
            .find(doc! { "owner_id": owner_id }, None)
            .await?;
        let mut workspaces = Vec::new();
        while let Some(result) = cursor.next().await {
            match result {
                Ok(doc) => workspaces.push(doc),
                Err(e) => return Err(e),
            }
        }
        Ok(workspaces)
    }

    pub async fn find_by_id(&self, id: &ObjectId) -> mongodb::error::Result<Option<Workspace>> {
        self.collection.find_one(doc! { "_id": id }, None).await
    }

    pub async fn create(&self, mut workspace: Workspace) -> mongodb::error::Result<Workspace> {
        let insert_res = self.collection.insert_one(workspace.clone(), None).await?;
        if let Some(id) = insert_res.inserted_id.as_object_id() {
            workspace.id = Some(id);
        }
        Ok(workspace)
    }

    pub async fn update(
        &self,
        id: &ObjectId,
        owner_id: &ObjectId,
        new_name: &str,
        new_color: Option<&str>,
        new_icon: Option<&str>,
    ) -> mongodb::error::Result<bool> {
        let update_res = self
            .collection
            .update_one(
                doc! { "_id": id, "owner_id": owner_id },
                doc! { "$set": {
                    "name": new_name,
                    "color": new_color,
                    "icon": new_icon
                } },
                None,
            )
            .await?;
        Ok(update_res.matched_count > 0)
    }

    pub async fn delete(&self, id: &ObjectId, owner_id: &ObjectId) -> mongodb::error::Result<bool> {
        let delete_res = self
            .collection
            .delete_one(doc! { "_id": id, "owner_id": owner_id }, None)
            .await?;
        Ok(delete_res.deleted_count > 0)
    }

    pub async fn update_notification_config(
        &self,
        id: &ObjectId,
        owner_id: &ObjectId,
        config: crate::models::workspace::NotificationConfig,
    ) -> mongodb::error::Result<bool> {
        let config_bson = mongodb::bson::to_bson(&config)?;
        let update_res = self
            .collection
            .update_one(
                doc! { "_id": id, "owner_id": owner_id },
                doc! { "$set": { "notification_config": config_bson } },
                None,
            )
            .await?;
        Ok(update_res.matched_count > 0)
    }

    pub async fn find_all_notifications(&self) -> mongodb::error::Result<Vec<Workspace>> {
        let raw = self.collection.clone_with_type::<Document>();
        let mut cursor = raw
            .find(doc! { "notification_config.enabled": true }, None)
            .await?;
        let mut workspaces = Vec::new();
        while let Some(result) = cursor.next().await {
            match result {
                Ok(doc) => {
                    if let Some(ws) = Self::workspace_from_document(&doc) {
                        workspaces.push(ws);
                    }
                }
                Err(e) => return Err(e),
            }
        }
        Ok(workspaces)
    }

    pub async fn update_last_sent(
        &self,
        id: &ObjectId,
        last_sent_at: chrono::DateTime<chrono::Utc>,
    ) -> mongodb::error::Result<bool> {
        let update_res = self
            .collection
            .update_one(
                doc! { "_id": id },
                doc! { "$set": { "notification_config.last_sent_at": last_sent_at } },
                None,
            )
            .await?;
        Ok(update_res.matched_count > 0)
    }

    pub async fn find_by_room_code(
        &self,
        room_code: &str,
    ) -> mongodb::error::Result<Option<Workspace>> {
        self.collection
            .find_one(doc! { "room_code": room_code }, None)
            .await
    }

    fn workspace_from_document(doc: &Document) -> Option<Workspace> {
        let id = doc.get_object_id("_id").ok();
        let owner_id = doc.get_object_id("owner_id").ok()?;
        let name = doc.get_str("name").ok()?.to_string();
        let room_code = doc.get_str("room_code").ok()?.to_string();
        let color = doc.get_str("color").ok().map(|s| s.to_string());
        let icon = doc.get_str("icon").ok().map(|s| s.to_string());
        let created_at = doc
            .get("created_at")
            .and_then(Self::parse_utc_datetime)
            .unwrap_or_else(chrono::Utc::now);

        let notification_config = doc
            .get_document("notification_config")
            .ok()
            .map(|cfg| crate::models::workspace::NotificationConfig {
                discord_webhook_url: cfg
                    .get_str("discord_webhook_url")
                    .ok()
                    .map(|s| s.to_string()),
                enabled: cfg.get_bool("enabled").unwrap_or(false),
                days: cfg
                    .get_array("days")
                    .ok()
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| match v {
                                Bson::Int32(i) => u8::try_from(*i).ok(),
                                Bson::Int64(i) => u8::try_from(*i).ok(),
                                _ => None,
                            })
                            .collect::<Vec<u8>>()
                    })
                    .unwrap_or_default(),
                time: cfg.get_str("time").unwrap_or("00:00").to_string(),
                last_sent_at: cfg.get("last_sent_at").and_then(Self::parse_utc_datetime),
            });

        Some(Workspace {
            id,
            name,
            color,
            icon,
            owner_id,
            room_code,
            notification_config,
            created_at,
        })
    }

    fn parse_utc_datetime(value: &Bson) -> Option<chrono::DateTime<chrono::Utc>> {
        match value {
            Bson::DateTime(dt) => Some(dt.to_chrono()),
            Bson::String(s) => chrono::DateTime::parse_from_rfc3339(s)
                .ok()
                .map(|dt| dt.with_timezone(&chrono::Utc)),
            Bson::Document(d) => {
                if let Some(Bson::DateTime(dt)) = d.get("$date") {
                    return Some(dt.to_chrono());
                }
                if let Some(Bson::String(s)) = d.get("$date") {
                    return chrono::DateTime::parse_from_rfc3339(s)
                        .ok()
                        .map(|dt| dt.with_timezone(&chrono::Utc));
                }
                if let Some(Bson::Document(d2)) = d.get("$date") {
                    if let Some(Bson::String(ms)) = d2.get("$numberLong") {
                        if let Ok(ms) = ms.parse::<i64>() {
                            return mongodb::bson::DateTime::from_millis(ms)
                                .try_to_rfc3339_string()
                                .ok()
                                .and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok())
                                .map(|dt| dt.with_timezone(&chrono::Utc));
                        }
                    }
                }
                None
            }
            _ => None,
        }
    }
}
