<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { _ } from "svelte-i18n";
  import {
    FileText,
    FileSpreadsheet,
    Image as ImageIcon,
    Video,
    Presentation,
  } from "lucide-svelte";
  import MonthlySummaryCharts from "./MonthlySummaryCharts.svelte";
  import { normalizeTaskDate } from "$lib/utils/date";
  import type { MonthlySummary } from "$lib/utils/monthly-summary";

  export let monthlySummary: MonthlySummary;
  export let monthlySummaryRef: HTMLDivElement | null = null;

  const dispatch = createEventDispatcher();

  function close() {
    dispatch("close");
  }

  function exportPDF() {
    dispatch("exportPDF");
  }

  function exportXlsx() {
    dispatch("exportXlsx");
  }

  function exportPng() {
    dispatch("exportPng");
  }

  function exportVideo() {
    dispatch("exportVideo");
  }

  function exportSlide() {
    dispatch("exportSlide");
  }
</script>

<div
  class="fixed inset-0 bg-black/55 flex items-start justify-center z-20000 p-4 pt-20 backdrop-blur-sm"
  on:click|self={close}
  on:keydown={(event) => event.key === "Escape" && close()}
  role="button"
  tabindex="0"
  aria-label={$_("page__summary_30_days")}
>
  <div
    class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-7xl max-h-[85vh] overflow-hidden flex flex-col"
    bind:this={monthlySummaryRef}
  >
    <div
      class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700"
    >
      <div>
        <h3 class="text-xl font-bold text-gray-900 dark:text-white">
          {$_("page__summary_30_days")}
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {monthlySummary.periodLabel}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          on:click={exportPDF}
          class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          title="Export PDF"
          aria-label="Export PDF"
        >
          <FileText size={16} />
        </button>
        <button
          on:click={exportXlsx}
          class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
          title="Export XLSX"
          aria-label="Export XLSX"
        >
          <FileSpreadsheet size={16} />
        </button>
        <button
          on:click={exportPng}
          class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
          title="Export PNG"
          aria-label="Export PNG"
        >
          <ImageIcon size={16} />
        </button>
        <button
          on:click={exportVideo}
          class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
          title="Export Video"
          aria-label="Export Video"
        >
          <Video size={16} />
        </button>
        <button
          on:click={exportSlide}
          class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
          title="Export Slide"
          aria-label="Export Slide"
        >
          <Presentation size={16} />
        </button>
        <button
          on:click={close}
          class="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xl"
          title={$_("taskForm__btn_close")}
        >
          &times;
        </button>
      </div>
    </div>

    <div class="p-6 overflow-y-auto space-y-6">
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div
          class="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-700/40"
        >
          <p
            class="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wide"
          >
            {$_("statsPanel__total_tasks")}
          </p>
          <p
            class="text-2xl font-black text-gray-900 dark:text-white leading-tight"
          >
            {monthlySummary.total}
          </p>
        </div>
        <div
          class="rounded-xl border border-slate-200/50 dark:border-slate-700/50 p-3 bg-slate-50/50 dark:bg-slate-900/20"
        >
          <p class="text-xs text-slate-700 dark:text-slate-400 font-medium">
            {$_("page__filter_status_pending")}
          </p>
          <p
            class="text-2xl font-black text-slate-700 dark:text-slate-300 leading-tight"
          >
            {monthlySummary.pending}
          </p>
        </div>
        <div
          class="rounded-xl border border-amber-200/50 dark:border-amber-800/50 p-3 bg-amber-50/50 dark:bg-amber-900/20"
        >
          <p class="text-xs text-amber-700 dark:text-amber-400 font-medium">
            {$_("page__filter_status_todo")}
          </p>
          <p
            class="text-2xl font-black text-amber-700 dark:text-amber-300 leading-tight"
          >
            {monthlySummary.todo}
          </p>
        </div>
        <div
          class="rounded-xl border border-blue-200/50 dark:border-blue-800/50 p-3 bg-blue-50/50 dark:bg-blue-900/20"
        >
          <p class="text-xs text-blue-700 dark:text-blue-400 font-medium">
            {$_("page__filter_status_in_progress")}
          </p>
          <p
            class="text-2xl font-black text-blue-700 dark:text-blue-300 leading-tight"
          >
            {monthlySummary.inProgress}
          </p>
        </div>
        <div
          class="rounded-xl border border-purple-200/50 dark:border-purple-800/50 p-3 bg-purple-50/50 dark:bg-purple-900/20"
        >
          <p class="text-xs text-purple-700 dark:text-purple-400 font-medium">
            {$_("page__filter_status_in_test")}
          </p>
          <p
            class="text-2xl font-black text-purple-700 dark:text-purple-300 leading-tight"
          >
            {monthlySummary.inTest}
          </p>
        </div>
        <div
          class="rounded-xl border border-green-200/50 dark:border-green-800/50 p-3 bg-green-50/50 dark:bg-green-900/20"
        >
          <p class="text-xs text-green-700 dark:text-green-400 font-medium">
            {$_("page__filter_status_done")}
          </p>
          <p
            class="text-2xl font-black text-green-700 dark:text-green-300 leading-tight"
          >
            {monthlySummary.done}
          </p>
        </div>
        <div
          class="rounded-xl border border-slate-200/50 dark:border-slate-700/50 p-3 bg-slate-50/50 dark:bg-slate-900/20"
        >
          <p class="text-xs text-slate-700 dark:text-slate-400 font-medium">
            {$_("taskList__archived")}
          </p>
          <p
            class="text-2xl font-black text-slate-700 dark:text-slate-300 leading-tight"
          >
            {monthlySummary.archived}
          </p>
        </div>
      </div>

      <div
        class="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-linear-to-br from-slate-50 to-blue-50 dark:from-gray-800 dark:to-gray-900"
      >
        <p
          class="text-[10px] text-gray-500 dark:text-gray-400 mb-2 font-bold uppercase tracking-widest"
        >
          {$_("monthlyCharts__avg_day")}: {monthlySummary.avgPerDay.toFixed(2)} ·
          {$_("monthlyCharts__total_time")}: {(
            monthlySummary.totalMinutes / 60
          ).toFixed(1)}
          {$_("statsPanel__hours_short")}
        </p>
        <MonthlySummaryCharts
          done={monthlySummary.done}
          inProgress={monthlySummary.inProgress}
          pending={monthlySummary.pending}
          todo={monthlySummary.todo}
          dailyTrend={monthlySummary.dailyTrend}
          projectBreakdown={monthlySummary.projectBreakdown}
          assigneeBreakdown={monthlySummary.assigneeBreakdown}
          categoryBreakdown={monthlySummary.categoryBreakdown}
        />
      </div>

      <div class="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h4
          class="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2"
        >
          <span class="w-1 h-4 bg-primary rounded-full"></span>
          {$_("monthlyCharts__recent_tasks_title")}
        </h4>
        <div class="space-y-0.5">
          {#if monthlySummary.recentTasks.length === 0}
            <div class="py-10 text-center">
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {$_("monthlyCharts__no_tasks_period")}
              </p>
            </div>
          {:else}
            {#each monthlySummary.recentTasks as task}
              <div
                class="flex items-center justify-between gap-3 py-3 px-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <div class="min-w-0 flex-1">
                  <p
                    class="text-sm font-semibold text-gray-900 dark:text-white truncate"
                  >
                    {task.title}
                  </p>
                  <div class="flex items-center gap-2 mt-1">
                    <span
                      class="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded font-bold uppercase truncate max-w-30"
                    >
                      {task.project || $_("page__unassigned_project")}
                    </span>
                    <span
                      class="text-[10px] text-gray-400 dark:text-gray-500 font-medium"
                    >
                      {task.assignee?.name || $_("page__unassigned")}
                    </span>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <p
                    class="text-[10px] text-gray-400 dark:text-gray-500 font-bold mb-1"
                  >
                    {normalizeTaskDate(task.date)}
                  </p>
                  <span
                    class="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase {task.status ===
                    'done'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : task.status === 'in-progress'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : task.status === 'in-test'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}"
                  >
                    {task.status === "done"
                      ? $_("page__filter_status_done")
                      : task.status === "in-progress"
                        ? $_("page__filter_status_in_progress")
                        : task.status === "in-test"
                          ? $_("page__filter_status_in_test")
                          : $_("page__filter_status_todo")}
                  </span>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>
