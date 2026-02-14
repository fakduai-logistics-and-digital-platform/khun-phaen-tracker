<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Download, Upload, FileSpreadsheet, FileText, Image as ImageIcon, FileCode, ChevronDown, ChevronRight, Video, Presentation } from 'lucide-svelte';
	import { toPng } from 'html-to-image';
	import { _ } from 'svelte-i18n';

	const dispatch = createEventDispatcher<{
		exportCSV: void;
		exportPDF: void;
		exportPNG: void;
		exportMarkdown: void;
		exportVideo: void;
		exportSlide: void;
		exportDatabase: {
			database: 'SQLite' | 'MongoDB/NoSQL' | 'PostgreSQL';
			extensions: string[];
			primaryExtension: string;
			note: string;
		};
		importCSV: string;
	}>()

	let fileInput: HTMLInputElement;
	let showImportConfirm = false;
	let importContent = '';
	let importError = '';
	let showExportDropdown = false;
	let dropdownRef: HTMLDivElement;

	type DatabaseTarget = {
		database: 'SQLite' | 'MongoDB/NoSQL' | 'PostgreSQL';
		extensions: string[];
		primaryExtension: string;
		note: string;
	};

	const databaseTargets: DatabaseTarget[] = [
		{
			database: 'SQLite',
			extensions: ['.db', '.sqlite'],
			primaryExtension: '.sqlite',
			note: $_('exportImport__sqlite_note')
		},
		{
			database: 'MongoDB/NoSQL',
			extensions: ['.json', '.bson'],
			primaryExtension: '.json',
			note: $_('exportImport__nosql_note')
		},
		{
			database: 'PostgreSQL',
			extensions: ['.sql'],
			primaryExtension: '.sql',
			note: $_('exportImport__postgres_note')
		}
	];

	
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

	function handleExportCSV() {
		dispatch('exportCSV');
		showExportDropdown = false;
	}

	function handleExportPDF() {
		dispatch('exportPDF');
		showExportDropdown = false;
	}

	async function handleExportPNG() {
		// Find the main content container
		const element = document.querySelector('.space-y-6') as HTMLElement;
		if (!element) {
			alert('ไม่พบเนื้อหาที่จะส่งออก');
			return;
		}

		try {
			showExportDropdown = false;
			
			// Show loading feedback
			const originalTitle = document.title;
			document.title = 'กำลังสร้างรูปภาพ...';
			
			// Wait a bit for dropdown to close
			await new Promise(r => setTimeout(r, 100));
			
			const dataUrl = await toPng(element, {
				quality: 0.95,
				backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff',
				pixelRatio: 2,
				filter: (node) => {
					// Exclude certain elements from screenshot
					if (node.tagName === 'BUTTON' && node.closest('.fixed')) return false;
					if (node.classList?.contains('fixed')) return false;
					return true;
				}
			});
			
			// Create download link
			const link = document.createElement('a');
			const now = new Date();
			const dateStr = now.toISOString().split('T')[0];
			const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
			link.download = `khu-phaen-tasks_${dateStr}_${timeStr}.png`;
			link.href = dataUrl;
			link.click();
			
			document.title = originalTitle;
			dispatch('exportPNG');
			
		} catch (error) {
			console.error('PNG export failed:', error);
			alert($_('exportImport__error_export_png'));
		}
	}

	function handleExportMarkdown() {
		dispatch('exportMarkdown');
		showExportDropdown = false;
	}

	function handleExportVideo() {
		dispatch('exportVideo');
		showExportDropdown = false;
	}

	function handleExportSlide() {
		dispatch('exportSlide');
		showExportDropdown = false;
	}

	function handleExportDatabase(target: DatabaseTarget) {
		dispatch('exportDatabase', {
			database: target.database,
			extensions: target.extensions,
			primaryExtension: target.primaryExtension,
			note: target.note
		});
		showExportDropdown = false;
	}

	function toggleExportDropdown() {
		showExportDropdown = !showExportDropdown;
	}

	function handleClickOutside(event: MouseEvent) {
		if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
			showExportDropdown = false;
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			showExportDropdown = false;
		}
	}
</script>

<svelte:window on:click={handleClickOutside} on:keydown={handleKeyDown} />

<div class="flex flex-wrap gap-2">
	<!-- Export Dropdown -->
	<div class="relative" bind:this={dropdownRef}>
		<button
			on:click={toggleExportDropdown}
			class="flex items-center justify-center gap-2 h-10 px-3 sm:px-4 bg-success/10 hover:bg-success/20 text-success rounded-lg font-medium transition-colors"
		>
			<Download size={16} />
			<span class="hidden sm:inline">{$_('exportImport__export')}</span>
			<ChevronDown size={16} class="transition-transform {showExportDropdown ? 'rotate-180' : ''}" />
		</button>

		{#if showExportDropdown}
			<div class="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[220px] z-20 animate-fade-in">
				<button
					on:click={handleExportCSV}
					class="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
				>
					<FileSpreadsheet size={16} class="text-green-600" />
					{$_('exportImport__export_csv')}
				</button>
				<button
					on:click={handleExportPDF}
					class="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
				>
					<FileText size={16} class="text-red-600" />
					{$_('exportImport__export_pdf')}
				</button>
				<button
					on:click={handleExportPNG}
					class="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
				>
					<ImageIcon size={16} class="text-purple-600" />
					{$_('exportImport__export_png')}
				</button>
				<button
					on:click={handleExportMarkdown}
					class="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
				>
					<FileCode size={16} class="text-blue-600" />
					{$_('exportImport__export_markdown')}
				</button>
				<button
					on:click={handleExportVideo}
					class="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
				>
					<Video size={16} class="text-orange-500" />
					{$_('exportImport__export_video')}
				</button>
				<button
					on:click={handleExportSlide}
					class="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
				>
					<Presentation size={16} class="text-indigo-600" />
					{$_('exportImport__export_slide')}
				</button>
				<div class="my-1 border-t border-gray-200 dark:border-gray-700"></div>
				<div class="relative group">
					<button
						class="w-full flex items-center justify-between gap-2 px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
					>
						<span class="font-medium">{$_('exportImport__export_database')}</span>
						<ChevronRight size={14} class="text-gray-500 dark:text-gray-400" />
					</button>

					<div class="hidden group-hover:block group-focus-within:block absolute left-full top-0 ml-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[280px] z-30 animate-fade-in">
						{#each databaseTargets as target}
							<button
								on:click={() => handleExportDatabase(target)}
								class="w-full flex items-center justify-between gap-2 px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
							>
								<span>{target.database}</span>
								<span class="text-xs text-gray-500 dark:text-gray-400">{target.note}</span>
							</button>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>

	<input
		type="file"
		accept=".csv"
		bind:this={fileInput}
		on:change={handleFileSelect}
		class="hidden"
	/>

	<button
		on:click={() => fileInput?.click()}
		class="flex items-center justify-center gap-2 h-10 px-3 sm:px-4 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-medium transition-colors"
	>
		<Upload size={16} />
		<span class="hidden sm:inline">{$_('exportImport__import')}</span>
		<span class="sm:hidden">{$_('exportImport__import_short')}</span>
	</button>
</div>

{#if showImportConfirm}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
		<div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 transition-colors">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{$_('exportImport__import_confirm_title')}</h3>
			<p class="text-gray-600 dark:text-gray-400 mb-4">
				{$_('exportImport__import_confirm_message')}
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
					{$_('exportImport__btn_import')}
				</button>
				<button
					on:click={cancelImport}
					class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
				>
					{$_('exportImport__btn_cancel')}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes fade-in {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.animate-fade-in {
		animation: fade-in 0.15s ease-out;
	}
</style>
