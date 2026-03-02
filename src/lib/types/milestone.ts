export interface Milestone {
  id: string; // UUID from backend
  workspace_id: string; // ObjectId from backend
  title: string;
  description: string | null;
  target_date: string; // ISO 8601
  is_hidden: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateMilestoneRequest {
  title: string;
  description: string | null;
  target_date: string;
  is_hidden?: boolean;
}

export interface UpdateMilestoneRequest {
  title?: string;
  description?: string | null;
  target_date?: string;
  is_hidden?: boolean;
}
