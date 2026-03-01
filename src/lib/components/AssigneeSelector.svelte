<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Assignee } from '$lib/types';
	import { User, Plus, X } from 'lucide-svelte';
	import { _ } from 'svelte-i18n';
	import SearchableSelect from './SearchableSelect.svelte';

	const dispatch = createEventDispatcher<{
		addAssignee: { name: string; color: string };
	}>();

	export let assignees: Assignee[] = [];
	export let assignee_ids: number[] = [];
	export let assignee_id_to_add: number | null = null;
	export let readonly = false;
	let showAddAssigneeForm = false;
	let newAssigneeName = '';
	let newAssigneeColor = '#6366F1';

	const colorOptions = [
		'#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E',
		'#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6',
		'#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
		'#F43F5E', '#78716C', '#6B7280', '#4B5563', '#1F2937'
	];

	$: selectedAssignees = assignee_ids.map(id => assignees.find(a => a.id === id)).filter(Boolean) as Assignee[];
	$: availableAssignees = assignees.filter(a => a.id && !assignee_ids.includes(a.id));

	function addAssigneeToTask() {
		if (assignee_id_to_add !== null && !assignee_ids.includes(assignee_id_to_add)) {
			assignee_ids = [...assignee_ids, assignee_id_to_add];
			assignee_id_to_add = null;
		}
	}

	function removeAssigneeFromTask(id: number) {
		assignee_ids = assignee_ids.filter(assigneeId => assigneeId !== id);
	}

	function handleAddAssignee() {
		if (!newAssigneeName.trim()) return;

		dispatch('addAssignee', {
			name: newAssigneeName.trim(),
			color: newAssigneeColor
		});

		newAssigneeName = '';
		newAssigneeColor = '#6366F1';
		showAddAssigneeForm = false;
	}

	function cancelAddAssignee() {
		newAssigneeName = '';
		newAssigneeColor = '#6366F1';
		showAddAssigneeForm = false;
	}
</script>

<div>
	<label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
		<User size={14} />
		{$_('taskForm__assignee_label')}
	</label>

	{#if showAddAssigneeForm}
		<div class="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg space-y-3">
			<div>
				<label for="new-assignee-name" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{$_('taskForm__new_assignee_name')}</label>
				<input
					id="new-assignee-name"
					type="text"
					bind:value={newAssigneeName}
					placeholder={$_('taskForm__new_assignee_placeholder')}
					class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm dark:bg-gray-700 dark:text-white"
				/>
			</div>
			<div>
				<label for="new-assignee-color-picker" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{$_('taskForm__color_label')}</label>
				<div class="flex flex-wrap gap-1.5 mb-2">
					{#each colorOptions as color}
						<button
							type="button"
							on:click={() => newAssigneeColor = color}
							aria-label={$_('taskForm__select_color', { values: { color } })}
							class="w-6 h-6 rounded-full border-2 transition-all {newAssigneeColor === color ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'}"
							style="background-color: {color}"
						></button>
					{/each}
				</div>
				<input
					id="new-assignee-color-picker"
					type="color"
					bind:value={newAssigneeColor}
					class="w-10 h-8 rounded cursor-pointer border border-gray-300 dark:border-gray-600"
				/>
				<input
					type="text"
					bind:value={newAssigneeColor}
					placeholder="#6366F1"
					class="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-gray-700 dark:text-white"
					maxlength="7"
				/>
			</div>
		</div>
		<div class="flex gap-2 pt-1">
			<button
				type="button"
				on:click={handleAddAssignee}
				disabled={!newAssigneeName.trim()}
				class="flex-1 bg-primary hover:bg-primary-dark disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white py-1.5 px-3 rounded-lg text-sm font-medium transition-colors"
			>
				{$_('taskForm__btn_add')}
			</button>
			<button
				type="button"
				on:click={cancelAddAssignee}
				class="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
			>
				{$_('taskForm__btn_cancel')}
			</button>
		</div>
	{:else}
		<!-- Show selected assignees as badges -->
		{#if selectedAssignees.length > 0}
			<div class="flex flex-wrap gap-2 mb-2">
				{#each selectedAssignees as assignee (assignee.id)}
					<div class="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">
						<span class="w-2.5 h-2.5 rounded-full" style="background-color: {assignee.color}"></span>
						<span class="text-gray-700 dark:text-gray-300">{assignee.name}</span>
						{#if !readonly}
							<button
								type="button"
								on:click={() => removeAssigneeFromTask(assignee.id!)}
								class="text-gray-400 hover:text-red-500 transition-colors"
								title="Remove assignee"
							>
								<X size={14} />
							</button>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<!-- Add assignee dropdown -->
		{#if !readonly}
			<div class="flex gap-2">
				<div class="flex-1">
					<SearchableSelect
						bind:value={assignee_id_to_add}
						options={[
							{ value: null, label: $_('taskForm__assignee_placeholder') },
							...availableAssignees
							.filter((assignee): assignee is typeof assignee & { id: number } => assignee.id !== undefined)
							.map(assignee => ({
								value: assignee.id,
								label: assignee.name,
								badge: true,
								badgeColor: assignee.color
							}))
						]}
						placeholder={$_('taskForm__assignee_placeholder')}
					/>
				</div>
				<button
					type="button"
					on:click={addAssigneeToTask}
					disabled={assignee_id_to_add === null}
					class="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
					title="Add selected assignee"
				>
					<Plus size={16} />
				</button>
				<button
					type="button"
					on:click={() => showAddAssigneeForm = true}
					class="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
					title={$_('taskForm__add_assignee')}
				>
					<User size={16} />
					<Plus size={12} />
				</button>
			</div>
		{:else if selectedAssignees.length === 0}
			<p class="text-sm text-gray-500 dark:text-gray-400 italic">{$_('taskForm__unassigned')}</p>
		{/if}
	{/if}
</div>
