<script lang="ts">
	import { Clock, CheckCircle2, Circle, Loader2, Calendar, Briefcase, Zap } from 'lucide-svelte';
	import { compressionReady, compressionStats, getStorageInfo } from '$lib/stores/storage';
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';

	export let stats: {
		total: number;
		todo: number;
		in_progress: number;
		done: number;
		total_minutes: number;
	} = { total: 0, todo: 0, in_progress: 0, done: 0, total_minutes: 0 };

	let storageInfo = { used: 0, total: 0, percentage: 0 };

	onMount(() => {
		storageInfo = getStorageInfo();
	});

	function formatDuration(minutes: number): string {
		const totalHours = minutes / 60;
		const mandays = totalHours / 8;

		if (mandays >= 1) {
			return `${mandays.toFixed(1)} ${mandays > 1 ? $_('statsPanel__man_days') : $_('statsPanel__man_day')}`;
		}

		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		if (h > 0 && m > 0) return `${h}${$_('statsPanel__hours_short')} ${m}${$_('statsPanel__minutes_short')}`;
		if (h > 0) return `${h} ${$_('statsPanel__hours_short')}.`;
		return `${m} ${$_('statsPanel__minutes_short')}`;
	}

	$: donePercent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
	$: compressionPercent = $compressionStats.ratio;
</script>

<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
	<!-- Total Tasks -->
	<div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
		<div class="flex items-center justify-between">
			<div>
				<p class="text-sm text-gray-500 dark:text-gray-400 mb-1">{$_('statsPanel__total_tasks')}</p>
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
				<p class="text-sm text-gray-500 dark:text-gray-400 mb-1">{$_('statsPanel__in_progress')}</p>
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
				<p class="text-sm text-gray-500 dark:text-gray-400 mb-1">{$_('statsPanel__done')}</p>
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

	<!-- Storage with Compression -->
	<div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
		<div class="flex items-center justify-between">
			<div>
				<div class="flex items-center gap-1">
					<p class="text-sm text-gray-500 dark:text-gray-400 mb-1">{$_('statsPanel__storage')}</p>
					{#if $compressionReady}
						<span class="text-xs text-green-600 flex items-center gap-0.5" title={$_('statsPanel__compression_active')}>
							<Zap size={10} />
						</span>
					{/if}
				</div>
				<p class="text-2xl font-bold text-gray-900 dark:text-white">
					{(storageInfo.used / 1024).toFixed(0)} KB
				</p>
			</div>
			<div class="p-3 {$compressionReady ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'} rounded-lg">
				{#if $compressionReady}
					<Zap class="text-green-600" size={24} />
				{:else}
					<Briefcase class="text-gray-600" size={24} />
				{/if}
			</div>
		</div>
		{#if $compressionReady && compressionPercent > 0}
			<div class="mt-2">
				<div class="flex items-center justify-between text-xs">
					<span class="text-green-600 dark:text-green-400 font-medium">
						{$_('statsPanel__saving', { values: { percent: compressionPercent.toFixed(0) } })}
					</span>
					<span class="text-gray-400">LZ4</span>
				</div>
				<div class="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-1">
					<div class="bg-green-500 h-1.5 rounded-full transition-all" style="width: {compressionPercent}%"></div>
				</div>
			</div>
		{:else}
			<div class="mt-2">
				<div class="flex items-center gap-2">
					<div class="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
						<div class="bg-gray-400 h-1.5 rounded-full transition-all" style="width: {storageInfo.percentage}%"></div>
					</div>
					<span class="text-xs text-gray-500">{storageInfo.percentage.toFixed(0)}%</span>
				</div>
			</div>
		{/if}
	</div>
</div>
