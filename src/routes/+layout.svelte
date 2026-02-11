<script lang="ts">
	import '../app.css';
	import { initDB } from '$lib/db';
	import { onMount, onDestroy } from 'svelte';
	import { CheckSquare, Sun, Moon, Github, Calendar, Clock } from 'lucide-svelte';
	import { theme } from '$lib/stores/theme';
	import favicon from '$lib/assets/favicon.svg';
	import DevTimer from '$lib/components/DevTimer.svelte';
	import BookmarkManager from '$lib/components/BookmarkManager.svelte';

	let loading = true;
	let error = '';
	let currentTime = new Date();
	let timeInterval: ReturnType<typeof setInterval>;
	let showBookmarkManager = false;

	onMount(async () => {
		try {
			await initDB();
			loading = false;
		} catch (e) {
			error = 'ไม่สามารถโหลดฐานข้อมูลได้ กรุณารีเฟรชหน้า';
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
	
	// Format date in Thai
	function formatDate(date: Date): string {
		const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
		const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 
						'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
		
		const dayName = days[date.getDay()];
		const day = date.getDate();
		const month = months[date.getMonth()];
		const year = date.getFullYear() + 543; // Buddhist year
		
		return `วัน${dayName}ที่ ${day} ${month} พ.ศ. ${year}`;
	}
	
	// Format time
	function formatTime(date: Date): string {
		return date.toLocaleTimeString('th-TH', { 
			hour: '2-digit', 
			minute: '2-digit', 
			second: '2-digit',
			hour12: false 
		});
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} type="image/svg+xml" />
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors flex flex-col">
	{#if loading}
		<div class="fixed inset-0 bg-white dark:bg-gray-900 flex flex-col items-center justify-center z-50 transition-colors">
			<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
			<p class="text-gray-600 dark:text-gray-400">กำลังโหลดฐานข้อมูล...</p>
			<p class="text-sm text-gray-400 dark:text-gray-500 mt-2">ครั้งแรกอาจใช้เวลาสักครู่</p>
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
				รีเฟรชหน้า
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
							<h1 class="text-xl font-bold text-gray-900 dark:text-white">Khu Phaen</h1>
							<p class="text-xs text-gray-500 dark:text-gray-400">ระบบจัดการงานแบบออฟไลน์</p>
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
						
						<!-- Theme Toggle -->
						<button
							on:click={toggleTheme}
							class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
							title="เปลี่ยนธีม"
						>
							{#if $theme === 'light'}
								<Sun size={20} />
							{:else}
								<Moon size={20} />
							{/if}
						</button>
						<div class="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
							ข้อมูลจัดเก็บในเครื่อง
						</div>
					</div>
				</div>
			</div>
		</header>

		<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
			<slot />
		</main>

		<!-- Dev Timer - Fixed Bottom Right -->
		<DevTimer 
			on:showBookmarks={() => showBookmarkManager = true}
		/>
		
		<!-- Bookmark Manager Modal -->
		{#if showBookmarkManager}
			<BookmarkManager on:close={() => showBookmarkManager = false} />
		{/if}
		
		<!-- Spacer for fixed timer -->
		<div class="h-10"></div>

		<footer class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-6 transition-colors">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div class="flex flex-col sm:flex-row items-center justify-between gap-4">
					<p class="text-sm text-gray-500 dark:text-gray-400">
						© {new Date().getFullYear()} Khu Phaen. All rights reserved.
					</p>
					<a
						href="https://github.com/watchakorn-18k/khun-phaen-tracker-offline"
						target="_blank"
						rel="noopener noreferrer"
						class="text-sm text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors flex items-center gap-2"
					>
						<Github size={20} class="fill-current" />
						<span>GitHub</span>
					</a>
				</div>
			</div>
		</footer>
	{/if}
</div>
