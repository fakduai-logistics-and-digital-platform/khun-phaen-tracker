<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { _ } from 'svelte-i18n';
  import { GitBranch, X, Copy, Check, ChevronDown } from 'lucide-svelte';
  import { currentWorkspaceName, currentWorkspaceShortName } from '$lib/stores/workspace';
  import {
    getBranchSlug as buildBranchSlug,
    getBranchPrefixForTaskType,
    getCheckoutCommand as buildCheckoutCommand,
    getComputedBranchName as buildComputedBranchName,
    type GitFlowType,
    type TaskType
  } from '$lib/utils/branch-name';

  const dispatch = createEventDispatcher<{ close: void }>();

  export let show = false;
  export let title = '';
  export let gitFlowType: GitFlowType = 'feature';
  export let workspaceShortName = '';
  export let taskNumber: number | null = null;
  export let taskType: TaskType | null | undefined = undefined;

  const gitFlowTypes: readonly GitFlowType[] = [
    'feature',
    'bugfix',
    'hotfix',
    'release',
    'perf',
    'refactor',
    'docs',
    'chore'
  ] as const;

  let editableTitle = '';
  let translatedTitle = '';
  let branchMessage = '';
  let branchMessageType: 'info' | 'success' | 'error' = 'info';
  let isTranslatingBranch = false;
  let copySucceeded = false;
  let copiedField: 'branch' | 'command' | null = null;
  let wasOpen = false;
  let userOverrodePrefix = false;
  let lastSyncedTaskType: TaskType | null | undefined = undefined;

  let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
  let translateDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let activeTranslateRequestId = 0;

  interface BuiltInTranslatorInstance {
    translate(input: string): Promise<string>;
    destroy?: () => void;
  }

  interface BuiltInTranslator {
    availability?: (options: {
      sourceLanguage: string;
      targetLanguage: string;
    }) => Promise<string>;
    create: (options: {
      sourceLanguage: string;
      targetLanguage: string;
    }) => Promise<BuiltInTranslatorInstance>;
  }

  const TRANSLATOR_OPTIONS = {
    sourceLanguage: 'th',
    targetLanguage: 'en'
  } as const;

  let translator: BuiltInTranslatorInstance | null = null;
  let translatorInitPromise: Promise<BuiltInTranslatorInstance | null> | null = null;

  function getBranchMessageClass(): string {
    if (branchMessageType === 'error') return 'text-danger';
    if (branchMessageType === 'success') return 'text-success';
    return 'text-gray-500 dark:text-gray-400';
  }

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

  function getBranchSlug(): string {
    return buildBranchSlug({
      translatedTitle,
      editableTitle,
      title,
      workspaceShortName: effectiveWorkspaceShortName,
      taskNumber
    });
  }

  $: workspaceNameFallback = ($currentWorkspaceName || '')
    .replace(/\s+/g, '')
    .slice(0, 4)
    .toUpperCase();
  $: effectiveWorkspaceShortName =
    workspaceShortName.trim() || $currentWorkspaceShortName || workspaceNameFallback;

  $: computedBranchName = buildComputedBranchName({
    gitFlowType,
    workspaceShortName: effectiveWorkspaceShortName,
    taskNumber,
    translatedTitle,
    editableTitle,
    title
  });

  $: checkoutCommand = buildCheckoutCommand({
    gitFlowType,
    workspaceShortName: effectiveWorkspaceShortName,
    taskNumber,
    translatedTitle,
    editableTitle,
    title
  });

  async function translateTitle(input: string): Promise<{ text: string; translated: boolean }> {
    const cleaned = input.trim();
    if (!cleaned) return { text: '', translated: false };

    const isEnglish = /^[\x00-\x7F]+$/.test(cleaned.replace(/\s/g, ''));
    if (isEnglish) return { text: cleaned, translated: false };

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

    const translatorInstance = await getOrCreateTranslator();
    if (translatorInstance) {
      try {
        const translatedText = (await translatorInstance.translate(cleaned)).trim();
        if (translatedText) return { text: translatedText, translated: true };
      } catch (error) {
        console.warn('Chrome Translator API failed:', error);
      }
    }

    return { text: cleaned, translated: false };
  }

  async function updateBranchPreview(rawTitle: string) {
    const cleanedTitle = rawTitle.trim();
    const requestId = ++activeTranslateRequestId;

    if (!cleanedTitle) {
      translatedTitle = '';
      branchMessage = 'พิมพ์ชื่องาน แล้วระบบจะช่วยสร้างชื่อ branch';
      branchMessageType = 'info';
      isTranslatingBranch = false;
      return;
    }

    isTranslatingBranch = true;
    branchMessage = 'กำลังแปลชื่อ task เป็นภาษาอังกฤษ...';
    branchMessageType = 'info';
    translatedTitle = '';

    const { text, translated } = await translateTitle(cleanedTitle);
    if (requestId !== activeTranslateRequestId) return;

    translatedTitle = text;
    isTranslatingBranch = false;

    if (translated) {
      branchMessage = 'แปลเป็นภาษาอังกฤษแล้ว';
      branchMessageType = 'success';
    } else {
      branchMessage = 'ใช้ชื่อเดิม (ภาษาไทยหรือแปลไม่สำเร็จ)';
      branchMessageType = 'info';
    }
  }

  function scheduleBranchPreview(rawTitle: string) {
    if (translateDebounceTimer) clearTimeout(translateDebounceTimer);
    translateDebounceTimer = setTimeout(() => {
      void updateBranchPreview(rawTitle);
    }, 1000);
  }

  async function handleCopyBranchName() {
    const cleanedTitle = editableTitle.trim();
    if (!cleanedTitle) return;

    await getOrCreateTranslator();
    await updateBranchPreview(cleanedTitle);

    if (!navigator.clipboard?.writeText) {
      branchMessage = 'เบราว์เซอร์ไม่รองรับการคัดลอกอัตโนมัติ';
      branchMessageType = 'error';
      return;
    }

    const branchName = computedBranchName;

    try {
      await navigator.clipboard.writeText(branchName);
      copySucceeded = true;
      copiedField = 'branch';
      branchMessage = `คัดลอกแล้ว: ${branchName}`;
      branchMessageType = 'success';

      if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer);
      copyFeedbackTimer = setTimeout(() => {
        copySucceeded = false;
        copiedField = null;
      }, 2000);
    } catch (error) {
      console.error('Copy branch failed:', error);
      branchMessage = 'คัดลอกไม่สำเร็จ กรุณาลองใหม่';
      branchMessageType = 'error';
    }
  }

  async function handleCopyCheckoutCommand() {
    const cleanedTitle = editableTitle.trim();
    if (!cleanedTitle) return;

    await getOrCreateTranslator();
    await updateBranchPreview(cleanedTitle);

    if (!navigator.clipboard?.writeText) {
      branchMessage = 'เบราว์เซอร์ไม่รองรับการคัดลอกอัตโนมัติ';
      branchMessageType = 'error';
      return;
    }

    const checkoutCommandValue = checkoutCommand;

    try {
      await navigator.clipboard.writeText(checkoutCommandValue);
      copySucceeded = true;
      copiedField = 'command';
      branchMessage = `คัดลอกแล้ว: ${checkoutCommandValue}`;
      branchMessageType = 'success';

      if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer);
      copyFeedbackTimer = setTimeout(() => {
        copySucceeded = false;
        copiedField = null;
      }, 2000);
    } catch (error) {
      console.error('Copy checkout command failed:', error);
      branchMessage = 'คัดลอกไม่สำเร็จ กรุณาลองใหม่';
      branchMessageType = 'error';
    }
  }

  $: if (show && !wasOpen) {
    editableTitle = title;
    gitFlowType = getBranchPrefixForTaskType(taskType);
    lastSyncedTaskType = taskType;
    userOverrodePrefix = false;
    void updateBranchPreview(editableTitle);
    wasOpen = true;
  }

  $: if (!show && wasOpen) {
    wasOpen = false;
  }

  $: if (show && taskType !== lastSyncedTaskType) {
    lastSyncedTaskType = taskType;
    if (!userOverrodePrefix) {
      gitFlowType = getBranchPrefixForTaskType(taskType);
    }
  }

  function handlePrefixChange() {
    userOverrodePrefix = true;
  }

  onDestroy(() => {
    if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer);
    if (translateDebounceTimer) clearTimeout(translateDebounceTimer);
    if (translator?.destroy) translator.destroy();
  });
</script>

{#if show}
  <div class="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[30000] p-4" transition:fade={{ duration: 200 }}>
    <div class="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-modal-in">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <h3 class="text-sm font-bold text-white flex items-center gap-2 tracking-wide uppercase">
          <GitBranch size={16} class="text-indigo-400" />
          {$_("branchDialog__title")}
        </h3>
        <button
          type="button"
          on:click={() => dispatch('close')}
          class="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
        >
          <X size={18} />
        </button>
      </div>

      <div class="p-6 space-y-5">
        <!-- Task Title Input -->
        <div class="space-y-1.5">
          <label for="branch-task-title" class="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">{$_("branchDialog__task_title")}</label>
          <input
            id="branch-task-title"
            type="text"
            bind:value={editableTitle}
            on:input={() => scheduleBranchPreview(editableTitle)}
            placeholder={$_("branchDialog__task_title_placeholder")}
            class="w-full h-11 px-4 bg-white/5 border border-white/10 rounded-xl text-white text-[13px] placeholder:text-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
          />
        </div>

        <!-- Git Flow Prefix -->
        <div class="space-y-1.5">
          <label for="git-flow-prefix" class="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">{$_("branchDialog__prefix")}</label>
          <div class="relative group">
            <select
              id="git-flow-prefix"
              bind:value={gitFlowType}
              on:change={handlePrefixChange}
              class="w-full h-11 px-4 bg-white/5 border border-white/10 rounded-xl text-white text-[13px] appearance-none focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all cursor-pointer"
            >
              {#each gitFlowTypes as flow}
                <option value={flow} class="bg-gray-900">{flow}</option>
              {/each}
            </select>
            <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 group-hover:text-gray-300 transition-colors">
              <ChevronDown size={14} />
            </div>
          </div>
        </div>

        <!-- Branch Name Preview -->
        <div class="space-y-1.5">
          <label for="branch-name-preview" class="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">{$_("branchDialog__branch_name")}</label>
          <div class="flex gap-2">
            <input
              id="branch-name-preview"
              type="text"
              value={computedBranchName}
              readonly
              class="flex-1 h-11 px-4 bg-white/5 border border-white/10 rounded-xl text-indigo-300 font-mono text-[13px] focus:outline-none"
            />
            <button
              type="button"
              on:click={handleCopyBranchName}
              disabled={!editableTitle.trim() || isTranslatingBranch}
              class="h-11 px-4 inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-[13px] font-bold transition-all shadow-lg shadow-indigo-500/20"
            >
              {#if copySucceeded && copiedField === 'branch'}
                <Check size={14} strokeWidth={3} />
                <span>{$_("branchDialog__btn_copied")}</span>
              {:else}
                <Copy size={14} />
                <span>{$_("branchDialog__btn_copy")}</span>
              {/if}
            </button>
          </div>
        </div>

        <!-- Git Checkout Command Preview -->
        <div class="space-y-1.5">
          <label for="checkout-command-preview" class="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">{$_("branchDialog__checkout_command")}</label>
          <div class="flex gap-2">
            <input
              id="checkout-command-preview"
              type="text"
              value={checkoutCommand}
              readonly
              class="flex-1 h-11 px-4 bg-white/5 border border-white/10 rounded-xl text-gray-300 font-mono text-[13px] focus:outline-none"
            />
            <button
              type="button"
              on:click={handleCopyCheckoutCommand}
              disabled={!editableTitle.trim() || isTranslatingBranch}
              class="h-11 px-4 inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-[13px] font-bold transition-all"
            >
              {#if copySucceeded && copiedField === 'command'}
                <Check size={14} strokeWidth={3} />
                <span>{$_("branchDialog__btn_copied")}</span>
              {:else}
                <Copy size={14} />
                <span>{$_("branchDialog__btn_copy")}</span>
              {/if}
            </button>
          </div>
        </div>

        <!-- Status Message -->
        <div class="flex items-center gap-2 px-1">
          <div class="w-1.5 h-1.5 rounded-full {branchMessageType === 'error' ? 'bg-red-400' : branchMessageType === 'success' ? 'bg-green-400 animate-pulse' : 'bg-indigo-400'}"></div>
          <p class="text-[11px] font-medium text-gray-500">
            {#if !editableTitle.trim()}
              {$_("branchDialog__msg_empty")}
            {:else if isTranslatingBranch}
              {$_("branchDialog__msg_translating")}
            {:else}
              <span class="text-gray-400">{$_("branchDialog__translated")}:</span>
              <span class="text-indigo-300 mx-1">{translatedTitle || '-'}</span>
              <span class="mx-1 opacity-30">|</span>
              <span class={branchMessageType === 'error' ? 'text-red-400' : 'text-gray-500'}>{branchMessage}</span>
            {/if}
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 pb-6 pt-2 flex justify-end gap-3">
        <button
          type="button"
          on:click={() => dispatch('close')}
          class="px-5 py-2.5 bg-white/5 border border-white/10 text-gray-300 rounded-xl hover:bg-white/10 hover:text-white transition-all text-[13px] font-bold"
        >
          {$_("branchDialog__btn_close")}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes modal-in {
    from { opacity: 0; transform: scale(0.95) translateY(10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  .animate-modal-in {
    animation: modal-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
</style>
