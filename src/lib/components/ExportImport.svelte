<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Download, Upload, FileSpreadsheet, FileText } from 'lucide-svelte';
	
	const dispatch = createEventDispatcher<{
		exportCSV: void;
		exportPDF: void;
		importCSV: string;
	}>();
	
	let fileInput: HTMLInputElement;
	let showImportConfirm = false;
	let importContent = '';
	let importError = '';
	
	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;
		
		const reader = new FileReader();
		reader.onload = (e) => {
			const content = e.target?.result as string;
			if (content) {
				importContent = content;
				showImportConfirm = true;
				importError = '';
			}
		};
		reader.readAsText(file);
	}
	
	function confirmImport() {
		if (importContent) {
			dispatch('importCSV', importContent);
			showImportConfirm = false;
			importContent = '';
			if (fileInput) fileInput.value = '';
		}
	}
	
	function cancelImport() {
		showImportConfirm = false;
		importContent = '';
		if (fileInput) fileInput.value = '';
	}
</script>

<div class="flex flex-wrap gap-2">
	<button
		on:click={() => dispatch('exportCSV')}
		class="flex items-center gap-2 px-4 py-2 bg-success/10 hover:bg-success/20 text-success rounded-lg font-medium transition-colors"
	>
		<FileSpreadsheet size={18} />
		<span class="hidden sm:inline">ส่งออก CSV</span>
		<span class="sm:hidden">CSV</span>
	</button>

	<button
		on:click={() => dispatch('exportPDF')}
		class="flex items-center gap-2 px-4 py-2 bg-danger/10 hover:bg-danger/20 text-danger rounded-lg font-medium transition-colors"
	>
		<FileText size={18} />
		<span class="hidden sm:inline">ส่งออก PDF</span>
		<span class="sm:hidden">PDF</span>
	</button>

	<input
		type="file"
		accept=".csv"
		bind:this={fileInput}
		on:change={handleFileSelect}
		class="hidden"
	/>

	<button
		on:click={() => fileInput?.click()}
		class="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-medium transition-colors"
	>
		<Upload size={18} />
		<span class="hidden sm:inline">นำเข้า CSV</span>
		<span class="sm:hidden">นำเข้า</span>
	</button>
</div>

{#if showImportConfirm}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
		<div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 transition-colors">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">ยืนยันการนำเข้าข้อมูล</h3>
			<p class="text-gray-600 dark:text-gray-400 mb-4">
				คุณต้องการนำเข้าข้อมูลจากไฟล์ CSV หรือไม่? ข้อมูลที่มีอยู่จะไม่ถูกแทนที่
			</p>

			{#if importError}
				<div class="bg-danger/10 text-danger p-3 rounded-lg mb-4 text-sm">
					{importError}
				</div>
			{/if}

			<div class="flex gap-3">
				<button
					on:click={confirmImport}
					class="flex-1 bg-primary hover:bg-primary-dark text-white py-2 px-4 rounded-lg font-medium transition-colors"
				>
					นำเข้า
				</button>
				<button
					on:click={cancelImport}
					class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
				>
					ยกเลิก
				</button>
			</div>
		</div>
	</div>
{/if}
