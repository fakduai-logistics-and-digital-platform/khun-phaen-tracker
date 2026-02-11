<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Project } from '$lib/types';
	import { Folder, Plus, X, Edit2, Trash2, Check, Briefcase } from 'lucide-svelte';
	
	const dispatch = createEventDispatcher<{
		close: void;
		add: { name: string };
		update: { id: number; name: string };
		delete: number;
	}>();
	
	export let projects: Project[] = [];
	export let projectStats: { id: number; taskCount: number }[] = [];
	
	let showAddForm = false;
	let editingProject: Project | null = null;
	let newProjectName = '';
	let deleteConfirmId: number | null = null;
	
	function startAdd() {
		showAddForm = true;
		editingProject = null;
		newProjectName = '';
	}
	
	function startEdit(project: Project) {
		editingProject = project;
		showAddForm = true;
		newProjectName = project.name;
	}
	
	function cancelEdit() {
		showAddForm = false;
		editingProject = null;
		newProjectName = '';
	}
	
	function handleSave() {
		if (!newProjectName.trim()) return;
		
		if (editingProject) {
			dispatch('update', {
				id: editingProject.id!,
				name: newProjectName.trim()
			});
		} else {
			dispatch('add', {
				name: newProjectName.trim()
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
	
	function getTaskCount(projectId: number): number {
		const stat = projectStats.find(s => s.id === projectId);
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
					<Folder size={20} class="text-primary" />
				</div>
				<div>
					<h2 class="text-xl font-bold text-gray-900 dark:text-white">จัดการโปรเจค</h2>
					<p class="text-sm text-gray-500 dark:text-gray-400">{projects.length} โปรเจค</p>
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
						<label for="project-name-input" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							{editingProject ? 'แก้ไขชื่อโปรเจค' : 'ชื่อโปรเจค'}
						</label>
						<input
							id="project-name-input"
							type="text"
							bind:value={newProjectName}
							placeholder="เช่น โปรเจค A, งานลูกค้า XYZ..."
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
						/>
					</div>

					<div class="flex gap-2 pt-2">
						<button
							on:click={handleSave}
							disabled={!newProjectName.trim()}
							class="flex-1 bg-primary hover:bg-primary-dark disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
						>
							{#if editingProject}
								<Check size={16} />
								บันทึก
							{:else}
								<Plus size={16} />
								เพิ่ม
							{/if}
						</button>
						<button
							on:click={cancelEdit}
							class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
						>
							ยกเลิก
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
					เพิ่มโปรเจคใหม่
				</button>
			{/if}

			<!-- Project List -->
			<div class="space-y-3">
				<h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">รายชื่อโปรเจค</h3>

				{#if projects.length === 0}
					<div class="text-center py-8 text-gray-400 dark:text-gray-500">
						<Folder size={48} class="mx-auto mb-3 opacity-50" />
						<p>ยังไม่มีโปรเจค</p>
						<p class="text-sm">คลิกปุ่มด้านบนเพื่อเพิ่ม</p>
					</div>
				{:else}
					{#each projects as project (project.id)}
						<div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl group hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
							<!-- Folder Icon -->
							<div class="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
								<Folder size={20} class="text-primary" />
							</div>

							<!-- Info -->
							<div class="flex-1 min-w-0">
								<h4 class="font-medium text-gray-900 dark:text-white truncate">{project.name}</h4>
								<div class="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
									<Briefcase size={12} />
									<span>{getTaskCount(project.id!)} งาน</span>
								</div>
							</div>

							<!-- Actions -->
							<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
								<button
									on:click={() => startEdit(project)}
									class="p-2 text-gray-400 dark:text-gray-500 hover:text-primary hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-colors"
									title="แก้ไข"
								>
									<Edit2 size={14} />
								</button>
								<button
									on:click={() => confirmDelete(project.id!)}
									class="p-2 text-gray-400 dark:text-gray-500 hover:text-danger hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-colors"
									title="ลบ"
								>
									<Trash2 size={14} />
								</button>
							</div>
						</div>

						<!-- Delete Confirmation -->
						{#if deleteConfirmId === project.id}
							<div class="bg-danger/10 border border-danger/20 rounded-xl p-3 mt-2">
								<p class="text-sm text-danger mb-2">
									ลบ "{project.name}"?
									{#if getTaskCount(project.id!) > 0}
										<br><span class="text-xs">งานในโปรเจคนี้จะกลายเป็น "ไม่ระบุ"</span>
									{/if}
								</p>
								<div class="flex gap-2">
									<button
										on:click={() => handleDelete(project.id!)}
										class="px-3 py-1.5 bg-danger text-white rounded-lg text-sm font-medium hover:bg-danger-dark transition-colors"
									>
										ยืนยันลบ
									</button>
									<button
										on:click={() => deleteConfirmId = null}
										class="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm transition-colors"
									>
										ยกเลิก
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
				โปรเจคจะถูกแสดงในฟอร์มเพิ่มงานเพื่อจัดหมวดหมู่งาน
			</p>
		</div>
	</div>
</div>
