<script lang="ts">
  import { _ } from "svelte-i18n";
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";

  export let message = $_("page__no_access_desc");
</script>

<div class="flex flex-col items-center justify-center py-20 px-4">
  <div
    class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 md:p-12 text-center max-w-md w-full shadow-sm"
  >
    <div
      class="w-20 h-20 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-2xl mx-auto flex items-center justify-center mb-6"
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path
          d="M7 11V7a5 5 0 0 1 10 0v4"
        ></path></svg
      >
    </div>
    <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-3">
      {$_("page__no_access")}
    </h2>
    <p class="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
      {message}
    </p>
    <button
      on:click={() => goto(`${base}/dashboard`)}
      class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors shadow-sm focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-slate-900"
    >
      กลับหน้า Dashboard
    </button>
  </div>
</div>
