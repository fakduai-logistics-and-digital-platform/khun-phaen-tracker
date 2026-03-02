<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { _ } from "svelte-i18n";
  import {
    Filter,
    Users,
    Folder,
    Flag,
    CalendarDays,
    MessageSquareQuote,
    Settings,
    Rocket,
  } from "lucide-svelte";
  import ExportImport from "./ExportImport.svelte";

  export let isFiltersOpen: boolean = false;
  export let isOwner: boolean = false;

  const dispatch = createEventDispatcher();

  function toggleFilters() {
    dispatch("toggleFilters");
  }

  function openWorkerManager() {
    dispatch("openWorkerManager");
  }

  function openProjectManager() {
    dispatch("openProjectManager");
  }

  function openSprintManager() {
    dispatch("openSprintManager");
  }

  function openMonthlySummary() {
    dispatch("openMonthlySummary");
  }

  function openDailyReflect() {
    dispatch("openDailyReflect");
  }

  function openMilestoneManager() {
    dispatch("openMilestoneManager");
  }

  function handleExportCSV() {
    dispatch("exportCSV");
  }

  function handleExportPDF() {
    dispatch("exportPDF");
  }

  function handleExportMarkdown(event: any) {
    dispatch("exportMarkdown", event.detail);
  }

  function handleExportVideo(event: any) {
    dispatch("exportVideo", event.detail);
  }

  function handleExportSlide(event: any) {
    dispatch("exportSlide", event.detail);
  }

  function handleExportDatabase(event: any) {
    dispatch("exportDatabase", event.detail);
  }

  function handleImportCSV(event: any) {
    dispatch("importCSV", event.detail);
  }

  function openWorkspaceSettings() {
    dispatch("openWorkspaceSettings");
  }

  function showMessage(msg: string) {
    dispatch("showMessage", msg);
  }
</script>

<div
  class="relative z-30 flex flex-col md:flex-row items-center gap-3 bg-white/50 dark:bg-gray-900/30 p-2 rounded-2xl border border-gray-200/50 dark:border-gray-800/50 backdrop-blur-sm transition-all group shadow-sm"
>
  <!-- Action Row (Search removed as requested) -->
  <div
    class="flex items-center gap-2.5 pb-1 md:pb-0 w-full md:w-auto overflow-x-auto scrollbar-hide"
  >
    <!-- Filter Toggle -->
    <button
      on:click={toggleFilters}
      class="flex items-center justify-center w-12 h-12 shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all shadow-sm {isFiltersOpen
        ? 'bg-primary/10 border-primary text-primary'
        : ''}"
      title={$_("page__filters")}
    >
      <Filter size={20} />
    </button>

    <button
      on:click={openWorkerManager}
      class="flex items-center justify-center w-12 h-12 shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all shadow-sm"
      title={$_("page__team")}
    >
      <Users size={20} />
    </button>

    {#if isOwner}
      <button
        on:click={openWorkspaceSettings}
        class="flex items-center justify-center w-12 h-12 shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all shadow-sm"
        title="Workspace Settings"
      >
        <Settings size={20} />
      </button>
    {/if}

    <div
      class="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-1 hidden md:block"
    ></div>

    <button
      on:click={openProjectManager}
      class="flex items-center gap-2 px-4 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-400 font-bold text-[11px] uppercase tracking-widest transition-all shadow-sm hover:text-primary whitespace-nowrap"
    >
      <Folder size={16} />
      <span class="hidden lg:inline">{$_("page__projects")}</span>
    </button>

    <button
      on:click={openSprintManager}
      class="flex items-center gap-2 px-4 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-400 font-bold text-[11px] uppercase tracking-widest transition-all shadow-sm hover:text-amber-500 whitespace-nowrap"
    >
      <Flag size={16} />
      <span class="hidden lg:inline">{$_("page__sprint")}</span>
    </button>

    <button
      on:click={openMonthlySummary}
      class="flex items-center gap-2 px-4 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-400 font-bold text-[11px] uppercase tracking-widest transition-all shadow-sm hover:text-purple-500 whitespace-nowrap"
    >
      <CalendarDays size={16} />
      <span class="hidden lg:inline">{$_("page__summary_30_days")}</span>
    </button>

    <button
      on:click={openDailyReflect}
      class="flex items-center gap-2 px-4 h-12 bg-blue-500/5 border border-blue-500/10 rounded-xl hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[11px] uppercase tracking-widest transition-all shadow-sm whitespace-nowrap"
    >
      <MessageSquareQuote size={16} />
      <span class="hidden lg:inline">{$_("dailyReflect__btn_open")}</span>
    </button>

    {#if isOwner}
      <button
        on:click={openMilestoneManager}
        class="flex items-center gap-2 px-4 h-12 bg-indigo-500/5 border border-indigo-500/10 rounded-xl hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-[11px] uppercase tracking-widest transition-all shadow-sm whitespace-nowrap"
        title={$_("milestone.add_btn")}
      >
        <Rocket size={16} />
        <span class="hidden lg:inline">{$_("milestone.btn_countdown")}</span>
      </button>
    {/if}

    <ExportImport
      showImport={isOwner}
      on:exportCSV={handleExportCSV}
      on:exportPDF={handleExportPDF}
      on:exportPNG={() => showMessage($_("page__export_png_success"))}
      on:exportMarkdown={handleExportMarkdown}
      on:exportVideo={handleExportVideo}
      on:exportSlide={handleExportSlide}
      on:exportDatabase={handleExportDatabase}
      on:importCSV={handleImportCSV}
      height="h-12"
    />
  </div>
</div>
