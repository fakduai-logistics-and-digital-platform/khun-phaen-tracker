<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Task, Sprint } from '$lib/types';
	import { Calendar, Tag, FileText, Edit2, Trash2, MoreVertical, User, Folder, Flag, Archive, ListTodo } from 'lucide-svelte';
	import Pagination from './Pagination.svelte';
	import { _ } from '$lib/i18n';

	const dispatch = createEventDispatcher<{
		edit: Task;
		delete: number;
		statusChange: { id: number; status: Task['status'] };
	}>();

	export let tasks: Task[] = [];
	export let sprints: Sprint[] = [];

	function getSprintName(sprintId: string | number | null | undefined): string | null {
		if (!sprintId) return null;
		return sprints.find(s => String(s.id) === String(sprintId))?.name || null;
	}

	// Pagination
	let pageSize = 50;
	let currentPage = 1;

	$: paginatedTasks = tasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('th-TH', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function getStatusColor(status: Task['status'], isArchived: boolean = false): string {
		if (isArchived) return 'bg-gray-200/50 text-gray-500 border-gray-300/30';
		switch (status) {
			case 'todo': return 'bg-warning/10 text-warning border-warning/30';
			case 'in-progress': return 'bg-primary/10 text-primary border-primary/30';
			case 'done': return 'bg-success/10 text-success border-success/30';
			case 'in-test': return 'bg-purple-100/50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-300/30';
		}
	}

	function getStatusText(status: Task['status'], isArchived: boolean = false): string {
		if (isArchived) return $_('taskList__archived');
		switch (status) {
			case 'todo': return $_('taskList__status_todo');
			case 'in-progress': return $_('taskList__status_in_progress');
			case 'done': return $_('taskList__status_done');
			case 'in-test': return $_('taskList__status_in_test');
		}
	}

	let openMenuId: number | null | undefined = null;
</script>

<div class="space-y-3">
	{#if tasks.length === 0}
		<div class="text-center py-12 text-gray-500 dark:text-gray-400">
			<p>{$_('taskList__no_tasks')}</p>
			<p class="text-sm mt-1">{$_('taskList__add_task_hint')}</p>
		</div>
	{:else}
		{#each paginatedTasks as task (task.id)}
			<div 
				class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow group cursor-pointer"
				on:click={() => dispatch('edit', task)}
				on:keydown={(e) => e.key === 'Enter' && dispatch('edit', task)}
				role="button"
				tabindex="0"
			>
				<div class="flex items-start justify-between gap-4">
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 flex-wrap">
							<h3 class="font-medium text-gray-900 dark:text-white truncate">{task.title}</h3>
							<span class="px-2 py-0.5 text-xs rounded-full border {getStatusColor(task.status, task.is_archived)}">
								{getStatusText(task.status, task.is_archived)}
							</span>
						</div>

						<div class="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
							<span class="flex items-center gap-1">
								<Calendar size={14} />
								{formatDate(task.date)}
							</span>
							{#if task.project}
								<span class="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
									<Folder size={12} />
									{task.project}
								</span>
							{/if}
							{#if getSprintName(task.sprint_id) && !task.is_archived}
								<span class="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-xs">
									<Flag size={12} />
									{getSprintName(task.sprint_id)}
								</span>
							{/if}
							{#if task.is_archived && getSprintName(task.sprint_id)}
								<span class="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs border border-gray-200 dark:border-gray-600">
									<Archive size={12} />
									{getSprintName(task.sprint_id)}
								</span>
							{/if}
							<span class="flex items-center gap-1">
								<Tag size={14} />
								{task.category}
							</span>
						</div>

						{#if task.notes}
							<p class="mt-2 text-sm text-gray-600 dark:text-gray-300 flex items-start gap-1">
								<FileText size={14} class="mt-0.5 shrink-0" />
								<span class="line-clamp-2">{task.notes}</span>
							</p>
						{/if}

						{#if task.checklist && task.checklist.length > 0}
							{@const completed = task.checklist.filter(i => i.completed).length}
							{@const total = task.checklist.length}
							{@const percent = Math.round((completed / total) * 100)}
							<div class="mt-3 max-w-xs">
								<div class="flex justify-between items-center text-[10px] text-gray-400 dark:text-gray-500 mb-1 px-0.5">
									<span class="flex items-center gap-1">
										<ListTodo size={11} />
										Checklist: {completed}/{total}
									</span>
									<span>{percent}%</span>
								</div>
								<div class="h-1 w-full bg-gray-200 dark:bg-gray-700/50 rounded-full overflow-hidden">
									<div 
										class="h-full bg-primary transition-all duration-300" 
										style="width: {percent}%"
									></div>
								</div>
							</div>
						{/if}
					</div>

					<div class="relative">
						<button
							on:click|stopPropagation={() => openMenuId = openMenuId === task.id ? null : task.id}
							class="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
						>
							<MoreVertical size={18} />
						</button>

						{#if openMenuId === task.id}
							<div class="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
								<button
									on:click={() => {
										dispatch('edit', task);
										openMenuId = null;
									}}
									class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
								>
									<Edit2 size={14} />
									{$_('taskList__edit')}
								</button>
								{#if task.status !== 'done'}
									<button
										on:click={() => {
											dispatch('statusChange', { id: task.id!, status: 'done' });
											openMenuId = null;
										}}
										class="w-full px-4 py-2 text-left text-sm text-success hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
									>
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
										{$_('taskList__mark_done')}
									</button>
								{/if}
								<div class="border-t border-gray-100 dark:border-gray-700 my-1"></div>
								<button
									on:click={() => {
										dispatch('delete', task.id!);
										openMenuId = null;
									}}
									class="w-full px-4 py-2 text-left text-sm text-danger hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
								>
									<Trash2 size={14} />
									{$_('taskList__delete')}
								</button>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	{/if}

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

<!-- Click outside to close menu -->
{#if openMenuId !== null}
	<button
		class="fixed inset-0 z-0"
		on:click={() => openMenuId = null}
		tabindex="-1"
		aria-label={$_('taskList__close_menu')}
	></button>
{/if}
