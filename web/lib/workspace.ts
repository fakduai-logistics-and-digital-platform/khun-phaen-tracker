export { MY_TASKS_WORKSPACE_ID, setWorkspaceId, clearWorkspaceId } from "@/lib/stores/workspace";

export interface Workspace {
  id: string;
  name: string;
  short_name?: string;
  room_code: string;
  created_at: string;
  owner_id: string;
  color?: string;
  icon?: string;
}
