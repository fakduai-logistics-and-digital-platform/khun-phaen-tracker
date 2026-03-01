use mongodb::{bson::{doc, oid::ObjectId}, Collection, Database};
use crate::models::workspace::Workspace;
use futures::stream::StreamExt;

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

    pub async fn find_by_owner_id(&self, owner_id: &ObjectId) -> mongodb::error::Result<Vec<Workspace>> {
        let mut cursor = self.collection.find(doc! { "owner_id": owner_id }, None).await?;
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

    pub async fn update(&self, id: &ObjectId, owner_id: &ObjectId, new_name: &str) -> mongodb::error::Result<bool> {
        let update_res = self.collection.update_one(
            doc! { "_id": id, "owner_id": owner_id },
            doc! { "$set": { "name": new_name } },
            None
        ).await?;
        Ok(update_res.matched_count > 0)
    }

    pub async fn delete(&self, id: &ObjectId, owner_id: &ObjectId) -> mongodb::error::Result<bool> {
        let delete_res = self.collection.delete_one(
            doc! { "_id": id, "owner_id": owner_id },
            None
        ).await?;
        Ok(delete_res.deleted_count > 0)
    }

    pub async fn update_notification_config(&self, id: &ObjectId, owner_id: &ObjectId, config: crate::models::workspace::NotificationConfig) -> mongodb::error::Result<bool> {
        let config_bson = mongodb::bson::to_bson(&config)?;
        let update_res = self.collection.update_one(
            doc! { "_id": id, "owner_id": owner_id },
            doc! { "$set": { "notification_config": config_bson } },
            None
        ).await?;
        Ok(update_res.matched_count > 0)
    }

    pub async fn find_all_notifications(&self) -> mongodb::error::Result<Vec<Workspace>> {
        let mut cursor = self.collection.find(doc! { "notification_config.enabled": true }, None).await?;
        let mut workspaces = Vec::new();
        while let Some(result) = cursor.next().await {
            match result {
                Ok(doc) => workspaces.push(doc),
                Err(e) => return Err(e),
            }
        }
        Ok(workspaces)
    }

    pub async fn update_last_sent(&self, id: &ObjectId, last_sent_at: chrono::DateTime<chrono::Utc>) -> mongodb::error::Result<bool> {
        let update_res = self.collection.update_one(
            doc! { "_id": id },
            doc! { "$set": { "notification_config.last_sent_at": last_sent_at } },
            None
        ).await?;
        Ok(update_res.matched_count > 0)
    }

    pub async fn find_by_room_code(&self, room_code: &str) -> mongodb::error::Result<Option<Workspace>> {
        self.collection.find_one(doc! { "room_code": room_code }, None).await
    }
}
