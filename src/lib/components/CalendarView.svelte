<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { _ , locale } from '$lib/i18n';
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
	let popoverEl: HTMLDivElement | null = null;
	let popoverPosition = { top: 0, left: 0 };
	let popoverPlacement: 'top' | 'bottom' = 'bottom';
	let popoverArrowLeft = 28;

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

	$: isThai = $locale === 'th' || $locale?.startsWith('th');
	$: monthNames = $_('calendarView__months') || [];

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
		const mandays = totalHours / 8;

		if (mandays >= 0.125) {
			return `${mandays.toFixed(2)}`;
		}

		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		if (h > 0) return `${h}${$_('statsPanel__hours_short')}`;
		return `${m}${$_('statsPanel__minutes_short')}`;
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
		const popoverWidth = popoverEl?.offsetWidth || 320;
		const popoverHeight = popoverEl?.offsetHeight || 320;
		const offset = 10;

		const belowTop = cellRect.top - containerRect.top + cellRect.height + offset;
		const aboveTop = cellRect.top - containerRect.top - popoverHeight - offset;
		const availableBelow = containerRect.bottom - cellRect.bottom;
		const availableAbove = cellRect.top - containerRect.top;

		let relativeTop = belowTop;
		if (availableBelow < popoverHeight && availableAbove > availableBelow) {
			popoverPlacement = 'top';
			relativeTop = aboveTop;
		} else {
			popoverPlacement = 'bottom';
		}

		const maxTop = containerRect.height - popoverHeight - 8;
		if (relativeTop < 8) relativeTop = 8;
		if (relativeTop > maxTop) relativeTop = Math.max(8, maxTop);
		let relativeLeft = cellRect.left - containerRect.left - 8;

		const maxLeft = containerRect.width - popoverWidth - 12;
		if (relativeLeft > maxLeft) relativeLeft = maxLeft;
		if (relativeLeft < 12) relativeLeft = 12;

		popoverPosition = { top: relativeTop, left: relativeLeft };

		const cellCenterRelativeToContainer =
			cellRect.left - containerRect.left + cellRect.width / 2;
		const desiredArrowLeft = cellCenterRelativeToContainer - relativeLeft;
		const minArrowLeft = 18;
		const maxArrowLeft = popoverWidth - 18;
		popoverArrowLeft = Math.min(Math.max(desiredArrowLeft, minArrowLeft), maxArrowLeft);
	}

	async function selectDate(date: string, event: MouseEvent) {
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
		await tick();
		updatePopoverPosition();
	}
	
	$: selectedDateTasks = selectedDate ? (tasksByDate[selectedDate] || []) : [];

	$: persistCalendarState();

	function formatPopoverDate(dateText: string): string {
		const d = new Date(dateText);
		const day = d.getDate();
		const shortMonths = $_('calendarView__short_months') || [];
		const monthText = shortMonths[d.getMonth()] || '';
		const displayYear = isThai ? d.getFullYear() + 543 : d.getFullYear();
		return `${day} ${monthText} ${displayYear}`;
	}

	function truncate(text: string, max = 95): string {
		if (!text) return '';
		if (text.length <= max) return text;
		return `${text.slice(0, max).trim()}...`;
	}

	function getStatusLabel(status: Task['status']): string {
		switch (status) {
			case 'in-progress': return $_('page__filter_status_in_progress');
			case 'in-test': return $_('page__filter_status_in_test');
			case 'done': return $_('page__filter_status_done');
			default: return $_('page__filter_status_todo');
		}
	}

	function getStatusClass(status: Task['status']): string {
		switch (status) {
			case 'in-progress':
				return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300';
			case 'in-test':
				return 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300';
			case 'done':
				return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
			default:
				return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
		}
	}

	function handleWindowResize() {
		if (!selectedDate) return;
		updatePopoverPosition();
	}

	$: if (selectedDate && selectedDateTasks.length > 0) {
		tick().then(() => {
			updatePopoverPosition();
		});
	}

	onMount(() => {
		restoreCalendarState();
		window.addEventListener('resize', handleWindowResize);
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('resize', handleWindowResize);
		}
	});
</script>

{#key tasksKey}
<div class="space-y-4">
	<!-- Calendar Header -->
	<div class="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
		<div class="flex items-center gap-2">
			<CalendarIcon size={20} class="text-primary" />
			<h2 class="text-lg font-semibold text-gray-800 dark:text-white">
				{monthNames[month] || ''} {isThai ? year + 543 : year}
			</h2>
		</div>
		<div class="flex items-center gap-2">
			<button
				on:click={prevMonth}
				aria-label={$_('calendarView__prev_month')}
				class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 transition-colors"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
			</button>
			<button
				on:click={goToToday}
				class="px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
			>
				{$_('calendarView__today')}
			</button>
			<button
				on:click={nextMonth}
				aria-label={$_('calendarView__next_month')}
				class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 transition-colors"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
			</button>
		</div>
	</div>

	<!-- Calendar Grid -->
	<div bind:this={gridContainerEl} class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-visible transition-colors relative">
		<!-- Day Headers -->
		<div class="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
			{#each ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as dayKey}
				<div class="py-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700">
					{$_(`calendarView__day_${dayKey}`)}
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
									class="h-1.5 rounded-full flex-1 min-w-0 {task.status === 'done' ? 'bg-success' : task.status === 'in-progress' ? 'bg-primary' : task.status === 'in-test' ? 'bg-purple-500' : 'bg-warning'}"
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
				bind:this={popoverEl}
				class="absolute z-20 w-[320px] max-w-[calc(100%-24px)]"
				style="top: {popoverPosition.top}px; left: {popoverPosition.left}px;"
			>
				<div class="relative rounded-2xl border border-gray-200/90 dark:border-white/15 bg-white/95 dark:bg-gray-900/85 backdrop-blur-xl shadow-2xl p-3 text-gray-800 dark:text-gray-100">
					<div
						class="absolute w-3 h-3 rotate-45 bg-white/95 dark:bg-gray-900/85 {popoverPlacement === 'bottom' ? '-top-1.5 border-l border-t border-gray-200/90 dark:border-white/15' : '-bottom-1.5 border-r border-b border-gray-200/90 dark:border-white/15'}"
						style="left: {popoverArrowLeft}px;"
					></div>
					<div class="flex items-center justify-between rounded-xl px-3 py-2 bg-gray-100/80 dark:bg-white/5 border border-gray-200 dark:border-white/10">
						<p class="font-semibold text-base tracking-tight line-clamp-1">
							{$_('calendarView__popover_title')}
						</p>
						<div class="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[11px] text-primary font-medium">
							{$_('calendarView__items_count', { values: { count: selectedDateTasks.length } })}
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
