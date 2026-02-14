<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Assignee } from '$lib/types';
	import { Users, Plus, X, Edit2, Trash2, User, Briefcase, Check } from 'lucide-svelte';
	import { _ } from 'svelte-i18n';
	
	const dispatch = createEventDispatcher<{
		close: void;
		add: { name: string; color: string };
		update: { id: number; name: string; color: string };
		delete: number;
	}>();
	
	export let assignees: Assignee[] = [];
	export let workerStats: { id: number; taskCount: number }[] = [];
	
	let showAddForm = false;
	let editingWorker: Assignee | null = null;
	let newWorkerName = '';
	let newWorkerColor = '#6366F1';
	let deleteConfirmId: number | null = null;
	
	const colorOptions = [
		'#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E',
		'#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6',
		'#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
		'#F43F5E', '#78716C', '#6B7280', '#4B5563', '#1F2937'
	];
	
	function startAdd() {
		showAddForm = true;
		editingWorker = null;
		newWorkerName = '';
		newWorkerColor = '#6366F1';
	}
	
	function startEdit(worker: Assignee) {
		editingWorker = worker;
		showAddForm = true;
		newWorkerName = worker.name;
		newWorkerColor = worker.color || '#6366F1';
	}
	
	function cancelEdit() {
		showAddForm = false;
		editingWorker = null;
		newWorkerName = '';
		newWorkerColor = '#6366F1';
	}
	
	function handleSave() {
		if (!newWorkerName.trim()) return;
		
		if (editingWorker) {
			dispatch('update', {
				id: editingWorker.id!,
				name: newWorkerName.trim(),
				color: newWorkerColor
			});
		} else {
			dispatch('add', {
				name: newWorkerName.trim(),
				color: newWorkerColor
			});
		}
		
		cancelEdit();
	}
	
	function confirmDelete(id: number) {
		deleteConfirmId = id;
	}
	
	function handleDelete(id: number) {
		dispatch('delete', id);
		deleteConfirmId = null;
	}
	
	function getTaskCount(workerId: number): number {
		const stat = workerStats.find(s => s.id === workerId);
		return stat?.taskCount || 0;
	}
	
	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			dispatch('close');
		}
	}
</script>

<!-- Modal Backdrop -->
<div
	class="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4"
	on:click={handleBackdropClick}
	on:keydown={(e) => e.key === 'Escape' && dispatch('close')}
	role="button"
	tabindex="-1"
>
	<!-- Modal Content -->
	<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col transition-colors">
		<!-- Header -->
		<div class="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
					<Users size={20} class="text-primary" />
				</div>
				<div>
					<h2 class="text-xl font-bold text-gray-900 dark:text-white">{$_('workerManager__title')}</h2>
					<p class="text-sm text-gray-500 dark:text-gray-400">{assignees.length} {$_('workerManager__count_suffix')}</p>
				</div>
			</div>
			<button
				on:click={() => dispatch('close')}
				class="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
			>
				<X size={20} />
			</button>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-6">
			<!-- Add/Edit Form -->
			{#if showAddForm}
				<div class="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-6 space-y-4">
					<div>
						<label for="worker-name-input" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							{editingWorker ? $_('workerManager__edit_name') : $_('workerManager__name_label')}
						</label>
						<input
							id="worker-name-input"
							type="text"
							bind:value={newWorkerName}
							placeholder={$_('workerManager__name_placeholder')}
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
						/>
					</div>

					<div>
						<label for="worker-color-picker" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{$_('workerManager__color_label')}</label>
						<div class="flex flex-wrap gap-2 mb-3">
							{#each colorOptions as color}
								<button
									type="button"
									on:click={() => newWorkerColor = color}
									aria-label={`${$_('workerManager__select_color')} ${color}`}
									class="w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center"
									class:border-gray-800={newWorkerColor === color}
									class:border-white={newWorkerColor === color}
									class:border-transparent={newWorkerColor !== color}
									class:scale-110={newWorkerColor === color}
									style="background-color: {color}"
								>
									{#if newWorkerColor === color}
										<Check size={14} class="text-white drop-shadow" />
									{/if}
								</button>
							{/each}
						</div>
						<div class="flex items-center gap-2">
							<input
								id="worker-color-picker"
								type="color"
								bind:value={newWorkerColor}
								class="w-10 h-8 rounded cursor-pointer border border-gray-300 dark:border-gray-600"
							/>
							<input
								type="text"
								bind:value={newWorkerColor}
								placeholder="#6366F1"
								class="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-gray-700 dark:text-white"
								maxlength="7"
							/>
							<div 
								class="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600"
								style="background-color: {newWorkerColor}"
							></div>
						</div>
					</div>

					<div class="flex gap-2 pt-2">
						<button
							on:click={handleSave}
							disabled={!newWorkerName.trim()}
							class="flex-1 bg-primary hover:bg-primary-dark disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
						>
							{#if editingWorker}
								<Check size={16} />
								{$_('workerManager__btn_save')}
							{:else}
								<Plus size={16} />
								{$_('workerManager__btn_add')}
							{/if}
						</button>
						<button
							on:click={cancelEdit}
							class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
						>
							{$_('workerManager__btn_cancel')}
						</button>
					</div>
				</div>
			{:else}
				<!-- Add Button -->
				<button
					on:click={startAdd}
					class="w-full mb-6 py-3 px-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
				>
					<Plus size={18} />
					{$_('workerManager__add_new')}
				</button>
			{/if}

			<!-- Worker List -->
			<div class="space-y-3">
				<h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{$_('workerManager__list_title')}</h3>

				{#if assignees.length === 0}
					<div class="text-center py-8 text-gray-400 dark:text-gray-500">
						<User size={48} class="mx-auto mb-3 opacity-50" />
						<p>{$_('workerManager__no_workers')}</p>
						<p class="text-sm">{$_('workerManager__add_hint')}</p>
					</div>
				{:else}
					{#each assignees as worker (worker.id)}
						<div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl group hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
							<!-- Color Avatar -->
							<div
								class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
								style="background-color: {worker.color || '#6366F1'}"
							>
								{worker.name.charAt(0)}
							</div>

							<!-- Info -->
							<div class="flex-1 min-w-0">
								<h4 class="font-medium text-gray-900 dark:text-white truncate">{worker.name}</h4>
								<div class="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
									<Briefcase size={12} />
									<span>{getTaskCount(worker.id!)} {$_('workerManager__task_count_suffix')}</span>
								</div>
							</div>

							<!-- Actions -->
							<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
								<button
									on:click={() => startEdit(worker)}
									class="p-2 text-gray-400 dark:text-gray-500 hover:text-primary hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-colors"
									title={$_('workerManager__btn_edit')}
								>
									<Edit2 size={14} />
								</button>
								<button
									on:click={() => confirmDelete(worker.id!)}
									class="p-2 text-gray-400 dark:text-gray-500 hover:text-danger hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-colors"
									title={$_('workerManager__btn_delete')}
								>
									<Trash2 size={14} />
								</button>
							</div>
						</div>

						<!-- Delete Confirmation -->
						{#if deleteConfirmId === worker.id}
							<div class="bg-danger/10 border border-danger/20 rounded-xl p-3 mt-2">
								<p class="text-sm text-danger mb-2">
									{$_('workerManager__delete_confirm', { values: { name: worker.name } })}
									{#if getTaskCount(worker.id!) > 0}
										<br><span class="text-xs">{$_('workerManager__delete_warning')}</span>
									{/if}
								</p>
								<div class="flex gap-2">
									<button
										on:click={() => handleDelete(worker.id!)}
										class="px-3 py-1.5 bg-danger text-white rounded-lg text-sm font-medium hover:bg-danger-dark transition-colors"
									>
										{$_('workerManager__confirm_delete')}
									</button>
									<button
										on:click={() => deleteConfirmId = null}
										class="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm transition-colors"
									>
										{$_('workerManager__btn_cancel')}
									</button>
								</div>
							</div>
						{/if}
					{/each}
				{/if}
			</div>
		</div>

		<!-- Footer -->
		<div class="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-2xl">
			<p class="text-xs text-gray-500 dark:text-gray-400 text-center">
				{$_('workerManager__footer_hint')}
			</p>
		</div>
	</div>
</div>
