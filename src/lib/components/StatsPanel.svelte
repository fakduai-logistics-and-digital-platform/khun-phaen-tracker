<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { 
		CheckCircle2, Circle, Loader2, Calendar, FlaskConical, LayoutTemplate, ArrowLeft, PauseCircle,
		Briefcase, Code2, Rocket, Zap, Heart, Target, Globe, Book, Camera, Coffee, Music, Smile
	} from 'lucide-svelte';
	import { currentWorkspaceName, currentWorkspaceColor, currentWorkspaceIcon } from '$lib/stores/workspace';
	import ExportImport from '$lib/components/ExportImport.svelte';
	import { _ } from 'svelte-i18n';
	import { base } from '$app/paths';

	const ICON_MAP: Record<string, any> = {
		'LayoutTemplate': LayoutTemplate,
		'Briefcase': Briefcase,
		'Code2': Code2,
		'Rocket': Rocket,
		'Zap': Zap,
		'Heart': Heart,
		'Target': Target,
		'Globe': Globe,
		'Book': Book,
		'Camera': Camera,
		'Coffee': Coffee,
		'Music': Music,
		'Smile': Smile,
	};

	function getIcon(key?: string | null) {
		return ICON_MAP[key || 'LayoutTemplate'] || LayoutTemplate;
	}

	const dispatch = createEventDispatcher();

	export let isOwner: boolean = false;
	export let videoExportState: any = null;
	export let stats: {
		total: number;
		pending: number;
		todo: number;
		in_progress: number;
		in_test: number;
		done: number;
		total_minutes: number;
	} = { total: 0, pending: 0, todo: 0, in_progress: 0, in_test: 0, done: 0, total_minutes: 0 };
</script>

{#if $currentWorkspaceName}
	<div class="mb-2">
		<a 
			href="{base}/dashboard" 
			class="mb-2 inline-flex h-8 items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 text-[10px] font-black uppercase tracking-widest text-gray-700 shadow-sm transition-colors hover:bg-gray-100 dark:border-gray-700/40 dark:bg-gray-800/50 dark:text-gray-200 dark:hover:bg-gray-800"
		>
			<ArrowLeft size={14} />
			{$_('statsPanel__switch_workspace')}
		</a>

		<div class="flex flex-wrap items-center gap-2">
		<div 
			class="inline-flex items-center rounded-xl border px-3 h-8 gap-2"
			style="background-color: {$currentWorkspaceColor ? $currentWorkspaceColor + '1a' : '#6366f11a'}; border-color: {$currentWorkspaceColor ? $currentWorkspaceColor + '4d' : '#6366f14d'}"
		>
			<div style="color: {$currentWorkspaceColor || '#6366f1'}">
				<svelte:component this={getIcon($currentWorkspaceIcon)} size={12} />
			</div>
			<p 
				class="max-w-[70vw] truncate text-xs font-black uppercase tracking-wider"
				style="color: {$currentWorkspaceColor || '#6366f1'}"
			>
				{$currentWorkspaceName}
			</p>
		</div>

		<ExportImport
			showImport={isOwner}
			{videoExportState}
			height="h-8"
			on:exportCSV={() => dispatch('exportCSV')}
			on:exportPDF={() => dispatch('exportPDF')}
			on:exportPNG={() => dispatch('exportPNG')}
			on:exportMarkdown={(e) => dispatch('exportMarkdown', e.detail)}
			on:exportVideo={(e) => dispatch('exportVideo', e.detail)}
			on:exportSlide={(e) => dispatch('exportSlide', e.detail)}
			on:exportDatabase={(e) => dispatch('exportDatabase', e.detail)}
			on:importCSV={(e) => dispatch('importCSV', e.detail)}
		/>
		</div>
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

	<!-- Pending -->
	<div class="bg-gray-50 dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-200 dark:border-gray-700/30 backdrop-blur-md transition-all group shadow-sm">
		<div class="flex items-start justify-between">
			<div>
				<p class="text-[10px] font-black text-slate-600/80 dark:text-slate-400/80 uppercase tracking-widest mb-1 opacity-70">{$_('statsPanel__pending')}</p>
				<p class="text-3xl font-black text-slate-600 dark:text-slate-300 leading-none tracking-tighter">{stats.pending}</p>
			</div>
			<div class="p-3 bg-slate-500/5 rounded-xl">
				<PauseCircle class="text-slate-500" size={24} />
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

</div>
