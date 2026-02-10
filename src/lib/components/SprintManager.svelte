<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Sprint } from '$lib/types';
	import { sprints } from '$lib/stores/sprintStore';
	import { Flag, Plus, X, Edit2, CheckCircle2, Play, Calendar, AlertCircle, Archive } from 'lucide-svelte';

	const dispatch = createEventDispatcher<{
		close: void;
		complete: number; // sprint id
		deleteSprint: number; // sprint id
		createSprint: { name: string; start_date: string; end_date: string };
		moveTasksToSprint: { sprintId: number; taskIds: number[] };
	}>();

	export let tasks: { id?: number; status: string; sprint_id?: number | null }[] = [];

	let showAddForm = false;
	let editingSprint: Sprint | null = null;
	let newSprintName = '';
	// Helper to get date string in YYYY-MM-DD format
	function getTodayString(): string {
		return new Date().toISOString().split('T')[0];
	}
	
	// Helper to get date string for N days from a given date
	function getDateAfterDays(startDate: string, days: number): string {
		const date = new Date(startDate);
		date.setDate(date.getDate() + days);
		return date.toISOString().split('T')[0];
	}
	
	let newSprintStart = getTodayString();
	let newSprintEnd = getDateAfterDays(getTodayString(), 14); // Default 2 weeks
	let completeConfirmId: number | null = null;
	let showMoveTasksConfirm = false;
	let pendingSprintData: { name: string; start_date: string; end_date: string } | null = null;

	// Check if can create new sprint
	// สร้างได้เมื่อ: ไม่มี sprint เลย, หรือ sprint ล่าสุด completed, หรือ sprint ล่าสุดหมดอายุแล้ว
	$: canCreateSprint = checkCanCreateSprint($sprints);
	$: blockingSprint = getBlockingSprint($sprints);

	function checkCanCreateSprint(sprintList: Sprint[]): boolean {
		if (sprintList.length === 0) return true;
		
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		
		// Find the most recent active or planned sprint
		for (const sprint of sprintList) {
			if (sprint.status === 'active') return false;
			if (sprint.status === 'planned') {
				// Planned sprint สร้างใหม่ได้ทันทีโดยไม่ต้องรอหมดอายุ
				// แต่ถ้าอยากให้รอหมดอายุ ให้ uncomment บรรทัดด้านล่าง
				// const endDate = new Date(sprint.end_date);
				// if (endDate >= today) return false;
				return true;
			}
		}
		return true;
	}

	function getBlockingSprint(sprintList: Sprint[]): Sprint | null {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		
		for (const sprint of sprintList) {
			if (sprint.status === 'active') return sprint;
			// Planned sprint ไม่บล็อกการสร้างใหม่แล้ว
			// if (sprint.status === 'planned') {
			// 	const endDate = new Date(sprint.end_date);
			// 	if (endDate >= today) return sprint;
			// }
		}
		return null;
	}

	// Get tasks that should be moved to new sprint
	function getTasksToMoveToNewSprint(): number[] {
		// Get all tasks that either:
		// 1. Have no sprint (sprint_id is null)
		// 2. Belong to a completed/expired sprint
		const activeOrPlannedSprintIds = new Set(
			$sprints
				.filter(s => s.status === 'active' || s.status === 'planned')
				.map(s => s.id)
		);
		
		return tasks
			.filter(t => t.id !== undefined && (!t.sprint_id || !activeOrPlannedSprintIds.has(t.sprint_id)))
			.map(t => t.id as number);
	}

	function startAdd() {
		showAddForm = true;
		editingSprint = null;
		newSprintName = '';
		newSprintStart = getTodayString();
		newSprintEnd = getDateAfterDays(newSprintStart, 14); // Default 2 weeks from today
	}

	function startEdit(sprint: Sprint) {
		editingSprint = sprint;
		showAddForm = true;
		newSprintName = sprint.name;
		newSprintStart = sprint.start_date;
		newSprintEnd = sprint.end_date;
	}

	function cancelEdit() {
		showAddForm = false;
		editingSprint = null;
		newSprintName = '';
		newSprintStart = getTodayString();
		newSprintEnd = getDateAfterDays(newSprintStart, 14); // Default 2 weeks from today
	}

	function handleSave() {
		if (!newSprintName.trim() || !newSprintStart || !newSprintEnd) return;

		if (editingSprint) {
			sprints.update(editingSprint.id!, {
				name: newSprintName.trim(),
				start_date: newSprintStart,
				end_date: newSprintEnd
			});
			cancelEdit();
		} else {
			// Check if can create new sprint
			if (!canCreateSprint) {
				alert('ไม่สามารถสร้าง Sprint ใหม่ได้: มี Sprint ที่ยังดำเนินการอยู่หรือยังไม่หมดอายุ');
				return;
			}
			
			// Store pending sprint data and show confirm dialog
			pendingSprintData = {
				name: newSprintName.trim(),
				start_date: newSprintStart,
				end_date: newSprintEnd
			};
			
			const tasksToMove = getTasksToMoveToNewSprint();
			if (tasksToMove.length > 0) {
				showMoveTasksConfirm = true;
			} else {
				confirmCreateSprint();
			}
		}
	}

	function confirmCreateSprint(moveTasks = true) {
		if (!pendingSprintData) return;
		
		// Create the sprint
		const newSprint = sprints.add({
			name: pendingSprintData.name,
			start_date: pendingSprintData.start_date,
			end_date: pendingSprintData.end_date,
			status: 'planned'
		});
		
		// Move tasks if requested
		if (moveTasks && newSprint.id) {
			const tasksToMove = getTasksToMoveToNewSprint();
			if (tasksToMove.length > 0) {
				dispatch('moveTasksToSprint', { 
					sprintId: newSprint.id, 
					taskIds: tasksToMove 
				});
			}
		}
		
		showMoveTasksConfirm = false;
		pendingSprintData = null;
		cancelEdit();
	}

	function cancelMoveTasks() {
		showMoveTasksConfirm = false;
		pendingSprintData = null;
	}

	function startComplete(id: number) {
		completeConfirmId = id;
	}

	function confirmComplete() {
		if (completeConfirmId) {
			// Get incomplete tasks from this sprint
			const incompleteTasks = tasks.filter(
				t => t.sprint_id === completeConfirmId && t.status !== 'done'
			);
			
			// Archive completed tasks
			sprints.complete(completeConfirmId);
			
			// Dispatch event to move incomplete tasks out of sprint
			if (incompleteTasks.length > 0) {
				dispatch('moveTasksToSprint', {
					sprintId: -1, // -1 means remove from sprint
					taskIds: incompleteTasks
						.filter(t => t.id !== undefined)
						.map(t => t.id as number)
				});
			}
			
			dispatch('complete', completeConfirmId);
			completeConfirmId = null;
		}
	}

	function cancelComplete() {
		completeConfirmId = null;
	}

	function handleDelete(id: number) {
		if (confirm('คุณแน่ใจหรือไม่ที่จะลบ Sprint นี้?')) {
			dispatch('deleteSprint', id);
			sprints.delete(id);
		}
	}

	function handleStartSprint(id: number) {
		// Set all other active sprints to planned first
		$sprints.forEach(s => {
			if (s.status === 'active') {
				sprints.update(s.id!, { status: 'planned' });
			}
		});
		// Set this sprint to active
		sprints.update(id, { status: 'active' });
	}

	function getTaskCount(sprintId: number): { total: number; done: number } {
		const sprintTasks = tasks.filter(t => t.sprint_id === sprintId);
		return {
			total: sprintTasks.length,
			done: sprintTasks.filter(t => t.status === 'done').length
		};
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
	}

	// Calculate duration between two dates
	function getDurationDays(startDate: string, endDate: string): number {
		const start = new Date(startDate);
		const end = new Date(endDate);
		const diffTime = end.getTime() - start.getTime();
		return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
	}

	// Format duration in days or weeks
	function formatDuration(startDate: string, endDate: string): string {
		const days = getDurationDays(startDate, endDate);
		if (days < 7) {
			return `${days} วัน`;
		} else if (days === 7) {
			return `1 สัปดาห์`;
		} else if (days % 7 === 0) {
			return `${days / 7} สัปดาห์`;
		} else {
			const weeks = Math.floor(days / 7);
			const remainingDays = days % 7;
			return `${weeks} สัปดาห์ ${remainingDays} วัน`;
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			dispatch('close');
		}
	}

	$: activeSprint = $sprints.find(s => s.status === 'active');
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
	<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col transition-colors">
		<!-- Header -->
		<div class="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
					<Flag size={20} class="text-primary" />
				</div>
				<div>
					<h2 class="text-xl font-bold text-gray-900 dark:text-white">จัดการ Sprint</h2>
					<p class="text-sm text-gray-500 dark:text-gray-400">{$sprints.length} Sprint</p>
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
			<!-- Active Sprint Banner -->
			{#if activeSprint}
				<div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
							<Play size={20} class="text-white" />
						</div>
						<div class="flex-1">
							<h3 class="font-semibold text-green-800 dark:text-green-400">{activeSprint.name}</h3>
							<p class="text-sm text-green-600 dark:text-green-500">
								กำลังดำเนินการ · {formatDate(activeSprint.start_date)} - {formatDate(activeSprint.end_date)}
								<span class="inline-flex items-center gap-1 ml-2 px-2 py-0.5 bg-green-100 dark:bg-green-800/50 rounded text-xs font-medium">
									<Calendar size={10} />
									{formatDuration(activeSprint.start_date, activeSprint.end_date)}
								</span>
							</p>
						</div>
						<div class="text-right">
							<div class="text-2xl font-bold text-green-700 dark:text-green-400">{getTaskCount(activeSprint.id!).done}/{getTaskCount(activeSprint.id!).total}</div>
							<div class="text-xs text-green-600 dark:text-green-500">งานเสร็จแล้ว</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- Add/Edit Form -->
			{#if showAddForm}
				<div class="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-6 space-y-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อ Sprint</label>
						<input
							type="text"
							bind:value={newSprintName}
							placeholder="เช่น Sprint 1, สัปดาห์ที่ 1..."
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-gray-800 dark:text-white"
						/>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div>
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">วันเริ่มต้น</label>
							<input
								type="date"
								value={newSprintStart}
								on:input={(e) => {
									const newStart = e.currentTarget.value;
									// Only auto-update end date if not editing existing sprint and start date changed
									if (!editingSprint && newStart !== newSprintStart) {
										newSprintEnd = getDateAfterDays(newStart, 14);
									}
									newSprintStart = newStart;
								}}
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-gray-800 dark:text-white"
							/>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">วันสิ้นสุด</label>
							<input
								type="date"
								bind:value={newSprintEnd}
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-gray-800 dark:text-white"
							/>
						</div>
						<!-- Duration Display -->
						{#if newSprintStart && newSprintEnd}
							<div class="col-span-2 flex items-center justify-center gap-2 py-2 px-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
								<Calendar size={16} class="text-blue-500" />
								<span class="text-sm text-blue-700 dark:text-blue-300 font-medium">
									ระยะเวลา: {formatDuration(newSprintStart, newSprintEnd)}
								</span>
							</div>
						{/if}
					</div>

					<div class="flex gap-2 pt-2">
						<button
							on:click={handleSave}
							disabled={!newSprintName.trim() || !newSprintStart || !newSprintEnd}
							class="flex-1 bg-primary hover:bg-primary-dark disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
						>
							{#if editingSprint}
								<Edit2 size={16} />
								บันทึก
							{:else}
								<Plus size={16} />
								สร้าง Sprint
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
					{#if !canCreateSprint && blockingSprint}
						<!-- Disabled button with tooltip -->
						<div class="relative group mb-6">
							<button
								disabled
								class="w-full py-3 px-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-gray-400 dark:text-gray-600 cursor-not-allowed flex items-center justify-center gap-2"
							>
								<Plus size={18} />
								สร้าง Sprint ใหม่
							</button>
							<!-- Tooltip -->
							<div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
								{#if blockingSprint.status === 'active'}
									มี Sprint "{blockingSprint.name}" กำลังดำเนินการอยู่
								{:else}
									Sprint "{blockingSprint.name}" ยังไม่หมดอายุ
								{/if}
								<div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800 dark:border-t-gray-700"></div>
							</div>
						</div>
					{:else}
						<button
							on:click={startAdd}
							class="w-full mb-6 py-3 px-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
						>
							<Plus size={18} />
							สร้าง Sprint ใหม่
						</button>
					{/if}
				{/if}

			<!-- Sprint List -->
			<div class="space-y-3">
				<h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">รายการ Sprint</h3>

				{#if $sprints.length === 0}
					<div class="text-center py-8 text-gray-400 dark:text-gray-500">
						<Flag size={48} class="mx-auto mb-3 opacity-50" />
						<p>ยังไม่มี Sprint</p>
						<p class="text-sm">คลิกปุ่มด้านบนเพื่อสร้าง</p>
					</div>
				{:else}
					<div class="space-y-3">
						{#each $sprints.slice().reverse() as sprint (sprint.id)}
							{@const stats = getTaskCount(sprint.id!)}
							<div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 transition-colors">
								<div class="flex items-start gap-3">
									<!-- Status Icon -->
									<div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
										{sprint.status === 'active' ? 'bg-green-500 text-white' : 
										 sprint.status === 'completed' ? 'bg-gray-400 text-white' : 
										 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'}">
										{#if sprint.status === 'active'}
											<Play size={18} />
										{:else if sprint.status === 'completed'}
											<CheckCircle2 size={18} />
										{:else}
											<Calendar size={18} />
										{/if}
									</div>

									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2 mb-1">
											<h4 class="font-semibold text-gray-900 dark:text-white truncate">{sprint.name}</h4>
											<span class="text-xs px-2 py-0.5 rounded-full font-medium
												{sprint.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
												 sprint.status === 'completed' ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300' : 
												 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}">
												{sprint.status === 'active' ? 'กำลังทำ' : sprint.status === 'completed' ? 'เสร็จสิ้น' : 'วางแผน'}
											</span>
										</div>
										<p class="text-sm text-gray-500 dark:text-gray-400">
											{formatDate(sprint.start_date)} - {formatDate(sprint.end_date)}
										<span class="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-600 rounded text-xs">
											<Calendar size={10} />
											{formatDuration(sprint.start_date, sprint.end_date)}
										</span>
										{#if sprint.completed_at}
											<span class="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 bg-green-100 dark:bg-green-800/50 text-green-700 dark:text-green-300 rounded text-xs">
												<CheckCircle2 size={10} />
												จบ {formatDate(sprint.completed_at)}
											</span>
										{/if}
										</p>
										{#if sprint.status === 'completed'}
											<!-- Completed Sprint: Show archived count -->
											<p class="text-sm text-gray-600 dark:text-gray-300 mt-1">
												<Archive size={14} class="inline mr-1 text-gray-400" />
												{sprint.archived_count || 0} งาน Archive
												{#if sprint.archived_count}
													<span class="text-gray-400 ml-1">(เสร็จสิ้นแล้ว)</span>
												{:else}
													<span class="text-gray-400 ml-1">(ไม่มีงานใน Sprint)</span>
												{/if}
											</p>
										{:else}
											<!-- Active/Planned Sprint: Show current progress -->
											<p class="text-sm text-gray-600 dark:text-gray-300 mt-1">
												{getTaskCount(sprint.id!).done}/{getTaskCount(sprint.id!).total} งานเสร็จแล้ว
												{#if getTaskCount(sprint.id!).total > 0}
													<span class="text-gray-400">({Math.round(getTaskCount(sprint.id!).done/getTaskCount(sprint.id!).total*100)}%)</span>
												{/if}
											</p>
										{/if}

										<!-- Progress Bar -->
										{#if getTaskCount(sprint.id!).total > 0}
											<div class="mt-2 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
												<div class="h-full bg-green-500 transition-all" style="width: {(getTaskCount(sprint.id!).done/getTaskCount(sprint.id!).total*100)}%"></div>
											</div>
										{/if}
									</div>

									<!-- Actions -->
									<div class="flex items-center gap-1">
										{#if sprint.status === 'planned'}
											<button
												on:click={() => handleStartSprint(sprint.id!)}
												class="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
												title="เริ่ม Sprint"
											>
												<Play size={16} />
											</button>
										{/if}

										{#if sprint.status === 'active'}
											<button
												on:click={() => startComplete(sprint.id!)}
												class="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
												title="จบ Sprint"
											>
												<CheckCircle2 size={16} />
											</button>
										{/if}

										<button
											on:click={() => startEdit(sprint)}
											class="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
											title="แก้ไข"
										>
											<Edit2 size={16} />
										</button>

										{#if sprint.status !== 'active'}
											<button
												on:click={() => handleDelete(sprint.id!)}
												class="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
												title="ลบ"
											>
												<X size={16} />
											</button>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>


	<!-- Move Tasks Confirmation Modal -->
	{#if showMoveTasksConfirm && pendingSprintData}
		{@const tasksToMove = getTasksToMoveToNewSprint()}
		<div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
			<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-modal-in">
				<div class="flex items-center gap-3 mb-4">
					<div class="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
						<Flag size={24} class="text-blue-600 dark:text-blue-400" />
					</div>
					<div>
						<h3 class="text-lg font-bold text-gray-900 dark:text-white">สร้าง Sprint ใหม่</h3>
						<p class="text-sm text-gray-500 dark:text-gray-400">ยืนยันการสร้างและย้ายงาน</p>
					</div>
				</div>

				<div class="space-y-3 mb-4">
					<div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
						<p class="text-sm font-medium text-blue-800 dark:text-blue-300">{pendingSprintData.name}</p>
						<p class="text-xs text-blue-600 dark:text-blue-400">
							{formatDate(pendingSprintData.start_date)} - {formatDate(pendingSprintData.end_date)}
							<span class="inline-flex items-center gap-1 ml-1">
								<Calendar size={10} />
								{formatDuration(pendingSprintData.start_date, pendingSprintData.end_date)}
							</span>
						</p>
					</div>

					{#if tasksToMove.length > 0}
						<div class="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
							<p class="text-sm text-gray-700 dark:text-gray-300">
								<span class="font-medium">{tasksToMove.length} งาน</span> จะถูกย้ายมายัง Sprint นี้
							</p>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
								รวมงานที่ไม่มี Sprint และงานจาก Sprint เก่า
							</p>
						</div>
					{/if}
				</div>

				<div class="flex gap-3">
					<button
						on:click={() => confirmCreateSprint(true)}
						class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm"
					>
						<CheckCircle2 size={16} />
						สร้างและย้ายงาน
					</button>
					<button
						on:click={() => confirmCreateSprint(false)}
						class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
					>
						สร้างอย่างเดียว
					</button>
					<button
						on:click={cancelMoveTasks}
						class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
					>
						ยกเลิก
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Complete Confirmation Modal -->
	{#if completeConfirmId}
		{@const incompleteTasks = tasks.filter(t => t.sprint_id === completeConfirmId && t.status !== 'done')}
		{@const completedTasks = tasks.filter(t => t.sprint_id === completeConfirmId && t.status === 'done')}
		{@const hasIncompleteTasks = incompleteTasks.length > 0}
		<div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
			<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-modal-in">
				<div class="flex items-center gap-3 mb-4">
					<div class="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
						<CheckCircle2 size={24} class="text-green-600 dark:text-green-400" />
					</div>
					<div>
						<h3 class="text-lg font-bold text-gray-900 dark:text-white">จบ Sprint</h3>
						<p class="text-sm text-gray-500 dark:text-gray-400">ยืนยันการจบ Sprint</p>
					</div>
				</div>
				
				<div class="space-y-3 mb-4">
					<div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
						<p class="text-sm text-green-800 dark:text-green-300">
							<CheckCircle2 size={14} class="inline mr-1" />
							<span class="font-medium">{completedTasks.length} งาน</span> ที่เสร็จแล้วจะถูก Archive
						</p>
					</div>
					
					{#if hasIncompleteTasks}
						<div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
							<p class="text-sm text-amber-800 dark:text-amber-300">
								<AlertCircle size={14} class="inline mr-1" />
								<span class="font-medium">{incompleteTasks.length} งาน</span> ที่ยังไม่เสร็จจะถูกนำออกจาก Sprint
							</p>
							<p class="text-xs text-amber-600 dark:text-amber-400 mt-1">
								งานเหล่านี้จะรอ Sprint ใหม่
							</p>
						</div>
					{/if}
				</div>

				<div class="flex gap-3">
					<button
						on:click={confirmComplete}
						class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
					>
						<CheckCircle2 size={16} />
						ยืนยันจบ Sprint
					</button>
					<button
						on:click={cancelComplete}
						class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
					>
						ยกเลิก
					</button>
				</div>
			</div>
		</div>
	{/if}

<style>
	@keyframes modal-in {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.animate-modal-in {
		animation: modal-in 0.2s ease-out;
	}
</style>
