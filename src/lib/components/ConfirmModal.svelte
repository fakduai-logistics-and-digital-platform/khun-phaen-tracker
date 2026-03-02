<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { X, AlertTriangle, CheckCircle2 } from "lucide-svelte";
  import { _ } from "svelte-i18n";

  export let show = false;
  export let title = "";
  export let message = "";
  export let confirmText = "";
  export let cancelText = "";
  export let type: "danger" | "warning" | "info" = "danger";

  const dispatch = createEventDispatcher();

  function close() {
    dispatch("close");
  }

  function confirm() {
    dispatch("confirm");
  }
</script>

{#if show}
  <div
    class="fixed inset-0 z-1000 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
    in:fade={{ duration: 200 }}
    out:fade={{ duration: 150 }}
  >
    <div
      class="bg-white dark:bg-slate-900 w-full max-w-md rounded-4xl shadow-2xl overflow-hidden border border-slate-200/50 dark:border-white/10"
      in:scale={{ start: 0.95, duration: 200 }}
      out:scale={{ start: 0.95, duration: 150 }}
    >
      <div class="p-8 space-y-6">
        <div class="flex items-center gap-4">
          <div
            class="p-4 rounded-2xl {type === 'danger'
              ? 'bg-rose-500/10 text-rose-500'
              : type === 'warning'
                ? 'bg-amber-500/10 text-amber-500'
                : 'bg-indigo-500/10 text-indigo-500'}"
          >
            {#if type === "danger" || type === "warning"}
              <AlertTriangle size={28} />
            {:else}
              <CheckCircle2 size={28} />
            {/if}
          </div>
          <div class="flex-1 min-w-0">
            <h3
              class="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight"
            >
              {title || $_("common.confirm")}
            </h3>
            <p class="text-sm text-slate-500 font-medium">
              {message}
            </p>
          </div>
          <button
            on:click={close}
            class="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div class="flex items-center gap-3">
          <button
            on:click={close}
            class="flex-1 py-4 text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            {cancelText || $_("common.cancel")}
          </button>
          <button
            on:click={confirm}
            class="flex-[1.5] py-4 rounded-2xl text-sm font-black uppercase tracking-widest text-white shadow-lg transition-all active:scale-95 {type ===
            'danger'
              ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20'
              : type === 'warning'
                ? 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/20'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'}"
          >
            {confirmText || $_("common.confirm")}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
