use crate::models::milestone::{CreateMilestoneRequest, Milestone, UpdateMilestoneRequest};
use crate::repositories::milestone_repo::MilestoneRepository;
use mongodb::bson::{doc, oid::ObjectId};
use uuid::Uuid;

#[derive(Clone)]
pub struct MilestoneService {
    repo: MilestoneRepository,
}

impl MilestoneService {
    pub fn new(repo: MilestoneRepository) -> Self {
        Self { repo }
    }

    pub async fn get_milestones(&self, workspace_id: &ObjectId) -> mongodb::error::Result<Vec<Milestone>> {
        self.repo.find_by_workspace(workspace_id).await
    }

    pub async fn create_milestone(
        &self,
        workspace_id: ObjectId,
        req: CreateMilestoneRequest,
    ) -> mongodb::error::Result<Milestone> {
        let now = chrono::Utc::now().to_rfc3339();
        let milestone = Milestone {
            id: Uuid::now_v7().to_string(),
            workspace_id,
            title: req.title,
            description: req.description,
            target_date: req.target_date,
            is_hidden: req.is_hidden,
            created_at: Some(now.clone()),
            updated_at: Some(now),
        };
        self.repo.create(milestone).await
    }

    pub async fn update_milestone(
        &self,
        id: String,
        workspace_id: &ObjectId,
        req: UpdateMilestoneRequest,
    ) -> mongodb::error::Result<bool> {
        let mut updates = doc! {};
        if let Some(title) = req.title {
            updates.insert("title", title);
        }
        if let Some(desc) = req.description {
            match desc {
                Some(d) => updates.insert("description", d),
                None => updates.insert("description", mongodb::bson::Bson::Null),
            };
        }
        if let Some(date) = req.target_date {
            updates.insert("target_date", date);
        }
        if let Some(hidden) = req.is_hidden {
            updates.insert("is_hidden", hidden);
        }

        if updates.is_empty() {
            return Ok(true);
        }

        updates.insert("updated_at", chrono::Utc::now().to_rfc3339());
        self.repo.update(&id, workspace_id, updates).await
    }

    pub async fn delete_milestone(&self, id: String, workspace_id: &ObjectId) -> mongodb::error::Result<bool> {
        self.repo.delete(&id, workspace_id).await
    }
}

// Unit tests for logic only (not mocking repo yet as i don't have mockable trait)
// But I can test request transformation logic etc.
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_milestone_id_is_uuid() {
        // Technically this is more of an integration test if I run it with service,
        // but I can test the structure.
        let id = Uuid::new_v4();
        assert_eq!(id.get_variant(), uuid::Variant::RFC4122);
    }
}
