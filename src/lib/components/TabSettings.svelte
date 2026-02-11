<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { tabSettings, type TabConfig, type TabId } from '$lib/stores/tabSettings';
	import { List, CalendarDays, Columns3, Table, GripVertical, ChevronUp, ChevronDown, RotateCcw, X, Check, Settings2 } from 'lucide-svelte';
	import { flip } from 'svelte/animate';
	import { quintOut } from 'svelte/easing';

	const dispatch = createEventDispatcher<{
		close: void;
		save: void;
	}>();

	// Local copy for editing
	let editingTabs: TabConfig[] = [];
	let hasChanges = false;
	let draggedIndex: number | null = null;
	let dragOverIndex: number | null = null;
	let isPressing = false;
	let pressingIndex: number | null = null;

	// Subscribe to get initial values
	const unsubscribe = tabSettings.subscribe(tabs => {
		if (editingTabs.length === 0) {
			editingTabs = [...tabs];
		}
	});

	function getIcon(iconName: string) {
		switch (iconName) {
			case 'List': return List;
			case 'CalendarDays': return CalendarDays;
			case 'Columns3': return Columns3;
			case 'Table': return Table;
			default: return List;
		}
	}

	function moveUp(index: number) {
		if (index <= 0) return;
		const newTabs = [...editingTabs];
		[newTabs[index - 1], newTabs[index]] = [newTabs[index], newTabs[index - 1]];
		editingTabs = newTabs;
		hasChanges = true;
	}

	function moveDown(index: number) {
		if (index >= editingTabs.length - 1) return;
		const newTabs = [...editingTabs];
		[newTabs[index], newTabs[index + 1]] = [newTabs[index + 1], newTabs[index]];
		editingTabs = newTabs;
		hasChanges = true;
	}

	// Drag and drop handlers
	function handleDragStart(index: number) {
		draggedIndex = index;
		isPressing = false;
		pressingIndex = null;
	}

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		if (draggedIndex === null || draggedIndex === index) return;
		
		// Real-time reordering while dragging
		if (dragOverIndex !== index) {
			dragOverIndex = index;
			
			// Animate swap
			const newTabs = [...editingTabs];
			const [removed] = newTabs.splice(draggedIndex, 1);
			newTabs.splice(index, 0, removed);
			
			editingTabs = newTabs;
			draggedIndex = index;
			hasChanges = true;
		}
	}

	function handleDragLeave() {
		dragOverIndex = null;
	}

	function handleDrop(e: DragEvent, dropIndex: number) {
		e.preventDefault();
		draggedIndex = null;
		dragOverIndex = null;
	}

	function handleDragEnd() {
		draggedIndex = null;
		dragOverIndex = null;
		isPressing = false;
		pressingIndex = null;
	}

	// Touch/Mouse press handlers for animation
	function handlePressStart(index: number) {
		isPressing = true;
		pressingIndex = index;
	}

	function handlePressEnd() {
		setTimeout(() => {
			isPressing = false;
			pressingIndex = null;
		}, 150);
	}

	function handleReset() {
		editingTabs = [
			{ id: 'list', label: 'รายการ', icon: 'List' },
			{ id: 'calendar', label: 'ปฏิทิน', icon: 'CalendarDays' },
			{ id: 'kanban', label: 'Kanban', icon: 'Columns3' },
			{ id: 'table', label: 'ตาราง', icon: 'Table' }
		];
		hasChanges = true;
	}

	function handleSave() {
		tabSettings.set(editingTabs);
		hasChanges = false;
		dispatch('save');
	}

	function handleCancel() {
		// Restore from store
		const current = $tabSettings;
		editingTabs = [...current];
		hasChanges = false;
		dispatch('close');
	}
</script>

<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 w-full max-w-sm">
	<div class="flex items-center justify-between mb-4">
		<h3 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
			<Settings2 size={18} />
			จัดการแท็บ
		</h3>
		<button
			on:click={handleCancel}
			class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
		>
			<X size={18} />
		</button>
	</div>

	<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
		ลาก <GripVertical size={14} class="inline" /> เพื่อจัดเรียงลำดับแท็บ
	</p>

	<div class="space-y-2 mb-4">
		{#each editingTabs as tab, index (tab.id)}
			<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
			<div
				animate:flip={{ duration: 250, easing: quintOut }}
				draggable={true}
				on:dragstart={() => handleDragStart(index)}
				on:dragover={(e) => handleDragOver(e, index)}
				on:dragleave={handleDragLeave}
				on:drop={(e) => handleDrop(e, index)}
				on:dragend={handleDragEnd}
				on:mousedown={() => handlePressStart(index)}
				on:mouseup={handlePressEnd}
				on:mouseleave={handlePressEnd}
				on:touchstart={() => handlePressStart(index)}
				on:touchend={handlePressEnd}
				role="listitem"
				class="tab-item flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 cursor-move select-none {draggedIndex === index ? 'dragging' : 'border-gray-200 dark:border-gray-600'} {isPressing && pressingIndex === index ? 'pressing' : ''}"
			>
				<div class="drag-handle text-gray-400 hover:text-primary transition-colors">
					<GripVertical size={18} />
				</div>
				
				<svelte:component this={getIcon(tab.icon)} size={18} class="text-gray-600 dark:text-gray-300" />
				
				<span class="flex-1 font-medium text-gray-700 dark:text-gray-200">
					{tab.label}
				</span>
				
				<div class="flex items-center gap-1">
					<button
						on:click={() => moveUp(index)}
						disabled={index === 0}
						class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-110 active:scale-95"
						title="ขึ้น"
					>
						<ChevronUp size={16} />
					</button>
					<button
						on:click={() => moveDown(index)}
						disabled={index === editingTabs.length - 1}
						class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-110 active:scale-95"
						title="ลง"
					>
						<ChevronDown size={16} />
					</button>
				</div>
			</div>
		{/each}
	</div>

	<div class="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
		<button
			on:click={handleReset}
			class="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
		>
			<RotateCcw size={16} />
			รีเซ็ต
		</button>
		
		<div class="flex-1"></div>
		
		<button
			on:click={handleCancel}
			class="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all hover:scale-105 active:scale-95"
		>
			ยกเลิก
		</button>
		
		<button
			on:click={handleSave}
			disabled={!hasChanges}
			class="px-3 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
		>
			<Check size={16} />
			บันทึก
		</button>
	</div>
</div>

<style>
	.tab-item {
		transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
	}
	
	.tab-item:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}
	
	.tab-item.pressing {
		transform: scale(0.97);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}
	
	.tab-item.dragging {
		opacity: 0.7;
		border-color: #6366F1;
		border-style: dashed;
		box-shadow: 0 8px 24px rgba(99, 102, 241, 0.25);
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%);
		z-index: 10;
	}
	
	.drag-handle {
		transition: transform 0.2s ease, color 0.2s ease;
	}
	
	.tab-item:hover .drag-handle {
		transform: scale(1.2);
		color: #6366F1;
	}
	
	.tab-item.dragging .drag-handle {
		transform: scale(1.3);
		color: #6366F1;
	}
	
</style>
