use crate::models::workspace::{CreateWorkspaceRequest, UpdateWorkspaceRequest, Workspace};
use crate::repositories::workspace_repo::WorkspaceRepository;
use crate::repositories::room_repo::RoomRepository;
use dashmap::DashMap;
use crate::models::room::Room;
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
        workspace_repo: &WorkspaceRepository,
        room_repo: &RoomRepository,
        rooms: &DashMap<String, Room>,
        owner_id: &ObjectId,
        workspace_id: &ObjectId,
    ) -> Result<bool, String> {
        // 1. Look up workspace to get the room_code
        let workspace = workspace_repo.find_by_id(workspace_id)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

        let room_code = match &workspace {
            Some(ws) if ws.owner_id == *owner_id => ws.room_code.clone(),
            Some(_) => return Ok(false), // Not the owner
            None => return Ok(false),    // Not found
        };

        // 2. Delete workspace document
        let deleted = workspace_repo.delete(workspace_id, owner_id)
            .await
            .map_err(|e| format!("Database error: {}", e))?;

        if deleted {
            // 3. Clean up room data from MongoDB (synced documents)
            let _ = room_repo.delete_by_room_code(&room_code).await;

            // 4. Remove in-memory room from DashMap
            rooms.remove(&room_code);
        }

        Ok(deleted)
    }
}
