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
}
