<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Task } from '$lib/types';
	import { ArrowUpDown, ArrowUp, ArrowDown, Edit2, Trash2, CheckCircle2, Circle, PlayCircle, User, Folder, Clock, Calendar, MoreVertical, ChevronDown, ChevronUp } from 'lucide-svelte';
	import Pagination from './Pagination.svelte';

	export let tasks: Task[] = [];

	const dispatch = createEventDispatcher<{
		edit: Task;
		delete: number;
		deleteSelected: number[];
		statusChange: { id: number; status: Task['status'] };
	}>();

	type SortColumn = 'title' | 'project' | 'date' | 'status' | 'category' | 'duration_minutes' | 'assignee';
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
		
		if (isToday) return 'วันนี้';
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
			default: return Circle;
		}
	}

	function getStatusClass(status: Task['status']) {
		switch (status) {
			case 'done': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
			case 'in-progress': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
			default: return 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50';
		}
	}

	function getStatusLabel(status: Task['status']) {
		switch (status) {
			case 'done': return 'เสร็จแล้ว';
			case 'in-progress': return 'กำลังทำ';
			default: return 'รอดำเนินการ';
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

	function isOverdue(dateStr: string, status: Task['status']) {
		if (status === 'done') return false;
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
				เลือก {selectedTasks.size} รายการ
			</span>
			<div class="flex items-center gap-2">
				<button
					on:click={clearSelection}
					class="px-2.5 py-1.5 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
				>
					ยกเลิกเลือก
				</button>
				<button
					on:click={handleDeleteSelected}
					class="px-2.5 py-1.5 text-xs sm:text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
				>
					ลบที่เลือก
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
							ชื่องาน
							<svelte:component this={getSortIcon('title')} size={12} class="lg:w-3.5 lg:h-3.5" />
						</button>
					</th>
					<th class="px-3 py-2 lg:px-4 lg:py-3 text-left hidden lg:table-cell">
						<button
							on:click={() => toggleSort('project')}
							class="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
						>
							<Folder size={12} class="lg:w-3.5 lg:h-3.5" />
							โปรเจค
							<svelte:component this={getSortIcon('project')} size={12} class="lg:w-3.5 lg:h-3.5" />
						</button>
					</th>
					<th class="px-3 py-2 lg:px-4 lg:py-3 text-left hidden xl:table-cell">
						<button
							on:click={() => toggleSort('category')}
							class="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
						>
							หมวดหมู่
							<svelte:component this={getSortIcon('category')} size={12} class="lg:w-3.5 lg:h-3.5" />
						</button>
					</th>
					<th class="px-3 py-2 lg:px-4 lg:py-3 text-left">
						<button
							on:click={() => toggleSort('assignee')}
							class="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
						>
							<User size={12} class="lg:w-3.5 lg:h-3.5" />
							<span class="hidden lg:inline">ผู้รับผิดชอบ</span>
							<span class="lg:hidden">ผู้รับ</span>
							<svelte:component this={getSortIcon('assignee')} size={12} class="lg:w-3.5 lg:h-3.5" />
						</button>
					</th>
					<th class="px-3 py-2 lg:px-4 lg:py-3 text-left">
						<button
							on:click={() => toggleSort('status')}
							class="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
						>
							สถานะ
							<svelte:component this={getSortIcon('status')} size={12} class="lg:w-3.5 lg:h-3.5" />
						</button>
					</th>
					<th class="px-3 py-2 lg:px-4 lg:py-3 text-left">
						<button
							on:click={() => toggleSort('date')}
							class="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
						>
							<Calendar size={12} class="lg:w-3.5 lg:h-3.5" />
							<span class="hidden lg:inline">Due Date</span>
							<span class="lg:hidden">วันที่</span>
							<svelte:component this={getSortIcon('date')} size={12} class="lg:w-3.5 lg:h-3.5" />
						</button>
					</th>
					<th class="px-3 py-2 lg:px-4 lg:py-3 text-left hidden sm:table-cell">
						<button
							on:click={() => toggleSort('duration_minutes')}
							class="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
						>
							<Clock size={12} class="lg:w-3.5 lg:h-3.5" />
							<span class="hidden lg:inline">เวลา</span>
							<svelte:component this={getSortIcon('duration_minutes')} size={12} class="lg:w-3.5 lg:h-3.5" />
						</button>
					</th>
					<th class="px-3 py-2 lg:px-4 lg:py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider w-20">
						จัดการ
					</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
				{#each paginatedTasks as task (task.id)}
					<tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
						<td class="px-3 py-2 lg:px-4 lg:py-3">
							<input
								type="checkbox"
								checked={selectedTasks.has(task.id!)}
								on:change={() => toggleSelect(task.id!)}
								class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
							/>
						</td>
						<td class="px-3 py-2 lg:px-4 lg:py-3">
							<div class="flex flex-col min-w-0">
								<span class="font-medium text-gray-900 dark:text-white text-sm truncate max-w-[120px] lg:max-w-[200px] xl:max-w-xs" title={task.title}>
									{task.title}
								</span>
								{#if task.notes}
									<span class="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 max-w-[120px] lg:max-w-[200px] xl:max-w-xs">
										{task.notes}
									</span>
								{/if}
								<!-- Mobile-only: show project badge -->
								{#if task.project}
									<span class="lg:hidden inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 w-fit">
										{task.project}
									</span>
								{/if}
							</div>
						</td>
						<td class="px-3 py-2 lg:px-4 lg:py-3 hidden lg:table-cell">
							{#if task.project}
								<span class="inline-flex items-center px-2 py-0.5 lg:px-2.5 lg:py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 truncate max-w-[100px]" title={task.project}>
									{task.project}
								</span>
							{:else}
								<span class="text-gray-400 dark:text-gray-500 text-sm">-</span>
							{/if}
						</td>
						<td class="px-3 py-2 lg:px-4 lg:py-3 hidden xl:table-cell">
							<span class="inline-flex items-center px-2 py-0.5 lg:px-2.5 lg:py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
								{task.category || 'อื่นๆ'}
							</span>
						</td>
						<td class="px-3 py-2 lg:px-4 lg:py-3">
							{#if task.assignee}
								<div class="flex items-center gap-1.5 lg:gap-2">
									<div 
										class="w-5 h-5 lg:w-6 lg:h-6 rounded-full flex items-center justify-center text-xs font-medium text-white flex-shrink-0"
										style="background-color: {task.assignee.color || '#6366F1'}"
									>
										{task.assignee.name.charAt(0)}
									</div>
									<span class="text-xs lg:text-sm text-gray-700 dark:text-gray-300 truncate max-w-[60px] lg:max-w-[100px]" title={task.assignee.name}>
										{task.assignee.name}
									</span>
								</div>
							{:else}
								<span class="text-gray-400 dark:text-gray-500 text-sm">-</span>
							{/if}
						</td>
						<td class="px-3 py-2 lg:px-4 lg:py-3">
							<button
								on:click={() => handleStatusChange(task.id!, task.status === 'todo' ? 'in-progress' : task.status === 'in-progress' ? 'done' : 'todo')}
								class="inline-flex items-center gap-1 lg:gap-1.5 px-2 py-0.5 lg:px-2.5 lg:py-1 rounded-full text-xs font-medium transition-colors {getStatusClass(task.status)} hover:opacity-80 whitespace-nowrap"
								title="คลิกเพื่อเปลี่ยนสถานะ"
							>
								<svelte:component this={getStatusIcon(task.status)} size={12} class="lg:w-4 lg:h-4" />
								<span class="hidden sm:inline">{getStatusLabel(task.status)}</span>
								<span class="sm:hidden">{task.status === 'done' ? 'เสร็จ' : task.status === 'in-progress' ? 'ทำ' : 'รอ'}</span>
							</button>
						</td>
						<td class="px-3 py-2 lg:px-4 lg:py-3">
							<span class="text-xs lg:text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap {isOverdue(task.date, task.status) ? 'text-red-600 dark:text-red-400 font-medium' : ''}">
								{formatDate(task.date)}
								{#if isOverdue(task.date, task.status)}
									<span class="ml-1 text-red-500">!</span>
								{/if}
							</span>
						</td>
						<td class="px-3 py-2 lg:px-4 lg:py-3 hidden sm:table-cell">
							<span class="text-xs lg:text-sm text-gray-700 dark:text-gray-300 font-mono whitespace-nowrap">
								{formatDuration(task.duration_minutes)}
							</span>
						</td>
						<td class="px-3 py-2 lg:px-4 lg:py-3">
							<div class="flex items-center justify-center gap-1 lg:gap-2">
								<button
									on:click={() => dispatch('edit', task)}
									class="p-1 lg:p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
									title="แก้ไข"
								>
									<Edit2 size={14} class="lg:w-4 lg:h-4" />
								</button>
								<button
									on:click={() => dispatch('delete', task.id!)}
									class="p-1 lg:p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
									title="ลบ"
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
								<p class="text-sm lg:text-base">ไม่พบงาน</p>
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
					<div class="p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
						<div class="flex items-start gap-3">
							<input
								type="checkbox"
								checked={selectedTasks.has(task.id!)}
								on:change={() => toggleSelect(task.id!)}
								class="w-4 h-4 mt-1 rounded border-gray-300 text-primary focus:ring-primary flex-shrink-0"
							/>
							<div class="flex-1 min-w-0">
								<!-- Header: Title and Actions -->
								<div class="flex items-start justify-between gap-2">
									<h3 class="font-medium text-gray-900 dark:text-white text-sm line-clamp-2 flex-1" title={task.title}>
										{task.title}
									</h3>
									<div class="flex items-center gap-1 flex-shrink-0">
										<button
											on:click={() => dispatch('edit', task)}
											class="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
										>
											<Edit2 size={16} />
										</button>
										<button
											on:click={() => dispatch('delete', task.id!)}
											class="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
										>
											<Trash2 size={16} />
										</button>
										<button
											on:click={() => toggleMobileCard(task.id!)}
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

								<!-- Quick Info Row -->
								<div class="flex flex-wrap items-center gap-2 mt-2">
									<!-- Status -->
									<button
										on:click={() => handleStatusChange(task.id!, task.status === 'todo' ? 'in-progress' : task.status === 'in-progress' ? 'done' : 'todo')}
										class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors {getStatusClass(task.status)}"
									>
										<svelte:component this={getStatusIcon(task.status)} size={12} />
										{getStatusLabel(task.status)}
									</button>

									<!-- Due Date -->
									<span class="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 {isOverdue(task.date, task.status) ? 'text-red-600 dark:text-red-400 font-medium' : ''}">
										<Calendar size={12} />
										{formatDate(task.date)}
										{#if isOverdue(task.date, task.status)}
											<span class="text-red-500">(เลยกำหนด)</span>
										{/if}
									</span>

									<!-- Duration -->
									{#if task.duration_minutes > 0}
										<span class="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
											<Clock size={12} />
											{formatDuration(task.duration_minutes)}
										</span>
									{/if}
								</div>

								<!-- Expanded Details -->
								{#if expandedMobileCards.has(task.id!)}
									<div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2 animate-expand">
										<!-- Project -->
										{#if task.project}
											<div class="flex items-center gap-2">
												<Folder size={14} class="text-gray-400 flex-shrink-0" />
												<span class="text-xs text-gray-700 dark:text-gray-300">{task.project}</span>
											</div>
										{/if}

										<!-- Category -->
										<div class="flex items-center gap-2">
											<span class="text-xs text-gray-500 dark:text-gray-400">หมวดหมู่:</span>
											<span class="text-xs text-gray-700 dark:text-gray-300">{task.category || 'อื่นๆ'}</span>
										</div>

										<!-- Assignee -->
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

										<!-- Full Due Date -->
										<div class="flex items-center gap-2">
											<Calendar size={14} class="text-gray-400 flex-shrink-0" />
											<span class="text-xs text-gray-700 dark:text-gray-300">{formatDateFull(task.date)}</span>
										</div>

										<!-- Notes -->
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
					<p>ไม่พบงาน</p>
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
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.line-clamp-2 {
		display: -webkit-box;
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
