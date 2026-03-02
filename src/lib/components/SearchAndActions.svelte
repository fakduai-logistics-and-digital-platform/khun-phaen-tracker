<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { _ } from "svelte-i18n";
  import {
    Search,
    Filter,
    Users,
    Folder,
    Flag,
    CalendarDays,
    MessageSquareQuote,
    Settings,
  } from "lucide-svelte";
  import ExportImport from "./ExportImport.svelte";

  export let searchInput: string = "";
  export let searchInputRef: HTMLInputElement | null = null;
  export let isFiltersOpen: boolean = false;
  export let isOwner: boolean = false;

  const dispatch = createEventDispatcher();

  function handleSearchInput(event: Event) {
    dispatch("searchInput", event);
  }

  function handleClearSearch() {
    dispatch("clearSearch");
  }

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
  <!-- Search Component -->
  <div class="relative flex-1 group/search w-full">
    <div
      class="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 group-focus-within/search:text-primary group-focus-within/search:bg-primary/10 transition-all duration-300"
    >
      <Search size={18} />
    </div>
    <input
      bind:this={searchInputRef}
      type="text"
      value={searchInput}
      on:input={handleSearchInput}
      placeholder={$_("page__search_placeholder") + "... (press /)"}
      class="w-full h-12 pl-14 pr-12 bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none text-gray-900 dark:text-white dark:placeholder-gray-500 font-medium transition-all shadow-sm"
    />
    {#if searchInput}
      <button
        on:click={handleClearSearch}
        class="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-500 rounded-lg transition-all"
      >
        ×
      </button>
    {/if}
  </div>

  <!-- Action Row -->
  <div
    class="flex flex-wrap md:flex-nowrap items-center gap-2.5 pb-1 md:pb-0 w-full md:w-auto overflow-x-auto scrollbar-hide"
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
      <span class="hidden lg:inline">Report 1M</span>
    </button>

    <button
      on:click={openDailyReflect}
      class="flex items-center gap-2 px-4 h-12 bg-blue-500/5 border border-blue-500/10 rounded-xl hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[11px] uppercase tracking-widest transition-all shadow-sm whitespace-nowrap"
    >
      <MessageSquareQuote size={16} />
      <span class="hidden lg:inline">Daily Summary</span>
    </button>

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
