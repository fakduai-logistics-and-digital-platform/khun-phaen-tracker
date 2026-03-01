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

	export let showImport: boolean = true;

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
		const element = document.querySelector('.space-y-6') || document.querySelector('.max-w-7xl') as HTMLElement;
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
			
			const dataUrl = await toPng(element as HTMLElement, {
				quality: 0.95,
				backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff',
				pixelRatio: 2,
				filter: (node: any) => {
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

<div class="flex flex-wrap items-center gap-2">
	<!-- Export Dropdown -->
	<div class="relative" bind:this={dropdownRef}>
		<button
			on:click={toggleExportDropdown}
			class="flex items-center justify-center gap-2.5 h-12 px-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-xs uppercase tracking-widest text-gray-700 dark:text-gray-400 transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-sm hover:shadow-md hover:text-emerald-500 hover:border-emerald-500/30"
		>
			<Download size={18} />
			<span class="hidden sm:inline">{$_('exportImport__export')}</span>
			<ChevronDown size={14} class="opacity-50 transition-transform {showExportDropdown ? 'rotate-180' : ''}" />
		</button>

		{#if showExportDropdown}
			<div class="absolute top-[calc(100%+0.5rem)] left-0 mt-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 py-2.5 min-w-60 z-999 animate-fade-in origin-top-left">
				<div class="px-4 py-2 mb-1 border-b border-gray-100 dark:border-gray-800">
					<p class="text-[10px] font-black uppercase tracking-widest text-gray-400">Choose Format</p>
				</div>

				<button
					on:click={handleExportCSV}
					class="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors whitespace-nowrap"
				>
					<div class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
						<FileSpreadsheet size={16} />
					</div>
					<span class="font-bold">{$_('exportImport__export_csv')}</span>
				</button>

				<button
					on:click={handleExportPDF}
					class="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-red-500/10 hover:text-red-600 transition-colors whitespace-nowrap"
				>
					<div class="p-1.5 rounded-lg bg-red-500/10 text-red-600">
						<FileText size={16} />
					</div>
					<span class="font-bold">{$_('exportImport__export_pdf')}</span>
				</button>

				<button
					on:click={handleExportPNG}
					class="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-purple-500/10 hover:text-purple-600 transition-colors whitespace-nowrap"
				>
					<div class="p-1.5 rounded-lg bg-purple-500/10 text-purple-600">
						<ImageIcon size={16} />
					</div>
					<span class="font-bold">{$_('exportImport__export_png')}</span>
				</button>

				<button
					on:click={handleExportMarkdown}
					class="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-500/10 hover:text-blue-600 transition-colors whitespace-nowrap"
				>
					<div class="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
						<FileCode size={16} />
					</div>
					<span class="font-bold">{$_('exportImport__export_markdown')}</span>
				</button>

				<button
					on:click={handleExportVideo}
					class="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-orange-500/10 hover:text-orange-600 transition-colors whitespace-nowrap"
				>
					<div class="p-1.5 rounded-lg bg-orange-500/10 text-orange-600">
						<Video size={16} />
					</div>
					<span class="font-bold">{$_('exportImport__export_video')}</span>
				</button>

				<button
					on:click={handleExportSlide}
					class="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-500/10 hover:text-indigo-600 transition-colors whitespace-nowrap"
				>
					<div class="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600">
						<Presentation size={16} />
					</div>
					<span class="font-bold">{$_('exportImport__export_slide')}</span>
				</button>

				<div class="my-2 border-t border-gray-100 dark:border-gray-800"></div>

				<div class="relative group/db">
					<button
						class="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap"
					>
						<span class="font-black uppercase tracking-tighter text-xs">{$_('exportImport__export_database')}</span>
						<ChevronRight size={14} class="text-gray-400" />
					</button>

					<div class="hidden group-hover/db:block group-focus-within/db:block absolute left-full top-0 ml-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 py-2 min-w-72 z-30 animate-fade-in origin-left">
						{#each databaseTargets as target}
							<button
								on:click={() => handleExportDatabase(target)}
								class="w-full flex flex-col gap-0.5 px-4 py-2.5 text-left text-gray-700 dark:text-gray-300 hover:bg-primary/10 hover:text-primary transition-colors border-b border-gray-50 dark:border-gray-800 last:border-0"
							>
								<span class="font-black text-xs">{target.database}</span>
								<span class="text-[10px] text-gray-400 font-medium tracking-tight uppercase">{target.note}</span>
							</button>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>

	{#if showImport}
		<input
			type="file"
			accept=".csv"
			bind:this={fileInput}
			on:change={handleFileSelect}
			class="hidden"
		/>

		<button
			on:click={() => fileInput?.click()}
			class="flex items-center justify-center gap-2.5 h-12 px-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-xs uppercase tracking-widest text-gray-700 dark:text-gray-400 transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-sm hover:shadow-md hover:text-primary hover:border-primary/30"
		>
			<Upload size={18} />
			<span class="hidden sm:inline">{$_('exportImport__import')}</span>
			<span class="sm:hidden">{$_('exportImport__import_short')}</span>
		</button>
	{/if}
</div>

{#if showImportConfirm}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fade-in">
		<div class="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-md w-full p-8 border border-white/10 ring-1 ring-black/5 animate-modal-in">
			<div class="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mb-6">
				<Upload size={32} />
			</div>
			<h3 class="text-2xl font-black text-gray-900 dark:text-white mb-2 leading-tight">{$_('exportImport__import_confirm_title')}</h3>
			<p class="text-gray-500 dark:text-gray-400 mb-8 font-medium leading-relaxed">
				{$_('exportImport__import_confirm_message')}
			</p>

			{#if importError}
				<div class="bg-red-500/10 text-red-500 p-4 rounded-xl mb-6 text-sm font-bold border border-red-500/20">
					{importError}
				</div>
			{/if}

			<div class="flex gap-3">
				<button
					on:click={confirmImport}
					class="flex-1 bg-primary hover:bg-primary-dark text-white py-4 px-6 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-primary/25"
				>
					{$_('exportImport__btn_import')}
				</button>
				<button
					on:click={cancelImport}
					class="flex-1 px-6 py-4 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-95"
				>
					{$_('exportImport__btn_cancel')}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes fade-in {
		from { opacity: 0; transform: translateY(-8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@keyframes modal-in {
		from { opacity: 0; transform: scale(0.9) translateY(10px); }
		to { opacity: 1; transform: scale(1) translateY(0); }
	}

	.animate-fade-in { animation: fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
	.animate-modal-in { animation: modal-in 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
</style>
