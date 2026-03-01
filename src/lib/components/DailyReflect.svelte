<script lang="ts">
	import { _ } from '$lib/i18n';
	import { CheckCircle2, Clock, ClipboardCopy, RefreshCcw, X, MessageSquareQuote, Settings, Send, Save, AlertCircle } from 'lucide-svelte';
	import { fade, scale, fly, slide } from 'svelte/transition';
	import logoUrl from '$lib/assets/logo.png';
	import { timeLogs, formatDuration } from '$lib/stores/timeLogs';
	import type { Task } from '$lib/types';
	import { getTasks } from '$lib/db';
	import { browser } from '$app/environment';

	export let show = false;

	let todayTasks: Task[] = [];
	let doneTodayTasks: Task[] = [];
	let pendingTasks: Task[] = [];
	let generatedText = '';
	let isLoading = false;
	let copied = false;
	
	// Discord Webhook State
	let webhookUrl = browser ? localStorage.getItem('discordWebhookUrl') || '' : '';
	let showSettings = false;
	let isSending = false;
	let sendSuccess = false;
	let sendError = '';

	async function loadTodayData() {
		isLoading = true;

		try {
			// Get all non-archived tasks
			const allTasks = await getTasks({});

			// Today's date string for comparison (YYYY-MM-DD)
			const now = new Date();
			const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

			// Split into: pending (not done) and done today (updated_at = today)
			pendingTasks = allTasks.filter(t => t.status !== 'done');
			doneTodayTasks = allTasks.filter(t => {
				if (t.status !== 'done') return false;
				if (t.updated_at) {
					const updatedDate = t.updated_at.includes('T')
						? t.updated_at.split('T')[0]
						: t.updated_at.split(' ')[0];
					return updatedDate === todayStr;
				}
				return false;
			});

			todayTasks = [...pendingTasks, ...doneTodayTasks];
			generate();
		} catch (error) {
			console.error('Failed to load today data:', error);
		} finally {
			isLoading = false;
		}
	}

	const statusIcons: Record<string, string> = {
		'done': '✅',
		'todo': '📝',
		'in-progress': '🔄',
		'in-test': '🧪'
	};

	function formatTaskLine(t: Task): string {
		const icon = statusIcons[t.status] || '📌';
		let str = `${icon} ${t.title}`;
		if (t.assignees && t.assignees.length > 0) {
			const names = t.assignees.map(a => a.name).join(', ');
			str += ` ${$_('dailyReflect__assignee_prefix')} ${names}`;
		}
		if (t.category && t.category !== 'อื่นๆ' && t.category !== 'Other' && t.category !== 'อื่นๆ (Other)') {
			str += ` - ${t.category}`;
		}
		if (t.status === 'done' && t.updated_at) {
			const date = new Date(t.updated_at.includes('T') ? t.updated_at : t.updated_at + 'Z');
			const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
			str += ` [${timeStr}]`;
		}
		return str;
	}

	function generate() {
		if (todayTasks.length === 0) {
			generatedText = '';
			return;
		}

		const lines: string[] = [];
		const date = new Date().toLocaleDateString();

		lines.push(`📊 ${$_('dailyReflect__title')} - ${date}`);

		if (doneTodayTasks.length > 0) {
			lines.push('');
			lines.push(`🎯 ${$_('dailyReflect__completed_today_section')} (${doneTodayTasks.length})`);
			doneTodayTasks.forEach(t => lines.push(`• ${formatTaskLine(t)}`));
		}

		if (pendingTasks.length > 0) {
			lines.push('');
			lines.push(`⏳ ${$_('dailyReflect__pending_section')} (${pendingTasks.length})`);
			pendingTasks.forEach(t => lines.push(`• ${formatTaskLine(t)}`));
		}

		generatedText = lines.join('\n');
	}

	function copyToClipboard() {
		if (!generatedText) return;
		navigator.clipboard.writeText(generatedText);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 2000);
	}

	function saveWebhookSettings() {
		if (browser) {
			localStorage.setItem('discordWebhookUrl', webhookUrl);
			showSettings = false;
		}
	}

	async function sendToDiscord() {
		if (!generatedText || !webhookUrl) return;
		
		isSending = true;
		sendError = '';
		try {
			// Vibrant Violet Color for a premium feel
			const color = parseInt('8B5CF6', 16);
			const discordFormattedText = generatedText.replace(/\(?(\d{1,2})\/(\d{1,2})\/(\d{4})\)?/g, (_match, month, day, year) => {
				const unix = Math.floor(new Date(Number(year), Number(month) - 1, Number(day)).getTime() / 1000);
				return `<t:${unix}:D>`;
			});

			// Append Discord mentions per task line
			let discordText = discordFormattedText;
			for (const t of todayTasks) {
				const discordIds = t.assignees?.filter(a => a.discord_id).map(a => a.discord_id) || [];
				if (discordIds.length > 0 && t.title) {
					// Find the task line and append mentions at the end of it
					const escapedTitle = t.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
					const icon = statusIcons[t.status] || '📌';
					const escapedIcon = icon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
					const taskLineRegex = new RegExp(`(${escapedIcon}\\s*${escapedTitle}[^\\n]*)`);
					const mentions = discordIds.map(id => `<@${id}>`).join(' ');
					discordText = discordText.replace(taskLineRegex, `$1 ${mentions}`);
				}
			}
			
			const embed = {
				author: {
					name: $_('dailyReflect__title'),
					icon_url: 'attachment://logo.png'
				},
				description: discordText,
				color: color,
				fields: [
					{
						name: "📊 Statistics",
						value: `✅ ${$_('dailyReflect__completed_today_section')}: **${doneTodayTasks.length}**\n⏳ ${$_('dailyReflect__pending_section')}: **${pendingTasks.length}**`,
						inline: true
					},
					{
						name: "🕒 Report Time",
						value: `<t:${Math.floor(Date.now() / 1000)}:f>`,
						inline: true
					},
					{
						name: "📍 Source",
						value: "`Khun Phaen Tracker`",
						inline: true
					}
				],
				footer: {
					text: "Khun Phaen Task Tracker ✨",
					icon_url: 'attachment://logo.png'

				},
				timestamp: new Date().toISOString()
			};

			const logoResponse = await fetch(logoUrl);
			if (!logoResponse.ok) throw new Error('Failed to load logo asset');
			const logoBlob = await logoResponse.blob();

			const formData = new FormData();
			formData.append('payload_json', JSON.stringify({ embeds: [embed] }));
			formData.append('files[0]', logoBlob, 'logo.png');

			const response = await fetch(webhookUrl, {
				method: 'POST',
				body: formData
			});

			if (!response.ok) throw new Error('Failed to send');

			sendSuccess = true;
			setTimeout(() => {
				sendSuccess = false;
			}, 3000);
		} catch (err) {
			console.error('Discord Webhook Error:', err);
			sendError = $_('dailyReflect__send_error');
		} finally {
			isSending = false;
		}
	}

	$: if (show) {
		loadTodayData();
	}
</script>

{#if show}
	<div 
		class="fixed inset-0 z-[20000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
		transition:fade={{ duration: 200 }}
		on:mousedown|self={() => (show = false)}
		on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && (show = false)}
		role="button"
		tabindex="0"
		aria-label={$_('dailyReflect__btn_close')}
	>
		<div 
			class="relative w-full max-w-lg bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/50 overflow-hidden"
			transition:scale={{ duration: 300, start: 0.9, opacity: 0 }}
		>
			<!-- Premium Header with Gradient -->
			<div class="relative px-6 py-6 overflow-hidden">
				<div class="absolute inset-0 bg-linear-to-br from-primary/10 via-secondary/5 to-transparent pointer-events-none"></div>
				<div class="relative flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div class="p-3 bg-linear-to-br from-primary to-blue-600 rounded-2xl text-white shadow-lg shadow-primary/20">
							<MessageSquareQuote size={24} />
						</div>
						<div>
							<h2 class="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{$_('dailyReflect__title')}</h2>
							<p class="text-sm text-gray-500 dark:text-gray-400 font-medium">{$_('dailyReflect__subtitle')}</p>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<button 
							on:click={() => (showSettings = !showSettings)}
							class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-primary"
							title={$_('dailyReflect__settings_title')}
						>
							<Settings size={20} />
						</button>
						<button 
							on:click={() => (show = false)}
							class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors group"
						>
							<X size={24} class="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200" />
						</button>
					</div>
				</div>

				<!-- Settings Panel -->
				{#if showSettings}
					<div class="mt-4 p-4 bg-gray-50/80 dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700" transition:slide>
						<div class="flex flex-col gap-3">
							<div class="flex items-center justify-between">
								<label for="webhook" class="text-xs font-bold uppercase tracking-wider text-gray-500">{$_('dailyReflect__webhook_label')}</label>
								<button on:click={saveWebhookSettings} class="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
									<Save size={12} /> {$_('timer__btn_save')}
								</button>
							</div>
							<input 
								id="webhook"
								type="text" 
								bind:value={webhookUrl}
								placeholder={$_('dailyReflect__webhook_placeholder')}
								class="w-full px-4 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none"
							/>
						</div>
					</div>
				{/if}
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
						<!-- Stats Summary Cards -->
						<div class="grid grid-cols-2 gap-3">
							<div class="group p-4 bg-linear-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 transition-all hover:shadow-lg hover:shadow-emerald-500/5">
								<div class="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
									<CheckCircle2 size={16} />
									<span class="text-[10px] font-bold uppercase tracking-[0.15em]">{$_('dailyReflect__completed_today_section')}</span>
								</div>
								<div class="flex items-baseline gap-1">
									<p class="text-3xl font-black text-emerald-700 dark:text-emerald-300">{doneTodayTasks.length}</p>
									<span class="text-xs text-emerald-600/60 font-medium">{$_('dailyReflect__tasks_unit')}</span>
								</div>
							</div>
							<div class="group p-4 bg-linear-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 rounded-2xl border border-amber-100 dark:border-amber-500/20 transition-all hover:shadow-lg hover:shadow-amber-500/5">
								<div class="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
									<Clock size={16} />
									<span class="text-[10px] font-bold uppercase tracking-[0.15em]">{$_('dailyReflect__pending_section')}</span>
								</div>
								<div class="flex items-baseline gap-1">
									<p class="text-3xl font-black text-amber-700 dark:text-amber-300">{pendingTasks.length}</p>
									<span class="text-xs text-amber-600/60 font-medium">{$_('dailyReflect__pending_unit')}</span>
								</div>
							</div>
						</div>

						<!-- Generated Output Area -->
						<div class="space-y-3">
							<div class="flex items-center justify-between px-1">
								<label class="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
									<MessageSquareQuote size={18} class="text-primary" />
									{$_('dailyReflect__generated_text')}
								</label>
								<div class="flex items-center gap-2">
									{#if sendError}
										<span class="text-[10px] font-bold text-red-500 flex items-center gap-1" in:fade>
											<AlertCircle size={12} /> {sendError}
										</span>
									{/if}
									<button 
										on:click={() => { generate(); }}
										class="group flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 rounded-full transition-all active:scale-95"
									>
										<RefreshCcw size={14} class="group-hover:rotate-180 transition-transform duration-500" />
										{$_('dailyReflect__btn_refresh')}
									</button>
								</div>
							</div>
							
							<div class="relative group">
								<div class="absolute -inset-0.5 bg-linear-to-r from-primary/20 to-secondary/20 rounded-2xl blur opacity-0 group-hover:opacity-10 transition duration-500"></div>
								<div class="relative">
									<textarea
										bind:value={generatedText}
										readonly
										rows="10"
										class="w-full p-5 bg-gray-50/80 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-800 dark:text-gray-200 font-medium leading-relaxed resize-none focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all shadow-inner"
									></textarea>
									
									<button 
										on:click={copyToClipboard}
										disabled={!generatedText}
										class="absolute bottom-3 right-3 p-2.5 rounded-xl transition-all active:scale-90 disabled:opacity-50 {copied ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm text-gray-600 dark:text-gray-300 hover:bg-primary hover:text-white hover:shadow-lg hover:shadow-primary/20 border border-gray-100 dark:border-gray-700'}"
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

							<!-- Discord Send Action Row -->
							<div class="flex flex-col gap-2">
								<button 
									on:click={sendToDiscord}
									disabled={!generatedText || !webhookUrl || isSending}
									class="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale {sendSuccess ? 'bg-emerald-500 text-white' : 'bg-[#5865F2] text-white shadow-xl shadow-[#5865F2]/20 hover:shadow-2xl hover:shadow-[#5865F2]/30 hover:-translate-y-0.5'}"
								>
									{#if isSending}
										<RefreshCcw size={20} class="animate-spin" />
										<span>{$_('layout__stats_syncing')}...</span>
									{:else if sendSuccess}
										<CheckCircle2 size={20} />
										<span>{$_('dailyReflect__send_success')}</span>
									{:else}
										<Send size={20} />
										<span>{$_('dailyReflect__btn_send_discord')}</span>
									{/if}
								</button>
								
								{#if !webhookUrl}
									<p class="text-[10px] text-center text-gray-400 font-medium italic">
										{$_('dailyReflect__webhook_help')}
									</p>
								{/if}
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Fancy Footer Section -->
			<div class="px-6 py-4 bg-linear-to-r from-gray-50 to-gray-100 dark:from-gray-800/30 dark:to-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex justify-center">
				<div class="text-[10px] items-center flex gap-1.5 text-gray-400 dark:text-gray-500 font-black uppercase tracking-[0.2em]">
					<div class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
					{$_('dailyReflect__footer_text')}
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
