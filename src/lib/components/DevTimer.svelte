<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { Play, Pause, RotateCcw, Timer, HelpCircle, Bookmark, Save, History, PenTool, FileText, Settings2, Bell, BellOff, X, Check } from 'lucide-svelte';
	import { showKeyboardShortcuts } from '$lib/stores/keyboardShortcuts';
	import { timeLogs, formatDuration } from '$lib/stores/timeLogs';
	import { createEventDispatcher } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { fade, slide, scale } from 'svelte/transition';

	const dispatch = createEventDispatcher<{
		showBookmarks: void;
		showWhiteboard: void;
		showQuickNotes: void;
	}>();

	type TimerMode = 'countup' | 'pomodoro' | 'countdown';
	type PomodoroPhase = 'work' | 'break';

	let elapsed = 0;
	let remaining = 0;
	let initialRemaining = 0; // For progress calculation
	let isRunning = false;
	let interval: ReturnType<typeof setInterval> | null = null;
	let isExpanded = false;
	let isVisible = false;
	let expandTimeout: ReturnType<typeof setTimeout> | null = null;
	let hideTimeout: ReturnType<typeof setTimeout> | null = null;
	let showSaveDialog = false;
	let saveNote = '';
	let showLogs = false;
	let timerMode: TimerMode = 'countup';
	let pomodoroPhase: PomodoroPhase = 'work';
	let pomodoroWorkMinutes = 25;
	let pomodoroBreakMinutes = 5;
	let targetHours = 8;
	let targetMinutes = 0;
	let soundEnabled = true;

	const pomodoroPresets = [15, 25, 45, 60, 90];

	function formatTime(totalSeconds: number): string {
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		
		const hStr = hours > 0 ? `${hours}:` : '';
		const mStr = minutes.toString().padStart(hours > 0 ? 2 : 1, '0');
		const sStr = seconds.toString().padStart(2, '0');
		
		return `${hStr}${mStr}:${sStr}`;
	}

	function toSafeInt(value: number, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
		if (!Number.isFinite(value)) return fallback;
		const normalized = Math.floor(value);
		return Math.min(Math.max(normalized, min), max);
	}

	function start() {
		if (isRunning) return;
		if (interval) clearInterval(interval);

		if (timerMode === 'pomodoro' && (!Number.isFinite(remaining) || remaining <= 0)) {
			startPomodoroPhase(pomodoroPhase);
		}

		if (timerMode === 'countdown') {
			if (!Number.isFinite(remaining) || remaining <= 0) {
				setCountdownFromGoal();
			}
			if (!Number.isFinite(remaining) || remaining <= 0) return;
		}

		isRunning = true;
		interval = setInterval(() => {
			elapsed += 1;
			if (timerMode !== 'countup') {
				if (remaining > 0) remaining -= 1;
				if (remaining <= 0) {
					remaining = 0;
					handleTimerFinished();
				}
			}
		}, 1000);
	}

	function pause() {
		isRunning = false;
		if (interval) {
			clearInterval(interval);
			interval = null;
		}
	}

	function toggleTimer() {
		if (isRunning) pause();
		else start();
	}

	function stop() {
		pause();
		elapsed = 0;
		if (timerMode === 'countup') {
			remaining = 0;
		} else if (timerMode === 'pomodoro') {
			startPomodoroPhase('work');
		} else {
			setCountdownFromGoal();
		}
	}

	function setTimerMode(mode: TimerMode) {
		if (timerMode === mode) return;
		pause();
		timerMode = mode;
		elapsed = 0;
		showSaveDialog = false;

		if (mode === 'pomodoro') {
			pomodoroPhase = 'work';
			startPomodoroPhase('work');
		} else if (mode === 'countdown') {
			setCountdownFromGoal();
		} else {
			remaining = 0;
			initialRemaining = 0;
		}
	}

	function startPomodoroPhase(phase: PomodoroPhase) {
		pomodoroPhase = phase;
		const workMinutes = toSafeInt(pomodoroWorkMinutes, 25, 1, 180);
		const breakMinutes = toSafeInt(pomodoroBreakMinutes, 5, 1, 60);
		pomodoroWorkMinutes = workMinutes;
		pomodoroBreakMinutes = breakMinutes;
		remaining = (phase === 'work' ? workMinutes : breakMinutes) * 60;
		initialRemaining = remaining;
	}

	function setPomodoroPreset(min: number) {
		pomodoroWorkMinutes = min;
		if (timerMode === 'pomodoro') {
			pause();
			startPomodoroPhase('work');
		}
	}

	function setCountdownFromGoal() {
		targetHours = toSafeInt(targetHours, 8, 0, 24);
		targetMinutes = toSafeInt(targetMinutes, 0, 0, 59);
		const totalMinutes = targetHours * 60 + targetMinutes;
		remaining = Math.max(totalMinutes * 60, 0);
		initialRemaining = remaining;
	}

	function getModeLabel(): string {
		if (timerMode === 'countup') return $_('timer__mode_countup');
		if (timerMode === 'countdown') return $_('timer__mode_countdown');
		return pomodoroPhase === 'work' ? $_('timer__mode_pomodoro_work') : $_('timer__mode_pomodoro_break');
	}

	function playAlertSound() {
		if (!browser || !soundEnabled) return;
		const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
		const durations = [0, 0.15, 0.3];
		durations.forEach((at) => {
			const oscillator = audioContext.createOscillator();
			const gainNode = audioContext.createGain();
			oscillator.type = 'sine';
			oscillator.frequency.setValueAtTime(880, audioContext.currentTime + at);
			gainNode.gain.setValueAtTime(0.1, audioContext.currentTime + at);
			gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + at + 0.1);
			oscillator.connect(gainNode);
			gainNode.connect(audioContext.destination);
			oscillator.start(audioContext.currentTime + at);
			oscillator.stop(audioContext.currentTime + at + 0.15);
		});
	}

	function handleTimerFinished() {
		playAlertSound();
		if (timerMode === 'pomodoro') {
			const nextPhase = pomodoroPhase === 'work' ? 'break' : 'work';
			startPomodoroPhase(nextPhase);
			elapsed = 0;
			start(); // Auto start next phase
		} else {
			pause();
		}
	}

	function saveTime() {
		if (elapsed > 0) {
			timeLogs.add(elapsed, saveNote);
			saveNote = '';
			showSaveDialog = false;
		}
	}

	function handleBeforeUnload(event: BeforeUnloadEvent) {
		if (elapsed > 0 || (isRunning && timerMode !== 'countup')) {
			event.preventDefault();
			event.returnValue = $_('timer__exit_confirm');
			return event.returnValue;
		}
	}

	function handleMouseEnter() {
		if (expandTimeout) clearTimeout(expandTimeout);
		if (hideTimeout) clearTimeout(hideTimeout);
		isExpanded = true;
		requestAnimationFrame(() => isVisible = true);
	}

	function handleMouseLeave() {
		expandTimeout = setTimeout(() => {
			isVisible = false;
			hideTimeout = setTimeout(() => {
				isExpanded = false;
				showSaveDialog = false;
				saveNote = '';
				showLogs = false;
			}, 300);
		}, 200);
	}

	onMount(() => {
		if (browser) window.addEventListener('beforeunload', handleBeforeUnload);
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
		if (browser) window.removeEventListener('beforeunload', handleBeforeUnload);
	});

	$: progress = timerMode === 'countup' ? 0 : (initialRemaining > 0 ? (1 - remaining / initialRemaining) * 100 : 0);
</script>

<div class="fixed bottom-6 right-6 z-[60] flex items-center gap-3 font-sans">
	<!-- Utility Buttons Row -->
	<div class="flex items-center gap-2">
		<button on:click={() => dispatch('showQuickNotes')} class="util-btn bg-indigo-600/90 hover:bg-indigo-500" title={$_('quickNotes__title')}>
			<FileText size={18} />
		</button>
		<button on:click={() => dispatch('showBookmarks')} class="util-btn bg-amber-500/90 hover:bg-amber-400 text-amber-950" title={$_('timer__bookmarks_tooltip')}>
			<Bookmark size={18} />
		</button>
		<button on:click={() => dispatch('showWhiteboard')} class="util-btn bg-sky-500/90 hover:bg-sky-400 text-sky-950" title={$_('timer__whiteboard_tooltip')}>
			<PenTool size={18} />
		</button>
	</div>

	<!-- Main Timer Complex -->
	<div class="relative group" on:mouseenter={handleMouseEnter} on:mouseleave={handleMouseLeave} role="group">
		<!-- Popovers (Stacked) -->
		{#if isExpanded}
			<div 
				class="absolute bottom-full right-0 mb-4 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] {isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'}"
				style="z-index: 70;"
			>
				<!-- Multi-Tab Dashboard -->
				<div class="glass-card w-80 overflow-hidden shadow-2xl flex flex-col">
					<!-- Top Bar with Status and Quick Controls -->
					<div class="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
						<div class="flex flex-col">
							<span class="text-[10px] font-bold uppercase tracking-widest text-white/50">
								{timerMode === 'countup' ? $_('timer__mode_countup') : timerMode === 'pomodoro' ? $_('timer__mode_pomodoro') : $_('timer__mode_goal')}
							</span>
							<span class="text-sm font-semibold text-white">
								{isRunning ? $_('timer__status_active') : $_('timer__status_paused')}
							</span>
						</div>
						<div class="flex items-center gap-1">
							<button on:click={toggleLogs} class="icon-btn {showLogs ? 'bg-primary/20 text-primary' : ''}" title={$_('timer__history_title')}>
								<History size={16} />
							</button>
							<button on:click={() => soundEnabled = !soundEnabled} class="icon-btn">
								{#if soundEnabled}<Bell size={16} />{:else}<BellOff size={16} />{/if}
							</button>
							<button on:click={() => showKeyboardShortcuts.set(true)} class="icon-btn">
								<HelpCircle size={16} />
							</button>
						</div>
					</div>

					<!-- Scrollable Content Area -->
					<div class="p-4 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
						<!-- Mode Selection Grid -->
						<div class="grid grid-cols-3 gap-1 bg-white/5 p-1 rounded-xl">
							{#each ['countup', 'pomodoro', 'countdown'] as mode}
								<button 
									on:click={() => setTimerMode(mode as TimerMode)}
									class="flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-all {timerMode === mode ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'text-white/40 hover:text-white hover:bg-white/5'}"
								>
									{#if mode === 'countup'}<Timer size={14} />{/if}
									{#if mode === 'pomodoro'}<Settings2 size={14} />{/if}
									{#if mode === 'countdown'}<Settings2 size={14} />{/if}
									<span class="text-[9px] font-bold uppercase">
										{mode === 'countup' ? $_('timer__mode_countup') : mode === 'pomodoro' ? $_('timer__mode_pomodoro') : $_('timer__mode_goal')}
									</span>
								</button>
							{/each}
						</div>

						<!-- Mode Specific Settings -->
						<div class="min-h-[100px] flex flex-col justify-center">
							{#if timerMode === 'pomodoro'}
								<div transition:fade={{ duration: 200 }} class="space-y-4">
									<div class="grid grid-cols-2 gap-3">
										<div class="space-y-1">
											<label class="text-[10px] font-bold uppercase text-white/40 ml-1">{$_('timer__settings_work')}</label>
											<div class="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden focus-within:border-primary/50 transition-colors">
												<input type="number" bind:value={pomodoroWorkMinutes} on:change={() => startPomodoroPhase('work')} class="w-full bg-transparent px-3 py-1.5 text-sm text-white focus:outline-none" />
											</div>
										</div>
										<div class="space-y-1">
											<label class="text-[10px] font-bold uppercase text-white/40 ml-1">{$_('timer__settings_break')}</label>
											<div class="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden focus-within:border-primary/50 transition-colors">
												<input type="number" bind:value={pomodoroBreakMinutes} on:change={() => startPomodoroPhase('work')} class="w-full bg-transparent px-3 py-1.5 text-sm text-white focus:outline-none" />
											</div>
										</div>
									</div>
									<div class="flex flex-wrap gap-1.5">
										{#each pomodoroPresets as min}
											<button 
												on:click={() => setPomodoroPreset(min)}
												class="px-2.5 py-1 text-[10px] font-bold rounded-full border border-white/10 hover:border-primary/50 hover:bg-primary/10 transition-all {pomodoroWorkMinutes === min ? 'bg-primary/20 border-primary/50 text-primary' : 'text-white/40'}"
											>
												{$_('timer__preset_short', { values: { min } })}
											</button>
										{/each}
									</div>
								</div>
							{:else if timerMode === 'countdown'}
								<div transition:fade={{ duration: 200 }} class="grid grid-cols-2 gap-3">
									<div class="space-y-1">
										<label class="text-[10px] font-bold uppercase text-white/40 ml-1">{$_('timer__settings_hours')}</label>
										<input type="number" bind:value={targetHours} on:change={setCountdownFromGoal} class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary/50" />
									</div>
									<div class="space-y-1">
										<label class="text-[10px] font-bold uppercase text-white/40 ml-1">{$_('timer__settings_minutes')}</label>
										<input type="number" bind:value={targetMinutes} on:change={setCountdownFromGoal} class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary/50" />
									</div>
								</div>
							{:else}
								<div transition:fade={{ duration: 200 }} class="py-4 text-center">
									<p class="text-xs text-white/30 italic">Session timer active.</p>
								</div>
							{/if}
						</div>

						<!-- Action Row -->
						<div class="flex items-center gap-2 pt-2 border-t border-white/5">
							<button on:click={stop} class="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-xl transition-all border border-white/5">
								<RotateCcw size={14} />
								{$_('timer__btn_reset')}
							</button>
							{#if elapsed > 0}
								<button on:click={() => showSaveDialog = true} class="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-primary hover:bg-primary-dark text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-primary/20">
									<Save size={14} />
									{$_('timer__btn_save_action')}
								</button>
							{/if}
						</div>
					</div>

					<!-- Logs Integration -->
					{#if showLogs}
						<div transition:slide class="bg-black/40 border-t border-white/10 p-4 space-y-3">
							<div class="flex items-center justify-between">
								<h3 class="text-xs font-bold uppercase tracking-wider text-white/60">{$_('timer__history_recent_title')}</h3>
								<button on:click={() => showLogs = false} class="text-white/40 hover:text-white"><X size={14} /></button>
							</div>
							<div class="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
								{#each [...$timeLogs].reverse().slice(0, 5) as log}
									<div class="flex items-center justify-between p-2 rounded-lg bg-white/5 text-[10px]">
										<div class="flex flex-col">
											<span class="font-bold text-primary">{formatDuration(log.duration)}</span>
											{#if log.note}<span class="text-white/40 truncate w-32">{log.note}</span>{/if}
										</div>
										<button on:click={() => timeLogs.remove(log.id)} class="text-white/20 hover:text-red-400">
											<X size={12} />
										</button>
									</div>
								{/each}
								{#if $timeLogs.length === 0}
									<p class="text-center py-4 text-[10px] text-white/20 italic">{$_('timer__empty_session')}</p>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Save Dialog Overlay -->
		{#if showSaveDialog}
			<div transition:fade class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" on:click={() => showSaveDialog = false}>
				<div class="glass-card w-full max-w-sm p-6 space-y-4 shadow-2xl scale-up-center" on:click|stopPropagation>
					<div class="flex items-center justify-between">
						<h3 class="text-lg font-bold text-white">{$_('timer__dialog_save_title')}</h3>
						<span class="text-primary font-mono font-bold text-xl">{formatTime(elapsed)}</span>
					</div>
					<div class="space-y-2">
						<label class="text-[10px] font-bold uppercase text-white/40">{$_('timer__dialog_note_label')}</label>
						<textarea 
							bind:value={saveNote}
							placeholder={$_('timer__dialog_note_placeholder')}
							class="w-full h-24 bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-primary/50 resize-none"
						></textarea>
					</div>
					<div class="flex gap-3 pt-2">
						<button on:click={() => showSaveDialog = false} class="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all">{$_('timer__btn_cancel')}</button>
						<button on:click={saveTime} class="flex-1 py-3 px-4 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
							<Check size={18} />
							{$_('timer__btn_save_session')}
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Main Controller Button -->
		<div class="flex items-center bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/5 p-1 transition-all duration-300 hover:border-white/20">
			<!-- Play/Pause Quick Action -->
			<button 
				on:click={toggleTimer}
				class="w-12 h-12 flex items-center justify-center rounded-xl transition-all {isRunning ? 'bg-red-500 hover:bg-red-400 shadow-lg shadow-red-500/20' : 'bg-white/5 hover:bg-white/10'}"
			>
				{#if isRunning}
					<Pause size={20} fill="white" strokeWidth={0} />
				{:else}
					<Play size={20} fill="currentColor" class="text-white ml-1" />
				{/if}
			</button>

			<!-- Time & Label Group -->
			<button 
				type="button"
				class="px-3 pr-4 flex flex-col justify-center select-none cursor-pointer border-none bg-transparent text-left focus:outline-none focus:ring-1 focus:ring-primary/30 rounded-lg" 
				on:click={handleMouseEnter}
				on:keydown={(e) => e.key === 'Enter' && handleMouseEnter()}
			>
				<div class="flex items-center gap-2">
					<span class="font-mono text-xl font-bold text-white tabular-nums leading-none tracking-tight">
						{formatTime(timerMode === 'countup' ? elapsed : remaining)}
					</span>
					{#if timerMode !== 'countup'}
						<div class="w-1 h-1 rounded-full {isRunning ? 'bg-green-500 animate-pulse' : 'bg-white/20'}"></div>
					{/if}
				</div>
				<div class="flex items-center justify-between gap-4 mt-0.5">
					<span class="text-[9px] font-bold uppercase tracking-[0.15em] text-white/40 truncate max-w-[100px] leading-tight">
						{getModeLabel()}
					</span>
					{#if progress > 0}
						<div class="w-12 h-[3px] bg-white/5 rounded-full overflow-hidden">
							<div class="h-full bg-primary transition-all duration-500" style="width: {progress}%"></div>
						</div>
					{/if}
				</div>
			</button>
		</div>
	</div>
</div>

<style>
	.glass-card {
		background: rgba(15, 15, 15, 0.85);
		backdrop-filter: blur(20px);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 1.5rem;
	}

	.util-btn {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		color: white;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		backdrop-filter: blur(8px);
	}
	.util-btn:hover {
		transform: scale(1.1) translateY(-2px);
	}

	.icon-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.75rem;
		color: rgba(255, 255, 255, 0.4);
		transition: all 0.2s;
	}
	.icon-btn:hover {
		color: white;
		background: rgba(255, 255, 255, 0.05);
		transform: scale(1.05);
	}

	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 20px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	input[type='number']::-webkit-inner-spin-button,
	input[type='number']::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	@keyframes scale-up-center {
		0% { transform: scale(0.95); opacity: 0; }
		100% { transform: scale(1); opacity: 1; }
	}
	.scale-up-center {
		animation: scale-up-center 0.2s cubic-bezier(0.23, 1.0, 0.32, 1.0) both;
	}
</style>
