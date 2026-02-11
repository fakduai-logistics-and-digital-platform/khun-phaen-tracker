<script lang="ts">
	export let id: string = 'select';
	export let value: string | number | null = 'all';
	export let options: Array<{ value: string | number | null; label: string; badge?: string; badgeColor?: string }> = [];
	export let placeholder: string = 'ค้นหา...';
	export let emptyText: string = 'ไม่พบรายการ';
	export let showSearch: boolean = true;
	export let maxDisplay: number = 8;

	let isOpen = false;
	let searchQuery = '';
	let dropdownRef: HTMLDivElement;
	let searchInputRef: HTMLInputElement;

	// Filter by search query
	$: filteredOptions = searchQuery.trim()
		? options.filter(opt => 
			opt.label.toLowerCase().includes(searchQuery.toLowerCase())
		)
		: options;

	// Show only top N in dropdown if no search
	$: displayOptions = searchQuery.trim() ? filteredOptions : filteredOptions.slice(0, maxDisplay);
	$: hasMore = !searchQuery.trim() && filteredOptions.length > maxDisplay;

	// Get selected label
	$: selectedLabel = options.find(opt => opt.value === value)?.label || 'ทั้งหมด';
	$: selectedBadge = options.find(opt => opt.value === value)?.badge;
	$: selectedBadgeColor = options.find(opt => opt.value === value)?.badgeColor;

	function selectOption(optionValue: string | number | null) {
		value = optionValue;
		isOpen = false;
		searchQuery = '';
	}

	function toggleDropdown() {
		isOpen = !isOpen;
		if (isOpen) {
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
		class="w-full h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white dark:bg-gray-800 text-left flex items-center justify-between transition-colors hover:border-gray-400 dark:hover:border-gray-500"
		on:click={toggleDropdown}
	>
		<span class="truncate flex items-center gap-2">
			{#if selectedBadge}
				<span class="flex-shrink-0 w-2 h-2 rounded-full {selectedBadgeColor || 'bg-gray-400'}"></span>
			{/if}
			<span class={value === 'all' || value === null ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'}>
				{selectedLabel}
			</span>
		</span>
		<svg class="w-4 h-4 text-gray-400 flex-shrink-0 ml-2 transition-transform duration-200 {isOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	<!-- Dropdown -->
	{#if isOpen}
		<div class="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-80 overflow-hidden" transition:fade={{ duration: 100 }}>
			<!-- Search Input -->
			{#if showSearch && options.length > maxDisplay}
				<div class="p-2 border-b border-gray-200 dark:border-gray-700">
					<div class="relative">
						<svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
						</svg>
						<input
							type="text"
							bind:this={searchInputRef}
							bind:value={searchQuery}
							placeholder={placeholder}
							class="w-full h-9 pl-9 pr-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
						/>
					</div>
				</div>
			{/if}

			<!-- Options -->
			<div class="overflow-y-auto max-h-60">
				{#if displayOptions.length === 0}
					<div class="px-4 py-3 text-sm text-gray-500 text-center">
						{emptyText}
					</div>
				{:else}
					{#each displayOptions as option}
						<button
							type="button"
							class="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors {value === option.value ? 'bg-primary/10 text-primary font-medium' : 'text-gray-900 dark:text-gray-100'}"
							on:click={() => selectOption(option.value)}
						>
							{#if option.badge}
								<span class="flex-shrink-0 w-2 h-2 rounded-full {option.badgeColor || 'bg-gray-400'}"></span>
							{/if}
							<span class="truncate flex-1">{option.label}</span>
							{#if value === option.value}
								<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
							{/if}
						</button>
					{/each}

					{#if hasMore}
						<div class="px-4 py-2 text-xs text-gray-500 text-center border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
							พิมพ์เพื่อค้นหารายการอื่นๆ ({filteredOptions.length - maxDisplay} รายการ)
						</div>
					{/if}
				{/if}
			</div>
		</div>
	{/if}
</div>

<script lang="ts" context="module">
	import { fade } from 'svelte/transition';
</script>
