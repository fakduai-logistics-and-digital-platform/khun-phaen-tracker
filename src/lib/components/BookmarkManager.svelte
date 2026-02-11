<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { bookmarks, MAX_BOOKMARKS, type Bookmark } from '$lib/stores/bookmarks';
	import { Bookmark as BookmarkIcon, Plus, ExternalLink, Edit2, Trash2, X, GripVertical, AlertCircle } from 'lucide-svelte';

	const dispatch = createEventDispatcher<{ close: void }>();

	let editingId: string | null = null;
	let editTitle = '';
	let editUrl = '';
	let showAddForm = false;
	let newTitle = '';
	let newUrl = '';
	let dragIndex: number | null = null;
	let error = '';

	function isValidUrl(url: string): boolean {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	}

	function ensureProtocol(url: string): string {
		if (!url) return url;
		if (!url.startsWith('http://') && !url.startsWith('https://')) {
			return 'https://' + url;
		}
		return url;
	}

	function startAdd() {
		showAddForm = true;
		newTitle = '';
		newUrl = '';
		error = '';
		editingId = null;
	}

	function cancelAdd() {
		showAddForm = false;
		newTitle = '';
		newUrl = '';
		error = '';
	}

	function saveNew() {
		if (!newTitle.trim()) {
			error = 'กรุณาระบุชื่อลิงก์';
			return;
		}
		if (!newUrl.trim()) {
			error = 'กรุณาระบุ URL';
			return;
		}
		const urlWithProtocol = ensureProtocol(newUrl.trim());
		if (!isValidUrl(urlWithProtocol)) {
			error = 'URL ไม่ถูกต้อง';
			return;
		}
		bookmarks.add(newTitle.trim(), urlWithProtocol);
		showAddForm = false;
		newTitle = '';
		newUrl = '';
		error = '';
	}

	function startEdit(bookmark: Bookmark) {
		editingId = bookmark.id;
		editTitle = bookmark.title;
		editUrl = bookmark.url;
		showAddForm = false;
		error = '';
	}

	function cancelEdit() {
		editingId = null;
		editTitle = '';
		editUrl = '';
		error = '';
	}

	function saveEdit() {
		if (!editTitle.trim()) {
			error = 'กรุณาระบุชื่อลิงก์';
			return;
		}
		const urlWithProtocol = ensureProtocol(editUrl.trim());
		if (!isValidUrl(urlWithProtocol)) {
			error = 'URL ไม่ถูกต้อง';
			return;
		}
		if (editingId) {
			bookmarks.update(editingId, editTitle.trim(), urlWithProtocol);
		}
		editingId = null;
		editTitle = '';
		editUrl = '';
		error = '';
	}

	function remove(id: string) {
		if (confirm('ต้องการลบลิงก์นี้?')) {
			bookmarks.remove(id);
		}
	}

	function handleDragStart(index: number) {
		dragIndex = index;
	}

	function handleDragOver(event: DragEvent, index: number) {
		event.preventDefault();
		if (dragIndex === null || dragIndex === index) return;
		bookmarks.reorder(dragIndex, index);
		dragIndex = index;
	}

	function handleDragEnd() {
		dragIndex = null;
	}

	function openUrl(url: string) {
		window.open(url, '_blank', 'noopener,noreferrer');
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
	class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
	on:click|self={() => dispatch('close')}
>
	<div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col animate-modal-in">
		<!-- Header -->
		<div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
			<div class="flex items-center gap-3">
				<div class="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
					<BookmarkIcon class="text-primary" size={20} />
				</div>
				<div>
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">ที่คั่นลิงก์</h3>
					<p class="text-xs text-gray-500 dark:text-gray-400">{$bookmarks.length} / {MAX_BOOKMARKS} ลิงก์</p>
				</div>
			</div>
			<button
				on:click={() => dispatch('close')}
				class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
			>
				<X size={20} />
			</button>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-5">
			{#if $bookmarks.length === 0 && !showAddForm}
				<div class="text-center py-10">
					<div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
						<BookmarkIcon size={28} class="text-gray-400" />
					</div>
					<p class="text-gray-600 dark:text-gray-300 mb-1">ยังไม่มีลิงก์ที่บันทึก</p>
					<p class="text-sm text-gray-400">กด "เพิ่มลิงก์" เพื่อบันทึกลิงก์ที่ใช้บ่อย</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each $bookmarks as bookmark, index (bookmark.id)}
						<div
							class="group flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-amber-300 dark:hover:border-amber-600 transition-colors"
							draggable={editingId !== bookmark.id}
							on:dragstart={() => handleDragStart(index)}
							on:dragover={(e) => handleDragOver(e, index)}
							on:dragend={handleDragEnd}
						>
							<!-- Drag Handle -->
							{#if editingId !== bookmark.id}
								<div class="cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
									<GripVertical size={16} />
								</div>
							{/if}

							{#if editingId === bookmark.id}
								<!-- Edit Form -->
								<div class="flex-1 space-y-2">
									<input
										type="text"
										bind:value={editTitle}
										placeholder="ชื่อลิงก์"
										class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-gray-700 dark:text-white"
									/>
									<input
										type="text"
										bind:value={editUrl}
										placeholder="https://example.com"
										class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none dark:bg-gray-700 dark:text-white"
									/>
									{#if error}
										<p class="text-xs text-red-500 flex items-center gap-1">
											<AlertCircle size={12} />
											{error}
										</p>
									{/if}
									<div class="flex gap-2">
										<button
											on:click={saveEdit}
											class="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
										>
											บันทึก
										</button>
										<button
											on:click={cancelEdit}
											class="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
										>
											ยกเลิก
										</button>
									</div>
								</div>
							{:else}
								<!-- Display -->
								<button
									on:click={() => openUrl(bookmark.url)}
									class="flex-1 text-left min-w-0"
								>
									<p class="font-medium text-gray-900 dark:text-white truncate">{bookmark.title}</p>
									<p class="text-xs text-gray-500 dark:text-gray-400 truncate">{bookmark.url}</p>
								</button>

								<!-- Actions -->
								<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
									<button
										on:click={() => openUrl(bookmark.url)}
										class="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
										title="เปิดลิงก์"
									>
										<ExternalLink size={14} />
									</button>
									<button
										on:click={() => startEdit(bookmark)}
										class="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
										title="แก้ไข"
									>
										<Edit2 size={14} />
									</button>
									<button
										on:click={() => remove(bookmark.id)}
										class="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
										title="ลบ"
									>
										<Trash2 size={14} />
									</button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			<!-- Add Form -->
			{#if showAddForm}
				<div class="mt-4 p-4 bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/20 dark:border-primary/30">
					<h4 class="text-sm font-medium text-primary dark:text-primary mb-3">เพิ่มลิงก์ใหม่</h4>
					<div class="space-y-3">
						<input
							type="text"
							bind:value={newTitle}
							placeholder="ชื่อลิงก์ (เช่น Jira, GitHub, Figma...)"
							class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none dark:bg-gray-700 dark:text-white"
						/>
						<input
							type="text"
							bind:value={newUrl}
							placeholder="URL (เช่น github.com หรือ https://...)"
							class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none dark:bg-gray-700 dark:text-white"
						/>
						{#if error}
							<p class="text-xs text-red-500 flex items-center gap-1">
								<AlertCircle size={12} />
								{error}
							</p>
						{/if}
						<div class="flex gap-2">
							<button
								on:click={saveNew}
								class="flex-1 px-4 py-2 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg font-medium transition-colors"
							>
								บันทึก
							</button>
							<button
								on:click={cancelAdd}
								class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
							>
								ยกเลิก
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="px-5 py-4 border-t border-gray-200 dark:border-gray-700">
			{#if $bookmarks.length < MAX_BOOKMARKS && !showAddForm}
				<button
					on:click={startAdd}
					class="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg font-medium transition-colors"
				>
					<Plus size={18} />
					เพิ่มลิงก์
				</button>
			{:else if $bookmarks.length >= MAX_BOOKMARKS}
				<p class="text-center text-sm text-gray-500 dark:text-gray-400">
					เต็มแล้ว (สูงสุด {MAX_BOOKMARKS} ลิงก์)
				</p>
			{/if}
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
</style>
