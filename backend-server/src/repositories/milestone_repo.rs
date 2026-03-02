use crate::models::milestone::Milestone;
use futures::stream::StreamExt;
use mongodb::{
    bson::{doc, oid::ObjectId},
    Collection, Database,
};

#[derive(Clone)]
pub struct MilestoneRepository {
    collection: Collection<Milestone>,
}

impl MilestoneRepository {
    pub fn new(db: &Database) -> Self {
        Self {
            collection: db.collection("milestones"),
        }
    }

    pub async fn find_by_workspace(&self, workspace_id: &ObjectId) -> mongodb::error::Result<Vec<Milestone>> {
        let mut cursor = self.collection.find(doc! { "workspace_id": workspace_id }, None).await?;
        let mut milestones = Vec::new();
        while let Some(result) = cursor.next().await {
            match result {
                Ok(doc) => milestones.push(doc),
                Err(e) => return Err(e),
            }
        }
        Ok(milestones)
    }

    #[allow(dead_code)]
    pub async fn find_by_id(&self, id: &str) -> mongodb::error::Result<Option<Milestone>> {
        self.collection.find_one(doc! { "_id": id }, None).await
    }

    pub async fn create(&self, milestone: Milestone) -> mongodb::error::Result<Milestone> {
        self.collection.insert_one(milestone.clone(), None).await?;
        Ok(milestone)
    }

    pub async fn update(
        &self,
        id: &str,
        workspace_id: &ObjectId,
        updates: mongodb::bson::Document,
    ) -> mongodb::error::Result<bool> {
        let res = self
            .collection
            .update_one(
                doc! { "_id": id, "workspace_id": workspace_id },
                doc! { "$set": updates },
                None,
            )
            .await?;
        Ok(res.matched_count > 0)
    }

    pub async fn delete(&self, id: &str, workspace_id: &ObjectId) -> mongodb::error::Result<bool> {
        let res = self
            .collection
            .delete_one(doc! { "_id": id, "workspace_id": workspace_id }, None)
            .await?;
        Ok(res.deleted_count > 0)
    }
}
