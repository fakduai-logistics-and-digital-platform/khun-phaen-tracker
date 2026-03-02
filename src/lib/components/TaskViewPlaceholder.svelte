<script lang="ts">
  import { ListTodo } from "lucide-svelte";
  import { _ } from "svelte-i18n";

  export let loading = false;
</script>

{#if loading}
  <div
    class="min-h-90 flex flex-col items-center justify-center gap-4 bg-white/5 dark:bg-gray-800/20 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700"
  >
    <div
      class="w-12 h-12 border-4 border-indigo-200/60 dark:border-indigo-500/20 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin"
    ></div>
    <p class="text-sm font-semibold text-gray-600 dark:text-gray-300">
      {$_("taskList__loading")}
    </p>
  </div>
{:else}
  <div
    class="flex flex-col items-center justify-center py-32 bg-white/5 dark:bg-gray-800/20 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 space-y-6"
  >
    <div
      class="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center"
    >
      <ListTodo size={48} class="text-gray-300 dark:text-gray-600" />
    </div>
    <div class="text-center">
      <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
        {$_("taskList__no_tasks")}
      </h3>
      <p class="text-gray-500 dark:text-gray-400">
        {$_("taskList__add_task_hint")}
      </p>
    </div>
  </div>
{/if}
