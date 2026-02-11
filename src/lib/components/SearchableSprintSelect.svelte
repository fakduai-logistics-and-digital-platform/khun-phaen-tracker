<script lang="ts">
	import type { Sprint } from '$lib/stores/sprintStore';

	export let sprints: Sprint[] = [];
	export let value: number | 'all' | null = 'all';
	export let id: string = 'sprint';

	let isOpen = false;
	let searchQuery = '';
	let dropdownRef: HTMLDivElement;
	let searchInputRef: HTMLInputElement;

	// Sort sprints by date (newest first), then by status
	$: sortedSprints = [...sprints].sort((a, b) => {
		// Active sprint first
		if (a.status === 'active' && b.status !== 'active') return -1;
		if (b.status === 'active' && a.status !== 'active') return 1;
		// Then by start date (newest first)
		return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
	});

	// Filter by search query
	$: filteredSprints = searchQuery.trim()
		? sortedSprints.filter(s => 
			s.name.toLowerCase().includes(searchQuery.toLowerCase())
		)
		: sortedSprints;

	// Show only top 5 in dropdown if no search
	$: displaySprints = searchQuery.trim() ? filteredSprints : filteredSprints.slice(0, 5);
	$: hasMore = !searchQuery.trim() && filteredSprints.length > 5;

	// Get selected sprint name
	$: selectedLabel = getSelectedLabel(value, sprints);

	function getSelectedLabel(val: number | 'all' | null, sprintList: Sprint[]): string {
		if (val === 'all') return 'ทั้งหมด';
		if (val === null) return 'ไม่มี Sprint';
		const sprint = sprintList.find(s => s.id === val);
		if (!sprint) return 'ทั้งหมด';
		const statusText = sprint.status === 'active' ? ' (กำลังทำ)' : 
			sprint.status === 'completed' ? ' (เสร็จสิ้น)' : '';
		return sprint.name + statusText;
	}

	function selectSprint(sprintId: number | 'all' | null) {
		value = sprintId;
		isOpen = false;
		searchQuery = '';
	}

	function toggleDropdown() {
		isOpen = !isOpen;
		if (isOpen) {
			// Focus search input after dropdown opens
			setTimeout(() => searchInputRef?.focus(), 0);
		}
	}

	function handleClickOutside(event: MouseEvent) {
		if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
			isOpen = false;
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			isOpen = false;
		}
	}
</script>

<svelte:window on:click={handleClickOutside} on:keydown={handleKeyDown} />

<div class="relative" bind:this={dropdownRef}>
	<!-- Trigger Button -->
	<button
		type="button"
		{id}
		class="w-full h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white dark:bg-gray-800 text-left flex items-center justify-between"
		on:click={toggleDropdown}
	>
		<span class="truncate {value === 'all' || value === null ? 'text-gray-500' : 'text-gray-900 dark:text-gray-100'}">
			{selectedLabel}
		</span>
		<svg class="w-4 h-4 text-gray-400 flex-shrink-0 ml-2 transition-transform {isOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	<!-- Dropdown -->
	{#if isOpen}
		<div class="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-80 overflow-hidden">
			<!-- Search Input -->
			<div class="p-2 border-b border-gray-200 dark:border-gray-700">
				<div class="relative">
					<svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
					<input
						type="text"
						bind:this={searchInputRef}
						bind:value={searchQuery}
						placeholder="ค้นหา Sprint..."
						class="w-full h-9 pl-9 pr-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
					/>
				</div>
			</div>

			<!-- Options -->
			<div class="overflow-y-auto max-h-60">
				<!-- Default options -->
				<button
					type="button"
					class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 {value === 'all' ? 'bg-primary/10 text-primary font-medium' : 'text-gray-900 dark:text-gray-100'}"
					on:click={() => selectSprint('all')}
				>
					ทั้งหมด
				</button>
				<button
					type="button"
					class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 {value === null ? 'bg-primary/10 text-primary font-medium' : 'text-gray-900 dark:text-gray-100'}"
					on:click={() => selectSprint(null)}
				>
					ไม่มี Sprint
				</button>

				<div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>

				<!-- Sprint options -->
				{#if displaySprints.length === 0}
					<div class="px-4 py-3 text-sm text-gray-500 text-center">
						ไม่พบ Sprint
					</div>
				{:else}
					{#each displaySprints as sprint}
						<button
							type="button"
							class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 {value === sprint.id ? 'bg-primary/10 text-primary font-medium' : 'text-gray-900 dark:text-gray-100'}"
							on:click={() => selectSprint(sprint.id)}
						>
							<span class="truncate flex-1">{sprint.name}</span>
							{#if sprint.status === 'active'}
								<span class="flex-shrink-0 px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">กำลังทำ</span>
							{:else if sprint.status === 'completed'}
								<span class="flex-shrink-0 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded-full">เสร็จสิ้น</span>
							{:else}
								<span class="flex-shrink-0 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">วางแผน</span>
							{/if}
						</button>
					{/each}

					{#if hasMore}
						<div class="px-4 py-2 text-xs text-gray-500 text-center border-t border-gray-200 dark:border-gray-700">
							พิมพ์เพื่อค้นหา Sprint อื่นๆ ({filteredSprints.length - 5} รายการ)
						</div>
					{/if}
				{/if}
			</div>
		</div>
	{/if}
</div>
