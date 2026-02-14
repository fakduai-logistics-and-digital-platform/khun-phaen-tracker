<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { FileText, X, Trash2, Copy, Check } from 'lucide-svelte';
	import { quickNotes } from '$lib/stores/quickNotes';
	import { _ } from 'svelte-i18n';

	const dispatch = createEventDispatcher<{ close: void }>();

	let copied = false;
	let textareaRef: HTMLTextAreaElement;

	function handleClose() {
		dispatch('close');
	}

	function handleClear() {
		if (confirm($_('quickNotes__clear_confirm') || 'ต้องการล้างบันทึกทั้งหมดหรือไม่?')) {
			quickNotes.clear();
		}
	}

	async function handleCopy() {
		try {
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

	onMount(() => {
		if (textareaRef) {
			textareaRef.focus();
		}
	});
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
	class="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm"
	on:click|self={handleClose}
>
	<div 
		class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full h-[70vh] flex flex-col animate-modal-in"
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
		<div class="flex-1 p-5 relative">
			<textarea
				bind:this={textareaRef}
				class="w-full h-full resize-none bg-transparent text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none font-sans leading-relaxed"
				placeholder={$_('quickNotes__placeholder') || 'พิมพ์บันทึกของคุณที่นี่...'}
				bind:value={$quickNotes}
			></textarea>
			
			<!-- Bottom Status -->
			<div class="absolute bottom-2 right-5 text-[10px] text-gray-400 pointer-events-none">
				{$quickNotes.length} {$_('quickNotes__characters') || 'ตัวอักษร'} | Auto-saved
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

	textarea {
		scrollbar-width: thin;
		scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
	}
</style>
