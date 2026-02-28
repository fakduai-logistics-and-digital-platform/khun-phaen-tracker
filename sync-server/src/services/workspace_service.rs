use crate::models::workspace::{CreateWorkspaceRequest, Workspace};
use crate::repositories::workspace_repo::WorkspaceRepository;
use mongodb::bson::oid::ObjectId;
use crate::services::room_service::generate_room_code;

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
        let room_code = generate_room_code();

        let workspace = Workspace {
            id: None,
            name: payload.name.clone(),
            owner_id: owner_id.clone(),
            room_code: room_code.clone(),
            created_at: chrono::Utc::now(),
        };

        repo.create(workspace.clone())
            .await
            .map_err(|e| format!("Database error: {}", e))?;

        Ok(workspace)
    }
}
