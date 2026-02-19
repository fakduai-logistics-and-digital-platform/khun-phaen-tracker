<script lang="ts">
	import { createEventDispatcher, tick, onDestroy } from 'svelte';
	import { marked } from 'marked';
	import { Bold, Italic, Heading2, Link, Image, Code, List, Quote, Eye, Pencil, ZoomIn, ZoomOut, RotateCcw, X, Download } from 'lucide-svelte';

	const dispatch = createEventDispatcher<{ change: string }>();

	export let value = '';
	export let placeholder = 'Write markdown here...';
	export let rows = 4;

	let mode: 'write' | 'preview' = 'preview';
	let textareaRef: HTMLTextAreaElement;

	// Configure marked for safe rendering
	marked.setOptions({
		breaks: true,
		gfm: true
	});

	$: renderedHtml = (() => {
		try {
			return marked.parse(value || '') as string;
		} catch {
			return value || '';
		}
	})();

	function insertMarkdown(before: string, after: string = '', placeholder_text: string = '') {
		if (!textareaRef) return;

		const start = textareaRef.selectionStart;
		const end = textareaRef.selectionEnd;
		const selected = value.substring(start, end);
		const text = selected || placeholder_text;

		value = value.substring(0, start) + before + text + after + value.substring(end);
		dispatch('change', value);

		void tick().then(() => {
			const cursorPos = start + before.length + (selected ? selected.length : 0);
			textareaRef.focus();
			if (!selected && placeholder_text) {
				textareaRef.setSelectionRange(start + before.length, start + before.length + placeholder_text.length);
			} else {
				textareaRef.setSelectionRange(cursorPos, cursorPos);
			}
		});
	}

	function insertLinePrefix(prefix: string) {
		if (!textareaRef) return;

		const start = textareaRef.selectionStart;
		const lineStart = value.lastIndexOf('\n', start - 1) + 1;

		value = value.substring(0, lineStart) + prefix + value.substring(lineStart);
		dispatch('change', value);

		void tick().then(() => {
			const cursorPos = start + prefix.length;
			textareaRef.focus();
			textareaRef.setSelectionRange(cursorPos, cursorPos);
		});
	}

	function handleBold() { insertMarkdown('**', '**', 'bold text'); }
	function handleItalic() { insertMarkdown('*', '*', 'italic text'); }
	function handleHeading() { insertLinePrefix('## '); }
	function handleCode() { insertMarkdown('`', '`', 'code'); }
	function handleQuote() { insertLinePrefix('> '); }
	function handleList() { insertLinePrefix('- '); }

	function handleLink() {
		const url = 'https://example.com';
		insertMarkdown('[', `](${url})`, 'link text');
	}

	function handleImage() {
		insertMarkdown('![', '](https://image-url.png)', 'alt text');
	}

	async function handlePaste(event: ClipboardEvent) {
		const items = event.clipboardData?.items;
		if (!items) return;

		for (const item of items) {
			if (item.type.startsWith('image/')) {
				event.preventDefault();
				const file = item.getAsFile();
				if (!file) continue;

				const reader = new FileReader();
				reader.onload = (e) => {
					const dataUrl = e.target?.result as string;
					if (!dataUrl) return;
					insertMarkdown(`![pasted image](${dataUrl})`, '', '');
				};
				reader.readAsDataURL(file);
				return;
			}
		}
	}

	function handleInput() {
		dispatch('change', value);
	}

	const toolbarButtons = [
		{ action: handleBold, icon: Bold, title: 'Bold (Ctrl+B)', size: 14 },
		{ action: handleItalic, icon: Italic, title: 'Italic (Ctrl+I)', size: 14 },
		{ action: handleHeading, icon: Heading2, title: 'Heading', size: 14 },
		{ action: handleCode, icon: Code, title: 'Code', size: 14 },
		{ action: handleLink, icon: Link, title: 'Link', size: 14 },
		{ action: handleImage, icon: Image, title: 'Image', size: 14 },
		{ action: handleList, icon: List, title: 'List', size: 14 },
		{ action: handleQuote, icon: Quote, title: 'Quote', size: 14 },
	];

	function handleKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
			event.preventDefault();
			handleBold();
		}
		if ((event.metaKey || event.ctrlKey) && event.key === 'i') {
			event.preventDefault();
			handleItalic();
		}
	}

	// Image lightbox
	let lightboxSrc = '';
	let lightboxAlt = '';
	let lightboxOpen = false;
	let lightboxZoom = 1;
	let lightboxX = 0;
	let lightboxY = 0;
	let isDragging = false;
	let dragStartX = 0;
	let dragStartY = 0;
	let dragStartOffsetX = 0;
	let dragStartOffsetY = 0;

	function openLightbox(src: string, alt: string) {
		lightboxSrc = src;
		lightboxAlt = alt;
		lightboxZoom = 1;
		lightboxX = 0;
		lightboxY = 0;
		lightboxOpen = true;
	}

	function closeLightbox() {
		lightboxOpen = false;
		isDragging = false;
	}

	function zoomIn() { lightboxZoom = Math.min(lightboxZoom + 0.25, 5); }
	function zoomOut() { lightboxZoom = Math.max(lightboxZoom - 0.25, 0.25); }
	function resetZoom() { lightboxZoom = 1; lightboxX = 0; lightboxY = 0; }

	function handleLightboxWheel(event: WheelEvent) {
		event.preventDefault();
		if (event.deltaY < 0) zoomIn(); else zoomOut();
	}

	function handleLightboxMouseDown(event: MouseEvent) {
		if (event.button !== 0) return;
		isDragging = true;
		dragStartX = event.clientX;
		dragStartY = event.clientY;
		dragStartOffsetX = lightboxX;
		dragStartOffsetY = lightboxY;
	}

	function handleLightboxMouseMove(event: MouseEvent) {
		if (!isDragging) return;
		lightboxX = dragStartOffsetX + (event.clientX - dragStartX);
		lightboxY = dragStartOffsetY + (event.clientY - dragStartY);
	}

	function handleLightboxMouseUp() {
		isDragging = false;
	}

	function handlePreviewClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (target.tagName === 'IMG') {
			const img = target as HTMLImageElement;
			openLightbox(img.src, img.alt || 'image');
		}
	}

	function handleLightboxKeydown(event: KeyboardEvent) {
		if (!lightboxOpen) return;
		if (event.key === 'Escape') closeLightbox();
		if (event.key === '+' || event.key === '=') zoomIn();
		if (event.key === '-') zoomOut();
		if (event.key === '0') resetZoom();
	}

	async function downloadImage() {
		try {
			const a = document.createElement('a');
			if (lightboxSrc.startsWith('data:')) {
				a.href = lightboxSrc;
			} else {
				const res = await fetch(lightboxSrc);
				const blob = await res.blob();
				a.href = URL.createObjectURL(blob);
			}
			a.download = (lightboxAlt && lightboxAlt !== 'image' ? lightboxAlt : 'image') + '.png';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
		} catch (e) {
			console.error('Download failed:', e);
		}
	}
</script>

<div class="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
	<!-- Tab bar + Toolbar -->
	<div class="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600 px-2 py-1">
		<!-- Tabs -->
		<div class="flex items-center gap-1">
			<button
				type="button"
				on:click={() => mode = 'write'}
				class="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors {mode === 'write' ? 'text-primary bg-white dark:bg-gray-800 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}"
			>
				<Pencil size={12} />
				Write
			</button>
			<button
				type="button"
				on:click={() => mode = 'preview'}
				class="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors {mode === 'preview' ? 'text-primary bg-white dark:bg-gray-800 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}"
			>
				<Eye size={12} />
				Preview
			</button>
		</div>

		<!-- Toolbar (only in write mode) -->
		{#if mode === 'write'}
			<div class="flex items-center gap-0.5">
				{#each toolbarButtons as btn}
					<button
						type="button"
						on:click={btn.action}
						class="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
						title={btn.title}
					>
						<svelte:component this={btn.icon} size={btn.size} />
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Content -->
	{#if mode === 'write'}
		<textarea
			bind:this={textareaRef}
			bind:value
			on:input={handleInput}
			on:paste={handlePaste}
			on:keydown={handleKeydown}
			{rows}
			{placeholder}
			class="w-full px-3 py-2 border-none outline-none resize-none dark:bg-gray-700 dark:text-white text-sm font-mono leading-relaxed"
		></textarea>
	{:else}
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			class="markdown-preview px-3 py-2 min-h-[{rows * 1.625}rem] text-sm prose prose-sm dark:prose-invert max-w-none overflow-auto"
			on:click={handlePreviewClick}
		>
			{#if value.trim()}
				{@html renderedHtml}
			{:else}
				<p class="text-gray-400 dark:text-gray-500 italic">Nothing to preview</p>
			{/if}
		</div>
	{/if}
</div>

{#if lightboxOpen}
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center !m-0"
		on:click|self={closeLightbox}
		on:wheel|preventDefault={handleLightboxWheel}
		on:keydown={handleLightboxKeydown}
		tabindex="-1"
		role="dialog"
		aria-modal="true"
		aria-label="Image viewer"
	>
		<!-- Controls -->
		<div class="absolute top-4 right-4 flex items-center gap-2 z-10">
			<span class="text-white/70 text-sm font-mono bg-black/40 px-2 py-1 rounded">{Math.round(lightboxZoom * 100)}%</span>
			<button type="button" on:click={zoomIn} class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors" title="Zoom in (+)">
				<ZoomIn size={20} />
			</button>
			<button type="button" on:click={zoomOut} class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors" title="Zoom out (-)">
				<ZoomOut size={20} />
			</button>
			<button type="button" on:click={resetZoom} class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors" title="Reset (0)">
				<RotateCcw size={20} />
			</button>
			<button type="button" on:click={downloadImage} class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors" title="Download">
				<Download size={20} />
			</button>
			<button type="button" on:click={closeLightbox} class="p-2 bg-black/40 hover:bg-red-600/80 text-white rounded-lg transition-colors" title="Close (Esc)">
				<X size={20} />
			</button>
		</div>

		<!-- Image -->
		<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
		<img
			src={lightboxSrc}
			alt={lightboxAlt}
			class="max-w-[90vw] max-h-[85vh] object-contain select-none {isDragging ? 'cursor-grabbing' : 'cursor-grab transition-transform duration-150'}"
			style="transform: scale({lightboxZoom}) translate({lightboxX / lightboxZoom}px, {lightboxY / lightboxZoom}px);"
			on:mousedown={handleLightboxMouseDown}
			on:mousemove={handleLightboxMouseMove}
			on:mouseup={handleLightboxMouseUp}
			on:mouseleave={handleLightboxMouseUp}
			draggable="false"
		/>

		<!-- Alt text -->
		{#if lightboxAlt && lightboxAlt !== 'image'}
			<div class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white/80 text-sm px-4 py-1.5 rounded-full">
				{lightboxAlt}
			</div>
		{/if}
	</div>
{/if}

<style>
	.markdown-preview :global(img) {
		max-width: 100%;
		border-radius: 0.5rem;
		margin: 0.5rem 0;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.markdown-preview :global(img:hover) {
		opacity: 0.85;
	}

	.markdown-preview :global(a) {
		color: var(--color-primary, #3b82f6);
		text-decoration: underline;
		word-break: break-all;
	}

	.markdown-preview :global(a:hover) {
		opacity: 0.8;
	}

	.markdown-preview :global(code) {
		background: rgba(0, 0, 0, 0.05);
		padding: 0.15em 0.4em;
		border-radius: 0.25rem;
		font-size: 0.85em;
	}

	:global(.dark) .markdown-preview :global(code) {
		background: rgba(255, 255, 255, 0.1);
	}

	.markdown-preview :global(pre) {
		background: rgba(0, 0, 0, 0.05);
		padding: 0.75rem;
		border-radius: 0.5rem;
		overflow-x: auto;
	}

	:global(.dark) .markdown-preview :global(pre) {
		background: rgba(255, 255, 255, 0.05);
	}

	.markdown-preview :global(blockquote) {
		border-left: 3px solid #d1d5db;
		padding-left: 0.75rem;
		color: #6b7280;
		margin: 0.5rem 0;
	}

	:global(.dark) .markdown-preview :global(blockquote) {
		border-color: #4b5563;
		color: #9ca3af;
	}

	.markdown-preview :global(h1),
	.markdown-preview :global(h2),
	.markdown-preview :global(h3) {
		margin-top: 0.75rem;
		margin-bottom: 0.25rem;
		font-weight: 700;
	}

	.markdown-preview :global(ul),
	.markdown-preview :global(ol) {
		padding-left: 1.25rem;
		margin: 0.25rem 0;
	}

	.markdown-preview :global(p) {
		margin: 0.25rem 0;
	}

	.markdown-preview :global(hr) {
		border-color: #e5e7eb;
		margin: 0.75rem 0;
	}

	:global(.dark) .markdown-preview :global(hr) {
		border-color: #374151;
	}
</style>
