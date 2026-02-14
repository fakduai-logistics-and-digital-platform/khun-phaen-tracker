<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Play, Pause, RotateCcw, Timer, HelpCircle, Bookmark, Save, History, PenTool, FileText } from 'lucide-svelte';
	import { showKeyboardShortcuts } from '$lib/stores/keyboardShortcuts';
	import { timeLogs, formatDuration } from '$lib/stores/timeLogs';
	import { createEventDispatcher } from 'svelte';
	import { _ } from 'svelte-i18n';

	const dispatch = createEventDispatcher<{
		showBookmarks: void;
		showWhiteboard: void;
		showQuickNotes: void;
	}>();

	let elapsed = 0;
	let isRunning = false;
	let interval: ReturnType<typeof setInterval> | null = null;
	let isExpanded = false;
	let isVisible = false;
	let expandTimeout: ReturnType<typeof setTimeout> | null = null;
	let hideTimeout: ReturnType<typeof setTimeout> | null = null;
	let showSaveDialog = false;
	let saveNote = '';
	let showLogs = false;

	function formatTime(totalSeconds: number): string {
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		
		if (hours > 0) {
			return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
		}
		return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	}

	function start() {
		if (isRunning) return;
		isRunning = true;
		interval = setInterval(() => {
			elapsed++;
		}, 1000);
	}

	function pause() {
		isRunning = false;
		if (interval) {
			clearInterval(interval);
			interval = null;
		}
	}

	function stop() {
		pause();
		elapsed = 0;
	}

	function saveTime() {
		if (elapsed > 0) {
			timeLogs.add(elapsed, saveNote);
			saveNote = '';
			showSaveDialog = false;
		}
	}

	function handleBeforeUnload(event: BeforeUnloadEvent) {
		if (elapsed > 0) {
			event.preventDefault();
			event.returnValue = 'มีการจับเวลาอยู่ คุณต้องการออกจากหน้านี้จริงหรือไม่?';
			return event.returnValue;
		}
	}

	function handleMouseEnter() {
		if (expandTimeout) {
			clearTimeout(expandTimeout);
			expandTimeout = null;
		}
		if (hideTimeout) {
			clearTimeout(hideTimeout);
			hideTimeout = null;
		}
		isExpanded = true;
		requestAnimationFrame(() => {
			isVisible = true;
		});
	}

	function handleMouseLeave() {
		expandTimeout = setTimeout(() => {
			isVisible = false;
			hideTimeout = setTimeout(() => {
				isExpanded = false;
				showSaveDialog = false;
				saveNote = '';
			}, 200);
		}, 100);
	}

	function openHelp() {
		showKeyboardShortcuts.set(true);
	}

	function openBookmarks() {
		dispatch('showBookmarks');
	}

	function openWhiteboard() {
		dispatch('showWhiteboard');
	}

	function openQuickNotes() {
		dispatch('showQuickNotes');
	}

	function toggleLogs() {
		showLogs = !showLogs;
	}

	onMount(() => {
		window.addEventListener('beforeunload', handleBeforeUnload);
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
		if (expandTimeout) clearTimeout(expandTimeout);
		if (hideTimeout) clearTimeout(hideTimeout);
		window.removeEventListener('beforeunload', handleBeforeUnload);
	});
</script>

<!-- Floating Buttons Container -->
<div class="fixed bottom-4 right-4 z-50 flex items-end gap-2">
	<!-- Quick Notes Button -->
	<button
		on:click={openQuickNotes}
		class="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-all duration-200 hover:scale-105"
		title={$_('quickNotes__title')}
	>
		<FileText size={18} />
	</button>

	<!-- Bookmarks Button -->
	<button
		on:click={openBookmarks}
		class="flex items-center justify-center w-10 h-10 rounded-full bg-primary hover:bg-primary-dark text-white shadow-lg transition-all duration-200 hover:scale-105"
		title="ที่คั่นลิงก์"
	>
		<Bookmark size={18} />
	</button>

	<!-- Whiteboard Button -->
	<button
		on:click={openWhiteboard}
		class="flex items-center justify-center w-10 h-10 rounded-full bg-sky-600 hover:bg-sky-500 text-white shadow-lg transition-all duration-200 hover:scale-105"
		title="Whiteboard"
	>
		<PenTool size={18} />
	</button>

	<!-- Timer Wrapper -->
	<div class="relative">
		<!-- Timer Container -->
		<div
			class="flex flex-col items-end"
			on:mouseenter={handleMouseEnter}
			on:mouseleave={handleMouseLeave}
			role="group"
		>
			<!-- Top Controls (Above Timer) - Absolute positioned -->
			{#if isExpanded}
				<div class="absolute bottom-full mb-2 right-0 flex items-center gap-1 transition-all duration-300 ease-out {isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}">
					<!-- Logs Button -->
					<button
						on:click={toggleLogs}
						class="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 text-white/70 hover:text-white hover:bg-slate-700 transition-all duration-200 hover:scale-110 {$timeLogs.length > 0 ? 'ring-2 ring-primary/50' : ''}"
						title="ประวัติการบันทึก"
					>
						<History size={14} />
					</button>

					<!-- Save Button -->
					{#if elapsed > 0}
						<button
							on:click={() => showSaveDialog = !showSaveDialog}
							class="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white hover:bg-primary-dark transition-all duration-200 hover:scale-110"
							title="บันทึกเวลา"
						>
							<Save size={14} />
						</button>
					{/if}

					<!-- Reset Button -->
					{#if elapsed > 0}
						<button
							on:click={stop}
							class="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 text-white/70 hover:text-white hover:bg-slate-700 transition-all duration-200 hover:scale-110"
							title="รีเซ็ต"
						>
							<RotateCcw size={14} />
						</button>
					{/if}

					<!-- Play/Pause Button (Red) -->
					{#if isRunning}
						<button
							on:click={pause}
							class="flex items-center justify-center w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg transition-all duration-200 hover:scale-110"
							title="หยุด"
						>
							<Pause size={18} fill="currentColor" />
						</button>
					{:else}
						<button
							on:click={start}
							class="flex items-center justify-center w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg transition-all duration-200 hover:scale-110"
							title={elapsed > 0 ? 'ต่อ' : 'เริ่ม'}
						>
							<Play size={18} fill="currentColor" />
						</button>
					{/if}
				</div>
			{/if}

			<!-- Save Dialog (Top) -->
			{#if isExpanded && elapsed > 0 && showSaveDialog}
				<div class="absolute bottom-full mb-2 right-0 transition-all duration-300 ease-out {isVisible && showSaveDialog ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95 pointer-events-none'}">
					<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 w-64">
						<p class="text-xs text-gray-500 dark:text-gray-400 mb-2">บันทึกเวลา {formatTime(elapsed)}</p>
						<input
							type="text"
							bind:value={saveNote}
							placeholder="หมายเหตุ (optional)..."
							class="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-gray-700 dark:text-white mb-2 transition-all"
							on:keydown={(e) => e.key === 'Enter' && saveTime()}
						/>
						<div class="flex gap-2">
							<button
								on:click={saveTime}
								class="flex-1 px-3 py-1.5 text-xs font-medium bg-primary hover:bg-primary-dark text-white rounded transition-colors hover:scale-105 active:scale-95"
							>
								บันทึก
							</button>
							<button
								on:click={() => showSaveDialog = false}
								class="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
							>
								ยกเลิก
							</button>
						</div>
					</div>
				</div>
			{/if}

			<!-- Logs Popup (Top) -->
			{#if isExpanded && showLogs}
				<div class="absolute bottom-full mb-2 right-0 transition-all duration-300 ease-out {isVisible && showLogs ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95 pointer-events-none'}">
					<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 w-72 max-h-64 overflow-y-auto">
						<div class="flex items-center justify-between mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
							<p class="text-sm font-medium text-gray-900 dark:text-white">ประวัติการบันทึก</p>
							<button
								on:click={() => showLogs = false}
								class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors hover:scale-110"
							>
								×
							</button>
						</div>
						{#if $timeLogs.length === 0}
							<p class="text-xs text-gray-500 text-center py-4">ยังไม่มีการบันทึก</p>
						{:else}
							<div class="space-y-2">
								{#each [...$timeLogs].reverse().slice(0, 10) as log}
									<div class="flex items-center justify-between text-xs py-1 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded px-1">
										<div class="flex-1 min-w-0">
											<span class="font-mono font-medium text-primary">{formatDuration(log.duration)}</span>
											{#if log.note}
												<p class="text-gray-500 dark:text-gray-400 truncate">{log.note}</p>
											{/if}
											<p class="text-gray-400 text-[10px]">{new Date(log.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</p>
										</div>
										<button
											on:click={() => timeLogs.remove(log.id)}
											class="ml-2 text-gray-400 hover:text-red-500 transition-colors hover:scale-110"
										>
											×
										</button>
									</div>
								{/each}
							</div>
							{#if $timeLogs.length > 10}
								<p class="text-xs text-gray-400 text-center mt-2">+ {$timeLogs.length - 10} รายการอื่น</p>
							{/if}
						{/if}
					</div>
				</div>
			{/if}

			<!-- Main Timer Button -->
			<button
				class="flex items-center gap-2 px-3 py-2 rounded-full shadow-lg transition-all duration-300 hover:scale-105 {isRunning ? 'bg-red-600' : 'bg-slate-800'}"
			>
				{#if isRunning}
					<span class="relative flex h-2 w-2">
						<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
						<span class="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
					</span>
				{:else}
					<Timer size={16} class="text-white" />
				{/if}
				
				<span class="font-mono text-sm font-semibold text-white tabular-nums tracking-wide">
					{formatTime(elapsed)}
				</span>
			</button>
		</div>
	</div>

	<!-- Help Button -->
	<button
		on:click={openHelp}
		class="flex items-center justify-center w-10 h-10 rounded-full bg-slate-800 text-white/70 hover:text-white hover:bg-slate-700 shadow-lg transition-all duration-200 hover:scale-105"
		title="คีย์ลัด (?)"
	>
		<HelpCircle size={18} />
	</button>
</div>
