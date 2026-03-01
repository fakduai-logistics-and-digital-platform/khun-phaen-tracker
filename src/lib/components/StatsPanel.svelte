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
</script>

{#if $currentWorkspaceName}
	<div class="mb-2 inline-flex items-center rounded-xl border border-indigo-200/70 dark:border-indigo-500/30 bg-indigo-50/80 dark:bg-indigo-500/10 px-3 py-1.5">
		<p class="max-w-[70vw] truncate text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
			{$currentWorkspaceName}
		</p>
	</div>
{/if}

<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
	<!-- Total Tasks -->
	<div class="bg-gray-50 dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-200 dark:border-gray-700/30 backdrop-blur-md transition-all group shadow-sm">
		<div class="flex items-start justify-between">
			<div>
				<p class="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1 opacity-70">{$_('statsPanel__total_tasks')}</p>
				<p class="text-3xl font-black text-gray-900 dark:text-white leading-none tracking-tighter">{stats.total}</p>
			</div>
			<div class="p-3 bg-blue-500/5 rounded-xl">
				<Calendar class="text-blue-500" size={24} />
			</div>
		</div>
	</div>

	<!-- Todo -->
	<div class="bg-gray-50 dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-200 dark:border-gray-700/30 backdrop-blur-md transition-all group shadow-sm">
		<div class="flex items-start justify-between">
			<div>
				<p class="text-[10px] font-black text-amber-600/80 dark:text-amber-500/80 uppercase tracking-widest mb-1 opacity-70">{$_('statsPanel__todo')}</p>
				<p class="text-3xl font-black text-amber-600 dark:text-amber-500 leading-none tracking-tighter">{stats.todo}</p>
			</div>
			<div class="p-3 bg-amber-500/5 rounded-xl">
				<Circle class="text-amber-500" size={24} />
			</div>
		</div>
	</div>

	<!-- In Progress -->
	<div class="bg-gray-50 dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-200 dark:border-gray-700/30 backdrop-blur-md transition-all group shadow-sm">
		<div class="flex items-start justify-between">
			<div>
				<p class="text-[10px] font-black text-blue-600/80 dark:text-blue-500/80 uppercase tracking-widest mb-1 opacity-70">{$_('statsPanel__in_progress')}</p>
				<p class="text-3xl font-black text-blue-600 dark:text-blue-500 leading-none tracking-tighter">{stats.in_progress}</p>
			</div>
			<div class="p-3 bg-blue-600/5 rounded-xl">
				<Loader2 class="text-blue-500" size={24} />
			</div>
		</div>
	</div>

	<!-- In Test -->
	<div class="bg-gray-50 dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-200 dark:border-gray-700/30 backdrop-blur-md transition-all group shadow-sm">
		<div class="flex items-start justify-between">
			<div>
				<p class="text-[10px] font-black text-purple-600/80 dark:text-purple-500/80 uppercase tracking-widest mb-1 opacity-70">{$_('statsPanel__in_test')}</p>
				<p class="text-3xl font-black text-purple-600 dark:text-purple-500 leading-none tracking-tighter">{stats.in_test}</p>
			</div>
			<div class="p-3 bg-purple-500/5 rounded-xl">
				<FlaskConical class="text-purple-500" size={24} />
			</div>
		</div>
	</div>

	<!-- Done -->
	<div class="bg-gray-50 dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-200 dark:border-gray-700/30 backdrop-blur-md transition-all group shadow-sm">
		<div class="flex items-start justify-between">
			<div>
				<p class="text-[10px] font-black text-emerald-600/80 dark:text-emerald-500/80 uppercase tracking-widest mb-1 opacity-70">{$_('statsPanel__done')}</p>
				<p class="text-3xl font-black text-emerald-600 dark:text-emerald-500 leading-none tracking-tighter">{stats.done}</p>
			</div>
			<div class="p-3 bg-emerald-500/5 rounded-xl">
				<CheckCircle2 class="text-emerald-500" size={24} />
			</div>
		</div>
	</div>

	<!-- Workspace Card -->
	<div class="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl border border-gray-200 dark:border-gray-700/30 backdrop-blur-md transition-all group shadow-sm">
		<div class="flex items-start justify-between">
			<div class="min-w-0">
				<p class="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1 opacity-70">{$_('statsPanel__workspace')}</p>
				<h3 class="text-lg font-black text-gray-900 dark:text-white leading-tight truncate">{$currentWorkspaceName || 'Workspace'}</h3>
				
				<a 
					href="{base}/dashboard" 
					class="mt-2 flex items-center gap-1.5 text-[10px] font-black text-indigo-500 hover:text-indigo-600 transition-colors uppercase tracking-widest"
				>
					<ArrowLeft size={14} />
					{$_('statsPanel__switch_workspace')}
				</a>
			</div>
			<div class="p-3 bg-indigo-500/5 rounded-xl">
				<LayoutTemplate class="text-indigo-500" size={24} />
			</div>
		</div>
	</div>
</div>
