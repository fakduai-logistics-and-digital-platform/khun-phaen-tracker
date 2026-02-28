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

    pub async fn create(&self, workspace: Workspace) -> mongodb::error::Result<()> {
        self.collection.insert_one(workspace, None).await?;
        Ok(())
    }
}
