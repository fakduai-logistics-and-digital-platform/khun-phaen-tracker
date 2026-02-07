<script lang="ts">
	import { onMount } from 'svelte';
	import type { Task, Project, Assignee, ViewMode, FilterOptions } from '$lib/types';
	import { getTasks, addTask, updateTask, deleteTask, getStats, exportToCSV, importFromCSV, getCategories, getAssignees, getProjects, getProjectsList, addProject, updateProject, deleteProject, getProjectStats, addAssignee as addAssigneeDB, getAssigneeStats, updateAssignee, deleteAssignee } from '$lib/db';
	import TaskForm from '$lib/components/TaskForm.svelte';
	import TaskList from '$lib/components/TaskList.svelte';
	import CalendarView from '$lib/components/CalendarView.svelte';
	import KanbanBoard from '$lib/components/KanbanBoard.svelte';
	import StatsPanel from '$lib/components/StatsPanel.svelte';
	import ExportImport from '$lib/components/ExportImport.svelte';
	import WorkerManager from '$lib/components/WorkerManager.svelte';
	import ProjectManager from '$lib/components/ProjectManager.svelte';
	import { List, CalendarDays, Columns3, Filter, Search, Plus, Users, Folder } from 'lucide-svelte';
	import { jsPDF } from 'jspdf';
	
	let tasks: Task[] = [];
	let categories: string[] = [];
	let projects: string[] = [];
	let projectList: Project[] = [];
	let projectStats: { id: number; taskCount: number }[] = [];
	let assignees: Assignee[] = [];
	let workerStats: { id: number; taskCount: number }[] = [];
	let stats = { total: 0, todo: 0, in_progress: 0, done: 0, total_minutes: 0 };
	let currentView: ViewMode = 'list';
	let editingTask: Task | null = null;
	let showForm = false;
	let showFilters = false;
	let showWorkerManager = false;
	let showProjectManager = false;
	
	let filters: FilterOptions = {
		startDate: '',
		endDate: '',
		status: 'all',
		category: 'all',
		project: 'all',
		assignee_id: 'all',
		search: ''
	};
	
	let message = '';
	let messageType: 'success' | 'error' = 'success';
	
	onMount(() => {
		loadData();
	});
	
	async function loadData() {
		try {
			tasks = await getTasks(filters);
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
			const csv = await exportToCSV();
			const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
			const link = document.createElement('a');
			const url = URL.createObjectURL(blob);
			link.setAttribute('href', url);
			link.setAttribute('download', `tasks_${new Date().toISOString().split('T')[0]}.csv`);
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			showMessage('ส่งออก CSV สำเร็จ');
		} catch (e) {
			showMessage('เกิดข้อผิดพลาดในการส่งออก', 'error');
		}
	}
	
	function handleExportPDF() {
		try {
			const doc = new jsPDF();
			doc.setFont('helvetica');
			doc.setFontSize(18);
			doc.text('Task Report', 14, 20);
			
			doc.setFontSize(12);
			doc.text(`Generated: ${new Date().toLocaleDateString('th-TH')}`, 14, 30);
			doc.text(`Total Tasks: ${stats.total}`, 14, 40);
			const totalHours = stats.total_minutes / 60;
			const mandays = totalHours / 8; // 8 ชั่วโมง = 1 man-day
			doc.text(`Total Time: ${mandays.toFixed(2)} man-days (${Math.floor(stats.total_minutes / 60)}h ${stats.total_minutes % 60}m)`, 14, 48);
			
			let y = 60;
			doc.setFontSize(10);
			
			tasks.forEach((task, index) => {
				if (y > 270) {
					doc.addPage();
					y = 20;
				}
				
				const status = task.status === 'done' ? '✓' : task.status === 'in-progress' ? '⟳' : '○';
				doc.text(`${status} ${task.title}`, 14, y);
				doc.text(`${task.date} | ${task.category} | ${Math.floor(task.duration_minutes / 60)}h ${task.duration_minutes % 60}m`, 14, y + 5);
				y += 15;
			});
			
			doc.save(`tasks_${new Date().toISOString().split('T')[0]}.pdf`);
			showMessage('ส่งออก PDF สำเร็จ');
		} catch (e) {
			showMessage('เกิดข้อผิดพลาดในการส่งออก', 'error');
		}
	}
	
	async function handleImportCSV(event: CustomEvent<string>) {
		try {
			const imported = await importFromCSV(event.detail);
			await loadData();
			showMessage(`นำเข้าสำเร็จ ${imported} รายการ`);
		} catch (e) {
			showMessage('เกิดข้อผิดพลาดในการนำเข้า', 'error');
		}
	}
	
	function applyFilters() {
		loadData();
	}
	
	function clearFilters() {
		filters = {
			startDate: '',
			endDate: '',
			status: 'all',
			category: 'all',
			project: 'all',
			assignee_id: 'all',
			search: ''
		};
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
	
	<!-- Controls -->
	<div class="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
		<!-- View Tabs -->
		<div class="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-lg transition-colors">
			<button
				on:click={() => currentView = 'list'}
				class="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors {currentView === 'list' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}"
			>
				<List size={16} />
				<span class="hidden sm:inline">รายการ</span>
			</button>
			<button
				on:click={() => currentView = 'calendar'}
				class="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors {currentView === 'calendar' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}"
			>
				<CalendarDays size={16} />
				<span class="hidden sm:inline">ปฏิทิน</span>
			</button>
			<button
				on:click={() => currentView = 'kanban'}
				class="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors {currentView === 'kanban' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}"
			>
				<Columns3 size={16} />
				<span class="hidden sm:inline">Kanban</span>
			</button>
		</div>

		<div class="flex flex-wrap gap-2">
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
			
			<ExportImport
				on:exportCSV={handleExportCSV}
				on:exportPDF={handleExportPDF}
				on:importCSV={handleImportCSV}
			/>
			
			<button
				on:click={() => { showForm = !showForm; editingTask = null; }}
				class="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors"
			>
				<Plus size={18} />
				<span class="hidden sm:inline">เพิ่มงาน</span>
			</button>
		</div>
	</div>
	
	<!-- Filters Panel -->
	{#if showFilters}
		<div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 space-y-4 transition-colors">
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
				<div>
					<label for="search" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ค้นหา</label>
					<div class="relative">
						<Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
						<input
							id="search"
							type="text"
							bind:value={filters.search}
							placeholder="ค้นหางาน..."
							class="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
						/>
					</div>
				</div>

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
			</div>

			<div class="flex gap-2">
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
	{#if showForm}
		<TaskForm
			{editingTask}
			{assignees}
			projects={projectList}
			on:submit={handleAddTask}
			on:cancel={cancelEdit}
			on:addAssignee={handleAddAssignee}
		/>
	{/if}
	
	<!-- Views -->
	<div class="mt-6">
		{#if currentView === 'list'}
			<TaskList
				{tasks}
				on:edit={handleEditTask}
				on:delete={handleDeleteTask}
				on:statusChange={handleStatusChange}
			/>
		{:else if currentView === 'calendar'}
			<CalendarView
				{tasks}
				on:selectTask={handleEditTask}
			/>
		{:else if currentView === 'kanban'}
			<KanbanBoard
				{tasks}
				on:move={handleKanbanMove}
				on:edit={handleEditTask}
				on:delete={handleDeleteTask}
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
