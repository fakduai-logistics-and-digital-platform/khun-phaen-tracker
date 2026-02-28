<script lang="ts">
	import { CheckCircle2, Circle, Loader2, Calendar, FlaskConical, LayoutTemplate, ArrowLeft } from 'lucide-svelte';
	import { currentWorkspaceName } from '$lib/stores/workspace';
	import { _ } from 'svelte-i18n';
	import { base } from '$app/paths';

	export let stats: {
		total: number;
		todo: number;
		in_progress: number;
		in_test: number;
		done: number;
		total_minutes: number;
	} = { total: 0, todo: 0, in_progress: 0, in_test: 0, done: 0, total_minutes: 0 };

	$: donePercent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
</script>

<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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

	<!-- Todo -->
	<div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
		<div class="flex items-center justify-between">
			<div>
				<p class="text-sm text-gray-500 dark:text-gray-400 mb-1">{$_('statsPanel__todo')}</p>
				<p class="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.todo}</p>
			</div>
			<div class="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
				<Circle class="text-amber-600 dark:text-amber-400" size={24} />
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

	<!-- In Test -->
	<div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
		<div class="flex items-center justify-between">
			<div>
				<p class="text-sm text-gray-500 dark:text-gray-400 mb-1">{$_('statsPanel__in_test')}</p>
				<p class="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.in_test}</p>
			</div>
			<div class="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
				<FlaskConical class="text-purple-600 dark:text-purple-400" size={24} />
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

	<!-- Workspace Info -->
	<div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
		<div class="flex items-center justify-between">
			<div class="min-w-0 flex-1">
				<p class="text-sm text-gray-500 dark:text-gray-400 mb-1">{$_('statsPanel__workspace')}</p>
				<p class="text-sm font-bold text-gray-900 dark:text-white truncate" title={$currentWorkspaceName}>
					{$currentWorkspaceName || '—'}
				</p>
			</div>
			<div class="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg shrink-0">
				<LayoutTemplate class="text-indigo-600 dark:text-indigo-400" size={24} />
			</div>
		</div>
		<div class="mt-2">
			<a
				href="{base}/dashboard"
				class="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium transition-colors"
			>
				<ArrowLeft size={12} />
				{$_('statsPanel__switch_workspace')}
			</a>
		</div>
	</div>
</div>
