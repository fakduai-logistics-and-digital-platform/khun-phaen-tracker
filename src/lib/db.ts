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
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (assignee_id) REFERENCES assignees(id)
		)
	`);
	
	// Try to add project column if table already exists without it
	try {
		db.run(`ALTER TABLE tasks ADD COLUMN project TEXT DEFAULT ''`);
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
		`INSERT INTO tasks (title, project, duration_minutes, date, status, category, notes, assignee_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			task.title,
			task.project || '',
			task.duration_minutes,
			task.date,
			task.status,
			task.category || 'อื่นๆ',
			task.notes || '',
			task.assignee_id || null
		]
	);
	
	saveDatabase();
}

export async function updateTask(id: number, updates: Partial<Task>): Promise<void> {
	if (!db) throw new Error('DB not initialized');
	
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
	
	if (sets.length === 0) return;
	
	values.push(id);
	
	db.run(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, values);
	saveDatabase();
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
	if (filter?.status && filter.status !== 'all') {
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
	if (filter?.assignee_id && filter.assignee_id !== 'all') {
		if (filter.assignee_id === null) {
			query += ` AND t.assignee_id IS NULL`;
		} else {
			query += ` AND t.assignee_id = ?`;
			params.push(filter.assignee_id);
		}
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
			assignee: obj.a_id ? {
				id: obj.a_id as number,
				name: obj.a_name as string,
				color: obj.a_color as string,
				created_at: obj.a_created_at as string
			} : null,
			created_at: obj.created_at as string
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
		assignee: obj.a_id ? {
			id: obj.a_id as number,
			name: obj.a_name as string,
			color: obj.a_color as string,
			created_at: obj.a_created_at as string
		} : null,
		created_at: obj.created_at as string
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
	
	const headers = ['id', 'title', 'project', 'duration_minutes', 'date', 'status', 'category', 'notes', 'assignee_id', 'created_at'];
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
						REPLACE INTO tasks (id, title, project, duration_minutes, date, status, category, notes, assignee_id, created_at)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
						row.created_at || new Date().toISOString()
					]);
				} else {
					db.run(`
						INSERT INTO tasks (title, project, duration_minutes, date, status, category, notes, assignee_id)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?)
					`, [
						row.title || '',
						row.project || '',
						parseInt(row.duration_minutes) || 0,
						row.date || new Date().toISOString().split('T')[0],
						row.status || 'todo',
						row.category || 'อื่นๆ',
						row.notes || '',
						row.assignee_id ? parseInt(row.assignee_id) : null
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
						INSERT INTO tasks (title, project, duration_minutes, date, status, category, notes, assignee_id, created_at)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
					`, [
						row.title || '',
						row.project || '',
						parseInt(row.duration_minutes) || 0,
						row.date || new Date().toISOString().split('T')[0],
						row.status || 'todo',
						row.category || 'อื่นๆ',
						row.notes || '',
						row.assignee_id ? parseInt(row.assignee_id) : null,
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
				
				// Check if content is different
				const isDifferent = 
					row.title !== existing.title ||
					row.status !== existing.status ||
					row.project !== existing.project ||
					(row.notes || '') !== (existing.notes || '');
				
				if (isDifferent && serverDate >= localDate) {
					// Server version is newer or same age but different - update
					try {
						db.run(`
							UPDATE tasks 
							SET title = ?, project = ?, duration_minutes = ?, 
							    date = ?, status = ?, category = ?, notes = ?, 
							    assignee_id = ?, created_at = ?
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
