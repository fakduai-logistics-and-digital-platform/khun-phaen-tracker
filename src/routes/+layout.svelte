<script lang="ts">
	import '../app.css';
	import { initDB } from '$lib/db';
	import { onMount } from 'svelte';
	import { CheckSquare, Sun, Moon } from 'lucide-svelte';
	import { theme } from '$lib/stores/theme';
	
	let loading = true;
	let error = '';
	
	onMount(async () => {
		try {
			await initDB();
			loading = false;
		} catch (e) {
			error = 'ไม่สามารถโหลดฐานข้อมูลได้ กรุณารีเฟรชหน้า';
			loading = false;
		}
	});
	
	function toggleTheme() {
		theme.toggle();
	}
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
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
						<!-- Theme Toggle -->
						<button
							on:click={toggleTheme}
							class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
							title="เปลี่ยนธีม"
						>
							{#if $theme === 'dark'}
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
		
		<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
			<slot />
		</main>
	{/if}
</div>
