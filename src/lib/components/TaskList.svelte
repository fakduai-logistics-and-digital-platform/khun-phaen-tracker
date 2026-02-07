<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Task } from '$lib/types';
	import { Calendar, Tag, FileText, Edit2, Trash2, MoreVertical, User, Folder } from 'lucide-svelte';
	
	const dispatch = createEventDispatcher<{
		edit: Task;
		delete: number;
		statusChange: { id: number; status: Task['status'] };
	}>();
	
	export let tasks: Task[] = [];
	
	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('th-TH', { 
			year: 'numeric', 
			month: 'short', 
			day: 'numeric' 
		});
	}
	
	function getStatusColor(status: Task['status']): string {
		switch (status) {
			case 'todo': return 'bg-warning/10 text-warning border-warning/30';
			case 'in-progress': return 'bg-primary/10 text-primary border-primary/30';
			case 'done': return 'bg-success/10 text-success border-success/30';
		}
	}
	
	function getStatusText(status: Task['status']): string {
		switch (status) {
			case 'todo': return 'รอดำเนินการ';
			case 'in-progress': return 'กำลังทำ';
			case 'done': return 'เสร็จแล้ว';
		}
	}
	
	let openMenuId: number | null | undefined = null;
</script>

<div class="space-y-3">
	{#if tasks.length === 0}
		<div class="text-center py-12 text-gray-500 dark:text-gray-400">
			<p>ไม่มีงานในช่วงเวลานี้</p>
			<p class="text-sm mt-1">ลองเพิ่มงานใหม่ดูสิ!</p>
		</div>
	{:else}
		{#each tasks as task (task.id)}
			<div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow group">
				<div class="flex items-start justify-between gap-4">
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 flex-wrap">
							<h3 class="font-medium text-gray-900 dark:text-white truncate">{task.title}</h3>
							<span class="px-2 py-0.5 text-xs rounded-full border {getStatusColor(task.status)}">
								{getStatusText(task.status)}
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
							<span class="flex items-center gap-1">
								<Tag size={14} />
								{task.category}
							</span>
						</div>
						
						{#if task.notes}
							<p class="mt-2 text-sm text-gray-600 dark:text-gray-300 flex items-start gap-1">
								<FileText size={14} class="mt-0.5 flex-shrink-0" />
								<span class="line-clamp-2">{task.notes}</span>
							</p>
						{/if}
					</div>
					
					<div class="relative">
						<button
							on:click={() => openMenuId = openMenuId === task.id ? null : task.id}
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
									แก้ไข
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
										ทำเสร็จแล้ว
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
									ลบ
								</button>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	{/if}
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
