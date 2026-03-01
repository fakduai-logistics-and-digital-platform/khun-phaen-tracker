<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { _ } from 'svelte-i18n';
	import type { Assignee, Task } from '$lib/types';
	import { Calendar as CalendarIcon, Clock, ChevronDown, Filter, ArrowRight } from 'lucide-svelte';
	import CustomDatePicker from './CustomDatePicker.svelte';

	export let tasks: Task[] = [];
	export let assignees: Assignee[] = [];

	const dispatch = createEventDispatcher<{ selectAssignee: { assigneeId: string | number | 'all' | null } }>();

	type Period = '7d' | '1m' | '3m' | '1y' | 'all' | 'custom';
	let selectedPeriod: Period = 'all';
	let customStartDate = '';
	let customEndDate = '';
	let showCustomPicker = false;

	type WorkloadItem = {
		assigneeId: string | number | null;
		assigneeName: string;
		color: string;
		total: number;
		todo: number;
		inProgress: number;
		inTest: number;
		done: number;
		overdue: number;
		totalMinutes: number;
		activeLoadScore: number;
	};

	function isOverdue(task: Task): boolean {
		if (!task.date || task.status === 'done') return false;
		const today = new Date();
		const due = new Date(task.date);
		today.setHours(0, 0, 0, 0);
		due.setHours(0, 0, 0, 0);
		return due < today;
	}

	function loadLevelClass(score: number): string {
		if (score >= 8) return 'text-red-600 dark:text-red-400';
		if (score >= 4) return 'text-amber-600 dark:text-amber-400';
		return 'text-emerald-600 dark:text-emerald-400';
	}

	$: workloadRows = getWorkloadRows(tasks, assignees, selectedPeriod, customStartDate, customEndDate);

	function getWorkloadRows(_tasks: Task[], _assignees: Assignee[], _period: Period, _start: string, _end: string): WorkloadItem[] {
		let filtered = _tasks;
		
		if (_period !== 'all') {
			const now = new Date();
			now.setHours(23, 59, 59, 999);
			let startDate: Date;

			if (_period === 'custom') {
				startDate = _start ? new Date(_start) : new Date(0);
				const endDate = _end ? new Date(_end) : new Date();
				endDate.setHours(23, 59, 59, 999);
				
				filtered = _tasks.filter(t => {
					if (!t.date) return false;
					const d = new Date(t.date);
					return d >= startDate && d <= endDate;
				});
			} else {
				startDate = new Date();
				startDate.setHours(0, 0, 0, 0);
				if (_period === '7d') startDate.setDate(now.getDate() - 7);
				else if (_period === '1m') startDate.setMonth(now.getMonth() - 1);
				else if (_period === '3m') startDate.setMonth(now.getMonth() - 3);
				else if (_period === '1y') startDate.setFullYear(now.getFullYear() - 1);

				filtered = _tasks.filter(t => {
					if (!t.date) return false;
					const d = new Date(t.date);
					return d >= startDate && d <= now;
				});
			}
		}

		const map = new Map<string | number | null, WorkloadItem>();
		const assigneeById = new Map<string | number, Assignee>(
			_assignees
				.filter((assignee): assignee is Assignee & { id: string | number } => assignee.id !== undefined)
				.map((assignee) => [assignee.id, assignee])
		);

		for (const task of filtered) {
			// Support multiple assignees
			const assigneeIds = task.assignee_ids || (task.assignee_id ? [task.assignee_id] : [null]);

			// If no assignees, still count as unassigned
			if (assigneeIds.length === 0) {
				assigneeIds.push(null);
			}

			for (const key of assigneeIds) {
				const assignee = key === null ? null : assigneeById.get(key);
				if (!map.has(key)) {
					map.set(key, {
						assigneeId: key,
						assigneeName: assignee?.name ?? $_('page__unassigned'),
						color: assignee?.color ?? '#94a3b8',
						total: 0,
						todo: 0,
						inProgress: 0,
						inTest: 0,
						done: 0,
						overdue: 0,
						totalMinutes: 0,
						activeLoadScore: 0
					});
				}

				const row = map.get(key)!;
				row.total += 1;
				row.totalMinutes += task.duration_minutes || 0;
				if (task.status === 'todo') row.todo += 1;
				if (task.status === 'in-progress') row.inProgress += 1;
				if (task.status === 'in-test') row.inTest += 1;
				if (task.status === 'done') row.done += 1;
				if (isOverdue(task)) row.overdue += 1;
			}
		}

		for (const row of map.values()) {
			row.activeLoadScore = row.todo + row.inProgress * 2 + row.inTest * 1.5 + row.overdue * 3;
		}

		return [...map.values()].sort((a, b) => {
			if (b.activeLoadScore !== a.activeLoadScore) return b.activeLoadScore - a.activeLoadScore;
			if (b.overdue !== a.overdue) return b.overdue - a.overdue;
			return b.total - a.total;
		});
	}

	function getTaskCount(workerId: string | number): number {
		const stat = workloadRows.find(s => String(s.assigneeId) === String(workerId));
		return stat?.total || 0;
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			dispatch('selectAssignee', { assigneeId: 'all' });
		}
	}
</script>

<div class="space-y-4">
	<!-- Period Selection Bar -->
	<div class="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
		<div class="flex items-center gap-2">
			<Filter size={18} class="text-gray-400" />
			<div class="flex p-1 bg-gray-100 dark:bg-gray-900 rounded-lg">
				{#each ['7d', '1m', '3m', '1y', 'all', 'custom'] as period}
					<button
						on:click={() => {
							selectedPeriod = period as Period;
							if (period === 'custom') showCustomPicker = true;
							else showCustomPicker = false;
						}}
						class="px-3 py-1.5 rounded-md text-xs font-medium transition-all {selectedPeriod === period ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}"
					>
						{$_(`workload__filter_${period}`)}
					</button>
				{/each}
			</div>
		</div>

		{#if selectedPeriod === 'custom' || showCustomPicker}
			<div class="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
				<div class="w-44">
					<CustomDatePicker
						bind:value={customStartDate}
						placeholder={$_('page__filter_start_date')}
					/>
				</div>
				<ArrowRight size={14} class="text-gray-400 shrink-0" />
				<div class="w-44">
					<CustomDatePicker
						bind:value={customEndDate}
						placeholder={$_('page__filter_end_date')}
					/>
				</div>
			</div>
		{/if}
	</div>

	<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
		<div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm transition-colors">
			<p class="text-xs text-gray-500 dark:text-gray-400">{$_('workload__total_people')}</p>
			<p class="text-2xl font-semibold text-gray-900 dark:text-white">{workloadRows.length}</p>
		</div>
		<div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm transition-colors">
			<p class="text-xs text-gray-500 dark:text-gray-400">{$_('workload__overdue_tasks')}</p>
			<p class="text-2xl font-semibold text-red-600 dark:text-red-400">
				{workloadRows.reduce((sum, row) => sum + row.overdue, 0)}
			</p>
		</div>
		<div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm transition-colors">
			<p class="text-xs text-gray-500 dark:text-gray-400">{$_('workload__active_tasks')}</p>
			<p class="text-2xl font-semibold text-gray-900 dark:text-white">
				{workloadRows.reduce((sum, row) => sum + row.todo + row.inProgress + row.inTest, 0)}
			</p>
		</div>
	</div>

	<div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
		<table class="min-w-full text-sm">
			<thead class="bg-gray-50 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300">
				<tr>
					<th class="px-4 py-3 text-left font-medium">{$_('workload__person')}</th>
					<th class="px-4 py-3 text-right font-medium">{$_('workload__todo')}</th>
					<th class="px-4 py-3 text-right font-medium">{$_('workload__in_progress')}</th>
					<th class="px-4 py-3 text-right font-medium">{$_('workload__in_test')}</th>
					<th class="px-4 py-3 text-right font-medium">{$_('workload__overdue')}</th>
					<th class="px-4 py-3 text-right font-medium">{$_('workload__done')}</th>
					<th class="px-4 py-3 text-right font-medium">{$_('workload__total')}</th>
					<th class="px-4 py-3 text-right font-medium">{$_('workload__score')}</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-900/40">
				{#if workloadRows.length === 0}
					<tr>
						<td colspan="8" class="px-4 py-12 text-center text-gray-500 dark:text-gray-400 bg-gray-50/30 dark:bg-gray-800/20">
							<div class="flex flex-col items-center gap-2">
								<Filter size={32} class="opacity-20" />
								<p>{$_('workload__no_data')}</p>
							</div>
						</td>
					</tr>
				{:else}
					{#each workloadRows as row}
						<tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
							<td class="px-4 py-3">
								<div class="flex items-center gap-2">
									<span class="h-2.5 w-2.5 rounded-full" style={`background-color: ${row.color};`}></span>
									<button
										class="font-medium text-gray-900 dark:text-gray-100 hover:underline text-left"
										on:click={() => dispatch('selectAssignee', { assigneeId: row.assigneeId })}
									>
										{row.assigneeName}
									</button>
								</div>
							</td>
							<td class="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{row.todo}</td>
							<td class="px-4 py-3 text-right text-blue-600 dark:text-blue-400">{row.inProgress}</td>
							<td class="px-4 py-3 text-right text-purple-600 dark:text-purple-400">{row.inTest}</td>
							<td class="px-4 py-3 text-right text-red-600 dark:text-red-400">{row.overdue}</td>
							<td class="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{row.done}</td>
							<td class="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{row.total}</td>
							<td class="px-4 py-3 text-right font-bold {loadLevelClass(row.activeLoadScore)}">
								{row.activeLoadScore.toFixed(1)}
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</div>
