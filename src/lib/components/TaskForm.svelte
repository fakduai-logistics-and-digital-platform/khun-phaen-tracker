<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Task, Project, Assignee } from '$lib/types';
	import { CATEGORIES } from '$lib/types';
	import { Calendar, FileText, Tag, CheckCircle, User, Plus, Folder } from 'lucide-svelte';
	
	const dispatch = createEventDispatcher();
	
	export let editingTask: Task | null = null;
	export let assignees: Assignee[] = [];
	export let projects: Project[] = [];
	
	let title = editingTask?.title || '';
	let project = editingTask?.project || '';
	let date = editingTask?.date || new Date().toISOString().split('T')[0];
	let status = editingTask?.status || 'todo';
	let category = editingTask?.category || 'งานหลัก';
	let notes = editingTask?.notes || '';
	let assignee_id = editingTask?.assignee_id || null;
	
	// New assignee form state
	let showAddAssigneeForm = false;
	let newAssigneeName = '';
	let newAssigneeColor = '#6366F1';
	
	const colorOptions = [
		'#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E',
		'#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6',
		'#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
		'#F43F5E', '#78716C', '#6B7280', '#4B5563', '#1F2937'
	];
	
	function handleSubmit() {
		if (!title.trim()) return;
		
		dispatch('submit', {
			title: title.trim(),
			project: project.trim(),
			duration_minutes: 0,
			date,
			status: status as Task['status'],
			category,
			notes: notes.trim(),
			assignee_id
		});
		
		if (!editingTask) {
			// Reset form for new task
			title = '';
			project = '';
			date = new Date().toISOString().split('T')[0];
			status = 'todo';
			category = 'งานหลัก';
			notes = '';
			assignee_id = null;
		}
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
	
	function getAssigneeById(id: number | null): Assignee | undefined {
		return assignees.find(a => a.id === id);
	}
</script>

<form on:submit|preventDefault={handleSubmit} class="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
	<h2 class="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
		<CheckCircle size={20} class="text-primary" />
		{editingTask ? 'แก้ไขงาน' : 'เพิ่มงานใหม่'}
	</h2>
	
	<div>
		<label for="title" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
			ชื่องาน <span class="text-danger">*</span>
		</label>
		<input
			id="title"
			type="text"
			bind:value={title}
			placeholder="เช่น ออกแบบโลโก้, เขียนรายงาน..."
			class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
			required
		/>
	</div>

	<div>
		<label for="project" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
			<Folder size={14} />
			โปรเจค
		</label>
		<select
			id="project"
			bind:value={project}
			class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
		>
			<option value="">-- ไม่ระบุ --</option>
			{#each projects as proj}
				<option value={proj.name}>{proj.name}</option>
			{/each}
		</select>
	</div>
	
	<div class="grid grid-cols-2 gap-4">
		<div>
			<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
				<Calendar size={14} />
				วันที่นัดหมาย (Due Date)
			</label>
			<input
				type="date"
				bind:value={date}
				class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
				required
			/>
		</div>

		<div>
			<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
				<Tag size={14} />
				หมวดหมู่
			</label>
			<select
				bind:value={category}
				class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
			>
				{#each CATEGORIES as cat}
					<option value={cat}>{cat}</option>
				{/each}
			</select>
		</div>
	</div>

	<!-- Assignee Section -->
	<div>
		<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
			<User size={14} />
			ผู้รับผิดชอบ
		</label>

		{#if showAddAssigneeForm}
			<div class="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg space-y-3">
				<div>
					<label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">ชื่อ</label>
					<input
						type="text"
						bind:value={newAssigneeName}
						placeholder="ชื่อผู้รับผิดชอบ..."
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
					/>
				</div>
				<div>
					<label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">สีประจำตัว</label>
					<div class="flex flex-wrap gap-1.5">
						{#each colorOptions as color}
							<button
								type="button"
								on:click={() => newAssigneeColor = color}
								class="w-6 h-6 rounded-full border-2 transition-all {newAssigneeColor === color ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent hover:scale-105'}"
								style="background-color: {color}"
							/>
						{/each}
					</div>
				</div>
				<div class="flex gap-2 pt-1">
					<button
						type="button"
						on:click={handleAddAssignee}
						disabled={!newAssigneeName.trim()}
						class="flex-1 bg-primary hover:bg-primary-dark disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white py-1.5 px-3 rounded-lg text-sm font-medium transition-colors"
					>
						เพิ่ม
					</button>
					<button
						type="button"
						on:click={cancelAddAssignee}
						class="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
					>
						ยกเลิก
					</button>
				</div>
			</div>
		{:else}
			<div class="flex gap-2">
				<select
					bind:value={assignee_id}
					class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
				>
					<option value={null}>-- ไม่ระบุ --</option>
					{#each assignees as assignee}
						<option value={assignee.id}>{assignee.name}</option>
					{/each}
				</select>
				<button
					type="button"
					on:click={() => showAddAssigneeForm = true}
					class="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
					title="เพิ่มผู้รับผิดชอบใหม่"
				>
					<Plus size={16} />
				</button>
			</div>

			{#if assignee_id}
				{@const selectedAssignee = getAssigneeById(assignee_id)}
				{#if selectedAssignee}
					<div class="mt-2 flex items-center gap-2 text-sm">
						<span class="w-3 h-3 rounded-full" style="background-color: {selectedAssignee.color}"></span>
						<span class="text-gray-600 dark:text-gray-400">{selectedAssignee.name}</span>
					</div>
				{/if}
			{/if}
		{/if}
	</div>
	
	<div>
		<label for="status" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">สถานะ</label>
		<div class="flex gap-2">
			<button
				type="button"
				id="status"
				on:click={() => status = 'todo'}
				class="flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors {status === 'todo' ? 'border-warning bg-warning/10 text-warning' : 'border-gray-200 dark:border-gray-600 hover:border-warning/50'}"
			>
				รอดำเนินการ
			</button>
			<button
				type="button"
				on:click={() => status = 'in-progress'}
				class="flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors {status === 'in-progress' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 dark:border-gray-600 hover:border-primary/50'}"
			>
				กำลังทำ
			</button>
			<button
				type="button"
				on:click={() => status = 'done'}
				class="flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors {status === 'done' ? 'border-success bg-success/10 text-success' : 'border-gray-200 dark:border-gray-600 hover:border-success/50'}"
			>
				เสร็จแล้ว
			</button>
		</div>
	</div>

	<div>
		<label for="notes" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
			<FileText size={14} />
			หมายเหตุ
		</label>
		<textarea
			id="notes"
			bind:value={notes}
			rows="2"
			placeholder="รายละเอียดเพิ่มเติม..."
			class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
		></textarea>
	</div>

	<div class="flex gap-3 pt-2">
		<button
			type="submit"
			class="flex-1 bg-primary hover:bg-primary-dark text-white py-2 px-4 rounded-lg font-medium transition-colors"
		>
			{editingTask ? 'บันทึกการแก้ไข' : 'เพิ่มงาน'}
		</button>
		{#if editingTask}
			<button
				type="button"
				on:click={() => dispatch('cancel')}
				class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
			>
				ยกเลิก
			</button>
		{/if}
	</div>
</form>
