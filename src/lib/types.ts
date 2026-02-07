export interface Project {
	id?: number;
	name: string;
	created_at?: string;
}

export interface Assignee {
	id?: number;
	name: string;
	color?: string; // สำหรับสีประจำตัว เช่น #FF5733
	created_at?: string;
}

export interface Task {
	id?: number;
	title: string;
	project?: string; // ชื่อโปรเจค
	duration_minutes: number;
	date: string; // YYYY-MM-DD
	status: 'todo' | 'in-progress' | 'done';
	category: string;
	notes: string;
	assignee_id?: number | null;
	assignee?: Assignee | null;
	created_at?: string;
}

export type ViewMode = 'list' | 'calendar' | 'kanban';

export interface FilterOptions {
	startDate?: string;
	endDate?: string;
	status?: Task['status'] | 'all';
	category?: string | 'all';
	project?: string | 'all';
	assignee_id?: number | 'all';
	search?: string;
}

export const CATEGORIES = ['งานหลัก', 'งานรอง', 'ประชุม', 'เรียนรู้', 'อื่นๆ'] as const;
