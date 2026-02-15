<script lang="ts">
	import { dndzone, TRIGGERS, type DndEvent } from 'svelte-dnd-action';
	import { createEventDispatcher } from 'svelte';
	import type { Task, Sprint } from '$lib/types';
	import { Edit2, Trash2, MoreVertical, Folder, Clock3, Hammer, CheckCircle2, Flag, FlaskConical } from 'lucide-svelte';
	import { _ } from '$lib/i18n';

	const dispatch = createEventDispatcher<{
		move: { id: number; newStatus: Task['status'] };
		edit: Task;
		delete: number;
	}>();

	export let tasks: Task[] = [];
	export let sprints: Sprint[] = [];

	function getSprintName(sprintId: number | null | undefined): string | null {
		if (!sprintId) return null;
		return sprints.find(s => s.id === sprintId)?.name || null;
	}

	interface TaskWithRequiredId extends Task {
		id: number;
	}

	$: todoItems = tasks.filter((t): t is TaskWithRequiredId => t.status === 'todo' && t.id !== undefined);
	$: inProgressItems = tasks.filter((t): t is TaskWithRequiredId => t.status === 'in-progress' && t.id !== undefined);
	$: inTestItems = tasks.filter((t): t is TaskWithRequiredId => t.status === 'in-test' && t.id !== undefined);
	$: doneItems = tasks.filter((t): t is TaskWithRequiredId => t.status === 'done' && t.id !== undefined);

	const columns = [
		{ id: 'todo', title: $_('kanbanBoard__column_todo'), color: 'bg-warning/10 border-warning/30', textColor: 'text-warning', icon: Clock3 },
		{ id: 'in-progress', title: $_('kanbanBoard__column_in_progress'), color: 'bg-primary/10 border-primary/30', textColor: 'text-primary', icon: Hammer },
		{ id: 'in-test', title: $_('kanbanBoard__column_in_test'), color: 'bg-purple-100/50 dark:bg-purple-900/20 border-purple-300/50 dark:border-purple-700/50', textColor: 'text-purple-600 dark:text-purple-400', icon: FlaskConical },
		{ id: 'done', title: $_('kanbanBoard__column_done'), color: 'bg-success/10 border-success/30', textColor: 'text-success', icon: CheckCircle2 }
	] as const;

	function getItemsByStatus(status: Task['status']): TaskWithRequiredId[] {
		switch (status) {
			case 'todo': return todoItems;
			case 'in-progress': return inProgressItems;
			case 'in-test': return inTestItems;
			case 'done': return doneItems;
		}
	}

	function handleDndConsider(e: CustomEvent<DndEvent<TaskWithRequiredId>>, status: Task['status']) {
		const items = e.detail.items;
		switch (status) {
			case 'todo': todoItems = items; break;
			case 'in-progress': inProgressItems = items; break;
			case 'in-test': inTestItems = items; break;
			case 'done': doneItems = items; break;
		}
	}

	function handleDndFinalize(e: CustomEvent<DndEvent<TaskWithRequiredId>>, status: Task['status']) {
		const items = e.detail.items;

		switch (status) {
			case 'todo': todoItems = items; break;
			case 'in-progress': inProgressItems = items; break;
			case 'in-test': inTestItems = items; break;
			case 'done': doneItems = items; break;
		}

		if ((e.detail.info.trigger as any) === (TRIGGERS.DROPPED_INTO_ZONE as any)) {
			const droppedId = Number(e.detail.info.id);
			if (!Number.isFinite(droppedId)) return;
			const originalTask = tasks.find(t => t.id === droppedId);

			if (originalTask && originalTask.status !== status) {
				dispatch('move', { id: droppedId, newStatus: status });
			}
		}
	}

	function getColumnBg(status: Task['status']): string {
		switch (status) {
			case 'todo': return 'bg-gray-100 dark:bg-gray-800';
			case 'in-progress': return 'bg-primary/5 dark:bg-primary/10 border-2 border-primary/20 dark:border-primary/30';
			case 'in-test': return 'bg-purple-50/50 dark:bg-purple-900/10 border-2 border-purple-200/40 dark:border-purple-700/30';
			case 'done': return 'bg-success/5 dark:bg-success/10 border-2 border-success/20 dark:border-success/30';
		}
	}

	function getCardBorderClass(status: Task['status']): string {
		switch (status) {
			case 'in-progress': return 'border-primary/30';
			case 'in-test': return 'border-purple-300/30 dark:border-purple-600/30';
			case 'done': return 'border-success/30 opacity-75';
			default: return '';
		}
	}

	function getCountBadgeClass(status: Task['status']): string {
		switch (status) {
			case 'todo': return 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
			case 'in-progress': return 'bg-primary/20 text-primary';
			case 'in-test': return 'bg-purple-200/50 dark:bg-purple-800/30 text-purple-600 dark:text-purple-400';
			case 'done': return 'bg-success/20 text-success';
		}
	}

	function getCategoryBadgeClass(status: Task['status']): string {
		switch (status) {
			case 'in-progress': return 'bg-primary/10 text-primary';
			case 'in-test': return 'bg-purple-100/50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400';
			case 'done': return 'bg-success/10 text-success';
			default: return 'bg-gray-100 dark:bg-gray-700';
		}
	}

	function getTitleClass(status: Task['status']): string {
		if (status === 'done') return 'font-medium text-gray-900 dark:text-white text-sm flex-1 line-through';
		return 'font-medium text-gray-900 dark:text-white text-sm flex-1';
	}

	function getIconByStatus(status: Task['status']) {
		switch (status) {
			case 'todo': return Clock3;
			case 'in-progress': return Hammer;
			case 'in-test': return FlaskConical;
			case 'done': return CheckCircle2;
		}
	}

	function getIconColorClass(status: Task['status']): string {
		switch (status) {
			case 'todo': return 'text-warning';
			case 'in-progress': return 'text-primary';
			case 'in-test': return 'text-purple-600 dark:text-purple-400';
			case 'done': return 'text-success';
		}
	}

	function getHeaderTextClass(status: Task['status']): string {
		switch (status) {
			case 'todo': return 'font-semibold text-gray-700 dark:text-gray-200';
			case 'in-progress': return 'font-semibold text-primary';
			case 'in-test': return 'font-semibold text-purple-600 dark:text-purple-400';
			case 'done': return 'font-semibold text-success';
		}
	}

	function getColumnTitle(status: Task['status']): string {
		switch (status) {
			case 'todo': return $_('kanbanBoard__column_todo');
			case 'in-progress': return $_('kanbanBoard__column_in_progress');
			case 'in-test': return $_('kanbanBoard__column_in_test');
			case 'done': return $_('kanbanBoard__column_done');
		}
	}

	let openMenuId: number | null = null;

	const statusColumns: Task['status'][] = ['todo', 'in-progress', 'in-test', 'done'];
</script>

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
	{#each statusColumns as status}
		{@const items = getItemsByStatus(status)}
		<div class="{getColumnBg(status)} rounded-xl p-3 transition-colors">
			<div class="flex items-center justify-between mb-3 px-1">
				<div class="flex items-center gap-2">
					<svelte:component this={getIconByStatus(status)} size={18} class={getIconColorClass(status)} />
					<h3 class={getHeaderTextClass(status)}>{getColumnTitle(status)}</h3>
					<span class="{getCountBadgeClass(status)} px-2 py-0.5 rounded-full text-xs font-medium">
						{items.length}
					</span>
				</div>
			</div>

			<div
				use:dndzone={{ items, flipDurationMs: 200 }}
				on:consider={(e) => handleDndConsider(e, status)}
				on:finalize={(e) => handleDndFinalize(e, status)}
				class="space-y-2 min-h-25"
			>
				{#each items as task (task.id)}
					<div class="kanban-card relative group {getCardBorderClass(status)}">
						<div class="flex items-start justify-between gap-2">
							<h4 class={getTitleClass(status)}>{task.title}</h4>
							<button
								on:click={() => openMenuId = openMenuId === task.id ? null : task.id}
								class="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
							>
								<MoreVertical size={14} />
							</button>
						</div>

						<div class="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
							{#if task.project}
								<span class="flex items-center gap-0.5 px-1.5 py-0.5 bg-primary/10 text-primary rounded">
									<Folder size={10} />
									<span class="truncate max-w-15">{task.project}</span>
								</span>
							{/if}
							{#if getSprintName(task.sprint_id)}
								<span class="flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded">
									<Flag size={10} />
									<span class="truncate max-w-15">{getSprintName(task.sprint_id)}</span>
								</span>
							{/if}
							<span class="px-1.5 py-0.5 {getCategoryBadgeClass(status)} rounded">{task.category}</span>
							{#if task.assignee}
								<span class="flex items-center gap-1" title={task.assignee.name}>
									<span class="w-2 h-2 rounded-full" style="background-color: {task.assignee.color}"></span>
									<span class="truncate max-w-15">{task.assignee.name}</span>
								</span>
							{/if}
						</div>

						{#if openMenuId === task.id}
							<div class="absolute right-2 top-8 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
								<button
									on:click={() => { dispatch('edit', task); openMenuId = null; }}
									class="w-full px-3 py-1.5 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1.5"
								>
									<Edit2 size={12} />
									{$_('kanbanBoard__edit')}
								</button>
								<button
									on:click={() => { dispatch('delete', task.id!); openMenuId = null; }}
									class="w-full px-3 py-1.5 text-left text-xs text-danger hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1.5"
								>
									<Trash2 size={12} />
									{$_('kanbanBoard__delete')}
								</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/each}
</div>

<!-- Click outside to close menu -->
{#if openMenuId !== null}
	<button
		class="fixed inset-0 z-0"
		on:click={() => openMenuId = null}
		tabindex="-1"
		aria-label={$_('kanbanBoard__close_menu')}
	></button>
{/if}
