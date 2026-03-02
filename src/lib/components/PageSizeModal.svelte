<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Settings2 } from 'lucide-svelte';

  export let show = false;
  export let value = 20;

  const dispatch = createEventDispatcher<{
    close: void;
    save: { value: number };
  }>();

  let localValue = value;
  $: if (show) localValue = value;

  function save() {
    dispatch('save', { value: Math.min(500, Math.max(1, Number(localValue) || 1)) });
  }
</script>

{#if show}
  <div class="fixed inset-0 bg-black/55 backdrop-blur-sm z-[30000] flex items-center justify-center p-4" on:click|self={() => dispatch('close')}>
    <div class="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-modal-in border border-gray-100 dark:border-gray-700">
      <div class="px-8 pt-8 pb-6">
        <div class="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
          <Settings2 size={32} class="text-primary" />
        </div>
        <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">กำหนดจำนวนงาน</h3>
        <p class="text-gray-500 dark:text-gray-400 mb-8">จำนวนงานที่จะแสดงผลต่อหน้าในโปรเจกต์นี้</p>

        <div class="space-y-4">
          <div class="flex flex-wrap gap-2">
            {#each [10, 20, 50, 100] as size}
              <button
                on:click={() => (localValue = size)}
                class="flex-1 py-3 rounded-2xl border-2 transition-all font-bold
                  {localValue === size
                    ? 'border-primary bg-primary/5 text-primary scale-[1.02]'
                    : 'border-gray-100 dark:border-gray-700 text-gray-400 hover:border-gray-200 dark:hover:border-gray-600'}"
              >
                {size}
              </button>
            {/each}
          </div>

          <div class="pt-2">
            <label class="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1 mb-2 block">ระบุจำนวนเอง</label>
            <div class="relative">
              <input
                type="number"
                bind:value={localValue}
                min="1"
                max="500"
                class="w-full h-14 bg-gray-50 dark:bg-gray-900/50 border-2 border-gray-100 dark:border-gray-800 rounded-2xl px-6 focus:border-primary focus:ring-0 transition-all font-bold text-lg dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="px-8 py-6 bg-gray-50/80 dark:bg-gray-900/50 flex gap-3">
        <button on:click={() => dispatch('close')} class="flex-1 py-4 text-gray-500 font-bold hover:text-gray-700 transition-colors">
          ยกเลิก
        </button>
        <button on:click={save} class="flex-1 py-4 bg-primary hover:bg-primary-dark text-white rounded-2xl font-bold shadow-lg shadow-primary/30 transition-all active:scale-95">
          บันทึก
        </button>
      </div>
    </div>
  </div>
{/if}
