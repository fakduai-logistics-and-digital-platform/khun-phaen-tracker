use crate::models::workspace::{CreateWorkspaceRequest, UpdateWorkspaceRequest, Workspace};
use crate::repositories::workspace_repo::WorkspaceRepository;
use mongodb::bson::oid::ObjectId;
use uuid::Uuid;

pub struct WorkspaceService;

impl WorkspaceService {
    pub async fn get_user_workspaces(
        repo: &WorkspaceRepository,
        owner_id: &ObjectId,
    ) -> Result<Vec<Workspace>, String> {
        repo.find_by_owner_id(owner_id)
            .await
            .map_err(|e| format!("Database error: {}", e))
    }

    pub async fn create_workspace(
        repo: &WorkspaceRepository,
        owner_id: &ObjectId,
        payload: CreateWorkspaceRequest,
    ) -> Result<Workspace, String> {
        let room_code = Uuid::new_v4().to_string();

        let workspace = Workspace {
            id: None,
            name: payload.name.clone(),
            owner_id: owner_id.clone(),
            room_code: room_code.clone(),
            created_at: chrono::Utc::now(),
        };

        let created_workspace = repo.create(workspace)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

        Ok(created_workspace)
    }

    pub async fn update_workspace(
        repo: &WorkspaceRepository,
        owner_id: &ObjectId,
        workspace_id: &ObjectId,
        payload: UpdateWorkspaceRequest,
    ) -> Result<bool, String> {
        repo.update(workspace_id, owner_id, &payload.name)
            .await
            .map_err(|e| format!("Database error: {}", e))
    }

    pub async fn delete_workspace(
        repo: &WorkspaceRepository,
        owner_id: &ObjectId,
        workspace_id: &ObjectId,
    ) -> Result<bool, String> {
        repo.delete(workspace_id, owner_id)
            .await
            .map_err(|e| format!("Database error: {}", e))
    }
}
