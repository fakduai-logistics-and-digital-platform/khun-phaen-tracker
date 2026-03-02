<script lang="ts">
  import { _ } from "svelte-i18n";

  export let inProgress = false;
  export let percent = 0;
  export let elapsedMs = 0;

  function formatElapsedTime(ms: number): string {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }
</script>

{#if inProgress}
  <div class="fixed top-20 right-4 z-10000 animate-fade-in">
    <div
      class="bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-70"
    >
      <svg
        class="animate-spin"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="12" cy="12" r="10" stroke-opacity="0.3"></circle>
        <path d="M22 12a10 10 0 0 1-10 10"></path>
      </svg>
      <div class="flex-1">
        <div class="text-sm font-semibold">
          {$_("page__video_export_progress", { values: { percent } })}
        </div>
        <div class="text-xs text-blue-100">
          {$_("page__video_export_time", {
            values: { time: formatElapsedTime(elapsedMs) },
          })}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.3s ease-out;
  }
</style>
