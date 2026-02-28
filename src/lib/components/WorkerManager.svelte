<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { Assignee } from '$lib/types';
	import { Users, Plus, X, Edit2, Trash2, User, Briefcase, Check, Link, Link2Off, RefreshCw, Mail } from 'lucide-svelte';
	import { _ } from 'svelte-i18n';
	import { api } from '$lib/apis';
	import SearchableSelect from './SearchableSelect.svelte';
	
	const dispatch = createEventDispatcher<{
		close: void;
		add: { name: string; color: string; discord_id?: string; user_id?: string };
		update: { id: string | number; name: string; color: string; discord_id?: string; user_id?: string };
		delete: string | number;
	}>();
	
	export let assignees: Assignee[] = [];
	export let workerStats: { id: string | number; taskCount: number }[] = [];
	
	let showAddForm = false;
	let editingWorker: Assignee | null = null;
	let newWorkerName = '';
	let newWorkerDiscordId = '';
	let newWorkerColor = '#6366F1';
	let newWorkerUserId = ''; // For linking with system user
	let deleteConfirmId: string | number | null = null;

	let systemUsers: any[] = [];
	let loadingUsers = false;
	
	const colorOptions = [
		'#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E',
		'#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6',
		'#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
		'#F43F5E', '#78716C', '#6B7280', '#4B5563', '#1F2937'
	];

	onMount(async () => {
		await fetchSystemUsers();
	});

	async function fetchSystemUsers() {
		loadingUsers = true;
		try {
			const res = await api.auth.listUsers();
			if (res.ok) {
				const data = await res.json();
				systemUsers = data.users || [];
			}
		} catch (e) {
			console.error('Failed to fetch system users:', e);
		} finally {
			loadingUsers = false;
		}
	}
	
	function startAdd() {
		showAddForm = true;
		editingWorker = null;
		newWorkerName = '';
		newWorkerDiscordId = '';
		newWorkerColor = '#6366F1';
		newWorkerUserId = '';
	}
	
	function startEdit(worker: Assignee) {
		editingWorker = worker;
		showAddForm = true;
		newWorkerName = worker.name;
		newWorkerDiscordId = worker.discord_id || '';
		newWorkerColor = worker.color || '#6366F1';
		newWorkerUserId = worker.user_id || '';
	}
	
	function cancelEdit() {
		showAddForm = false;
		editingWorker = null;
		newWorkerName = '';
		newWorkerDiscordId = '';
		newWorkerColor = '#6366F1';
		newWorkerUserId = '';
	}

	function handleUserLinkChange(userId: string) {
		if (userId) {
			const user = systemUsers.find(u => u.id === userId);
			if (user) {
				// Auto-fill from user profile if name is empty or we are starting fresh
				if (!newWorkerName || (editingWorker && newWorkerName === editingWorker.name)) {
					newWorkerName = user.nickname || user.first_name || user.email.split('@')[0];
				}
				if (user.profile?.discord_id && (!newWorkerDiscordId || (editingWorker && newWorkerDiscordId === editingWorker.discord_id))) {
					newWorkerDiscordId = user.profile.discord_id;
				}
			}
		}
	}

	let previousUserId = newWorkerUserId;
	$: if (newWorkerUserId !== previousUserId) {
		previousUserId = newWorkerUserId;
		handleUserLinkChange(newWorkerUserId);
	}
	
	function handleSave() {
		if (!newWorkerName.trim()) return;
		
		if (editingWorker) {
			dispatch('update', {
				id: editingWorker.id!,
				name: newWorkerName.trim(),
				color: newWorkerColor,
				discord_id: newWorkerDiscordId.trim() || undefined,
				user_id: newWorkerUserId || undefined
			});
		} else {
			dispatch('add', {
				name: newWorkerName.trim(),
				color: newWorkerColor,
				discord_id: newWorkerDiscordId.trim() || undefined,
				user_id: newWorkerUserId || undefined
			});
		}
		
		cancelEdit();
	}
	
	function confirmDelete(id: string | number) {
		deleteConfirmId = id;
	}
	
	function handleDelete(id: string | number) {
		dispatch('delete', id);
		deleteConfirmId = null;
	}
	
	function getTaskCount(workerId: string | number): number {
		const stat = workerStats.find(s => String(s.id) === String(workerId));
		return stat?.taskCount || 0;
	}

	function getLinkedUser(userId?: string) {
		if (!userId) return null;
		return systemUsers.find(u => u.id === userId);
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
					<!-- Link with System User -->
					<div>
						<label for="link-user-select" class="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
							{$_('workerManager__link_user_label')}
						</label>
						<div class="relative z-10 block">
							<SearchableSelect
								id="link-user-select"
								bind:value={newWorkerUserId}
								options={[
									{ value: '', label: '-- ' + $_('workerManager__link_user_placeholder') + ' --' },
									...systemUsers.map(user => ({
										value: user.id,
										label: `${user.nickname || user.first_name || user.email.split('@')[0]} (${user.email})`,
										badge: user.is_active !== undefined,
										badgeColor: user.is_active ? '#22C55E' : '#FBBF24'
									}))
								]}
								placeholder={$_('workerManager__link_user_placeholder')}
							/>
						</div>
						{#if newWorkerUserId}
							<p class="text-[10px] text-green-500 mt-1.5 flex items-center gap-1 font-medium">
								<Check size={10} /> {$_('workerManager__auto_fill_hint')}
							</p>
						{/if}
					</div>

					<div class="grid grid-cols-2 gap-4">
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
							<label for="worker-discord-input" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
								Discord ID
							</label>
							<input
								id="worker-discord-input"
								type="text"
								bind:value={newWorkerDiscordId}
								placeholder="1234..."
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
							/>
						</div>
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
					</div>

					<div class="flex gap-2 pt-2">
						<button
							on:click={handleSave}
							disabled={!newWorkerName.trim()}
							class="flex-1 bg-primary hover:bg-primary-dark disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white py-2 px-4 rounded-lg font-bold transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
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
							class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
						>
							{$_('workerManager__btn_cancel')}
						</button>
					</div>
				</div>
			{:else}
				<!-- Add Button -->
				<button
					on:click={startAdd}
					class="w-full mb-6 py-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl text-gray-500 dark:text-gray-400 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-1 group active:scale-[0.98]"
				>
					<div class="p-1 bg-gray-100 dark:bg-gray-800 rounded-md group-hover:bg-primary/10 transition-colors">
						<Plus size={20} />
					</div>
					<span class="text-sm font-bold uppercase tracking-wider">{$_('workerManager__add_new')}</span>
				</button>
			{/if}

			<!-- Worker List -->
			<div class="space-y-3">
				<div class="flex items-center justify-between mb-2">
					<h3 class="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">{$_('workerManager__list_title')}</h3>
					<button on:click={fetchSystemUsers} class="text-gray-400 hover:text-primary transition-colors" title="Reload System Users">
						<RefreshCw size={12} class={loadingUsers ? 'animate-spin' : ''} />
					</button>
				</div>

				{#if assignees.length === 0}
					<div class="text-center py-12 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800">
						<div class="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
							<User size={32} />
						</div>
						<p class="font-bold text-gray-500 dark:text-gray-400">{$_('workerManager__no_workers')}</p>
						<p class="text-xs text-gray-400 dark:text-gray-500">{$_('workerManager__add_hint')}</p>
					</div>
				{:else}
					{#each assignees as worker (worker.id)}
						{@const linkedUser = getLinkedUser(worker.user_id)}
						<div class="flex items-center gap-3 p-3 bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 rounded-2xl group hover:border-primary/30 hover:bg-gray-50 dark:hover:bg-white/5 transition-all shadow-sm">
							<!-- Color Avatar -->
							<div
								class="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg shrink-0 shadow-sm"
								style="background-color: {worker.color || '#6366F1'}"
							>
								{worker.name.charAt(0)}
							</div>

							<!-- Info -->
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2">
									<h4 class="font-bold text-gray-900 dark:text-white truncate">{worker.name}</h4>
									{#if linkedUser}
										<div class="px-1.5 py-0.5 bg-green-500/10 text-green-500 rounded text-[9px] font-black uppercase tracking-tighter flex items-center gap-0.5" title={`${$_('workerManager__linked_status')}: ${linkedUser.email}`}>
											<Link size={8} /> {$_('workerManager__linked_status')}
										</div>
									{/if}
								</div>
								<div class="flex items-center gap-3 mt-0.5">
									<div class="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 font-medium">
										<Briefcase size={10} />
										<span>{getTaskCount(worker.id!)} {$_('workerManager__task_count_suffix')}</span>
									</div>
									{#if worker.discord_id}
										<div class="flex items-center gap-1 text-[11px] text-indigo-500/70 font-medium">
											<Mail size={10} />
											<span>{worker.discord_id}</span>
										</div>
									{/if}
								</div>
							</div>

							<!-- Actions -->
							<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
								<button
									on:click={() => startEdit(worker)}
									class="p-2 text-gray-400 dark:text-gray-500 hover:text-primary hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-600 shadow-sm"
									title={$_('workerManager__btn_edit')}
								>
									<Edit2 size={14} />
								</button>
								<button
									on:click={() => confirmDelete(worker.id!)}
									class="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-600 shadow-sm"
									title={$_('workerManager__btn_delete')}
								>
									<Trash2 size={14} />
								</button>
							</div>
						</div>

						<!-- Delete Confirmation -->
						{#if deleteConfirmId === worker.id}
							<div class="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl p-4 mt-2 mb-4 animate-in fade-in slide-in-from-top-2">
								<p class="text-sm text-red-600 dark:text-red-400 mb-3 font-medium">
									{$_('workerManager__delete_confirm', { values: { name: worker.name } })}
									{#if getTaskCount(worker.id!) > 0}
										<span class="block text-xs mt-1 opacity-80">{$_('workerManager__delete_warning')}</span>
									{/if}
								</p>
								<div class="flex gap-2">
									<button
										on:click={() => handleDelete(worker.id!)}
										class="px-4 py-1.5 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 transition-all shadow-sm active:scale-95"
									>
										{$_('workerManager__confirm_delete')}
									</button>
									<button
										on:click={() => deleteConfirmId = null}
										class="px-4 py-1.5 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors shadow-sm"
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
			<p class="text-[10px] text-gray-400 dark:text-gray-500 text-center font-bold uppercase tracking-widest">
				{$_('workerManager__footer_hint')}
			</p>
		</div>
	</div>
</div>

<style>
	/* Standard CSS for select options as @apply is failing in scoped styles with Tailwind v4 */
	select option {
		background-color: white;
		color: black;
	}
	:global(.dark) select option {
		background-color: #1f2937;
		color: white;
	}
</style>
