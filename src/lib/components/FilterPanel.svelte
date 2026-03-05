<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { _ } from "svelte-i18n";
  import SearchableSelect from "./SearchableSelect.svelte";
  import SearchableSprintSelect from "./SearchableSprintSelect.svelte";
  import type { FilterOptions, Assignee } from "$lib/types";
  import type { Sprint } from "$lib/stores/sprintStore";

  export let filters: FilterOptions;
  export let categories: string[] = [];
  export let projects: string[] = [];
  export let assignees: Assignee[] = [];
  export let sprints: Sprint[] = [];
  export let myAssigneeId: string | number | undefined = undefined;

  const dispatch = createEventDispatcher();

  function clearFilters() {
    dispatch("clearFilters");
  }
</script>

<div
  class="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 space-y-3 transition-colors"
>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
    <div>
      <label
        for="dueDatePreset"
        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >{$_("page__filter_due_date")}</label
      >
      <SearchableSelect
        id="dueDatePreset"
        bind:value={filters.dueDatePreset}
        options={[
          { value: "all", label: $_("page__filter_due_date_all") },
          {
            value: "no_dates",
            label: $_("page__filter_due_date_no_dates"),
          },
          {
            value: "overdue",
            label: $_("page__filter_due_date_overdue"),
          },
          {
            value: "next_day",
            label: $_("page__filter_due_date_next_day"),
          },
          {
            value: "next_week",
            label: $_("page__filter_due_date_next_week"),
          },
          {
            value: "next_month",
            label: $_("page__filter_due_date_next_month"),
          },
        ]}
        showSearch={false}
      />
    </div>

    <div>
      <label
        for="status"
        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >{$_("page__filter_status")}</label
      >
      <SearchableSelect
        id="status"
        bind:value={filters.status}
        options={[
          { value: "all", label: $_("page__filter_status_all") },
          {
            value: "today",
            label: $_("page__filter_status_today"),
            badge: true,
            badgeColor: "bg-indigo-500",
          },
          {
            value: "pending",
            label: $_("page__filter_status_pending"),
            badge: true,
            badgeColor: "bg-slate-500",
          },
          {
            value: "todo",
            label: $_("page__filter_status_todo"),
            badge: true,
            badgeColor: "bg-gray-400",
          },
          {
            value: "in-progress",
            label: $_("page__filter_status_in_progress"),
            badge: true,
            badgeColor: "bg-blue-500",
          },
          {
            value: "in-test",
            label: $_("page__filter_status_in_test"),
            badge: true,
            badgeColor: "bg-purple-500",
          },
          {
            value: "done",
            label: $_("page__filter_status_done"),
            badge: true,
            badgeColor: "bg-green-500",
          },
          {
            value: "archived",
            label: $_("page__filter_status_archived"),
            badge: true,
            badgeColor: "bg-gray-600",
          },
        ]}
        placeholder="ค้นหาสถานะ..."
        showSearch={false}
      />
    </div>

    <div>
      <label
        for="category"
        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >{$_("page__filter_category")}</label
      >
      <SearchableSelect
        id="category"
        bind:value={filters.category}
        options={[
          { value: "all", label: $_("page__filter_category_all") },
          ...categories.map((cat) => ({ value: cat, label: cat })),
        ]}
        placeholder="ค้นหาหมวดหมู่..."
      />
    </div>

    <div>
      <label
        for="project"
        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >{$_("page__filter_project")}</label
      >
      <SearchableSelect
        id="project"
        bind:value={filters.project}
        options={[
          { value: "all", label: $_("page__filter_project_all") },
          ...projects.map((proj) => ({ value: proj, label: proj })),
        ]}
        placeholder="ค้นหาโปรเจกต์..."
      />
    </div>

    <div>
      <label
        for="assignee"
        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >{$_("page__filter_assignee")}</label
      >
      <SearchableSelect
        id="assignee"
        bind:value={filters.assignee_id}
        options={[
          {
            value: "me",
            label: `${$_("page__filter_assignee_me")}`,
            badge: true,
            badgeColor: "bg-primary",
          },
          { value: "all", label: $_("page__filter_assignee_all") },
          { value: null, label: `⚪ ${$_("page__unassigned")}` },
          ...assignees
            .filter(
              (a) =>
                a.id !== undefined && String(a.id) !== String(myAssigneeId),
            )
            .map((a) => ({
              value: a.id!,
              label: a.name,
              badge: true,
              badgeColor: a.color || "#94A3B8",
            })),
        ]}
        placeholder="ค้นหาผู้รับผิดชอบ..."
      />
    </div>

    <div>
      <label
        for="sprint"
        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >{$_("page__filter_sprint")}</label
      >
      <SearchableSprintSelect
        id="sprint"
        {sprints}
        bind:value={filters.sprint_id}
      />
    </div>
  </div>

  <div class="flex justify-end pt-2">
    <button
      on:click={clearFilters}
      class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
    >
      <svg
        class="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
      {$_("page__btn_clear")}
    </button>
  </div>
</div>
