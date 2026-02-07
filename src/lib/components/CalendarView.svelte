<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import type { Task } from '$lib/types';
	import { Calendar as CalendarIcon, Clock } from 'lucide-svelte';
	
	const dispatch = createEventDispatcher<{
		selectTask: Task;
	}>();
	
	export let tasks: Task[] = [];
	
	let currentDate = new Date();
	let selectedDate: string | null = null;
	
	$: year = currentDate.getFullYear();
	$: month = currentDate.getMonth();
	
	$: firstDayOfMonth = new Date(year, month, 1).getDay();
	$: daysInMonth = new Date(year, month + 1, 0).getDate();
	
	$: monthNames = [
		'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
		'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
	];
	
	$: tasksByDate = tasks.reduce((acc, task) => {
		if (!acc[task.date]) acc[task.date] = [];
		acc[task.date].push(task);
		return acc;
	}, {} as Record<string, Task[]>);
	
	function getDateKey(day: number): string {
		return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	}
	
	function getDayTasks(day: number): Task[] {
		return tasksByDate[getDateKey(day)] || [];
	}
	
	function getTotalMinutes(day: number): number {
		return getDayTasks(day).reduce((sum, t) => sum + t.duration_minutes, 0);
	}

	function formatDuration(minutes: number): string {
		if (minutes === 0) return '';
		const totalHours = minutes / 60;
		const mandays = totalHours / 8; // 8 ชั่วโมง = 1 man-day

		if (mandays >= 0.125) {
			// ถ้ามากกว่า 1 ชั่วโมง (0.125 man-day) แสดงเป็น man-day
			return `${mandays.toFixed(2)}`;
		}

		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		if (h > 0) return `${h}ชม`;
		return `${m}น`;
	}
	
	function prevMonth() {
		currentDate = new Date(year, month - 1, 1);
	}
	
	function nextMonth() {
		currentDate = new Date(year, month + 1, 1);
	}
	
	function goToToday() {
		currentDate = new Date();
	}
	
	function selectDate(date: string) {
		selectedDate = selectedDate === date ? null : date;
	}
	
	$: selectedTasks = selectedDate ? (tasksByDate[selectedDate] || []) : [];
</script>

<div class="space-y-4">
	<!-- Calendar Header -->
	<div class="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
		<div class="flex items-center gap-2">
			<CalendarIcon size={20} class="text-primary" />
			<h2 class="text-lg font-semibold text-gray-800 dark:text-white">
				{monthNames[month]} {year + 543}
			</h2>
		</div>
		<div class="flex items-center gap-2">
			<button
				on:click={prevMonth}
				aria-label="เดือนก่อนหน้า"
				class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 transition-colors"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
			</button>
			<button
				on:click={goToToday}
				class="px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
			>
				วันนี้
			</button>
			<button
				on:click={nextMonth}
				aria-label="เดือนถัดไป"
				class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 transition-colors"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
			</button>
		</div>
	</div>

	<!-- Calendar Grid -->
	<div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
		<!-- Day Headers -->
		<div class="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
			{#each ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as day}
				<div class="py-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700">
					{day}
				</div>
			{/each}
		</div>

		<!-- Days -->
		<div class="grid grid-cols-7">
			{#each Array(firstDayOfMonth) as _, i}
				<div class="aspect-square border-b border-r border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50"></div>
			{/each}

			{#each Array(daysInMonth) as _, dayIndex}
				{@const day = dayIndex + 1}
				{@const dateKey = getDateKey(day)}
				{@const dayTasks = getDayTasks(day)}
				{@const totalMinutes = getTotalMinutes(day)}
				{@const isToday = dateKey === new Date().toISOString().split('T')[0]}
				{@const isSelected = selectedDate === dateKey}

				<button
					on:click={() => selectDate(dateKey)}
					class="aspect-square border-b border-r border-gray-100 dark:border-gray-700 p-1.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 relative {isSelected ? 'bg-primary/5' : ''}"
				>
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium {isToday ? 'bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center' : 'text-gray-700 dark:text-gray-300'}">
							{day}
						</span>
						{#if totalMinutes > 0}
							<span class="text-xs font-medium text-success">
								{formatDuration(totalMinutes)}
							</span>
						{/if}
					</div>

					{#if dayTasks.length > 0}
						<div class="mt-1 flex flex-wrap gap-1">
							{#each dayTasks.slice(0, 3) as task}
								<div
									class="h-1.5 rounded-full flex-1 min-w-0 {task.status === 'done' ? 'bg-success' : task.status === 'in-progress' ? 'bg-primary' : 'bg-warning'}"
									title={task.title}
								></div>
							{/each}
							{#if dayTasks.length > 3}
								<span class="text-xs text-gray-400 dark:text-gray-500">+{dayTasks.length - 3}</span>
							{/if}
						</div>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	<!-- Selected Date Tasks -->
	{#if selectedDate && selectedTasks.length > 0}
		<div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
			<h3 class="font-medium text-gray-800 dark:text-white mb-3">
				งานวันที่ {new Date(selectedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
				<span class="text-sm text-gray-500 dark:text-gray-400 font-normal">({selectedTasks.length} งาน)</span>
			</h3>
			<div class="space-y-2">
				{#each selectedTasks as task}
					<button
						on:click={() => dispatch('selectTask', task)}
						class="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary hover:bg-primary/5 transition-colors"
					>
						<div class="flex items-center justify-between">
							<span class="font-medium text-gray-900 dark:text-white">{task.title}</span>
							<span class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
								<Clock size={14} />
								{Math.floor(task.duration_minutes / 60)}:{String(task.duration_minutes % 60).padStart(2, '0')}
							</span>
						</div>
						<div class="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
							<span class="px-2 py-0.5 rounded text-xs {task.status === 'done' ? 'bg-success/10 text-success' : task.status === 'in-progress' ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'}">
								{task.status === 'done' ? 'เสร็จแล้ว' : task.status === 'in-progress' ? 'กำลังทำ' : 'รอดำเนินการ'}
							</span>
							<span>{task.category}</span>
						</div>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
