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
  created_at?: string;
}

export interface Sprint {
  id?: number;
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
  project?: string; // ชื่อโปรเจค
  duration_minutes: number;
  date: string; // YYYY-MM-DD
  status: "todo" | "in-progress" | "in-test" | "done";
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
  end_date?: string; // YYYY-MM-DD
  dependencies?: (string | number)[];
  checklist?: ChecklistItem[];
}

export type ViewMode =
  | "list"
  | "calendar"
  | "kanban"
  | "table"
  | "gantt"
  | "workload";

export interface FilterOptions {
  startDate?: string;
  endDate?: string;
  status?: Task["status"] | "all" | "archived" | "active" | "today";
  category?: string | "all";
  project?: string | "all";
  assignee_id?: string | number | "all" | null;
  sprint_id?: string | number | "all" | null;
  includeArchived?: boolean;
  search?: string;
  updatedAtStart?: string;
}

export const CATEGORIES = [
  "งานหลัก",
  "งานรอง",
  "ประชุม",
  "เรียนรู้",
  "อื่นๆ",
] as const;
