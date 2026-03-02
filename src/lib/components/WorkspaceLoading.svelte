<script lang="ts">
  import { _ } from "svelte-i18n";
</script>

<div class="flex flex-col items-center justify-center py-32 space-y-4">
  <div
    class="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"
  ></div>
  <p class="text-slate-500 dark:text-slate-400 font-medium">
    {$_("page__checking_access")}
  </p>
</div>
