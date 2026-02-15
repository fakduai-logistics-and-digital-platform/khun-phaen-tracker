export interface Project {
  id?: number;
  name: string;
  repo_url?: string;
  created_at?: string;
}

export interface Assignee {
  id?: number;
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

export interface Task {
  id?: number;
  title: string;
  project?: string; // ชื่อโปรเจค
  duration_minutes: number;
  date: string; // YYYY-MM-DD
  status: "todo" | "in-progress" | "done";
  category: string;
  notes: string;
  assignee_id?: number | null;
  assignee?: Assignee | null;
  sprint_id?: number | null;
  is_archived?: boolean;
  created_at?: string;
  updated_at?: string;
  end_date?: string; // YYYY-MM-DD
  dependencies?: number[];
}

export type ViewMode = "list" | "calendar" | "kanban" | "table" | "gantt";

export interface FilterOptions {
  startDate?: string;
  endDate?: string;
  status?: Task["status"] | "all" | "archived" | "active";
  category?: string | "all";
  project?: string | "all";
  assignee_id?: number | "all" | null;
  sprint_id?: number | "all" | null;
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
