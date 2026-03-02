<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import { X, AlertTriangle, CheckCircle2, CircleAlert } from "lucide-svelte";
  import { _ } from "svelte-i18n";

  let {
    show = false,
    title = "",
    message = "",
    confirmText = "",
    cancelText = "",
    type = "danger" as "danger" | "warning" | "info",
    onConfirm,
    onClose,
  } = $props<{
    show?: boolean;
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    type?: "danger" | "warning" | "info";
    onConfirm?: () => void;
    onClose?: () => void;
  }>();
</script>

{#if show}
  <div
    class="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
    in:fade={{ duration: 300 }}
    out:fade={{ duration: 250 }}
  >
    <div
      class="bg-slate-900 w-full max-w-md rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden border border-white/10 flex flex-col"
      in:scale={{ start: 0.95, duration: 400, opacity: 0 }}
      out:scale={{ start: 0.95, duration: 250, opacity: 0 }}
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between px-6 py-4 border-b border-white/10"
      >
        <div class="flex items-center gap-3">
          <div
            class={type === "danger"
              ? "text-rose-500"
              : type === "warning"
                ? "text-amber-500"
                : "text-blue-500"}
          >
            {#if type === "danger"}
              <AlertTriangle size={22} strokeWidth={2.5} />
            {:else if type === "warning"}
              <CircleAlert size={22} strokeWidth={2.5} />
            {:else}
              <CheckCircle2 size={22} strokeWidth={2.5} />
            {/if}
          </div>
          <h3 class="text-lg font-bold text-white tracking-tight">
            {title || $_("common.confirm")}
          </h3>
        </div>
        <button
          onclick={() => onClose?.()}
          class="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-90"
        >
          <X size={20} />
        </button>
      </div>

      <!-- Body -->
      <div class="px-8 py-10">
        <p class="text-base text-slate-400 font-medium leading-relaxed">
          {message}
        </p>
      </div>

      <!-- Footer -->
      <div class="px-6 py-5 border-t border-white/10 flex justify-end gap-3">
        <button
          onclick={() => onClose?.()}
          class="px-6 py-2.5 rounded-xl border border-white/10 text-sm font-bold text-slate-300 hover:bg-white/5 hover:text-white transition-all active:scale-95"
        >
          {cancelText || $_("common.cancel")}
        </button>
        <button
          onclick={() => onConfirm?.()}
          class="px-8 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all active:scale-95 {type ===
          'danger'
            ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/40'
            : type === 'warning'
              ? 'bg-amber-500 hover:bg-amber-400 shadow-amber-900/40'
              : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/40'}"
        >
          {confirmText || $_("common.confirm")}
        </button>
      </div>
    </div>
  </div>
{/if}
