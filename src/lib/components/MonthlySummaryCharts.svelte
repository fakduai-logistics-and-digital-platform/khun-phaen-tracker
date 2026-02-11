<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		Chart,
		ArcElement,
		Tooltip,
		Legend,
		DoughnutController,
		LineController,
		CategoryScale,
		LinearScale,
		PointElement,
		LineElement,
		BarController,
		BarElement,
		Filler
	} from 'chart.js';

	Chart.register(
		ArcElement,
		Tooltip,
		Legend,
		DoughnutController,
		LineController,
		CategoryScale,
		LinearScale,
		PointElement,
		LineElement,
		BarController,
		BarElement,
		Filler
	);

	export let done = 0;
	export let inProgress = 0;
	export let todo = 0;
	export let dailyTrend: { date: string; count: number }[] = [];
	export let projectBreakdown: { name: string; count: number }[] = [];
	export let assigneeBreakdown: { name: string; count: number }[] = [];

	let statusCanvas: HTMLCanvasElement;
	let trendCanvas: HTMLCanvasElement;
	let projectCanvas: HTMLCanvasElement;
	let assigneeCanvas: HTMLCanvasElement;
	let statusChart: Chart | null = null;
	let trendChart: Chart | null = null;
	let projectChart: Chart | null = null;
	let assigneeChart: Chart | null = null;
	let mounted = false;
	let trendMode: 'line' | 'bar' = 'line';
	let insightTitle = 'คลิกกราฟเพื่อดูรายละเอียด';
	let insightBody = 'เลือกจุดในกราฟแนวโน้ม หรือแท่งใน Top โปรเจค/ผู้รับผิดชอบ';

	function isDarkMode(): boolean {
		return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
	}

	function palette() {
		const dark = isDarkMode();
		return {
			text: dark ? '#dbe7ff' : '#1f2a44',
			muted: dark ? '#8ca3cf' : '#64748b',
			grid: dark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.15)',
			card: dark ? '#0f172a' : '#ffffff',
			status: ['#10b981', '#3b82f6', '#f59e0b'],
			project: dark ? '#a78bfa' : '#8b5cf6',
			assignee: dark ? '#22d3ee' : '#0891b2',
			trendStroke: dark ? '#60a5fa' : '#2563eb'
		};
	}

	function destroyCharts() {
		statusChart?.destroy();
		trendChart?.destroy();
		projectChart?.destroy();
		assigneeChart?.destroy();
		statusChart = null;
		trendChart = null;
		projectChart = null;
		assigneeChart = null;
	}

	function makeGradient(ctx: CanvasRenderingContext2D, c1: string, c2: string) {
		const gradient = ctx.createLinearGradient(0, 0, 0, 260);
		gradient.addColorStop(0, c1);
		gradient.addColorStop(1, c2);
		return gradient;
	}

	function truncateLabel(label: string, max = 16): string {
		return label.length > max ? `${label.slice(0, max)}...` : label;
	}

	function baseScales() {
		const c = palette();
		return {
			x: {
				grid: { color: c.grid, drawTicks: false },
				ticks: { color: c.muted, font: { size: 11 } }
			},
			y: {
				beginAtZero: true,
				grid: { color: c.grid },
				ticks: { color: c.muted, precision: 0, font: { size: 11 } }
			}
		};
	}

	function createTooltipCallbacks() {
		return {
			title: (items: any[]) => items[0]?.label || '',
			label: (context: any) => ` ${context.parsed.y ?? context.parsed.x ?? context.raw} งาน`
		};
	}

	function renderCharts() {
		if (!mounted || !statusCanvas || !trendCanvas || !projectCanvas || !assigneeCanvas) return;
		destroyCharts();

		const c = palette();
		const statusCtx = statusCanvas.getContext('2d');
		const trendCtx = trendCanvas.getContext('2d');
		const projectCtx = projectCanvas.getContext('2d');
		const assigneeCtx = assigneeCanvas.getContext('2d');
		if (!statusCtx || !trendCtx || !projectCtx || !assigneeCtx) return;

		statusChart = new Chart(statusCtx, {
			type: 'doughnut',
			data: {
				labels: ['Done', 'In Progress', 'Todo'],
				datasets: [{
					data: [done, inProgress, todo],
					backgroundColor: c.status,
					borderColor: c.card,
					borderWidth: 2,
					hoverOffset: 12
				}]
			},
			options: {
				maintainAspectRatio: false,
				cutout: '64%',
				plugins: {
					legend: {
						position: 'bottom',
						labels: { color: c.text, usePointStyle: true, padding: 16, pointStyle: 'circle' }
					},
					tooltip: {
						callbacks: {
							label: (ctx) => ` ${ctx.label}: ${ctx.raw} งาน`
						}
					}
				}
			}
		});

		const trendLabels = dailyTrend.map((d, i) => (i % 5 === 0 ? d.date.slice(5) : ''));
		const trendData = dailyTrend.map((d) => d.count);
		const trendGradient = makeGradient(trendCtx, 'rgba(59,130,246,0.35)', 'rgba(59,130,246,0.02)');
		const trendDataset = trendMode === 'line'
			? {
					type: 'line' as const,
					label: 'Tasks',
					data: trendData,
					borderColor: c.trendStroke,
					backgroundColor: trendGradient,
					fill: true,
					tension: 0.35,
					borderWidth: 3,
					pointRadius: 2,
					pointHoverRadius: 5
				}
			: {
					type: 'bar' as const,
					label: 'Tasks',
					data: trendData,
					borderRadius: 6,
					backgroundColor: 'rgba(59,130,246,0.8)'
				};

		trendChart = new Chart(trendCtx, {
			type: trendMode,
			data: { labels: trendLabels, datasets: [trendDataset] },
			options: {
				maintainAspectRatio: false,
				scales: {
					x: { ...baseScales().x, grid: { display: false } },
					y: baseScales().y
				},
				plugins: {
					legend: { display: false },
					tooltip: { callbacks: createTooltipCallbacks() }
				},
				onClick: (_, elements) => {
					if (!elements.length) return;
					const idx = elements[0].index;
					const d = dailyTrend[idx];
					if (!d) return;
					insightTitle = `แนวโน้มวันที่ ${d.date}`;
					insightBody = `มีงานทั้งหมด ${d.count} งานในวันนั้น`;
				}
			}
		});

		const projectItems = projectBreakdown.slice(0, 6);
		projectChart = new Chart(projectCtx, {
			type: 'bar',
			data: {
				labels: projectItems.map((p) => truncateLabel(p.name)),
				datasets: [{
					data: projectItems.map((p) => p.count),
					backgroundColor: c.project,
					borderRadius: 8
				}]
			},
			options: {
				maintainAspectRatio: false,
				indexAxis: 'y',
				scales: {
					x: baseScales().x,
					y: { ...baseScales().y, grid: { display: false }, ticks: { color: c.muted } }
				},
				plugins: { legend: { display: false }, tooltip: { callbacks: createTooltipCallbacks() } },
				onClick: (_, elements) => {
					if (!elements.length) return;
					const idx = elements[0].index;
					const p = projectItems[idx];
					if (!p) return;
					insightTitle = `โปรเจค: ${p.name}`;
					insightBody = `มีงาน ${p.count} งานในรอบ 30 วัน`;
				}
			}
		});

		const assigneeItems = assigneeBreakdown.slice(0, 6);
		assigneeChart = new Chart(assigneeCtx, {
			type: 'bar',
			data: {
				labels: assigneeItems.map((a) => truncateLabel(a.name)),
				datasets: [{
					data: assigneeItems.map((a) => a.count),
					backgroundColor: c.assignee,
					borderRadius: 8
				}]
			},
			options: {
				maintainAspectRatio: false,
				indexAxis: 'y',
				scales: {
					x: baseScales().x,
					y: { ...baseScales().y, grid: { display: false }, ticks: { color: c.muted } }
				},
				plugins: { legend: { display: false }, tooltip: { callbacks: createTooltipCallbacks() } },
				onClick: (_, elements) => {
					if (!elements.length) return;
					const idx = elements[0].index;
					const a = assigneeItems[idx];
					if (!a) return;
					insightTitle = `ผู้รับผิดชอบ: ${a.name}`;
					insightBody = `รับผิดชอบ ${a.count} งานในรอบ 30 วัน`;
				}
			}
		});
	}

	function setTrendMode(mode: 'line' | 'bar') {
		if (trendMode === mode) return;
		trendMode = mode;
		renderCharts();
	}

	onMount(() => {
		mounted = true;
		renderCharts();
	});

	onDestroy(() => {
		mounted = false;
		destroyCharts();
	});

	$: if (mounted) renderCharts();
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between">
		<p class="text-xs text-gray-500 dark:text-gray-400">Interactive: คลิกกราฟเพื่อดูรายละเอียดด้านล่าง</p>
		<div class="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
			<button
				on:click={() => setTrendMode('line')}
				class="px-3 py-1.5 text-xs {trendMode === 'line' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}"
			>
				Line
			</button>
			<button
				on:click={() => setTrendMode('bar')}
				class="px-3 py-1.5 text-xs {trendMode === 'bar' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}"
			>
				Bar
			</button>
		</div>
	</div>

	<div class="grid md:grid-cols-2 gap-4">
		<div class="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-white/90 dark:bg-gray-800/70 shadow-sm">
			<h4 class="font-semibold text-gray-900 dark:text-white mb-3">สัดส่วนสถานะงาน</h4>
			<div class="h-56"><canvas bind:this={statusCanvas}></canvas></div>
		</div>
		<div class="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-white/90 dark:bg-gray-800/70 shadow-sm">
			<h4 class="font-semibold text-gray-900 dark:text-white mb-3">แนวโน้มรายวัน 30 วัน</h4>
			<div class="h-56"><canvas bind:this={trendCanvas}></canvas></div>
		</div>
		<div class="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-white/90 dark:bg-gray-800/70 shadow-sm">
			<h4 class="font-semibold text-gray-900 dark:text-white mb-3">Top โปรเจค</h4>
			<div class="h-56"><canvas bind:this={projectCanvas}></canvas></div>
		</div>
		<div class="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-white/90 dark:bg-gray-800/70 shadow-sm">
			<h4 class="font-semibold text-gray-900 dark:text-white mb-3">Top ผู้รับผิดชอบ</h4>
			<div class="h-56"><canvas bind:this={assigneeCanvas}></canvas></div>
		</div>
	</div>

	<div class="rounded-xl border border-blue-200/60 dark:border-blue-800/70 bg-blue-50/70 dark:bg-blue-900/20 px-4 py-3">
		<p class="text-sm font-semibold text-blue-800 dark:text-blue-300">{insightTitle}</p>
		<p class="text-sm text-blue-700 dark:text-blue-400">{insightBody}</p>
	</div>
</div>
