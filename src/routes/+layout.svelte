<script lang="ts">
	import '../app.css';
	import { changeLocale, locale } from '$lib/i18n';
	import { initDB } from '$lib/db';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { Sun, Moon, Github, Calendar, Clock, Globe, Users } from 'lucide-svelte';
	import { theme } from '$lib/stores/theme';
	import favicon from '$lib/assets/favicon.svg';
	import DevTimer from '$lib/components/DevTimer.svelte';
	import BookmarkManager from '$lib/components/BookmarkManager.svelte';
	import WhiteboardModal from '$lib/components/WhiteboardModal.svelte';
	import QuickNotes from '$lib/components/QuickNotes.svelte';
	import ProfileModal from '$lib/components/ProfileModal.svelte';
	import { _ } from 'svelte-i18n';
	import { initAuth, user, authLoading } from '$lib/stores/auth';
	import { LogIn, LogOut, User as UserIcon, Settings } from 'lucide-svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { api } from '$lib/apis';

	import { clearWorkspaceId } from '$lib/stores/workspace';

	let loading = true;
	let error = '';
	let currentTime = new Date();
	let timeInterval: ReturnType<typeof setInterval>;
	let showBookmarkManager = false;
	let showWhiteboard = false;
	let showQuickNotes = false;
	let showLanguageDropdown = false;
	let showAccountDropdown = false;
	let showProfileModal = false;
	let whiteboardMessage = '';
	let whiteboardMessageType: 'success' | 'error' = 'success';
	let githubStars = '...';

	async function fetchGithubStars() {
		try {
			const res = await fetch('https://api.github.com/repos/fakduai-logistics-and-digital-platform/khun-phaen-tracker');
			const data = await res.json();
			if (data.stargazers_count !== undefined) {
				githubStars = data.stargazers_count.toLocaleString();
			} else {
				githubStars = '0';
			}
		} catch (e) {
			console.error('Failed to fetch stars:', e);
			githubStars = '0';
		}
	}

	function handleOpenUtilityModal(event: Event) {
		const customEvent = event as CustomEvent<{ kind?: string }>;
		const kind = customEvent.detail?.kind;
		if (kind === 'bookmark') {
			showBookmarkManager = true;
			return;
		}
		if (kind === 'whiteboard') {
			showWhiteboard = true;
			return;
		}
		if (kind === 'quick-notes') {
			showQuickNotes = true;
		}
	}

	onMount(async () => {
		try {
			await Promise.all([
				initDB(),
				initAuth()
			]);
			loading = false;
		} catch (e) {
			error = $_('layout__db_error');
			loading = false;
		}
		
		// Update time every second
		timeInterval = setInterval(() => {
			currentTime = new Date();
		}, 1000);

		document.addEventListener('open-utility-modal', handleOpenUtilityModal);
		
		fetchGithubStars();
	});
	
	onDestroy(() => {
		if (timeInterval) clearInterval(timeInterval);
		if (browser) {
			document.removeEventListener('open-utility-modal', handleOpenUtilityModal);
		}
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

	function showToast(message: string, type: 'success' | 'error' = 'success') {
		whiteboardMessage = message;
		whiteboardMessageType = type;
		setTimeout(() => {
			whiteboardMessage = '';
		}, 2500);
	}

	async function handleLogout() {
		try {
			await api.auth.logout();
			
			// Clear cookie on client side
			document.cookie = '_khun_ph_token=; path=/; max-age=0; samesite=Lax';
			localStorage.removeItem('user_email');
			localStorage.removeItem('sync-room-code');
			localStorage.removeItem('sync-server-url');
			clearWorkspaceId();
			
			user.set(null);
			goto(`${base}/login`);
		} catch (e) {
			console.error('Logout failed:', e);
		}
	}

	$: isAuthPage = $page.url.pathname.includes('/login') || $page.url.pathname.includes('/create-account') || $page.url.pathname.includes('/setup-password');
	$: isDashboard = $page.url.pathname.includes('/dashboard');
	$: isWorkspacePage = $page.url.pathname.includes('/workspace/');
	$: isUsersPage = $page.url.pathname.includes('/settings/users');
	$: containerWidth = (isDashboard || isWorkspacePage) ? 'w-full max-w-full px-4 sm:px-8' : 'max-w-7xl px-4 sm:px-6 lg:px-8';
	
	$: if (!$authLoading && browser) {
		if (!$user && !isAuthPage) {
			goto(`${base}/login`);
		} else if ($user && !isAuthPage && !isDashboard) {
			// Check if trying to access main app without a room
			const urlParams = new URLSearchParams(window.location.search);
			const urlRoom = urlParams.get('room');
			const savedRoom = localStorage.getItem('sync-room-code');
			
			if (!urlRoom && isWorkspacePage) {
				goto(`${base}/dashboard`);
			}
		}
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
	{:else if isAuthPage}
		<main class="w-full h-screen overflow-hidden">
			<slot />
		</main>
	{:else}
		<header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-999 transition-colors">
			<div class="{containerWidth} mx-auto">
				<div class="flex items-center justify-between h-16">
					<div class="flex items-center gap-2 sm:gap-4">
						<a 
							href="{base}/dashboard" 
							class="flex items-center gap-2.5 sm:gap-3 group transition-all"
						>
							<div class="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/10 rounded-xl group-hover:scale-105 group-active:scale-95 transition-all ring-1 ring-indigo-500/20 shadow-sm">
								<img src={favicon} alt="Khun Phaen Logo" class="w-6 h-6 object-contain" />
							</div>
							<div class="hidden sm:block">
								<h1 class="text-lg font-black text-gray-900 dark:text-white tracking-tight leading-none group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{$_('layout__app_name')}</h1>
								<p class="text-[10px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5 opacity-80 font-medium">{$_('layout__app_subtitle')}</p>
							</div>
						</a>

						<div class="hidden sm:block h-6 w-[1px] bg-gray-200 dark:bg-gray-700 mx-1"></div>

						<!-- SaaS Style GitHub Badge -->
						<a
							href="https://github.com/fakduai-logistics-and-digital-platform/khun-phaen-tracker"
							target="_blank"
							rel="noopener noreferrer"
							class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-white transition-all text-xs font-bold border border-gray-200 dark:border-gray-700 group/github shadow-sm backdrop-blur-md"
						>
							<Github size={14} class="group-hover/github:rotate-12 transition-transform" />
							<span>{$_('layout__github')}</span>
							<div class="flex items-center gap-1.5 pl-2 ml-1 border-l border-gray-200 dark:border-gray-600">
								<div class="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-500/10 dark:bg-indigo-500/20 text-[10px] text-indigo-600 dark:text-indigo-400 font-black">
									<span class="text-xs text-amber-500 leading-none">★</span>
									{githubStars}
								</div>
							</div>
						</a>
						
						<!-- Mobile GitHub Icon Only -->
						<a
							href="https://github.com/fakduai-logistics-and-digital-platform/khun-phaen-tracker"
							target="_blank"
							rel="noopener noreferrer"
							class="flex sm:hidden p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
						>
							<Github size={20} />
						</a>
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

						<!-- Admin User Management Link -->
						{#if $user?.role === 'admin'}
							<a
								href="{base}/settings/users"
								class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
								title="User Management"
							>
								<Users size={20} />
							</a>
						{/if}

						<!-- Auth Profile Section -->
						{#if $user}
							<div class="flex items-center gap-4 border-l border-gray-200 dark:border-gray-700 pl-4 h-10">
								<div class="relative">
									<button
										type="button"
										on:click={() => showAccountDropdown = !showAccountDropdown}
										class="flex items-center group transition-transform active:scale-95"
										title="Account Settings"
									>
										<!-- Perfect Geometric Avatar -->
										<div class="relative">
											<div class="w-9 h-9 rounded-full border-2 border-indigo-500 bg-white dark:bg-gray-800 flex items-center justify-center overflow-hidden transition-colors">
												<span class="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter">
													{($user.profile?.nickname || $user.email.split('@')[0])[0]}
												</span>
											</div>

											<!-- Consistent Status Dot -->
											<div class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center">
												<div class="w-2 h-2 bg-green-500 rounded-full"></div>
											</div>
										</div>
									</button>

									{#if showAccountDropdown}
										<!-- svelte-ignore a11y-click-events-have-key-events -->
										<!-- svelte-ignore a11y-no-static-element-interactions -->
										<div 
											class="fixed inset-0 z-20"
											on:click={() => showAccountDropdown = false}
										></div>
										
										<div class="absolute right-0 top-full mt-3 w-60 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 py-2.5 z-30 animate-in fade-in zoom-in-95 duration-200 origin-top-right ring-1 ring-black/5 dark:ring-white/5">
											<!-- Dropdown Header (Matches the style in the reference image) -->
											<div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 mb-1.5">
												<div class="flex items-center gap-3">
													<div class="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm ring-2 ring-indigo-500/10">
														{($user.profile?.nickname || $user.email.split('@')[0])[0]}
													</div>
													<div class="flex flex-col overflow-hidden">
														<span class="text-sm font-bold text-gray-900 dark:text-white truncate">
															{$user.profile?.nickname || $user.email.split('@')[0]}
														</span>
														<span class="text-[10px] font-extrabold uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mt-0.5">
															{$user.role}
														</span>
													</div>
												</div>
											</div>

											<div class="px-2 space-y-0.5">
												<button
													class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors group/item text-left"
													on:click={() => {
														showAccountDropdown = false;
														showProfileModal = true;
													}}
												>
													<div class="p-1.5 rounded-lg bg-gray-50 dark:bg-gray-900 group-hover/item:bg-white dark:group-hover/item:bg-gray-800 transition-colors">
														<Settings size={14} class="text-gray-500 group-hover/item:text-indigo-500 transition-colors" />
													</div>
													<span class="font-medium">{$_('layout__profile_settings')}</span>
												</button>

												<button
													on:click={() => {
														showAccountDropdown = false;
														handleLogout();
													}}
													class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group/logout"
												>
													<div class="p-1.5 rounded-lg bg-red-50/50 dark:bg-red-900/10 group-hover/logout:bg-red-100 dark:group-hover/logout:bg-red-900/20 transition-colors">
														<LogOut size={14} class="text-red-500" />
													</div>
													<span class="font-medium">{$_('layout__logout')}</span>
												</button>
											</div>

											<div class="px-4 py-2 mt-1 border-t border-gray-100 dark:border-gray-700/50">
												<p class="text-[10px] text-gray-400 dark:text-gray-500 truncate">
													{$user.email}
												</p>
											</div>
										</div>
									{/if}
								</div>
							</div>
						{:else if !isAuthPage && !$authLoading}
							<a 
								href="{base}/login"
								class="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20 ring-1 ring-indigo-500/50"
							>
								<LogIn size={18} />
								Login
							</a>
						{/if}
					</div>
				</div>
			</div>
		</header>

		<main class="{containerWidth} mx-auto py-6 flex-1">
			<slot />
		</main>

		{#if whiteboardMessage}
			<div class="fixed top-20 right-4 z-110 animate-fade-in">
				<div class="{whiteboardMessageType === 'success' ? 'bg-success' : 'bg-danger'} text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium">
					{whiteboardMessage}
				</div>
			</div>
		{/if}

		<!-- Dev Timer - Fixed Bottom Right -->
		{#if !isDashboard && !isUsersPage}
			<DevTimer 
				on:showBookmarks={() => showBookmarkManager = true}
				on:showWhiteboard={() => showWhiteboard = true}
				on:showQuickNotes={() => showQuickNotes = true}
			/>
		{/if}
		
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
				<div class="flex items-center justify-center">
					<p class="text-sm text-gray-500 dark:text-gray-400">
						{$_('layout__footer_copyright', { values: { year: new Date().getFullYear() } })}
					</p>
				</div>
			</div>
		</footer>

		{#if showWhiteboard}
			<WhiteboardModal
				open={showWhiteboard}
				on:close={() => showWhiteboard = false}
				on:notify={(event) => showToast(event.detail.message, event.detail.type)}
			/>
		{/if}

		{#if showProfileModal}
			<ProfileModal
				open={showProfileModal}
				on:close={() => showProfileModal = false}
				on:notify={(event) => showToast(event.detail.message, event.detail.type)}
			/>
		{/if}
	{/if}
</div>
