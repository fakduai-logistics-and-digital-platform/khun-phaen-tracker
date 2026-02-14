<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { FileText, X, Trash2, Copy, Check } from 'lucide-svelte';
	import { quickNotes } from '$lib/stores/quickNotes';
	import { _ } from 'svelte-i18n';
	import { Tipex } from '@friendofsvelte/tipex';
	import '@friendofsvelte/tipex/styles/index.css';

	const dispatch = createEventDispatcher<{ close: void }>();

	let copied = false;
	let tipexEditor = $state();
	
	// We use the store content as initial body
	let content = $state($quickNotes);

	function handleClose() {
		dispatch('close');
	}

	function handleClear() {
		if (confirm($_('quickNotes__clear_confirm') || 'ต้องการล้างบันทึกทั้งหมดหรือไม่?')) {
			quickNotes.clear();
			content = '';
		}
	}

	async function handleCopy() {
		try {
			// Get the latest content from the store
			await navigator.clipboard.writeText($quickNotes);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy text: ', err);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleClose();
		}
	}

	const handleUpdate = (e: any) => {
		// Tiptap can export to HTML. Usually for Markdown we need an extension.
		// For now let's store the HTML/Text in the store.
		const html = e.editor.getHTML();
		quickNotes.set(html);
	};
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
	class="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm"
	on:click|self={handleClose}
>
	<div 
		class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full h-[85vh] flex flex-col animate-modal-in overflow-hidden"
		on:keydown={handleKeydown}
	>
		<!-- Header -->
		<div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
			<div class="flex items-center gap-3">
				<div class="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
					<FileText class="text-indigo-600 dark:text-indigo-400" size={20} />
				</div>
				<div>
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
						{$_('quickNotes__title') || 'สมุดทดด่วน'}
					</h3>
					<p class="text-xs text-gray-500 dark:text-gray-400">
						{$_('quickNotes__subtitle') || 'บันทึกไอเดียหรือข้อความชั่วคราว'}
					</p>
				</div>
			</div>
			
			<div class="flex items-center gap-2">
				<button
					on:click={handleCopy}
					class="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
					title={$_('quickNotes__copy') || 'คัดลอกทั้งหมด'}
				>
					{#if copied}
						<Check size={18} class="text-green-500" />
					{:else}
						<Copy size={18} />
					{/if}
				</button>
				
				<button
					on:click={handleClear}
					class="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
					title={$_('quickNotes__clear') || 'ล้างทั้งหมด'}
				>
					<Trash2 size={18} />
				</button>

				<div class="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>

				<button
					on:click={handleClose}
					class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
				>
					<X size={20} />
				</button>
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-4 tipex-container prose dark:prose-invert max-w-none">
			{#if browser}
				<Tipex 
					body={content} 
					onupdate={handleUpdate}
					bind:tipex={tipexEditor}
					floating={true} 
					focal={true}
					class="h-full border-none outline-none"
				/>
			{/if}
		</div>

		<!-- Footer -->
		<div class="px-5 py-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
			<div class="flex items-center gap-2">
				<span class="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
				<span class="text-[10px] text-gray-400 uppercase tracking-widest font-medium">Auto-saved</span>
			</div>
			<div class="text-[10px] text-gray-400">
				{$quickNotes.length} {$_('quickNotes__characters') || 'ตัวอักษร'} | Notion-style Editor
			</div>
		</div>
	</div>
</div>

<style>
	@keyframes modal-in {
		from {
			opacity: 0;
			transform: scale(0.95) translateY(-10px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.animate-modal-in {
		animation: modal-in 0.2s ease-out;
	}

	:global(.tipex-container .tipex) {
		background: transparent !important;
		border: none !important;
	}

	:global(.tipex-container .tipex-editor) {
		padding: 1rem !important;
		min-height: 40vh;
	}

	/* Fix styling for dark mode */
	:global(.dark .tipex-editor) {
		color: #e2e8f0;
	}
</style>
