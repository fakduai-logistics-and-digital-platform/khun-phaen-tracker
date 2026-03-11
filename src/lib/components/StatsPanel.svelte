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

	const dispatch = createEventDispatcher<{
		filterStatus: { status: 'all' | 'pending' | 'todo' | 'in-progress' | 'in-test' | 'done' };
		exportCSV: void;
		exportPDF: void;
		exportPNG: void;
		exportMarkdown: any;
		exportVideo: any;
		exportSlide: any;
		exportDatabase: any;
		importCSV: any;
	}>();

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

<section class="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:border-gray-700 dark:bg-gray-900/70 dark:shadow-none">
	<div class="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.22),_transparent_38%),linear-gradient(135deg,_#f8fafc_0%,_#e2e8f0_45%,_#c7d2fe_100%)] p-5 text-slate-900 dark:border-gray-700 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950 dark:text-white sm:p-6">
		{#if $currentWorkspaceName}
			<div class="flex flex-col gap-4">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="space-y-3">
						<a 
							href="{base}/dashboard" 
							class="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200/90 bg-white/75 px-3 text-[10px] font-black uppercase tracking-[0.24em] text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15"
						>
							<ArrowLeft size={14} />
							{$_('statsPanel__switch_workspace')}
						</a>

						<div class="flex flex-wrap items-center gap-3">
							<div 
								class="inline-flex h-11 max-w-full items-center gap-3 rounded-2xl border px-4"
								style="background-color: {$currentWorkspaceColor ? $currentWorkspaceColor + '1f' : '#6366f11f'}; border-color: {$currentWorkspaceColor ? $currentWorkspaceColor + '55' : '#6366f155'}"
							>
								<div class="flex h-7 w-7 items-center justify-center rounded-xl bg-white/65 dark:bg-white/10" style="color: {$currentWorkspaceColor || '#6366f1'}">
									<svelte:component this={getIcon($currentWorkspaceIcon)} size={14} />
								</div>
									<div class="min-w-0">
										<p class="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500 dark:text-slate-300/80">
											{$_('statsPanel__workspace')}
										</p>
									<p 
										class="max-w-[60vw] truncate text-sm font-black tracking-wide"
										style="color: {$currentWorkspaceColor || '#4338ca'}"
									>
										{$currentWorkspaceName}
									</p>
								</div>
							</div>
						</div>
					</div>

					<div class="flex shrink-0 items-start">
						<ExportImport
							showImport={isOwner}
							{videoExportState}
							height="h-10"
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
			</div>
		{/if}
	</div>

	<div class="p-4 sm:p-5">
		<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
	<!-- Total Tasks -->
	<button
		type="button"
		class="bg-white/85 dark:bg-gray-800/40 p-5 rounded-2xl border border-slate-200 dark:border-gray-700/30 backdrop-blur-md transition-all group shadow-sm text-left hover:scale-[1.01] hover:shadow-md"
		on:click={() => dispatch('filterStatus', { status: 'all' })}
	>
		<div class="flex items-start justify-between">
			<div>
				<p class="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1 opacity-70">{$_('statsPanel__total_tasks')}</p>
				<p class="text-3xl font-black text-gray-900 dark:text-white leading-none tracking-tighter">{stats.total}</p>
			</div>
			<div class="p-3 bg-blue-500/5 rounded-xl">
				<Calendar class="text-blue-500" size={24} />
			</div>
		</div>
	</button>

	<!-- Pending -->
	<button
		type="button"
		class="bg-white/85 dark:bg-gray-800/40 p-5 rounded-2xl border border-slate-200 dark:border-gray-700/30 backdrop-blur-md transition-all group shadow-sm text-left hover:scale-[1.01] hover:shadow-md"
		on:click={() => dispatch('filterStatus', { status: 'pending' })}
	>
		<div class="flex items-start justify-between">
			<div>
				<p class="text-[10px] font-black text-slate-600/80 dark:text-slate-400/80 uppercase tracking-widest mb-1 opacity-70">{$_('statsPanel__pending')}</p>
				<p class="text-3xl font-black text-slate-600 dark:text-slate-300 leading-none tracking-tighter">{stats.pending}</p>
			</div>
			<div class="p-3 bg-slate-500/5 rounded-xl">
				<PauseCircle class="text-slate-500" size={24} />
			</div>
		</div>
	</button>

	<!-- Todo -->
	<button
		type="button"
		class="bg-white/85 dark:bg-gray-800/40 p-5 rounded-2xl border border-slate-200 dark:border-gray-700/30 backdrop-blur-md transition-all group shadow-sm text-left hover:scale-[1.01] hover:shadow-md"
		on:click={() => dispatch('filterStatus', { status: 'todo' })}
	>
		<div class="flex items-start justify-between">
			<div>
				<p class="text-[10px] font-black text-amber-600/80 dark:text-amber-500/80 uppercase tracking-widest mb-1 opacity-70">{$_('statsPanel__todo')}</p>
				<p class="text-3xl font-black text-amber-600 dark:text-amber-500 leading-none tracking-tighter">{stats.todo}</p>
			</div>
			<div class="p-3 bg-amber-500/5 rounded-xl">
				<Circle class="text-amber-500" size={24} />
			</div>
		</div>
	</button>

	<!-- In Progress -->
	<button
		type="button"
		class="bg-white/85 dark:bg-gray-800/40 p-5 rounded-2xl border border-slate-200 dark:border-gray-700/30 backdrop-blur-md transition-all group shadow-sm text-left hover:scale-[1.01] hover:shadow-md"
		on:click={() => dispatch('filterStatus', { status: 'in-progress' })}
	>
		<div class="flex items-start justify-between">
			<div>
				<p class="text-[10px] font-black text-blue-600/80 dark:text-blue-500/80 uppercase tracking-widest mb-1 opacity-70">{$_('statsPanel__in_progress')}</p>
				<p class="text-3xl font-black text-blue-600 dark:text-blue-500 leading-none tracking-tighter">{stats.in_progress}</p>
			</div>
			<div class="p-3 bg-blue-600/5 rounded-xl">
				<Loader2 class="text-blue-500" size={24} />
			</div>
		</div>
	</button>

	<!-- In Test -->
	<button
		type="button"
		class="bg-white/85 dark:bg-gray-800/40 p-5 rounded-2xl border border-slate-200 dark:border-gray-700/30 backdrop-blur-md transition-all group shadow-sm text-left hover:scale-[1.01] hover:shadow-md"
		on:click={() => dispatch('filterStatus', { status: 'in-test' })}
	>
		<div class="flex items-start justify-between">
			<div>
				<p class="text-[10px] font-black text-purple-600/80 dark:text-purple-500/80 uppercase tracking-widest mb-1 opacity-70">{$_('statsPanel__in_test')}</p>
				<p class="text-3xl font-black text-purple-600 dark:text-purple-500 leading-none tracking-tighter">{stats.in_test}</p>
			</div>
			<div class="p-3 bg-purple-500/5 rounded-xl">
				<FlaskConical class="text-purple-500" size={24} />
			</div>
		</div>
	</button>

	<!-- Done -->
	<button
		type="button"
		class="bg-white/85 dark:bg-gray-800/40 p-5 rounded-2xl border border-slate-200 dark:border-gray-700/30 backdrop-blur-md transition-all group shadow-sm text-left hover:scale-[1.01] hover:shadow-md"
		on:click={() => dispatch('filterStatus', { status: 'done' })}
	>
		<div class="flex items-start justify-between">
			<div>
				<p class="text-[10px] font-black text-emerald-600/80 dark:text-emerald-500/80 uppercase tracking-widest mb-1 opacity-70">{$_('statsPanel__done')}</p>
				<p class="text-3xl font-black text-emerald-600 dark:text-emerald-500 leading-none tracking-tighter">{stats.done}</p>
			</div>
			<div class="p-3 bg-emerald-500/5 rounded-xl">
				<CheckCircle2 class="text-emerald-500" size={24} />
			</div>
		</div>
	</button>
		</div>
	</div>
</section>
