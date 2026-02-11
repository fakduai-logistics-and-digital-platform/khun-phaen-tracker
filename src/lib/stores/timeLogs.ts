import { writable } from 'svelte/store';

export interface TimeLog {
	id: string;
	duration: number; // in seconds
	note: string;
	createdAt: number;
}

const STORAGE_KEY = 'khu-phaen-time-logs-v1';

function createTimeLogsStore() {
	const loadFromStorage = (): TimeLog[] => {
		if (typeof window === 'undefined') return [];
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				const parsed = JSON.parse(saved);
				if (Array.isArray(parsed)) {
					// Keep only last 50 logs
					return parsed.slice(-50);
				}
			}
		} catch (e) {
			console.error('Failed to load time logs:', e);
		}
		return [];
	};

	const { subscribe, set, update } = writable<TimeLog[]>(loadFromStorage());

	const saveToStorage = (logs: TimeLog[]) => {
		if (typeof window !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(-50)));
		}
	};

	return {
		subscribe,
		add: (duration: number, note: string = '') => {
			update(logs => {
				const newLog: TimeLog = {
					id: crypto.randomUUID(),
					duration,
					note: note.trim(),
					createdAt: Date.now()
				};
				const updated = [...logs, newLog];
				saveToStorage(updated);
				return updated;
			});
		},
		remove: (id: string) => {
			update(logs => {
				const updated = logs.filter(l => l.id !== id);
				saveToStorage(updated);
				return updated;
			});
		},
		clear: () => {
			set([]);
			saveToStorage([]);
		},
		getTotalToday: () => {
			const today = new Date().setHours(0, 0, 0, 0);
			const logs = loadFromStorage();
			return logs
				.filter(l => l.createdAt >= today)
				.reduce((sum, l) => sum + l.duration, 0);
		}
	};
}

export const timeLogs = createTimeLogsStore();

export function formatDuration(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	
	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	}
	return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
