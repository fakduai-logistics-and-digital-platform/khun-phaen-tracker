<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { _ } from 'svelte-i18n';
	import type { Task, Project, Assignee, ViewMode, FilterOptions } from '$lib/types';
	import { getTasks, getTasksBySprint, addTask, updateTask, deleteTask, getStats, exportToCSV, importFromCSV, importAllData, mergeAllData, getCategories, getAssignees, getProjects, getProjectsList, addProject, updateProject, deleteProject, getProjectStats, addAssignee as addAssigneeDB, getAssigneeStats, updateAssignee, deleteAssignee, archiveTasksBySprint, exportFilteredSQLiteBinary } from '$lib/db';
	import TaskForm from '$lib/components/TaskForm.svelte';
	import TaskList from '$lib/components/TaskList.svelte';
	import CalendarView from '$lib/components/CalendarView.svelte';
	import KanbanBoard from '$lib/components/KanbanBoard.svelte';
	import TableView from '$lib/components/TableView.svelte';
	import GanttView from '$lib/components/GanttView.svelte';
	import StatsPanel from '$lib/components/StatsPanel.svelte';
	import ExportImport from '$lib/components/ExportImport.svelte';
	import WorkerManager from '$lib/components/WorkerManager.svelte';
	import ProjectManager from '$lib/components/ProjectManager.svelte';
	import { List, CalendarDays, Columns3, Table, GanttChart, Filter, Search, Plus, Users, Folder, Sparkles, MessageSquareQuote, Settings2, Flag, FileText, FileSpreadsheet, Image as ImageIcon, Video, Presentation, CheckCircle, Moon, Sun, Bookmark, Play } from 'lucide-svelte';
	import { initWasmSearch, indexTasks, performSearch, clearSearch, searchQuery, wasmReady, wasmLoading } from '$lib/stores/search';
	import { compressionReady, compressionStats, getStorageInfo } from '$lib/stores/storage';
	import { enableAutoImport, setMergeCallback, scheduleHostRealtimeSync } from '$lib/stores/server-sync';
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
	import PptxGenJS from 'pptxgenjs';
	import DailyReflect from '$lib/components/DailyReflect.svelte';

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
		if (saved && ['list', 'calendar', 'kanban', 'table', 'gantt'].includes(saved)) {
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
	let searchInputRef: HTMLInputElement | null = null;
	let commandInputRef: HTMLInputElement | null = null;
	let showCommandPalette = false;
	let commandQuery = '';
	let commandSelectedIndex = 0;
	let showDailyReflect = false;

	let filters: FilterOptions = { ...DEFAULT_FILTERS };
	let selectedSprint: Sprint | null = null;
	// Show all sprints including completed ones in dropdown

	type CommandPaletteItem = {
		id: string;
		label: string;
		description: string;
		keywords: string[];
		category: 'command' | 'search' | 'task' | 'project' | 'assignee' | 'sprint';
		run: () => void | Promise<void>;
		// Metadata for specialized rendering
		project?: string;
		status?: string;
		icon?: any;
	};

	type CommandPaletteGroup = {
		category: CommandPaletteItem['category'];
		label: string;
		items: CommandPaletteItem[];
	};

	let baseCommandPaletteItems: CommandPaletteItem[] = [];
	let dynamicCommandPaletteItems: CommandPaletteItem[] = [];
	let commandPaletteItems: CommandPaletteItem[] = [];
	let commandPaletteFilteredItems: CommandPaletteItem[] = [];
	let groupedCommandPaletteItems: CommandPaletteGroup[] = [];

	async function startTimerFromCommandPalette() {
		const taskToStart = tasks.find((task) => !task.is_archived && task.status === 'todo' && task.id !== undefined);
		if (!taskToStart?.id) {
			showMessage('No TODO task found to start timer', 'error');
			return;
		}

		try {
			await updateTask(taskToStart.id, { status: 'in-progress' });
			await loadData();
			queueHostRealtimeSync('update-task-status');
			showMessage(`Started timer for: ${taskToStart.title}`);
		} catch (error) {
			console.error('Failed to start timer from command palette:', error);
			showMessage('Failed to start timer', 'error');
		}
	}

	function getCommandCategoryLabel(category: CommandPaletteItem['category']): string {
		switch (category) {
			case 'search':
				return $_('commandPalette__cat_search');
			case 'task':
				return $_('commandPalette__cat_task');
			case 'project':
				return $_('commandPalette__cat_project');
			case 'assignee':
				return $_('commandPalette__cat_assignee');
			case 'sprint':
				return $_('commandPalette__cat_sprint');
			default:
				return $_('commandPalette__cat_command');
		}
	}

	function getCommandStatusInfo(status: string | undefined) {
		if (!status) return null;
		switch (status) {
			case 'done':
				return {
					label: $_('page__filter_status_done'),
					class: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
				};
			case 'in-progress':
				return {
					label: $_('page__filter_status_in_progress'),
					class: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'
				};
			case 'todo':
			default:
				return {
					label: $_('page__filter_status_todo'),
					class: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
				};
		}
	}

	function openUtilityModalFromCommand(kind: 'bookmark' | 'whiteboard' | 'quick-notes') {
		document.dispatchEvent(new CustomEvent('open-utility-modal', { detail: { kind } }));
	}

	function openCommandPalette() {
		showCommandPalette = true;
		commandQuery = '';
		commandSelectedIndex = 0;
		void tick().then(() => {
			commandInputRef?.focus();
		});
	}

	function closeCommandPalette() {
		showCommandPalette = false;
		commandQuery = '';
		commandSelectedIndex = 0;
	}

	function normalizeForCommandSearch(value: string): string {
		return value
			.toLowerCase()
			.replace(/[^a-z0-9\u0E00-\u0E7F\s]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function getFuzzyScore(query: string, haystack: string): number | null {
		if (!query) return 0;
		if (!haystack) return null;

		if (haystack.includes(query)) {
			const index = haystack.indexOf(query);
			return 1200 - index * 3 - Math.abs(haystack.length - query.length);
		}

		let queryIndex = 0;
		let score = 0;
		let streak = 0;

		for (let i = 0; i < haystack.length && queryIndex < query.length; i++) {
			if (haystack[i] === query[queryIndex]) {
				score += streak > 0 ? 14 : 7;
				if (i === 0 || haystack[i - 1] === ' ') {
					score += 4;
				}
				streak += 1;
				queryIndex += 1;
			} else {
				streak = 0;
			}
		}

		if (queryIndex !== query.length) return null;
		return score - Math.max(0, haystack.length - query.length) * 0.2;
	}

	function applyGlobalTaskSearch(queryText: string) {
		searchInput = queryText;
		searchQuery.set(queryText);

		if ($wasmReady) {
			filteredTasks = performSearch(queryText, tasks);
		} else {
			filters.search = queryText;
			void loadData();
		}
	}

	$: baseCommandPaletteItems = [
		{
			id: 'create-task',
			label: $_('commandPalette__create_task_label'),
			description: $_('commandPalette__create_task_desc'),
			keywords: ['new task', 'add task', 'create task'],
			category: 'command',
			icon: Plus,
			run: () => {
				showForm = true;
				editingTask = null;
			}
		},
		{
			id: 'start-timer',
			label: $_('commandPalette__start_timer_label'),
			description: $_('commandPalette__start_timer_desc'),
			keywords: ['timer', 'start timer', 'in progress', 'focus'],
			category: 'command',
			icon: Play,
			run: () => startTimerFromCommandPalette()
		},
		{
			id: 'toggle-dark-mode',
			label: $_('commandPalette__toggle_theme_label'),
			description: $_('commandPalette__toggle_theme_desc'),
			keywords: ['theme', 'dark mode', 'light mode'],
			category: 'command',
			icon: Sparkles,
			run: () => theme.toggle()
		},
		{
			id: 'open-quick-notes',
			label: $_('commandPalette__quick_notes_label'),
			description: $_('commandPalette__quick_notes_desc'),
			keywords: ['quick note', 'note', 'memo', 'sticky'],
			category: 'command',
			icon: FileText,
			run: () => openUtilityModalFromCommand('quick-notes')
		},
		{
			id: 'open-bookmarks',
			label: $_('commandPalette__bookmarks_label'),
			description: $_('commandPalette__bookmarks_desc'),
			keywords: ['bookmark', 'link', 'saved links'],
			category: 'command',
			icon: Bookmark,
			run: () => openUtilityModalFromCommand('bookmark')
		},
		{
			id: 'open-whiteboard',
			label: $_('commandPalette__whiteboard_label'),
			description: $_('commandPalette__whiteboard_desc'),
			keywords: ['whiteboard', 'draw', 'sketch', 'canvas'],
			category: 'command',
			icon: Presentation,
			run: () => openUtilityModalFromCommand('whiteboard')
		},
		{
			id: 'daily-reflect',
			label: $_('dailyReflect__title'),
			description: $_('dailyReflect__subtitle'),
			keywords: ['standup', 'daily report', 'summary', 'reflect'],
			category: 'command',
			icon: MessageSquareQuote,
			run: () => {
				showDailyReflect = true;
			}
		}
	];

	$: normalizedCommandQuery = normalizeForCommandSearch(commandQuery.trim());

	$: dynamicCommandPaletteItems = (() => {
		if (!normalizedCommandQuery) return [] as CommandPaletteItem[];

		const sprintNameById = new Map(
			$sprints
				.filter((sprint) => sprint.id !== undefined)
				.map((sprint) => [sprint.id as number, sprint.name])
		);

		const taskItems: { score: number; item: CommandPaletteItem }[] = [];
		for (const task of monthlySummaryTasks) {
			if (task.id === undefined) continue;
			const sprintName = task.sprint_id ? sprintNameById.get(task.sprint_id) || '' : '';
			const taskSearchText = normalizeForCommandSearch(
				[
					task.title,
					task.project || '',
					task.category || '',
					task.notes || '',
					task.assignee?.name || '',
					sprintName,
					task.status
				].join(' ')
			);
			const score = getFuzzyScore(normalizedCommandQuery, taskSearchText);
			if (score === null) continue;

			taskItems.push({
				score,
				item: {
					id: `task-${task.id}`,
					label: $_('commandPalette__open_task_label', { values: { title: task.title } }),
					description: `${task.project || $_('commandPalette__no_project')} · ${task.status}`,
					keywords: [task.title, task.project || '', task.category || '', task.assignee?.name || '', sprintName],
					category: 'task',
					project: task.project || $_('commandPalette__no_project'),
					status: task.status,
					icon: CheckCircle,
					run: () => {
						editingTask = task;
						showForm = true;
					}
				}
			});
		}

		const topTaskItems = taskItems
			.sort((a, b) => b.score - a.score)
			.slice(0, 6)
			.map((entry) => entry.item);

		const projectItems: { score: number; item: CommandPaletteItem }[] = [];
		for (const project of projectList) {
			const score = getFuzzyScore(normalizedCommandQuery, normalizeForCommandSearch(project.name));
			if (score === null) continue;
			projectItems.push({
				score,
				item: {
					id: `project-${project.id ?? project.name}`,
					label: $_('commandPalette__filter_project_label', { values: { name: project.name } }),
					description: $_('commandPalette__filter_project_desc'),
					keywords: [project.name, 'project', 'filter'],
					category: 'project',
					project: project.name,
					icon: Folder,
					run: () => {
						filters = { ...filters, project: project.name };
						applyFilters();
					}
				}
			});
		}

		const topProjectItems = projectItems
			.sort((a, b) => b.score - a.score)
			.slice(0, 3)
			.map((entry) => entry.item);

		const assigneeItems: { score: number; item: CommandPaletteItem }[] = [];
		for (const assignee of assignees) {
			if (assignee.id === undefined) continue;
			const score = getFuzzyScore(normalizedCommandQuery, normalizeForCommandSearch(assignee.name));
			if (score === null) continue;
			assigneeItems.push({
				score,
				item: {
					id: `assignee-${assignee.id}`,
					label: $_('commandPalette__filter_assignee_label', { values: { name: assignee.name } }),
					description: $_('commandPalette__filter_assignee_desc'),
					keywords: [assignee.name, 'assignee', 'worker', 'filter'],
					category: 'assignee',
					icon: Users,
					run: () => {
						filters = { ...filters, assignee_id: assignee.id ?? 'all' };
						applyFilters();
					}
				}
			});
		}

		const topAssigneeItems = assigneeItems
			.sort((a, b) => b.score - a.score)
			.slice(0, 3)
			.map((entry) => entry.item);

		const sprintItems: { score: number; item: CommandPaletteItem }[] = [];
		for (const sprint of $sprints) {
			const score = getFuzzyScore(normalizedCommandQuery, normalizeForCommandSearch(sprint.name));
			if (score === null) continue;
			sprintItems.push({
				score,
				item: {
					id: `sprint-filter-${sprint.id}`,
					label: $_('commandPalette__go_to_sprint_label', { values: { name: sprint.name } }),
					description: $_('commandPalette__go_to_sprint_desc', { values: { name: sprint.name } }),
					keywords: [sprint.name, 'sprint', 'filter'],
					category: 'sprint',
					icon: Flag,
					run: () => {
						filters = { ...filters, sprint_id: sprint.id ?? null };
						applyFilters();
					}
				}
			});
		}

		const topSprintItems = sprintItems
			.sort((a, b) => b.score - a.score)
			.slice(0, 3)
			.map((entry) => entry.item);

		const quickSearchItem: CommandPaletteItem = {
			id: `search-all-${normalizedCommandQuery}`,
			label: $_('commandPalette__search_tasks_label', { values: { query: commandQuery.trim() } }),
			description: $_('commandPalette__search_tasks_desc'),
			keywords: ['search', 'find', commandQuery.trim()],
			category: 'search',
			icon: Search,
			run: () => applyGlobalTaskSearch(commandQuery.trim())
		};

		return [quickSearchItem, ...topTaskItems, ...topProjectItems, ...topAssigneeItems, ...topSprintItems];
	})();

	$: commandPaletteItems = [...baseCommandPaletteItems, ...dynamicCommandPaletteItems];

	const commandPaletteCategoryOrder: CommandPaletteItem['category'][] = ['command', 'search', 'task', 'project', 'assignee', 'sprint'];

	$: commandPaletteFilteredItems = (() => {
		if (!normalizedCommandQuery) return commandPaletteItems;

		const scored = commandPaletteItems
			.map((item) => {
				const haystack = normalizeForCommandSearch(`${item.label} ${item.description} ${item.keywords.join(' ')}`);
				const score = getFuzzyScore(normalizedCommandQuery, haystack);
				if (score === null) return null;
				return { item, score };
			})
			.filter((entry): entry is { item: CommandPaletteItem; score: number } => entry !== null)
			.sort((a, b) => b.score - a.score);

		const seen = new Set<string>();
		const deduped: CommandPaletteItem[] = [];
		for (const entry of scored) {
			if (seen.has(entry.item.id)) continue;
			seen.add(entry.item.id);
			deduped.push(entry.item);
		}

		return deduped;
	})();

	$: groupedCommandPaletteItems = commandPaletteCategoryOrder
		.map((category) => ({
			category,
			label: getCommandCategoryLabel(category),
			items: commandPaletteFilteredItems.filter((item) => item.category === category)
		}))
		.filter((group) => group.items.length > 0);

	function getCommandItemIndex(itemId: string): number {
		return commandPaletteFilteredItems.findIndex((item) => item.id === itemId);
	}

	$: {
		if (commandPaletteFilteredItems.length === 0) {
			commandSelectedIndex = 0;
		} else if (commandSelectedIndex >= commandPaletteFilteredItems.length) {
			commandSelectedIndex = commandPaletteFilteredItems.length - 1;
		}
	}

	async function runCommandPaletteItem(item: CommandPaletteItem) {
		await item.run();
		closeCommandPalette();
	}

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
		const isCommandPaletteShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
		if (isCommandPaletteShortcut) {
			event.preventDefault();
			if (showCommandPalette) {
				closeCommandPalette();
			} else {
				openCommandPalette();
			}
			return;
		}

		if (showCommandPalette) {
			switch (event.key) {
				case 'Escape':
					event.preventDefault();
					closeCommandPalette();
					break;
				case 'ArrowDown':
					event.preventDefault();
					if (commandPaletteFilteredItems.length > 0) {
						commandSelectedIndex = (commandSelectedIndex + 1) % commandPaletteFilteredItems.length;
					}
					break;
				case 'ArrowUp':
					event.preventDefault();
					if (commandPaletteFilteredItems.length > 0) {
						commandSelectedIndex = (commandSelectedIndex - 1 + commandPaletteFilteredItems.length) % commandPaletteFilteredItems.length;
					}
					break;
				case 'Enter': {
					event.preventDefault();
					const selectedCommand = commandPaletteFilteredItems[commandSelectedIndex];
					if (selectedCommand) {
						void runCommandPaletteItem(selectedCommand);
					}
					break;
				}
			}
			return;
		}

		// Ignore if user is typing in an input/textarea
		const target = event.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
			// Allow Escape to close modals even when in input
			if (event.key === 'Escape') {
				if (showCommandPalette) {
					closeCommandPalette();
					event.preventDefault();
					return;
				}
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
				} else if (showCommandPalette) {
					closeCommandPalette();
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
		if (browser) {
			document.removeEventListener('keydown', handleKeydown);
		}
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
			console.error('❌ loadData failed:', e);
			showMessage(`เกิดข้อผิดพลาดในการโหลดข้อมูล: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
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
	async function handleAddWorker(event: CustomEvent<{ name: string; color: string; discord_id?: string }>) {
		try {
			await addAssigneeDB({ 
				name: event.detail.name, 
				color: event.detail.color,
				discord_id: event.detail.discord_id 
			});
			await loadData();
			showMessage($_('page__add_worker_success'));
			queueHostRealtimeSync('add-worker');
		} catch (e) {
			showMessage($_('page__add_worker_error'), 'error');
		}
	}
	
	async function handleUpdateWorker(event: CustomEvent<{ id: number; name: string; color: string; discord_id?: string }>) {
		try {
			await updateAssignee(event.detail.id, { 
				name: event.detail.name, 
				color: event.detail.color,
				discord_id: event.detail.discord_id 
			});
			await loadData();
			showMessage($_('page__update_worker_success'));
			queueHostRealtimeSync('update-worker');
		} catch (e) {
			showMessage($_('page__update_worker_error'), 'error');
		}
	}
	
	async function handleDeleteWorker(event: CustomEvent<number>) {
		try {
			await deleteAssignee(event.detail);
			await loadData();
			showMessage($_('page__delete_worker_success'));
			queueHostRealtimeSync('delete-worker');
		} catch (e) {
			showMessage($_('page__delete_worker_error'), 'error');
		}
	}
	
	// Project Management Functions
	async function handleAddProject(event: CustomEvent<{ name: string; repo_url?: string }>) {
		try {
			await addProject({ 
				name: event.detail.name,
				repo_url: event.detail.repo_url
			});
			await loadData();
			showMessage($_('page__add_project_success'));
			queueHostRealtimeSync('add-project');
		} catch (e) {
			showMessage($_('page__add_project_error'), 'error');
		}
	}
	
	async function handleUpdateProject(event: CustomEvent<{ id: number; name: string; repo_url?: string }>) {
		try {
			await updateProject(event.detail.id, { 
				name: event.detail.name,
				repo_url: event.detail.repo_url
			});
			await loadData();
			showMessage($_('page__update_project_success'));
			queueHostRealtimeSync('update-project');
		} catch (e) {
			showMessage($_('page__update_project_error'), 'error');
		}
	}
	
	async function handleDeleteProject(event: CustomEvent<number>) {
		try {
			await deleteProject(event.detail);
			await loadData();
			showMessage($_('page__delete_project_success'));
			queueHostRealtimeSync('delete-project');
		} catch (e) {
			showMessage($_('page__delete_project_error'), 'error');
		}
	}
	
	function showMessage(msg: string, type: 'success' | 'error' = 'success') {
		message = msg;
		messageType = type;
		setTimeout(() => message = '', 3000);
	}

	function queueHostRealtimeSync(reason: string) {
		const queued = scheduleHostRealtimeSync(reason);
		if (queued) {
			console.log(`⚡ Queued host realtime sync: ${reason}`);
		}
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
			showMessage($_('page__complete_sprint_success', { values: { archived: archivedCount, incomplete: incompleteTasks.length } }));
			queueHostRealtimeSync('complete-sprint');
			return true;
		} catch (e) {
			showMessage($_('page__complete_sprint_error'), 'error');
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
				showMessage($_('page__move_tasks_from_sprint_success', { values: { count: movedCount } }));
			} else {
				showMessage($_('page__move_tasks_to_sprint_success', { values: { count: movedCount } }));
			}
			queueHostRealtimeSync('move-tasks-to-sprint');
		} catch (e) {
			await loadData();
			showMessage($_('page__move_tasks_error'), 'error');
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
			showMessage($_('page__delete_sprint_error'), 'error');
		}
	}
	
	async function handleAddTask(event: CustomEvent<Omit<Task, 'id' | 'created_at'>>) {
		try {
			const isEditing = Boolean(editingTask);
			if (editingTask) {
				await updateTask(editingTask.id!, event.detail);
				showMessage($_('page__update_task_success'));
				editingTask = null;
			} else {
				await addTask(event.detail);
				showMessage($_('page__add_task_success'));
			}
			await loadData();
			showForm = false;
			queueHostRealtimeSync(isEditing ? 'update-task' : 'add-task');
		} catch (e) {
			console.error('❌ handleAddTask failed:', e);
			showMessage($_('page__add_task_error'), 'error');
		}
	}
	
	async function handleAddAssignee(event: CustomEvent<{ name: string; color: string }>) {
		try {
			await addAssigneeDB({ name: event.detail.name, color: event.detail.color });
			assignees = await getAssignees();
			showMessage($_('page__add_assignee_success'));
			queueHostRealtimeSync('add-assignee');
		} catch (e) {
			showMessage($_('page__add_assignee_error'), 'error');
		}
	}
	
	async function handleDeleteTask(event: CustomEvent<number>) {
		const id = event.detail;
		if (!confirm($_('page__delete_task_confirm'))) return;
		try {
			await deleteTask(id);
			await loadData();
			showMessage($_('page__delete_task_success'));
			queueHostRealtimeSync('delete-task');
		} catch (e) {
			showMessage($_('page__delete_task_error'), 'error');
		}
	}

	async function handleDeleteSelectedTasks(event: CustomEvent<number[]>) {
		const ids = event.detail;
		if (ids.length === 0) return;
		if (!confirm($_('page__delete_tasks_confirm', { values: { count: ids.length } }))) return;

		try {
			const deleteResults = await Promise.allSettled(ids.map(id => deleteTask(id)));
			const deletedCount = deleteResults.filter(result => result.status === 'fulfilled').length;
			const failedCount = ids.length - deletedCount;

			await loadData();

			if (failedCount === 0) {
				showMessage($_('page__delete_tasks_success', { values: { count: deletedCount } }));
			} else {
				showMessage($_('page__delete_tasks_error', { values: { count: deletedCount, failed: failedCount } }), 'error');
			}
			if (deletedCount > 0) {
				queueHostRealtimeSync('delete-selected-tasks');
			}
		} catch (e) {
			showMessage($_('page__delete_tasks_error'), 'error');
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
			queueHostRealtimeSync('update-task-status');
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
			URL.revokeObjectURL(url);
			showMessage($_('page__export_csv_success'));
		} catch (e) {
			showMessage($_('page__export_csv_error'), 'error');
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
			'  repo_url TEXT,',
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
			'  updated_at TEXT,',
			'  end_date TEXT',
			');',
			''
		];

		for (const project of relatedProjects) {
			sql.push(
				`INSERT INTO projects (id, name, repo_url, created_at) VALUES (${toPostgresValue(project.id)}, ${toPostgresValue(project.name)}, ${toPostgresValue(project.repo_url)}, ${toPostgresValue(project.created_at)}) ON CONFLICT (id) DO NOTHING;`
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
				`INSERT INTO tasks (id, title, project, duration_minutes, date, status, category, notes, assignee_id, sprint_id, is_archived, created_at, updated_at, end_date) VALUES (${toPostgresValue(task.id)}, ${toPostgresValue(task.title)}, ${toPostgresValue(task.project)}, ${toPostgresValue(task.duration_minutes)}, ${toPostgresValue(task.date)}, ${toPostgresValue(task.status)}, ${toPostgresValue(task.category)}, ${toPostgresValue(task.notes)}, ${toPostgresValue(task.assignee_id)}, ${toPostgresValue(task.sprint_id)}, ${toPostgresValue(!!task.is_archived)}, ${toPostgresValue(task.created_at)}, ${toPostgresValue(task.updated_at)}, ${toPostgresValue(task.end_date)}) ON CONFLICT (id) DO NOTHING;`
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
				showMessage($_('page__export_sqlite_success'));
				return;
			}

			const { taskSnapshot, relatedProjects, relatedAssignees, relatedSprints } = getFilteredExportContext();
			if (database === 'PostgreSQL') {
				const sqlScript = buildPostgresSqlFromSnapshot(taskSnapshot, relatedProjects, relatedAssignees, relatedSprints);
				downloadBlob(`tasks_${timestamp}_postgres.sql`, new Blob([sqlScript], { type: 'application/sql;charset=utf-8' }));
				showMessage($_('page__export_postgres_success'));
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
			showMessage($_('page__export_nosql_success'));
		} catch (e) {
			console.error('Database export failed:', e);
			showMessage($_('page__export_db_error'), 'error');
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

	async function captureMonthlyChartImages(): Promise<Array<{ title: string; image: string }>> {
		if (!monthlySummaryRef) return [];
		const chartCards = Array.from(
			monthlySummaryRef.querySelectorAll<HTMLElement>('[data-monthly-chart]')
		);
		const images: Array<{ title: string; image: string }> = [];

		for (const card of chartCards) {
			const title = card.dataset.chartTitle || 'Chart';
			const image = await toPng(card, {
				quality: 0.95,
				pixelRatio: 2,
				backgroundColor: document.documentElement.classList.contains('dark') ? '#111827' : '#ffffff',
				fontEmbedCSS: ''
			});
			images.push({ title, image });
		}

		return images;
	}

	function loadImage(dataUrl: string): Promise<HTMLImageElement> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = reject;
			img.src = dataUrl;
		});
	}

	async function composeMonthlyReportImage(
		charts: Array<{ title: string; image: string }>,
		periodLabel: string,
		taskSnapshot: Task[]
	): Promise<string> {
		const loaded = await Promise.all(charts.map(async (chart) => ({ ...chart, img: await loadImage(chart.image) })));
		const doneTasks = taskSnapshot.filter((task) => task.status === 'done');
		const inProgressTasks = taskSnapshot.filter((task) => task.status === 'in-progress');
		const todoTasks = taskSnapshot.filter((task) => task.status === 'todo');
		const archivedTasks = taskSnapshot.filter((task) => task.is_archived);
		const assigneeSummary = [...taskSnapshot.reduce((acc, task) => {
			const name = task.assignee?.name || 'ไม่ระบุผู้รับผิดชอบ';
			const item = acc.get(name) || { name, total: 0, done: 0, inProgress: 0, todo: 0 };
			item.total += 1;
			if (task.status === 'done') item.done += 1;
			else if (task.status === 'in-progress') item.inProgress += 1;
			else item.todo += 1;
			acc.set(name, item);
			return acc;
		}, new Map<string, { name: string; total: number; done: number; inProgress: number; todo: number }>()).values()]
			.sort((a, b) => b.total - a.total)
			.slice(0, 5);
		const keyTasks = [...taskSnapshot]
			.sort((a, b) => normalizeTaskDate(b.date).localeCompare(normalizeTaskDate(a.date)))
			.slice(0, 8);

		const cols = 2;
		const rows = Math.max(1, Math.ceil(Math.max(1, loaded.length) / cols));
		const cellWidth = 900;
		const cellHeight = 560;
		const gap = 24;
		const headerHeight = 580;
		const padding = 32;

		const width = padding * 2 + cols * cellWidth + (cols - 1) * gap;
		const height = padding * 2 + headerHeight + rows * cellHeight + (rows - 1) * gap;

		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Cannot create canvas context');

		// Background
		const gradient = ctx.createLinearGradient(0, 0, width, height);
		gradient.addColorStop(0, '#f8fafc');
		gradient.addColorStop(1, '#e2e8f0');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, width, height);

		// Header
		ctx.fillStyle = '#0f172a';
		ctx.font = '700 52px "Noto Sans Thai", sans-serif';
		ctx.fillText('Monthly Performance Report', padding, padding + 52);
		ctx.fillStyle = '#334155';
		ctx.font = '400 30px "Noto Sans Thai", sans-serif';
		ctx.fillText(periodLabel, padding, padding + 98);

		const statsY = padding + 126;
		const statCards = [
			{ label: 'งานทั้งหมด', value: `${taskSnapshot.length}`, color: '#0f172a' },
			{ label: 'เสร็จแล้ว', value: `${doneTasks.length}`, color: '#16a34a' },
			{ label: 'กำลังทำ', value: `${inProgressTasks.length}`, color: '#2563eb' },
			{ label: 'รอดำเนินการ', value: `${todoTasks.length}`, color: '#d97706' },
			{ label: 'Archived', value: `${archivedTasks.length}`, color: '#475569' }
		];
		statCards.forEach((card, i) => {
			const cardW = 350;
			const cardX = padding + i * (cardW + 12);
			drawRoundedRect(ctx, cardX, statsY, cardW, 110, 16);
			ctx.fillStyle = '#ffffff';
			ctx.fill();
			ctx.strokeStyle = '#cbd5e1';
			ctx.lineWidth = 1.5;
			ctx.stroke();
			ctx.fillStyle = '#64748b';
			ctx.font = '600 21px "Noto Sans Thai", sans-serif';
			ctx.fillText(card.label, cardX + 16, statsY + 38);
			ctx.fillStyle = card.color;
			ctx.font = '700 42px "Noto Sans Thai", sans-serif';
			ctx.fillText(card.value, cardX + 16, statsY + 86);
		});

		const summaryBoxY = statsY + 130;
		drawRoundedRect(ctx, padding, summaryBoxY, width - padding * 2, 190, 18);
		ctx.fillStyle = '#ffffff';
		ctx.fill();
		ctx.strokeStyle = '#cbd5e1';
		ctx.stroke();
		ctx.fillStyle = '#0f172a';
		ctx.font = '700 26px "Noto Sans Thai", sans-serif';
		ctx.fillText('ใครทำอะไรบ้าง (Top 5)', padding + 18, summaryBoxY + 36);
		ctx.fillStyle = '#334155';
		ctx.font = '500 20px "Noto Sans Thai", sans-serif';
		assigneeSummary.forEach((person, idx) => {
			const y = summaryBoxY + 70 + idx * 24;
			ctx.fillText(
				`${idx + 1}. ${person.name} • รวม ${person.total} • เสร็จ ${person.done} • กำลังทำ ${person.inProgress} • รอดำเนินการ ${person.todo}`,
				padding + 24,
				y
			);
		});

		const taskBoxY = summaryBoxY + 206;
		drawRoundedRect(ctx, padding, taskBoxY, width - padding * 2, 180, 18);
		ctx.fillStyle = '#ffffff';
		ctx.fill();
		ctx.strokeStyle = '#cbd5e1';
		ctx.stroke();
		ctx.fillStyle = '#0f172a';
		ctx.font = '700 26px "Noto Sans Thai", sans-serif';
		ctx.fillText('รายการงานล่าสุด', padding + 18, taskBoxY + 36);
		ctx.font = '500 18px "Noto Sans Thai", sans-serif';
		keyTasks.slice(0, 6).forEach((task, idx) => {
			const assignee = task.assignee?.name || 'ไม่ระบุ';
			const line = `${idx + 1}. ${task.title || '-'} (${assignee}) • ${normalizeTaskDate(task.date)}`;
			const y = taskBoxY + 66 + idx * 20;
			const wrapped = wrapText(ctx, line, width - padding * 2 - 30);
			ctx.fillText(wrapped[0], padding + 24, y);
		});

		loaded.forEach((item, idx) => {
			const col = idx % cols;
			const row = Math.floor(idx / cols);
			const x = padding + col * (cellWidth + gap);
			const y = padding + headerHeight + row * (cellHeight + gap);

			// Card
			ctx.fillStyle = '#ffffff';
			ctx.strokeStyle = '#cbd5e1';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.roundRect(x, y, cellWidth, cellHeight, 18);
			ctx.fill();
			ctx.stroke();

			// Title
			ctx.fillStyle = '#1e293b';
			ctx.font = '700 28px "Noto Sans Thai", sans-serif';
			ctx.fillText(item.title, x + 18, y + 42);

			// Image
			const imageX = x + 16;
			const imageY = y + 56;
			const imageW = cellWidth - 32;
			const imageH = cellHeight - 72;
			ctx.drawImage(item.img, imageX, imageY, imageW, imageH);
		});

		if (loaded.length === 0) {
			drawRoundedRect(ctx, padding, padding + headerHeight, width - padding * 2, 220, 18);
			ctx.fillStyle = '#ffffff';
			ctx.fill();
			ctx.strokeStyle = '#cbd5e1';
			ctx.stroke();
			ctx.fillStyle = '#0f172a';
			ctx.font = '700 34px "Noto Sans Thai", sans-serif';
			ctx.fillText('ไม่มีกราฟในช่วงข้อมูลนี้', padding + 24, padding + headerHeight + 84);
		}

		return canvas.toDataURL('image/png');
	}

	async function handleExportMarkdown(event?: CustomEvent<number | void>, contextOverride?: { taskSnapshot: Task[]; scopeLabel: string }) {
		try {
			const today = new Date();
			const reportDate = formatDateISO(today);
			const { taskSnapshot, scopeLabel } = contextOverride || await getExportTaskContext(event);

			if (event?.detail && taskSnapshot.length === 0) {
				showMessage($_('page__export_markdown_no_data'), 'error');
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

			showMessage($_('page__export_markdown_success'));
		} catch (e) {
			console.error('Markdown Export Error:', e);
			showMessage($_('page__export_markdown_error'), 'error');
		}
	}

	interface VideoSlide {
		kicker: string;
		title: string;
		subtitle: string;
		accent: string;
		lines: string[];
		celebrate?: boolean;
	}

	function seededValue(seed: string, index: number): number {
		let h = 2166136261;
		const source = `${seed}:${index}`;
		for (let i = 0; i < source.length; i++) {
			h ^= source.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		return (h >>> 0) / 4294967295;
	}

	function drawCelebrationFireworks(
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number,
		progress: number,
		accent: string,
		seedKey: string
	): void {
		const bloom = Math.min(Math.max((progress - 0.15) / 0.7, 0), 1);
		if (bloom <= 0.01) return;

		const bursts = 4;
		for (let i = 0; i < bursts; i++) {
			const burstDelay = i * 0.16;
			const burstProgress = Math.min(Math.max((progress - burstDelay) / 0.55, 0), 1);
			if (burstProgress <= 0 || burstProgress >= 1) continue;

			const originX = width * (0.18 + seededValue(seedKey, i * 5 + 1) * 0.64);
			const originY = height * (0.14 + seededValue(seedKey, i * 5 + 2) * 0.32);
			const radius = 26 + burstProgress * 150;
			const particleCount = 20;

			ctx.save();
			ctx.globalCompositeOperation = 'lighter';
			for (let p = 0; p < particleCount; p++) {
				const baseAngle = (Math.PI * 2 * p) / particleCount;
				const wobble = (seededValue(seedKey, i * 100 + p) - 0.5) * 0.25;
				const angle = baseAngle + wobble;
				const x = originX + Math.cos(angle) * radius;
				const y = originY + Math.sin(angle) * radius;
				const particleRadius = 1.5 + (1 - burstProgress) * 3;
				ctx.globalAlpha = (1 - burstProgress) * (0.35 + seededValue(seedKey, i * 100 + p + 33) * 0.65);
				ctx.fillStyle = p % 3 === 0 ? accent : p % 2 === 0 ? '#ffe082' : '#ffffff';
				ctx.beginPath();
				ctx.arc(x, y, particleRadius, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.restore();
		}

		ctx.save();
		ctx.globalCompositeOperation = 'screen';
		ctx.globalAlpha = 0.08 + bloom * 0.22;
		const glow = ctx.createRadialGradient(width * 0.5, height * 0.22, 30, width * 0.5, height * 0.22, width * 0.45);
		glow.addColorStop(0, accent);
		glow.addColorStop(1, '#00000000');
		ctx.fillStyle = glow;
		ctx.fillRect(0, 0, width, height * 0.7);
		ctx.restore();
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

		ctx.globalAlpha = 0.1;
		for (let i = 0; i < 36; i++) {
			const x = width * seededValue(slide.title, i * 2 + 1);
			const y = height * seededValue(slide.title, i * 2 + 2);
			const twinkle = 1.3 + Math.sin(progress * Math.PI * 6 + i) * 0.9;
			ctx.fillStyle = '#dbeafe';
			ctx.fillRect(x, y, twinkle, twinkle);
		}
		ctx.globalAlpha = 1;

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

		if (slide.celebrate) {
			drawCelebrationFireworks(ctx, width, height, progress, slide.accent, `${slide.kicker}-${slide.title}`);
		}

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
			ctx.fillStyle = '#8cc8ff';
			ctx.font = '700 20px "Trebuchet MS", "Noto Sans Thai", sans-serif';
			ctx.fillText('*', cardX + 52, y);
			ctx.fillStyle = '#ecf2ff';
			ctx.font = '500 30px "Trebuchet MS", "Noto Sans Thai", sans-serif';
			const wrapped = wrapText(ctx, line, cardW - 96);
			for (const part of wrapped.slice(0, 2)) {
				ctx.fillText(part, cardX + 88, y);
				y += 40;
			}
			y += 8;
			if (y > cardY + cardH - 40) break;
		}
		ctx.globalAlpha = 1;
	}

	type ExportAudioBed = {
		track: MediaStreamTrack;
		stop: () => void;
	};

	function createRoyaltyFreeAudioBed(totalDuration: number): ExportAudioBed | null {
		try {
			const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
			if (!AudioCtor) return null;
			const audioContext = new AudioCtor();
			const destination = audioContext.createMediaStreamDestination();
			const master = audioContext.createGain();
			const filter = audioContext.createBiquadFilter();
			const limiter = audioContext.createDynamicsCompressor();

			filter.type = 'lowpass';
			filter.frequency.value = 1500;
			limiter.threshold.value = -20;
			limiter.knee.value = 24;
			limiter.ratio.value = 10;
			limiter.attack.value = 0.003;
			limiter.release.value = 0.15;
			master.gain.value = 0.3;

			master.connect(filter);
			filter.connect(limiter);
			limiter.connect(destination);

			const notes = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
			const startAt = audioContext.currentTime + 0.05;
			const beat = 0.5;
			const totalBeats = Math.max(1, Math.floor(totalDuration / beat));
			for (let i = 0; i < totalBeats; i++) {
				const t = startAt + i * beat;
				const leadFreq = notes[i % notes.length];
				const bassFreq = notes[(i + 3) % notes.length] / 2;

				const lead = audioContext.createOscillator();
				lead.type = 'triangle';
				lead.frequency.setValueAtTime(leadFreq, t);
				const leadGain = audioContext.createGain();
				leadGain.gain.setValueAtTime(0.0001, t);
				leadGain.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
				leadGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
				lead.connect(leadGain);
				leadGain.connect(master);
				lead.start(t);
				lead.stop(t + 0.45);

				const bass = audioContext.createOscillator();
				bass.type = 'sine';
				bass.frequency.setValueAtTime(bassFreq, t);
				const bassGain = audioContext.createGain();
				bassGain.gain.setValueAtTime(0.0001, t);
				bassGain.gain.exponentialRampToValueAtTime(0.055, t + 0.03);
				bassGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);
				bass.connect(bassGain);
				bassGain.connect(master);
				bass.start(t);
				bass.stop(t + 0.5);
			}

			const endAt = startAt + totalBeats * beat + 0.2;
			const stop = () => {
				try {
					audioContext.suspend().catch(() => undefined);
					audioContext.close().catch(() => undefined);
				} catch {
					// Ignore close failures because video export can still finish without audio cleanup.
				}
			};
			window.setTimeout(stop, Math.max(1000, Math.ceil((endAt - audioContext.currentTime) * 1000) + 300));

			const [track] = destination.stream.getAudioTracks();
			if (!track) {
				stop();
				return null;
			}
			return { track, stop };
		} catch {
			return null;
		}
	}

	async function handleExportVideo(event?: CustomEvent<number | void>, contextOverride?: { taskSnapshot: Task[]; scopeLabel: string }) {
		try {
			if (typeof MediaRecorder === 'undefined') {
				showMessage($_('page__export_video_browser_not_supported'), 'error');
				return;
			}

			const now = new Date();
			const reportDate = formatDateISO(now);
			const { taskSnapshot, scopeLabel } = contextOverride || await getExportTaskContext(event);
			if (event?.detail && taskSnapshot.length === 0) {
				showMessage($_('page__export_video_no_data'), 'error');
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

			const slides: VideoSlide[] = [];

			// 1. Cover
			slides.push({
				kicker: 'TASK REPORT VIDEO',
				title: `รายงานงาน ${reportDate}`,
				subtitle: 'Khun Phaen Task Tracker',
				accent: '#35d4ff',
				lines: [
					`ช่วงข้อมูล ${scopeLabel}`,
					`งานทั้งหมด ${taskSnapshot.length} งาน`,
					`เสร็จแล้ว ${doneTasks.length} งาน`,
					`กำลังทำ ${inProgressTasks.length} งาน`,
					`รอดำเนินการ ${todoTasks.length} งาน`
				]
			});

			// 2. Summary & Assignee Performance
			const assigneeStatsMap = new Map<string, { total: number; done: number }>();
			for (const task of taskSnapshot) {
				const name = task.assignee?.name || 'ไม่ระบุ';
				const s = assigneeStatsMap.get(name) || { total: 0, done: 0 };
				s.total++;
				if (task.status === 'done') s.done++;
				assigneeStatsMap.set(name, s);
			}

			const assigneeEntries = [...assigneeStatsMap.entries()].sort((a, b) => b[1].total - a[1].total);
			for (let i = 0; i < assigneeEntries.length; i += 6) {
				const chunk = assigneeEntries.slice(i, i + 6);
				slides.push({
					kicker: 'PERFORMANCE',
					title: 'ความสำเร็จรายบุคคล',
					subtitle: `ผู้รับผิดชอบ ${assigneeEntries.length} คน (หน้า ${Math.floor(i / 6) + 1})`,
					accent: '#a78bff',
					lines: chunk.map(([name, s]) => {
						const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
						return `• ${name}: สำเร็จ ${pct}% (${s.done}/${s.total})`;
					})
				});
			}

			// 3. All Tasks (Paginated)
			const createTaskSlides = (tasks: Task[], kicker: string, title: string, accent: string, celebrate = false): VideoSlide[] => {
				if (tasks.length === 0) return [{
					kicker, title, subtitle: '0 รายการ', accent, lines: ['• ไม่มีงานในหมวดนี้']
				}];
				
				const pageSize = 6;
				const pages: VideoSlide[] = [];
				for (let i = 0; i < tasks.length; i += pageSize) {
					const chunk = tasks.slice(i, i + pageSize);
					pages.push({
						kicker,
						title,
						subtitle: tasks.length > pageSize ? `รายการที่ ${i + 1}-${Math.min(i + pageSize, tasks.length)} / ทั้งหมด ${tasks.length}` : `${tasks.length} รายการ`,
						accent,
						celebrate: celebrate && i === 0,
						lines: chunk.map(summarize)
					});
				}
				return pages;
			};

			slides.push(...createTaskSlides(doneTasks, 'DONE', 'งานที่เสร็จแล้ว', '#64ffa8', true));
			slides.push(...createTaskSlides(inProgressTasks, 'IN PROGRESS', 'งานที่กำลังทำ', '#6ec7ff'));
			slides.push(...createTaskSlides(todoTasks, 'TODO', 'งานรอดำเนินการ', '#ffd470'));

			const canvas = document.createElement('canvas');
			canvas.width = 1280;
			canvas.height = 720;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				showMessage($_('page__export_video_canvas_error'), 'error');
				return;
			}

			const fps = 30;
			const slideDuration = 2.8;
			const transitionDuration = 0.6;
			const totalDuration = slides.length * slideDuration;
			const totalFrames = Math.ceil(totalDuration * fps);
			const stream = canvas.captureStream(fps);
			const audioBed = createRoyaltyFreeAudioBed(totalDuration);
			if (audioBed) {
				stream.addTrack(audioBed.track);
			}
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
			audioBed?.stop();
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
			showMessage($_('page__export_video_success'));
		} catch (error) {
			console.error('Video export failed:', error);
			videoExportInProgress = false;
			if (videoExportTimer) {
				clearInterval(videoExportTimer);
				videoExportTimer = null;
			}
			showMessage($_('page__export_video_error'), 'error');
		}
	}

	async function handleExportSlide(event?: CustomEvent<number | void>, contextOverride?: { taskSnapshot: Task[]; scopeLabel: string }) {
		try {
			const now = new Date();
			const reportDate = formatDateISO(now);
			const { taskSnapshot, scopeLabel } = contextOverride || await getExportTaskContext(event);
			if (event?.detail && taskSnapshot.length === 0) {
				showMessage($_('page__export_slide_no_data'), 'error');
				return;
			}
			if (taskSnapshot.length === 0) {
				showMessage($_('page__export_slide_no_data'), 'error');
				return;
			}

			const doneTasks = sortTasksForReport(taskSnapshot.filter((task) => task.status === 'done'));
			const inProgressTasks = sortTasksForReport(taskSnapshot.filter((task) => task.status === 'in-progress'));
			const todoTasks = sortTasksForReport(taskSnapshot.filter((task) => task.status === 'todo'));
			const assigneeSummary = [...taskSnapshot.reduce((acc, task) => {
				const key = task.assignee?.name || 'ไม่ระบุผู้รับผิดชอบ';
				acc.set(key, (acc.get(key) || 0) + 1);
				return acc;
			}, new Map<string, number>()).entries()]
				.map(([name, count]) => ({ name, count }))
				.sort((a, b) => b.count - a.count)
				.slice(0, 8);

			const pptx = new PptxGenJS();
			pptx.layout = 'LAYOUT_WIDE';
			pptx.author = 'Khun Phaen Task Tracker';
			pptx.subject = 'Task report summary';
			pptx.title = `Task Report ${reportDate}`;

			const addTitle = (slide: PptxGenJS.Slide, title: string, subtitle: string) => {
				slide.background = { color: '0B1B34' };
				slide.addText(title, {
					x: 0.6, y: 0.5, w: 12, h: 0.8,
					fontFace: 'Calibri', fontSize: 34, bold: true, color: 'FFFFFF'
				});
				slide.addText(subtitle, {
					x: 0.6, y: 1.4, w: 12, h: 0.5,
					fontFace: 'Calibri', fontSize: 16, color: 'BFDBFE'
				});
			};

			const cover = pptx.addSlide();
			addTitle(cover, `Task Report - ${reportDate}`, scopeLabel);
			cover.addText(
				[
					{ text: `งานทั้งหมด ${taskSnapshot.length} งาน\n` },
					{ text: `เสร็จแล้ว ${doneTasks.length} งาน\n` },
					{ text: `กำลังทำ ${inProgressTasks.length} งาน\n` },
					{ text: `รอดำเนินการ ${todoTasks.length} งาน` }
				],
				{
					x: 0.7, y: 2.3, w: 5.4, h: 2.2,
					fontFace: 'Calibri', fontSize: 20, color: 'E2E8F0', breakLine: true
				}
			);

			const assigneeSlide = pptx.addSlide();
			addTitle(assigneeSlide, 'Who Did What', 'Top ผู้รับผิดชอบ');
			assigneeSummary.forEach((item, index) => {
				assigneeSlide.addText(`${index + 1}. ${item.name} - ${item.count} งาน`, {
					x: 0.8, y: 2 + index * 0.5, w: 11.5, h: 0.4,
					fontFace: 'Calibri', fontSize: 20, color: 'F8FAFC'
				});
			});

			const taskLine = (task: Task) => {
				const assignee = task.assignee?.name || 'ไม่ระบุ';
				const status = task.status === 'done' ? 'DONE' : task.status === 'in-progress' ? 'IN-PROGRESS' : 'TODO';
				return `${task.title || '-'} (${assignee}) • ${status} • ${normalizeTaskDate(task.date)}`;
			};

			const addTaskSlide = (title: string, list: Task[]) => {
				const slide = pptx.addSlide();
				addTitle(slide, title, `${list.length} งาน`);
				const chunk = list.slice(0, 12);
				chunk.forEach((task, i) => {
					slide.addText(`• ${taskLine(task)}`, {
						x: 0.8, y: 2 + i * 0.42, w: 12, h: 0.35,
						fontFace: 'Calibri', fontSize: 14, color: 'E2E8F0'
					});
				});
				if (list.length === 0) {
					slide.addText('ไม่มีงานในหมวดนี้', {
						x: 0.8, y: 2.2, w: 8, h: 0.5,
						fontFace: 'Calibri', fontSize: 18, color: 'CBD5E1'
					});
				}
			};

			addTaskSlide('Done Tasks', doneTasks);
			addTaskSlide('In Progress Tasks', inProgressTasks);
			addTaskSlide('Todo Tasks', todoTasks);

			await pptx.writeFile({ fileName: `task_report_${reportDate}_${formatExportTimestamp().split('_')[1]}.pptx` });
			showMessage($_('page__export_slide_success'));
		} catch (error) {
			console.error('Slide export failed:', error);
			showMessage($_('page__export_slide_error'), 'error');
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
							ระบบ: Khun Phaen Task Tracker
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
						© ${new Date().getFullYear()} Khun Phaen Task Tracker - สร้างด้วยความภาคภูมิใจ
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
				
				showMessage($_('page__export_pdf_success'));
			} else {
				showMessage($_('page__export_pdf_browser_not_supported'), 'error');
			}
		} catch (e) {
			console.error('PDF Export Error:', e);
			showMessage($_('page__export_pdf_error'), 'error');
		}
	}

	async function handleExportMonthlyPDF() {
		const context = getMonthlyExportTaskContext();
		if (context.taskSnapshot.length === 0) {
			showMessage($_('page__export_monthly_pdf_no_data'), 'error');
			return;
		}
		try {
			const chartImages = await captureMonthlyChartImages();
			const chartsHtml = chartImages.length > 0
				? `<div style="margin-top:20px; page-break-inside:avoid;">
						<h2 style="font-family:'Noto Sans Thai',sans-serif; font-size:16px; margin-bottom:10px;">กราฟวิเคราะห์ (30 วัน)</h2>
						<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
							${chartImages.map((item) => `
								<div style="border:1px solid #e2e8f0; border-radius:10px; padding:8px;">
									<div style="font-size:12px; color:#334155; margin-bottom:6px;">${item.title}</div>
									<img src="${item.image}" style="width:100%; border-radius:8px;" />
								</div>
							`).join('')}
						</div>
				   </div>`
				: '';
			const htmlContent = `
				${buildTaskReportHtml(context.taskSnapshot, context.scopeLabel).replace(
					'</body>',
					`${chartsHtml}</body>`
				)}
			`;
			const printWindow = window.open('', '_blank');
			if (printWindow) {
				printWindow.document.write(htmlContent);
				printWindow.document.close();
				setTimeout(() => printWindow.print(), 800);
				showMessage($_('page__export_monthly_pdf_success'));
			} else {
				showMessage($_('page__export_monthly_pdf_browser_not_supported'), 'error');
			}
		} catch (error) {
			console.error('Monthly PDF export failed:', error);
			showMessage($_('page__export_monthly_pdf_error'), 'error');
		}
	}

	async function handleExportMonthlyXlsx() {
		const context = getMonthlyExportTaskContext();
		if (context.taskSnapshot.length === 0) {
			showMessage($_('page__export_monthly_xlsx_no_data'), 'error');
			return;
		}
		try {
			const rows = context.taskSnapshot.map((task, index) => ({
				no: index + 1,
				title: task.title || '',
				project: task.project || '',
				assignee: task.assignee?.name || '',
				status: task.status,
				date: normalizeTaskDate(task.date),
				end_date: normalizeTaskDate(task.end_date),
				duration_minutes: task.duration_minutes || 0,
				is_archived: task.is_archived ? 1 : 0
			}));
			const summaryRows = [
				{ metric: 'ช่วงข้อมูล', value: context.scopeLabel },
				{ metric: 'งานทั้งหมด', value: context.taskSnapshot.length },
				{ metric: 'เสร็จแล้ว', value: context.taskSnapshot.filter((t) => t.status === 'done').length },
				{ metric: 'กำลังทำ', value: context.taskSnapshot.filter((t) => t.status === 'in-progress').length },
				{ metric: 'รอดำเนินการ', value: context.taskSnapshot.filter((t) => t.status === 'todo').length },
				{ metric: 'Archived', value: context.taskSnapshot.filter((t) => t.is_archived).length }
			];

			const wb = XLSX.utils.book_new();
			const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
			const tasksSheet = XLSX.utils.json_to_sheet(rows);
			XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
			XLSX.utils.book_append_sheet(wb, tasksSheet, 'Tasks');
			XLSX.writeFile(wb, `monthly_summary_${formatExportTimestamp()}.xlsx`);
			showMessage($_('page__export_monthly_xlsx_success'));
		} catch (error) {
			console.error('Monthly XLSX export failed:', error);
			showMessage($_('page__export_monthly_xlsx_error'), 'error');
		}
	}

	async function handleExportMonthlyPng() {
		const context = getMonthlyExportTaskContext();
		if (context.taskSnapshot.length === 0) {
			showMessage($_('page__export_monthly_png_no_data'), 'error');
			return;
		}
		if (!monthlySummaryRef) {
			showMessage($_('page__export_monthly_png_no_data'), 'error');
			return;
		}
		try {
			const chartImages = await captureMonthlyChartImages();
			const dataUrl = await composeMonthlyReportImage(chartImages, monthlySummary.periodLabel, context.taskSnapshot);
			const link = document.createElement('a');
			link.href = dataUrl;
			link.download = `monthly_summary_${formatExportTimestamp()}.png`;
			link.click();
			showMessage($_('page__export_monthly_png_success'));
		} catch (error) {
			console.error('Monthly PNG export failed:', error);
			showMessage($_('page__export_monthly_png_error'), 'error');
		}
	}

	async function handleExportMonthlyVideo() {
		const context = getMonthlyExportTaskContext();
		if (context.taskSnapshot.length === 0) {
			showMessage($_('page__export_monthly_video_no_data'), 'error');
			return;
		}
		try {
			if (typeof MediaRecorder === 'undefined') {
				showMessage($_('page__export_monthly_video_browser_not_supported'), 'error');
				return;
			}

			const chartImages = await captureMonthlyChartImages();
			const chartAssets = await Promise.all(
				chartImages.map(async (item) => ({
					title: item.title,
					img: await loadImage(item.image)
				}))
			);
			const taskSnapshot = [...context.taskSnapshot];
			const doneTasks = taskSnapshot.filter((task) => task.status === 'done');
			const inProgressTasks = taskSnapshot.filter((task) => task.status === 'in-progress');
			const todoTasks = taskSnapshot.filter((task) => task.status === 'todo');
			const assigneeMap = new Map<string, { total: number; done: number; inProgress: number; todo: number; tasks: Task[] }>();
			for (const task of taskSnapshot) {
				const name = task.assignee?.name || 'ไม่ระบุผู้รับผิดชอบ';
				const current = assigneeMap.get(name) || { total: 0, done: 0, inProgress: 0, todo: 0, tasks: [] };
				current.total += 1;
				if (task.status === 'done') current.done += 1;
				else if (task.status === 'in-progress') current.inProgress += 1;
				else current.todo += 1;
				current.tasks.push(task);
				assigneeMap.set(name, current);
			}
			const chartPages: Array<Array<{ title: string; img: HTMLImageElement }>> = [];
			for (let i = 0; i < chartAssets.length; i += 2) {
				chartPages.push(chartAssets.slice(i, i + 2));
			}

			// Build dynamic pages
			type MonthlyPage = 
				| { type: 'cover' }
				| { type: 'summary' }
				| { type: 'assignee-list', data: any[] }
				| { type: 'all-tasks', tasks: Task[], startIndex: number, total: number }
				| { type: 'assignee-tasks', assignee: any, tasks: Task[], startIndex: number, totalCount: number }
				| { type: 'chart', charts: any[], pageIndex: number };

			const pages: MonthlyPage[] = [];
			pages.push({ type: 'cover' });
			pages.push({ type: 'summary' });

			// Assignee Summaries (4 per page)
			const sortedAssignees = [...assigneeMap.entries()]
				.map(([name, info]) => ({ name, ...info }))
				.sort((a, b) => b.total - a.total);
			
			for (let i = 0; i < sortedAssignees.length; i += 4) {
				pages.push({ type: 'assignee-list', data: sortedAssignees.slice(i, i + 4) });
			}

			// All Tasks (8 per page)
			const sortedAllTasks = [...taskSnapshot].sort((a, b) => normalizeTaskDate(b.date).localeCompare(normalizeTaskDate(a.date)));
			for (let i = 0; i < sortedAllTasks.length; i += 8) {
				pages.push({ type: 'all-tasks', tasks: sortedAllTasks.slice(i, i + 8), startIndex: i, total: sortedAllTasks.length });
			}

			// Individual Assignee Task details
			for (const a of sortedAssignees) {
				const aTasks = [...a.tasks].sort((a, b) => normalizeTaskDate(b.date).localeCompare(normalizeTaskDate(a.date)));
				for (let i = 0; i < aTasks.length; i += 7) {
					pages.push({ type: 'assignee-tasks', assignee: a, tasks: aTasks.slice(i, i + 7), startIndex: i, totalCount: aTasks.length });
				}
			}

			// Chart pages
			chartPages.forEach((charts, idx) => pages.push({ type: 'chart', charts, pageIndex: idx }));

			const totalSlides = pages.length;

			const renderCover = (progress: number) => {
				const reveal = Math.min(Math.max(progress / 0.6, 0), 1);
				const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
				bg.addColorStop(0, '#0b1b34');
				bg.addColorStop(1, '#112a50');
				ctx.fillStyle = bg;
				ctx.fillRect(0, 0, canvas.width, canvas.height);

				const orb = ctx.createRadialGradient(1020, 160, 40, 1020, 160, 320);
				orb.addColorStop(0, '#5eead4aa');
				orb.addColorStop(1, '#00000000');
				ctx.fillStyle = orb;
				ctx.fillRect(0, 0, canvas.width, canvas.height);

				ctx.globalAlpha = reveal;
				ctx.fillStyle = '#7dd3fc';
				ctx.font = '700 28px "Trebuchet MS", "Noto Sans Thai", sans-serif';
				ctx.fillText('MONTHLY PERFORMANCE REPORT', 88, 110);
				ctx.fillStyle = '#ffffff';
				ctx.font = '700 58px "Trebuchet MS", "Noto Sans Thai", sans-serif';
				ctx.fillText('สรุปผลงานรายเดือน', 88, 188);
				ctx.fillStyle = '#dbeafe';
				ctx.font = '400 30px "Trebuchet MS", "Noto Sans Thai", sans-serif';
				ctx.fillText(monthlySummary.periodLabel, 88, 234);
				ctx.fillStyle = '#cbd5e1';
				ctx.font = '500 26px "Trebuchet MS", "Noto Sans Thai", sans-serif';
				ctx.fillText(`จำนวนงาน ${taskSnapshot.length} งาน  •  ผู้รับผิดชอบ ${assigneeMap.size} คน`, 88, 298);
				ctx.globalAlpha = 1;
			};

			const renderSummaryPage = () => {
				const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
				bg.addColorStop(0, '#eff6ff');
				bg.addColorStop(1, '#dbeafe');
				ctx.fillStyle = bg;
				ctx.fillRect(0, 0, canvas.width, canvas.height);
				ctx.fillStyle = '#0f172a';
				ctx.font = '700 42px "Trebuchet MS", "Noto Sans Thai", sans-serif';
				ctx.fillText('ภาพรวมผลลัพธ์', 60, 76);
				const cards = [
					{ label: 'งานทั้งหมด', value: `${taskSnapshot.length}`, color: '#0f172a' },
					{ label: 'เสร็จแล้ว', value: `${doneTasks.length}`, color: '#16a34a' },
					{ label: 'กำลังทำ', value: `${inProgressTasks.length}`, color: '#2563eb' },
					{ label: 'รอดำเนินการ', value: `${todoTasks.length}`, color: '#d97706' }
				];
				cards.forEach((card, i) => {
					const x = 60 + i * 295;
					drawRoundedRect(ctx, x, 118, 260, 150, 16);
					ctx.fillStyle = '#ffffff';
					ctx.fill();
					ctx.strokeStyle = '#cbd5e1';
					ctx.stroke();
					ctx.fillStyle = '#64748b';
					ctx.font = '600 22px "Trebuchet MS", "Noto Sans Thai", sans-serif';
					ctx.fillText(card.label, x + 18, 165);
					ctx.fillStyle = card.color;
					ctx.font = '700 56px "Trebuchet MS", "Noto Sans Thai", sans-serif';
					ctx.fillText(card.value, x + 18, 232);
				});
				ctx.fillStyle = '#334155';
				ctx.font = '500 26px "Trebuchet MS", "Noto Sans Thai", sans-serif';
				ctx.fillText(`งานเฉลี่ย/วัน ${monthlySummary.avgPerDay.toFixed(2)}`, 60, 328);
			};

			const renderAssigneePage = (list: any[]) => {
				const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
				bg.addColorStop(0, '#f8fafc');
				bg.addColorStop(1, '#e2e8f0');
				ctx.fillStyle = bg;
				ctx.fillRect(0, 0, canvas.width, canvas.height);
				ctx.fillStyle = '#0f172a';
				ctx.font = '700 38px "Trebuchet MS", "Noto Sans Thai", sans-serif';
				ctx.fillText('ใครทำอะไรบ้าง', 60, 72);
				ctx.fillStyle = '#475569';
				ctx.font = '500 22px "Trebuchet MS", "Noto Sans Thai", sans-serif';
				ctx.fillText(`สรุปความสำเร็จแยกตามรายบุคคล (${sortedAssignees.length} คน)`, 60, 102);
				list.forEach((a, i) => {
					const y = 136 + i * 138;
					drawRoundedRect(ctx, 60, y, 1160, 118, 14);
					ctx.fillStyle = '#ffffff';
					ctx.fill();
					ctx.strokeStyle = '#cbd5e1';
					ctx.stroke();
					ctx.fillStyle = '#0f172a';
					ctx.font = '700 30px "Trebuchet MS", "Noto Sans Thai", sans-serif';
					ctx.fillText(a.name, 84, y + 44);
					ctx.fillStyle = '#334155';
					ctx.font = '500 22px "Trebuchet MS", "Noto Sans Thai", sans-serif';
					const pct = a.total > 0 ? Math.round((a.done / a.total) * 100) : 0;
					ctx.fillText(`สำเร็จ ${pct}% • รวม ${a.total} งาน • เสร็จ ${a.done} • กำลังทำ ${a.inProgress} • รอดำเนินการ ${a.todo}`, 84, y + 82);
				});
			};

			const renderTaskPage = (tasks: Task[], startIdx: number, total: number) => {
				const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
				bg.addColorStop(0, '#eef2ff');
				bg.addColorStop(1, '#e0e7ff');
				ctx.fillStyle = bg;
				ctx.fillRect(0, 0, canvas.width, canvas.height);
				ctx.fillStyle = '#0f172a';
				ctx.font = '700 38px "Trebuchet MS", "Noto Sans Thai", sans-serif';
				ctx.fillText('รายการงานทั้งหมดในรอบเดือน', 60, 72);
				ctx.fillStyle = '#475569';
				ctx.font = '500 20px "Trebuchet MS", "Noto Sans Thai", sans-serif';
				ctx.fillText(`งานที่ ${startIdx + 1}-${Math.min(startIdx + tasks.length, total)} จากทั้งหมด ${total} งาน`, 60, 102);
				tasks.forEach((task, i) => {
					const y = 130 + i * 72;
					const statusColor = task.status === 'done' ? '#16a34a' : task.status === 'in-progress' ? '#2563eb' : '#d97706';
					ctx.fillStyle = '#ffffff';
					drawRoundedRect(ctx, 60, y, 1160, 58, 12);
					ctx.fill();
					ctx.strokeStyle = '#cbd5e1';
					ctx.stroke();
					ctx.fillStyle = '#0f172a';
					ctx.font = '600 21px "Trebuchet MS", "Noto Sans Thai", sans-serif';
					const assignee = task.assignee?.name || 'ไม่ระบุ';
					const title = `${task.title || '-'} (${assignee})`;
					const wrapped = wrapText(ctx, title, 880);
					ctx.fillText(wrapped[0], 82, y + 35);
					ctx.fillStyle = statusColor;
					ctx.font = '700 18px "Trebuchet MS", "Noto Sans Thai", sans-serif';
					ctx.fillText(task.status === 'done' ? 'DONE' : task.status === 'in-progress' ? 'IN PROGRESS' : 'TODO', 980, y + 35);
					ctx.fillStyle = '#475569';
					ctx.font = '500 16px "Trebuchet MS", "Noto Sans Thai", sans-serif';
					ctx.fillText(normalizeTaskDate(task.date), 1120, y + 35);
				});
			};

			const renderAssigneeTaskPage = (
				entry: any,
				tasks: Task[],
				startIdx: number,
				totalCount: number
			) => {
				const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
				bg.addColorStop(0, '#f0f9ff');
				bg.addColorStop(1, '#dbeafe');
				ctx.fillStyle = bg;
				ctx.fillRect(0, 0, canvas.width, canvas.height);
				ctx.fillStyle = '#0f172a';
				ctx.font = '700 38px "Trebuchet MS", "Noto Sans Thai", sans-serif';
				ctx.fillText(`งานของ ${entry.name}`, 60, 70);
				ctx.fillStyle = '#334155';
				ctx.font = '500 21px "Trebuchet MS", "Noto Sans Thai", sans-serif';
				ctx.fillText(
					`รายการที่ ${startIdx + 1}-${Math.min(startIdx + tasks.length, totalCount)} • รวม ${entry.total} งาน • เสร็จ ${entry.done} • กำลังทำ ${entry.inProgress} • รอดำเนินการ ${entry.todo}`,
					60,
					102
				);

				tasks.forEach((task, i) => {
					const y = 130 + i * 80;
					const statusColor = task.status === 'done' ? '#16a34a' : task.status === 'in-progress' ? '#2563eb' : '#d97706';
					drawRoundedRect(ctx, 60, y, 1160, 66, 12);
					ctx.fillStyle = '#ffffff';
					ctx.fill();
					ctx.strokeStyle = '#cbd5e1';
					ctx.stroke();

					ctx.fillStyle = '#0f172a';
					ctx.font = '600 20px "Trebuchet MS", "Noto Sans Thai", sans-serif';
					const projectTag = task.project ? ` (${task.project})` : '';
					const archivedTag = task.is_archived ? ' [ARCHIVED]' : '';
					const line = `${task.title || '-'}${projectTag}${archivedTag}`;
					const wrapped = wrapText(ctx, line, 860);
					ctx.fillText(wrapped[0], 82, y + 32);

					ctx.fillStyle = statusColor;
					ctx.font = '700 16px "Trebuchet MS", "Noto Sans Thai", sans-serif';
					ctx.fillText(task.status === 'done' ? 'DONE' : task.status === 'in-progress' ? 'IN PROGRESS' : 'TODO', 960, y + 28);

					ctx.fillStyle = '#475569';
					ctx.font = '500 15px "Trebuchet MS", "Noto Sans Thai", sans-serif';
					ctx.fillText(normalizeTaskDate(task.date), 1088, y + 28);
				});
			};

			const renderChartPage = (charts: Array<{ title: string; img: HTMLImageElement }>, pageIndex: number) => {
				const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
				bg.addColorStop(0, '#eef6ff');
				bg.addColorStop(1, '#dbeafe');
				ctx.fillStyle = bg;
				ctx.fillRect(0, 0, canvas.width, canvas.height);

				ctx.fillStyle = '#0f172a';
				ctx.font = '700 34px "Trebuchet MS", "Noto Sans Thai", sans-serif';
				ctx.fillText(`กราฟวิเคราะห์ (${pageIndex + 1}/${Math.max(1, chartPages.length)})`, 52, 58);
				ctx.fillStyle = '#334155';
				ctx.font = '500 20px "Trebuchet MS", "Noto Sans Thai", sans-serif';
				ctx.fillText(monthlySummary.periodLabel, 52, 88);

				const cardWidth = 560;
				const cardHeight = 256;
				const cardX = 52;
				const secondX = 668;
				const cardY = 118;
				const gapY = 292;

				const positions = [
					{ x: cardX, y: cardY },
					{ x: secondX, y: cardY },
					{ x: cardX, y: cardY + gapY },
					{ x: secondX, y: cardY + gapY }
				];

				charts.forEach((chart, idx) => {
					const p = positions[idx];
					drawRoundedRect(ctx, p.x, p.y, cardWidth, cardHeight, 16);
					ctx.fillStyle = '#ffffff';
					ctx.fill();
					ctx.strokeStyle = '#cbd5e1';
					ctx.lineWidth = 1.5;
					ctx.stroke();

					ctx.fillStyle = '#0f172a';
					ctx.font = '700 20px "Trebuchet MS", "Noto Sans Thai", sans-serif';
					ctx.fillText(chart.title, p.x + 16, p.y + 30);
					ctx.drawImage(chart.img, p.x + 12, p.y + 42, cardWidth - 24, cardHeight - 54);
				});
			};

			const fps = 30;
			const slideDuration = 3.2;
			const transitionDuration = 0.6;
			const totalDuration = totalSlides * slideDuration;
			const totalFrames = Math.ceil(totalDuration * fps);
			const stream = canvas.captureStream(fps);
			const audioBed = createRoyaltyFreeAudioBed(totalDuration);
			if (audioBed) {
				stream.addTrack(audioBed.track);
			}

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

			const renderSlideByIndex = (index: number, progress = 0) => {
				const page = pages[index];
				if (!page) return;

				if (page.type === 'cover') {
					renderCover(progress);
				} else if (page.type === 'summary') {
					renderSummaryPage();
				} else if (page.type === 'assignee-list') {
					renderAssigneePage(page.data);
				} else if (page.type === 'all-tasks') {
					renderTaskPage(page.tasks, page.startIndex, page.total);
				} else if (page.type === 'assignee-tasks') {
					renderAssigneeTaskPage(page.assignee, page.tasks, page.startIndex, page.totalCount);
				} else if (page.type === 'chart') {
					renderChartPage(page.charts, page.pageIndex);
				}
			};

			for (let frame = 0; frame < totalFrames; frame++) {
				const t = frame / fps;
				const slideIndex = Math.min(Math.floor(t / slideDuration), totalSlides - 1);
				const localT = t - slideIndex * slideDuration;
				const progress = Math.min(localT / slideDuration, 1);
				renderSlideByIndex(slideIndex, progress);

				if (localT > slideDuration - transitionDuration && slideIndex < totalSlides - 1) {
					const blend = (localT - (slideDuration - transitionDuration)) / transitionDuration;
					ctx.globalAlpha = Math.min(Math.max(blend, 0), 1);
					renderSlideByIndex(slideIndex + 1, 0);
					ctx.globalAlpha = 1;
				}

				videoExportPercent = Math.min(100, Math.round(((frame + 1) / totalFrames) * 100));
				await new Promise((resolve) => setTimeout(resolve, 1000 / fps));
			}

			await new Promise((resolve) => setTimeout(resolve, 120));
			recorder.stop();
			await stopPromise;
			audioBed?.stop();
			stream.getTracks().forEach((track) => track.stop());

			const blob = new Blob(chunks, { type: mimeType });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
			link.href = url;
			link.download = `monthly_report_${reportDate}_${timeStr}.webm`;
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
			showMessage($_('page__export_monthly_video_success'));
		} catch (error) {
			console.error('Monthly Video export failed:', error);
			videoExportInProgress = false;
			if (videoExportTimer) {
				clearInterval(videoExportTimer);
				videoExportTimer = null;
			}
			showMessage($_('page__export_monthly_video_error'), 'error');
		}
	}

	async function handleExportMonthlySlide() {
		const context = getMonthlyExportTaskContext();
		if (context.taskSnapshot.length === 0) {
			showMessage($_('page__export_monthly_slide_no_data'), 'error');
			return;
		}
		await handleExportSlide(undefined, context);
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
			showMessage($_('page__import_success', { values: { tasks: result.tasks, added: actualAdded, projects: result.projects, assignees: result.assignees, sprints: result.sprints } }));
			queueHostRealtimeSync('import-csv');
		} catch (e) {
			console.error('❌ Import error:', e);
			showMessage($_('page__import_error') + ': ' + (e instanceof Error ? e.message : 'Unknown error'), 'error');
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
		<div class="bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-70">
			<svg class="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="10" stroke-opacity="0.3"></circle>
				<path d="M22 12a10 10 0 0 1-10 10"></path>
			</svg>
			<div class="flex-1">
				<div class="text-sm font-semibold">{$_('page__video_export_progress', { values: { percent: videoExportPercent } })}</div>
				<div class="text-xs text-blue-100">{$_('page__video_export_time', { values: { time: formatElapsedTime(videoExportElapsedMs) } })}</div>
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
				placeholder={$_('page__search_placeholder')}
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
					title={$_('page__search_wasm_active')}
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
				<span class="hidden sm:inline">{$_('page__filters')}</span>
			</button>

			<!-- Worker Management -->
			<button
				on:click={() => showWorkerManager = true}
				class="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
			>
				<Users size={16} />
				<span class="hidden sm:inline">{$_('page__team')}</span>
			</button>

			<!-- Project Management -->
			<button
				on:click={() => showProjectManager = true}
				class="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
			>
				<Folder size={16} />
				<span class="hidden sm:inline">{$_('page__projects')}</span>
			</button>
			
			<!-- Sprint Management -->
			<button
				on:click={() => showSprintManager = true}
				class="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
			>
				<Flag size={16} />
				<span class="hidden sm:inline">{$_('page__sprint')}</span>
			</button>

			<button
				on:click={() => showMonthlySummary = true}
				class="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
				title={$_('page__summary_30_days')}
			>
				<CalendarDays size={16} />
				<span class="hidden sm:inline">{$_('page__summary_30_days')}</span>
			</button>

			<button
				on:click={() => showDailyReflect = true}
				class="flex items-center gap-2 px-4 py-2 border border-blue-300 dark:border-blue-600 rounded-lg bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 transition-colors"
				title={$_('dailyReflect__title')}
			>
				<MessageSquareQuote size={16} />
				<span class="hidden sm:inline">{$_('dailyReflect__btn_open')}</span>
			</button>

			<ExportImport
				on:exportCSV={handleExportCSV}
				on:exportPDF={handleExportPDF}
				on:exportPNG={() => showMessage($_('page__export_png_success'))}
				on:exportMarkdown={handleExportMarkdown}
				on:exportVideo={handleExportVideo}
				on:exportSlide={handleExportSlide}
				on:exportDatabase={handleExportDatabase}
				on:importCSV={handleImportCSV}
			/>
			
			<!-- Server Sync Panel -->
			<ServerSyncPanel 
				on:dataImported={async (e) => {
					console.log('🔄 Data imported from sync, reloading...');
					await loadData();
					showMessage($_('page__sync_success', { values: { count: e.detail.count } }));
				}}
				on:error={(e) => {
					console.error('Sync error:', e.detail.message);
					showMessage($_('page__sync_error') + ': ' + e.detail.message);
				}}
			/>
		</div>
	</div>
	
	{#if $wasmReady && searchInput}
		<div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 -mt-4">
			<Sparkles size={14} class="text-green-500" />
			<span>{$_('page__search_results', { values: { count: filteredTasks.length, query: searchInput } })}</span>
			<button 
				on:click={handleClearSearch}
				class="text-primary hover:underline ml-2"
			>
				{$_('page__search_clear')}
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
					{:else if tab.icon === 'GanttChart'}
						<GanttChart size={16} />
					{/if}
					<span class="hidden sm:inline">{$_(`tabs__${tab.id}`)}</span>
				</button>
			{/each}
		</div>
		
		<!-- Tab Settings -->
		<div class="relative">
			<button
				on:click={() => showTabSettings = !showTabSettings}
				class="flex items-center justify-center gap-2 px-4 py-2 h-10 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
				title={$_('page__tab_settings')}
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
			<span class="hidden sm:inline">{$_('page__add_task')}</span>
		</button>
	</div>
	<!-- Filters Panel -->
	{#if showFilters}
		<div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 space-y-4 transition-colors">
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

				<div>
					<label for="startDate" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{$_('page__filter_start_date')}</label>
					<CustomDatePicker
						id="startDate"
						bind:value={filters.startDate}
						placeholder="เลือกวันเริ่มต้น..."
					/>
				</div>

				<div>
					<label for="endDate" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{$_('page__filter_end_date')}</label>
					<CustomDatePicker
						id="endDate"
						bind:value={filters.endDate}
						placeholder="เลือกวันสิ้นสุด..."
					/>
				</div>

				<div>
					<label for="status" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{$_('page__filter_status')}</label>
					<SearchableSelect
						id="status"
						bind:value={filters.status}
						options={[
							{ value: 'all', label: $_('page__filter_status_all') },
							{ value: 'todo', label: $_('page__filter_status_todo'), badge: true, badgeColor: 'bg-gray-400' },
							{ value: 'in-progress', label: $_('page__filter_status_in_progress'), badge: true, badgeColor: 'bg-blue-500' },
							{ value: 'done', label: $_('page__filter_status_done'), badge: true, badgeColor: 'bg-green-500' },
							{ value: 'archived', label: $_('page__filter_status_archived'), badge: true, badgeColor: 'bg-gray-600' }
						]}
						placeholder="ค้นหาสถานะ..."
						showSearch={false}
					/>
				</div>

				<div>
					<label for="category" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{$_('page__filter_category')}</label>
					<SearchableSelect
						id="category"
						bind:value={filters.category}
						options={[
							{ value: 'all', label: $_('page__filter_category_all') },
							...categories.map(cat => ({ value: cat, label: cat }))
						]}
						placeholder="ค้นหาหมวดหมู่..."
					/>
				</div>

				<div>
					<label for="project" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{$_('page__filter_project')}</label>
					<SearchableSelect
						id="project"
						bind:value={filters.project}
						options={[
							{ value: 'all', label: $_('page__filter_project_all') },
							...projects.map(proj => ({ value: proj, label: proj }))
						]}
						placeholder="ค้นหาโปรเจค..."
					/>
				</div>

				<div>
					<label for="assignee" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{$_('page__filter_assignee')}</label>
					<SearchableSelect
						id="assignee"
						bind:value={filters.assignee_id}
						options={[
							{ value: 'all', label: $_('page__filter_assignee_all') },
							{ value: null, label: $_('page__unassigned'), badge: true, badgeColor: 'bg-gray-300' },
							...assignees
							.filter((a) => a.id !== undefined)
							.map(a => ({ 
								value: a.id!, 
								label: a.name,
								badge: true,
								badgeColor: a.color ? '' : 'bg-indigo-500'
							}))
						]}
						placeholder="ค้นหาผู้รับผิดชอบ..."
					/>
				</div>
				
				<div>
					<label for="sprint" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{$_('page__filter_sprint')}</label>
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
					{$_('page__btn_apply')}
				</button>
				<button
					on:click={clearFilters}
					class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
				>
					{$_('page__btn_clear')}
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
		{:else if currentView === 'gantt'}
			<GanttView
				tasks={filteredTasks}
				sprints={$sprints}
				on:edit={handleEditTask}
			/>
		{/if}
	</div>

		{#if showMonthlySummary}
			<div
				class="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-20 backdrop-blur-sm"
				on:click|self={() => showMonthlySummary = false}
				on:keydown={(event) => event.key === 'Escape' && (showMonthlySummary = false)}
				role="button"
				tabindex="0"
				aria-label={$_('page__summary_30_days')}
			>
			<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" bind:this={monthlySummaryRef}>
				<div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
					<div>
						<h3 class="text-xl font-bold text-gray-900 dark:text-white">{$_('page__summary_30_days')}</h3>
						<p class="text-sm text-gray-500 dark:text-gray-400">{monthlySummary.periodLabel}</p>
					</div>
					<div class="flex items-center gap-2">
						<button
							on:click={handleExportMonthlyPDF}
							class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
							title="Export PDF"
							aria-label="Export PDF"
						>
							<FileText size={16} />
						</button>
						<button
							on:click={handleExportMonthlyXlsx}
							class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
							title="Export XLSX"
							aria-label="Export XLSX"
						>
							<FileSpreadsheet size={16} />
						</button>
						<button
							on:click={handleExportMonthlyPng}
							class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
							title="Export PNG"
							aria-label="Export PNG"
						>
							<ImageIcon size={16} />
						</button>
						<button
							on:click={handleExportMonthlyVideo}
							class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
							title="Export Video"
							aria-label="Export Video"
						>
							<Video size={16} />
						</button>
						<button
							on:click={handleExportMonthlySlide}
							class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
							title="Export Slide"
							aria-label="Export Slide"
						>
							<Presentation size={16} />
						</button>
						<button
							on:click={() => showMonthlySummary = false}
							class="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xl"
							title={$_('taskForm__btn_close')}
						>
							&times;
						</button>
					</div>
				</div>

				<div class="p-6 overflow-y-auto space-y-6">
					<div class="grid grid-cols-2 md:grid-cols-5 gap-3">
						<div class="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-700/40">
							<p class="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wide">{$_('statsPanel__total_tasks')}</p>
							<p class="text-2xl font-black text-gray-900 dark:text-white leading-tight">{monthlySummary.total}</p>
						</div>
						<div class="rounded-xl border border-green-200/50 dark:border-green-800/50 p-3 bg-green-50/50 dark:bg-green-900/20">
							<p class="text-xs text-green-700 dark:text-green-400 font-medium">{$_('page__filter_status_done')}</p>
							<p class="text-2xl font-black text-green-700 dark:text-green-300 leading-tight">{monthlySummary.done}</p>
						</div>
						<div class="rounded-xl border border-blue-200/50 dark:border-blue-800/50 p-3 bg-blue-50/50 dark:bg-blue-900/20">
							<p class="text-xs text-blue-700 dark:text-blue-400 font-medium">{$_('page__filter_status_in_progress')}</p>
							<p class="text-2xl font-black text-blue-700 dark:text-blue-300 leading-tight">{monthlySummary.inProgress}</p>
						</div>
						<div class="rounded-xl border border-amber-200/50 dark:border-amber-800/50 p-3 bg-amber-50/50 dark:bg-amber-900/20">
							<p class="text-xs text-amber-700 dark:text-amber-400 font-medium">{$_('page__filter_status_todo')}</p>
							<p class="text-2xl font-black text-amber-700 dark:text-amber-300 leading-tight">{monthlySummary.todo}</p>
						</div>
						<div class="rounded-xl border border-slate-200/50 dark:border-slate-700/50 p-3 bg-slate-50/50 dark:bg-slate-900/20">
							<p class="text-xs text-slate-700 dark:text-slate-400 font-medium">{$_('taskList__archived')}</p>
							<p class="text-2xl font-black text-slate-700 dark:text-slate-300 leading-tight">{monthlySummary.archived}</p>
						</div>
					</div>

					<div class="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-linear-to-br from-slate-50 to-blue-50 dark:from-gray-800 dark:to-gray-900">
						<p class="text-[10px] text-gray-500 dark:text-gray-400 mb-2 font-bold uppercase tracking-widest">
							{$_('monthlyCharts__avg_day')}: {monthlySummary.avgPerDay.toFixed(2)} · {$_('monthlyCharts__total_time')}: {(monthlySummary.totalMinutes / 60).toFixed(1)} {$_('statsPanel__hours_short')}
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
						<h4 class="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
							<span class="w-1 h-4 bg-primary rounded-full"></span>
							{$_('monthlyCharts__recent_tasks_title')}
						</h4>
						<div class="space-y-0.5">
							{#if monthlySummary.recentTasks.length === 0}
								<div class="py-10 text-center">
									<p class="text-sm text-gray-500 dark:text-gray-400">{$_('monthlyCharts__no_tasks_period')}</p>
								</div>
							{:else}
								{#each monthlySummary.recentTasks as task}
									<div class="flex items-center justify-between gap-3 py-3 px-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0">
										<div class="min-w-0 flex-1">
											<p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{task.title}</p>
											<div class="flex items-center gap-2 mt-1">
												<span class="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded font-bold uppercase truncate max-w-[120px]">
													{task.project || $_('page__unassigned_project')}
												</span>
												<span class="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
													{task.assignee?.name || $_('page__unassigned')}
												</span>
											</div>
										</div>
										<div class="text-right shrink-0">
											<p class="text-[10px] text-gray-400 dark:text-gray-500 font-bold mb-1">{normalizeTaskDate(task.date)}</p>
											<span class="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase {task.status === 'done' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : task.status === 'in-progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}">
												{task.status === 'done' ? $_('page__filter_status_done') : task.status === 'in-progress' ? $_('page__filter_status_in_progress') : $_('page__filter_status_todo')}
											</span>
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
		bind:show={showQRExport}
		selectedTasks={qrExportTasks}
		allProjects={projectList}
		allAssignees={assignees}
		on:close={() => { showQRExport = false; qrExportTasks = []; }}
		on:exportCSV={handleExportCSV}
	/>

	<DailyReflect bind:show={showDailyReflect} />

	<!-- Keyboard Shortcuts Modal -->
	{#if showCommandPalette}
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			class="fixed inset-0 bg-black/55 flex items-start justify-center z-60 p-4 pt-[12vh] backdrop-blur-sm"
			on:click|self={closeCommandPalette}
			role="button"
			tabindex="0"
			aria-label="Close command palette"
		>
			<div class="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 shadow-2xl overflow-hidden">
				<div class="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
					<p class="text-sm font-semibold text-gray-900 dark:text-gray-100">⌨️ {$_('commandPalette__title')}</p>
					<kbd class="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-300">⌘K / Ctrl+K</kbd>
				</div>

				<div class="p-4 border-b border-gray-100 dark:border-gray-800">
					<input
						bind:this={commandInputRef}
						bind:value={commandQuery}
						type="text"
						placeholder={$_('commandPalette__placeholder_dynamic')}
						class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-primary"
					/>
				</div>

				<div class="max-h-[48vh] overflow-y-auto p-2">
					{#if commandPaletteFilteredItems.length === 0}
						<div class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
							{$_('commandPalette__no_results_dynamic')}
						</div>
					{:else}
						{#each groupedCommandPaletteItems as group}
							<div class="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
								{group.label}
							</div>
							{#each group.items as item}
								{@const itemIndex = getCommandItemIndex(item.id)}
								<button
									on:click={() => runCommandPaletteItem(item)}
									on:mouseenter={() => { if (itemIndex >= 0) commandSelectedIndex = itemIndex; }}
									class="w-full text-left px-4 py-3 rounded-xl transition-colors mb-1 {itemIndex === commandSelectedIndex ? 'bg-primary/10 border border-primary/30' : 'hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'}"
								>
									<div class="flex items-center gap-3">
										<div class="shrink-0 p-2 rounded-lg {itemIndex === commandSelectedIndex ? 'bg-primary/20 text-primary' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}">
											{#if item.icon}
												<svelte:component this={item.icon} size={18} />
											{:else}
												<Sparkles size={18} />
											{/if}
										</div>
										<div class="min-w-0 flex-1">
											<p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.label}</p>
											<p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate mb-0.5">{item.label}</p>
											{#if item.project}
												<div class="flex items-center gap-2 flex-wrap">
													<div class="flex items-center gap-1.5">
														<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20">
															<Folder size={10} />
															{item.project}
														</span>
														
														{#if item.status}
															{@const statusInfo = getCommandStatusInfo(item.status)}
															{#if statusInfo}
																<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border {statusInfo.class}">
																	{statusInfo.label}
																</span>
															{/if}
														{/if}
													</div>
												</div>
											{:else}
												<p class="text-xs text-gray-500 dark:text-gray-400 truncate">{item.description}</p>
											{/if}
										</div>
										<span class="text-[10px] uppercase tracking-wide text-gray-400">Enter</span>
									</div>
								</button>
							{/each}
						{/each}
					{/if}
				</div>
			</div>
		</div>
	{/if}

	{#if $showKeyboardShortcuts}
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
			on:click|self={() => $showKeyboardShortcuts = false}
			on:keydown={(event) => event.key === 'Escape' && ($showKeyboardShortcuts = false)}
			role="button"
			tabindex="0"
			aria-label={$_('shortcuts__close_modal')}
		>
			<div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 animate-modal-in">
				<div class="flex items-center justify-between mb-6">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
						⌨️ {$_('shortcuts__title')}
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
					<h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{$_('shortcuts__views')}</h4>
					<div class="space-y-2">
						<div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
							<div class="flex items-center gap-3">
								<kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300">1</kbd>
								<span class="text-gray-700 dark:text-gray-300">{$tabSettings[0] ? $_(`tabs__${$tabSettings[0].id}`) : $_('shortcuts__list_view_label')}</span>
							</div>
							<span class="text-xs text-gray-400">list view</span>
						</div>
						<div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
							<div class="flex items-center gap-3">
								<kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300">2</kbd>
								<span class="text-gray-700 dark:text-gray-300">{$tabSettings[1] ? $_(`tabs__${$tabSettings[1].id}`) : $_('shortcuts__calendar_view_label')}</span>
							</div>
							<span class="text-xs text-gray-400">calendar view</span>
						</div>
						<div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
							<div class="flex items-center gap-3">
								<kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300">3</kbd>
								<span class="text-gray-700 dark:text-gray-300">{$tabSettings[2] ? $_(`tabs__${$tabSettings[2].id}`) : $_('shortcuts__kanban_view_label')}</span>
							</div>
							<span class="text-xs text-gray-400">kanban view</span>
						</div>
						<div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
							<div class="flex items-center gap-3">
								<kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300">4</kbd>
								<span class="text-gray-700 dark:text-gray-300">{$tabSettings[3] ? $_(`tabs__${$tabSettings[3].id}`) : $_('shortcuts__table_view_label')}</span>
							</div>
							<span class="text-xs text-gray-400">table view</span>
						</div>
					</div>
				</div>

				<!-- Action Shortcuts -->
				<div class="mb-4">
					<h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{$_('shortcuts__actions')}</h4>
					<div class="space-y-2">
						<div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
							<div class="flex items-center gap-3">
								<kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300">/</kbd>
								<span class="text-gray-700 dark:text-gray-300">{$_('shortcuts__focus_search')}</span>
							</div>
							<span class="text-xs text-gray-400">Focus search</span>
						</div>
						<div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
							<div class="flex items-center gap-3">
								<kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300">N</kbd>
								<span class="text-gray-700 dark:text-gray-300">{$_('shortcuts__new_task')}</span>
							</div>
							<span class="text-xs text-gray-400">New task</span>
						</div>
						<div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
							<div class="flex items-center gap-3">
								<kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300">F</kbd>
								<span class="text-gray-700 dark:text-gray-300">{$_('shortcuts__toggle_filters')}</span>
							</div>
							<span class="text-xs text-gray-400">Toggle filters</span>
						</div>
						<div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
							<div class="flex items-center gap-3">
								<kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300">T</kbd>
								<span class="text-gray-700 dark:text-gray-300">{$_('shortcuts__toggle_theme')}</span>
							</div>
							<span class="text-xs text-gray-400">Toggle theme</span>
						</div>
					</div>
				</div>

				<!-- System Shortcuts -->
				<div>
					<h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{$_('shortcuts__system')}</h4>
					<div class="space-y-2">
						<div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
							<div class="flex items-center gap-3">
								<kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300">Esc</kbd>
								<span class="text-gray-700 dark:text-gray-300">{$_('shortcuts__close_modal')}</span>
							</div>
							<span class="text-xs text-gray-400">Close modal</span>
						</div>
						<div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
							<div class="flex items-center gap-3">
								<kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300">?</kbd>
								<span class="text-gray-700 dark:text-gray-300">{$_('shortcuts__show_shortcuts')}</span>
							</div>
							<span class="text-xs text-gray-400">Show shortcuts</span>
						</div>
						<div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
							<div class="flex items-center gap-3">
								<kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300">⌘K / Ctrl+K</kbd>
								<span class="text-gray-700 dark:text-gray-300">{$_('shortcuts__open_commands')}</span>
							</div>
							<span class="text-xs text-gray-400">Open commands</span>
						</div>
					</div>
				</div>

				<div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
					<p class="text-xs text-gray-500 dark:text-gray-400 text-center">
						💡 {$_('shortcuts__hint')}
					</p>
				</div>

				<div class="mt-4">
					<button
						on:click={() => $showKeyboardShortcuts = false}
						class="w-full px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors"
					>
						{$_('shortcuts__btn_got_it')}
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
