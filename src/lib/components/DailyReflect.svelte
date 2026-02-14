<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { CheckCircle2, Clock, ClipboardCopy, RefreshCcw, X, Sparkles, MessageSquareQuote } from 'lucide-svelte';
	import { fade, scale, fly } from 'svelte/transition';
	import { timeLogs, formatDuration } from '$lib/stores/timeLogs';
	import type { Task } from '$lib/types';
	import { getTasks } from '$lib/db';

	export let show = false;

	let todayTasks: Task[] = [];
	let totalSecondsToday = 0;
	let generatedText = '';
	let isLoading = false;
	let copied = false;

	// Variety of template keys
	const templateKeys = [
		'dailyReflect__temp1',
		'dailyReflect__temp2',
		'dailyReflect__temp3',
		'dailyReflect__temp4',
		'dailyReflect__temp5'
	];

	async function loadTodayData() {
		isLoading = true;
		const now = new Date();
		// Get UTC timestamp for 24 hours ago in format YYYY-MM-DD HH:MM:SS
		const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
		const updatedAtStart = twentyFourHoursAgo.toISOString();
		
		try {
			// Get tasks that were marked as 'done' within the last 24 hours
			const tasks = await getTasks({ status: 'done', updatedAtStart });
			todayTasks = tasks;
			generate();
		} catch (error) {
			console.error('Failed to load today data:', error);
		} finally {
			isLoading = false;
		}
	}

	function generate() {
		if (todayTasks.length === 0) {
			generatedText = '';
			return;
		}

		const assigneePrefix = $_('dailyReflect__assignee_prefix');
		const taskStrings = todayTasks.map(t => {
			let str = `✅ ${t.title}`;
			if (t.assignee?.name) {
				str += ` ${assigneePrefix} ${t.assignee.name}`;
			}
			if (t.category && t.category !== 'อื่นๆ' && t.category !== 'Other' && t.category !== 'อื่นๆ (Other)') {
				str += ` - ${t.category}`;
			}
			return str;
		});

		const randomIndex = Math.floor(Math.random() * templateKeys.length);
		const key = templateKeys[randomIndex];
		
		const values = {
			tasks: taskStrings.join(', '),
			bulletTasks: taskStrings.map(t => `• ${t}`).join('\n'),
			tasksList: taskStrings.join('\n- '),
			count: todayTasks.length,
			date: new Date().toLocaleDateString()
		};

		generatedText = $_(key, { values });
	}

	function copyToClipboard() {
		if (!generatedText) return;
		navigator.clipboard.writeText(generatedText);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 2000);
	}

	$: if (show) {
		loadTodayData();
	}
</script>

{#if show}
	<div 
		class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
		transition:fade={{ duration: 200 }}
		on:mousedown|self={() => (show = false)}
	>
		<div 
			class="relative w-full max-w-lg bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/50 overflow-hidden"
			transition:scale={{ duration: 300, start: 0.9, opacity: 0 }}
		>
			<!-- Premium Header with Gradient -->
			<div class="relative px-6 py-6 overflow-hidden">
				<div class="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent pointer-events-none"></div>
				<div class="relative flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div class="p-3 bg-gradient-to-br from-primary to-blue-600 rounded-2xl text-white shadow-lg shadow-primary/20">
							<MessageSquareQuote size={24} />
						</div>
						<div>
							<h2 class="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{$_('dailyReflect__title')}</h2>
							<p class="text-sm text-gray-500 dark:text-gray-400 font-medium">{$_('dailyReflect__subtitle')}</p>
						</div>
					</div>
					<button 
						on:click={() => (show = false)}
						class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors group"
					>
						<X size={24} class="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200" />
					</button>
				</div>
			</div>

			<div class="px-6 pb-6 space-y-6">
				{#if isLoading}
					<div class="flex flex-col items-center justify-center py-16 gap-4">
						<div class="relative">
							<RefreshCcw class="animate-spin text-primary" size={48} />
							<div class="absolute inset-0 animate-ping opacity-25 bg-primary rounded-full"></div>
						</div>
						<p class="text-gray-500 font-medium animate-pulse">{$_('layout__loading_db')}</p>
					</div>
				{:else if todayTasks.length === 0}
					<div class="text-center py-12 px-4 bg-gray-50/50 dark:bg-gray-800/30 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
						<div class="mx-auto w-20 h-20 bg-white dark:bg-gray-800 rounded-2xl shadow-sm flex items-center justify-center mb-6 text-gray-300">
							<CheckCircle2 size={40} />
						</div>
						<h3 class="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">{$_('dailyReflect__no_data_title')}</h3>
						<p class="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">{$_('dailyReflect__no_data')}</p>
					</div>
				{:else}
					<div class="space-y-6" in:fly={{ y: 20, duration: 400 }}>
						<!-- Stats Summary Card (Task count only) -->
						<div class="w-full group p-6 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 transition-all hover:shadow-lg hover:shadow-emerald-500/5">
							<div class="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
								<CheckCircle2 size={20} />
								<span class="text-xs font-bold uppercase tracking-[0.2em]">{$_('dailyReflect__tasks_section')}</span>
							</div>
							<div class="flex items-baseline gap-2">
								<p class="text-4xl font-black text-emerald-700 dark:text-emerald-300">{todayTasks.length}</p>
								<span class="text-sm text-emerald-600/60 font-medium">{$_('dailyReflect__tasks_unit')}</span>
							</div>
						</div>

						<!-- Generated Output Area -->
						<div class="space-y-3">
							<div class="flex items-center justify-between px-1">
								<label class="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
									<MessageSquareQuote size={18} class="text-primary" />
									{$_('dailyReflect__generated_text')}
								</label>
								<button 
									on:click={() => { generate(); }}
									class="group flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 rounded-full transition-all active:scale-95"
								>
									<RefreshCcw size={14} class="group-hover:rotate-180 transition-transform duration-500" />
									{$_('dailyReflect__btn_refresh')}
								</button>
							</div>
							
							<div class="relative group">
								<div class="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
								<div class="relative">
									<textarea 
										bind:value={generatedText}
										readonly
										rows="6"
										class="w-full p-5 bg-gray-50/80 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-800 dark:text-gray-200 font-medium leading-relaxed resize-none focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all shadow-inner"
									></textarea>
																		<button 
											on:click={copyToClipboard}
											disabled={!generatedText}
											class="absolute bottom-3 right-3 p-2.5 rounded-xl transition-all active:scale-90 disabled:opacity-50 {copied ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-primary hover:text-white hover:shadow-lg hover:shadow-primary/20'}"
											title={$_('dailyReflect__btn_copy')}
										>
											{#if copied}
												<div in:scale={{ duration: 200, start: 0.5 }}>
													<CheckCircle2 size={20} />
												</div>
											{:else}
												<ClipboardCopy size={20} />
											{/if}
										</button>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Fancy Footer Section -->
			<div class="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/30 dark:to-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex justify-center">
				<div class="text-[10px] items-center flex gap-1.5 text-gray-400 dark:text-gray-500 font-black uppercase tracking-[0.2em]">
					<div class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
					Perfect for your morning standup report
					<div class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	textarea {
		scrollbar-width: thin;
		scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
	}
	textarea::-webkit-scrollbar {
		width: 6px;
	}
	textarea::-webkit-scrollbar-thumb {
		background-color: rgba(156, 163, 175, 0.5);
		border-radius: 10px;
	}
</style>
