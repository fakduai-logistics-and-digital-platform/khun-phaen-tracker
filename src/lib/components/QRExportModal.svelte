<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { X, QrCode, AlertTriangle, Download } from 'lucide-svelte';
	import type { Task, Project, Assignee } from '$lib/types';
	import { prepareQRData, estimateQRSize, getRelatedData, formatBytes, QR_MAX_BYTES } from '$lib/utils/qr-export';
	import QRCode from 'qrcode';

	export let show = false;
	export let selectedTasks: Task[] = [];
	export let allProjects: Project[] = [];
	export let allAssignees: Assignee[] = [];

	const dispatch = createEventDispatcher<{
		close: void;
		exportCSV: void;
	}>();

	let canvasEl: HTMLCanvasElement;
	let qrData = '';
	let sizeInfo = { bytes: 0, fitsQR: true, percentage: 0 };
	let error = '';

	$: if (show && selectedTasks.length > 0) {
		generateQR();
	}

	async function generateQR() {
		error = '';
		try {
			const { projects, assignees } = getRelatedData(selectedTasks, allProjects, allAssignees);
			qrData = prepareQRData(selectedTasks, projects, assignees);
			sizeInfo = estimateQRSize(qrData);

			if (sizeInfo.fitsQR && canvasEl) {
				await renderQR();
			}
		} catch (e) {
			error = 'เกิดข้อผิดพลาดในการสร้าง QR Code';
			console.error('QR generation error:', e);
		}
	}

	async function renderQR() {
		if (!canvasEl || !qrData) return;
		try {
			await QRCode.toCanvas(canvasEl, qrData, {
				width: 280,
				margin: 2,
				errorCorrectionLevel: 'L',
				color: {
					dark: '#000000',
					light: '#ffffff'
				}
			});
		} catch (e) {
			error = 'ข้อมูลใหญ่เกินไปสำหรับ QR Code';
			console.error('QR render error:', e);
		}
	}

	// Re-render when canvas becomes available
	$: if (canvasEl && sizeInfo.fitsQR && qrData) {
		renderQR();
	}

	function handleClose() {
		dispatch('close');
	}

	function handleExportCSV() {
		dispatch('exportCSV');
		dispatch('close');
	}
</script>

{#if show}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[20000] p-4" on:click|self={handleClose}>
		<div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full overflow-hidden">
			<!-- Header -->
			<div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
				<div class="flex items-center gap-2">
					<QrCode size={20} class="text-teal-600" />
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">ส่งออก QR Code</h3>
				</div>
				<button on:click={handleClose} class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
					<X size={20} class="text-gray-500" />
				</button>
			</div>

			<!-- Content -->
			<div class="p-5">
				<!-- Task count -->
				<p class="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
					เลือก {selectedTasks.length} งาน
				</p>

				{#if error}
					<div class="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 rounded-lg mb-4 text-sm text-center">
						{error}
					</div>
				{/if}

				{#if sizeInfo.fitsQR}
					<!-- QR Code Display -->
					<div class="flex justify-center mb-4">
						<div class="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
							<canvas bind:this={canvasEl}></canvas>
						</div>
					</div>

					<!-- Size Indicator -->
					<div class="mb-4">
						<div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
							<span>ขนาดข้อมูล</span>
							<span>{formatBytes(sizeInfo.bytes)} / {formatBytes(QR_MAX_BYTES)}</span>
						</div>
						<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
							<div
								class="h-2 rounded-full transition-all {sizeInfo.percentage > 80 ? 'bg-amber-500' : 'bg-teal-500'}"
								style="width: {Math.min(sizeInfo.percentage, 100)}%"
							></div>
						</div>
					</div>

					<p class="text-xs text-gray-500 dark:text-gray-400 text-center">
						สแกน QR Code นี้ด้วยอุปกรณ์อื่นเพื่อนำเข้าข้อมูล
					</p>
				{:else}
					<!-- Too Large Warning -->
					<div class="text-center py-4">
						<div class="flex justify-center mb-3">
							<div class="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
								<AlertTriangle size={32} class="text-amber-600" />
							</div>
						</div>
						<h4 class="text-base font-medium text-gray-900 dark:text-white mb-2">ข้อมูลใหญ่เกินไป</h4>
						<p class="text-sm text-gray-600 dark:text-gray-400 mb-1">
							ขนาด: {formatBytes(sizeInfo.bytes)} / {formatBytes(QR_MAX_BYTES)} ({sizeInfo.percentage}%)
						</p>
						<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
							ลองเลือกน้อยลง หรือใช้การส่งออก CSV แทน
						</p>

						<button
							on:click={handleExportCSV}
							class="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
						>
							<Download size={16} />
							ส่งออก CSV แทน
						</button>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
				<button
					on:click={handleClose}
					class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
				>
					ปิด
				</button>
			</div>
		</div>
	</div>
{/if}
