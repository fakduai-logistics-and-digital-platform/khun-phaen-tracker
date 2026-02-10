import { writable } from 'svelte/store';

export interface Sprint {
	id?: number;
	name: string;
	start_date: string;
	end_date: string;
	status: 'active' | 'completed' | 'planned';
	created_at?: string;
	completed_at?: string; // วันที่จบ Sprint จริง
	archived_count?: number; // จำนวนงานที่ Archive
}

// Local storage key
const STORAGE_KEY = 'sprints-data-v1';

// Load sprints from localStorage
function loadSprints(): Sprint[] {
	if (typeof window === 'undefined') return [];
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			return JSON.parse(saved);
		}
	} catch (e) {
		console.error('Failed to load sprints:', e);
	}
	return [];
}

// Save sprints to localStorage
function saveSprints(sprints: Sprint[]) {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(sprints));
	} catch (e) {
		console.error('Failed to save sprints:', e);
	}
}

function createSprintStore() {
	const { subscribe, set, update } = writable<Sprint[]>(loadSprints());

	return {
		subscribe,
		add: (sprint: Omit<Sprint, 'id' | 'created_at'>) => {
			update(sprints => {
				const newSprint: Sprint = {
					...sprint,
					id: Date.now(),
					created_at: new Date().toISOString()
				};
				const newSprints = [...sprints, newSprint];
				saveSprints(newSprints);
				return newSprints;
			});
		},
		update: (id: number, updates: Partial<Sprint>) => {
			update(sprints => {
				const newSprints = sprints.map(s => 
					s.id === id ? { ...s, ...updates } : s
				);
				saveSprints(newSprints);
				return newSprints;
			});
		},
		complete: (id: number) => {
			update(sprints => {
				const today = new Date().toISOString().split('T')[0];
				const newSprints = sprints.map(s => 
					s.id === id ? { 
						...s, 
						status: 'completed' as const, 
						completed_at: today,
						// Keep original end_date, don't change it
					} : s
				);
				saveSprints(newSprints);
				return newSprints;
			});
		},
		delete: (id: number) => {
			update(sprints => {
				const newSprints = sprints.filter(s => s.id !== id);
				saveSprints(newSprints);
				return newSprints;
			});
		},
		refresh: () => {
			// Reload from localStorage (useful after import/merge)
			set(loadSprints());
		},
		getActiveSprint: () => {
			let activeSprint: Sprint | null = null;
			const unsubscribe = subscribe(sprints => {
				activeSprint = sprints.find(s => s.status === 'active') || null;
			});
			unsubscribe();
			return activeSprint;
		}
	};
}

export const sprints = createSprintStore();

// Archive tasks that are done when sprint completes
export function archiveCompletedTasks(sprintId: number) {
	// This will be called from db.ts when completing a sprint
	const event = new CustomEvent('archive-sprint-tasks', { detail: { sprintId } });
	document.dispatchEvent(event);
}
