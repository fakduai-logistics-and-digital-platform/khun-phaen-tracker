<script lang="ts">
	import { Clock, CheckCircle2, Circle, Loader2, Calendar, Briefcase } from 'lucide-svelte';

	export let stats: {
		total: number;
		todo: number;
		in_progress: number;
		done: number;
		total_minutes: number;
	} = { total: 0, todo: 0, in_progress: 0, done: 0, total_minutes: 0 };

	function formatDuration(minutes: number): string {
		const totalHours = minutes / 60;
		const mandays = totalHours / 8; // 8 ชั่วโมง = 1 man-day

		if (mandays >= 1) {
			return `${mandays.toFixed(1)} man-day${mandays > 1 ? 's' : ''}`;
		}

		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		if (h > 0 && m > 0) return `${h}ชม ${m}นาที`;
		if (h > 0) return `${h} ชม.`;
		return `${m} นาที`;
	}

	$: donePercent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
</script>

<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
	<!-- Total Tasks -->
	<div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
		<div class="flex items-center justify-between">
			<div>
				<p class="text-sm text-gray-500 dark:text-gray-400 mb-1">งานทั้งหมด</p>
				<p class="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
			</div>
			<div class="p-3 bg-primary/10 rounded-lg">
				<Calendar class="text-primary" size={24} />
			</div>
		</div>
	</div>

	<!-- In Progress -->
	<div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
		<div class="flex items-center justify-between">
			<div>
				<p class="text-sm text-gray-500 dark:text-gray-400 mb-1">กำลังทำ</p>
				<p class="text-2xl font-bold text-primary">{stats.in_progress}</p>
			</div>
			<div class="p-3 bg-primary/10 rounded-lg">
				<Loader2 class="text-primary" size={24} />
			</div>
		</div>
	</div>

	<!-- Done -->
	<div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
		<div class="flex items-center justify-between">
			<div>
				<p class="text-sm text-gray-500 dark:text-gray-400 mb-1">เสร็จแล้ว</p>
				<p class="text-2xl font-bold text-success">{stats.done}</p>
			</div>
			<div class="p-3 bg-success/10 rounded-lg">
				<CheckCircle2 class="text-success" size={24} />
			</div>
		</div>
		{#if stats.total > 0}
			<div class="mt-2 flex items-center gap-2">
				<div class="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
					<div class="bg-success h-2 rounded-full transition-all" style="width: {donePercent}%"></div>
				</div>
				<span class="text-xs text-gray-500 dark:text-gray-400">{donePercent}%</span>
			</div>
		{/if}
	</div>
</div>
