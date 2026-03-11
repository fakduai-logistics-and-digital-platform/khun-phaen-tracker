<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { GitBranch, X, Copy, Check } from 'lucide-svelte';
  import {
    getBranchSlug as buildBranchSlug,
    getCheckoutCommand as buildCheckoutCommand,
    getComputedBranchName as buildComputedBranchName
  } from '$lib/utils/branch-name';

  const dispatch = createEventDispatcher<{ close: void }>();

  export let show = false;
  export let title = '';
  export let gitFlowType: 'feature' | 'bugfix' | 'hotfix' | 'release' = 'feature';
  export let workspaceShortName = '';
  export let taskNumber: number | null = null;

  const gitFlowTypes = ['feature', 'bugfix', 'hotfix', 'release'] as const;

  let editableTitle = '';
  let translatedTitle = '';
  let branchMessage = '';
  let branchMessageType: 'info' | 'success' | 'error' = 'info';
  let isTranslatingBranch = false;
  let copySucceeded = false;
  let copiedField: 'branch' | 'command' | null = null;
  let wasOpen = false;

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
      workspaceShortName,
      taskNumber
    });
  }

  function getComputedBranchName(): string {
    return buildComputedBranchName({
      gitFlowType,
      workspaceShortName,
      taskNumber,
      translatedTitle,
      editableTitle,
      title
    });
  }

  function getCheckoutCommand(): string {
    return buildCheckoutCommand({
      gitFlowType,
      workspaceShortName,
      taskNumber,
      translatedTitle,
      editableTitle,
      title
    });
  }

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

    const branchName = getComputedBranchName();

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

    const checkoutCommand = getCheckoutCommand();

    try {
      await navigator.clipboard.writeText(checkoutCommand);
      copySucceeded = true;
      copiedField = 'command';
      branchMessage = `คัดลอกแล้ว: ${checkoutCommand}`;
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
    void updateBranchPreview(editableTitle);
    wasOpen = true;
  }

  $: if (!show && wasOpen) {
    wasOpen = false;
  }

  onDestroy(() => {
    if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer);
    if (translateDebounceTimer) clearTimeout(translateDebounceTimer);
    if (translator?.destroy) translator.destroy();
  });
</script>

{#if show}
  <div class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[30000] p-4">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-base font-semibold text-gray-800 dark:text-white flex items-center gap-2">
          <GitBranch size={18} class="text-primary" />
          สร้างชื่อ Branch
        </h3>
        <button
          type="button"
          on:click={() => dispatch('close')}
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
            bind:value={editableTitle}
            on:input={() => scheduleBranchPreview(editableTitle)}
            class="w-full h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
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
              value={getComputedBranchName()}
              readonly
              on:focus={(event) => (event.currentTarget as HTMLInputElement).select()}
              class="flex-1 h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-mono text-sm"
            />
            <button
              type="button"
              on:click={handleCopyBranchName}
              disabled={!editableTitle.trim() || isTranslatingBranch}
              class="h-10 px-3 inline-flex items-center gap-1.5 bg-primary hover:bg-primary-dark disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
              title="คัดลอกชื่อ branch"
            >
              {#if copySucceeded && copiedField === 'branch'}
                <Check size={15} />
                Copied
              {:else}
                <Copy size={15} />
                Copy
              {/if}
            </button>
          </div>
        </div>

        <div>
          <label for="checkout-command-preview" class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Git Command</label>
          <div class="flex gap-2">
            <input
              id="checkout-command-preview"
              type="text"
              value={getCheckoutCommand()}
              readonly
              on:focus={(event) => (event.currentTarget as HTMLInputElement).select()}
              class="flex-1 h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-mono text-sm"
            />
            <button
              type="button"
              on:click={handleCopyCheckoutCommand}
              disabled={!editableTitle.trim() || isTranslatingBranch}
              class="h-10 px-3 inline-flex items-center gap-1.5 bg-primary hover:bg-primary-dark disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
              title="คัดลอกคำสั่ง checkout"
            >
              {#if copySucceeded && copiedField === 'command'}
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
          {#if !editableTitle.trim()}
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
          on:click={() => dispatch('close')}
          class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
        >
          ปิด
        </button>
      </div>
    </div>
  </div>
{/if}
