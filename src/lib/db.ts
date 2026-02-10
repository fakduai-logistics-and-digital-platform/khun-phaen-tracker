import type { Task, Project, Assignee, FilterOptions } from './types';
import initSqlJs from 'sql.js';
import { base } from '$app/paths';
import { getItem, setItem, initCompression, compressionReady } from './stores/storage';
import { get } from 'svelte/store';

// SQLite database instance
let db: any = null;
let SQL: any = null;
let isInitializing = false;

const DB_NAME = 'task-tracker-db';

// Initialize compression on module load (JS only, no WASM)
if (typeof window !== 'undefined') {
	initCompression(); // JS compression, no delay needed
}

function loadDatabase(): Uint8Array | null {
	try {
		const stored = getItem(DB_NAME);
		if (stored) {
			const binaryString = atob(stored);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}
			return bytes;
		}
	} catch (e) {
		console.log('No existing database found');
	}
	return null;
}

function saveDatabase() {
	if (!db) return;
	try {
		const data = db.export();
		const binaryString = String.fromCharCode.apply(null, Array.from(data));
		setItem(DB_NAME, btoa(binaryString));
		
		// Log compression status
		if (get(compressionReady)) {
			console.log('💾 Database saved with compression');
		}
	} catch (e) {
		console.error('Failed to save database:', e);
	}
}

export async function initDB(): Promise<void> {
	// Prevent double initialization
	if (db || isInitializing) {
		if (isInitializing) {
			// Wait for initialization to complete
			while (isInitializing) {
				await new Promise(r => setTimeout(r, 50));
			}
		}
		return;
	}
	
	isInitializing = true;
	console.log('🗄️ Initializing database...');

	try {
		// Initialize SQL.js with local wasm file
		console.log('📦 Loading SQL.js WASM...');
		SQL = await initSqlJs({
			locateFile: (file: string) => `${base}/${file}`
		});
		console.log('✅ SQL.js loaded');

		// Try to load existing database
		const existingData = loadDatabase();
		if (existingData) {
			db = new SQL.Database(existingData);
			console.log('📂 Loaded existing database');
		} else {
			db = new SQL.Database();
			console.log('📂 Created new database');
		}

		// Create tables
		createTables();
		
		// Run migrations for existing databases
		runMigrations();
		
		// Save initial state
		saveDatabase();
		
		console.log('✅ Database initialized');
	} catch (error) {
		console.error('❌ Failed to initialize database:', error);
		// Try to recover by clearing and starting fresh
		try {
			localStorage.removeItem(DB_NAME);
			if (SQL) {
				db = new SQL.Database();
				createTables();
				saveDatabase();
				console.log('⚠️ Recovered with fresh database');
			}
		} catch (recoveryError) {
			console.error('❌ Recovery failed:', recoveryError);
			throw recoveryError;
		}
	} finally {
		isInitializing = false;
	}
}

// Run migrations for existing databases
function runMigrations() {
	if (!db) return;
	
	console.log('🔄 Running migrations...');
	
	// Check if updated_at column exists
	try {
		const result = db.exec("PRAGMA table_info(tasks)");
		const columns = result[0]?.values.map((row: any) => row[1]) || [];
		
		if (!columns.includes('updated_at')) {
			console.log('🔄 Adding updated_at column...');
			db.run(`ALTER TABLE tasks ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
			console.log('✅ Added updated_at column');
		} else {
			console.log('✅ updated_at column already exists');
		}
	} catch (e: any) {
		console.warn('⚠️ Migration check failed:', e?.message || e);
		// Try to add column anyway
		try {
			db.run(`ALTER TABLE tasks ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
			console.log('✅ Added updated_at column (fallback)');
		} catch (e2) {
			// Column might already exist
		}
	}
}

// Cleanup database before refresh/unload
export function cleanupDB() {
	if (db) {
		try {
			saveDatabase();
			db.close();
			db = null;
			SQL = null;
			console.log('🧹 Database cleaned up');
		} catch (e) {
			console.warn('Cleanup error:', e);
		}
	}
}

// Register cleanup on page unload
if (typeof window !== 'undefined') {
	window.addEventListener('beforeunload', cleanupDB);
}

function createTables() {
	if (!db) throw new Error('DB not initialized');

	// Create projects table
	db.run(`
		CREATE TABLE IF NOT EXISTS projects (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`);

	// Create assignees table
	db.run(`
		CREATE TABLE IF NOT EXISTS assignees (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			color TEXT DEFAULT '#6366F1',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`);

	// Create tasks table
	db.run(`
		CREATE TABLE IF NOT EXISTS tasks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			project TEXT DEFAULT '',
			duration_minutes INTEGER DEFAULT 0,
			date TEXT NOT NULL,
			status TEXT DEFAULT 'todo',
			category TEXT DEFAULT 'อื่นๆ',
			notes TEXT DEFAULT '',
			assignee_id INTEGER,
			sprint_id INTEGER DEFAULT NULL,
			is_archived INTEGER DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (assignee_id) REFERENCES assignees(id)
		)
	`);
	
	// Try to add project column if table already exists without it
	try {
		db.run(`ALTER TABLE tasks ADD COLUMN project TEXT DEFAULT ''`);
	} catch (e) {
		// Column already exists
	}
	
	// Try to add sprint_id column
	try {
		db.run(`ALTER TABLE tasks ADD COLUMN sprint_id INTEGER DEFAULT NULL`);
	} catch (e) {
		// Column already exists
	}
	
	// Try to add is_archived column
	try {
		db.run(`ALTER TABLE tasks ADD COLUMN is_archived INTEGER DEFAULT 0`);
	} catch (e) {
		// Column already exists
	}
	
	// Try to add updated_at column
	try {
		db.run(`ALTER TABLE tasks ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
	} catch (e) {
		// Column already exists
	}
}

export async function closeDB(): Promise<void> {
	if (db) {
		saveDatabase();
		db.close();
		db = null;
	}
}

// Helper function to exec query and get results
function execQuery(sql: string, params?: any[]): { columns: string[], values: any[][] } {
	if (!db) throw new Error('DB not initialized');
	
	const stmt = db.prepare(sql);
	if (params) {
		stmt.bind(params);
	}
	
	const results: any[] = [];
	while (stmt.step()) {
		results.push(stmt.getAsObject());
	}
	stmt.free();
	
	// Convert to columns/values format similar to db.exec
	if (results.length === 0) {
		return { columns: [], values: [] };
	}
	
	const columns = Object.keys(results[0]);
	const values = results.map(row => columns.map(col => (row as any)[col]));
	
	return { columns, values };
}

// ===== Task Functions =====

export async function addTask(task: Omit<Task, 'id' | 'created_at'>): Promise<void> {
	if (!db) throw new Error('DB not initialized');
	
	db.run(
		`INSERT INTO tasks (title, project, duration_minutes, date, status, category, notes, assignee_id, sprint_id, is_archived)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			task.title,
			task.project || '',
			task.duration_minutes,
			task.date,
			task.status,
			task.category || 'อื่นๆ',
			task.notes || '',
			task.assignee_id || null,
			task.sprint_id || null,
			task.is_archived ? 1 : 0
		]
	);
	
	saveDatabase();
}

export async function updateTask(id: number, updates: Partial<Task>): Promise<void> {
	if (!db) throw new Error('DB not initialized');
	
	console.log('🔍 updateTask called:', { id, updates: Object.keys(updates) });
	
	const sets: string[] = [];
	const values: any[] = [];
	
	if (updates.title !== undefined) {
		sets.push('title = ?');
		values.push(updates.title);
	}
	if (updates.project !== undefined) {
		sets.push('project = ?');
		values.push(updates.project);
	}
	if (updates.duration_minutes !== undefined) {
		sets.push('duration_minutes = ?');
		values.push(updates.duration_minutes);
	}
	if (updates.date !== undefined) {
		sets.push('date = ?');
		values.push(updates.date);
	}
	if (updates.status !== undefined) {
		sets.push('status = ?');
		values.push(updates.status);
	}
	if (updates.category !== undefined) {
		sets.push('category = ?');
		values.push(updates.category);
	}
	if (updates.notes !== undefined) {
		sets.push('notes = ?');
		values.push(updates.notes);
	}
	if (updates.assignee_id !== undefined) {
		sets.push('assignee_id = ?');
		values.push(updates.assignee_id);
	}
	if (updates.sprint_id !== undefined) {
		sets.push('sprint_id = ?');
		values.push(updates.sprint_id);
	}
	if (updates.is_archived !== undefined) {
		sets.push('is_archived = ?');
		values.push(updates.is_archived ? 1 : 0);
	}
	
	// Always update updated_at when task is modified
	sets.push('updated_at = CURRENT_TIMESTAMP');
	
	if (sets.length === 1) {
		// Only updated_at, no other changes - still update it
		// But we need at least one field to update
	}
	
	values.push(id);
	
	console.log('🔍 updateTask SQL:', { sets, valuesCount: values.length, sql: `UPDATE tasks SET ${sets.join(', ')} WHERE id = ?` });
	
	try {
		db.run(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, values);
		saveDatabase();
		console.log('✅ updateTask completed:', { id });
	} catch (e: any) {
		console.error('❌ updateTask failed:', e?.message || e);
		// If updated_at column doesn't exist, try without it
		if (e?.message?.includes('updated_at')) {
			console.log('⚠️ Retrying without updated_at...');
			const setsWithoutUpdatedAt = sets.filter(s => !s.includes('updated_at'));
			if (setsWithoutUpdatedAt.length > 0) {
				db.run(`UPDATE tasks SET ${setsWithoutUpdatedAt.join(', ')} WHERE id = ?`, 
					values.filter((_, i) => !sets[i]?.includes('updated_at')));
				saveDatabase();
				console.log('✅ updateTask completed (without updated_at):', { id });
			}
		} else {
			throw e;
		}
	}
}

export async function deleteTask(id: number): Promise<void> {
	if (!db) throw new Error('DB not initialized');
	
	db.run('DELETE FROM tasks WHERE id = ?', [id]);
	saveDatabase();
}

export async function getTasks(filter?: FilterOptions): Promise<Task[]> {
	if (!db) throw new Error('DB not initialized');
	
	let query = `
		SELECT 
			t.*,
			a.id as a_id,
			a.name as a_name,
			a.color as a_color,
			a.created_at as a_created_at
		FROM tasks t
		LEFT JOIN assignees a ON t.assignee_id = a.id
		WHERE 1=1
	`;
	
	const params: any[] = [];
	
	if (filter?.startDate) {
		query += ` AND t.date >= ?`;
		params.push(filter.startDate);
	}
	if (filter?.endDate) {
		query += ` AND t.date <= ?`;
		params.push(filter.endDate);
	}
	if (filter?.status && filter.status !== 'all' && filter.status !== 'archived') {
		query += ` AND t.status = ?`;
		params.push(filter.status);
	}
	if (filter?.category && filter.category !== 'all') {
		query += ` AND t.category = ?`;
		params.push(filter.category);
	}
	if (filter?.project && filter.project !== 'all') {
		query += ` AND t.project = ?`;
		params.push(filter.project);
	}
	if (filter?.assignee_id !== undefined && filter.assignee_id !== 'all') {
		if (filter.assignee_id === null) {
			query += ` AND t.assignee_id IS NULL`;
		} else {
			query += ` AND t.assignee_id = ?`;
			params.push(filter.assignee_id);
		}
	}
	if (filter?.sprint_id !== undefined && filter.sprint_id !== 'all') {
		if (filter.sprint_id === null) {
			query += ` AND t.sprint_id IS NULL`;
		} else {
			query += ` AND t.sprint_id = ?`;
			params.push(filter.sprint_id);
		}
	}
	// Handle archived tasks
	if (filter?.status === 'archived') {
		query += ` AND t.is_archived = 1`;
	} else if (!filter?.includeArchived) {
		// By default, exclude archived tasks
		query += ` AND t.is_archived = 0`;
	}
	if (filter?.search) {
		query += ` AND (LOWER(t.title) LIKE LOWER(?) OR LOWER(t.notes) LIKE LOWER(?))`;
		params.push(`%${filter.search}%`, `%${filter.search}%`);
	}
	
	query += ' ORDER BY t.date DESC, t.created_at DESC';
	
	const result = execQuery(query, params);
	
	return result.values.map(row => {
		const obj = Object.fromEntries(result.columns.map((col, i) => [col, row[i]]));
		return {
			id: obj.id as number,
			title: obj.title as string,
			project: obj.project as string,
			duration_minutes: obj.duration_minutes as number,
			date: obj.date as string,
			status: obj.status as Task['status'],
			category: obj.category as string,
			notes: obj.notes as string,
			assignee_id: obj.assignee_id as number | null,
			sprint_id: obj.sprint_id as number | null,
			is_archived: obj.is_archived === 1,
			assignee: obj.a_id ? {
				id: obj.a_id as number,
				name: obj.a_name as string,
				color: obj.a_color as string,
				created_at: obj.a_created_at as string
			} : null,
			created_at: obj.created_at as string,
			updated_at: (obj.updated_at || obj.created_at) as string
		};
	});
}

export async function getTaskById(id: number): Promise<Task | null> {
	if (!db) throw new Error('DB not initialized');
	
	const result = execQuery(`
		SELECT 
			t.*,
			a.id as a_id,
			a.name as a_name,
			a.color as a_color,
			a.created_at as a_created_at
		FROM tasks t
		LEFT JOIN assignees a ON t.assignee_id = a.id
		WHERE t.id = ?
	`, [id]);
	
	if (result.values.length === 0) return null;
	
	const row = result.values[0];
	const obj = Object.fromEntries(result.columns.map((col, i) => [col, row[i]]));
	
	return {
		id: obj.id as number,
		title: obj.title as string,
		project: obj.project as string,
		duration_minutes: obj.duration_minutes as number,
		date: obj.date as string,
		status: obj.status as Task['status'],
		category: obj.category as string,
		notes: obj.notes as string,
		assignee_id: obj.assignee_id as number | null,
		sprint_id: obj.sprint_id as number | null,
		is_archived: obj.is_archived === 1,
		assignee: obj.a_id ? {
			id: obj.a_id as number,
			name: obj.a_name as string,
			color: obj.a_color as string,
			created_at: obj.a_created_at as string
		} : null,
		created_at: obj.created_at as string,
		updated_at: (obj.updated_at || obj.created_at) as string
	};
}

export async function getProjects(): Promise<string[]> {
	if (!db) throw new Error('DB not initialized');
	
	const result = execQuery('SELECT name FROM projects ORDER BY name');
	return result.values.map(row => row[0]).filter(Boolean) as string[];
}

export async function getCategories(): Promise<string[]> {
	if (!db) throw new Error('DB not initialized');
	
	const result = execQuery('SELECT DISTINCT category FROM tasks WHERE category IS NOT NULL ORDER BY category');
	return result.values.map(row => row[0]).filter(Boolean) as string[];
}

export async function getStats() {
	if (!db) throw new Error('DB not initialized');
	
	const result = execQuery(`
		SELECT 
			COUNT(*) as total,
			SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo,
			SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as in_progress,
			SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
			SUM(duration_minutes) as total_minutes
		FROM tasks
	`);
	
	if (result.values.length === 0) {
		return { total: 0, todo: 0, in_progress: 0, done: 0, total_minutes: 0 };
	}
	
	const row = result.values[0];
	const obj = Object.fromEntries(result.columns.map((col, i) => [col, row[i]]));
	
	return {
		total: Number(obj.total) || 0,
		todo: Number(obj.todo) || 0,
		in_progress: Number(obj.in_progress) || 0,
		done: Number(obj.done) || 0,
		total_minutes: Number(obj.total_minutes) || 0
	};
}

// ===== Project Functions =====

export async function getProjectsList(): Promise<Project[]> {
	if (!db) throw new Error('DB not initialized');
	
	const result = execQuery('SELECT * FROM projects ORDER BY name');
	
	return result.values.map(row => {
		const obj = Object.fromEntries(result.columns.map((col, i) => [col, row[i]]));
		return {
			id: obj.id as number,
			name: obj.name as string,
			created_at: obj.created_at as string
		};
	});
}

export async function getProjectStats(): Promise<{ id: number; taskCount: number }[]> {
	if (!db) throw new Error('DB not initialized');
	
	const result = execQuery(`
		SELECT 
			p.id,
			COUNT(t.id) as taskCount
		FROM projects p
		LEFT JOIN tasks t ON p.name = t.project
		GROUP BY p.id
		ORDER BY p.name
	`);
	
	return result.values.map(row => {
		const obj = Object.fromEntries(result.columns.map((col, i) => [col, row[i]]));
		return {
			id: obj.id as number,
			taskCount: obj.taskCount as number
		};
	});
}

export async function addProject(project: Omit<Project, 'id' | 'created_at'>): Promise<void> {
	if (!db) throw new Error('DB not initialized');
	
	db.run('INSERT INTO projects (name) VALUES (?)', [project.name]);
	
	saveDatabase();
}

export async function updateProject(id: number, updates: Partial<Project>): Promise<void> {
	if (!db) throw new Error('DB not initialized');
	
	const oldProject = execQuery('SELECT name FROM projects WHERE id = ?', [id]);
	if (oldProject.values.length === 0) return;
	
	const oldName = oldProject.values[0][0];
	
	if (updates.name !== undefined) {
		// Update project name
		db.run('UPDATE projects SET name = ? WHERE id = ?', [updates.name, id]);
		
		// Update all tasks with old project name
		db.run('UPDATE tasks SET project = ? WHERE project = ?', [updates.name, oldName]);
	}
	
	saveDatabase();
}

export async function deleteProject(id: number): Promise<void> {
	if (!db) throw new Error('DB not initialized');
	
	// Get project name before delete
	const project = execQuery('SELECT name FROM projects WHERE id = ?', [id]);
	if (project.values.length === 0) return;
	
	const projectName = project.values[0][0];
	
	// Set project to empty for all tasks using this project
	db.run('UPDATE tasks SET project = "" WHERE project = ?', [projectName]);
	
	// Delete the project
	db.run('DELETE FROM projects WHERE id = ?', [id]);
	
	saveDatabase();
}

// ===== Sprint Functions =====

export async function archiveTasksBySprint(sprintId: number): Promise<number> {
	if (!db) throw new Error('DB not initialized');
	
	// Archive all done tasks in the sprint (keep original status, just mark as archived)
	db.run(`
		UPDATE tasks 
		SET is_archived = 1
		WHERE sprint_id = ? AND status = 'done' AND is_archived = 0
	`, [sprintId]);
	
	// Get count of archived tasks
	const result = execQuery(`
		SELECT COUNT(*) as count FROM tasks 
		WHERE sprint_id = ? AND is_archived = 1
	`, [sprintId]);
	
	saveDatabase();
	
	return (result.values[0]?.[0] as number) || 0;
}

export async function getTasksBySprint(sprintId: number): Promise<Task[]> {
	if (!db) throw new Error('DB not initialized');
	
	const result = execQuery(`
		SELECT 
			t.*,
			a.id as a_id,
			a.name as a_name,
			a.color as a_color,
			a.created_at as a_created_at
		FROM tasks t
		LEFT JOIN assignees a ON t.assignee_id = a.id
		WHERE t.sprint_id = ?
		ORDER BY t.date DESC, t.created_at DESC
	`, [sprintId]);
	
	return result.values.map(row => {
		const obj = Object.fromEntries(result.columns.map((col, i) => [col, row[i]]));
		return {
			id: obj.id as number,
			title: obj.title as string,
			project: obj.project as string,
			duration_minutes: obj.duration_minutes as number,
			date: obj.date as string,
			status: obj.status as Task['status'],
			category: obj.category as string,
			notes: obj.notes as string,
			assignee_id: obj.assignee_id as number | null,
			sprint_id: obj.sprint_id as number | null,
			is_archived: obj.is_archived === 1,
			assignee: obj.a_id ? {
				id: obj.a_id as number,
				name: obj.a_name as string,
				color: obj.a_color as string,
				created_at: obj.a_created_at as string
			} : null,
			created_at: obj.created_at as string,
			updated_at: (obj.updated_at || obj.created_at) as string
		};
	});
}

// ===== Assignee Functions =====

export async function getAssignees(): Promise<Assignee[]> {
	if (!db) throw new Error('DB not initialized');
	
	const result = execQuery('SELECT * FROM assignees ORDER BY name');
	
	return result.values.map(row => {
		const obj = Object.fromEntries(result.columns.map((col, i) => [col, row[i]]));
		return {
			id: obj.id as number,
			name: obj.name as string,
			color: obj.color as string,
			created_at: obj.created_at as string
		};
	});
}

export async function getAssigneeStats(): Promise<{ id: number; taskCount: number }[]> {
	if (!db) throw new Error('DB not initialized');
	
	const result = execQuery(`
		SELECT 
			a.id,
			COUNT(t.id) as taskCount
		FROM assignees a
		LEFT JOIN tasks t ON a.id = t.assignee_id
		GROUP BY a.id
		ORDER BY a.name
	`);
	
	return result.values.map(row => {
		const obj = Object.fromEntries(result.columns.map((col, i) => [col, row[i]]));
		return {
			id: obj.id as number,
			taskCount: obj.taskCount as number
		};
	});
}

export async function addAssignee(assignee: Omit<Assignee, 'id' | 'created_at'>): Promise<void> {
	if (!db) throw new Error('DB not initialized');
	
	db.run('INSERT INTO assignees (name, color) VALUES (?, ?)', [
		assignee.name,
		assignee.color || '#6366F1'
	]);
	
	saveDatabase();
}

export async function updateAssignee(id: number, updates: Partial<Assignee>): Promise<void> {
	if (!db) throw new Error('DB not initialized');
	
	const sets: string[] = [];
	const values: any[] = [];
	
	if (updates.name !== undefined) {
		sets.push('name = ?');
		values.push(updates.name);
	}
	if (updates.color !== undefined) {
		sets.push('color = ?');
		values.push(updates.color);
	}
	
	if (sets.length === 0) return;
	
	values.push(id);
	
	db.run(`UPDATE assignees SET ${sets.join(', ')} WHERE id = ?`, values);
	saveDatabase();
}

export async function deleteAssignee(id: number): Promise<void> {
	if (!db) throw new Error('DB not initialized');
	
	// Set assignee_id to NULL for all tasks assigned to this assignee
	db.run('UPDATE tasks SET assignee_id = NULL WHERE assignee_id = ?', [id]);
	
	// Delete the assignee
	db.run('DELETE FROM assignees WHERE id = ?', [id]);
	
	saveDatabase();
}

// ===== Export/Import Functions =====

export async function exportToCSV(): Promise<string> {
	if (!db) throw new Error('DB not initialized');
	
	const result = execQuery('SELECT * FROM tasks ORDER BY date DESC, created_at DESC');
	
	if (result.values.length === 0) return '';
	
	const headers = ['id', 'title', 'project', 'duration_minutes', 'date', 'status', 'category', 'notes', 'assignee_id', 'sprint_id', 'is_archived', 'created_at'];
	const csvRows = [headers.join(',')];
	
	for (const row of result.values) {
		const obj = Object.fromEntries(result.columns.map((col, i) => [col, row[i]]));
		const values = headers.map(h => {
			const val = obj[h];
			if (val === null || val === undefined) return '';
			const str = String(val);
			if (str.includes(',') || str.includes('"') || str.includes('\n')) {
				return `"${str.replace(/"/g, '""')}"`;
			}
			return str;
		});
		csvRows.push(values.join(','));
	}
	
	return csvRows.join('\n');
}

export async function importFromCSV(csvContent: string, options: { clearExisting?: boolean } = {}): Promise<number> {
	if (!db) throw new Error('DB not initialized');
	
	const lines = csvContent.trim().split('\n');
	if (lines.length < 2) {
		console.warn('CSV has less than 2 lines (headers + data)');
		return 0;
	}
	
	const headers = lines[0].split(',').map(h => h.trim());
	console.log('📄 CSV Headers:', headers);
	
	// Validate required headers
	const requiredHeaders = ['title', 'project', 'date'];
	const hasRequired = requiredHeaders.every(h => headers.includes(h));
	if (!hasRequired) {
		console.error('❌ CSV missing required headers. Found:', headers);
		throw new Error(`CSV ไม่ถูกต้อง: ต้องมีคอลัมน์ ${requiredHeaders.join(', ')}`);
	}
	
	// Start transaction
	try {
		db.run('BEGIN TRANSACTION');
		
		// Clear existing tasks if requested (for sync)
		if (options.clearExisting !== false) {
			console.log('🗑️ Clearing existing tasks...');
			db.run('DELETE FROM tasks');
		}
		
		let imported = 0;
		let errors = 0;
		
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i].trim();
			if (!line) continue; // Skip empty lines
			
			const values = parseCSVLine(line);
			if (values.length !== headers.length) {
				console.warn(`⚠️ Line ${i + 1} has ${values.length} values, expected ${headers.length}`);
				errors++;
				continue;
			}
			
			const row: Record<string, string> = {};
			headers.forEach((h, idx) => row[h] = values[idx]);
			
			try {
				// Use REPLACE INTO to handle duplicate IDs
				if (row.id) {
					db.run(`
						REPLACE INTO tasks (id, title, project, duration_minutes, date, status, category, notes, assignee_id, sprint_id, is_archived, created_at)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
					`, [
						parseInt(row.id),
						row.title || '',
						row.project || '',
						parseInt(row.duration_minutes) || 0,
						row.date || new Date().toISOString().split('T')[0],
						row.status || 'todo',
						row.category || 'อื่นๆ',
						row.notes || '',
						row.assignee_id ? parseInt(row.assignee_id) : null,
						row.sprint_id ? parseInt(row.sprint_id) : null,
						row.is_archived === '1' || row.is_archived === 'true' ? 1 : 0,
						row.created_at || new Date().toISOString()
					]);
				} else {
					db.run(`
						INSERT INTO tasks (title, project, duration_minutes, date, status, category, notes, assignee_id, sprint_id, is_archived)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
					`, [
						row.title || '',
						row.project || '',
						parseInt(row.duration_minutes) || 0,
						row.date || new Date().toISOString().split('T')[0],
						row.status || 'todo',
						row.category || 'อื่นๆ',
						row.notes || '',
						row.assignee_id ? parseInt(row.assignee_id) : null,
						row.sprint_id ? parseInt(row.sprint_id) : null,
						row.is_archived === '1' || row.is_archived === 'true' ? 1 : 0
					]);
				}
				imported++;
			} catch (e) {
				console.error('❌ Failed to import row:', row, e);
				errors++;
			}
		}
		
		db.run('COMMIT');
		console.log(`✅ Imported ${imported} tasks (${errors} errors)`);
		
		saveDatabase();
		return imported;
	} catch (e) {
		console.error('❌ Import failed, rolling back:', e);
		try {
			db.run('ROLLBACK');
		} catch (rollbackErr) {
			console.error('Rollback failed:', rollbackErr);
		}
		throw e;
	}
}

function parseCSVLine(line: string): string[] {
	const values: string[] = [];
	let current = '';
	let inQuotes = false;
	
	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		const nextChar = line[i + 1];
		
		if (char === '"') {
			if (inQuotes && nextChar === '"') {
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
		} else if (char === ',' && !inQuotes) {
			values.push(current.trim());
			current = '';
		} else {
			current += char;
		}
	}
	
	values.push(current.trim());
	return values;
}

// ===== Merge Sync Functions =====

// Merge tasks from server with local tasks (smart merge)
export async function mergeTasksFromCSV(csvContent: string): Promise<{ added: number; updated: number; unchanged: number }> {
	if (!db) throw new Error('DB not initialized');
	
	const trimmed = csvContent.trim();
	if (!trimmed) {
		console.log('Empty CSV, nothing to merge');
		return { added: 0, updated: 0, unchanged: 0 };
	}
	
	const lines = trimmed.split('\n');
	if (lines.length < 2) {
		console.warn('CSV has less than 2 lines (only headers or empty)');
		return { added: 0, updated: 0, unchanged: 0 };
	}
	
	const headers = lines[0].split(',').map(h => h.trim());
	
	// Get all existing tasks for comparison
	const existingResult = execQuery('SELECT * FROM tasks');
	const existingTasks = new Map();
	for (const row of existingResult.values) {
		const obj = Object.fromEntries(existingResult.columns.map((col, i) => [col, row[i]]));
		existingTasks.set(obj.id, obj);
	}
	
	console.log(`📊 Local tasks: ${existingTasks.size}, Server tasks: ${lines.length - 1}`);
	
	let added = 0;
	let updated = 0;
	let unchanged = 0;
	
	db.run('BEGIN TRANSACTION');
	
	try {
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i].trim();
			if (!line) continue;
			
			const values = parseCSVLine(line);
			if (values.length !== headers.length) continue;
			
			const row: Record<string, string> = {};
			headers.forEach((h, idx) => row[h] = values[idx]);
			
			const serverId = row.id ? parseInt(row.id) : null;
			const existing = serverId ? existingTasks.get(serverId) : null;
			
			if (!existing) {
				// New task - insert
				try {
					db.run(`
						INSERT INTO tasks (title, project, duration_minutes, date, status, category, notes, assignee_id, sprint_id, is_archived, created_at)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
					`, [
						row.title || '',
						row.project || '',
						parseInt(row.duration_minutes) || 0,
						row.date || new Date().toISOString().split('T')[0],
						row.status || 'todo',
						row.category || 'อื่นๆ',
						row.notes || '',
						row.assignee_id ? parseInt(row.assignee_id) : null,
						row.sprint_id ? parseInt(row.sprint_id) : null,
						row.is_archived === '1' || row.is_archived === 'true' ? 1 : 0,
						row.created_at || new Date().toISOString()
					]);
					added++;
				} catch (e) {
					console.warn('Failed to insert task:', e);
				}
			} else {
				// Compare timestamps to see which is newer
				const serverDate = new Date(row.created_at || 0).getTime();
				const localDate = new Date(existing.created_at || 0).getTime();
				
				// Check if content is different (include sprint_id and is_archived)
				const isDifferent = 
					row.title !== existing.title ||
					row.status !== existing.status ||
					row.project !== existing.project ||
					(row.notes || '') !== (existing.notes || '') ||
					(row.sprint_id ? parseInt(row.sprint_id) : null) !== existing.sprint_id ||
					(row.is_archived === '1' || row.is_archived === 'true') !== (existing.is_archived === 1);
				
				if (isDifferent && serverDate >= localDate) {
					// Server version is newer or same age but different - update
					try {
						db.run(`
							UPDATE tasks 
							SET title = ?, project = ?, duration_minutes = ?, 
							    date = ?, status = ?, category = ?, notes = ?, 
							    assignee_id = ?, sprint_id = ?, is_archived = ?, created_at = ?
							WHERE id = ?
						`, [
							row.title || '',
							row.project || '',
							parseInt(row.duration_minutes) || 0,
							row.date || new Date().toISOString().split('T')[0],
							row.status || 'todo',
							row.category || 'อื่นๆ',
							row.notes || '',
							row.assignee_id ? parseInt(row.assignee_id) : null,
							row.sprint_id ? parseInt(row.sprint_id) : null,
							row.is_archived === '1' || row.is_archived === 'true' ? 1 : 0,
							row.created_at || new Date().toISOString(),
							serverId
						]);
						updated++;
					} catch (e) {
						console.warn('Failed to update task:', e);
					}
				} else {
					unchanged++;
				}
				
				// Remove from map to track which local tasks don't exist on server
				existingTasks.delete(serverId);
			}
		}
		
		db.run('COMMIT');
		saveDatabase();
		
		console.log(`✅ Merge complete: ${added} added, ${updated} updated, ${unchanged} unchanged`);
		console.log(`📌 Local-only tasks: ${existingTasks.size}`);
		
		return { added, updated, unchanged };
	} catch (e) {
		db.run('ROLLBACK');
		throw e;
	}
}

// Get task statistics for sync info
export function getTaskStats(): { total: number; byStatus: Record<string, number>; lastUpdated: string | null } {
	if (!db) throw new Error('DB not initialized');
	
	const totalResult = execQuery('SELECT COUNT(*) as count FROM tasks');
	const total = totalResult.values[0]?.[0] || 0;
	
	const statusResult = execQuery('SELECT status, COUNT(*) as count FROM tasks GROUP BY status');
	const byStatus: Record<string, number> = {};
	for (const row of statusResult.values) {
		byStatus[row[0]] = row[1];
	}
	
	const lastResult = execQuery('SELECT MAX(created_at) as last FROM tasks');
	const lastUpdated = lastResult.values[0]?.[0] || null;
	
	return { total, byStatus, lastUpdated };
}

// ===== Export/Import ALL Data (Tasks + Projects + Assignees) =====

export interface AllData {
	tasks: Task[];
	projects: Project[];
	assignees: Assignee[];
}

export async function exportAllData(): Promise<string> {
	if (!db) throw new Error('DB not initialized');
	
	// Get tasks with assignee names
	const tasksResult = execQuery(`
		SELECT t.*, a.name as assignee_name 
		FROM tasks t 
		LEFT JOIN assignees a ON t.assignee_id = a.id 
		ORDER BY t.date DESC, t.created_at DESC
	`);
	const projectsResult = execQuery('SELECT * FROM projects ORDER BY name');
	const assigneesResult = execQuery('SELECT * FROM assignees ORDER BY name');
	
	// Get sprints from localStorage
	let sprints: any[] = [];
	if (typeof window !== 'undefined') {
		try {
			const saved = localStorage.getItem('sprints-data-v1');
			if (saved) {
				sprints = JSON.parse(saved);
			}
		} catch (e) {
			console.warn('Failed to load sprints for export:', e);
		}
	}
	
	// Build tasks CSV section with assignee_name, sprint_id, is_archived
	const taskHeaders = ['id', 'title', 'project', 'duration_minutes', 'date', 'status', 'category', 'notes', 'assignee_id', 'assignee_name', 'sprint_id', 'is_archived', 'created_at', 'updated_at'];
	const csvRows: string[] = [];
	
	// Add tasks section
	csvRows.push('# TASKS');
	csvRows.push(taskHeaders.join(','));
	
	for (const row of tasksResult.values) {
		const obj = Object.fromEntries(tasksResult.columns.map((col, i) => [col, row[i]]));
		const values = taskHeaders.map(h => {
			const val = obj[h];
			if (val === null || val === undefined) return '';
			const str = String(val);
			if (str.includes(',') || str.includes('"') || str.includes('\n')) {
				return `"${str.replace(/"/g, '""')}"`;
			}
			return str;
		});
		csvRows.push(values.join(','));
	}
	
	// Add projects section
	csvRows.push('');
	csvRows.push('# PROJECTS');
	const projectHeaders = ['id', 'name', 'created_at'];
	csvRows.push(projectHeaders.join(','));
	
	for (const row of projectsResult.values) {
		const obj = Object.fromEntries(projectsResult.columns.map((col, i) => [col, row[i]]));
		const values = projectHeaders.map(h => {
			const val = obj[h];
			if (val === null || val === undefined) return '';
			const str = String(val);
			if (str.includes(',') || str.includes('"') || str.includes('\n')) {
				return `"${str.replace(/"/g, '""')}"`;
			}
			return str;
		});
		csvRows.push(values.join(','));
	}
	
	// Add assignees section
	csvRows.push('');
	csvRows.push('# ASSIGNEES');
	const assigneeHeaders = ['id', 'name', 'color', 'created_at'];
	csvRows.push(assigneeHeaders.join(','));
	
	for (const row of assigneesResult.values) {
		const obj = Object.fromEntries(assigneesResult.columns.map((col, i) => [col, row[i]]));
		const values = assigneeHeaders.map(h => {
			const val = obj[h];
			if (val === null || val === undefined) return '';
			const str = String(val);
			if (str.includes(',') || str.includes('"') || str.includes('\n')) {
				return `"${str.replace(/"/g, '""')}"`;
			}
			return str;
		});
		csvRows.push(values.join(','));
	}
	
	// Add sprints section
	csvRows.push('');
	csvRows.push('# SPRINTS');
	const sprintHeaders = ['id', 'name', 'start_date', 'end_date', 'status', 'created_at'];
	csvRows.push(sprintHeaders.join(','));
	
	for (const sprint of sprints) {
		const values = sprintHeaders.map(h => {
			const val = (sprint as any)[h];
			if (val === null || val === undefined) return '';
			const str = String(val);
			if (str.includes(',') || str.includes('"') || str.includes('\n')) {
				return `"${str.replace(/"/g, '""')}"`;
			}
			return str;
		});
		csvRows.push(values.join(','));
	}
	
	return csvRows.join('\n');
}

export async function importAllData(csvContent: string, options: { clearExisting?: boolean; useExistingIds?: boolean } = {}): Promise<{ tasks: number; projects: number; assignees: number; sprints: number }> {
	if (!db) throw new Error('DB not initialized');
	
	const lines = csvContent.trim().split('\n');
	if (lines.length < 2) {
		console.warn('CSV has less than 2 lines');
		return { tasks: 0, projects: 0, assignees: 0, sprints: 0 };
	}
	
	// Get existing task IDs to check for duplicates
	const existingIds = new Set<number>();
	if (options.useExistingIds !== true) {
		const existingResult = execQuery('SELECT id FROM tasks');
		for (const row of existingResult.values) {
			existingIds.add(row[0]);
		}
		console.log(`📋 Existing tasks: ${existingIds.size}`);
	}
	
	// Parse sections
	let currentSection: 'tasks' | 'projects' | 'assignees' | 'sprints' | null = null;
	let currentHeaders: string[] = [];
	
	const taskRows: Record<string, string>[] = [];
	const projectRows: Record<string, string>[] = [];
	const assigneeRows: Record<string, string>[] = [];
	const sprintRows: Record<string, string>[] = [];
	
	for (const line of lines) {
		const trimmedLine = line.trim();
		if (!trimmedLine) continue;
		
		// Check for section header
		if (trimmedLine.startsWith('# TASKS')) {
			currentSection = 'tasks';
			currentHeaders = [];
			continue;
		} else if (trimmedLine.startsWith('# PROJECTS')) {
			currentSection = 'projects';
			currentHeaders = [];
			continue;
		} else if (trimmedLine.startsWith('# ASSIGNEES')) {
			currentSection = 'assignees';
			currentHeaders = [];
			continue;
		} else if (trimmedLine.startsWith('# SPRINTS')) {
			currentSection = 'sprints';
			currentHeaders = [];
			continue;
		}
		
		// If no section set yet, skip (might be old format without sections)
		if (!currentSection) continue;
		
		// Parse header row
		if (currentHeaders.length === 0) {
			currentHeaders = trimmedLine.split(',').map(h => h.trim());
			continue;
		}
		
		// Parse data row
		const values = parseCSVLine(trimmedLine);
		if (values.length !== currentHeaders.length) {
			console.warn(`Skipping row: value count mismatch`);
			continue;
		}
		
		const row: Record<string, string> = {};
		currentHeaders.forEach((h, idx) => row[h] = values[idx]);
		
		if (currentSection === 'tasks') {
			taskRows.push(row);
		} else if (currentSection === 'projects') {
			projectRows.push(row);
		} else if (currentSection === 'assignees') {
			assigneeRows.push(row);
		} else if (currentSection === 'sprints') {
			sprintRows.push(row);
		}
	}
	
	// If no sections found, treat as old format (tasks only)
	if (taskRows.length === 0 && projectRows.length === 0 && assigneeRows.length === 0) {
		// Try to import as old format (tasks only)
		const tasksImported = await importFromCSV(csvContent, options);
		return { tasks: tasksImported, projects: 0, assignees: 0, sprints: 0 };
	}
	
	// Start transaction
	db.run('BEGIN TRANSACTION');
	
	try {
		let tasksImported = 0;
		let projectsImported = 0;
		let assigneesImported = 0;
		
		// Clear existing data if requested
		if (options.clearExisting !== false) {
			db.run('DELETE FROM tasks');
			db.run('DELETE FROM projects');
			db.run('DELETE FROM assignees');
			// Clear sprints from localStorage
			if (typeof window !== 'undefined') {
				localStorage.removeItem('sprints-data-v1');
			}
		}
		
		// Import sprints first (tasks may reference them)
		const importedSprints: any[] = [];
		for (const row of sprintRows) {
			try {
				const sprint: any = {
					id: row.id ? parseInt(row.id) : Date.now() + Math.floor(Math.random() * 1000),
					name: row.name || '',
					start_date: row.start_date || new Date().toISOString().split('T')[0],
					end_date: row.end_date || new Date().toISOString().split('T')[0],
					status: row.status || 'planned',
					created_at: row.created_at || new Date().toISOString()
				};
				importedSprints.push(sprint);
			} catch (e) {
				console.warn('Failed to import sprint:', row, e);
			}
		}
		
		// Save sprints to localStorage
		if (importedSprints.length > 0 && typeof window !== 'undefined') {
			try {
				const existingData = localStorage.getItem('sprints-data-v1');
				let existingSprints: any[] = [];
				if (existingData) {
					existingSprints = JSON.parse(existingData);
				}
				
				// Merge sprints, avoid duplicates by id
				const sprintMap = new Map(existingSprints.map(s => [s.id, s]));
				for (const sprint of importedSprints) {
					// If clearing, just use imported. Otherwise merge.
					if (options.clearExisting !== false) {
						sprintMap.set(sprint.id, sprint);
					} else if (!sprintMap.has(sprint.id)) {
						sprintMap.set(sprint.id, sprint);
					}
				}
				
				localStorage.setItem('sprints-data-v1', JSON.stringify(Array.from(sprintMap.values())));
				console.log(`✅ Imported ${importedSprints.length} sprints`);
			} catch (e) {
				console.warn('Failed to save sprints:', e);
			}
		}
		
		// Import projects first (tasks may reference them)
		for (const row of projectRows) {
			try {
				if (row.id) {
					db.run(`
						REPLACE INTO projects (id, name, created_at)
						VALUES (?, ?, ?)
					`, [
						parseInt(row.id),
						row.name || '',
						row.created_at || new Date().toISOString()
					]);
				} else {
					db.run(`
						INSERT INTO projects (name, created_at)
						VALUES (?, ?)
					`, [
						row.name || '',
						row.created_at || new Date().toISOString()
					]);
				}
				projectsImported++;
			} catch (e) {
				console.warn('Failed to import project:', row, e);
			}
		}
		
		// Import assignees from assignees section
		for (const row of assigneeRows) {
			try {
				if (row.id) {
					db.run(`
						REPLACE INTO assignees (id, name, color, created_at)
						VALUES (?, ?, ?, ?)
					`, [
						parseInt(row.id),
						row.name || '',
						row.color || '#6366F1',
						row.created_at || new Date().toISOString()
					]);
				} else {
					db.run(`
						INSERT INTO assignees (name, color, created_at)
						VALUES (?, ?, ?)
					`, [
						row.name || '',
						row.color || '#6366F1',
						row.created_at || new Date().toISOString()
					]);
				}
				assigneesImported++;
			} catch (e) {
				console.warn('Failed to import assignee:', row, e);
			}
		}
		
		// Build assignee name to id map
		const assigneeNameToId = new Map<string, number>();
		const allAssigneesResult = execQuery('SELECT id, name FROM assignees');
		for (const row of allAssigneesResult.values) {
			const obj = Object.fromEntries(allAssigneesResult.columns.map((col, i) => [col, row[i]]));
			assigneeNameToId.set(obj.name, obj.id);
		}
		
		// Import tasks (with assignee_name support)
		for (const row of taskRows) {
			try {
				// Resolve assignee_id from assignee_name if provided
				let assigneeId: number | null = null;
				if (row.assignee_id) {
					assigneeId = parseInt(row.assignee_id);
				} else if (row.assignee_name && row.assignee_name.trim()) {
					// Try to find existing assignee by name
					const existingId = assigneeNameToId.get(row.assignee_name.trim());
					if (existingId) {
						assigneeId = existingId;
					} else {
						// Create new assignee
						db.run(`
							INSERT INTO assignees (name, color, created_at)
							VALUES (?, ?, ?)
						`, [
							row.assignee_name.trim(),
							'#6366F1',
							new Date().toISOString()
						]);
						// Get the new assignee id
						const newAssigneeResult = execQuery('SELECT last_insert_rowid() as id');
						assigneeId = newAssigneeResult.values[0][0];
						assigneeNameToId.set(row.assignee_name.trim(), assigneeId);
						assigneesImported++;
					}
				}
				
				// Check if we should use existing ID or create new one
				const rowId = row.id ? parseInt(row.id) : null;
				const shouldUseExistingId = options.useExistingIds === true && rowId && !existingIds.has(rowId);
				
				// Parse sprint_id and is_archived
				const sprintId = row.sprint_id ? parseInt(row.sprint_id) : null;
				const isArchived = row.is_archived === '1' || row.is_archived === 'true' ? 1 : 0;
				
				if (shouldUseExistingId) {
					// Use REPLACE for sync with existing IDs
					db.run(`
						REPLACE INTO tasks (id, title, project, duration_minutes, date, status, category, notes, assignee_id, sprint_id, is_archived, created_at)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
					`, [
						rowId,
						row.title || '',
						row.project || '',
						parseInt(row.duration_minutes) || 0,
						row.date || new Date().toISOString().split('T')[0],
						row.status || 'todo',
						row.category || 'อื่นๆ',
						row.notes || '',
						assigneeId,
						sprintId,
						isArchived,
						row.created_at || new Date().toISOString()
					]);
				} else {
					// Always INSERT as new task (ignore ID from file)
					db.run(`
						INSERT INTO tasks (title, project, duration_minutes, date, status, category, notes, assignee_id, sprint_id, is_archived)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
					`, [
						row.title || '',
						row.project || '',
						parseInt(row.duration_minutes) || 0,
						row.date || new Date().toISOString().split('T')[0],
						row.status || 'todo',
						row.category || 'อื่นๆ',
						row.notes || '',
						assigneeId,
						sprintId,
						isArchived
					]);
				}
				tasksImported++;
			} catch (e) {
				console.warn('Failed to import task:', row, e);
			}
		}
		
		db.run('COMMIT');
		saveDatabase();
		
		console.log(`✅ Import complete: ${tasksImported} tasks, ${projectsImported} projects, ${assigneesImported} assignees, ${sprintRows.length} sprints`);
		
		return { tasks: tasksImported, projects: projectsImported, assignees: assigneesImported, sprints: sprintRows.length };
	} catch (e) {
		console.error('❌ Import failed, rolling back:', e);
		try {
			db.run('ROLLBACK');
		} catch (rollbackErr) {
			console.error('Rollback failed:', rollbackErr);
		}
		throw e;
	}
}

// Merge all data from server (smart merge)
export async function mergeAllData(csvContent: string): Promise<{ 
	tasks: { added: number; updated: number; unchanged: number };
	projects: { added: number; updated: number };
	assignees: { added: number; updated: number };
	sprints: { added: number; updated: number };
}> {
	if (!db) throw new Error('DB not initialized');
	
	const trimmed = csvContent.trim();
	if (!trimmed) {
		console.log('Empty CSV, nothing to merge');
		return { 
			tasks: { added: 0, updated: 0, unchanged: 0 },
			projects: { added: 0, updated: 0 },
			assignees: { added: 0, updated: 0 },
			sprints: { added: 0, updated: 0 }
		};
	}
	
	// Parse sections
	let currentSection: 'tasks' | 'projects' | 'assignees' | 'sprints' | null = null;
	let currentHeaders: string[] = [];
	
	const taskRows: Record<string, string>[] = [];
	const projectRows: Record<string, string>[] = [];
	const assigneeRows: Record<string, string>[] = [];
	const sprintRows: Record<string, string>[] = [];
	
	const lines = trimmed.split('\n');
	
	for (const line of lines) {
		const trimmedLine = line.trim();
		if (!trimmedLine) continue;
		
		if (trimmedLine.startsWith('# TASKS')) {
			currentSection = 'tasks';
			currentHeaders = [];
			continue;
		} else if (trimmedLine.startsWith('# PROJECTS')) {
			currentSection = 'projects';
			currentHeaders = [];
			continue;
		} else if (trimmedLine.startsWith('# ASSIGNEES')) {
			currentSection = 'assignees';
			currentHeaders = [];
			continue;
		} else if (trimmedLine.startsWith('# SPRINTS')) {
			currentSection = 'sprints';
			currentHeaders = [];
			continue;
		}
		
		if (!currentSection) continue;
		
		if (currentHeaders.length === 0) {
			currentHeaders = trimmedLine.split(',').map(h => h.trim());
			continue;
		}
		
		const values = parseCSVLine(trimmedLine);
		if (values.length !== currentHeaders.length) continue;
		
		const row: Record<string, string> = {};
		currentHeaders.forEach((h, idx) => row[h] = values[idx]);
		
		if (currentSection === 'tasks') taskRows.push(row);
		else if (currentSection === 'projects') projectRows.push(row);
		else if (currentSection === 'assignees') assigneeRows.push(row);
		else if (currentSection === 'sprints') sprintRows.push(row);
	}
	
	// If no sections found, treat as old format (tasks only)
	if (taskRows.length === 0 && projectRows.length === 0 && assigneeRows.length === 0) {
		const result = await mergeTasksFromCSV(csvContent);
		return {
			tasks: result,
			projects: { added: 0, updated: 0 },
			assignees: { added: 0, updated: 0 },
			sprints: { added: 0, updated: 0 }
		};
	}
	
	// Get existing data for comparison
	const existingProjects = new Map();
	const existingAssignees = new Map();
	const existingTasks = new Map();
	
	const projectsResult = execQuery('SELECT * FROM projects');
	for (const row of projectsResult.values) {
		const obj = Object.fromEntries(projectsResult.columns.map((col, i) => [col, row[i]]));
		existingProjects.set(obj.id, obj);
	}
	
	const assigneesResult = execQuery('SELECT * FROM assignees');
	for (const row of assigneesResult.values) {
		const obj = Object.fromEntries(assigneesResult.columns.map((col, i) => [col, row[i]]));
		existingAssignees.set(obj.id, obj);
	}
	
	const tasksResult = execQuery('SELECT * FROM tasks');
	for (const row of tasksResult.values) {
		const obj = Object.fromEntries(tasksResult.columns.map((col, i) => [col, row[i]]));
		existingTasks.set(obj.id, obj);
	}
	
	db.run('BEGIN TRANSACTION');
	
	try {
		let tasksAdded = 0, tasksUpdated = 0, tasksUnchanged = 0;
		let projectsAdded = 0, projectsUpdated = 0;
		let assigneesAdded = 0, assigneesUpdated = 0;
		
		// Merge projects
		for (const row of projectRows) {
			const serverId = row.id ? parseInt(row.id) : null;
			const existing = serverId ? existingProjects.get(serverId) : null;
			
			if (!existing) {
				try {
					db.run(`
						INSERT INTO projects (name, created_at)
						VALUES (?, ?)
					`, [row.name || '', row.created_at || new Date().toISOString()]);
					projectsAdded++;
				} catch (e) {
					console.warn('Failed to insert project:', e);
				}
			} else if (existing.name !== row.name) {
				try {
					db.run(`
						UPDATE projects SET name = ?, created_at = ? WHERE id = ?
					`, [row.name || '', row.created_at || existing.created_at, serverId]);
					projectsUpdated++;
				} catch (e) {
					console.warn('Failed to update project:', e);
				}
			}
			if (serverId) existingProjects.delete(serverId);
		}
		
		// Build assignee name to id map for lookup
		const assigneeNameToId = new Map<string, number>();
		for (const [id, assignee] of existingAssignees) {
			assigneeNameToId.set(assignee.name, id);
		}
		
		// Merge assignees from assignees section
		for (const row of assigneeRows) {
			const serverId = row.id ? parseInt(row.id) : null;
			const existing = serverId ? existingAssignees.get(serverId) : null;
			
			if (!existing) {
				try {
					db.run(`
						INSERT INTO assignees (name, color, created_at)
						VALUES (?, ?, ?)
					`, [row.name || '', row.color || '#6366F1', row.created_at || new Date().toISOString()]);
					// Update map
					const newIdResult = execQuery('SELECT last_insert_rowid() as id');
					const newId = newIdResult.values[0][0];
					assigneeNameToId.set(row.name || '', newId);
					assigneesAdded++;
				} catch (e) {
					console.warn('Failed to insert assignee:', e);
				}
			} else if (existing.name !== row.name || existing.color !== row.color) {
				try {
					db.run(`
						UPDATE assignees SET name = ?, color = ?, created_at = ? WHERE id = ?
					`, [
						row.name || '',
						row.color || '#6366F1',
						row.created_at || existing.created_at,
						serverId
					]);
					assigneesUpdated++;
				} catch (e) {
					console.warn('Failed to update assignee:', e);
				}
			}
			if (serverId) existingAssignees.delete(serverId);
		}
		
		// Merge sprints
		let sprintsAdded = 0, sprintsUpdated = 0;
		const existingSprints = new Map();
		if (typeof window !== 'undefined') {
			try {
				const saved = localStorage.getItem('sprints-data-v1');
				if (saved) {
					const sprints = JSON.parse(saved);
					for (const sprint of sprints) {
						existingSprints.set(sprint.id, sprint);
					}
				}
			} catch (e) {
				console.warn('Failed to load existing sprints:', e);
			}
		}
		
		for (const row of sprintRows) {
			const serverId = row.id ? parseInt(row.id) : null;
			const existing = serverId ? existingSprints.get(serverId) : null;
			
			if (!existing) {
				// New sprint
				const newSprint = {
					id: serverId || Date.now() + Math.floor(Math.random() * 1000),
					name: row.name || '',
					start_date: row.start_date || new Date().toISOString().split('T')[0],
					end_date: row.end_date || new Date().toISOString().split('T')[0],
					status: row.status || 'planned',
					created_at: row.created_at || new Date().toISOString()
				};
				existingSprints.set(newSprint.id, newSprint);
				sprintsAdded++;
			} else {
				// Check if different
				const isDifferent = 
					existing.name !== row.name ||
					existing.start_date !== row.start_date ||
					existing.end_date !== row.end_date ||
					existing.status !== row.status;
				
				if (isDifferent) {
					existing.name = row.name || existing.name;
					existing.start_date = row.start_date || existing.start_date;
					existing.end_date = row.end_date || existing.end_date;
					existing.status = row.status || existing.status;
					sprintsUpdated++;
				}
			}
		}
		
		// Save merged sprints back to localStorage
		if (sprintRows.length > 0 && typeof window !== 'undefined') {
			try {
				localStorage.setItem('sprints-data-v1', JSON.stringify(Array.from(existingSprints.values())));
				console.log(`✅ Merged sprints: +${sprintsAdded} ~${sprintsUpdated}`);
			} catch (e) {
				console.warn('Failed to save merged sprints:', e);
			}
		}
		
		// Helper function to resolve assignee_id from assignee_name
		function resolveAssigneeId(row: Record<string, string>): number | null {
			if (row.assignee_id) {
				return parseInt(row.assignee_id);
			}
			if (row.assignee_name && row.assignee_name.trim()) {
				const name = row.assignee_name.trim();
				const existingId = assigneeNameToId.get(name);
				if (existingId) {
					return existingId;
				}
				// Create new assignee
				try {
					db.run(`
						INSERT INTO assignees (name, color, created_at)
						VALUES (?, ?, ?)
					`, [name, '#6366F1', new Date().toISOString()]);
					const newIdResult = execQuery('SELECT last_insert_rowid() as id');
					const newId = newIdResult.values[0][0];
					assigneeNameToId.set(name, newId);
					assigneesAdded++;
					return newId;
				} catch (e) {
					console.warn('Failed to create assignee:', e);
				}
			}
			return null;
		}
		
		// Merge tasks (with assignee_name support)
		for (const row of taskRows) {
			const serverId = row.id ? parseInt(row.id) : null;
			const existing = serverId ? existingTasks.get(serverId) : null;
			const assigneeId = resolveAssigneeId(row);
			
			if (!existing) {
				try {
					db.run(`
						INSERT INTO tasks (title, project, duration_minutes, date, status, category, notes, assignee_id, sprint_id, is_archived, created_at)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
					`, [
						row.title || '',
						row.project || '',
						parseInt(row.duration_minutes) || 0,
						row.date || new Date().toISOString().split('T')[0],
						row.status || 'todo',
						row.category || 'อื่นๆ',
						row.notes || '',
						assigneeId,
						row.created_at || new Date().toISOString()
					]);
					tasksAdded++;
				} catch (e) {
					console.warn('Failed to insert task:', e);
				}
			} else {
				const isDifferent = 
					row.title !== existing.title ||
					row.status !== existing.status ||
					row.project !== existing.project ||
					(row.notes || '') !== (existing.notes || '') ||
					(row.sprint_id ? parseInt(row.sprint_id) : null) !== existing.sprint_id ||
					(row.is_archived === '1' || row.is_archived === 'true') !== (existing.is_archived === 1);
				
				const serverDate = new Date(row.created_at || 0).getTime();
				const localDate = new Date(existing.created_at || 0).getTime();
				
				if (isDifferent && serverDate >= localDate) {
					try {
						db.run(`
							UPDATE tasks 
							SET title = ?, project = ?, duration_minutes = ?, 
							    date = ?, status = ?, category = ?, notes = ?, 
							    assignee_id = ?, sprint_id = ?, is_archived = ?, created_at = ?
							WHERE id = ?
						`, [
							row.title || '',
							row.project || '',
							parseInt(row.duration_minutes) || 0,
							row.date || new Date().toISOString().split('T')[0],
							row.status || 'todo',
							row.category || 'อื่นๆ',
							row.notes || '',
							assigneeId,
							row.sprint_id ? parseInt(row.sprint_id) : null,
							row.is_archived === '1' || row.is_archived === 'true' ? 1 : 0,
							row.created_at || new Date().toISOString(),
							serverId
						]);
						tasksUpdated++;
					} catch (e) {
						console.warn('Failed to update task:', e);
					}
				} else {
					tasksUnchanged++;
				}
			}
			if (serverId) existingTasks.delete(serverId);
		}
		
		db.run('COMMIT');
		saveDatabase();
		
		console.log(`✅ Merge complete:`);
		console.log(`   Tasks: +${tasksAdded} ~${tasksUpdated} =${tasksUnchanged}`);
		console.log(`   Projects: +${projectsAdded} ~${projectsUpdated}`);
		console.log(`   Assignees: +${assigneesAdded} ~${assigneesUpdated}`);
		console.log(`   Sprints: +${sprintsAdded} ~${sprintsUpdated}`);
		
		return {
			tasks: { added: tasksAdded, updated: tasksUpdated, unchanged: tasksUnchanged },
			projects: { added: projectsAdded, updated: projectsUpdated },
			assignees: { added: assigneesAdded, updated: assigneesUpdated },
			sprints: { added: sprintsAdded, updated: sprintsUpdated }
		};
	} catch (e) {
		db.run('ROLLBACK');
		throw e;
	}
}
