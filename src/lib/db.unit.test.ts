import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	addTask,
	cleanupLegacyDatabaseStorage,
	deleteTask,
	getTaskStats,
	getTasks,
	importFromCSV,
	normalizeSqlValue,
	shouldBindParams,
	updateTask
} from './db';

class LocalStorageMock {
	private store = new Map<string, string>();

	getItem(key: string): string | null {
		return this.store.has(key) ? this.store.get(key)! : null;
	}

	setItem(key: string, value: string) {
		this.store.set(key, value);
	}

	removeItem(key: string) {
		this.store.delete(key);
	}

	clear() {
		this.store.clear();
	}
}

const originalWindow = (globalThis as any).window;
const originalLocalStorage = (globalThis as any).localStorage;

afterEach(() => {
	(globalThis as any).window = originalWindow;
	(globalThis as any).localStorage = originalLocalStorage;
	vi.restoreAllMocks();
});

describe('db helpers', () => {
	it('binds only when params contain at least one value', () => {
		expect(shouldBindParams(undefined)).toBe(false);
		expect(shouldBindParams([])).toBe(false);
		expect(shouldBindParams([1])).toBe(true);
		expect(shouldBindParams(['x', 2])).toBe(true);
	});

	it('normalizes BigInt values for UI/runtime compatibility', () => {
		expect(normalizeSqlValue(123n)).toBe(123);
		expect(normalizeSqlValue('abc')).toBe('abc');
		expect(normalizeSqlValue(null)).toBeNull();
	});
});

describe('legacy storage cleanup', () => {
	it('removes legacy migration keys when running in browser context', () => {
		const ls = new LocalStorageMock();
		(globalThis as any).window = {};
		(globalThis as any).localStorage = ls;

		ls.setItem('task-tracker-db', 'legacy');
		ls.setItem('task-tracker-db-backup-before-v2', 'backup');
		ls.setItem('task-tracker-db-migrated-to-v2', 'flag');

		cleanupLegacyDatabaseStorage();

		expect(ls.getItem('task-tracker-db')).toBeNull();
		expect(ls.getItem('task-tracker-db-backup-before-v2')).toBeNull();
		expect(ls.getItem('task-tracker-db-migrated-to-v2')).toBeNull();
	});

	it('is a no-op outside browser context', () => {
		(globalThis as any).window = undefined;
		expect(() => cleanupLegacyDatabaseStorage()).not.toThrow();
	});
});

describe('db guards before init', () => {
	it('throws for mutation/read APIs when DB is not initialized', async () => {
		await expect(
			addTask({
				title: 'task',
				project: '',
				duration_minutes: 5,
				date: '2026-02-11',
				status: 'todo',
				category: 'ทั่วไป',
				notes: '',
				assignee_id: null,
				sprint_id: null,
				is_archived: false,
				updated_at: '2026-02-11T00:00:00.000Z'
			})
		).rejects.toThrow('DB not initialized');
		await expect(updateTask(1, { title: 'x' })).rejects.toThrow('DB not initialized');
		await expect(deleteTask(1)).rejects.toThrow('DB not initialized');
		await expect(getTasks()).rejects.toThrow('DB not initialized');
		await expect(importFromCSV('title,project,date\nA,P,2026-02-11')).rejects.toThrow('DB not initialized');
		expect(() => getTaskStats()).toThrow('DB not initialized');
	});
});
