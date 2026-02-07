<script lang="ts">
	import { dndzone, TRIGGERS, type DndEvent } from 'svelte-dnd-action';
	import { createEventDispatcher } from 'svelte';
	import type { Task } from '$lib/types';
	import { Edit2, Trash2, MoreVertical, Folder } from 'lucide-svelte';
	
	const dispatch = createEventDispatcher<{
		move: { id: number; newStatus: Task['status'] };
		edit: Task;
		delete: number;
	}>();
	
	export let tasks: Task[] = [];
	
	interface TaskWithRequiredId extends Task {
		id: number;
	}
	
	$: todoItems = tasks.filter((t): t is TaskWithRequiredId => t.status === 'todo' && t.id !== undefined);
	$: inProgressItems = tasks.filter((t): t is TaskWithRequiredId => t.status === 'in-progress' && t.id !== undefined);
	$: doneItems = tasks.filter((t): t is TaskWithRequiredId => t.status === 'done' && t.id !== undefined);
	
	const columns = [
		{ id: 'todo', title: 'รอดำเนินการ', color: 'bg-warning/10 border-warning/30', textColor: 'text-warning', icon: '⏳' },
		{ id: 'in-progress', title: 'กำลังทำ', color: 'bg-primary/10 border-primary/30', textColor: 'text-primary', icon: '🔨' },
		{ id: 'done', title: 'เสร็จแล้ว', color: 'bg-success/10 border-success/30', textColor: 'text-success', icon: '✅' }
	] as const;
	
	function handleDndConsider(e: CustomEvent<DndEvent<TaskWithRequiredId>>, status: Task['status']) {
		// During dragging, just update the display without filtering
		// This allows items to be shown in their new column during drag
		const items = e.detail.items;
		switch (status) {
			case 'todo': todoItems = items; break;
			case 'in-progress': inProgressItems = items; break;
			case 'done': doneItems = items; break;
		}
	}

	function handleDndFinalize(e: CustomEvent<DndEvent<TaskWithRequiredId>>, status: Task['status']) {
		const items = e.detail.items;

		// Always update the reactive arrays first
		switch (status) {
			case 'todo': todoItems = items; break;
			case 'in-progress': inProgressItems = items; break;
			case 'done': doneItems = items; break;
		}

		// Check if any item was dropped into this zone from another column
		if ((e.detail.info.trigger as any) === (TRIGGERS.DROPPED_INTO_ZONE as any)) {
			const droppedId = e.detail.info.id;

			// Find the dropped item in the original tasks array
			const originalTask = tasks.find(t => t.id === droppedId);

			if (originalTask && originalTask.status !== status) {
				// Dispatch the move event to parent to update the database
				dispatch('move', { id: droppedId, newStatus: status });
			}
		}
	}
	
	let openMenuId: number | null = null;
</script>

<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
	<!-- Todo Column -->
	<div class="bg-gray-100 dark:bg-gray-800 rounded-xl p-3 transition-colors">
		<div class="flex items-center justify-between mb-3 px-1">
			<div class="flex items-center gap-2">
				<span class="text-lg">⏳</span>
				<h3 class="font-semibold text-gray-700 dark:text-gray-200">รอดำเนินการ</h3>
				<span class="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full text-xs font-medium">
					{todoItems.length}
				</span>
			</div>
		</div>

		<div
			use:dndzone={{ items: todoItems, flipDurationMs: 200 }}
			on:consider={(e) => handleDndConsider(e, 'todo')}
			on:finalize={(e) => handleDndFinalize(e, 'todo')}
			class="space-y-2 min-h-[100px]"
		>
			{#each todoItems as task (task.id)}
				<div class="kanban-card relative group">
					<div class="flex items-start justify-between gap-2">
						<h4 class="font-medium text-gray-900 dark:text-white text-sm flex-1">{task.title}</h4>
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
								<span class="truncate max-w-[60px]">{task.project}</span>
							</span>
						{/if}
						<span class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">{task.category}</span>
						{#if task.assignee}
							<span class="flex items-center gap-1" title={task.assignee.name}>
								<span class="w-2 h-2 rounded-full" style="background-color: {task.assignee.color}"></span>
								<span class="truncate max-w-[60px]">{task.assignee.name}</span>
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
								แก้ไข
							</button>
							<button
								on:click={() => { dispatch('delete', task.id!); openMenuId = null; }}
								class="w-full px-3 py-1.5 text-left text-xs text-danger hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1.5"
							>
								<Trash2 size={12} />
								ลบ
							</button>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- In Progress Column -->
	<div class="bg-primary/5 dark:bg-primary/10 rounded-xl p-3 border-2 border-primary/20 dark:border-primary/30 transition-colors">
		<div class="flex items-center justify-between mb-3 px-1">
			<div class="flex items-center gap-2">
				<span class="text-lg">🔨</span>
				<h3 class="font-semibold text-primary">กำลังทำ</h3>
				<span class="bg-primary/20 text-primary px-2 py-0.5 rounded-full text-xs font-medium">
					{inProgressItems.length}
				</span>
			</div>
		</div>

		<div
			use:dndzone={{ items: inProgressItems, flipDurationMs: 200 }}
			on:consider={(e) => handleDndConsider(e, 'in-progress')}
			on:finalize={(e) => handleDndFinalize(e, 'in-progress')}
			class="space-y-2 min-h-[100px]"
		>
			{#each inProgressItems as task (task.id)}
				<div class="kanban-card relative group border-primary/30">
					<div class="flex items-start justify-between gap-2">
						<h4 class="font-medium text-gray-900 dark:text-white text-sm flex-1">{task.title}</h4>
						<button
							on:click={() => openMenuId = openMenuId === task.id ? null : task.id}
							class="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
						>
							<MoreVertical size={14} />
						</button>
					</div>

						{#if task.project}
							<span class="flex items-center gap-0.5 px-1.5 py-0.5 bg-primary/10 text-primary rounded">
								<Folder size={10} />
								<span class="truncate max-w-[60px]">{task.project}</span>
							</span>
						{/if}
					<div class="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
						<span class="px-1.5 py-0.5 bg-primary/10 text-primary rounded">{task.category}</span>
						{#if task.assignee}
							<span class="flex items-center gap-1" title={task.assignee.name}>
								<span class="w-2 h-2 rounded-full" style="background-color: {task.assignee.color}"></span>
								<span class="truncate max-w-[60px]">{task.assignee.name}</span>
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
								แก้ไข
							</button>
							<button
								on:click={() => { dispatch('delete', task.id!); openMenuId = null; }}
								class="w-full px-3 py-1.5 text-left text-xs text-danger hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1.5"
							>
								<Trash2 size={12} />
								ลบ
							</button>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- Done Column -->
	<div class="bg-success/5 dark:bg-success/10 rounded-xl p-3 border-2 border-success/20 dark:border-success/30 transition-colors">
		<div class="flex items-center justify-between mb-3 px-1">
			<div class="flex items-center gap-2">
				<span class="text-lg">✅</span>
				<h3 class="font-semibold text-success">เสร็จแล้ว</h3>
				<span class="bg-success/20 text-success px-2 py-0.5 rounded-full text-xs font-medium">
					{doneItems.length}
				</span>
			</div>
		</div>

		<div
			use:dndzone={{ items: doneItems, flipDurationMs: 200 }}
			on:consider={(e) => handleDndConsider(e, 'done')}
			on:finalize={(e) => handleDndFinalize(e, 'done')}
			class="space-y-2 min-h-[100px]"
		>
			{#each doneItems as task (task.id)}
				<div class="kanban-card relative group border-success/30 opacity-75">
					<div class="flex items-start justify-between gap-2">
						<h4 class="font-medium text-gray-900 dark:text-white text-sm flex-1 line-through">{task.title}</h4>
						<button
							on:click={() => openMenuId = openMenuId === task.id ? null : task.id}
							class="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
						>
							<MoreVertical size={14} />
						</button>
					</div>

						{#if task.project}
							<span class="flex items-center gap-0.5 px-1.5 py-0.5 bg-primary/10 text-primary rounded">
								<Folder size={10} />
								<span class="truncate max-w-[60px]">{task.project}</span>
							</span>
						{/if}
					<div class="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
						<span class="px-1.5 py-0.5 bg-success/10 text-success rounded">{task.category}</span>
						{#if task.assignee}
							<span class="flex items-center gap-1" title={task.assignee.name}>
								<span class="w-2 h-2 rounded-full" style="background-color: {task.assignee.color}"></span>
								<span class="truncate max-w-[60px]">{task.assignee.name}</span>
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
								แก้ไข
							</button>
							<button
								on:click={() => { dispatch('delete', task.id!); openMenuId = null; }}
								class="w-full px-3 py-1.5 text-left text-xs text-danger hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1.5"
							>
								<Trash2 size={12} />
								ลบ
							</button>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</div>

<!-- Click outside to close menu -->
{#if openMenuId !== null}
	<button
		class="fixed inset-0 z-0"
		on:click={() => openMenuId = null}
		tabindex="-1"
		aria-label="ปิดเมนู"
	></button>
{/if}
