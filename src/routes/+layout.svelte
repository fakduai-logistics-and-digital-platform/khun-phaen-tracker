<script lang="ts">
	import '../app.css';
	import { changeLocale, locale } from '$lib/i18n';
	import { initDB } from '$lib/db';
	import { onMount, onDestroy } from 'svelte';
	import { CheckSquare, Sun, Moon, Github, Calendar, Clock, Globe } from 'lucide-svelte';
	import { theme } from '$lib/stores/theme';
	import favicon from '$lib/assets/favicon.svg';
	import DevTimer from '$lib/components/DevTimer.svelte';
	import BookmarkManager from '$lib/components/BookmarkManager.svelte';
	import WhiteboardModal from '$lib/components/WhiteboardModal.svelte';
	import QuickNotes from '$lib/components/QuickNotes.svelte';
	import { _ } from 'svelte-i18n';

	let loading = true;
	let error = '';
	let currentTime = new Date();
	let timeInterval: ReturnType<typeof setInterval>;
	let showBookmarkManager = false;
	let showWhiteboard = false;
	let showQuickNotes = false;
	let showLanguageDropdown = false;
	let whiteboardMessage = '';
	let whiteboardMessageType: 'success' | 'error' = 'success';

	onMount(async () => {
		try {
			await initDB();
			loading = false;
		} catch (e) {
			error = $_('layout__db_error');
			loading = false;
		}
		
		// Update time every second
		timeInterval = setInterval(() => {
			currentTime = new Date();
		}, 1000);
	});
	
	onDestroy(() => {
		if (timeInterval) clearInterval(timeInterval);
	});

	function toggleTheme() {
		theme.toggle();
	}
	
	// Format date based on locale
	function formatDate(date: Date): string {
		if ($locale === 'th') {
			const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
			const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 
							'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
			
			const dayName = days[date.getDay()];
			const day = date.getDate();
			const month = months[date.getMonth()];
			const year = date.getFullYear() + 543; // Buddhist year
			
			return `วัน${dayName}ที่ ${day} ${month} พ.ศ. ${year}`;
		}
		
		return new Intl.DateTimeFormat('en-US', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		}).format(date);
	}
	
	// Format time based on locale
	function formatTime(date: Date): string {
		return date.toLocaleTimeString($locale === 'th' ? 'th-TH' : 'en-US', { 
			hour: '2-digit', 
			minute: '2-digit', 
			second: '2-digit',
			hour12: false 
		});
	}

	function showWhiteboardToast(message: string, type: 'success' | 'error' = 'success') {
		whiteboardMessage = message;
		whiteboardMessageType = type;
		setTimeout(() => {
			whiteboardMessage = '';
		}, 2500);
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} type="image/svg+xml" />
</svelte:head>

<div class="app-surface min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors flex flex-col">
	{#if loading}
		<div class="fixed inset-0 bg-white dark:bg-gray-900 flex flex-col items-center justify-center z-50 transition-colors">
			<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
			<p class="text-gray-600 dark:text-gray-400">{$_('layout__loading_db')}</p>
			<p class="text-sm text-gray-400 dark:text-gray-500 mt-2">{$_('layout__loading_first_time')}</p>
		</div>
	{:else if error}
		<div class="fixed inset-0 bg-white dark:bg-gray-900 flex flex-col items-center justify-center z-50 p-4 text-center transition-colors">
			<div class="text-danger mb-4">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="12" y1="8" x2="12" y2="12"></line>
					<line x1="12" y1="16" x2="12.01" y2="16"></line>
				</svg>
			</div>
			<p class="text-gray-800 dark:text-gray-200 font-medium mb-2">{error}</p>
			<button
				on:click={() => window.location.reload()}
				class="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
			>
				{$_('layout__refresh_page')}
			</button>
		</div>
	{:else}
		<header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 transition-colors">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div class="flex items-center justify-between h-16">
					<div class="flex items-center gap-3">
						<div class="p-2 bg-primary/10 rounded-lg">
							<CheckSquare class="text-primary" size={24} />
						</div>
						<div>
							<h1 class="text-xl font-bold text-gray-900 dark:text-white">{$_('layout__app_name')}</h1>
							<p class="text-xs text-gray-500 dark:text-gray-400">{$_('layout__app_subtitle')}</p>
						</div>
					</div>
					<div class="flex items-center gap-4">
						<!-- DateTime Pill -->
						<div class="hidden sm:inline-flex items-center gap-2 bg-slate-800 dark:bg-slate-700 px-2.5 py-1 rounded-md">
							<span class="text-[11px] text-slate-300 leading-none">
								{formatDate(currentTime)}
							</span>
							<span class="text-slate-500 text-[10px]">|</span>
							<span class="font-mono text-[11px] text-white tabular-nums leading-none">
								{formatTime(currentTime)}
							</span>
						</div>
						
						<!-- Language Switcher -->
						<div class="relative">
							<button
								type="button"
								on:click={() => showLanguageDropdown = !showLanguageDropdown}
								class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
								title={$_('layout__change_language')}
							>
								<Globe size={20} />
								<span class="text-xs font-medium uppercase">{$locale}</span>
							</button>

							{#if showLanguageDropdown}
								<!-- svelte-ignore a11y-click-events-have-key-events -->
								<div 
									class="fixed inset-0 z-10"
									role="presentation"
									on:click={() => showLanguageDropdown = false}
								></div>
								<div class="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20 animate-fade-in">
									<button
										class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 {$locale === 'th' ? 'text-primary font-medium' : ''}"
										on:click={() => {
											changeLocale('th');
											showLanguageDropdown = false;
										}}
									>
										<span>🇹🇭</span> ไทย
									</button>
									<button
										class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 {$locale === 'en' ? 'text-primary font-medium' : ''}"
										on:click={() => {
											changeLocale('en');
											showLanguageDropdown = false;
										}}
									>
										<span>🇺🇸</span> English
									</button>
								</div>
							{/if}
						</div>

						<!-- Theme Toggle -->
						<button
							on:click={toggleTheme}
							class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
							title={$_('layout__change_theme')}
						>
							{#if $theme === 'light'}
								<Sun size={20} />
							{:else}
								<Moon size={20} />
							{/if}
						</button>
						<div class="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
							{$_('layout__local_storage')}
						</div>
					</div>
				</div>
			</div>
		</header>

		<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
			<slot />
		</main>

		{#if whiteboardMessage}
			<div class="fixed top-20 right-4 z-[110] animate-fade-in">
				<div class="{whiteboardMessageType === 'success' ? 'bg-success' : 'bg-danger'} text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium">
					{whiteboardMessage}
				</div>
			</div>
		{/if}

		<!-- Dev Timer - Fixed Bottom Right -->
		<DevTimer 
			on:showBookmarks={() => showBookmarkManager = true}
			on:showWhiteboard={() => showWhiteboard = true}
			on:showQuickNotes={() => showQuickNotes = true}
		/>
		
		<!-- Bookmark Manager Modal -->
		{#if showBookmarkManager}
			<BookmarkManager on:close={() => showBookmarkManager = false} />
		{/if}

		<!-- Quick Notes Modal -->
		{#if showQuickNotes}
			<QuickNotes on:close={() => showQuickNotes = false} />
		{/if}

		<!-- Spacer for fixed timer -->
		<div class="h-10"></div>

		<footer class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-6 transition-colors">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div class="flex flex-col sm:flex-row items-center justify-between gap-4">
					<p class="text-sm text-gray-500 dark:text-gray-400">
						{$_('layout__footer_copyright', { values: { year: new Date().getFullYear() } })}
					</p>
					<a
						href="https://github.com/watchakorn-18k/khun-phaen-tracker-offline"
						target="_blank"
						rel="noopener noreferrer"
						class="text-sm text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors flex items-center gap-2"
					>
						<Github size={20} class="fill-current" />
						<span>{$_('layout__github')}</span>
					</a>
				</div>
			</div>
		</footer>
	{/if}
</div>

{#if showWhiteboard}
	<WhiteboardModal
		open={showWhiteboard}
		on:close={() => showWhiteboard = false}
		on:notify={(event) => showWhiteboardToast(event.detail.message, event.detail.type)}
	/>
{/if}
