<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import type { Task } from '$lib/types';
	import { Calendar as CalendarIcon, Clock } from 'lucide-svelte';
	
	const dispatch = createEventDispatcher<{
		selectTask: Task;
	}>();
	
	export let tasks: Task[] = [];

	const CALENDAR_STATE_STORAGE_KEY = 'calendar-view-state-v1';
	
	// Force re-render when tasks change
	$: tasksKey = tasks
		.map((t) => `${t.id ?? 'x'}:${t.date ?? ''}:${t.status}:${t.duration_minutes}:${t.updated_at ?? ''}`)
		.join('|');
	
	let currentDate = new Date();
	let selectedDate: string | null = null;
	let selectedCellEl: HTMLElement | null = null;
	let gridContainerEl: HTMLDivElement | null = null;
	let popoverPosition = { top: 0, left: 0 };

	function restoreCalendarState() {
		if (typeof localStorage === 'undefined') return;
		const raw = localStorage.getItem(CALENDAR_STATE_STORAGE_KEY);
		if (!raw) return;

		try {
			const saved = JSON.parse(raw) as { currentMonth?: string; selectedDate?: string | null };
			if (saved.currentMonth) {
				const restoredDate = new Date(saved.currentMonth);
				if (!Number.isNaN(restoredDate.getTime())) {
					currentDate = restoredDate;
				}
			}
			if (saved.selectedDate) {
				selectedDate = saved.selectedDate;
			}
		} catch {
			localStorage.removeItem(CALENDAR_STATE_STORAGE_KEY);
		}
	}

	function persistCalendarState() {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(
			CALENDAR_STATE_STORAGE_KEY,
			JSON.stringify({
				currentMonth: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString(),
				selectedDate
			})
		);
	}
	
	$: year = currentDate.getFullYear();
	$: month = currentDate.getMonth();
	
	$: firstDayOfMonth = new Date(year, month, 1).getDay();
	$: daysInMonth = new Date(year, month + 1, 0).getDate();
	
	$: monthNames = [
		'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
		'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
	];

	function normalizeDateKey(dateText: string): string {
		// Support both YYYY-MM-DD and full ISO datetime from imports/sync sources.
		const isoMatch = dateText.match(/^(\d{4}-\d{2}-\d{2})/);
		if (isoMatch) return isoMatch[1];
		const parsed = new Date(dateText);
		if (Number.isNaN(parsed.getTime())) return dateText;
		const y = parsed.getFullYear();
		const m = String(parsed.getMonth() + 1).padStart(2, '0');
		const d = String(parsed.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	
	// Reactive computation of tasks by date - recalculates whenever tasks change
	$: tasksByDate = (() => {
		const acc: Record<string, Task[]> = {};
		for (const task of tasks) {
			if (task.date) {
				const dateKey = normalizeDateKey(task.date);
				if (!acc[dateKey]) acc[dateKey] = [];
				acc[dateKey].push(task);
			}
		}
		return acc;
	})();
	
	function getDateKey(day: number): string {
		return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	}
	
	function getDayTasks(day: number): Task[] {
		return tasksByDate[getDateKey(day)] || [];
	}

	function getTasksByDate(dateKey: string): Task[] {
		return tasksByDate[dateKey] || [];
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
	
	function updatePopoverPosition() {
		if (!selectedCellEl || !gridContainerEl) return;

		const cellRect = selectedCellEl.getBoundingClientRect();
		const containerRect = gridContainerEl.getBoundingClientRect();
		const popoverWidth = 320;
		const offset = 10;

		const relativeTop = cellRect.top - containerRect.top + cellRect.height + offset;
		let relativeLeft = cellRect.left - containerRect.left - 8;

		const maxLeft = containerRect.width - popoverWidth - 12;
		if (relativeLeft > maxLeft) relativeLeft = maxLeft;
		if (relativeLeft < 12) relativeLeft = 12;

		popoverPosition = { top: relativeTop, left: relativeLeft };
	}

	function selectDate(date: string, event: MouseEvent) {
		const dayTasks = getTasksByDate(date);
		if (dayTasks.length === 0) {
			selectedDate = null;
			selectedCellEl = null;
			return;
		}

		if (selectedDate === date) {
			selectedDate = null;
			selectedCellEl = null;
			return;
		}

		selectedDate = date;
		selectedCellEl = event.currentTarget as HTMLElement;
		updatePopoverPosition();
	}
	
	$: selectedDateTasks = selectedDate ? (tasksByDate[selectedDate] || []) : [];

	$: persistCalendarState();

	function formatPopoverDate(dateText: string): string {
		const d = new Date(dateText);
		const day = d.getDate();
		const month = d.toLocaleDateString('en-GB', { month: 'short' });
		const yearBE = d.getFullYear() + 543;
		return `${day} ${month} ${yearBE}`;
	}

	function truncate(text: string, max = 95): string {
		if (!text) return '';
		if (text.length <= max) return text;
		return `${text.slice(0, max).trim()}...`;
	}

	function getStatusLabel(status: Task['status']): string {
		if (status === 'done') return 'เสร็จแล้ว';
		if (status === 'in-progress') return 'กำลังทำ';
		return 'รอดำเนินการ';
	}

	function getStatusClass(status: Task['status']): string {
		if (status === 'done') {
			return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
		}
		if (status === 'in-progress') {
			return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300';
		}
		return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
	}

	function handleWindowResize() {
		if (!selectedDate) return;
		updatePopoverPosition();
	}

	onMount(() => {
		restoreCalendarState();
		window.addEventListener('resize', handleWindowResize);
	});

	onDestroy(() => {
		window.removeEventListener('resize', handleWindowResize);
	});
</script>

{#key tasksKey}
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
	<div bind:this={gridContainerEl} class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors relative">
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
					on:click={(event) => selectDate(dateKey, event)}
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

		{#if selectedDate && selectedDateTasks.length > 0}
			<div
				class="absolute z-20 w-[320px] max-w-[calc(100%-24px)]"
				style="top: {popoverPosition.top}px; left: {popoverPosition.left}px;"
			>
				<div class="relative rounded-2xl border border-gray-200/90 dark:border-white/15 bg-white/95 dark:bg-gray-900/85 backdrop-blur-xl shadow-2xl p-3 text-gray-800 dark:text-gray-100">
					<div class="absolute -top-1.5 left-7 w-3 h-3 rotate-45 border-l border-t border-gray-200/90 dark:border-white/15 bg-white/95 dark:bg-gray-900/85"></div>
					<div class="flex items-center justify-between rounded-xl px-3 py-2 bg-gray-100/80 dark:bg-white/5 border border-gray-200 dark:border-white/10">
						<p class="font-semibold text-base tracking-tight line-clamp-1">
							งานวันที่เลือก
						</p>
						<div class="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[11px] text-primary font-medium">
							{selectedDateTasks.length} รายการ
						</div>
					</div>

					<div class="mt-2 rounded-xl px-3 py-2 bg-primary/10 dark:bg-primary/15 border border-primary/20 text-[20px] leading-none font-semibold text-primary">
						{formatPopoverDate(selectedDate)}
					</div>

					<div class="mt-2 space-y-2 max-h-48 overflow-auto pr-1">
						{#each selectedDateTasks as task}
							<button
								on:click={() => dispatch('selectTask', task)}
								class="w-full text-left rounded-xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-3 py-2 hover:bg-primary/5 dark:hover:bg-white/10 transition-colors"
							>
								<div class="flex items-center justify-between gap-2">
									<p class="font-semibold text-sm leading-tight text-gray-900 dark:text-gray-100">{task.title}</p>
									<span class="text-[11px] text-gray-500 dark:text-gray-300 flex items-center gap-1 whitespace-nowrap">
										<Clock size={12} />
										{Math.floor(task.duration_minutes / 60)}:{String(task.duration_minutes % 60).padStart(2, '0')}
									</span>
								</div>
								<div class="mt-1 flex items-center gap-2">
									<span class="text-[10px] font-medium px-2 py-0.5 rounded-full {getStatusClass(task.status)}">
										{getStatusLabel(task.status)}
									</span>
									{#if task.category}
										<span class="text-[11px] text-gray-500 dark:text-gray-400">{task.category}</span>
									{/if}
								</div>
								{#if task.notes}
									<p class="mt-1 text-xs text-gray-600 dark:text-gray-300 leading-snug">
										{truncate(task.notes)}
									</p>
								{/if}
							</button>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
{/key}
