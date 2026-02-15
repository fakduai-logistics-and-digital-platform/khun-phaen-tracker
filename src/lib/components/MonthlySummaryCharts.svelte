<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { createElement } from 'react';
	import { createRoot, type Root } from 'react-dom/client';
	import { RechartsSummary } from './RechartsSummary';
	import { _ } from 'svelte-i18n';

	export let done = 0;
	export let inProgress = 0;
	export let todo = 0;
	export let dailyTrend: { date: string; count: number }[] = [];
	export let projectBreakdown: { name: string; count: number }[] = [];
	export let assigneeBreakdown: { name: string; count: number }[] = [];

	let container: HTMLDivElement;
	let root: Root | null = null;
	let trendMode: 'line' | 'bar' = 'line';
	let mounted = false;

	function isDarkMode(): boolean {
		return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
	}

	function render() {
		if (!container) return;
		if (!root) {
			root = createRoot(container);
		}

		root.render(
			createElement(RechartsSummary, {
				done,
				inProgress,
				todo,
				dailyTrend,
				projectBreakdown,
				assigneeBreakdown,
				isDark: isDarkMode(),
				trendMode,
				labels: {
					status: $_('monthlyCharts__status_title'),
					trend: $_('monthlyCharts__trend_title'),
					project: $_('monthlyCharts__project_title'),
					assignee: $_('monthlyCharts__assignee_title'),
					tasksCount: $_('monthlyCharts__tasks_count'),
					done: $_('page__filter_status_done'),
					inProgress: $_('page__filter_status_in_progress'),
					todo: $_('page__filter_status_todo')
				}
			})
		);
	}

	onMount(() => {
		mounted = true;
		render();

		// Listen for dark mode changes
		const observer = new MutationObserver(() => {
			if (mounted) render();
		});
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
		
		return () => observer.disconnect();
	});

	onDestroy(() => {
		mounted = false;
		if (root) {
			root.unmount();
			root = null;
		}
	});

	$: if (mounted && (done || inProgress || todo || dailyTrend || projectBreakdown || assigneeBreakdown || trendMode)) {
		render();
	}

	function setTrendMode(mode: 'line' | 'bar') {
		trendMode = mode;
	}
</script>

<div class="space-y-3 pt-6">
	<div class="flex items-center justify-between">
		<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{$_('monthlyCharts__visualization')}</p>
		<div class="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 border border-gray-200 dark:border-gray-700 shadow-sm">
			<button
				on:click={() => setTrendMode('line')}
				class="px-4 py-1.5 text-xs font-bold rounded-lg transition-all {trendMode === 'line' ? 'bg-primary text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}"
			>
				{$_('monthlyCharts__btn_line')}
			</button>
			<button
				on:click={() => setTrendMode('bar')}
				class="px-4 py-1.5 text-xs font-bold rounded-lg transition-all {trendMode === 'bar' ? 'bg-primary text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}"
			>
				{$_('monthlyCharts__btn_bar')}
			</button>
		</div>
	</div>

	<div bind:this={container}></div>

	<div class="rounded-2xl border border-blue-200/60 dark:border-blue-800/70 bg-blue-50/70 dark:bg-blue-900/20 px-6 py-4 flex items-start gap-4 shadow-sm">
		<div class="p-2 bg-blue-500/10 rounded-lg">
			<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
		</div>
		<div>
			<p class="text-sm font-bold text-blue-900 dark:text-blue-200">{$_('monthlyCharts__insight_title')}</p>
			<p class="text-sm text-blue-700/80 dark:text-blue-300/80 font-medium">{$_('monthlyCharts__insight_body')}</p>
		</div>
	</div>
</div>

