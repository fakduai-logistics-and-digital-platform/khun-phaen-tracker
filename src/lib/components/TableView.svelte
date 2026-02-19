<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { _ } from '$lib/i18n';
	import type { Task, Sprint } from '$lib/types';
	import { ArrowUpDown, ArrowUp, ArrowDown, Edit2, Trash2, CheckCircle2, Circle, PlayCircle, User, Folder, Clock, Calendar, MoreVertical, ChevronDown, ChevronUp, Flag, X, QrCode, FlaskConical, ListTodo } from 'lucide-svelte';
	import Pagination from './Pagination.svelte';

	export let tasks: Task[] = [];
	export let sprints: Sprint[] = [];

	const dispatch = createEventDispatcher<{
		edit: Task;
		delete: number;
		deleteSelected: number[];
		statusChange: { id: number; status: Task['status'] };
		changeSprint: number[];
		changeStatus: number[];
		changeProject: number[];
		exportQR: number[];
	}>();

	function getSprintName(sprintId: number | null | undefined): string | null {
		if (!sprintId) return null;
		return sprints.find(s => s.id === sprintId)?.name || null;
	}

	type SortColumn = 'title' | 'project' | 'date' | 'status' | 'category' | 'assignee';
	type SortDirection = 'asc' | 'desc';

	let sortColumn: SortColumn = 'date';
	let sortDirection: SortDirection = 'desc';
	let selectedTasks: Set<number> = new Set();
	let expandedMobileCards: Set<number> = new Set();

	// Pagination
	let pageSize = 50;
	let currentPage = 1;

	$: sortedTasks = [...tasks].sort((a, b) => {
		let aVal: any;
		let bVal: any;

		switch (sortColumn) {
			case 'assignee':
				aVal = a.assignee?.name || '';
				bVal = b.assignee?.name || '';
				break;
			default:
				aVal = a[sortColumn] || '';
				bVal = b[sortColumn] || '';
			}

			if (typeof aVal === 'string') {
				aVal = aVal.toLowerCase();
				bVal = bVal.toLowerCase();
			}

			if (sortDirection === 'asc') {
				return aVal > bVal ? 1 : -1;
			} else {
				return aVal < bVal ? 1 : -1;
			}
		});

	$: paginatedTasks = sortedTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);
	$: allTaskIds = new Set(
		tasks
			.map(task => task.id)
			.filter((id): id is number => id !== undefined)
	);
	$: paginatedTaskIds = paginatedTasks
		.map(task => task.id)
		.filter((id): id is number => id !== undefined);
	$: selectedOnPageCount = paginatedTaskIds.filter(id => selectedTasks.has(id)).length;
	$: allOnPageSelected = paginatedTaskIds.length > 0 && selectedOnPageCount === paginatedTaskIds.length;
	$: someOnPageSelected = selectedOnPageCount > 0 && !allOnPageSelected;
	$: {
		const validSelected = new Set(Array.from(selectedTasks).filter(id => allTaskIds.has(id)));
		if (!areSetsEqual(selectedTasks, validSelected)) {
			selectedTasks = validSelected;
		}
	}

	function toggleSort(column: SortColumn) {
		if (sortColumn === column) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortDirection = 'asc';
		}
	}

	function getSortIcon(column: SortColumn) {
		if (sortColumn !== column) return ArrowUpDown;
		return sortDirection === 'asc' ? ArrowUp : ArrowDown;
	}

	function formatDate(dateStr: string) {
		if (!dateStr) return '-';
		const date = new Date(dateStr);
		const today = new Date();
		const isToday = date.toDateString() === today.toDateString();

		if (isToday) return $_('tableView__today');
		return date.toLocaleDateString('th-TH', {
			month: 'short',
			day: 'numeric'
		});
	}

	function formatDateFull(dateStr: string) {
		if (!dateStr) return '-';
		const date = new Date(dateStr);
		return date.toLocaleDateString('th-TH', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function formatDuration(minutes: number) {
		if (!minutes || minutes === 0) return '-';
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		if (hours > 0 && mins > 0) return `${hours}ชม ${mins}น`;
		if (hours > 0) return `${hours}ชม`;
		return `${mins}น`;
	}

	function getStatusIcon(status: Task['status']) {
		switch (status) {
			case 'done': return CheckCircle2;
			case 'in-progress': return PlayCircle;
			case 'in-test': return FlaskConical;
			default: return Circle;
		}
	}

	function getStatusClass(status: Task['status'], isArchived: boolean = false) {
		if (isArchived) return 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50';
		switch (status) {
			case 'done': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
			case 'in-progress': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
			case 'in-test': return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20';
			default: return 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50';
		}
	}

	function getStatusLabel(status: Task['status'], isArchived: boolean = false) {
		if (isArchived) return $_('taskList__archived');
		switch (status) {
			case 'in-progress': return $_('page__filter_status_in_progress');
			case 'in-test': return $_('page__filter_status_in_test');
			case 'done': return $_('page__filter_status_done');
			default: return $_('page__filter_status_todo');
		}
	}

	function nextStatus(status: Task['status']): Task['status'] {
		switch (status) {
			case 'todo': return 'in-progress';
			case 'in-progress': return 'in-test';
			case 'in-test': return 'done';
			case 'done': return 'todo';
		}
	}

	function getStatusShort(status: Task['status']): string {
		switch (status) {
			case 'in-progress': return $_('tableView__status_short_in_progress');
			case 'in-test': return $_('tableView__status_short_in_test');
			case 'done': return $_('tableView__status_short_done');
			default: return $_('tableView__status_short_todo');
		}
	}

	function toggleSelectAll() {
		const newSet = new Set(selectedTasks);
		if (allOnPageSelected) {
			paginatedTaskIds.forEach(id => newSet.delete(id));
		} else {
			paginatedTaskIds.forEach(id => newSet.add(id));
		}
		selectedTasks = newSet;
	}

	function areSetsEqual(a: Set<number>, b: Set<number>) {
		if (a.size !== b.size) return false;
		for (const item of a) {
			if (!b.has(item)) return false;
		}
		return true;
	}

	function toggleSelect(id: number) {
		const newSet = new Set(selectedTasks);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedTasks = newSet;
	}

	function handleStatusChange(id: number, newStatus: Task['status']) {
		dispatch('statusChange', { id, status: newStatus });
	}

	function handleDeleteSelected() {
		dispatch('deleteSelected', Array.from(selectedTasks));
	}

	function handleChangeSprint() {
		dispatch('changeSprint', Array.from(selectedTasks));
	}

	function handleChangeStatus() {
		dispatch('changeStatus', Array.from(selectedTasks));
	}

	function handleChangeProject() {
		dispatch('changeProject', Array.from(selectedTasks));
	}

	function handleExportQR() {
		dispatch('exportQR', Array.from(selectedTasks));
	}

	function clearSelection() {
		selectedTasks = new Set();
	}

	function toggleMobileCard(id: number) {
		const newSet = new Set(expandedMobileCards);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		expandedMobileCards = newSet;
	}

	function isOverdue(dateStr: string, status: Task['status'], isArchived: boolean = false) {
		if (status === 'done' || isArchived) return false;
		const date = new Date(dateStr);
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		return date < today;
	}
</script>

<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
	<!-- Bulk Actions Bar -->
	{#if selectedTasks.size > 0}
		<div class="bg-primary/10 dark:bg-primary/20 px-3 py-2 sm:px-4 sm:py-2 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
			<span class="text-xs sm:text-sm text-primary dark:text-primary font-medium">
				{$_('tableView__selected_count', { values: { count: selectedTasks.size } })}
			</span>
			<div class="flex items-center gap-2">
				<button
					on:click={clearSelection}
					class="px-2.5 py-1.5 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
				>
					{$_('tableView__btn_clear_selection')}
				</button>
				<button
					on:click={handleChangeStatus}
					class="px-2.5 py-1.5 text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-500 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-1.5"
				>
					<CheckCircle2 size={14} />
					{$_('tableView__btn_change_status')}
				</button>
				<button
					on:click={handleChangeProject}
					class="px-2.5 py-1.5 text-xs sm:text-sm font-medium text-purple-600 dark:text-purple-400 border border-purple-300 dark:border-purple-500 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors flex items-center gap-1.5"
				>
					<Folder size={14} />
					{$_('tableView__btn_change_project')}
				</button>
				<button
					on:click={handleChangeSprint}
					class="px-2.5 py-1.5 text-xs sm:text-sm font-medium text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-500 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex items-center gap-1.5"
				>
					<Flag size={14} />
					{$_('tableView__btn_change_sprint')}
				</button>
				<button
					on:click={handleExportQR}
					class="px-2.5 py-1.5 text-xs sm:text-sm font-medium text-teal-600 dark:text-teal-400 border border-teal-300 dark:border-teal-500 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors flex items-center gap-1.5"
				>
					<QrCode size={14} />
					{$_('tableView__btn_qr_export')}
				</button>
				<button
					on:click={handleDeleteSelected}
					class="px-2.5 py-1.5 text-xs sm:text-sm font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-1.5"
				>
					<Trash2 size={14} />
					{$_('tableView__btn_delete_selected')}
				</button>
			</div>
		</div>
	{/if}

	<!-- Desktop Table View -->
	<div class="hidden md:block overflow-x-auto">
		<table class="w-full">
			<thead class="bg-gray-50 dark:bg-gray-700/50">
				<tr>
					<th class="px-3 py-2 lg:px-4 lg:py-3 text-left w-10">
						<input
							type="checkbox"
							checked={allOnPageSelected}
							indeterminate={someOnPageSelected}
							on:change={toggleSelectAll}
							class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
						/>
					</th>
					<th class="px-3 py-2 lg:px-4 lg:py-3 text-left">
						<button
							on:click={() => toggleSort('title')}
							class="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
						>
							{$_('tableView__column_title')}
							<svelte:component this={getSortIcon('title')} size={12} class="lg:w-3.5 lg:h-3.5" />
						</button>
					</th>
					<th class="px-3 py-2 lg:px-4 lg:py-3 text-left hidden lg:table-cell">
						<button
							on:click={() => toggleSort('project')}
							class="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
						>
							<Folder size={12} class="lg:w-3.5 lg:h-3.5" />
							{$_('tableView__column_project')}
							<svelte:component this={getSortIcon('project')} size={12} class="lg:w-3.5 lg:h-3.5" />
						</button>
					</th>
					<th class="px-3 py-2 lg:px-4 lg:py-3 text-left hidden xl:table-cell">
						<button
							on:click={() => toggleSort('category')}
							class="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
						>
							{$_('tableView__column_category')}
							<svelte:component this={getSortIcon('category')} size={12} class="lg:w-3.5 lg:h-3.5" />
						</button>
					</th>
					<th class="px-3 py-2 lg:px-4 lg:py-3 text-left">
						<button
							on:click={() => toggleSort('assignee')}
							class="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
						>
							<User size={12} class="lg:w-3.5 lg:h-3.5" />
							<span class="hidden lg:inline">{$_('tableView__column_assignee')}</span>
							<span class="lg:hidden">{$_('tableView__column_assignee_short')}</span>
							<svelte:component this={getSortIcon('assignee')} size={12} class="lg:w-3.5 lg:h-3.5" />
						</button>
					</th>
					<th class="px-3 py-2 lg:px-4 lg:py-3 text-left hidden xl:table-cell">
						<span class="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
							<Flag size={12} class="lg:w-3.5 lg:h-3.5" />
							{$_('tableView__column_sprint')}
						</span>
					</th>
					<th class="px-3 py-2 lg:px-4 lg:py-3 text-left">
						<button
							on:click={() => toggleSort('status')}
							class="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
						>
							{$_('tableView__column_status')}
							<svelte:component this={getSortIcon('status')} size={12} class="lg:w-3.5 lg:h-3.5" />
						</button>
					</th>
					<th class="px-3 py-2 lg:px-4 lg:py-3 text-left">
						<button
							on:click={() => toggleSort('date')}
							class="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
						>
							<Calendar size={12} class="lg:w-3.5 lg:h-3.5" />
							<span class="hidden lg:inline">{$_('tableView__column_due_date')}</span>
							<span class="lg:hidden">{$_('tableView__column_date_short')}</span>
							<svelte:component this={getSortIcon('date')} size={12} class="lg:w-3.5 lg:h-3.5" />
						</button>
					</th>
					<th class="px-3 py-2 lg:px-4 lg:py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider w-20">
						{$_('tableView__column_actions')}
					</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
				{#each paginatedTasks as task (task.id)}
					<tr 
						class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
						on:click={() => dispatch('edit', task)}
					>
						<td class="px-3 py-2 lg:px-4 lg:py-3">
							<input
								type="checkbox"
								checked={selectedTasks.has(task.id!)}
								on:change={() => toggleSelect(task.id!)}
								on:click|stopPropagation
								class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
							/>
						</td>
						<td class="px-3 py-2 lg:px-4 lg:py-3">
							<div class="flex flex-col min-w-0">
								<span class="font-medium text-gray-900 dark:text-white text-sm truncate max-w-30 lg:max-w-50 xl:max-w-xs" title={task.title}>
									{task.title}
								</span>
								{#if task.notes}
									<span class="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 max-w-30 lg:max-w-50 xl:max-w-xs">
										{task.notes}
									</span>
								{/if}
								{#if task.checklist && task.checklist.length > 0}
									{@const completed = task.checklist.filter(i => i.completed).length}
									{@const total = task.checklist.length}
									<div class="mt-1 flex items-center gap-1.5">
										<div class="w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
											<div class="h-full bg-primary" style="width: {(completed/total)*100}% transition: width 0.3s"></div>
										</div>
										<span class="text-[10px] text-gray-400 whitespace-nowrap">{completed}/{total}</span>
									</div>
								{/if}
								{#if task.project}
									<span class="lg:hidden inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 w-fit">
										{task.project}
									</span>
								{/if}
							</div>
						</td>
						<td class="px-3 py-2 lg:px-4 lg:py-3 hidden lg:table-cell">
							{#if task.project}
								<span class="inline-flex items-center px-2 py-0.5 lg:px-2.5 lg:py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 truncate max-w-25" title={task.project}>
									{task.project}
								</span>
							{:else}
								<span class="text-gray-400 dark:text-gray-500 text-sm">-</span>
							{/if}
						</td>
						<td class="px-3 py-2 lg:px-4 lg:py-3 hidden xl:table-cell">
							<span class="inline-flex items-center px-2 py-0.5 lg:px-2.5 lg:py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
								{task.category || $_('tableView__category_other')}
							</span>
						</td>
						<td class="px-3 py-2 lg:px-4 lg:py-3">
							{#if task.assignee}
								<div class="flex items-center gap-1.5 lg:gap-2">
									<div
										class="w-5 h-5 lg:w-6 lg:h-6 rounded-full flex items-center justify-center text-xs font-medium text-white shrink-0"
										style="background-color: {task.assignee.color || '#6366F1'}"
									>
										{task.assignee.name.charAt(0)}
									</div>
									<span class="text-xs lg:text-sm text-gray-700 dark:text-gray-300 truncate max-w-15 lg:max-w-25" title={task.assignee.name}>
										{task.assignee.name}
									</span>
								</div>
							{:else}
								<span class="text-gray-400 dark:text-gray-500 text-sm">-</span>
							{/if}
						</td>
						<td class="px-3 py-2 lg:px-4 lg:py-3 hidden xl:table-cell">
							{#if getSprintName(task.sprint_id)}
								<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 truncate max-w-25" title={getSprintName(task.sprint_id)}>
									<Flag size={10} />
									{getSprintName(task.sprint_id)}
								</span>
							{:else}
								<span class="text-gray-400 dark:text-gray-500 text-sm">-</span>
							{/if}
						</td>
						<td class="px-3 py-2 lg:px-4 lg:py-3">
							<button
								on:click|stopPropagation={() => handleStatusChange(task.id!, nextStatus(task.status))}
								class="inline-flex items-center gap-1 lg:gap-1.5 px-2 py-0.5 lg:px-2.5 lg:py-1 rounded-full text-xs font-medium transition-colors {getStatusClass(task.status, task.is_archived)} hover:opacity-80 whitespace-nowrap"
								title={$_('tableView__status_click_hint')}
							>
								<svelte:component this={getStatusIcon(task.status)} size={12} class="lg:w-4 lg:h-4" />
								<span class="hidden sm:inline">{getStatusLabel(task.status, task.is_archived)}</span>
								<span class="sm:hidden">{getStatusShort(task.status)}</span>
							</button>
						</td>
						<td class="px-3 py-2 lg:px-4 lg:py-3">
							<span class="text-xs lg:text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap {isOverdue(task.date, task.status, task.is_archived) ? 'text-red-600 dark:text-red-400 font-medium' : ''}">
								{formatDate(task.date)}
								{#if isOverdue(task.date, task.status, task.is_archived)}
									<span class="ml-1 text-red-500">!</span>
								{/if}
							</span>
						</td>
						<td class="px-3 py-2 lg:px-4 lg:py-3">
							<div class="flex items-center justify-center gap-1 lg:gap-2">
								<button
									on:click|stopPropagation={() => dispatch('edit', task)}
									class="p-1 lg:p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
									title={$_('taskList__edit')}
								>
									<Edit2 size={14} class="lg:w-4 lg:h-4" />
								</button>
								<button
									on:click|stopPropagation={() => dispatch('delete', task.id!)}
									class="p-1 lg:p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
									title={$_('taskList__delete')}
								>
									<Trash2 size={14} class="lg:w-4 lg:h-4" />
								</button>
							</div>
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="9" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
							<div class="flex flex-col items-center gap-2">
								<svg class="w-10 h-10 lg:w-12 lg:h-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
								</svg>
								<p class="text-sm lg:text-base">{$_('tableView__no_tasks')}</p>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Mobile Card View -->
	<div class="md:hidden">
		{#if paginatedTasks.length > 0}
			<div class="divide-y divide-gray-200 dark:divide-gray-700">
				{#each paginatedTasks as task (task.id)}
						<div 
							class="p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
							on:click={() => dispatch('edit', task)}
							on:keydown={(e) => e.key === 'Enter' && dispatch('edit', task)}
							role="button"
							tabindex="0"
						>
							<div class="flex items-start gap-3">
								<input
									type="checkbox"
									checked={selectedTasks.has(task.id!)}
									on:change={() => toggleSelect(task.id!)}
									on:click|stopPropagation
									class="w-4 h-4 mt-1 rounded border-gray-300 text-primary focus:ring-primary shrink-0"
								/>
							<div class="flex-1 min-w-0">
								<div class="flex items-start justify-between gap-2">
									<h3 class="font-medium text-gray-900 dark:text-white text-sm line-clamp-2 flex-1" title={task.title}>
										{task.title}
									</h3>
									<div class="flex items-center gap-1 shrink-0">
										<button
											on:click|stopPropagation={() => dispatch('edit', task)}
											class="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
										>
											<Edit2 size={16} />
										</button>
										<button
											on:click|stopPropagation={() => dispatch('delete', task.id!)}
											class="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
										>
											<Trash2 size={16} />
										</button>
										<button
											on:click|stopPropagation={() => toggleMobileCard(task.id!)}
											class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
										>
											{#if expandedMobileCards.has(task.id!)}
												<ChevronUp size={16} />
											{:else}
												<ChevronDown size={16} />
											{/if}
										</button>
									</div>
								</div>

								<div class="flex flex-wrap items-center gap-2 mt-2">
									<button
										on:click|stopPropagation={() => !task.is_archived && handleStatusChange(task.id!, nextStatus(task.status))}
										class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors {getStatusClass(task.status, task.is_archived)}"
										disabled={task.is_archived}
									>
										<svelte:component this={getStatusIcon(task.status)} size={12} />
										{getStatusLabel(task.status, task.is_archived)}
									</button>

									<span class="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 {isOverdue(task.date, task.status, task.is_archived) ? 'text-red-600 dark:text-red-400 font-medium' : ''}">
										<Calendar size={12} />
										{formatDate(task.date)}
										{#if isOverdue(task.date, task.status, task.is_archived)}
											<span class="text-red-500">{$_('tableView__overdue_label')}</span>
										{/if}
									</span>

									{#if getSprintName(task.sprint_id)}
										<span class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-xs">
											<Flag size={10} />
											{getSprintName(task.sprint_id)}
										</span>
									{/if}

									{#if task.duration_minutes > 0}
										<span class="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
											<Clock size={12} />
											{formatDuration(task.duration_minutes)}
										</span>
									{/if}

									{#if task.checklist && task.checklist.length > 0}
										{@const completed = task.checklist.filter(i => i.completed).length}
										{@const total = task.checklist.length}
										<span class="inline-flex items-center gap-1 text-xs text-primary font-medium">
											<ListTodo size={12} />
											{completed}/{total}
										</span>
									{/if}
								</div>

								{#if expandedMobileCards.has(task.id!)}
									<div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2 animate-expand">
										{#if task.project}
											<div class="flex items-center gap-2">
												<Folder size={14} class="text-gray-400 shrink-0" />
												<span class="text-xs text-gray-700 dark:text-gray-300">{task.project}</span>
											</div>
										{/if}

										<div class="flex items-center gap-2">
											<span class="text-xs text-gray-500 dark:text-gray-400">{$_('tableView__column_category')}:</span>
											<span class="text-xs text-gray-700 dark:text-gray-300">{task.category || $_('tableView__category_other')}</span>
										</div>

										{#if task.assignee}
											<div class="flex items-center gap-2">
												<div
													class="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium text-white"
													style="background-color: {task.assignee.color || '#6366F1'}"
												>
													{task.assignee.name.charAt(0)}
												</div>
												<span class="text-xs text-gray-700 dark:text-gray-300">{task.assignee.name}</span>
											</div>
										{/if}

										{#if getSprintName(task.sprint_id)}
											<div class="flex items-center gap-2">
												<Flag size={14} class="text-indigo-500 shrink-0" />
												<span class="text-xs text-gray-700 dark:text-gray-300">{getSprintName(task.sprint_id)}</span>
											</div>
										{/if}

										<div class="flex items-center gap-2">
											<Calendar size={14} class="text-gray-400 shrink-0" />
											<span class="text-xs text-gray-700 dark:text-gray-300">{formatDateFull(task.date)}</span>
										</div>

										{#if task.notes}
											<div class="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
												{task.notes}
											</div>
										{/if}
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
				<div class="flex flex-col items-center gap-2">
					<svg class="w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
					</svg>
					<p>{$_('tableView__no_tasks')}</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- Pagination -->
	{#if tasks.length > 0}
		<Pagination
			totalItems={tasks.length}
			bind:pageSize
			bind:currentPage
			pageSizeOptions={[20, 50, 100]}
		/>
	{/if}
</div>

<style>
	.line-clamp-1 {
		display: -webkit-box;
		line-clamp: 1;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.line-clamp-2 {
		display: -webkit-box;
		line-clamp: 2;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	@keyframes expand {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.animate-expand {
		animation: expand 0.2s ease-out;
	}
</style>
