<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { _ } from "svelte-i18n";
  import {
    List,
    CalendarDays,
    Columns3,
    Table,
    GanttChart,
    UsersRound,
    Settings2,
    Plus,
  } from "lucide-svelte";
  import TabSettings from "./TabSettings.svelte";
  import type { TabId } from "$lib/stores/tabSettings";

  export let currentView: string;
  export let visibleTabs: { id: TabId; icon: string }[] = [];
  export let isTabSettingsOpen: boolean = false;
  export let showAddTask: boolean = true;
  export let hiddenTabIds: TabId[] = [];

  const dispatch = createEventDispatcher();

  function switchView(id: string) {
    dispatch("switchView", id);
  }

  function toggleTabSettings() {
    dispatch("toggleTabSettings");
  }

  function closeTabSettings() {
    dispatch("closeTabSettings");
  }

  function handleAddTask() {
    dispatch("addTask");
  }
</script>

<div
  class="relative z-40 flex flex-col lg:flex-row gap-3 items-center overflow-visible bg-white/50 dark:bg-gray-900/30 p-2 rounded-2xl border border-gray-200/50 dark:border-gray-800/50 backdrop-blur-sm shadow-sm transition-all"
>
  <div
    class="flex-1 flex p-1 bg-gray-200/80 dark:bg-gray-800/80 rounded-xl transition-all w-full overflow-x-auto scrollbar-none"
  >
    {#each visibleTabs as tab (tab.id)}
      <button
        on:click={() => switchView(tab.id)}
        class="flex-1 min-w-30 flex items-center justify-center gap-2.5 px-4 h-12 rounded-lg text-sm font-bold uppercase tracking-wider {currentView ===
        tab.id
          ? 'bg-white dark:bg-gray-700 text-primary dark:text-white shadow-sm ring-1 ring-black/5'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'}"
      >
        <div
          class="p-1 rounded-md {currentView === tab.id
            ? 'bg-primary/10 text-primary dark:text-white'
            : 'text-gray-400 dark:text-gray-500'}"
        >
          {#if tab.icon === "List"}
            <List size={18} />
          {:else if tab.icon === "CalendarDays"}
            <CalendarDays size={18} />
          {:else if tab.icon === "Columns3"}
            <Columns3 size={18} />
          {:else if tab.icon === "Table"}
            <Table size={18} />
          {:else if tab.icon === "GanttChart"}
            <GanttChart size={18} />
          {:else if tab.icon === "UsersRound"}
            <UsersRound size={18} />
          {/if}
        </div>
        <span>{$_(`tabs__${tab.id}`)}</span>
      </button>
    {/each}
  </div>

  <div
    class="flex items-center gap-3 shrink-0 w-full lg:w-auto lg:overflow-visible"
  >
    <!-- Tab Settings -->
    <button
      on:click={toggleTabSettings}
      class="flex items-center justify-center w-12 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all shadow-sm"
      title={$_("page__tab_settings")}
    >
      <Settings2 size={20} />
    </button>

    {#if isTabSettingsOpen}
      <div
        class="absolute top-[calc(100%+1rem)] right-0 z-[120] animate-fade-in origin-top-right"
      >
        <TabSettings
          {hiddenTabIds}
          on:close={closeTabSettings}
          on:save={closeTabSettings}
        />
      </div>
    {/if}

    {#if showAddTask}
      <button
        on:click={handleAddTask}
        class="flex-1 lg:flex-none flex items-center justify-center gap-3 px-6 h-12 bg-primary hover:bg-primary-dark text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-sm ring-1 ring-white/5 text-sm whitespace-nowrap active:scale-95"
      >
        <Plus size={22} strokeWidth={3} />
        <span>{$_("page__add_task")}</span>
      </button>
    {/if}
  </div>
</div>
