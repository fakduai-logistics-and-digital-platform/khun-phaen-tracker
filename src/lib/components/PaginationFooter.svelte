<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { ChevronLeft, ChevronRight, Settings2 } from 'lucide-svelte';

	export let currentPage: number = 1;
	export let totalPages: number = 1;
	export let totalTasks: number = 0;
	export let pageSize: number = 20;

	const dispatch = createEventDispatcher<{
		pageChange: number;
		pageSizeSettings: void;
	}>();

	function handlePageChange(newPage: number) {
		if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
		dispatch('pageChange', newPage);
	}
</script>

<div class="px-3 py-1.5 bg-gray-50/80 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700 flex flex-col md:flex-row items-center justify-end gap-2 backdrop-blur-sm">
	<div class="flex items-center gap-3">
		<div class="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900/50 px-3 py-1.5 rounded-full border border-gray-100 dark:border-gray-700 shadow-sm">
			<span>กำลังแสดง {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalTasks)} จากทั้งหมด {totalTasks}</span>
		</div>
		
		<button
			on:click={() => dispatch('pageSizeSettings')}
			class="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 hover:border-primary/50 text-gray-500 dark:text-gray-400 rounded-full transition-all text-xs font-bold shadow-sm active:scale-95"
		>
			<Settings2 size={13} class="text-primary/70" />
			<span>{pageSize} / หน้า</span>
		</button>
	</div>

	{#if totalPages > 1}
		<div class="flex items-center gap-1 bg-white dark:bg-gray-900 p-1 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
			<button
				class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-20 transition-all"
				disabled={currentPage === 1}
				on:click={() => handlePageChange(currentPage - 1)}
			>
				<ChevronLeft size={14} />
			</button>

							<div class="flex items-center gap-0.5 px-0.5">
				{#each Array(totalPages) as _, i}
					{@const pageNum = i + 1}
					{#if totalPages <= 5 || pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)}
						<button
							class="w-7 h-7 rounded-lg font-bold transition-all text-[10px]
								{currentPage === pageNum 
									? 'bg-primary text-white shadow-sm' 
									: 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400'}"
							on:click={() => handlePageChange(pageNum)}
						>
							{pageNum}
						</button>
					{:else if (pageNum === 2 && currentPage > 3) || (pageNum === totalPages - 1 && currentPage < totalPages - 2)}
						<div class="w-4 text-center text-[10px] text-gray-300">...</div>
					{/if}
				{/each}
			</div>

			<button
				class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-20 transition-all"
				disabled={currentPage === totalPages}
				on:click={() => handlePageChange(currentPage + 1)}
			>
				<ChevronRight size={14} />
			</button>
		</div>
	{/if}
</div>
