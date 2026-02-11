<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import type { Task, Project, Assignee, Sprint } from '$lib/types';
	import { CATEGORIES } from '$lib/types';
	import { Calendar, FileText, Tag, CheckCircle, User, Plus, Folder, X, Flag, GitBranch, Copy, Check } from 'lucide-svelte';
	import { taskDefaults } from '$lib/stores/taskDefaults';
	import SearchableSelect from './SearchableSelect.svelte';
	import CustomDatePicker from './CustomDatePicker.svelte';
	import SearchableSprintSelect from './SearchableSprintSelect.svelte';

	const dispatch = createEventDispatcher<{
		submit: Omit<Task, 'id' | 'created_at'>;
		cancel: void;
		close: void;
		addAssignee: { name: string; color: string };
	}>();

	export let show = false;
	export let editingTask: Task | null = null;
	export let assignees: Assignee[] = [];
	export let projects: Project[] = [];
	export let sprints: Sprint[] = [];

	let title = editingTask?.title || '';
	let project = editingTask?.project || '';
	let date = editingTask?.date || new Date().toISOString().split('T')[0];
	let status: Task['status'] = editingTask?.status || 'todo';
	let category = editingTask?.category || 'งานหลัก';
	let notes = editingTask?.notes || '';
	let assignee_id = editingTask?.assignee_id || null;
	let sprint_id: number | null = editingTask?.sprint_id || null;

	$: activeSprint = sprints.find(s => s.status === 'active');

	// New assignee form state
	let showAddAssigneeForm = false;
	let newAssigneeName = '';
	let newAssigneeColor = '#6366F1';

	const colorOptions = [
		'#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E',
		'#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6',
		'#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
		'#F43F5E', '#78716C', '#6B7280', '#4B5563', '#1F2937'
	];

	const gitFlowTypes = ['feature', 'bugfix', 'hotfix', 'release'] as const;
	type GitFlowType = typeof gitFlowTypes[number];

	interface BuiltInTranslatorInstance {
		translate(input: string): Promise<string>;
		destroy?: () => void;
	}

	interface BuiltInTranslator {
		availability?: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<string>;
		create: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<BuiltInTranslatorInstance>;
	}

	const TRANSLATOR_OPTIONS = {
		sourceLanguage: 'th',
		targetLanguage: 'en'
	} as const;

	let gitFlowType: GitFlowType = 'feature';
	let translatedTitle = '';
	let branchSlug = '';
	let branchMessage = 'พิมพ์ชื่องาน แล้วระบบจะช่วยสร้างชื่อ branch';
	let branchMessageType: 'info' | 'success' | 'error' = 'info';
	let isTranslatingBranch = false;
	let copySucceeded = false;
	let branchName = 'feature/untitled-task';

	let translator: BuiltInTranslatorInstance | null = null;
	let translatorInitPromise: Promise<BuiltInTranslatorInstance | null> | null = null;
	let branchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
	let branchRequestId = 0;
	let showBranchDialog = false;
	let formInitKey = 'closed';

	$: branchName = `${gitFlowType}/${branchSlug || 'untitled-task'}`;

	function getTranslatorApi(): BuiltInTranslator | null {
		if (typeof window === 'undefined') return null;
		const maybeTranslator = (window as unknown as { Translator?: BuiltInTranslator }).Translator;
		if (!maybeTranslator || typeof maybeTranslator.create !== 'function') return null;
		return maybeTranslator;
	}

	async function createTranslatorInstance(): Promise<BuiltInTranslatorInstance | null> {
		const translatorApi = getTranslatorApi();
		if (!translatorApi) return null;

		try {
			if (typeof translatorApi.availability === 'function') {
				const availability = await translatorApi.availability(TRANSLATOR_OPTIONS);
				if (availability === 'unavailable') return null;
			}
			return await translatorApi.create(TRANSLATOR_OPTIONS);
		} catch (error) {
			console.warn('Translator API unavailable:', error);
			return null;
		}
	}

	async function getOrCreateTranslator(): Promise<BuiltInTranslatorInstance | null> {
		if (translator) return translator;
		if (!translatorInitPromise) {
			translatorInitPromise = createTranslatorInstance()
				.then((instance) => {
					translator = instance;
					return instance;
				})
				.finally(() => {
					translatorInitPromise = null;
				});
		}
		return translatorInitPromise;
	}

	function slugifyBranchSegment(input: string): string {
		if (!input || !input.trim()) return "";
		
		return input
			.normalize("NFKD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/["']/g, "")
			.toLowerCase()
			.trim()
			.replace(/&/g, " and ")
			.replace(/\s+/g, "-")              // Replace spaces with hyphens explicitly
			.replace(/[^a-z0-9-]+/g, "-")       // Replace other non-alphanumeric (except hyphens)
			.replace(/-{2,}/g, "-")             // Collapse multiple hyphens
			.replace(/^-+|-+$/g, "");           // Trim leading/trailing hyphens
	}

	function getBranchMessageClass(): string {
		if (branchMessageType === 'error') return 'text-danger';
		if (branchMessageType === 'success') return 'text-success';
		return 'text-gray-500 dark:text-gray-400';
	}

	function clearCopyFeedbackTimer() {
		if (!copyFeedbackTimer) return;
		clearTimeout(copyFeedbackTimer);
		copyFeedbackTimer = null;
	}

	function clearBranchDebounceTimer() {
		if (!branchDebounceTimer) return;
		clearTimeout(branchDebounceTimer);
		branchDebounceTimer = null;
	}

	function resetBranchHelper() {
		clearBranchDebounceTimer();
		clearCopyFeedbackTimer();
		branchRequestId += 1;
		gitFlowType = 'feature';
		translatedTitle = '';
		branchSlug = '';
		branchMessage = 'พิมพ์ชื่องาน แล้วระบบจะช่วยสร้างชื่อ branch';
		branchMessageType = 'info';
		isTranslatingBranch = false;
		copySucceeded = false;
	}

	// Free translation API using MyMemory (1000 words/day free, no key required)
	// Falls back to Chrome Translator API if available
	async function translateTitle(input: string): Promise<{ text: string; translated: boolean }> {
		const cleaned = input.trim();
		if (!cleaned) return { text: '', translated: false };

		// Check if text is already English (only ASCII characters)
		const isEnglish = /^[\x00-\x7F]+$/.test(cleaned.replace(/\s/g, ''));
		if (isEnglish) return { text: cleaned, translated: false };

		// Try MyMemory API first (works on all browsers)
		try {
			const encodedText = encodeURIComponent(cleaned);
			const response = await fetch(
				`https://api.mymemory.translated.net/get?q=${encodedText}&langpair=th|en`,
				{ signal: AbortSignal.timeout(5000) }
			);
			
			if (response.ok) {
				const data = await response.json();
				if (data.responseStatus === 200 && data.responseData?.translatedText) {
					const translatedText = data.responseData.translatedText.trim();
					if (translatedText && translatedText.toLowerCase() !== cleaned.toLowerCase()) {
						return { text: translatedText, translated: true };
					}
				}
			}
		} catch (error) {
			console.warn('MyMemory API failed:', error);
		}

		// Fallback to Chrome Translator API if available
		const translatorInstance = await getOrCreateTranslator();
		if (translatorInstance) {
			try {
				const translatedText = (await translatorInstance.translate(cleaned)).trim();
				if (translatedText) return { text: translatedText, translated: true };
			} catch (error) {
				console.warn('Chrome Translator API failed:', error);
			}
		}

		// Final fallback: use original text with basic transliteration
		return { text: cleaned, translated: false };
	}

	async function updateBranchPreview(rawTitle: string) {
		const cleanedTitle = rawTitle.trim();
		const requestId = ++branchRequestId;

		if (!cleanedTitle) {
			translatedTitle = '';
			branchSlug = '';
			branchMessage = 'พิมพ์ชื่องาน แล้วระบบจะช่วยสร้างชื่อ branch';
			branchMessageType = 'info';
			isTranslatingBranch = false;
			return;
		}

		isTranslatingBranch = true;
		branchMessage = 'กำลังแปลชื่อ task เป็นภาษาอังกฤษ...';
		branchMessageType = 'info';

		const { text, translated } = await translateTitle(cleanedTitle);
		if (requestId !== branchRequestId) return;

		translatedTitle = text;
		branchSlug = slugifyBranchSegment(text) || 'untitled-task';
		isTranslatingBranch = false;

		if (translated) {
			branchMessage = 'แปลเป็นภาษาอังกฤษแล้ว';
			branchMessageType = 'success';
		} else {
			branchMessage = 'ใช้ชื่อเดิม (ภาษาไทยหรือแปลไม่สำเร็จ)';
			branchMessageType = 'info';
		}
	}

	function queueBranchPreviewUpdate(rawTitle: string) {
		clearBranchDebounceTimer();

		if (!rawTitle.trim()) {
			void updateBranchPreview(rawTitle);
			return;
		}

		branchDebounceTimer = setTimeout(() => {
			void updateBranchPreview(rawTitle);
		}, 300);
	}

	function openBranchDialog() {
		showBranchDialog = true;
		copySucceeded = false;
		clearCopyFeedbackTimer();
		void getOrCreateTranslator();
		queueBranchPreviewUpdate(title);
	}

	function closeBranchDialog() {
		showBranchDialog = false;
	}

	async function handleCopyBranchName() {
		const cleanedTitle = title.trim();
		if (!cleanedTitle) return;

		await getOrCreateTranslator();
		await updateBranchPreview(cleanedTitle);

		if (!navigator.clipboard?.writeText) {
			branchMessage = 'เบราว์เซอร์ไม่รองรับการคัดลอกอัตโนมัติ';
			branchMessageType = 'error';
			return;
		}

		try {
			await navigator.clipboard.writeText(branchName);
			copySucceeded = true;
			branchMessage = `คัดลอกแล้ว: ${branchName}`;
			branchMessageType = 'success';
			clearCopyFeedbackTimer();
			copyFeedbackTimer = setTimeout(() => {
				copySucceeded = false;
			}, 2000);
		} catch (error) {
			console.error('Copy branch failed:', error);
			branchMessage = 'คัดลอกไม่สำเร็จ กรุณาลองใหม่';
			branchMessageType = 'error';
		}
	}

	function initializeFormState() {
		if (editingTask) {
			// Edit mode - use task values
			title = editingTask.title || '';
			project = editingTask.project || '';
			date = editingTask.date || new Date().toISOString().split('T')[0];
			status = editingTask.status || 'todo';
			category = editingTask.category || 'งานหลัก';
			notes = editingTask.notes || '';
			assignee_id = editingTask.assignee_id || null;
			sprint_id = editingTask.sprint_id || null;
		} else {
			// Add mode - use default values from store
			title = '';
			project = $taskDefaults.project || '';
			date = new Date().toISOString().split('T')[0];
			status = 'todo';
			category = $taskDefaults.category || 'งานหลัก';
			notes = '';
			assignee_id = $taskDefaults.assignee_id || null;
			sprint_id = activeSprint?.id || null;
		}

		resetBranchHelper();
		showAddAssigneeForm = false;
		newAssigneeName = '';
		newAssigneeColor = '#6366F1';
		showBranchDialog = false;
	}

	// Reset form only when opening dialog or switching edit context
	$: {
		const nextFormInitKey = show ? `${editingTask?.id ?? 'new'}:${editingTask?.created_at ?? ''}` : 'closed';
		if (show && nextFormInitKey !== formInitKey) {
			initializeFormState();
		}
		formInitKey = nextFormInitKey;
	}

	// Keep branch preview synced while branch dialog is open
	$: if (showBranchDialog) {
		queueBranchPreviewUpdate(title);
	}

	function handleSubmit() {
		if (!title.trim()) return;

		// Save defaults for next time (only if adding new task)
		if (!editingTask) {
			taskDefaults.set({
				project: project.trim(),
				assignee_id,
				category
			});
		}

		dispatch('submit', {
			title: title.trim(),
			project: project.trim(),
			duration_minutes: 0,
			date,
			status,
			category,
			notes: notes.trim(),
			assignee_id,
			sprint_id
		});
	}

	function handleClose() {
		dispatch('close');
	}

	function handleCancel() {
		dispatch('cancel');
	}

	function handleAddAssignee() {
		if (!newAssigneeName.trim()) return;

		dispatch('addAssignee', {
			name: newAssigneeName.trim(),
			color: newAssigneeColor
		});

		newAssigneeName = '';
		newAssigneeColor = '#6366F1';
		showAddAssigneeForm = false;
	}

	function cancelAddAssignee() {
		newAssigneeName = '';
		newAssigneeColor = '#6366F1';
		showAddAssigneeForm = false;
	}

	function getAssigneeById(id: number | null): Assignee | undefined {
		return assignees.find(a => a.id === id);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (showBranchDialog) {
				closeBranchDialog();
				return;
			}
			handleClose();
		}
	}

	onMount(() => {
		document.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		document.removeEventListener('keydown', handleKeydown);
		clearBranchDebounceTimer();
		clearCopyFeedbackTimer();
		if (translator?.destroy) {
			translator.destroy();
		}
		translator = null;
	});
</script>

{#if show}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
		on:click|self={handleClose}
	>
		<div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-modal-in">
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
					<CheckCircle size={20} class="text-primary" />
					{editingTask ? 'แก้ไขงาน' : 'เพิ่มงานใหม่'}
				</h2>
				<div class="flex items-center gap-2">
					<button
						type="button"
						on:click={openBranchDialog}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
						title="Branch"
					>
						<GitBranch size={14} />
						<span>Branch</span>
					</button>

					<button
						type="button"
						on:click={handleClose}
						class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
					>
						<X size={20} />
					</button>
				</div>
			</div>

			<!-- Form Content -->
			<form on:submit|preventDefault={handleSubmit} class="p-6 space-y-4">
				<div>
					<label for="title" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						ชื่องาน <span class="text-danger">*</span>
					</label>
					<input
						id="title"
						type="text"
						bind:value={title}
						placeholder="เช่น ออกแบบโลโก้, เขียนรายงาน..."
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-gray-700 dark:text-white"
						required
					/>
				</div>

				<div>
					<label for="project" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
						<Folder size={14} />
						โปรเจค
					</label>
					<SearchableSelect
						id="project"
						bind:value={project}
						options={[
							{ value: '', label: '-- ไม่ระบุ --' },
							...projects.map(proj => ({ value: proj.name, label: proj.name }))
						]}
						placeholder="ค้นหาโปรเจค..."
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
							<Calendar size={14} />
							วันที่นัดหมาย (Due Date)
						</label>
						<CustomDatePicker
							bind:value={date}
							placeholder="เลือกวันที่..."
							on:select={(e) => date = e.detail}
						/>
					</div>

					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
							<Tag size={14} />
							หมวดหมู่
						</label>
						<SearchableSelect
							bind:value={category}
							options={CATEGORIES.map(cat => ({ value: cat, label: cat }))}
							placeholder="เลือกหมวดหมู่..."
							showSearch={false}
						/>
					</div>
				</div>

				<!-- Assignee Section -->
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
						<User size={14} />
						ผู้รับผิดชอบ
					</label>

					{#if showAddAssigneeForm}
						<div class="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg space-y-3">
							<div>
								<label for="new-assignee-name" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">ชื่อ</label>
								<input
									id="new-assignee-name"
									type="text"
									bind:value={newAssigneeName}
									placeholder="ชื่อผู้รับผิดชอบ..."
									class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm dark:bg-gray-700 dark:text-white"
								/>
							</div>
							<div>
								<label for="new-assignee-color-picker" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">สีประจำตัว</label>
								<div class="flex flex-wrap gap-1.5 mb-2">
									{#each colorOptions as color}
										<button
											type="button"
											on:click={() => newAssigneeColor = color}
											aria-label={`เลือกสี ${color}`}
											class="w-6 h-6 rounded-full border-2 transition-all {newAssigneeColor === color ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent hover:scale-105'}"
											style="background-color: {color}"
										></button>
									{/each}
								</div>
								<div class="flex items-center gap-2">
									<input
										id="new-assignee-color-picker"
										type="color"
										bind:value={newAssigneeColor}
										class="w-10 h-8 rounded cursor-pointer border border-gray-300 dark:border-gray-600"
									/>
									<input
										type="text"
										bind:value={newAssigneeColor}
										placeholder="#6366F1"
										class="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-gray-700 dark:text-white"
										maxlength="7"
									/>
									<div
										class="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600"
										style="background-color: {newAssigneeColor}"
									></div>
								</div>
							</div>
							<div class="flex gap-2 pt-1">
								<button
									type="button"
									on:click={handleAddAssignee}
									disabled={!newAssigneeName.trim()}
									class="flex-1 bg-primary hover:bg-primary-dark disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white py-1.5 px-3 rounded-lg text-sm font-medium transition-colors"
								>
									เพิ่ม
								</button>
								<button
									type="button"
									on:click={cancelAddAssignee}
									class="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
								>
									ยกเลิก
								</button>
							</div>
						</div>
					{:else}
						<div class="flex gap-2">
							<div class="flex-1">
								<SearchableSelect
									bind:value={assignee_id}
									options={[
										{ value: null, label: '-- ไม่ระบุ --' },
										...assignees
										.filter((assignee): assignee is typeof assignee & { id: number } => assignee.id !== undefined)
										.map(assignee => ({ 
											value: assignee.id, 
											label: assignee.name,
											badge: true,
											badgeColor: assignee.color
										}))
									]}
									placeholder="ค้นหาผู้รับผิดชอบ..."
								/>
							</div>
							<button
								type="button"
								on:click={() => showAddAssigneeForm = true}
								class="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
								title="เพิ่มผู้รับผิดชอบใหม่"
							>
								<Plus size={16} />
							</button>
						</div>

							{#if assignee_id}
								{@const selectedAssignee = getAssigneeById(assignee_id)}
								{#if selectedAssignee}
									<div class="mt-2 flex items-center gap-2 text-sm">
										<span class="w-3 h-3 rounded-full" style="background-color: {selectedAssignee.color}"></span>
										<span class="text-gray-600 dark:text-gray-400">{selectedAssignee.name}</span>
									</div>
								{/if}
							{/if}
					{/if}
				</div>

				<!-- Sprint Section -->
				{#if sprints.length > 0}
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
							<Flag size={14} />
							Sprint
						</label>
						<SearchableSprintSelect
							sprints={sprints.filter(s => s.status !== 'completed')}
							bind:value={sprint_id}
							id="task-sprint"
							formMode={true}
						/>
					</div>
				{/if}

				<div>
					<label for="status" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">สถานะ</label>
					<div class="flex gap-2">
						<button
							type="button"
							on:click={() => status = 'todo'}
							class="flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors {status === 'todo' ? 'border-warning bg-warning/10 text-warning' : 'border-gray-200 dark:border-gray-600 hover:border-warning/50 dark:text-gray-300'}"
						>
							รอดำเนินการ
						</button>
						<button
							type="button"
							on:click={() => status = 'in-progress'}
							class="flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors {status === 'in-progress' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 dark:border-gray-600 hover:border-primary/50 dark:text-gray-300'}"
						>
							กำลังทำ
						</button>
						<button
							type="button"
							on:click={() => status = 'done'}
							class="flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors {status === 'done' ? 'border-success bg-success/10 text-success' : 'border-gray-200 dark:border-gray-600 hover:border-success/50 dark:text-gray-300'}"
						>
							เสร็จแล้ว
						</button>
					</div>
				</div>

				<div>
					<label for="notes" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
						<FileText size={14} />
						หมายเหตุ
					</label>
					<textarea
						id="notes"
						bind:value={notes}
						rows="3"
						placeholder="รายละเอียดเพิ่มเติม..."
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none dark:bg-gray-700 dark:text-white"
					></textarea>
				</div>

				<div class="flex gap-3 pt-2">
					<button
						type="button"
						on:click={handleClose}
						class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
					>
						ยกเลิก
					</button>
					<button
						type="submit"
						class="flex-1 bg-primary hover:bg-primary-dark text-white py-2 px-4 rounded-lg font-medium transition-colors"
					>
						{editingTask ? 'บันทึกการแก้ไข' : 'เพิ่มงาน'}
					</button>
				</div>
			</form>
		</div>

		{#if showBranchDialog}
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class="fixed inset-0 bg-black/40 flex items-center justify-center z-[70] p-4"
				on:click|self={closeBranchDialog}
			>
				<div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
					<div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
						<h3 class="text-base font-semibold text-gray-800 dark:text-white flex items-center gap-2">
							<GitBranch size={18} class="text-primary" />
							สร้างชื่อ Branch
						</h3>
						<button
							type="button"
							on:click={closeBranchDialog}
							class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
						>
							<X size={18} />
						</button>
					</div>

					<div class="px-5 py-4 space-y-3">
						<div>
								<label for="branch-task-title" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Task Title</label>
								<input
									id="branch-task-title"
									type="text"
									value={title}
								readonly
								class="w-full h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200 text-sm"
							/>
						</div>

						<div>
								<label for="git-flow-prefix" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Git Flow Prefix</label>
								<select
									id="git-flow-prefix"
									bind:value={gitFlowType}
								class="w-full h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
							>
								{#each gitFlowTypes as flow}
									<option value={flow}>{flow}</option>
								{/each}
							</select>
						</div>

						<div>
								<label for="branch-name-preview" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Branch Name</label>
								<div class="flex gap-2">
									<input
										id="branch-name-preview"
										type="text"
									value={branchName}
									readonly
									on:focus={(event) => (event.currentTarget as HTMLInputElement).select()}
									class="flex-1 h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-mono text-sm"
								/>
								<button
									type="button"
									on:click={handleCopyBranchName}
									disabled={!title.trim() || isTranslatingBranch}
									class="h-10 px-3 inline-flex items-center gap-1.5 bg-primary hover:bg-primary-dark disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
									title="คัดลอกชื่อ branch"
								>
									{#if copySucceeded}
										<Check size={15} />
										Copied
									{:else}
										<Copy size={15} />
										Copy
									{/if}
								</button>
							</div>
						</div>

						<div class="text-xs {getBranchMessageClass()}">
							{#if !title.trim()}
								กรอกชื่องานก่อน เพื่อสร้างชื่อ branch อัตโนมัติ
							{:else if isTranslatingBranch}
								กำลังแปลชื่อ task เป็นภาษาอังกฤษ...
							{:else}
								<span class="text-gray-500 dark:text-gray-400">
									ชื่ออังกฤษ: <span class="font-medium text-gray-700 dark:text-gray-200">{translatedTitle || '-'}</span>
								</span>
								<span class="mx-1 text-gray-400">•</span>
								<span>{branchMessage}</span>
							{/if}
						</div>
					</div>

					<div class="px-5 pb-4 flex justify-end">
						<button
							type="button"
							on:click={closeBranchDialog}
							class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
						>
							ปิด
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}

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
