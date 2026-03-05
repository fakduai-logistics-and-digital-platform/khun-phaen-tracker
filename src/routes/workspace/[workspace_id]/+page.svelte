<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { get } from "svelte/store";
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { page } from "$app/stores";
  import { api } from "$lib/apis";
  import { _ } from "svelte-i18n";
  import type { Task, FilterOptions, AssigneeGroup } from "$lib/types";
  import type { Milestone } from "$lib/types/milestone";
  import { getAssigneeGroups } from "$lib/db";
  import { initWasmSearch, indexTasks, wasmReady } from "$lib/stores/search";
  import { connectRealtime, disconnectRealtime } from "$lib/stores/realtime";
  import { user } from "$lib/stores/auth";
  import {
    currentWorkspaceOwnerId,
    setWorkspaceId,
  } from "$lib/stores/workspace";
  import { theme } from "$lib/stores/theme";
  import { sprints, type Sprint } from "$lib/stores/sprintStore";
  import {
    DEFAULT_FILTERS,
    persistFilters,
    restoreFilters,
    clearSavedFilters,
    normalizeSprintFilterValue,
  } from "$lib/stores/filterActions";
  import { createKeyboardHandler } from "$lib/stores/keyboardActions";
  import { modals, toast } from "$lib/stores/uiActions";
  import { createWorkspacePageStore } from "$lib/stores/workspacePageStore";
  import { getKeyboardConfig } from "$lib/stores/workspaceKeyboardConfig";
  import { buildMonthlySummary } from "$lib/utils/monthly-summary";
  import SearchAndActions from "$lib/components/SearchAndActions.svelte";
  import ViewSelector from "$lib/components/ViewSelector.svelte";
  import FilterPanel from "$lib/components/FilterPanel.svelte";
  import WorkspaceViews from "$lib/components/WorkspaceViews.svelte";
  import WorkspaceModals from "$lib/components/WorkspaceModals.svelte";
  import StatsPanel from "$lib/components/StatsPanel.svelte";
  import StatusToast from "$lib/components/StatusToast.svelte";
  import ExportProgress from "$lib/components/ExportProgress.svelte";
  import AccessDenied from "$lib/components/AccessDenied.svelte";
  import WorkspaceLoading from "$lib/components/WorkspaceLoading.svelte";
  import DailyReflect from "$lib/components/DailyReflect.svelte";
  import CommandPalette from "$lib/components/CommandPalette.svelte";
  import MilestoneCountdown from "$lib/components/MilestoneCountdown.svelte";

  const ws = createWorkspacePageStore();
  const {
    loadingData,
    tasks,
    allTasksIncludingArchived,
    filteredTasks,
    categories,
    projects,
    projectList,
    assignees,
    workerStats,
    projectStats,
    stats,
    totalTasks,
    totalPages,
    hasAccess,
    checkingAccess,
    filters,
    searchInput,
    viewActions,
    uiActions,
    searchActions,
    workspaceActions,
    taskActions,
    sprintActions,
    exportActions,
    loadData,
    debouncedLoadData,
    videoExportState,
    editingTask,
  } = ws;

  const { currentView, pageSize, currentPage } = viewActions;

  let monthlySummaryRef: HTMLDivElement | null = null;
  let searchInputRef: HTMLInputElement | null = null;
  let isKanbanDragging = false;
  let qrExportTasks: Task[] = [];
  let newPageSize = 20;
  let milestones: Milestone[] = [];
  let editingMilestone: Milestone | null = null;
  let assigneeGroups: AssigneeGroup[] = [];
  type SavedMyTasksFilter = {
    enabled: boolean;
    assignee_id: string | number | null;
  };
  const MY_TASKS_FILTER_STORAGE_KEY = "workspace-my-tasks-filter";
  $: visibleMilestones = milestones.filter((m) => !m.is_hidden);

  async function loadAssigneeGroups() {
    try {
      assigneeGroups = await getAssigneeGroups(true);
    } catch (e) {
      console.error("Failed to load assignee groups:", e);
      assigneeGroups = [];
    }
  }

  async function fetchMilestones() {
    const wsId = $page.params.workspace_id;
    if (!wsId) return;
    try {
      const res = await api.workspaces.getMilestones(wsId);
      if (res.ok) {
        const data = await res.json();
        // Normalize IDs and workspace IDs from MongoDB (if sent as $oid object)
        milestones = data.map((m: any) => ({
          ...m,
          id: m.id || m._id || "",
          workspace_id:
            typeof m.workspace_id === "object" && m.workspace_id.$oid
              ? m.workspace_id.$oid
              : m.workspace_id,
        }));
      }
    } catch (e) {}
  }

  // Auto-open task from URL
  $: if (browser && !$loadingData && $allTasksIncludingArchived.length > 0) {
    const urlTaskId = $page.url.searchParams.get("task");
    if (urlTaskId && (!$editingTask || String($editingTask.id) !== urlTaskId)) {
      const task = $allTasksIncludingArchived.find(
        (t) => String(t.id) === urlTaskId,
      );
      if (task) {
        $editingTask = task;
        uiActions.openModal("form");
      }
    } else if (!urlTaskId && $modals.form && $editingTask) {
      uiActions.closeModal("form");
      $editingTask = null;
    }
  }

  $: myAssigneeId = $assignees.find(
    (a) => a.user_id === $user?.id || a.user_id === $user?.user_id,
  )?.id;
  $: myTasksStorageKey = `${MY_TASKS_FILTER_STORAGE_KEY}:${$page.params.workspace_id}:${$user?.id || $user?.user_id || "anon"}`;
  $: isMyTasksActive =
    myAssigneeId !== undefined &&
    myAssigneeId !== null &&
    String($filters?.assignee_id) === String(myAssigneeId);
  $: isOwner =
    $currentWorkspaceOwnerId && $user?.id
      ? $currentWorkspaceOwnerId === $user.id
      : false;

  import { tabSettings } from "$lib/stores/tabSettings";
  $: visibleTabs = $tabSettings
    .filter((t) => t.enabled !== false)
    .map((t) => ({ id: t.id, icon: t.icon }));

  $: if (browser && $hasAccess && !$checkingAccess && $filters) {
    const normalized = normalizeSprintFilterValue($filters.sprint_id, $sprints);
    if ($filters.sprint_id !== normalized)
      filters.update((f) => ({ ...f, sprint_id: normalized }));
    else {
      persistFilters($filters);
      currentPage.set(1);
      debouncedLoadData();
    }
  }

  const keyboardHandler = createKeyboardHandler(
    getKeyboardConfig({
      uiActions,
      modals,
      editingTask: $editingTask,
      setEditingTask: (v) => ($editingTask = v),
      searchInputRef,
      visibleTabs,
      viewActions,
    }),
  );

  onMount(async () => {
    const workspaceId = $page.params.workspace_id;
    const urlRoom = new URLSearchParams(window.location.search).get("room");
    if (!urlRoom || !workspaceId) return goto(`${base}/dashboard`);
    try {
      const res = await api.workspaces.checkAccess(urlRoom);
      const data = await res.json();
      checkingAccess.set(false);
      if (data.success && data.has_access) {
        hasAccess.set(true);
        setWorkspaceId(
          workspaceId,
          data.workspace?.name || "",
          data.workspace?.owner_id || "",
          data.workspace?.color,
          data.workspace?.icon,
          data.workspace?.short_name,
        );
        connectRealtime(urlRoom, (payload) =>
          workspaceActions.handleRealtimeUpdate(payload),
        );
        await sprints.refresh();
        await fetchMilestones();
        await loadAssigneeGroups();
        const restoredFilters = restoreFilters($sprints);
        let initialFilters = { ...restoredFilters };
        const savedMyTasksRaw = localStorage.getItem(myTasksStorageKey);
        if (savedMyTasksRaw) {
          try {
            const savedMyTasks = JSON.parse(
              savedMyTasksRaw,
            ) as SavedMyTasksFilter;
            if (savedMyTasks.enabled && savedMyTasks.assignee_id !== null) {
              initialFilters = {
                ...initialFilters,
                assignee_id: savedMyTasks.assignee_id,
              };
            }
          } catch {}
        }
        filters.set(initialFilters);
        initWasmSearch();
      } else {
        hasAccess.set(false);
      }
    } catch (err) {
      checkingAccess.set(false);
      hasAccess.set(false);
    }
    document.addEventListener("keydown", keyboardHandler);
  });

  onDestroy(() => {
    if (browser) {
      document.removeEventListener("keydown", keyboardHandler);
      disconnectRealtime();
    }
  });

  $: if ($wasmReady) indexTasks($tasks);
  $: monthlySummary = buildMonthlySummary($allTasksIncludingArchived);
  $: sprintManagerTasks = $filteredTasks;

  function cancelEdit() {
    $editingTask = null;
    uiActions.closeModal("form");
    updateUrlTask(null);
  }
  function updateUrlTask(id: any) {
    if (!browser) return;
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("task", String(id));
    else url.searchParams.delete("task");
    goto(url.toString(), { replaceState: true, noScroll: true });
  }

  function toggleMyTasksFilter() {
    if (myAssigneeId === undefined || myAssigneeId === null) return;
    filters.update((f) => {
      const nextIsActive = f.assignee_id !== myAssigneeId;
      if (browser) {
        const savedPayload: SavedMyTasksFilter = nextIsActive
          ? { enabled: true, assignee_id: myAssigneeId }
          : { enabled: false, assignee_id: null };
        localStorage.setItem(myTasksStorageKey, JSON.stringify(savedPayload));
      }
      return {
        ...f,
        assignee_id: nextIsActive ? myAssigneeId : "all",
      };
    });
  }
</script>

<div class="max-w-7xl mx-auto space-y-6 pb-24">
  {#if $checkingAccess}
    <WorkspaceLoading />
  {:else if !$hasAccess}
    <AccessDenied />
  {:else}
    <ExportProgress
      inProgress={$videoExportState.inProgress}
      percent={$videoExportState.percent}
      elapsedMs={$videoExportState.elapsedMs}
    />
    <StatusToast
      message={$toast?.message || ""}
      type={$toast?.type || "success"}
    />

    {#if visibleMilestones.length > 0}
      <div class="grid gap-6">
        {#each visibleMilestones as milestone}
          <MilestoneCountdown
            {milestone}
            {isOwner}
            onEdit={(m) => {
              editingMilestone = m;
              uiActions.openModal("milestoneManager");
            }}
            onDelete={() => uiActions.openModal("milestoneManager")}
            onHide={fetchMilestones}
          />
        {/each}
      </div>
    {/if}
    <StatsPanel
      stats={$stats}
      {isOwner}
      {videoExportState}
      on:exportCSV={() => exportActions.handleExportCSV()}
      on:exportPDF={() => exportActions.handleExportPDF()}
      on:exportMarkdown={(e) => exportActions.handleExportMarkdown(e)}
      on:exportVideo={(e) => exportActions.handleExportVideo(e)}
      on:exportSlide={(e) => exportActions.handleExportSlide(e)}
      on:exportDatabase={(e) => exportActions.handleExportDatabase(e)}
      on:importCSV={(e) => exportActions.handleImportCSV(e)}
    />
    <SearchAndActions
      isFiltersOpen={$modals.filters}
      {isOwner}
      {isMyTasksActive}
      on:toggleFilters={() => uiActions.toggleModal("filters")}
      on:openWorkerManager={() => uiActions.openModal("workerManager")}
      on:openProjectManager={() => uiActions.openModal("projectManager")}
      on:openSprintManager={() => uiActions.openModal("sprintManager")}
      on:openMonthlySummary={() => uiActions.openModal("monthlySummary")}
      on:openDailyReflect={() => uiActions.openModal("dailyReflect")}
      on:openMilestoneManager={() => uiActions.openModal("milestoneManager")}
      on:openWorkspaceSettings={() => uiActions.openModal("workspaceSettings")}
      on:toggleMyTasks={toggleMyTasksFilter}
    />

    {#if $modals.filters}
      <FilterPanel
        bind:filters={$filters}
        categories={$categories}
        projects={$projects}
        assignees={$assignees}
        sprints={$sprints}
        {myAssigneeId}
        on:clearFilters={() => {
          filters.set({ ...DEFAULT_FILTERS });
          clearSavedFilters();
        }}
      />
    {/if}

    <ViewSelector
      currentView={$currentView}
      {visibleTabs}
      isTabSettingsOpen={$modals.tabSettings}
      on:switchView={(e) => viewActions.switchView(e.detail)}
      on:toggleTabSettings={() => uiActions.toggleModal("tabSettings")}
      on:closeTabSettings={() => uiActions.closeModal("tabSettings")}
      on:addTask={() => {
        uiActions.toggleModal("form");
        $editingTask = null;
        updateUrlTask(null);
      }}
    />

    <WorkspaceViews
      loadingData={$loadingData}
      filteredTasks={$filteredTasks}
      tasks={$tasks}
      currentView={$currentView}
      sprints={$sprints}
      {currentPage}
      totalPages={$totalPages}
      totalTasks={$totalTasks}
      {pageSize}
      {sprintManagerTasks}
      assignees={$assignees}
      on:statusChange={(e) => taskActions.handleStatusChange(e)}
      on:edit={(e) => {
        $editingTask = e.detail;
        uiActions.openModal("form");
        updateUrlTask($editingTask?.id);
      }}
      on:delete={(e) => taskActions.handleDeleteTask(e)}
      on:dragState={(e) => (isKanbanDragging = e.detail)}
      on:pageChange={(e) => viewActions.handlePageChange(e.detail, $totalPages)}
      on:pageSizeSettings={() => {
        newPageSize = $pageSize;
        uiActions.openModal("pageSize");
      }}
      on:deleteSelected={(e) => taskActions.handleDeleteSelectedTasks(e)}
      on:checklistToggle={(e) => taskActions.handleChecklistToggle(e)}
      on:exportQR={(e) => {
        qrExportTasks = $tasks.filter((t) =>
          e.detail.map(String).includes(String(t.id)),
        );
        uiActions.openModal("qrExport");
      }}
      on:selectAssignee={(e) => {
        filters.update((f) => ({ ...f, assignee_id: e.detail }));
        viewActions.switchView("list");
        loadData();
      }}
    />

    <WorkspaceModals
      modals={$modals}
      editingTask={$editingTask}
      assignees={$assignees}
      {isOwner}
      projectList={$projectList}
      sprints={$sprints}
      allTasksIncludingArchived={$allTasksIncludingArchived}
      {qrExportTasks}
      loadingData={$loadingData}
      workerStats={$workerStats}
      projectStats={$projectStats}
      {monthlySummary}
      {monthlySummaryRef}
      workspaceId={String($page.params.workspace_id || "")}
      {newPageSize}
      {editingMilestone}
      on:addTask={(e) => taskActions.handleAddTask(e)}
      on:cancelEdit={cancelEdit}
      on:addAssignee={(e) => taskActions.handleAddAssignee(e)}
      on:checklistUpdate={(e) => taskActions.handleChecklistUpdate(e)}
      on:closeModal={(e) => {
        uiActions.closeModal(e.detail);
        if (e.detail === "milestoneManager") editingMilestone = null;
      }}
      on:savePageSize={(e) => {
        newPageSize = e.detail.value;
        viewActions.setPageSize(newPageSize);
        uiActions.closeModal("pageSize");
      }}
      on:closeWorkerManager={() => uiActions.closeModal("workerManager")}
      on:addWorker={(e) => workspaceActions.handleAddWorker(e)}
      on:updateWorker={(e) => workspaceActions.handleUpdateWorker(e)}
      on:deleteWorker={(e) => workspaceActions.handleDeleteWorker(e)}
      on:groupsChanged={loadAssigneeGroups}
      on:closeSprintManager={() => uiActions.closeModal("sprintManager")}
      on:completeSprint={(e) => sprintActions.handleCompleteSprint(e)}
      on:completeAndExport={(e) => exportActions.handleCompleteAndExport(e)}
      on:deleteSprint={(e) => sprintActions.handleDeleteSprint(e)}
      on:moveTasksToSprint={(e) => sprintActions.handleMoveTasksToSprint(e)}
      on:exportMarkdown={(e) => exportActions.handleExportMarkdown(e)}
      on:exportVideo={(e) => exportActions.handleExportVideo(e)}
      on:closeProjectManager={() => uiActions.closeModal("projectManager")}
      on:addProject={(e) => workspaceActions.handleAddProject(e)}
      on:updateProject={(e) => workspaceActions.handleUpdateProject(e)}
      on:deleteProject={(e) => workspaceActions.handleDeleteProject(e)}
      on:exportMonthlyPDF={() => exportActions.handleExportMonthlyPDF()}
      on:milestonesUpdated={fetchMilestones}
    />
    <DailyReflect bind:show={$modals.dailyReflect} {isOwner} />
    <CommandPalette
      open={$modals.commandPalette}
      tasks={$allTasksIncludingArchived}
      sprints={$sprints}
      projects={$projectList}
      assignees={$assignees}
      t={(key, options) => $_(key, options)}
      toggleTheme={() => theme.toggle()}
      switchView={(v) => viewActions.switchView(v)}
      openTask={(t) => {
        $editingTask = t;
        uiActions.openModal("form");
        updateUrlTask(t.id);
      }}
      createTask={() => {
        $editingTask = null;
        uiActions.openModal("form");
        updateUrlTask(null);
      }}
      startTimer={() => {
        /* Not implemented logic */
      }}
      openQuickNotes={() => {
        /* Not implemented logic */
      }}
      applyGlobalSearch={(q) => {
        searchInput.set(q);
        uiActions.closeModal("commandPalette");
      }}
      openBookmarks={() => {
        /* Not implemented logic */
      }}
      openWhiteboard={() => {
        /* Not implemented logic */
      }}
      dailyReflect={() => uiActions.openModal("dailyReflect")}
      openPageSize={() => uiActions.openModal("pageSize")}
      on:close={() => uiActions.closeModal("commandPalette")}
      on:clearFilters={() => {
        filters.set({ ...DEFAULT_FILTERS });
        clearSavedFilters();
      }}
    />
  {/if}
</div>

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
</style>
