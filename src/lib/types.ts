export interface Project {
  id?: string | number;
  name: string;
  repo_url?: string;
  created_at?: string;
}

export interface Assignee {
  id?: string | number;
  name: string;
  color?: string; // สำหรับสีประจำตัว เช่น #FF5733
  discord_id?: string;
  user_id?: string;
  email?: string;
  created_at?: string;
}

export interface AssigneeGroup {
  id?: string | number;
  name: string;
  assignee_ids: (string | number)[];
  created_at?: string;
}

export interface Sprint {
  id?: string | number;
  name: string;
  start_date: string;
  end_date: string;
  status: "active" | "completed" | "planned";
  created_at?: string;
  completed_at?: string; // วันที่จบ Sprint จริง
  archived_count?: number; // จำนวนงานที่ Archive เมื่อจบ Sprint
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Task {
  id?: string | number;
  title: string;
  project?: string; // ชื่อโปรเจกต์
  duration_minutes: number;
  start_date?: string; // YYYY-MM-DD
  date: string; // YYYY-MM-DD
  status: "pending" | "todo" | "in-progress" | "in-test" | "done";
  category: string;
  notes: string;
  assignee_ids?: (string | number)[]; // Array of assignee IDs (multiple assignees)
  assignees?: Assignee[]; // Array of assignee objects
  // Legacy fields for backward compatibility (will be removed later)
  assignee_id?: string | number | null;
  assignee?: Assignee | null;
  sprint_id?: string | number | null;
  is_archived?: boolean;
  created_at?: string;
  updated_at?: string;
  due_date?: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD
  dependencies?: (string | number)[];
  checklist?: ChecklistItem[];
}

export interface CommentImage {
  id: string;
  filename: string;
  file_key: string;
  mime_type: string;
  size: number;
  uploaded_at: string;
  uploader_id: string;
}

export interface CommentReaction {
  emoji: string;
  user_id: string;
  reacted_at: string;
}

export interface TaskComment {
  id?: string;
  workspace_id?: string;
  task_id?: string;
  content: string;
  images: CommentImage[];
  reactions: CommentReaction[];
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export type ViewMode =
  | "list"
  | "calendar"
  | "kanban"
  | "table"
  | "gantt"
  | "workload"
  | "dependency";

export interface FilterOptions {
  startDate?: string;
  endDate?: string;
  dueStartDate?: string;
  dueEndDate?: string;
  startDateFilterMode?: "range" | "period";
  dueDateFilterMode?: "range" | "period";
  startDatePeriod?: "all" | "7d" | "1m" | "3m" | "1y";
  dueDatePeriod?: "all" | "7d" | "1m" | "3m" | "1y";
  dueDatePreset?:
    | "all"
    | "no_dates"
    | "overdue"
    | "next_day"
    | "next_week"
    | "next_month";
  status?: Task["status"] | "all" | "archived" | "active" | "today";
  category?: string | "all";
  project?: string | "all";
  assignee_id?: string | number | "all" | null;
  sprint_id?: string | number | "all" | null;
  includeArchived?: boolean;
  search?: string;
  updatedAtStart?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  tasks: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface PaginatedCommentResponse {
  success: boolean;
  comments: TaskComment[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface PaginatedCommentImageResponse {
  success: boolean;
  images: CommentImage[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const CATEGORIES = [
  "งานหลัก",
  "งานรอง",
  "ประชุม",
  "เรียนรู้",
  "อื่นๆ",
] as const;

export interface CommandPaletteItem {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  category: "command" | "task" | "project" | "assignee" | "sprint" | "search";
  icon?: any;
  run: () => void | Promise<void>;
  project?: string;
  status?: string;
}
export interface ChecklistTemplate {
  id: string; // UUID
  workspace_id: string;
  name: string;
  items: string[];
  created_at?: string;
  updated_at?: string;
}

export interface ChecklistTemplateResponse {
  success: boolean;
  templates: ChecklistTemplate[];
}
