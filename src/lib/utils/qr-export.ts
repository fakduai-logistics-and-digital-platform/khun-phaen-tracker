import { LZString } from '$lib/stores/storage';
import type { Task, Project, Assignee } from '$lib/types';

const QR_MAX_BYTES = 2900; // Safe limit for QR alphanumeric mode
const QR_PREFIX = 'QR:';

interface CompactTask {
	i: number;       // id
	t: string;       // title
	p: string;       // project
	d: string;       // date
	s: string;       // status
	c: string;       // category
	n: string;       // notes
	a: number | null; // assignee_id
	sp: number | null; // sprint_id
	dm: number;      // duration_minutes
}

interface CompactData {
	v: 1;            // version
	tasks: CompactTask[];
	projects: Array<{ i: number; n: string }>;
	assignees: Array<{ i: number; n: string; c: string }>;
}

export function getRelatedData(
	selectedTasks: Task[],
	allProjects: Project[],
	allAssignees: Assignee[]
) {
	const projectNames = new Set(selectedTasks.map(t => t.project).filter(Boolean));
	const assigneeIds = new Set(selectedTasks.map(t => t.assignee_id).filter((id): id is number => id != null));

	const projects = allProjects.filter(p => projectNames.has(p.name));
	const assignees = allAssignees.filter(a => a.id != null && assigneeIds.has(a.id));

	return { projects, assignees };
}

export function prepareQRData(
	tasks: Task[],
	projects: Project[],
	assignees: Assignee[]
): string {
	const compact: CompactData = {
		v: 1,
		tasks: tasks.map(t => ({
			i: t.id!,
			t: t.title,
			p: t.project || '',
			d: t.date,
			s: t.status,
			c: t.category,
			n: t.notes || '',
			a: t.assignee_id ?? null,
			sp: t.sprint_id ?? null,
			dm: t.duration_minutes
		})),
		projects: projects.map(p => ({
			i: p.id!,
			n: p.name
		})),
		assignees: assignees.map(a => ({
			i: a.id!,
			n: a.name,
			c: a.color || ''
		}))
	};

	const json = JSON.stringify(compact);
	const compressed = LZString.compress(json);
	return QR_PREFIX + compressed;
}

export function estimateQRSize(data: string): { bytes: number; fitsQR: boolean; percentage: number } {
	const bytes = new Blob([data]).size;
	return {
		bytes,
		fitsQR: bytes <= QR_MAX_BYTES,
		percentage: Math.round((bytes / QR_MAX_BYTES) * 100)
	};
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	return `${(bytes / 1024).toFixed(1)} KB`;
}

export { QR_MAX_BYTES };
