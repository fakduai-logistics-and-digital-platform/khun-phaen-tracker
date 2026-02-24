<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import type { Task, Project, Assignee, Sprint, ChecklistItem } from '$lib/types';
	import { CATEGORIES } from '$lib/types';
	import { Calendar, FileText, Tag, CheckCircle, Folder, X, GitBranch, GitPullRequest, ExternalLink } from 'lucide-svelte';
	import { taskDefaults } from '$lib/stores/taskDefaults';
	import { _ } from 'svelte-i18n';
	import SearchableSelect from './SearchableSelect.svelte';
	import CustomDatePicker from './CustomDatePicker.svelte';
	import MarkdownEditor from './MarkdownEditor.svelte';
	import BranchDialog from './BranchDialog.svelte';
	import ChecklistManager from './ChecklistManager.svelte';
	import AssigneeSelector from './AssigneeSelector.svelte';

	const dispatch = createEventDispatcher<{
		submit: Omit<Task, 'id' | 'created_at'>;
		cancel: void;
		close: void;
		addAssignee: { name: string; color: string };
		checklistUpdate: { checklist: ChecklistItem[] };
	}>();

	export let show = false;
	export let editingTask: Task | null = null;
	export let assignees: Assignee[] = [];
	export let projects: Project[] = [];
	export let sprints: Sprint[] = [];

	let title = editingTask?.title || '';
	let project = editingTask?.project || '';
	let date = editingTask?.date || new Date().toISOString().split('T')[0];
	let end_date = editingTask?.end_date || '';
	let status: Task['status'] = editingTask?.status || 'todo';
	let category = editingTask?.category || 'งานหลัก';
	let notes = editingTask?.notes || '';
	let assignee_ids: number[] = editingTask?.assignee_ids || (editingTask?.assignee_id ? [editingTask.assignee_id] : []);
	let assignee_id_to_add: number | null = null;
	let sprint_id: number | null = editingTask?.sprint_id || null;
	let checklist: ChecklistItem[] = [];
	let showBranchDialog = false;
	let formInitKey = 'closed';

	$: activeSprint = sprints.find(s => s.status === 'active');

	// Get the current project's repo_url
	$: currentProjectRepoUrl = (() => {
		if (!project) return '';
		const matched = projects.find(p => p.name === project);
		return matched?.repo_url || '';
	})();

	/**
	 * Build a "new pull request / merge request" URL for the current branch.
	 * Supports GitHub, GitLab, and Bitbucket.
	 */
	function getPullRequestUrl(): string {
		if (!currentProjectRepoUrl) return '';

		// Normalise: strip trailing slash and .git
		let base = currentProjectRepoUrl.replace(/\/+$/, '').replace(/\.git$/, '');

		// For PR, we'll use the branch name from the dialog (if available)
		// For now, just open the compare/new PR page
		if (base.includes('github.com')) {
			return `${base}/compare?expand=1`;
		}

		if (base.includes('gitlab.com') || base.includes('gitlab')) {
			return `${base}/-/merge_requests/new`;
		}

		if (base.includes('bitbucket.org') || base.includes('bitbucket')) {
			return `${base}/pull-requests/new`;
		}

		return base;
	}

	function openPullRequest() {
		const url = getPullRequestUrl();
		if (url) window.open(url, '_blank', 'noopener,noreferrer');
	}

	function initializeFormState() {
		if (editingTask) {
			// Edit mode - use task values
			title = editingTask.title || '';
			project = editingTask.project || '';
			date = editingTask.date || new Date().toISOString().split('T')[0];
			end_date = editingTask.end_date || '';
			status = editingTask.status || 'todo';
			category = editingTask.category || 'งานหลัก';
			notes = editingTask.notes || '';
			assignee_ids = editingTask.assignee_ids || (editingTask.assignee_id ? [editingTask.assignee_id] : []);
			sprint_id = editingTask.sprint_id || null;
			checklist = editingTask.checklist ? [...editingTask.checklist] : [];
		} else {
			// Add mode - use default values from store
			title = '';
			project = $taskDefaults.project || '';
			date = new Date().toISOString().split('T')[0];
			end_date = '';
			status = 'todo';
			category = $taskDefaults.category || 'งานหลัก';
			notes = '';
			assignee_ids = $taskDefaults.assignee_id ? [$taskDefaults.assignee_id] : [];
			sprint_id = activeSprint?.id || null;
			checklist = [];
		}

		assignee_id_to_add = null;
		showBranchDialog = false;
	}

	// Reset form only when opening dialog or switching edit context
	$: {
		const nextFormInitKey = show ? `${editingTask?.id ?? 'new'}:${editingTask?.created_at ?? ''}` : 'closed';
		if (show && nextFormInitKey !== formInitKey) {
			initializeFormState();
		}
		formInitKey = nextFormInitKey;
	}

	function handleSubmit() {
		if (!title.trim()) return;

		// Auto-add selected assignee if not already added
		if (assignee_id_to_add !== null && !assignee_ids.includes(assignee_id_to_add)) {
			assignee_ids = [...assignee_ids, assignee_id_to_add];
		}

		// Save defaults for next time (only if adding new task)
		if (!editingTask) {
			taskDefaults.set({
				project: project.trim(),
				assignee_id: assignee_ids.length > 0 ? assignee_ids[0] : null,
				category
			});
		}

		dispatch('submit', {
			title: title.trim(),
			project: project.trim(),
			duration_minutes: 0,
			date,
			end_date: end_date || undefined,
			status,
			category,
			notes: notes.trim(),
			assignee_ids: assignee_ids.length > 0 ? assignee_ids : undefined,
			assignee_id: assignee_ids.length > 0 ? assignee_ids[0] : null, // Legacy field
			sprint_id,
			checklist: checklist.length > 0 ? checklist : undefined
		});
	}

	function handleClose() {
		dispatch('close');
	}

	function handleCancel() {
		dispatch('cancel');
	}

	function handleAddAssignee(event: CustomEvent<{ name: string; color: string }>) {
		dispatch('addAssignee', event.detail);
	}

	function handleChecklistUpdate(event: CustomEvent<{ checklist: ChecklistItem[] }>) {
		checklist = event.detail.checklist;
		if (editingTask) {
			dispatch('checklistUpdate', { checklist });
		}
	}

	function openBranchDialog() {
		showBranchDialog = true;
	}

	function closeBranchDialog() {
		showBranchDialog = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (showBranchDialog) {
				closeBranchDialog();
				return;
			}
			handleClose();
		}
	}

	onMount(() => {
		document.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		if (browser) {
			document.removeEventListener('keydown', handleKeydown);
		}
	});
</script>

{#if show}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="fixed inset-0 bg-black/20 backdrop-blur-sm z-[999] pointer-events-none !m-0"></div>
	<div
		class="fixed inset-0 z-[999] overflow-y-auto !m-0"
		on:click|self={handleClose}
	>
		<div class="flex min-h-full items-center justify-center p-4">
			<div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full animate-modal-in relative max-h-[90vh] flex flex-col">
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
					<CheckCircle size={20} class="text-primary" />
					{editingTask ? $_('taskForm__edit_task_title') : $_('taskForm__add_task_title')}
				</h2>
				<div class="flex items-center gap-2">
					{#if currentProjectRepoUrl}
						<button
							type="button"
							on:click={openPullRequest}
							class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-600 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
							title="Open Pull Request"
						>
							<GitPullRequest size={14} />
							<span>Pull Request</span>
							<ExternalLink size={12} class="opacity-60" />
						</button>
					{/if}
					<button
						type="button"
						on:click={openBranchDialog}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
						title="Branch"
					>
						<GitBranch size={14} />
						<span>Branch</span>
					</button>

					<button
						type="button"
						on:click={handleClose}
						class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
					>
						<X size={20} />
					</button>
				</div>
			</div>

			<!-- Form Content -->
			<form on:submit|preventDefault={handleSubmit} class="flex flex-col flex-1 min-h-0">
				<div class="p-6 space-y-4 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
				<div>
					<label for="title" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						{$_('taskForm__task_title_label')} <span class="text-danger">*</span>
					</label>
					<input
						id="title"
						type="text"
						bind:value={title}
						placeholder={$_('taskForm__task_title_placeholder')}
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-gray-700 dark:text-white"
						required
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="project" class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
							<Folder size={14} />
							{$_('taskForm__project_label')}
						</label>
						<SearchableSelect
							id="project"
							bind:value={project}
							options={[
								{ value: '', label: '-- ' + $_('taskForm__unassigned') + ' --' },
								...projects.map(proj => ({ value: proj.name, label: proj.name }))
							]}
							placeholder={$_('taskForm__project_placeholder')}
						/>
					</div>

					<div>
						<label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
							<Tag size={14} />
							{$_('taskForm__category_label')}
						</label>
						<SearchableSelect
							bind:value={category}
							options={CATEGORIES.map(cat => ({ value: cat, label: cat }))}
							placeholder={$_('taskForm__category_placeholder')}
							showSearch={false}
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
							<Calendar size={14} />
							{$_('taskForm__date_label')}
						</label>
						<CustomDatePicker
							bind:value={date}
							placeholder={$_('taskForm__date_placeholder')}
							on:select={(e) => date = e.detail}
						/>
					</div>

					<div>
						<label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
							<Calendar size={14} />
							วันสิ้นสุด (Optional)
						</label>
						<CustomDatePicker
							bind:value={end_date}
							placeholder="เลือกวันสิ้นสุด..."
							on:select={(e) => end_date = e.detail}
						/>
					</div>
				</div>

				<!-- Assignee Section -->
				<AssigneeSelector
					{assignees}
					bind:assignee_ids
					bind:assignee_id_to_add
					on:addAssignee={handleAddAssignee}
				/>

				<!-- Checklist Section -->
				<ChecklistManager
					bind:checklist
					autoDispatch={!!editingTask}
					on:update={handleChecklistUpdate}
				/>

				<!-- Notes -->
				<div>
					<label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
						<FileText size={14} />
						{$_('taskForm__notes_label')}
					</label>
					<MarkdownEditor
						bind:value={notes}
						placeholder={$_('taskForm__notes_placeholder')}
						rows={4}
					/>
				</div>

				</div>

				<!-- Buttons -->
				<div class="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
					<button
						type="button"
						on:click={handleClose}
						class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
					>
						{$_('taskForm__btn_cancel')}
					</button>
					<button
						type="submit"
						class="flex-1 bg-primary hover:bg-primary-dark text-white py-2 px-4 rounded-lg font-medium transition-colors"
					>
						{editingTask ? $_('taskForm__btn_save') : $_('taskForm__btn_add')}
					</button>
				</div>
			</form>
			</div>
		</div>
	</div>

	<!-- Branch Dialog -->
	<BranchDialog
		bind:show={showBranchDialog}
		{title}
		on:close={closeBranchDialog}
	/>
{/if}

<style>
	@keyframes modal-in {
		from {
			opacity: 0;
			transform: scale(0.95) translateY(-10px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.animate-modal-in {
		animation: modal-in 0.2s ease-out;
	}

	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}

	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}

	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: #d1d5db;
		border-radius: 10px;
	}

	.dark .custom-scrollbar::-webkit-scrollbar-thumb {
		background: #4b5563;
	}

	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: #9ca3af;
	}
</style>
