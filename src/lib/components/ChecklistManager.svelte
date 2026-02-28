<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ChecklistItem } from '$lib/types';
	import { Check, X, Trash2, ListTodo } from 'lucide-svelte';
	import { _ } from 'svelte-i18n';

	const dispatch = createEventDispatcher<{
		update: { checklist: ChecklistItem[] };
	}>();

	export let checklist: ChecklistItem[] = [];
	export let autoDispatch = true; // Auto dispatch on changes (for edit mode)

	let newChecklistItem = '';
	let isAddingChecklistItem = false;
	let deletingChecklistItemId: string | null = null;
	let checklistVisibleCount = 10;
	let checklistSelectMode = false;
	let selectedChecklistIds: Set<string> = new Set();

	$: completedCount = checklist.filter(i => i.completed).length;
	$: progress = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0;
	$: visibleChecklist = checklist.slice(0, checklistVisibleCount);
	$: hasMoreChecklist = checklist.length > checklistVisibleCount;

	function notifyUpdate() {
		if (autoDispatch) {
			dispatch('update', { checklist });
		}
	}

	function addChecklistItem() {
		if (!newChecklistItem.trim()) return;
		checklist = [
			...checklist,
			{
				id: Date.now().toString() + Math.random().toString(36).substring(2),
				text: newChecklistItem.trim(),
				completed: false
			}
		];
		newChecklistItem = '';
		notifyUpdate();
	}

	function removeChecklistItem(id: string) {
		checklist = checklist.filter((item) => item.id !== id);
		notifyUpdate();
	}

	function toggleChecklistItem(id: string) {
		checklist = checklist.map((item) =>
			item.id === id ? { ...item, completed: !item.completed } : item
		);
		notifyUpdate();
	}

	function deleteAll() {
		checklist = [];
		selectedChecklistIds = new Set();
		checklistSelectMode = false;
		notifyUpdate();
	}

	function deleteSelected() {
		checklist = checklist.filter(i => !selectedChecklistIds.has(i.id));
		selectedChecklistIds = new Set();
		if (checklist.length === 0) checklistSelectMode = false;
		notifyUpdate();
	}

	function toggleSelectAll() {
		if (selectedChecklistIds.size === checklist.length) {
			selectedChecklistIds = new Set();
		} else {
			selectedChecklistIds = new Set(checklist.map(i => i.id));
		}
	}

	function toggleSelectMode() {
		checklistSelectMode = !checklistSelectMode;
		if (!checklistSelectMode) selectedChecklistIds = new Set();
	}

	function toggleSelectItem(id: string) {
		const next = new Set(selectedChecklistIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedChecklistIds = next;
	}

	function focusOnMount(node: HTMLInputElement) {
		node.focus();
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<ListTodo size={18} class="text-gray-700 dark:text-gray-300" />
			<span class="text-sm font-bold text-gray-900 dark:text-white">{$_('taskForm__checklist_label')}</span>
		</div>
		{#if checklist.length > 0}
			<div class="flex items-center gap-1">
				<button
					type="button"
					on:click={toggleSelectMode}
					class="px-2.5 py-1 text-xs font-medium rounded transition-colors {checklistSelectMode ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800'}"
				>
					{checklistSelectMode ? 'Done' : 'Select'}
				</button>
				<button
					type="button"
					on:click={deleteAll}
					class="px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
				>
					Delete All
				</button>
			</div>
		{/if}
	</div>

	{#if checklistSelectMode && checklist.length > 0}
		<div class="flex items-center gap-2 py-1 px-1 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
			<button
				type="button"
				on:click={toggleSelectAll}
				class="px-2.5 py-1 text-xs font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
			>
				{selectedChecklistIds.size === checklist.length ? 'Deselect All' : 'Select All'}
			</button>
			{#if selectedChecklistIds.size > 0}
				<button
					type="button"
					on:click={deleteSelected}
					class="px-2.5 py-1 text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors flex items-center gap-1"
				>
					<Trash2 size={12} />
					Delete {selectedChecklistIds.size} items
				</button>
			{/if}
			<span class="text-xs text-gray-400 ml-auto">{selectedChecklistIds.size}/{checklist.length}</span>
		</div>
	{/if}

	<div class="space-y-2">
		<div class="flex items-center gap-3">
			<span class="text-xs font-bold w-6 {progress === 100 ? 'text-green-500' : 'text-blue-500'}">{progress}%</span>
			<div class="flex-1 h-1 bg-gray-200 dark:bg-gray-700/50 rounded-full overflow-hidden">
				<div
					class="h-full transition-all duration-500 {progress === 100 ? 'bg-green-500' : 'bg-blue-500'}"
					style="width: {progress}%"
				></div>
			</div>
		</div>
	</div>

	<div class="space-y-1">
		{#each visibleChecklist as item (item.id)}
			<div class="flex items-start gap-2 group py-1 {checklistSelectMode && selectedChecklistIds.has(item.id) ? 'bg-blue-50/50 dark:bg-blue-900/10 -mx-2 px-2 rounded' : ''}">
				{#if checklistSelectMode}
					<button
						type="button"
						on:click={() => toggleSelectItem(item.id)}
						class="mt-0.5 w-5 h-5 flex items-center justify-center rounded border transition-colors flex-shrink-0 {selectedChecklistIds.has(item.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'}"
					>
						{#if selectedChecklistIds.has(item.id)}
							<Check size={14} strokeWidth={3} class="text-white" />
						{/if}
					</button>
				{:else}
					<button
						type="button"
						on:click={() => toggleChecklistItem(item.id)}
						class="mt-0.5 w-5 h-5 flex items-center justify-center rounded border border-gray-300 dark:border-gray-600 hover:border-primary transition-colors flex-shrink-0"
					>
						{#if item.completed}
							<Check size={14} strokeWidth={3} class="text-primary" />
						{/if}
					</button>
				{/if}
				<div class="flex-1 min-w-0">
					<input
						type="text"
						bind:value={item.text}
						on:change={notifyUpdate}
						class="w-full bg-transparent border-none focus:ring-0 text-sm p-0 font-medium {item.completed ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-gray-200'}"
					/>
				</div>
				{#if deletingChecklistItemId === item.id}
					<button
						type="button"
						on:click={() => { removeChecklistItem(item.id); deletingChecklistItemId = null; }}
						class="p-1 text-green-500 hover:text-green-600 transition-colors"
						title="Confirm delete"
					>
						<Check size={14} strokeWidth={3} />
					</button>
					<button
						type="button"
						on:click={() => deletingChecklistItemId = null}
						class="p-1 text-red-500 hover:text-red-600 transition-colors"
						title="Cancel"
					>
						<X size={14} strokeWidth={3} />
					</button>
				{:else}
					<button
						type="button"
						on:click={() => deletingChecklistItemId = item.id}
						class="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
					>
						<Trash2 size={14} />
					</button>
				{/if}
			</div>
		{/each}
	</div>

	{#if hasMoreChecklist}
		<button
			type="button"
			on:click={() => checklistVisibleCount += 10}
			class="w-full py-1.5 text-xs font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
		>
			ดูเพิ่มอีก {Math.min(10, checklist.length - checklistVisibleCount)} รายการ ({checklistVisibleCount}/{checklist.length})
		</button>
	{/if}

	{#if !isAddingChecklistItem}
		<button
			type="button"
			on:click={() => isAddingChecklistItem = true}
			class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors w-fit shadow-sm"
		>
			Add an item
		</button>
	{:else}
		<div class="space-y-3 pt-1">
			<input
				type="text"
				bind:value={newChecklistItem}
				on:keydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						if (newChecklistItem.trim()) {
							addChecklistItem();
						} else {
							isAddingChecklistItem = false;
						}
					} else if (e.key === 'Escape') {
						isAddingChecklistItem = false;
						newChecklistItem = '';
					}
				}}
				placeholder="Add an item"
				class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-950 border-2 border-primary/50 rounded-md focus:border-primary outline-none transition-all text-gray-900 dark:text-white"
				use:focusOnMount
			/>
			<div class="flex items-center gap-3">
				<button
					type="button"
					on:click={() => {
						if (newChecklistItem.trim()) {
							addChecklistItem();
						} else {
							isAddingChecklistItem = false;
						}
					}}
					class="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-md transition-colors shadow-sm"
				>
					Add
				</button>
				<button
					type="button"
					on:click={() => {
						isAddingChecklistItem = false;
						newChecklistItem = '';
					}}
					class="px-2 py-1.5 text-gray-700 dark:text-gray-300 text-sm font-bold hover:underline transition-colors"
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}
</div>
