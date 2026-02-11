<script lang="ts">
	import { onMount } from 'svelte';
	import type { Task, Project, Assignee, ViewMode, FilterOptions } from '$lib/types';
	import { getTasks, getTasksBySprint, addTask, updateTask, deleteTask, getStats, exportToCSV, importFromCSV, exportAllData, importAllData, mergeAllData, getCategories, getAssignees, getProjects, getProjectsList, addProject, updateProject, deleteProject, getProjectStats, addAssignee as addAssigneeDB, getAssigneeStats, updateAssignee, deleteAssignee, archiveTasksBySprint } from '$lib/db';
	import TaskForm from '$lib/components/TaskForm.svelte';
	import TaskList from '$lib/components/TaskList.svelte';
	import CalendarView from '$lib/components/CalendarView.svelte';
	import KanbanBoard from '$lib/components/KanbanBoard.svelte';
	import TableView from '$lib/components/TableView.svelte';
	import StatsPanel from '$lib/components/StatsPanel.svelte';
	import ExportImport from '$lib/components/ExportImport.svelte';
	import WorkerManager from '$lib/components/WorkerManager.svelte';
	import ProjectManager from '$lib/components/ProjectManager.svelte';
	import { List, CalendarDays, Columns3, Table, Filter, Search, Plus, Users, Folder, Sparkles, Settings2, Flag } from 'lucide-svelte';
	import { initWasmSearch, indexTasks, performSearch, clearSearch, searchQuery, wasmReady, wasmLoading } from '$lib/stores/search';
	import { compressionReady, compressionStats, getStorageInfo } from '$lib/stores/storage';
	import { enableAutoImport, setMergeCallback } from '$lib/stores/server-sync';
	import { Zap } from 'lucide-svelte';
	import ServerSyncPanel from '$lib/components/ServerSyncPanel.svelte';
	import { tabSettings, type TabId } from '$lib/stores/tabSettings';
	import TabSettings from '$lib/components/TabSettings.svelte';
	import { sprints, type Sprint } from '$lib/stores/sprintStore';
	import SprintManager from '$lib/components/SprintManager.svelte';
	import SearchableSprintSelect from '$lib/components/SearchableSprintSelect.svelte';
	
	const FILTER_STORAGE_KEY = 'task-filters';
	const DEFAULT_FILTERS: FilterOptions = {
		startDate: '',
		endDate: '',
		status: 'all',
		category: 'all',
		project: 'all',
		assignee_id: 'all',
		sprint_id: 'all',
		search: ''
	};
	
	let tasks: Task[] = [];
	let sprintManagerTasks: Task[] = [];
	let filteredTasks: Task[] = [];
	let categories: string[] = [];
	let projects: string[] = [];
	let projectList: Project[] = [];
	let projectStats: { id: number; taskCount: number }[] = [];
	let assignees: Assignee[] = [];
	let workerStats: { id: number; taskCount: number }[] = [];
	let stats = { total: 0, todo: 0, in_progress: 0, done: 0, total_minutes: 0 };
	const VIEW_MODE_STORAGE_KEY = 'khunphaen-view-mode';
	
	function loadSavedViewMode(): ViewMode {
		if (typeof localStorage === 'undefined') return 'list';
		const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
		if (saved && ['list', 'calendar', 'kanban', 'table'].includes(saved)) {
			return saved as ViewMode;
		}
		return 'list';
	}
	
	function saveViewMode(view: ViewMode) {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(VIEW_MODE_STORAGE_KEY, view);
	}
	
	let currentView: ViewMode = loadSavedViewMode();
	let editingTask: Task | null = null;
	let showForm = false;
	let showFilters = false;
	let showWorkerManager = false;
	let showProjectManager = false;
	let searchInput = '';
	let showTabSettings = false;
	let showSprintManager = false;
	
	let filters: FilterOptions = { ...DEFAULT_FILTERS };
	let selectedSprint: Sprint | null = null;
	// Show all sprints including completed ones in dropdown
	
	// Save view mode when it changes
	$: saveViewMode(currentView);
	
	let message = '';
	let messageType: 'success' | 'error' = 'success';

	function normalizeSprintFilterValue(value: FilterOptions['sprint_id']): FilterOptions['sprint_id'] {
		if (value === undefined || value === 'all' || value === null) return value ?? 'all';
		return $sprints.some((sprint) => sprint.id === value) ? value : 'all';
	}
	
	onMount(() => {
		// Enable auto-import for server sync (before any connection)
		enableAutoImport();
		
		// Set merge callback for manual sync
		setMergeCallback(async (csvData: string) => {
			console.log('🔄 Merging data from server...');
			const result = await mergeAllData(csvData);
			console.log('✅ Merge result:', result);
			
			// Reload data to show merged results
			await loadData();
			
			// Refresh sprints from localStorage
			sprints.refresh();
			
			// Show message
			showMessage(`Merge สำเร็จ: เพิ่ม ${result.tasks.added} งาน, ${result.projects.added} โปรเจค, ${result.assignees.added} ผู้รับผิดชอบ, ${result.sprints.added} Sprint`);
			
			return result;
		});
		
		restoreFilters();
		
		// Load data (SQL.js only, WASM search/compression disabled for memory)
		loadData().then(() => {
			initWasmSearch(); // JS search, no delay needed
		});
	});
	
	async function loadData() {
		try {
			const [visibleTasks, allTasks] = await Promise.all([
				getTasks(filters),
				getTasks()
			]);
			tasks = visibleTasks;
			sprintManagerTasks = allTasks;
			
			// Index tasks for WASM search
			if ($wasmReady) {
				indexTasks(tasks);
			}
			
			// Apply WASM search if there's a search query
			if ($wasmReady && $searchQuery.trim()) {
				filteredTasks = performSearch($searchQuery, tasks);
			} else {
				filteredTasks = tasks;
			}
			
			stats = await getStats();
			categories = await getCategories();
			projects = await getProjects();
			projectList = await getProjectsList();
			projectStats = await getProjectStats();
			assignees = await getAssignees();
			workerStats = await getAssigneeStats();
		} catch (e) {
			showMessage('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
		}
	}
	
	// Handle search input
	function handleSearchInput(event: Event) {
		const target = event.target as HTMLInputElement;
		searchInput = target.value;
		searchQuery.set(searchInput);
		
		if ($wasmReady) {
			filteredTasks = performSearch(searchInput, tasks);
		} else {
			// Fallback to client-side filter
			filters.search = searchInput;
			loadData();
		}
	}
	
	// Clear search
	function handleClearSearch() {
		searchInput = '';
		clearSearch([]);
		filteredTasks = tasks;
	}
	
	// Worker Management Functions
	async function handleAddWorker(event: CustomEvent<{ name: string; color: string }>) {
		try {
			await addAssigneeDB({ name: event.detail.name, color: event.detail.color });
			await loadData();
			showMessage('เพิ่มผู้รับผิดชอบสำเร็จ');
		} catch (e) {
			showMessage('เกิดข้อผิดพลาดในการเพิ่มผู้รับผิดชอบ', 'error');
		}
	}
	
	async function handleUpdateWorker(event: CustomEvent<{ id: number; name: string; color: string }>) {
		try {
			await updateAssignee(event.detail.id, { name: event.detail.name, color: event.detail.color });
			await loadData();
			showMessage('แก้ไขผู้รับผิดชอบสำเร็จ');
		} catch (e) {
			showMessage('เกิดข้อผิดพลาดในการแก้ไข', 'error');
		}
	}
	
	async function handleDeleteWorker(event: CustomEvent<number>) {
		try {
			await deleteAssignee(event.detail);
			await loadData();
			showMessage('ลบผู้รับผิดชอบสำเร็จ');
		} catch (e) {
			showMessage('เกิดข้อผิดพลาดในการลบ', 'error');
		}
	}
	
	// Project Management Functions
	async function handleAddProject(event: CustomEvent<{ name: string }>) {
		try {
			await addProject({ name: event.detail.name });
			await loadData();
			showMessage('เพิ่มโปรเจคสำเร็จ');
		} catch (e) {
			showMessage('เกิดข้อผิดพลาดในการเพิ่มโปรเจค', 'error');
		}
	}
	
	async function handleUpdateProject(event: CustomEvent<{ id: number; name: string }>) {
		try {
			await updateProject(event.detail.id, { name: event.detail.name });
			await loadData();
			showMessage('แก้ไขโปรเจคสำเร็จ');
		} catch (e) {
			showMessage('เกิดข้อผิดพลาดในการแก้ไขโปรเจค', 'error');
		}
	}
	
	async function handleDeleteProject(event: CustomEvent<number>) {
		try {
			await deleteProject(event.detail);
			await loadData();
			showMessage('ลบโปรเจคสำเร็จ');
		} catch (e) {
			showMessage('เกิดข้อผิดพลาดในการลบโปรเจค', 'error');
		}
	}
	
	function showMessage(msg: string, type: 'success' | 'error' = 'success') {
		message = msg;
		messageType = type;
		setTimeout(() => message = '', 3000);
	}

	function applySprintUpdateToLocalState(taskIds: number[], sprintId: number | null) {
		if (taskIds.length === 0) return;
		const taskIdSet = new Set(taskIds);

		const updateTaskSprint = (task: Task): Task => {
			if (task.id === undefined || !taskIdSet.has(task.id)) return task;
			return { ...task, sprint_id: sprintId };
		};

		tasks = tasks.map(updateTaskSprint);
		sprintManagerTasks = sprintManagerTasks.map(updateTaskSprint);
		filteredTasks = filteredTasks.map(updateTaskSprint);
	}
	
	async function handleCompleteSprint(event: CustomEvent<number>) {
		const sprintId = event.detail;
		try {
			// Archive completed tasks
			const archivedCount = await archiveTasksBySprint(sprintId);
			
			// Move incomplete tasks out of sprint (set sprint_id to null)
			const sprintTasks = await getTasksBySprint(sprintId);
			const incompleteTasks = sprintTasks.filter(t => t.status !== 'done');
			for (const task of incompleteTasks) {
				await updateTask(task.id!, { sprint_id: null });
			}
			
			// Update sprint with archived count
			sprints.update(sprintId, { 
				status: 'completed',
				archived_count: archivedCount 
			});

			// Reset sprint filter if selected sprint has just been completed
			if (filters.sprint_id === sprintId) {
				filters = { ...filters, sprint_id: 'all' };
				persistFilters();
			}
			
			await loadData();
			showMessage(`จบ Sprint สำเร็จ: Archive ${archivedCount} งาน, นำ ${incompleteTasks.length} งานที่ไม่เสร็จออกจาก Sprint`);
		} catch (e) {
			showMessage('เกิดข้อผิดพลาดในการจบ Sprint', 'error');
		}
	}

	async function handleMoveTasksToSprint(event: CustomEvent<{ sprintId: number; taskIds: number[] }>) {
		const { sprintId, taskIds } = event.detail;
		const newSprintId = sprintId === -1 ? null : sprintId;

		// Optimistic update so sprint dialog stats change immediately.
		applySprintUpdateToLocalState(taskIds, newSprintId);

		try {
			let movedCount = 0;
			for (const taskId of taskIds) {
				await updateTask(taskId, { sprint_id: newSprintId });
				movedCount++;
			}
			await loadData();
			if (sprintId === -1) {
				showMessage(`นำ ${movedCount} งานออกจาก Sprint แล้ว`);
			} else {
				showMessage(`ย้าย ${movedCount} งานเข้า Sprint ใหม่แล้ว`);
			}
		} catch (e) {
			await loadData();
			showMessage('เกิดข้อผิดพลาดในการย้ายงาน', 'error');
		}
	}

	async function handleDeleteSprint(event: CustomEvent<number>) {
		const sprintId = event.detail;
		try {
			const sprintTasks = await getTasksBySprint(sprintId);
			const taskIds = sprintTasks
				.map((task) => task.id)
				.filter((id): id is number => id !== undefined);

			if (taskIds.length > 0) {
				await handleMoveTasksToSprint(
					new CustomEvent('moveTasksToSprint', {
						detail: { sprintId: -1, taskIds }
					})
				);
			} else {
				await loadData();
			}
		} catch (e) {
			showMessage('เกิดข้อผิดพลาดในการอัปเดตงานหลังลบ Sprint', 'error');
		}
	}
	
	async function handleAddTask(event: CustomEvent<Omit<Task, 'id' | 'created_at'>>) {
		try {
			if (editingTask) {
				await updateTask(editingTask.id!, event.detail);
				showMessage('แก้ไขงานสำเร็จ');
				editingTask = null;
			} else {
				await addTask(event.detail);
				showMessage('เพิ่มงานสำเร็จ');
			}
			await loadData();
			showForm = false;
		} catch (e) {
			showMessage('เกิดข้อผิดพลาด', 'error');
		}
	}
	
	async function handleAddAssignee(event: CustomEvent<{ name: string; color: string }>) {
		try {
			await addAssigneeDB({ name: event.detail.name, color: event.detail.color });
			assignees = await getAssignees();
			showMessage('เพิ่มผู้รับผิดชอบสำเร็จ');
		} catch (e) {
			showMessage('เกิดข้อผิดพลาดในการเพิ่มผู้รับผิดชอบ', 'error');
		}
	}
	
	async function handleDeleteTask(event: CustomEvent<number>) {
		const id = event.detail;
		if (!confirm('คุณแน่ใจหรือไม่ที่จะลบงานนี้?')) return;
		try {
			await deleteTask(id);
			await loadData();
			showMessage('ลบงานสำเร็จ');
		} catch (e) {
			showMessage('เกิดข้อผิดพลาด', 'error');
		}
	}

	async function handleDeleteSelectedTasks(event: CustomEvent<number[]>) {
		const ids = event.detail;
		if (ids.length === 0) return;
		if (!confirm(`คุณแน่ใจหรือไม่ที่จะลบงานที่เลือก ${ids.length} รายการ?`)) return;

		try {
			const deleteResults = await Promise.allSettled(ids.map(id => deleteTask(id)));
			const deletedCount = deleteResults.filter(result => result.status === 'fulfilled').length;
			const failedCount = ids.length - deletedCount;

			await loadData();

			if (failedCount === 0) {
				showMessage(`ลบงานสำเร็จ ${deletedCount} รายการ`);
			} else {
				showMessage(`ลบสำเร็จ ${deletedCount} รายการ, ล้มเหลว ${failedCount} รายการ`, 'error');
			}
		} catch (e) {
			showMessage('เกิดข้อผิดพลาดในการลบหลายรายการ', 'error');
		}
	}
	
	function handleEditTask(event: CustomEvent<Task>) {
		editingTask = event.detail;
		showForm = true;
	}
	
	function cancelEdit() {
		editingTask = null;
		showForm = false;
	}
	
	async function handleStatusChange(event: CustomEvent<{ id: number; status: Task['status'] }>) {
		try {
			await updateTask(event.detail.id, { status: event.detail.status });
			await loadData();
		} catch (e) {
			showMessage('เกิดข้อผิดพลาด', 'error');
		}
	}
	
	async function handleKanbanMove(event: CustomEvent<{ id: number; newStatus: Task['status'] }>) {
		await handleStatusChange(new CustomEvent('statusChange', { 
			detail: { id: event.detail.id, status: event.detail.newStatus } 
		}));
	}
	
	async function handleExportCSV() {
		try {
			const csv = await exportAllData();
			// Add BOM for UTF-8 support in Excel
			const BOM = '\uFEFF';
			const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
			const link = document.createElement('a');
			const url = URL.createObjectURL(blob);
			link.setAttribute('href', url);
			const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		const hours = String(now.getHours()).padStart(2, '0');
		const minutes = String(now.getMinutes()).padStart(2, '0');
		const seconds = String(now.getSeconds()).padStart(2, '0');
		const dateStr = `${year}-${month}-${day}`;
		const timeStr = `${hours}-${minutes}-${seconds}`;
		link.setAttribute('download', `tasks_${dateStr}_${timeStr}.csv`);
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			showMessage('ส่งออก CSV สำเร็จ (รวมโปรเจคและผู้รับผิดชอบ)');
		} catch (e) {
			showMessage('เกิดข้อผิดพลาดในการส่งออก', 'error');
		}
	}
	
	function handleExportPDF() {
		try {
			// Create HTML content for PDF with Thai font support
			const htmlContent = `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="UTF-8">
					<style>
						@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;700&display=swap');
						* { margin: 0; padding: 0; box-sizing: border-box; }
						body { 
							font-family: 'Noto Sans Thai', sans-serif; 
							padding: 40px; 
							font-size: 12px;
							line-height: 1.6;
						}
						.header { margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
						.header h1 { font-size: 24px; font-weight: 700; margin-bottom: 10px; }
						.header .meta { color: #666; font-size: 11px; }
						.stats { display: flex; gap: 30px; margin-bottom: 20px; font-size: 11px; }
						.stats .stat { background: #f5f5f5; padding: 10px 15px; border-radius: 5px; }
						.stats .stat-label { color: #666; font-size: 10px; }
						.stats .stat-value { font-weight: 600; font-size: 14px; }
						table { width: 100%; border-collapse: collapse; margin-top: 20px; }
						th, td { 
							border: 1px solid #ddd; 
							padding: 10px; 
							text-align: left; 
							font-size: 11px;
						}
						th { background: #f5f5f5; font-weight: 600; }
						tr:nth-child(even) { background: #fafafa; }
						.status { 
							display: inline-block; 
							padding: 3px 8px; 
							border-radius: 3px; 
							font-size: 10px;
							font-weight: 600;
						}
						.status-done { background: #dcfce7; color: #166534; }
						.status-in-progress { background: #dbeafe; color: #1e40af; }
						.status-todo { background: #f3f4f6; color: #374151; }
						.footer { margin-top: 30px; text-align: center; color: #999; font-size: 10px; }
					</style>
				</head>
				<body>
					<div class="header">
						<h1>รายงานงาน (Task Report)</h1>
						<div class="meta">
							สร้างเมื่อ: ${new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}<br>
							ระบบ: Khu Phaen Task Tracker
						</div>
					</div>
					
					<div class="stats">
						<div class="stat">
							<div class="stat-label">จำนวนงานทั้งหมด</div>
							<div class="stat-value">${stats.total} งาน</div>
						</div>
						<div class="stat">
							<div class="stat-label">เวลารวม</div>
							<div class="stat-value">${(stats.total_minutes / 60).toFixed(1)} ชั่วโมง</div>
						</div>
						<div class="stat">
							<div class="stat-label">Man-days</div>
							<div class="stat-value">${(stats.total_minutes / 60 / 8).toFixed(2)} วัน</div>
						</div>
					</div>
					
					<table>
						<thead>
							<tr>
								<th style="width: 5%">#</th>
								<th style="width: 35%">ชื่องาน</th>
								<th style="width: 15%">โปรเจค</th>
								<th style="width: 12%">หมวดหมู่</th>
								<th style="width: 10%">สถานะ</th>
								<th style="width: 13%">วันที่</th>
								<th style="width: 10%">เวลา</th>
							</tr>
						</thead>
						<tbody>
							${tasks.map((task, i) => {
								const statusClass = task.status === 'done' ? 'status-done' : 
													task.status === 'in-progress' ? 'status-in-progress' : 'status-todo';
								const statusText = task.status === 'done' ? 'เสร็จแล้ว' : 
													task.status === 'in-progress' ? 'กำลังทำ' : 'รอดำเนินการ';
								const hours = Math.floor(task.duration_minutes / 60);
								const mins = task.duration_minutes % 60;
								const timeStr = task.duration_minutes > 0 ? 
									(hours > 0 ? `${hours}ชม ` : '') + (mins > 0 ? `${mins}น` : '') : '-';
								return `
								<tr>
									<td>${i + 1}</td>
									<td>${task.title}</td>
									<td>${task.project || '-'}</td>
									<td>${task.category || 'อื่นๆ'}</td>
									<td><span class="status ${statusClass}">${statusText}</span></td>
									<td>${new Date(task.date).toLocaleDateString('th-TH')}</td>
									<td>${timeStr}</td>
								</tr>
								`;
							}).join('')}
						</tbody>
					</table>
					
					<div class="footer">
						© ${new Date().getFullYear()} Khu Phaen Task Tracker - สร้างด้วยความภาคภูมิใจ
					</div>
				</body>
				</html>
			`;
			
			// Open print dialog with Thai support
			const printWindow = window.open('', '_blank');
			if (printWindow) {
				printWindow.document.write(htmlContent);
				printWindow.document.close();
				
				// Wait for font to load then print
				setTimeout(() => {
					printWindow.print();
					// Close window after print (optional)
					// printWindow.close();
				}, 1000);
				
				showMessage('เปิดหน้าต่างพิมพ์ PDF แล้ว (เลือก "Save as PDF")');
			} else {
				showMessage('กรุณาอนุญาตให้เปิดหน้าต่างใหม่', 'error');
			}
		} catch (e) {
			console.error('PDF Export Error:', e);
			showMessage('เกิดข้อผิดพลาดในการส่งออก', 'error');
		}
	}
	
	async function handleImportCSV(event: CustomEvent<string>) {
		try {
			console.log('📥 Starting import...');
			const beforeStats = await getStats();
			console.log('📊 Before import:', beforeStats);
			
			const result = await importAllData(event.detail, { clearExisting: false });
			console.log('✅ Import result:', result);
			
			// Clear filters to show all imported data
			filters = { ...DEFAULT_FILTERS };
			searchInput = '';
			clearSearch([]);
			
			// Force reload with small delay to ensure DB is saved
			await new Promise(r => setTimeout(r, 100));
			await loadData();
			
			const afterStats = await getStats();
			console.log('📊 After import:', afterStats);
			
			// Refresh sprints from localStorage
			sprints.refresh();
			
			const actualAdded = afterStats.total - beforeStats.total;
			showMessage(`นำเข้าสำเร็จ ${result.tasks} งาน (เพิ่มใหม่ ${actualAdded} งาน), ${result.projects} โปรเจค, ${result.assignees} ผู้รับผิดชอบ, ${result.sprints} sprint`);
		} catch (e) {
			console.error('❌ Import error:', e);
			showMessage('เกิดข้อผิดพลาดในการนำเข้า: ' + (e instanceof Error ? e.message : 'Unknown error'), 'error');
		}
	}

	function persistFilters() {
		if (typeof localStorage === 'undefined') return;
		const assigneeValue = filters.assignee_id === undefined ? 'all' : filters.assignee_id;
		const sprintValue = filters.sprint_id === undefined ? 'all' : filters.sprint_id;
		const data = {
			startDate: filters.startDate || '',
			endDate: filters.endDate || '',
			status: filters.status || 'all',
			category: filters.category || 'all',
			project: filters.project || 'all',
			assignee_id: assigneeValue,
			sprint_id: sprintValue
		};
		localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(data));
	}

	function restoreFilters() {
		if (typeof localStorage === 'undefined') return;
		const raw = localStorage.getItem(FILTER_STORAGE_KEY);
		if (!raw) return;
		
		try {
			const saved = JSON.parse(raw) as Partial<FilterOptions>;
			filters = {
				...DEFAULT_FILTERS,
				startDate: saved.startDate ?? '',
				endDate: saved.endDate ?? '',
				status: saved.status ?? 'all',
				category: saved.category ?? 'all',
				project: saved.project ?? 'all',
				assignee_id: saved.assignee_id !== undefined ? saved.assignee_id : 'all',
				sprint_id: normalizeSprintFilterValue(saved.sprint_id)
			};
		} catch {
			localStorage.removeItem(FILTER_STORAGE_KEY);
		}
	}
	
	function clearSavedFilters() {
		if (typeof localStorage === 'undefined') return;
		localStorage.removeItem(FILTER_STORAGE_KEY);
	}
	
	function applyFilters() {
		filters = {
			...filters,
			sprint_id: normalizeSprintFilterValue(filters.sprint_id)
		};
		persistFilters();
		loadData();
	}
	
	function clearFilters() {
		filters = { ...DEFAULT_FILTERS };
		clearSavedFilters();
		loadData();
	}
</script>

<!-- Message Toast -->
{#if message}
	<div class="fixed top-20 right-4 z-50 animate-fade-in">
		<div class="{messageType === 'success' ? 'bg-success' : 'bg-danger'} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
			{#if messageType === 'success'}
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
			{:else}
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
			{/if}
			{message}
		</div>
	</div>
{/if}

<div class="space-y-6">
	<!-- Stats Panel -->
	<StatsPanel {stats} />
	
	<!-- Search Bar - Always Visible -->
	<div class="flex flex-col sm:flex-row gap-3">
		<div class="flex-1 relative">
			<Search size={18} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
			<input
				type="text"
				value={searchInput}
				on:input={handleSearchInput}
				placeholder="ค้นหางาน..."
				class="w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-gray-700 dark:text-white text-base"
			/>
			{#if searchInput}
				<button
					on:click={handleClearSearch}
					class="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full transition-colors text-lg"
				>
					×
				</button>
			{:else}
				<span 
					class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600 flex items-center gap-0.5"
					title="WASM Full-text Search Active"
				>
					{#if $wasmLoading}
						<span class="text-gray-400">⏳</span>
					{:else if $wasmReady}
						
						<span></span>
					{/if}
				</span>
			{/if}
		</div>
		
		<div class="flex gap-2">
			<!-- Filter Toggle -->
			<button
				on:click={() => showFilters = !showFilters}
				class="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors {showFilters ? 'bg-gray-100 dark:bg-gray-700' : ''}"
			>
				<Filter size={16} />
				<span class="hidden sm:inline">ตัวกรอง</span>
			</button>

			<!-- Worker Management -->
			<button
				on:click={() => showWorkerManager = true}
				class="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
			>
				<Users size={16} />
				<span class="hidden sm:inline">ทีมงาน</span>
			</button>

			<!-- Project Management -->
			<button
				on:click={() => showProjectManager = true}
				class="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
			>
				<Folder size={16} />
				<span class="hidden sm:inline">โปรเจค</span>
			</button>
			
			<!-- Sprint Management -->
			<button
				on:click={() => showSprintManager = true}
				class="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
			>
				<Flag size={16} />
				<span class="hidden sm:inline">Sprint</span>
			</button>
			
			<ExportImport
				on:exportCSV={handleExportCSV}
				on:exportPDF={handleExportPDF}
				on:importCSV={handleImportCSV}
			/>
			
			<!-- Server Sync Panel -->
			<ServerSyncPanel 
				on:dataImported={async (e) => {
					console.log('🔄 Data imported from sync, reloading...');
					await loadData();
					showMessage(`ซิงค์สำเร็จ ${e.detail.count} รายการ`);
				}}
				on:error={(e) => {
					console.error('Sync error:', e.detail.message);
					showMessage('ซิงค์ล้มเหลว: ' + e.detail.message);
				}}
			/>
		</div>
	</div>
	
	{#if $wasmReady && searchInput}
		<div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 -mt-4">
			<Sparkles size={14} class="text-green-500" />
			<span>พบ {filteredTasks.length} รายการ จากการค้นหา "{searchInput}"</span>
			<button 
				on:click={handleClearSearch}
				class="text-primary hover:underline ml-2"
			>
				ล้างการค้นหา
			</button>
		</div>
	{/if}

	<!-- View Tabs -->
	<div class="flex flex-col sm:flex-row gap-2">
		<div class="flex-1 flex p-1 bg-gray-100 dark:bg-gray-800 rounded-lg transition-colors">
			{#each $tabSettings as tab (tab.id)}
				<button
					on:click={() => currentView = tab.id}
					class="flex-1 flex items-center justify-center gap-2 px-2 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors {currentView === tab.id ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}"
				>
					{#if tab.icon === 'List'}
						<List size={16} />
					{:else if tab.icon === 'CalendarDays'}
						<CalendarDays size={16} />
					{:else if tab.icon === 'Columns3'}
						<Columns3 size={16} />
					{:else if tab.icon === 'Table'}
						<Table size={16} />
					{/if}
					<span class="hidden sm:inline">{tab.label}</span>
				</button>
			{/each}
		</div>
		
		<!-- Tab Settings -->
		<div class="relative">
			<button
				on:click={() => showTabSettings = !showTabSettings}
				class="flex items-center justify-center gap-2 px-4 py-2 h-10 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
				title="ตั้งค่าแท็บ"
			>
				<Settings2 size={16} />
			</button>
			
			{#if showTabSettings}
				<div class="absolute top-full right-0 mt-2 z-50">
					<TabSettings 
						on:close={() => showTabSettings = false}
						on:save={() => showTabSettings = false}
					/>
				</div>
			{/if}
		</div>
		
		<button
			on:click={() => { showForm = !showForm; editingTask = null; }}
			class="flex items-center justify-center gap-2 px-4 py-2 h-10 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors sm:w-auto w-full"
		>
			<Plus size={18} />
			<span class="hidden sm:inline">เพิ่มงาน</span>
		</button>
	</div>
	<!-- Filters Panel -->
	{#if showFilters}
		<div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 space-y-4 transition-colors">
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

				<div>
					<label for="startDate" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date ตั้งแต่</label>
					<input
						id="startDate"
						type="date"
						bind:value={filters.startDate}
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
					/>
				</div>

				<div>
					<label for="endDate" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date ถึง</label>
					<input
						id="endDate"
						type="date"
						bind:value={filters.endDate}
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
					/>
				</div>

				<div>
					<label for="status" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">สถานะ</label>
					<select
						id="status"
						bind:value={filters.status}
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
					>
						<option value="all">ทั้งหมด</option>
						<option value="todo">รอดำเนินการ</option>
						<option value="in-progress">กำลังทำ</option>
						<option value="done">เสร็จแล้ว</option>
						<option value="archived">Archived (Sprint เก่า)</option>
					</select>
				</div>

				<div>
					<label for="category" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">หมวดหมู่</label>
					<select
						id="category"
						bind:value={filters.category}
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
					>
						<option value="all">ทั้งหมด</option>
						{#each categories as cat}
							<option value={cat}>{cat}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="project" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">โปรเจค</label>
					<select
						id="project"
						bind:value={filters.project}
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
					>
						<option value="all">ทั้งหมด</option>
						{#each projects as proj}
							<option value={proj}>{proj}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="assignee" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ผู้รับผิดชอบ</label>
					<select
						id="assignee"
						bind:value={filters.assignee_id}
						class="w-full h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
					>
						<option value="all">ทั้งหมด</option>
						<option value={null}>ไม่ระบุผู้รับผิดชอบ</option>
						{#each assignees as assignee}
							<option value={assignee.id}>{assignee.name}</option>
						{/each}
					</select>
				</div>
				
				<div>
					<label for="sprint" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sprint</label>
					<SearchableSprintSelect
						id="sprint"
						sprints={$sprints}
						bind:value={filters.sprint_id}
					/>
				</div>
			</div>

			<div class="flex justify-end gap-2">
				<button
					on:click={applyFilters}
					class="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors"
				>
					ใช้ตัวกรอง
				</button>
				<button
					on:click={clearFilters}
					class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
				>
					ล้าง
				</button>
			</div>
		</div>
	{/if}
	
	<!-- Task Form -->
	<TaskForm
		show={showForm}
		{editingTask}
		{assignees}
		projects={projectList}
		sprints={$sprints}
		on:submit={handleAddTask}
		on:close={cancelEdit}
		on:addAssignee={handleAddAssignee}
	/>
	
	<!-- Views -->
	<div class="mt-6">
		{#if currentView === 'list'}
			<TaskList
				tasks={filteredTasks}
				sprints={$sprints}
				on:edit={handleEditTask}
				on:delete={handleDeleteTask}
				on:statusChange={handleStatusChange}
			/>
		{:else if currentView === 'calendar'}
			<CalendarView
				tasks={filteredTasks}
				on:selectTask={handleEditTask}
			/>
		{:else if currentView === 'kanban'}
			<KanbanBoard
				tasks={filteredTasks}
				sprints={$sprints}
				on:move={handleKanbanMove}
				on:edit={handleEditTask}
				on:delete={handleDeleteTask}
			/>
		{:else if currentView === 'table'}
			<TableView
				tasks={filteredTasks}
				sprints={$sprints}
				on:edit={handleEditTask}
				on:delete={handleDeleteTask}
				on:deleteSelected={handleDeleteSelectedTasks}
				on:statusChange={handleStatusChange}
			/>
		{/if}
	</div>

	<!-- Worker Manager Modal -->
	{#if showWorkerManager}
		<WorkerManager
			{assignees}
			{workerStats}
			on:close={() => showWorkerManager = false}
			on:add={handleAddWorker}
			on:update={handleUpdateWorker}
			on:delete={handleDeleteWorker}
		/>
	{/if}
	
	<!-- Sprint Manager Modal -->
	{#if showSprintManager}
		<SprintManager
			tasks={sprintManagerTasks}
			on:close={() => showSprintManager = false}
			on:complete={handleCompleteSprint}
			on:deleteSprint={handleDeleteSprint}
			on:moveTasksToSprint={handleMoveTasksToSprint}
		/>
	{/if}
	
	<!-- Project Manager Modal -->
	{#if showProjectManager}
		<ProjectManager
			projects={projectList}
			{projectStats}
			on:close={() => showProjectManager = false}
			on:add={handleAddProject}
			on:update={handleUpdateProject}
			on:delete={handleDeleteProject}
		/>
	{/if}
</div>

<style>
	@keyframes fade-in {
		from { opacity: 0; transform: translateY(-10px); }
		to { opacity: 1; transform: translateY(0); }
	}
	
	.animate-fade-in {
		animation: fade-in 0.3s ease-out;
	}
</style>
