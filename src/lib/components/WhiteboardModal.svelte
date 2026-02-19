<script lang="ts">
	import { createEventDispatcher, onDestroy, tick } from 'svelte';
	import { Wifi, WifiOff, Download, Trash2, X, LoaderCircle, TriangleAlert } from 'lucide-svelte';

	type Snapshot = Record<string, unknown>;
	type BridgeMode = 'offline' | 'sync';
	type BridgeSyncStatus = 'offline' | 'connecting' | 'online' | 'error';

	interface MountedTldrawBridge {
		unmount: () => void;
		loadSnapshot: (snapshot: Snapshot) => boolean;
		exportPng: () => Promise<string | null>;
		clearCurrentPage: () => void;
	}

	interface TldrawBridgeModule {
		mountTldrawBridge: (options: {
			target: HTMLElement;
			mode: BridgeMode;
			initialSnapshot: Snapshot | null;
			onUserSnapshot: (snapshot: Snapshot) => void;
			onSyncStatus?: (status: BridgeSyncStatus, message: string) => void;
			syncRoomId?: string;
			syncHost?: string;
		}) => MountedTldrawBridge;
	}

	type ConnectionState = 'offline' | 'connecting' | 'online' | 'error';

	const SYNC_ROOM_KEY = 'sync-room-code';
	const SNAPSHOT_KEY = 'whiteboard-snapshot-v1';
	const SYNC_HOST_KEY = 'whiteboard-sync-host';
	const DEFAULT_SYNC_HOST = 'https://demo.tldraw.xyz';

	const dispatch = createEventDispatcher<{
		close: void;
		notify: { message: string; type: 'success' | 'error' };
	}>();

	export let open = false;

	let boardMountEl: HTMLDivElement | null = null;
	let bridge: MountedTldrawBridge | null = null;
	let bridgeModule: TldrawBridgeModule | null = null;
	let connectionState: ConnectionState = 'offline';
	let statusMessage = 'โหมดออฟไลน์: บันทึกลงเบราว์เซอร์';
	let isBooting = false;
	let active = false;
	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	let latestSnapshotRaw: string | null = null;
	let mode: BridgeMode = 'offline';
	let roomCode = '';
	let syncHost = DEFAULT_SYNC_HOST;
	let hasLicense = true;
	let licenseChecked = false;

	$: if (open && !active) {
		active = true;
		void startWhiteboard();
	}

	$: if (!open && active) {
		active = false;
		stopWhiteboard();
	}

	onDestroy(() => {
		stopWhiteboard();
	});

	function readSnapshotFromStorage(): Snapshot | null {
		if (typeof localStorage === 'undefined') return null;
		const raw = localStorage.getItem(SNAPSHOT_KEY);
		if (!raw) return null;
		latestSnapshotRaw = raw;
		try {
			return JSON.parse(raw) as Snapshot;
		} catch {
			localStorage.removeItem(SNAPSHOT_KEY);
			latestSnapshotRaw = null;
			return null;
		}
	}

	function persistSnapshot(snapshot: Snapshot) {
		try {
			const serialized = JSON.stringify(snapshot);
			latestSnapshotRaw = serialized;

			if (saveTimer) clearTimeout(saveTimer);
			saveTimer = setTimeout(() => {
				localStorage.setItem(SNAPSHOT_KEY, serialized);
			}, 180);
		} catch (error) {
			console.warn('Failed to persist whiteboard snapshot', error);
		}
	}

	function handleUserSnapshot(snapshot: Snapshot) {
		persistSnapshot(snapshot);
	}

	function resolveModeFromStorage() {
		const savedRoom = localStorage.getItem(SYNC_ROOM_KEY)?.trim().toUpperCase() ?? '';
		const configuredSyncHost = localStorage.getItem(SYNC_HOST_KEY)?.trim();

		roomCode = savedRoom;
		syncHost = configuredSyncHost && configuredSyncHost.length > 0 ? configuredSyncHost : DEFAULT_SYNC_HOST;

		if (roomCode) {
			mode = 'sync';
			connectionState = 'connecting';
			statusMessage = `กำลังเชื่อมต่อห้อง ${roomCode}...`;
			return;
		}

		mode = 'offline';
		connectionState = 'offline';
		statusMessage = 'โหมดออฟไลน์: ไม่พบห้อง sync';
	}

	function handleSyncStatus(status: BridgeSyncStatus, message: string) {
		if (mode !== 'sync') return;
		connectionState = status;
		statusMessage = message;
	}

	async function ensureBridge() {
		if (!boardMountEl) return;
		if (!bridgeModule) {
			const mod = await import('$lib/components/tldrawBridge');
			bridgeModule = mod as TldrawBridgeModule;
			hasLicense = mod.hasTldrawLicense();
			licenseChecked = true;
		}
		if (bridge) return;
		bridge = bridgeModule.mountTldrawBridge({
			target: boardMountEl,
			mode,
			initialSnapshot: readSnapshotFromStorage(),
			onUserSnapshot: handleUserSnapshot,
			onSyncStatus: handleSyncStatus,
			...(mode === 'sync' ? { syncRoomId: roomCode, syncHost } : {})
		});
	}

	async function startWhiteboard() {
		isBooting = true;
		try {
			resolveModeFromStorage();
			await tick();
			await ensureBridge();
		} finally {
			isBooting = false;
		}
	}

	function stopWhiteboard() {
		if (saveTimer) {
			clearTimeout(saveTimer);
			saveTimer = null;
		}

		if (bridge) {
			bridge.unmount();
			bridge = null;
		}

		mode = 'offline';
		connectionState = 'offline';
		statusMessage = 'โหมดออฟไลน์: บันทึกลงเบราว์เซอร์';
		roomCode = '';
	}

	async function handleExportPng() {
		if (!bridge) return;
		const dataUrl = await bridge.exportPng();
		if (!dataUrl) {
			dispatch('notify', { message: 'ไม่มีเนื้อหาบนกระดานให้ export', type: 'error' });
			return;
		}
		const a = document.createElement('a');
		a.href = dataUrl;
		a.download = `whiteboard-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
		a.click();
		dispatch('notify', { message: 'Export PNG สำเร็จ', type: 'success' });
	}

	function handleClearBoard() {
		const shouldClear = confirm('ต้องการล้างกระดานทั้งหมดหรือไม่?');
		if (!shouldClear) return;
		bridge?.clearCurrentPage();
		localStorage.removeItem(SNAPSHOT_KEY);
		latestSnapshotRaw = null;
		dispatch('notify', { message: 'ล้างกระดานแล้ว', type: 'success' });
	}
</script>

{#if open}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="fixed inset-0 z-100 bg-black/55 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center" on:click|self={() => dispatch('close')}>
		<div class="w-full max-w-7xl h-[92vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
			<div class="px-4 sm:px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
				<div class="min-w-0">
					<h3 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">Whiteboard</h3>
					<div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
						{#if connectionState === 'online'}
							<Wifi size={13} class="text-emerald-500" />
						{:else if connectionState === 'connecting'}
							<LoaderCircle size={13} class="animate-spin text-amber-500" />
						{:else if connectionState === 'error'}
							<WifiOff size={13} class="text-red-500" />
						{:else}
							<WifiOff size={13} class="text-gray-400" />
						{/if}
						<span class="truncate">{statusMessage}</span>
					</div>
				</div>

				<div class="flex items-center gap-2">
					<button
						on:click={handleExportPng}
						class="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5"
						title="Export PNG"
					>
						<Download size={15} />
						<span class="hidden sm:inline">Export PNG</span>
					</button>
					<button
						on:click={handleClearBoard}
						class="px-3 py-2 text-sm rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors flex items-center gap-1.5"
						title="ล้างกระดาน"
					>
						<Trash2 size={15} />
						<span class="hidden sm:inline">ล้าง</span>
					</button>
					<button
						on:click={() => dispatch('close')}
						class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
						title="ปิด"
					>
						<X size={16} />
					</button>
				</div>
			</div>

			<div class="flex-1 min-h-0 bg-white dark:bg-gray-950 relative">
				{#if licenseChecked && !hasLicense}
					<div class="mx-4 mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-lg flex items-start gap-2.5 text-sm">
						<TriangleAlert size={18} class="text-amber-500 shrink-0 mt-0.5" />
						<div class="text-amber-800 dark:text-amber-200">
							<p class="font-semibold">Whiteboard ทำงานได้ แต่ยังไม่มี tldraw License Key</p>
							<p class="mt-1 text-amber-700 dark:text-amber-300">
								คัดลอก <code class="bg-amber-100 dark:bg-amber-900/60 px-1 rounded">.env.example</code> เป็น <code class="bg-amber-100 dark:bg-amber-900/60 px-1 rounded">.env</code> แล้วใส่ License Key ของคุณ
								&mdash; ขอ key ฟรี (non-commercial) ได้ที่
								<a href="https://tldraw.dev" target="_blank" rel="noopener noreferrer" class="underline font-medium hover:text-amber-900 dark:hover:text-amber-100">tldraw.dev</a>
							</p>
						</div>
					</div>
				{/if}
				{#if isBooting}
					<div class="absolute inset-0 z-10 bg-white/80 dark:bg-gray-950/80 flex items-center justify-center">
						<div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
							<LoaderCircle size={16} class="animate-spin" />
							<span>กำลังโหลด Whiteboard...</span>
						</div>
					</div>
				{/if}
				<div class="w-full h-full" bind:this={boardMountEl}></div>
			</div>
		</div>
	</div>
{/if}
