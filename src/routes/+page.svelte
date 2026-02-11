<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Task, Project, Assignee, ViewMode, FilterOptions } from '$lib/types';
	import { getTasks, getTasksBySprint, addTask, updateTask, deleteTask, getStats, exportToCSV, importFromCSV, importAllData, mergeAllData, getCategories, getAssignees, getProjects, getProjectsList, addProject, updateProject, deleteProject, getProjectStats, addAssignee as addAssigneeDB, getAssigneeStats, updateAssignee, deleteAssignee, archiveTasksBySprint, exportFilteredSQLiteBinary } from '$lib/db';
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
	import { theme } from '$lib/stores/theme';
	import TabSettings from '$lib/components/TabSettings.svelte';
	import { sprints, type Sprint } from '$lib/stores/sprintStore';
	import SprintManager from '$lib/components/SprintManager.svelte';
	import SearchableSprintSelect from '$lib/components/SearchableSprintSelect.svelte';
	import SearchableSelect from '$lib/components/SearchableSelect.svelte';
	import CustomDatePicker from '$lib/components/CustomDatePicker.svelte';
	import { showKeyboardShortcuts } from '$lib/stores/keyboardShortcuts';
	import QRExportModal from '$lib/components/QRExportModal.svelte';
	import MonthlySummaryCharts from '$lib/components/MonthlySummaryCharts.svelte';
	import { toPng } from 'html-to-image';
	import * as XLSX from 'xlsx';

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
	let monthlySummaryTasks: Task[] = [];
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
	let showMonthlySummary = false;
	let monthlySummaryRef: HTMLDivElement;
	let searchInput = '';
	let showTabSettings = false;
	let showSprintManager = false;
	let showChangeSprintModal = false;
	let selectedTaskIdsForSprintChange: number[] = [];
	let showQRExport = false;
	let qrExportTasks: Task[] = [];
	let searchInputRef: HTMLInputElement;

	let filters: FilterOptions = { ...DEFAULT_FILTERS };
	let selectedSprint: Sprint | null = null;
	// Show all sprints including completed ones in dropdown

	// Save view mode when it changes
	$: saveViewMode(currentView);

	let message = '';
	let messageType: 'success' | 'error' = 'success';
	let videoExportInProgress = false;
	let videoExportPercent = 0;
	let videoExportElapsedMs = 0;
	let videoExportTimer: ReturnType<typeof setInterval> | null = null;

	function normalizeSprintFilterValue(value: FilterOptions['sprint_id']): FilterOptions['sprint_id'] {
		if (value === undefined || value === 'all' || value === null) return value ?? 'all';
		return $sprints.some((sprint) => sprint.id === value) ? value : 'all';
	}

	// Keyboard shortcuts handler
	function handleKeydown(event: KeyboardEvent) {
		// Ignore if user is typing in an input/textarea
		const target = event.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
			// Allow Escape to close modals even when in input
			if (event.key === 'Escape') {
				if (showForm) {
					showForm = false;
					editingTask = null;
					event.preventDefault();
					return;
				}
				if (showFilters) {
					showFilters = false;
					event.preventDefault();
					return;
				}
				if (showMonthlySummary) {
					showMonthlySummary = false;
					event.preventDefault();
					return;
				}
				if (showWorkerManager) {
					showWorkerManager = false;
					event.preventDefault();
					return;
				}
				if (showProjectManager) {
					showProjectManager = false;
					event.preventDefault();
					return;
				}
				if (showSprintManager) {
					showSprintManager = false;
					event.preventDefault();
					return;
				}
			}
			return;
		}

		switch (event.key) {
			case '/':
				event.preventDefault();
				searchInputRef?.focus();
				break;
			case 'n':
			case 'N':
				event.preventDefault();
				showForm = true;
				editingTask = null;
				break;
			case 'Escape':
				if (showForm) {
					showForm = false;
					editingTask = null;
				} else if (showFilters) {
					showFilters = false;
				} else if (showMonthlySummary) {
					showMonthlySummary = false;
				} else if (showWorkerManager) {
					showWorkerManager = false;
				} else if (showProjectManager) {
					showProjectManager = false;
				} else if (showSprintManager) {
					showSprintManager = false;
				} else if (showTabSettings) {
					showTabSettings = false;
				}
				break;
			case '?':
				event.preventDefault();
				$showKeyboardShortcuts = true;
				break;
			case '1':
				event.preventDefault();
				currentView = $tabSettings[0]?.id || 'list';
				break;
			case '2':
				event.preventDefault();
				currentView = $tabSettings[1]?.id || 'calendar';
				break;
			case '3':
				event.preventDefault();
				currentView = $tabSettings[2]?.id || 'kanban';
				break;
			case '4':
				event.preventDefault();
				currentView = $tabSettings[3]?.id || 'table';
				break;
			case 'f':
			case 'F':
				event.preventDefault();
				showFilters = !showFilters;
				break;
			case 't':
			case 'T':
				event.preventDefault();
				theme.toggle();
				break;
		}
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

		// Add keyboard shortcuts listener
		document.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		document.removeEventListener('keydown', handleKeydown);
	});
	
	async function loadData() {
		try {
			const [visibleTasks, allTasks, allTasksIncludingArchived] = await Promise.all([
				getTasks(filters),
				getTasks(),
				getTasks({ includeArchived: true })
			]);
			tasks = visibleTasks;
			sprintManagerTasks = allTasks;
			monthlySummaryTasks = allTasksIncludingArchived;
			
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

	function formatElapsedTime(ms: number): string {
		const totalSeconds = Math.max(0, Math.floor(ms / 1000));
		const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
		const seconds = String(totalSeconds % 60).padStart(2, '0');
		return `${minutes}:${seconds}`;
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
	
	async function handleCompleteSprint(event: CustomEvent<number>): Promise<boolean> {
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
			return true;
		} catch (e) {
			showMessage('เกิดข้อผิดพลาดในการจบ Sprint', 'error');
			return false;
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

	function handleExportQR(event: CustomEvent<number[]>) {
		const ids = event.detail;
		if (ids.length === 0) return;
		qrExportTasks = tasks.filter(t => t.id != null && ids.includes(t.id));
		showQRExport = true;
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
			const { taskSnapshot, relatedProjects, relatedAssignees, relatedSprints } = getFilteredExportContext();
			const csv = buildCsvFromSnapshot(taskSnapshot, relatedProjects, relatedAssignees, relatedSprints);
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
			showMessage('ส่งออก CSV สำเร็จ (ตามข้อมูลที่กรอง/ที่เห็น)');
		} catch (e) {
			showMessage('เกิดข้อผิดพลาดในการส่งออก', 'error');
		}
	}

	function csvEscape(value: unknown): string {
		if (value === null || value === undefined) return '';
		const str = String(value);
		if (str.includes(',') || str.includes('"') || str.includes('\n')) {
			return `"${str.replace(/"/g, '""')}"`;
		}
		return str;
	}

	function getFilteredExportContext() {
		const taskSnapshot = [...tasks];
		const visibleAssigneeIds = new Set(taskSnapshot.map((task) => task.assignee_id).filter((id): id is number => id !== null && id !== undefined));
		const visibleProjectNames = new Set(taskSnapshot.map((task) => (task.project || '').trim()).filter((name) => name.length > 0));
		const visibleSprintIds = new Set(taskSnapshot.map((task) => task.sprint_id).filter((id): id is number => id !== null && id !== undefined));

		const relatedAssignees = assignees.filter((assignee) => assignee.id !== undefined && visibleAssigneeIds.has(assignee.id));
		const relatedProjects = projectList.filter((project) => visibleProjectNames.has(project.name));
		const relatedSprints = $sprints.filter((sprint) => sprint.id !== undefined && visibleSprintIds.has(sprint.id));

		return { taskSnapshot, relatedProjects, relatedAssignees, relatedSprints };
	}

	function buildCsvFromSnapshot(
		taskSnapshot: Task[],
		relatedProjects: Project[],
		relatedAssignees: Assignee[],
		relatedSprints: Sprint[]
	): string {
		const rows: string[] = [];
		const taskHeaders = ['id', 'title', 'project', 'duration_minutes', 'date', 'status', 'category', 'notes', 'assignee_id', 'assignee_name', 'sprint_id', 'is_archived', 'created_at', 'updated_at'];
		rows.push('# TASKS');
		rows.push(taskHeaders.join(','));
		for (const task of taskSnapshot) {
			const assigneeName = task.assignee?.name || relatedAssignees.find((a) => a.id === task.assignee_id)?.name || '';
			const taskRow: Record<string, unknown> = {
				id: task.id,
				title: task.title,
				project: task.project,
				duration_minutes: task.duration_minutes,
				date: task.date,
				status: task.status,
				category: task.category,
				notes: task.notes,
				assignee_id: task.assignee_id,
				assignee_name: assigneeName,
				sprint_id: task.sprint_id,
				is_archived: task.is_archived ? 1 : 0,
				created_at: task.created_at,
				updated_at: task.updated_at
			};
			rows.push(taskHeaders.map((h) => csvEscape(taskRow[h])).join(','));
		}

		rows.push('');
		rows.push('# PROJECTS');
		const projectHeaders = ['id', 'name', 'created_at'];
		rows.push(projectHeaders.join(','));
		for (const project of relatedProjects) {
			rows.push(projectHeaders.map((h) => csvEscape((project as unknown as Record<string, unknown>)[h])).join(','));
		}

		rows.push('');
		rows.push('# ASSIGNEES');
		const assigneeHeaders = ['id', 'name', 'color', 'created_at'];
		rows.push(assigneeHeaders.join(','));
		for (const assignee of relatedAssignees) {
			rows.push(assigneeHeaders.map((h) => csvEscape((assignee as unknown as Record<string, unknown>)[h])).join(','));
		}

		rows.push('');
		rows.push('# SPRINTS');
		const sprintHeaders = ['id', 'name', 'start_date', 'end_date', 'status', 'created_at'];
		rows.push(sprintHeaders.join(','));
		for (const sprint of relatedSprints) {
			rows.push(sprintHeaders.map((h) => csvEscape((sprint as unknown as Record<string, unknown>)[h])).join(','));
		}

		return rows.join('\n');
	}

	function formatExportTimestamp(now = new Date()) {
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		const hours = String(now.getHours()).padStart(2, '0');
		const minutes = String(now.getMinutes()).padStart(2, '0');
		const seconds = String(now.getSeconds()).padStart(2, '0');
		return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
	}

	function downloadBlob(fileName: string, blob: Blob) {
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);
		link.setAttribute('href', url);
		link.setAttribute('download', fileName);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}

	function escapePostgresString(value: string): string {
		return value.replace(/'/g, "''");
	}

	function toPostgresValue(value: unknown): string {
		if (value === null || value === undefined) return 'NULL';
		if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
		if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
		return `'${escapePostgresString(String(value))}'`;
	}

	function buildPostgresSqlFromSnapshot(
		taskSnapshot: Task[],
		relatedProjects: Project[],
		relatedAssignees: Assignee[],
		relatedSprints: Sprint[]
	): string {
		const sql: string[] = [
			'-- PostgreSQL export generated by task-tracker-offline',
			'BEGIN;',
			'',
			'CREATE TABLE IF NOT EXISTS projects (',
			'  id INTEGER PRIMARY KEY,',
			'  name TEXT NOT NULL,',
			'  created_at TEXT',
			');',
			'',
			'CREATE TABLE IF NOT EXISTS assignees (',
			'  id INTEGER PRIMARY KEY,',
			'  name TEXT NOT NULL,',
			'  color TEXT,',
			'  created_at TEXT',
			');',
			'',
			'CREATE TABLE IF NOT EXISTS sprints (',
			'  id INTEGER PRIMARY KEY,',
			'  name TEXT NOT NULL,',
			'  start_date TEXT,',
			'  end_date TEXT,',
			'  status TEXT,',
			'  created_at TEXT',
			');',
			'',
			'CREATE TABLE IF NOT EXISTS tasks (',
			'  id INTEGER PRIMARY KEY,',
			'  title TEXT NOT NULL,',
			'  project TEXT,',
			'  duration_minutes INTEGER DEFAULT 0,',
			'  date TEXT,',
			'  status TEXT,',
			'  category TEXT,',
			'  notes TEXT,',
			'  assignee_id INTEGER,',
			'  sprint_id INTEGER,',
			'  is_archived BOOLEAN DEFAULT FALSE,',
			'  created_at TEXT,',
			'  updated_at TEXT',
			');',
			''
		];

		for (const project of relatedProjects) {
			sql.push(
				`INSERT INTO projects (id, name, created_at) VALUES (${toPostgresValue(project.id)}, ${toPostgresValue(project.name)}, ${toPostgresValue(project.created_at)}) ON CONFLICT (id) DO NOTHING;`
			);
		}

		for (const assignee of relatedAssignees) {
			sql.push(
				`INSERT INTO assignees (id, name, color, created_at) VALUES (${toPostgresValue(assignee.id)}, ${toPostgresValue(assignee.name)}, ${toPostgresValue(assignee.color)}, ${toPostgresValue(assignee.created_at)}) ON CONFLICT (id) DO NOTHING;`
			);
		}

		for (const sprint of relatedSprints) {
			sql.push(
				`INSERT INTO sprints (id, name, start_date, end_date, status, created_at) VALUES (${toPostgresValue(sprint.id)}, ${toPostgresValue(sprint.name)}, ${toPostgresValue(sprint.start_date)}, ${toPostgresValue(sprint.end_date)}, ${toPostgresValue(sprint.status)}, ${toPostgresValue(sprint.created_at)}) ON CONFLICT (id) DO NOTHING;`
			);
		}

		for (const task of taskSnapshot) {
			sql.push(
				`INSERT INTO tasks (id, title, project, duration_minutes, date, status, category, notes, assignee_id, sprint_id, is_archived, created_at, updated_at) VALUES (${toPostgresValue(task.id)}, ${toPostgresValue(task.title)}, ${toPostgresValue(task.project)}, ${toPostgresValue(task.duration_minutes)}, ${toPostgresValue(task.date)}, ${toPostgresValue(task.status)}, ${toPostgresValue(task.category)}, ${toPostgresValue(task.notes)}, ${toPostgresValue(task.assignee_id)}, ${toPostgresValue(task.sprint_id)}, ${toPostgresValue(!!task.is_archived)}, ${toPostgresValue(task.created_at)}, ${toPostgresValue(task.updated_at)}) ON CONFLICT (id) DO NOTHING;`
			);
		}

		sql.push('', 'COMMIT;');
		return sql.join('\n');
	}

	async function handleExportDatabase(
		event: CustomEvent<{
			database: 'SQLite' | 'MongoDB/NoSQL' | 'PostgreSQL';
			extensions: string[];
			primaryExtension: string;
			note: string;
		}>
	) {
		const { database } = event.detail;
		const timestamp = formatExportTimestamp();

		try {
			if (database === 'SQLite') {
				const visibleTaskIds = tasks
					.map((task) => task.id)
					.filter((id): id is number => id !== null && id !== undefined);
				const binary = await exportFilteredSQLiteBinary(visibleTaskIds);
				const sqliteBytes = new Uint8Array(binary);
				downloadBlob(`tasks_${timestamp}.sqlite`, new Blob([sqliteBytes], { type: 'application/vnd.sqlite3' }));
				showMessage('ส่งออก SQLite สำเร็จ (.sqlite ตาม filter)');
				return;
			}

			const { taskSnapshot, relatedProjects, relatedAssignees, relatedSprints } = getFilteredExportContext();
			if (database === 'PostgreSQL') {
				const sqlScript = buildPostgresSqlFromSnapshot(taskSnapshot, relatedProjects, relatedAssignees, relatedSprints);
				downloadBlob(`tasks_${timestamp}_postgres.sql`, new Blob([sqlScript], { type: 'application/sql;charset=utf-8' }));
				showMessage('ส่งออก PostgreSQL สำเร็จ (.sql ตาม filter)');
				return;
			}

			const payload = {
				meta: {
					exported_at: new Date().toISOString(),
					source: 'task-tracker-offline',
					format: 'document',
					scope: 'filtered-visible'
				},
				tasks: taskSnapshot,
				projects: relatedProjects,
				assignees: relatedAssignees,
				sprints: relatedSprints
			};
			downloadBlob(
				`tasks_${timestamp}.json`,
				new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
			);
			showMessage('ส่งออก MongoDB/NoSQL สำเร็จ (.json ตาม filter)');
		} catch (e) {
			console.error('Database export failed:', e);
			showMessage('ส่งออกฐานข้อมูลล้มเหลว', 'error');
		}
	}

	function formatDateISO(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function sanitizeMarkdownText(text: string): string {
		return text.replace(/\r?\n/g, ' ').trim();
	}

	function escapeMarkdownInline(text: string): string {
		return text.replace(/([\\`*_{}[\]()#+\-.!|>~])/g, '\\$1');
	}

	function normalizeTaskDate(dateText: string | undefined): string {
		if (!dateText) return '-';
		const isoMatch = dateText.match(/^(\d{4}-\d{2}-\d{2})/);
		if (isoMatch) return isoMatch[1];
		const parsed = new Date(dateText);
		return Number.isNaN(parsed.getTime()) ? '-' : formatDateISO(parsed);
	}

	function sortTasksForReport(list: Task[]): Task[] {
		return [...list].sort((a, b) => {
			const dateCompare = normalizeTaskDate(a.date).localeCompare(normalizeTaskDate(b.date));
			if (dateCompare !== 0) return dateCompare;
			const idA = a.id ?? Number.MAX_SAFE_INTEGER;
			const idB = b.id ?? Number.MAX_SAFE_INTEGER;
			if (idA !== idB) return idA - idB;
			return (a.title || '').localeCompare(b.title || '', 'th');
		});
	}

	async function getExportTaskContext(event?: CustomEvent<number | void>): Promise<{
		taskSnapshot: Task[];
		scopeLabel: string;
	}> {
		const sprintId = typeof event?.detail === 'number' ? event.detail : undefined;
		if (!sprintId) {
			return { taskSnapshot: [...tasks], scopeLabel: 'ข้อมูลปัจจุบันทั้งหมด' };
		}

		const sprintTasks = await getTasksBySprint(sprintId);
		const archivedTasks = sprintTasks.filter((task) => task.is_archived);
		const sprintName = $sprints.find((sprint) => sprint.id === sprintId)?.name || `Sprint ${sprintId}`;
		return {
			taskSnapshot: archivedTasks,
			scopeLabel: `${sprintName} (Archived)`
		};
	}

	function getMonthlyExportTaskContext(): { taskSnapshot: Task[]; scopeLabel: string } {
		return {
			taskSnapshot: monthlySummaryTasks.filter((task) => isWithinLastDays(task.date, 30)),
			scopeLabel: `สรุปรายเดือน (${monthlySummary.periodLabel})`
		};
	}

	function buildTaskReportHtml(taskSnapshot: Task[], scopeLabel: string): string {
		const totalMinutes = taskSnapshot.reduce((sum, task) => sum + (task.duration_minutes || 0), 0);
		const totalTasks = taskSnapshot.length;
		return `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8">
				<style>
					@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;700&display=swap');
					* { margin: 0; padding: 0; box-sizing: border-box; }
					body { font-family: 'Noto Sans Thai', sans-serif; padding: 40px; font-size: 12px; line-height: 1.6; }
					.header { margin-bottom: 24px; border-bottom: 2px solid #334155; padding-bottom: 16px; }
					.header h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
					.meta { color: #64748b; font-size: 11px; }
					.stats { display: flex; gap: 16px; margin-bottom: 20px; }
					.stat { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; min-width: 130px; }
					.stat-label { color: #64748b; font-size: 10px; }
					.stat-value { font-weight: 700; font-size: 14px; color: #0f172a; }
					table { width: 100%; border-collapse: collapse; margin-top: 12px; }
					th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; font-size: 11px; }
					th { background: #f8fafc; font-weight: 700; }
					tr:nth-child(even) { background: #f8fafc; }
				</style>
			</head>
			<body>
				<div class="header">
					<h1>รายงานงาน (Task Report)</h1>
					<div class="meta">ช่วงข้อมูล: ${scopeLabel}<br>สร้างเมื่อ: ${new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
				</div>
				<div class="stats">
					<div class="stat"><div class="stat-label">จำนวนงานทั้งหมด</div><div class="stat-value">${totalTasks} งาน</div></div>
					<div class="stat"><div class="stat-label">เวลารวม</div><div class="stat-value">${(totalMinutes / 60).toFixed(1)} ชั่วโมง</div></div>
					<div class="stat"><div class="stat-label">Man-days</div><div class="stat-value">${(totalMinutes / 60 / 8).toFixed(2)} วัน</div></div>
				</div>
				<table>
					<thead>
						<tr><th>#</th><th>ชื่องาน</th><th>โปรเจค</th><th>ผู้รับผิดชอบ</th><th>สถานะ</th><th>วันที่</th><th>เวลา</th></tr>
					</thead>
					<tbody>
						${taskSnapshot.map((task, i) => {
							const hours = Math.floor((task.duration_minutes || 0) / 60);
							const mins = (task.duration_minutes || 0) % 60;
							const timeStr = task.duration_minutes > 0 ? `${hours > 0 ? `${hours}ชม ` : ''}${mins > 0 ? `${mins}น` : ''}` : '-';
							const statusText = task.status === 'done' ? 'เสร็จแล้ว' : task.status === 'in-progress' ? 'กำลังทำ' : 'รอดำเนินการ';
							return `<tr><td>${i + 1}</td><td>${task.title || '-'}</td><td>${task.project || '-'}</td><td>${task.assignee?.name || '-'}</td><td>${statusText}</td><td>${normalizeTaskDate(task.date)}</td><td>${timeStr}</td></tr>`;
						}).join('')}
					</tbody>
				</table>
			</body>
			</html>
		`;
	}

	async function handleExportMarkdown(event?: CustomEvent<number | void>, contextOverride?: { taskSnapshot: Task[]; scopeLabel: string }) {
		try {
			const today = new Date();
			const reportDate = formatDateISO(today);
			const { taskSnapshot, scopeLabel } = contextOverride || await getExportTaskContext(event);

			if (event?.detail && taskSnapshot.length === 0) {
				showMessage('Sprint นี้ยังไม่มีงานที่ Archive สำหรับส่งออก', 'error');
				return;
			}

			const doneTasks = sortTasksForReport(taskSnapshot.filter((task) => task.status === 'done'));
			const inProgressTasks = sortTasksForReport(taskSnapshot.filter((task) => task.status === 'in-progress'));
			const todoTasks = sortTasksForReport(taskSnapshot.filter((task) => task.status === 'todo'));
			const unknownStatusTasks = sortTasksForReport(
				taskSnapshot.filter((task) => task.status !== 'done' && task.status !== 'in-progress' && task.status !== 'todo')
			);

			const taskLine = (task: Task, done = false) => {
				const title = escapeMarkdownInline(sanitizeMarkdownText(task.title || 'ไม่ระบุชื่องาน'));
				const project = escapeMarkdownInline(sanitizeMarkdownText(task.project || '-'));
				const assignee = escapeMarkdownInline(sanitizeMarkdownText(task.assignee?.name || 'ไม่ระบุ'));
				const dateText = normalizeTaskDate(task.date);
				if (done) {
					return `- [x] ${title} (${project}) - ผู้รับผิดชอบ: ${assignee} - ${dateText}`;
				}
				return `- [ ] ${title} (${project}) - ผู้รับผิดชอบ: ${assignee} - Due: ${dateText}`;
			};

			const markdown = [
				`# Task Report - ${reportDate}`,
				'',
				'## 📊 สถิติ',
				`- ช่วงข้อมูล: ${scopeLabel}`,
				`- งานทั้งหมด: ${taskSnapshot.length} งาน`,
				`- เสร็จแล้ว: ${doneTasks.length} งาน`,
				`- กำลังทำ: ${inProgressTasks.length} งาน`,
				`- รอดำเนินการ: ${todoTasks.length} งาน`,
				'',
				'## 📋 รายการงาน',
				'',
				'### ✅ เสร็จแล้ว',
				...(doneTasks.length > 0 ? doneTasks.map((task) => taskLine(task, true)) : ['- ไม่มีงาน']),
				'',
				'### 🔄 กำลังทำ',
				...(inProgressTasks.length > 0 ? inProgressTasks.map((task) => taskLine(task)) : ['- ไม่มีงาน']),
				'',
				'### ⏳ รอดำเนินการ',
				...(todoTasks.length > 0 ? todoTasks.map((task) => taskLine(task)) : ['- ไม่มีงาน']),
				...(unknownStatusTasks.length > 0
					? [
							'',
							'### ❓ สถานะอื่นๆ',
							...unknownStatusTasks.map((task) => taskLine(task))
						]
					: [])
			].join('\n');

			const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
			const link = document.createElement('a');
			const url = URL.createObjectURL(blob);
			link.setAttribute('href', url);

			const hours = String(today.getHours()).padStart(2, '0');
			const minutes = String(today.getMinutes()).padStart(2, '0');
			const seconds = String(today.getSeconds()).padStart(2, '0');
			link.setAttribute('download', `task_report_${reportDate}_${hours}-${minutes}-${seconds}.md`);

			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);

			showMessage('ส่งออก Markdown สำเร็จ');
		} catch (e) {
			console.error('Markdown Export Error:', e);
			showMessage('เกิดข้อผิดพลาดในการส่งออก Markdown', 'error');
		}
	}

	interface VideoSlide {
		kicker: string;
		title: string;
		subtitle: string;
		accent: string;
		lines: string[];
	}

	function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
		const words = text.split(' ');
		const lines: string[] = [];
		let current = '';

		for (const word of words) {
			const next = current ? `${current} ${word}` : word;
			if (ctx.measureText(next).width <= maxWidth) {
				current = next;
			} else {
				if (current) lines.push(current);
				current = word;
			}
		}

		if (current) lines.push(current);
		return lines.length > 0 ? lines : [text];
	}

	function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.lineTo(x + w - r, y);
		ctx.quadraticCurveTo(x + w, y, x + w, y + r);
		ctx.lineTo(x + w, y + h - r);
		ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
		ctx.lineTo(x + r, y + h);
		ctx.quadraticCurveTo(x, y + h, x, y + h - r);
		ctx.lineTo(x, y + r);
		ctx.quadraticCurveTo(x, y, x + r, y);
		ctx.closePath();
	}

	function renderVideoSlide(
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number,
		slide: VideoSlide,
		progress: number
	): void {
		const reveal = Math.min(Math.max(progress / 0.6, 0), 1);
		const sway = Math.sin(progress * Math.PI * 2) * 6;
		const bg = ctx.createLinearGradient(0, 0, width, height);
		bg.addColorStop(0, '#041228');
		bg.addColorStop(0.6, '#0f2347');
		bg.addColorStop(1, '#091735');
		ctx.fillStyle = bg;
		ctx.fillRect(0, 0, width, height);

		const orb = ctx.createRadialGradient(width * 0.8, height * 0.15, 40, width * 0.8, height * 0.15, 380);
		orb.addColorStop(0, `${slide.accent}AA`);
		orb.addColorStop(1, '#00000000');
		ctx.fillStyle = orb;
		ctx.fillRect(0, 0, width, height);

		ctx.globalAlpha = 0.3;
		ctx.strokeStyle = '#ffffff22';
		for (let i = 0; i < 10; i++) {
			const y = 80 + i * 64 + sway;
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(width, y);
			ctx.stroke();
		}
		ctx.globalAlpha = 1;

		const cardX = 84;
		const cardY = 92;
		const cardW = width - 168;
		const cardH = height - 184;
		drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 28);
		ctx.fillStyle = '#0b1f3ecc';
		ctx.fill();
		ctx.strokeStyle = '#ffffff2a';
		ctx.lineWidth = 1.2;
		ctx.stroke();

		ctx.fillStyle = slide.accent;
		ctx.font = '700 24px "Trebuchet MS", "Noto Sans Thai", sans-serif';
		ctx.fillText(slide.kicker, cardX + 46, cardY + 54);

		ctx.fillStyle = '#ffffff';
		ctx.font = '700 58px "Trebuchet MS", "Noto Sans Thai", sans-serif';
		ctx.globalAlpha = reveal;
		ctx.fillText(slide.title, cardX + 46, cardY + 132);
		ctx.globalAlpha = 0.92 * reveal;
		ctx.font = '400 27px "Trebuchet MS", "Noto Sans Thai", sans-serif';
		ctx.fillStyle = '#d8e7ff';
		ctx.fillText(slide.subtitle, cardX + 46, cardY + 174);

		ctx.globalAlpha = reveal;
		ctx.font = '500 30px "Trebuchet MS", "Noto Sans Thai", sans-serif';
		ctx.fillStyle = '#ecf2ff';
		let y = cardY + 250;
		for (const line of slide.lines.slice(0, 8)) {
			const wrapped = wrapText(ctx, line, cardW - 96);
			for (const part of wrapped.slice(0, 2)) {
				ctx.fillText(part, cardX + 52, y);
				y += 40;
			}
			y += 8;
			if (y > cardY + cardH - 40) break;
		}
		ctx.globalAlpha = 1;
	}

	async function handleExportVideo(event?: CustomEvent<number | void>) {
		try {
			if (typeof MediaRecorder === 'undefined') {
				showMessage('เบราว์เซอร์นี้ยังไม่รองรับการส่งออกวิดีโอ', 'error');
				return;
			}

			const now = new Date();
			const reportDate = formatDateISO(now);
			const { taskSnapshot, scopeLabel } = await getExportTaskContext(event);
			if (event?.detail && taskSnapshot.length === 0) {
				showMessage('Sprint นี้ยังไม่มีงานที่ Archive สำหรับส่งออก', 'error');
				return;
			}
			const doneTasks = sortTasksForReport(taskSnapshot.filter((task) => task.status === 'done'));
			const inProgressTasks = sortTasksForReport(taskSnapshot.filter((task) => task.status === 'in-progress'));
			const todoTasks = sortTasksForReport(taskSnapshot.filter((task) => task.status === 'todo'));

			const summarize = (task: Task): string => {
				const title = sanitizeMarkdownText(task.title || 'ไม่ระบุชื่องาน');
				const assignee = sanitizeMarkdownText(task.assignee?.name || 'ไม่ระบุ');
				return `• ${title} (${assignee})`;
			};

			const slides: VideoSlide[] = [
				{
					kicker: 'TASK REPORT VIDEO',
					title: `รายงานงาน ${reportDate}`,
					subtitle: 'Khu Phaen Task Tracker',
					accent: '#35d4ff',
					lines: [
						`ช่วงข้อมูล ${scopeLabel}`,
						`งานทั้งหมด ${taskSnapshot.length} งาน`,
						`เสร็จแล้ว ${doneTasks.length} งาน`,
						`กำลังทำ ${inProgressTasks.length} งาน`,
						`รอดำเนินการ ${todoTasks.length} งาน`
					]
				},
				{
					kicker: 'SUMMARY',
					title: 'ภาพรวมความคืบหน้า',
					subtitle: `Done ${doneTasks.length}/${taskSnapshot.length} tasks`,
					accent: '#5ff290',
					lines: [
						`เปอร์เซ็นต์สำเร็จ ${taskSnapshot.length > 0 ? Math.round((doneTasks.length / taskSnapshot.length) * 100) : 0}%`,
						`เวลารวม ${(stats.total_minutes / 60).toFixed(1)} ชั่วโมง`,
						`Man-days ${(stats.total_minutes / 60 / 8).toFixed(2)} วัน`,
						`ส่งออกเมื่อ ${reportDate}`
					]
				},
				{
					kicker: 'DONE',
					title: 'งานที่เสร็จแล้ว',
					subtitle: `${doneTasks.length} รายการ`,
					accent: '#64ffa8',
					lines: doneTasks.length > 0 ? doneTasks.slice(0, 6).map(summarize) : ['• ไม่มีงานในหมวดนี้']
				},
				{
					kicker: 'IN PROGRESS',
					title: 'งานที่กำลังทำ',
					subtitle: `${inProgressTasks.length} รายการ`,
					accent: '#6ec7ff',
					lines: inProgressTasks.length > 0 ? inProgressTasks.slice(0, 6).map(summarize) : ['• ไม่มีงานในหมวดนี้']
				},
				{
					kicker: 'TODO',
					title: 'งานรอดำเนินการ',
					subtitle: `${todoTasks.length} รายการ`,
					accent: '#ffd470',
					lines: todoTasks.length > 0 ? todoTasks.slice(0, 6).map(summarize) : ['• ไม่มีงานในหมวดนี้']
				}
			];

			const canvas = document.createElement('canvas');
			canvas.width = 1280;
			canvas.height = 720;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				showMessage('ไม่สามารถสร้าง canvas สำหรับวิดีโอได้', 'error');
				return;
			}

			const fps = 30;
			const slideDuration = 2.8;
			const transitionDuration = 0.6;
			const totalDuration = slides.length * slideDuration;
			const totalFrames = Math.ceil(totalDuration * fps);
			const stream = canvas.captureStream(fps);
			const exportStart = performance.now();
			videoExportInProgress = true;
			videoExportPercent = 0;
			videoExportElapsedMs = 0;
			if (videoExportTimer) clearInterval(videoExportTimer);
			videoExportTimer = setInterval(() => {
				videoExportElapsedMs = performance.now() - exportStart;
			}, 200);

			const mimeType =
				MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' :
				MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' :
				'video/webm';
			const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
			const chunks: Blob[] = [];

			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) chunks.push(event.data);
			};

			const stopPromise = new Promise<void>((resolve) => {
				recorder.onstop = () => resolve();
			});

			recorder.start();

			for (let frame = 0; frame < totalFrames; frame++) {
				const t = frame / fps;
				const slideIndex = Math.min(Math.floor(t / slideDuration), slides.length - 1);
				const localT = t - slideIndex * slideDuration;
				const progress = Math.min(localT / slideDuration, 1);
				renderVideoSlide(ctx, canvas.width, canvas.height, slides[slideIndex], progress);

				if (localT > slideDuration - transitionDuration && slideIndex < slides.length - 1) {
					const blend = (localT - (slideDuration - transitionDuration)) / transitionDuration;
					ctx.globalAlpha = Math.min(Math.max(blend, 0), 1);
					renderVideoSlide(ctx, canvas.width, canvas.height, slides[slideIndex + 1], 0);
					ctx.globalAlpha = 1;
				}
				videoExportPercent = Math.min(100, Math.round(((frame + 1) / totalFrames) * 100));

				await new Promise((resolve) => setTimeout(resolve, 1000 / fps));
			}

			await new Promise((resolve) => setTimeout(resolve, 120));
			recorder.stop();
			await stopPromise;
			stream.getTracks().forEach((track) => track.stop());

			const blob = new Blob(chunks, { type: mimeType });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
			link.href = url;
			link.download = `task_report_${reportDate}_${timeStr}.webm`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);

			videoExportPercent = 100;
			videoExportElapsedMs = performance.now() - exportStart;
			videoExportInProgress = false;
			if (videoExportTimer) {
				clearInterval(videoExportTimer);
				videoExportTimer = null;
			}
			showMessage('ส่งออกวิดีโอสำเร็จ');
		} catch (error) {
			console.error('Video export failed:', error);
			videoExportInProgress = false;
			if (videoExportTimer) {
				clearInterval(videoExportTimer);
				videoExportTimer = null;
			}
			showMessage('ส่งออกวิดีโอไม่สำเร็จ กรุณาลองใหม่', 'error');
		}
	}

	async function handleCompleteAndExport(event: CustomEvent<{ sprintId: number; format: 'markdown' | 'video' }>) {
		const { sprintId, format } = event.detail;
		const completed = await handleCompleteSprint(new CustomEvent('complete', { detail: sprintId }));
		if (!completed) return;
		if (format === 'markdown') {
			await handleExportMarkdown(new CustomEvent('exportMarkdown', { detail: sprintId }));
		} else {
			await handleExportVideo(new CustomEvent('exportVideo', { detail: sprintId }));
		}
	}
	
	function handleExportPDF() {
		try {
			const taskSnapshot = [...tasks];
			const totalMinutes = taskSnapshot.reduce((sum, task) => sum + (task.duration_minutes || 0), 0);
			const totalTasks = taskSnapshot.length;
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
							<div class="stat-value">${totalTasks} งาน</div>
						</div>
						<div class="stat">
							<div class="stat-label">เวลารวม</div>
							<div class="stat-value">${(totalMinutes / 60).toFixed(1)} ชั่วโมง</div>
						</div>
						<div class="stat">
							<div class="stat-label">Man-days</div>
							<div class="stat-value">${(totalMinutes / 60 / 8).toFixed(2)} วัน</div>
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
							${taskSnapshot.map((task, i) => {
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

	interface MonthlySummary {
		periodLabel: string;
		total: number;
		done: number;
		inProgress: number;
		todo: number;
		archived: number;
		totalMinutes: number;
		avgPerDay: number;
		projectBreakdown: { name: string; count: number }[];
		assigneeBreakdown: { name: string; count: number }[];
		dailyTrend: { date: string; count: number }[];
		recentTasks: Task[];
	}

	function isWithinLastDays(dateText: string | undefined, days: number): boolean {
		if (!dateText) return false;
		const normalized = normalizeTaskDate(dateText);
		if (normalized === '-') return false;

		const baseDate = new Date(`${normalized}T00:00:00`);
		if (Number.isNaN(baseDate.getTime())) return false;

		const today = new Date();
		today.setHours(23, 59, 59, 999);
		const start = new Date(today);
		start.setDate(start.getDate() - (days - 1));
		start.setHours(0, 0, 0, 0);
		return baseDate >= start && baseDate <= today;
	}

	function buildMonthlySummary(taskList: Task[]): MonthlySummary {
		const tasks30 = taskList.filter((task) => isWithinLastDays(task.date, 30));
		const done = tasks30.filter((task) => task.status === 'done').length;
		const inProgress = tasks30.filter((task) => task.status === 'in-progress').length;
		const todo = tasks30.filter((task) => task.status === 'todo').length;
		const archived = tasks30.filter((task) => task.is_archived).length;
		const totalMinutes = tasks30.reduce((sum, task) => sum + (task.duration_minutes || 0), 0);

		const toSortedPairs = (map: Map<string, number>) =>
			[...map.entries()]
				.map(([name, count]) => ({ name, count }))
				.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'th'));

		const projectMap = new Map<string, number>();
		const assigneeMap = new Map<string, number>();
		for (const task of tasks30) {
			const projectName = (task.project || 'ไม่ระบุโปรเจค').trim() || 'ไม่ระบุโปรเจค';
			projectMap.set(projectName, (projectMap.get(projectName) || 0) + 1);

			const assigneeName = (task.assignee?.name || 'ไม่ระบุผู้รับผิดชอบ').trim() || 'ไม่ระบุผู้รับผิดชอบ';
			assigneeMap.set(assigneeName, (assigneeMap.get(assigneeName) || 0) + 1);
		}

		const recentTasks = [...tasks30]
			.sort((a, b) => normalizeTaskDate(b.date).localeCompare(normalizeTaskDate(a.date)))
			.slice(0, 12);

		const today = new Date();
		const start = new Date(today);
		start.setDate(start.getDate() - 29);
		const dailyMap = new Map<string, number>();
		for (let i = 0; i < 30; i++) {
			const date = new Date(start);
			date.setDate(start.getDate() + i);
			dailyMap.set(formatDateISO(date), 0);
		}
		for (const task of tasks30) {
			const key = normalizeTaskDate(task.date);
			if (dailyMap.has(key)) {
				dailyMap.set(key, (dailyMap.get(key) || 0) + 1);
			}
		}
		const dailyTrend = [...dailyMap.entries()].map(([date, count]) => ({ date, count }));

		return {
			periodLabel: `${formatDateISO(start)} ถึง ${formatDateISO(today)}`,
			total: tasks30.length,
			done,
			inProgress,
			todo,
			archived,
			totalMinutes,
			avgPerDay: tasks30.length / 30,
			projectBreakdown: toSortedPairs(projectMap).slice(0, 8),
			assigneeBreakdown: toSortedPairs(assigneeMap).slice(0, 8),
			dailyTrend,
			recentTasks
		};
	}

	$: monthlySummary = buildMonthlySummary(monthlySummaryTasks);
</script>

{#if videoExportInProgress}
	<div class="fixed top-20 right-4 z-50 animate-fade-in">
		<div class="bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[280px]">
			<svg class="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="10" stroke-opacity="0.3"></circle>
				<path d="M22 12a10 10 0 0 1-10 10"></path>
			</svg>
			<div class="flex-1">
				<div class="text-sm font-semibold">กำลังสร้างวิดีโอรายงาน {videoExportPercent}%</div>
				<div class="text-xs text-blue-100">ใช้เวลาแล้ว {formatElapsedTime(videoExportElapsedMs)}</div>
			</div>
		</div>
	</div>
{/if}

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
				bind:this={searchInputRef}
				type="text"
				value={searchInput}
				on:input={handleSearchInput}
				placeholder="ค้นหางาน... (กด / เพื่อค้นหา)"
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

			<button
				on:click={() => showMonthlySummary = true}
				class="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
				title="ดูสรุปงานย้อนหลัง 30 วัน"
			>
				<CalendarDays size={16} />
				<span class="hidden sm:inline">สรุป 30 วัน</span>
			</button>

			<ExportImport
				on:exportCSV={handleExportCSV}
				on:exportPDF={handleExportPDF}
				on:exportPNG={() => showMessage('ส่งออก PNG สำเร็จ')}
				on:exportMarkdown={handleExportMarkdown}
				on:exportVideo={handleExportVideo}
				on:exportDatabase={handleExportDatabase}
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
					<CustomDatePicker
						id="startDate"
						bind:value={filters.startDate}
						placeholder="เลือกวันเริ่มต้น..."
					/>
				</div>

				<div>
					<label for="endDate" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date ถึง</label>
					<CustomDatePicker
						id="endDate"
						bind:value={filters.endDate}
						placeholder="เลือกวันสิ้นสุด..."
					/>
				</div>

				<div>
					<label for="status" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">สถานะ</label>
					<SearchableSelect
						id="status"
						bind:value={filters.status}
						options={[
							{ value: 'all', label: 'ทั้งหมด' },
							{ value: 'todo', label: 'รอดำเนินการ', badge: true, badgeColor: 'bg-gray-400' },
							{ value: 'in-progress', label: 'กำลังทำ', badge: true, badgeColor: 'bg-blue-500' },
							{ value: 'done', label: 'เสร็จแล้ว', badge: true, badgeColor: 'bg-green-500' },
							{ value: 'archived', label: 'Archived (Sprint เก่า)', badge: true, badgeColor: 'bg-gray-600' }
						]}
						placeholder="ค้นหาสถานะ..."
						showSearch={false}
					/>
				</div>

				<div>
					<label for="category" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">หมวดหมู่</label>
					<SearchableSelect
						id="category"
						bind:value={filters.category}
						options={[
							{ value: 'all', label: 'ทั้งหมด' },
							...categories.map(cat => ({ value: cat, label: cat }))
						]}
						placeholder="ค้นหาหมวดหมู่..."
					/>
				</div>

				<div>
					<label for="project" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">โปรเจค</label>
					<SearchableSelect
						id="project"
						bind:value={filters.project}
						options={[
							{ value: 'all', label: 'ทั้งหมด' },
							...projects.map(proj => ({ value: proj, label: proj }))
						]}
						placeholder="ค้นหาโปรเจค..."
					/>
				</div>

				<div>
					<label for="assignee" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ผู้รับผิดชอบ</label>
					<SearchableSelect
						id="assignee"
						bind:value={filters.assignee_id}
						options={[
							{ value: 'all', label: 'ทั้งหมด' },
							{ value: null, label: 'ไม่ระบุผู้รับผิดชอบ', badge: true, badgeColor: 'bg-gray-300' },
							...assignees.map(a => ({ 
								value: a.id, 
								label: a.name,
								badge: true,
								badgeColor: a.color ? '' : 'bg-indigo-500'
							}))
						]}
						placeholder="ค้นหาผู้รับผิดชอบ..."
					/>
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
				on:exportQR={handleExportQR}
			/>
		{/if}
	</div>

		{#if showMonthlySummary}
			<div
				class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
				on:click|self={() => showMonthlySummary = false}
				on:keydown={(event) => event.key === 'Escape' && (showMonthlySummary = false)}
				role="button"
				tabindex="0"
				aria-label="ปิดหน้าต่างสรุปรายเดือน"
			>
			<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
				<div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
					<div>
						<h3 class="text-xl font-bold text-gray-900 dark:text-white">สรุปรายการ 1 เดือนย้อนหลัง</h3>
						<p class="text-sm text-gray-500 dark:text-gray-400">{monthlySummary.periodLabel}</p>
					</div>
					<button
						on:click={() => showMonthlySummary = false}
						class="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
						title="ปิด"
					>
						×
					</button>
				</div>

				<div class="p-6 overflow-y-auto space-y-6">
					<div class="grid grid-cols-2 md:grid-cols-5 gap-3">
						<div class="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-700/40">
							<p class="text-xs text-gray-500 dark:text-gray-400">งานทั้งหมด</p>
							<p class="text-2xl font-bold text-gray-900 dark:text-white">{monthlySummary.total}</p>
						</div>
						<div class="rounded-xl border border-green-200 dark:border-green-800 p-3 bg-green-50 dark:bg-green-900/20">
							<p class="text-xs text-green-700 dark:text-green-400">เสร็จแล้ว</p>
							<p class="text-2xl font-bold text-green-700 dark:text-green-300">{monthlySummary.done}</p>
						</div>
						<div class="rounded-xl border border-blue-200 dark:border-blue-800 p-3 bg-blue-50 dark:bg-blue-900/20">
							<p class="text-xs text-blue-700 dark:text-blue-400">กำลังทำ</p>
							<p class="text-2xl font-bold text-blue-700 dark:text-blue-300">{monthlySummary.inProgress}</p>
						</div>
						<div class="rounded-xl border border-amber-200 dark:border-amber-800 p-3 bg-amber-50 dark:bg-amber-900/20">
							<p class="text-xs text-amber-700 dark:text-amber-400">รอดำเนินการ</p>
							<p class="text-2xl font-bold text-amber-700 dark:text-amber-300">{monthlySummary.todo}</p>
						</div>
						<div class="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900/20">
							<p class="text-xs text-slate-700 dark:text-slate-400">Archived</p>
							<p class="text-2xl font-bold text-slate-700 dark:text-slate-300">{monthlySummary.archived}</p>
						</div>
					</div>

					<div class="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-800 dark:to-gray-900">
						<p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
							งานเฉลี่ย/วัน: {monthlySummary.avgPerDay.toFixed(2)} · เวลารวม: {(monthlySummary.totalMinutes / 60).toFixed(1)} ชม.
						</p>
						<MonthlySummaryCharts
							done={monthlySummary.done}
							inProgress={monthlySummary.inProgress}
							todo={monthlySummary.todo}
							dailyTrend={monthlySummary.dailyTrend}
							projectBreakdown={monthlySummary.projectBreakdown}
							assigneeBreakdown={monthlySummary.assigneeBreakdown}
						/>
					</div>

					<div class="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
						<h4 class="font-semibold text-gray-900 dark:text-white mb-3">รายการล่าสุดในรอบเดือน</h4>
						<div class="space-y-2">
							{#if monthlySummary.recentTasks.length === 0}
								<p class="text-sm text-gray-500 dark:text-gray-400">ไม่มีงานในช่วงเวลา</p>
							{:else}
								{#each monthlySummary.recentTasks as task}
									<div class="flex items-start justify-between gap-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
										<div class="min-w-0">
											<p class="text-sm font-medium text-gray-900 dark:text-white truncate">{task.title}</p>
											<p class="text-xs text-gray-500 dark:text-gray-400 truncate">
												{task.project || 'ไม่ระบุโปรเจค'} · {task.assignee?.name || 'ไม่ระบุผู้รับผิดชอบ'}
											</p>
										</div>
										<div class="text-right shrink-0">
											<p class="text-xs text-gray-600 dark:text-gray-300">{normalizeTaskDate(task.date)}</p>
											<p class="text-xs {task.status === 'done' ? 'text-green-600 dark:text-green-400' : task.status === 'in-progress' ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}">
												{task.status === 'done' ? 'เสร็จแล้ว' : task.status === 'in-progress' ? 'กำลังทำ' : 'รอดำเนินการ'}
											</p>
										</div>
									</div>
								{/each}
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

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
			on:completeAndExport={handleCompleteAndExport}
			on:deleteSprint={handleDeleteSprint}
			on:moveTasksToSprint={handleMoveTasksToSprint}
			on:exportMarkdown={handleExportMarkdown}
			on:exportVideo={handleExportVideo}
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

	<!-- QR Export Modal -->
	<QRExportModal
		show={showQRExport}
		selectedTasks={qrExportTasks}
		allProjects={projectList}
		allAssignees={assignees}
		on:close={() => { showQRExport = false; qrExportTasks = []; }}
		on:exportCSV={handleExportCSV}
	/>

	<!-- Keyboard Shortcuts Modal -->
	{#if $showKeyboardShortcuts}
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
				on:click|self={() => $showKeyboardShortcuts = false}
				on:keydown={(event) => event.key === 'Escape' && ($showKeyboardShortcuts = false)}
				role="button"
				tabindex="0"
				aria-label="ปิดหน้าต่างคีย์ลัด"
			>
			<div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 animate-modal-in">
				<div class="flex items-center justify-between mb-6">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
						⌨️ คีย์ลัด (Keyboard Shortcuts)
					</h3>
						<button
							on:click={() => $showKeyboardShortcuts = false}
							aria-label="ปิดหน้าต่างคีย์ลัด"
							class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
						>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
					</button>
				</div>

				<!-- View Shortcuts -->
				<div class="mb-4">
					<h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">การมองเห็น (Views)</h4>
					<div class="space-y-2">
						<div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
							<div class="flex items-center gap-3">
								<kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300">1</kbd>
								<span class="text-gray-700 dark:text-gray-300">{$tabSettings[0]?.label || 'รายการ'} ({$tabSettings[0]?.id || 'list'})</span>
							</div>
							<span class="text-xs text-gray-400">{$tabSettings[0]?.id || 'list'} view</span>
						</div>
						<div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
							<div class="flex items-center gap-3">
								<kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300">2</kbd>
								<span class="text-gray-700 dark:text-gray-300">{$tabSettings[1]?.label || 'ปฏิทิน'} ({$tabSettings[1]?.id || 'calendar'})</span>
							</div>
							<span class="text-xs text-gray-400">{$tabSettings[1]?.id || 'calendar'} view</span>
						</div>
						<div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
							<div class="flex items-center gap-3">
								<kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300">3</kbd>
								<span class="text-gray-700 dark:text-gray-300">{$tabSettings[2]?.label || 'Kanban'} ({$tabSettings[2]?.id || 'kanban'})</span>
							</div>
							<span class="text-xs text-gray-400">{$tabSettings[2]?.id || 'kanban'} view</span>
						</div>
						<div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
							<div class="flex items-center gap-3">
								<kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300">4</kbd>
								<span class="text-gray-700 dark:text-gray-300">{$tabSettings[3]?.label || 'ตาราง'} ({$tabSettings[3]?.id || 'table'})</span>
							</div>
							<span class="text-xs text-gray-400">{$tabSettings[3]?.id || 'table'} view</span>
						</div>
					</div>
				</div>

				<!-- Action Shortcuts -->
				<div class="mb-4">
					<h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">การทำงาน (Actions)</h4>
					<div class="space-y-2">
						<div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
							<div class="flex items-center gap-3">
								<kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300">/</kbd>
								<span class="text-gray-700 dark:text-gray-300">โฟกัสช่องค้นหา</span>
							</div>
							<span class="text-xs text-gray-400">Focus search</span>
						</div>
						<div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
							<div class="flex items-center gap-3">
								<kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300">N</kbd>
								<span class="text-gray-700 dark:text-gray-300">เพิ่มงานใหม่</span>
							</div>
							<span class="text-xs text-gray-400">New task</span>
						</div>
						<div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
							<div class="flex items-center gap-3">
								<kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300">F</kbd>
								<span class="text-gray-700 dark:text-gray-300">เปิด/ปิดตัวกรอง</span>
							</div>
							<span class="text-xs text-gray-400">Toggle filters</span>
						</div>
						<div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
							<div class="flex items-center gap-3">
								<kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300">T</kbd>
								<span class="text-gray-700 dark:text-gray-300">สลับธีม สว่าง/มืด</span>
							</div>
							<span class="text-xs text-gray-400">Toggle theme</span>
						</div>
					</div>
				</div>

				<!-- System Shortcuts -->
				<div>
					<h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">ระบบ (System)</h4>
					<div class="space-y-2">
						<div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
							<div class="flex items-center gap-3">
								<kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300">Esc</kbd>
								<span class="text-gray-700 dark:text-gray-300">ปิด Modal / ยกเลิก</span>
							</div>
							<span class="text-xs text-gray-400">Close modal</span>
						</div>
						<div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
							<div class="flex items-center gap-3">
								<kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300">?</kbd>
								<span class="text-gray-700 dark:text-gray-300">แสดงคีย์ลัดทั้งหมด</span>
							</div>
							<span class="text-xs text-gray-400">Show shortcuts</span>
						</div>
					</div>
				</div>

				<div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
					<p class="text-xs text-gray-500 dark:text-gray-400 text-center">
						💡 คีย์ลัดทำงานเมื่อไม่ได้อยู่ใน input หรือ textarea
					</p>
				</div>

				<div class="mt-4">
					<button
						on:click={() => $showKeyboardShortcuts = false}
						class="w-full px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors"
					>
						เข้าใจแล้ว
					</button>
				</div>
			</div>
		</div>
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

	@keyframes modal-in {
		from {
			opacity: 0;
			transform: scale(0.95) translateY(-10px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.animate-modal-in {
		animation: modal-in 0.2s ease-out;
	}
</style>
