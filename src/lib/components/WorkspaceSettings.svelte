<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { _ } from "svelte-i18n";
  import { api } from "$lib/apis";
  import {
    currentWorkspaceName,
    currentWorkspaceColor,
    currentWorkspaceIcon,
    setWorkspaceId,
  } from "$lib/stores/workspace";
  import {
    X,
    Save,
    LayoutTemplate,
    Briefcase,
    Code2,
    Rocket,
    Zap,
    Heart,
    Target,
    Globe,
    Book,
    Camera,
    Coffee,
    Music,
    Smile,
    Bell,
    CheckCircle2,
    RefreshCcw,
    Settings,
  } from "lucide-svelte";
  import { fade, scale, slide } from "svelte/transition";

  export let workspaceId: string;

  const dispatch = createEventDispatcher();

  let name = $currentWorkspaceName;
  let color = $currentWorkspaceColor || "#6366f1";
  let icon = $currentWorkspaceIcon || "LayoutTemplate";

  // Notification Config
  let webhookUrl = "";
  let lineNotifyToken = "";
  let notifyOnCreate = false;
  let notifyOnStatusChange: string[] = [];
  let autoEnabled = false;
  let autoDays: number[] = [1, 2, 3, 4, 5];
  let autoTime = "09:00";

  // States
  let isLoading = true;
  let isSaving = false;

  const COLORS = [
    { name: "Slate", value: "#64748b" },
    { name: "Red", value: "#ef4444" },
    { name: "Orange", value: "#f97316" },
    { name: "Amber", value: "#f59e0b" },
    { name: "Emerald", value: "#10b981" },
    { name: "Teal", value: "#14b8a6" },
    { name: "Blue", value: "#3b82f6" },
    { name: "Indigo", value: "#6366f1" },
    { name: "Violet", value: "#8b5cf6" },
    { name: "Pink", value: "#ec4899" },
    { name: "Rose", value: "#f43f5e" },
  ];

  const ICONS = [
    { key: "LayoutTemplate", component: LayoutTemplate },
    { key: "Briefcase", component: Briefcase },
    { key: "Code2", component: Code2 },
    { key: "Rocket", component: Rocket },
    { key: "Zap", component: Zap },
    { key: "Heart", component: Heart },
    { key: "Target", component: Target },
    { key: "Globe", component: Globe },
    { key: "Book", component: Book },
    { key: "Camera", component: Camera },
    { key: "Coffee", component: Coffee },
    { key: "Music", component: Music },
    { key: "Smile", component: Smile },
  ];

  onMount(async () => {
    try {
      const res = await api.workspaces.getNotificationConfig(workspaceId);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) {
          webhookUrl = data.config.discord_webhook_url || "";
          lineNotifyToken = data.config.line_notify_token || "";
          notifyOnCreate = data.config.notify_on_create || false;
          notifyOnStatusChange = data.config.notify_on_status_change || [];
          autoEnabled = data.config.enabled || false;
          autoDays = data.config.days || [1, 2, 3, 4, 5];
          autoTime = data.config.time || "09:00";
        }
      }
    } catch (err) {
      console.error("Failed to load workspace settings:", err);
    } finally {
      isLoading = false;
    }
  });

  async function handleSave() {
    isSaving = true;
    try {
      // 1. Update Basic Info
      const updateRes = await api.workspaces.update(
        workspaceId,
        name,
        color,
        icon,
      );
      if (updateRes.ok) {
        setWorkspaceId(workspaceId, name, undefined, color, icon);
      }

      // 2. Update Notification Config
      await api.workspaces.updateNotificationConfig(workspaceId, {
        discord_webhook_url: webhookUrl,
        line_notify_token: lineNotifyToken,
        notify_on_create: notifyOnCreate,
        notify_on_status_change: notifyOnStatusChange,
        enabled: autoEnabled,
        days: autoDays,
        time: autoTime,
      });

      dispatch("workspaceUpdated");
      dispatch("close");
    } catch (err) {
      console.error("Failed to save workspace settings:", err);
    } finally {
      isSaving = false;
    }
  }

  function toggleStatus(status: string) {
    if (notifyOnStatusChange.includes(status)) {
      notifyOnStatusChange = notifyOnStatusChange.filter((s) => s !== status);
    } else {
      notifyOnStatusChange = [...notifyOnStatusChange, status];
    }
  }
</script>

<div
  class="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
  transition:fade={{ duration: 200 }}
>
  <div
    class="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh] overflow-hidden"
    transition:scale={{ duration: 300, start: 0.95 }}
  >
    <!-- Header -->
    <div
      class="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50"
    >
      <div class="flex items-center gap-4">
        <div class="p-3 bg-primary/10 text-primary rounded-2xl">
          <Settings size={24} />
        </div>
        <div>
          <h2
            class="text-2xl font-black text-gray-900 dark:text-white tracking-tight"
          >
            {$_("workspaceSettings__title")}
          </h2>
          <p class="text-sm text-gray-500 font-medium">
            {$_("workspaceSettings__subtitle")}
          </p>
        </div>
      </div>
      <button
        on:click={() => dispatch("close")}
        class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400"
      >
        <X size={24} />
      </button>
    </div>

    {#if isLoading}
      <div class="flex-1 flex flex-col items-center justify-center py-20 gap-4">
        <RefreshCcw size={40} class="animate-spin text-primary opacity-50" />
        <p class="text-gray-500 font-medium animate-pulse">
          {$_("page__checking_access")}
        </p>
      </div>
    {:else}
      <div class="flex-1 overflow-y-auto p-8 space-y-8">
        <!-- Appearance Section -->
        <section class="space-y-6">
          <div
            class="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-gray-400"
          >
            <span class="w-8 h-px bg-gray-100 dark:bg-gray-800"></span>
            {$_("workspaceSettings__appearance_title")}
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div class="space-y-4">
              <label
                for="ws-name"
                class="block text-sm font-bold text-gray-700 dark:text-gray-300"
                >{$_("workspaceSettings__name_label")}</label
              >
              <input
                id="ws-name"
                type="text"
                bind:value={name}
                class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-primary/50 text-gray-900 dark:text-white font-bold transition-all"
                placeholder={$_("workspaceSettings__name_placeholder")}
              />
            </div>

            <div class="space-y-4">
              <span
                class="block text-sm font-bold text-gray-700 dark:text-gray-300"
                >{$_("workspaceSettings__color_label")}</span
              >
              <div class="flex flex-wrap gap-2">
                {#each COLORS as c}
                  <button
                    on:click={() => (color = c.value)}
                    class="w-8 h-8 rounded-full border-2 transition-all hover:scale-110 {color ===
                    c.value
                      ? 'border-primary ring-2 ring-primary/20 scale-110'
                      : 'border-transparent'}"
                    style="background-color: {c.value}"
                    title={c.name}
                  ></button>
                {/each}
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <span
              class="block text-sm font-bold text-gray-700 dark:text-gray-300"
              >{$_("workspaceSettings__icon_label")}</span
            >
            <div class="flex flex-wrap gap-3">
              {#each ICONS as ico}
                <button
                  on:click={() => (icon = ico.key)}
                  class="p-3 rounded-2xl border-2 transition-all hover:bg-gray-50 dark:hover:bg-gray-800 {icon ===
                  ico.key
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-transparent text-gray-400'}"
                >
                  <svelte:component this={ico.component} size={24} />
                </button>
              {/each}
            </div>
          </div>
        </section>

        <!-- Notification Section -->
        <section class="space-y-6">
          <div
            class="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-gray-400"
          >
            <span class="w-8 h-px bg-gray-100 dark:bg-gray-800"></span>
            {$_("workspaceSettings__channels_title")}
          </div>

          <div class="space-y-4">
            <div class="flex flex-col gap-2">
              <label
                for="discord-url"
                class="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2"
              >
                <Globe size={16} class="text-[#5865F2]" />
                {$_("workspaceSettings__discord_webhook_label")}
              </label>
              <input
                id="discord-url"
                type="text"
                bind:value={webhookUrl}
                class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-[#5865F2]/50 text-gray-900 dark:text-white font-medium text-sm transition-all"
                placeholder={$_(
                  "workspaceSettings__discord_webhook_placeholder",
                )}
              />
            </div>

            <div class="flex flex-col gap-2">
              <label
                for="line-token"
                class="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2"
              >
                <Bell size={16} class="text-[#06C755]" />
                {$_("workspaceSettings__line_notify_token_label")}
              </label>
              <input
                id="line-token"
                type="password"
                bind:value={lineNotifyToken}
                class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-[#06C755]/50 text-gray-900 dark:text-white font-medium text-sm transition-all"
                placeholder={$_(
                  "workspaceSettings__line_notify_token_placeholder",
                )}
              />
            </div>
          </div>

          <div class="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-3xl space-y-6">
            <div class="flex items-center justify-between">
              <div>
                <h4
                  class="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2"
                >
                  <RefreshCcw size={16} class="text-amber-500" />
                  {$_("workspaceSettings__auto_title")}
                </h4>
                <p
                  class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1"
                >
                  {$_("workspaceSettings__auto_subtitle")}
                </p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  bind:checked={autoEnabled}
                  class="sr-only peer"
                />
                <div
                  class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-amber-500"
                ></div>
              </label>
            </div>

            {#if autoEnabled}
              <div
                class="grid grid-cols-1 md:grid-cols-2 gap-6"
                transition:slide
              >
                <div class="space-y-3">
                  <span
                    class="text-[10px] font-black uppercase tracking-widest text-gray-400"
                    >{$_("workspaceSettings__auto_days_label")}</span
                  >
                  <div class="flex flex-wrap gap-1.5">
                    {#each [1, 2, 3, 4, 5, 6, 0] as d}
                      <button
                        on:click={() => {
                          if (autoDays.includes(d))
                            autoDays = autoDays.filter((day) => day !== d);
                          else autoDays = [...autoDays, d].sort();
                        }}
                        class="px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-all {autoDays.includes(
                          d,
                        )
                          ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                          : 'bg-white dark:bg-gray-800 text-gray-400 border border-gray-100 dark:border-gray-700'}"
                      >
                        {$_(
                          `calendarView__day_${["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d]}`,
                        )}
                      </button>
                    {/each}
                  </div>
                </div>
                <div class="space-y-3">
                  <span
                    class="text-[10px] font-black uppercase tracking-widest text-gray-400"
                    >{$_("workspaceSettings__auto_time_label")}</span
                  >
                  <input
                    type="time"
                    bind:value={autoTime}
                    class="w-full px-4 py-3 bg-white dark:bg-gray-800 border-none rounded-2xl text-xl font-black text-gray-800 dark:text-white"
                  />
                </div>
              </div>
            {/if}
          </div>

          <div class="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-3xl space-y-6">
            <div class="flex items-center justify-between">
              <div>
                <h4
                  class="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2"
                >
                  <CheckCircle2 size={16} class="text-primary" />
                  {$_("workspaceSettings__alerts_title")}
                </h4>
                <p
                  class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1"
                >
                  {$_("workspaceSettings__alerts_subtitle")}
                </p>
              </div>
            </div>

            <div class="space-y-4">
              <div
                class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 flex items-center justify-center"
                  >
                    <Rocket size={16} />
                  </div>
                  <span
                    class="text-sm font-bold text-gray-700 dark:text-gray-200"
                    >{$_("workspaceSettings__alerts_create_label")}</span
                  >
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    bind:checked={notifyOnCreate}
                    class="sr-only peer"
                  />
                  <div
                    class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"
                  ></div>
                </label>
              </div>

              <div class="space-y-3">
                <span
                  class="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1"
                  >{$_("workspaceSettings__alerts_status_label")}</span
                >
                <div class="flex flex-wrap gap-2">
                  {#each ["todo", "in-progress", "in-test", "done"] as status}
                    <button
                      on:click={() => toggleStatus(status)}
                      class="px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 {notifyOnStatusChange.includes(
                        status,
                      )
                        ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                        : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-400 hover:border-gray-200'}"
                    >
                      {status === "todo"
                        ? "📝 "
                        : status === "in-progress"
                          ? "🔄 "
                          : status === "in-test"
                            ? "🧪 "
                            : "✅ "}
                      {$_(`page__filter_status_${status.replace("-", "_")}`)}
                    </button>
                  {/each}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Footer -->
      <div
        class="px-8 py-6 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3 bg-gray-50/50 dark:bg-gray-900/50"
      >
        <button
          on:click={() => dispatch("close")}
          class="px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors"
        >
          {$_("dashboard__modal_btn_cancel")}
        </button>
        <button
          on:click={handleSave}
          disabled={isSaving || !name.trim()}
          class="px-8 py-3 bg-primary text-white text-sm font-bold rounded-2xl hover:bg-primary-dark shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
        >
          {#if isSaving}
            <RefreshCcw size={18} class="animate-spin" />
            {$_("taskForm__comments_saving")}
          {:else}
            <Save size={18} />
            {$_("workspaceSettings__btn_save")}
          {/if}
        </button>
      </div>
    {/if}
  </div>
</div>
