<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { page } from "$app/stores";
  import { api } from "$lib/apis";
  import { _ } from "svelte-i18n";
  import type {
    Task,
    Project,
    Assignee,
    ViewMode,
    FilterOptions,
    ChecklistItem,
  } from "$lib/types";
  import {
    getTasks,
    getTasksBySprint,
    addTask,
    updateTask,
    deleteTask,
    getStats,
    exportToCSV,
    importFromCSV,
    importAllData,
    mergeAllData,
    getAssignees,
    getProjectStats,
    addAssignee as addAssigneeDB,
    archiveTasksBySprint,
    exportFilteredSQLiteBinary,
  } from "$lib/db";
  import TaskForm from "$lib/components/TaskForm.svelte";
  import TaskList from "$lib/components/TaskList.svelte";
  import CalendarView from "$lib/components/CalendarView.svelte";
  import KanbanBoard from "$lib/components/KanbanBoard.svelte";
  import TableView from "$lib/components/TableView.svelte";
  import GanttView from "$lib/components/GanttView.svelte";
  import WorkloadView from "$lib/components/WorkloadView.svelte";
  import TaskViewPlaceholder from "$lib/components/TaskViewPlaceholder.svelte";
  import PageSizeModal from "$lib/components/PageSizeModal.svelte";
  import StatsPanel from "$lib/components/StatsPanel.svelte";
  import ExportImport from "$lib/components/ExportImport.svelte";
  import WorkerManager from "$lib/components/WorkerManager.svelte";
  import ProjectManager from "$lib/components/ProjectManager.svelte";
  import {
    List,
    CalendarDays,
    Columns3,
    Table,
    GanttChart,
    UsersRound,
    Filter,
    Search,
    Plus,
    Users,
    Folder,
    Sparkles,
    MessageSquareQuote,
    Settings2,
    Flag,
    FileText,
    FileSpreadsheet,
    Image as ImageIcon,
    Video,
    Presentation,
    CheckCircle,
    Moon,
    Sun,
    Bookmark,
    Play,
    ChevronLeft,
    ChevronRight,
  } from "lucide-svelte";
  import {
    initWasmSearch,
    indexTasks,
    clearSearch,
    searchQuery,
    wasmReady,
    wasmLoading,
  } from "$lib/stores/search";
  import {
    connectRealtime,
    disconnectRealtime,
    realtimeStatus,
    realtimePeers,
  } from "$lib/stores/realtime";
  import { user } from "$lib/stores/auth";
  import {
    currentWorkspaceOwnerId,
    setWorkspaceId,
    loadWorkspaceData,
  } from "$lib/stores/workspace";
  import { tabSettings, type TabId } from "$lib/stores/tabSettings";
  import { theme } from "$lib/stores/theme";
  import TabSettings from "$lib/components/TabSettings.svelte";
  import { sprints, type Sprint } from "$lib/stores/sprintStore";
  import SprintManager from "$lib/components/SprintManager.svelte";
  import SearchableSprintSelect from "$lib/components/SearchableSprintSelect.svelte";
  import SearchableSelect from "$lib/components/SearchableSelect.svelte";
  import { showKeyboardShortcuts } from "$lib/stores/keyboardShortcuts";
  import QRExportModal from "$lib/components/QRExportModal.svelte";
  import MonthlySummaryCharts from "$lib/components/MonthlySummaryCharts.svelte";
  import DailyReflect from "$lib/components/DailyReflect.svelte";
  import {
    type MonthlySummary,
    buildMonthlySummary,
  } from "$lib/utils/monthly-summary";
  import { createWorkspaceActions } from "$lib/stores/workspaceActions";
  import {
    FILTER_STORAGE_KEY,
    DEFAULT_FILTERS,
    persistFilters,
    restoreFilters,
    clearSavedFilters,
    normalizeSprintFilterValue,
  } from "$lib/stores/filterActions";
  import { createTaskActions } from "$lib/stores/taskActions";
  import { createSprintActions } from "$lib/stores/sprintActions";
  import { createExportActions } from "$lib/stores/exportActions";
  import { createViewActions } from "$lib/stores/viewActions";
  import { createKeyboardHandler } from "$lib/stores/keyboardActions";
  import CommandPalette from "$lib/components/CommandPalette.svelte";
  import StatusToast from "$lib/components/StatusToast.svelte";
  import VideoExportProgress from "$lib/components/VideoExportProgress.svelte";
  import AccessDenied from "$lib/components/AccessDenied.svelte";
  import WorkspaceLoading from "$lib/components/WorkspaceLoading.svelte";

  let tasks: Task[] = [];
  let allTasksIncludingArchived: Task[] = [];
  $: sprintManagerTasks = filteredTasks;
  let monthlySummaryTasks: Task[] = [];
  let filteredTasks: Task[] = [];
  let categories: string[] = [];
  let projects: string[] = [];
  let projectList: Project[] = [];
  $: projectStats = projectList.map((p) => ({
    id: p.id as any,
    taskCount: allTasksIncludingArchived.filter((t) => t.project === p.name)
      .length,
  }));
  let assignees: Assignee[] = [];
  $: myAssigneeId = assignees.find(
    (a) => a.user_id === $user?.id || a.user_id === $user?.user_id,
  )?.id;
  let workerStats: { id: string | number; taskCount: number }[] = [];
  let stats = {
    total: 0,
    todo: 0,
    in_progress: 0,
    in_test: 0,
    done: 0,
    total_minutes: 0,
  };

  let totalTasks = 0;
  let totalPages = 1;

  const viewActions = createViewActions({
    loadData: () => loadData(),
  });

  const { currentView, pageSize, currentPage } = viewActions;

  let editingTask: Task | null = null;
  let showForm = false;
  let showFilters = false;
  let showWorkerManager = false;
  let showProjectManager = false;
  let showMonthlySummary = false;
  let monthlySummaryRef: HTMLDivElement;
  let searchInput = "";
  let showTabSettings = false;
  let showSprintManager = false;
  let showChangeSprintModal = false;
  let selectedTaskIdsForSprintChange: number[] = [];
  let showQRExport = false;
  let qrExportTasks: Task[] = [];
  let searchInputRef: HTMLInputElement | null = null;
  let showCommandPalette = false;
  let showDailyReflect = false;
  let isKanbanDragging = false;
  let pendingLoadData = false;
  let visibleTabs: { id: TabId; icon: string }[] = [];
  let showPageSizeModal = false;
  let newPageSize = 20;
  let loadDataTimer: ReturnType<typeof setTimeout>;

  function normalizeTaskDate(dateStr: string | undefined): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString();
  }

  function addDays(base: Date, days: number): Date {
    const next = new Date(base);
    next.setDate(next.getDate() + days);
    return next;
  }

  function debouncedLoadData() {
    clearTimeout(loadDataTimer);
    loadDataTimer = setTimeout(() => {
      void loadData();
    }, 300);
  }

  // Auto-open task from URL
  $: if (browser && !loadingData && allTasksIncludingArchived.length > 0) {
    const urlTaskId = $page.url.searchParams.get("task");
    if (urlTaskId && (!editingTask || String(editingTask.id) !== urlTaskId)) {
      // Find task in all loaded tasks
      const task = allTasksIncludingArchived.find(
        (t) => String(t.id) === urlTaskId,
      );
      if (task) {
        editingTask = task;
        showForm = true;
      }
    } else if (!urlTaskId && showForm && editingTask) {
      // Handle case where user hits back button or URL changes manually
      showForm = false;
      editingTask = null;
    }
  }

  $: isOwner =
    $currentWorkspaceOwnerId && $user?.id
      ? $currentWorkspaceOwnerId === $user.id
      : false;

  function handleSelectAssigneeFromWorkload(
    event: CustomEvent<{ assigneeId: any }>,
  ) {
    filters = { ...filters, assignee_id: event.detail.assigneeId };
    viewActions.switchView("list");
    void loadData();
  }

  // Proactively load data when switching to workload view
  $: if (browser && $currentView === "workload") {
    debouncedLoadData();
  }

  let filters: FilterOptions = { ...DEFAULT_FILTERS };
  let selectedSprint: Sprint | null = null;
  // Show all sprints including completed ones in dropdown
  function openUtilityModalFromCommand(
    kind: "bookmark" | "whiteboard" | "quick-notes",
  ) {
    document.dispatchEvent(
      new CustomEvent("open-utility-modal", { detail: { kind } }),
    );
  }

  function openCommandPalette() {
    showCommandPalette = true;
  }

  function closeCommandPalette() {
    showCommandPalette = false;
  }

  $: visibleTabs = $tabSettings
    .filter((tab) => tab.enabled !== false)
    .map((tab) => ({ id: tab.id, icon: tab.icon }));
  $: {
    if (
      visibleTabs.length > 0 &&
      !visibleTabs.some((tab) => tab.id === $currentView)
    ) {
      viewActions.switchView(visibleTabs[0].id);
    }
  }

  let message = "";
  let messageType: "success" | "error" = "success";
  let videoExportInProgress = false;
  let videoExportPercent = 0;
  let videoExportElapsedMs = 0;
  let videoExportTimer: ReturnType<typeof setInterval> | null = null;

  function normalizeSprintFilter(
    value: FilterOptions["sprint_id"],
  ): FilterOptions["sprint_id"] {
    return normalizeSprintFilterValue(value, $sprints);
  }

  const keyboardHandler = createKeyboardHandler({
    openCommandPalette,
    closeCommandPalette,
    isCommandPaletteOpen: () => showCommandPalette,
    setShowForm: (v) => {
      showForm = v;
    },
    setEditingTask: (v) => {
      editingTask = v;
    },
    setShowFilters: (v) => {
      if (typeof v === "function") {
        showFilters = v(showFilters);
      } else {
        showFilters = v;
      }
    },
    setShowMonthlySummary: (v) => {
      showMonthlySummary = v;
    },
    setShowWorkerManager: (v) => {
      showWorkerManager = v;
    },
    setShowProjectManager: (v) => {
      showProjectManager = v;
    },
    setShowSprintManager: (v) => {
      showSprintManager = v;
    },
    setShowTabSettings: (v) => {
      showTabSettings = v;
    },
    focusSearch: () => searchInputRef?.focus(),
    switchViewByIndex: (index) => {
      if (visibleTabs[index]) viewActions.switchView(visibleTabs[index].id);
    },
    getModalsState: () => ({
      showForm,
      showFilters,
      showMonthlySummary,
      showWorkerManager,
      showProjectManager,
      showSprintManager,
      showTabSettings,
    }),
  });

  let checkingAccess = true;
  let hasAccess = false;

  onMount(() => {
    const initAccess = async () => {
      // Get workspace_id from route param and room from query
      const workspaceId = $page.params.workspace_id;
      const urlParams = new URLSearchParams(window.location.search);
      const urlRoom = urlParams.get("room");
      if (!urlRoom || !workspaceId) {
        await goto(`${base}/dashboard`);
        return;
      }

      // Restore workspace context from route
      const savedWsName = localStorage.getItem("current-workspace-name") || "";
      const savedOwnerId =
        localStorage.getItem("current-workspace-owner-id") || "";
      const savedColor =
        localStorage.getItem("current-workspace-color") || undefined;
      const savedIcon =
        localStorage.getItem("current-workspace-icon") || undefined;
      setWorkspaceId(
        workspaceId,
        savedWsName,
        savedOwnerId,
        savedColor,
        savedIcon,
      );

      // Check access
      try {
        const res = await api.workspaces.checkAccess(urlRoom);
        const data = await res.json();
        checkingAccess = false;
        if (data.success && data.has_access) {
          if (data.workspace?.id === workspaceId) {
            setWorkspaceId(
              workspaceId,
              data.workspace.name || savedWsName,
              data.workspace.owner_id || savedOwnerId,
              data.workspace.color || savedColor,
              data.workspace.icon || savedIcon,
            );
          }
          hasAccess = true;
          // Connect to real-time collaboration (auto-refresh on remote changes)
          connectRealtime(urlRoom, (payload) => {
            if (!payload) return;
            console.log(
              "📡 Remote data change detected, updating UI optimistically:",
              payload,
            );
            workspaceActions.handleRealtimeUpdate(payload);
          });

          filters = restoreFilters($sprints);

          // Reactive filters block will trigger initial loadData
          initWasmSearch();
        } else {
          hasAccess = false;
        }
      } catch (err) {
        console.error("Failed to check access:", err);
        checkingAccess = false;
        hasAccess = false;
      }
    };
    void initAccess();

    // Add keyboard shortcuts listener
    document.addEventListener("keydown", keyboardHandler);
  });

  onDestroy(() => {
    if (browser) {
      document.removeEventListener("keydown", keyboardHandler);
      disconnectRealtime();
    }
  });

  let loadingData = false;
  async function loadData() {
    if (loadingData) {
      pendingLoadData = true;
      return;
    }
    loadingData = true;

    try {
      const result = await loadWorkspaceData({
        filters,
        currentPage: $currentPage,
        pageSize: $pageSize,
      });

      tasks = result.paginatedTasks;
      totalTasks = result.totalTasks;
      totalPages = result.totalPages;
      allTasksIncludingArchived = result.allTasks;
      monthlySummaryTasks = result.monthlySummaryTasks;

      if (result.categories) categories = result.categories;
      if (result.projects) projects = result.projects;
      if (result.projectList) projectList = result.projectList as Project[];
      if (result.assignees) assignees = result.assignees as Assignee[];
      if (result.workerStats) workerStats = result.workerStats;
      if (result.stats) stats = result.stats;

      if (result.failedApis.length > 0) {
        showMessage(
          `โหลดข้อมูลบางส่วนไม่สำเร็จ: ${result.failedApis.join(", ")}`,
          "error",
        );
      }

      // No manual sprintManagerTasks update - it's handled reactively now

      // Index tasks for WASM search
      if ($wasmReady) {
        indexTasks(tasks);
      }

      filteredTasks = tasks;
    } catch (e) {
      console.error("❌ loadData failed:", e);
      showMessage(
        `เกิดข้อผิดพลาดในการโหลดข้อมูล: ${e instanceof Error ? e.message : "Unknown error"}`,
        "error",
      );
    } finally {
      loadingData = false;
      if (pendingLoadData) {
        pendingLoadData = false;
        void loadData();
      }
    }
  }

  function handleKanbanDragState(event: CustomEvent<{ dragging: boolean }>) {
    isKanbanDragging = event.detail.dragging;
    if (!isKanbanDragging && pendingLoadData) {
      pendingLoadData = false;
      void loadData();
    }
  }

  // Handle search input
  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    searchInput = target.value;
    searchQuery.set(searchInput);
    filters = { ...filters, search: searchInput };
  }

  // Clear search
  function handleClearSearch() {
    searchInput = "";
    clearSearch([]);
    filters = { ...filters, search: "" };
  }

  let realtimeSyncDebounce: ReturnType<typeof setTimeout>;

  const workspaceActions = createWorkspaceActions({
    loadData,
    debouncedLoadData,
    notify: showMessage,
    t: (key: string, options?: any) => $_(key, options) as string,
    trackRealtime: queueRealtimeSync,
    getAssignees: () => assignees,
    setAssignees: (v) => {
      assignees = v;
    },
    getProjectList: () => projectList,
    setProjectList: (v) => {
      projectList = v;
    },
    getProjects: () => projects,
    setProjects: (v) => {
      projects = v;
    },
    setStats: (v) => {
      stats = v;
    },
  });

  // Worker Management Functions
  async function handleAddWorker(
    event: CustomEvent<{ name: string; color: string; user_id?: string }>,
  ) {
    await workspaceActions.handleAddWorker(event);
  }

  async function handleUpdateWorker(
    event: CustomEvent<{
      id: string | number;
      name: string;
      color: string;
      user_id?: string;
    }>,
  ) {
    await workspaceActions.handleUpdateWorker(event);
  }

  async function handleDeleteWorker(event: CustomEvent<string | number>) {
    await workspaceActions.handleDeleteWorker(event);
  }

  // Project Management Functions
  async function handleAddProject(
    event: CustomEvent<{ name: string; repo_url?: string }>,
  ) {
    await workspaceActions.handleAddProject(event);
  }

  async function handleUpdateProject(
    event: CustomEvent<{ id: number; name: string; repo_url?: string }>,
  ) {
    await workspaceActions.handleUpdateProject(
      event as CustomEvent<{
        id: string | number;
        name: string;
        repo_url?: string;
      }>,
    );
  }

  async function handleDeleteProject(event: CustomEvent<number>) {
    await workspaceActions.handleDeleteProject(
      event as CustomEvent<string | number>,
    );
  }

  function showMessage(msg: string, type: "success" | "error" = "success") {
    message = msg;
    messageType = type;
    setTimeout(() => (message = ""), 3000);
  }

  function queueRealtimeSync(reason: string) {
    console.log(`⚡ Action tracked for potential realtime sync: ${reason}`);
    // Realtime sync broadcasting is currently handled mostly inside db.ts directly.
  }

  const _actionDepsBase = {
    loadData,
    notify: showMessage,
    t: (key: string, options?: any) => $_(key, options) as string,
    trackRealtime: queueRealtimeSync,
  };

  const taskActions = createTaskActions({
    ..._actionDepsBase,
    getTasks: () => tasks,
    setTasks: (v) => {
      tasks = v;
    },
    getFilteredTasks: () => filteredTasks,
    setFilteredTasks: (v) => {
      filteredTasks = v;
    },
    getEditingTask: () => editingTask,
    setEditingTask: (v) => {
      editingTask = v;
    },
    setShowForm: (v) => {
      showForm = v;
    },
    setAssignees: (v) => {
      assignees = v as any;
    },
  });

  const sprintActions = createSprintActions({
    ..._actionDepsBase,
    getTasks: () => tasks,
    setTasks: (v) => {
      tasks = v;
    },
    getFilteredTasks: () => filteredTasks,
    setFilteredTasks: (v) => {
      filteredTasks = v;
    },
    getAllTasks: () => allTasksIncludingArchived,
    setAllTasks: (v) => {
      allTasksIncludingArchived = v;
    },
    getFilters: () => filters,
    setFilters: (v) => {
      filters = v;
    },
  });

  const exportActions = createExportActions({
    ..._actionDepsBase,
    getTasks: () => tasks,
    getAllTasksIncludingArchived: () => allTasksIncludingArchived,
    getAssignees: () => assignees,
    getProjectList: () => projectList,
    getSprints: () => $sprints,
    getMonthlySummary: () => monthlySummary,
    getMonthlySummaryRef: () => monthlySummaryRef,
    getVideoExportState: () => ({
      inProgress: videoExportInProgress,
      percent: videoExportPercent,
      elapsedMs: videoExportElapsedMs,
      timer: videoExportTimer,
    }),
    setVideoExportState: (st) => {
      videoExportInProgress = st.inProgress;
      videoExportPercent = st.percent;
      videoExportElapsedMs = st.elapsedMs;
      videoExportTimer = st.timer;
    },
    getFilters: () => filters,
    setFilters: (v) => {
      filters = v;
    },
    setSearchInput: (v) => {
      searchInput = v;
    },
    handleCompleteSprint: (ev) => sprintActions.handleCompleteSprint(ev),
  });

  // Sprint actions (delegated to sprintActions store)
  const handleCompleteSprint = (event: CustomEvent<number>) =>
    sprintActions.handleCompleteSprint(event);
  const handleMoveTasksToSprint = (
    event: CustomEvent<{
      sprintId: string | number;
      taskIds: (string | number)[];
    }>,
  ) => sprintActions.handleMoveTasksToSprint(event);
  const handleDeleteSprint = (event: CustomEvent<string | number>) =>
    sprintActions.handleDeleteSprint(event);
  const handleCompleteAndExport = (
    event: CustomEvent<{
      sprintId: string | number;
      format: "markdown" | "video";
    }>,
  ) => exportActions.handleCompleteAndExport(event as any);

  // Task actions (delegated to taskActions store)
  const handleAddTask = (event: CustomEvent<Omit<Task, "id" | "created_at">>) =>
    taskActions.handleAddTask(event);
  const handleChecklistUpdate = (
    event: CustomEvent<{ checklist: ChecklistItem[] }>,
  ) => taskActions.handleChecklistUpdate(event);
  const handleChecklistToggle = (
    event: CustomEvent<{ taskId: number; checklistItemId: string }>,
  ) => taskActions.handleChecklistToggle(event);
  const handleAddAssignee = (
    event: CustomEvent<{ name: string; color: string }>,
  ) => taskActions.handleAddAssignee(event as any);
  const handleDeleteTask = (event: CustomEvent<string | number>) =>
    taskActions.handleDeleteTask(event);
  const handleDeleteSelectedTasks = (event: CustomEvent<number[]>) =>
    taskActions.handleDeleteSelectedTasks(event);
  const handleStatusChange = (
    event: CustomEvent<{ id: string | number; status: Task["status"] }>,
  ) => taskActions.handleStatusChange(event);
  const handleKanbanMove = (
    event: CustomEvent<{ id: number; newStatus: Task["status"] }>,
  ) => taskActions.handleKanbanMove(event as any);

  function handleExportQR(event: CustomEvent<number[]>) {
    const ids = event.detail;
    if (ids.length === 0) return;
    qrExportTasks = tasks.filter((t) => t.id != null && ids.includes(t.id));
    showQRExport = true;
  }

  function handleEditTask(event: CustomEvent<Task>) {
    const task = event.detail;
    editingTask = task;
    showForm = true;

    // Update URL with task ID for sharing
    if (browser && task?.id) {
      const url = new URL(window.location.href);
      url.searchParams.set("task", String(task.id));
      goto(url.toString(), { replaceState: true, noScroll: true });
    }
  }

  function cancelEdit() {
    editingTask = null;
    showForm = false;

    // Remove task ID from URL
    if (browser) {
      const url = new URL(window.location.href);
      url.searchParams.delete("task");
      goto(url.toString(), { replaceState: true, noScroll: true });
    }
  }

  // Export/Import actions (delegated to exportActions store)
  const handleExportCSV = () => exportActions.handleExportCSV();
  const handleExportDatabase = (event: CustomEvent<any>) =>
    exportActions.handleExportDatabase(event);
  const handleExportMarkdown = (event?: CustomEvent<number | void>) =>
    exportActions.handleExportMarkdown(event as any);
  const handleExportVideo = (event?: CustomEvent<number | void>) =>
    exportActions.handleExportVideo(event as any);
  const handleExportSlide = (event?: CustomEvent<number | void>) =>
    exportActions.handleExportSlide(event as any);
  const handleExportPDF = () => exportActions.handleExportPDF();
  const handleExportMonthlyPDF = () => exportActions.handleExportMonthlyPDF();
  const handleExportMonthlyXlsx = () => exportActions.handleExportMonthlyXlsx();
  const handleExportMonthlyPng = () => exportActions.handleExportMonthlyPng();
  const handleExportMonthlyVideo = () =>
    exportActions.handleExportMonthlyVideo();
  const handleExportMonthlySlide = () =>
    exportActions.handleExportMonthlySlide();
  const handleImportCSV = (event: CustomEvent<string>) =>
    exportActions.handleImportCSV(event);

  function formatElapsedTime(ms: number): string {
    return exportActions.formatElapsedTime(ms);
  }

  // Auto-apply filters when they change (API is the single source of truth)
  $: if (browser && hasAccess && !checkingAccess && filters) {
    const normalizedValue = normalizeSprintFilter(filters.sprint_id);
    if (filters.sprint_id !== normalizedValue) {
      // This will trigger the reactive block again with normalized value
      filters = { ...filters, sprint_id: normalizedValue };
    } else {
      persistFilters(filters);
      currentPage.set(1);
      debouncedLoadData();
    }
  }

  function applyFilters() {
    // No longer strictly necessary as reactive block handles it
  }

  function clearFilters() {
    filters = { ...DEFAULT_FILTERS };
    clearSavedFilters();
  }

  $: monthlySummary = buildMonthlySummary(allTasksIncludingArchived);
</script>

<VideoExportProgress
  inProgress={videoExportInProgress}
  percent={videoExportPercent}
  elapsedMs={videoExportElapsedMs}
/>
<StatusToast bind:message bind:type={messageType} />

<div class="max-w-7xl mx-auto space-y-6 pb-24">
  {#if checkingAccess}
    <WorkspaceLoading />
  {:else if !hasAccess}
    <AccessDenied />
  {:else}
    <!-- Stats Panel -->
    <StatsPanel {stats} />

    <!-- Search & Quick Actions -->
    <!-- Search & Quick Actions -->
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
          on:click={() => (showFilters = !showFilters)}
          class="flex items-center justify-center w-12 h-12 shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all shadow-sm {showFilters
            ? 'bg-primary/10 border-primary text-primary'
            : ''}"
          title={$_("page__filters")}
        >
          <Filter size={20} />
        </button>

        <button
          on:click={() => (showWorkerManager = true)}
          class="flex items-center justify-center w-12 h-12 shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all shadow-sm"
          title={$_("page__team")}
        >
          <Users size={20} />
        </button>

        <div
          class="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-1 hidden md:block"
        ></div>

        <button
          on:click={() => (showProjectManager = true)}
          class="flex items-center gap-2 px-4 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-400 font-bold text-[11px] uppercase tracking-widest transition-all shadow-sm hover:text-primary whitespace-nowrap"
        >
          <Folder size={16} />
          <span class="hidden lg:inline">{$_("page__projects")}</span>
        </button>

        <button
          on:click={() => (showSprintManager = true)}
          class="flex items-center gap-2 px-4 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-400 font-bold text-[11px] uppercase tracking-widest transition-all shadow-sm hover:text-amber-500 whitespace-nowrap"
        >
          <Flag size={16} />
          <span class="hidden lg:inline">{$_("page__sprint")}</span>
        </button>

        <button
          on:click={() => (showMonthlySummary = true)}
          class="flex items-center gap-2 px-4 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-400 font-bold text-[11px] uppercase tracking-widest transition-all shadow-sm hover:text-purple-500 whitespace-nowrap"
        >
          <CalendarDays size={16} />
          <span class="hidden lg:inline">Report 1M</span>
        </button>

        <button
          on:click={() => (showDailyReflect = true)}
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

    {#if $wasmReady && searchInput}
      <div
        class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 -mt-4"
      >
        <Sparkles size={14} class="text-green-500" />
        <span
          >{$_("page__search_results", {
            values: { count: filteredTasks.length, query: searchInput },
          })}</span
        >
        <button
          on:click={handleClearSearch}
          class="text-primary hover:underline ml-2"
        >
          {$_("page__search_clear")}
        </button>
      </div>
    {/if}

    <!-- View Tabs -->
    <!-- View Tabs -->
    <div
      class="relative z-20 flex flex-col lg:flex-row gap-3 items-center bg-white/50 dark:bg-gray-900/30 p-2 rounded-2xl border border-gray-200/50 dark:border-gray-800/50 backdrop-blur-sm shadow-sm transition-all"
    >
      <div
        class="flex-1 flex p-1 bg-gray-200/80 dark:bg-gray-800/80 rounded-xl transition-all w-full overflow-x-auto scrollbar-none"
      >
        {#each visibleTabs as tab (tab.id)}
          <button
            on:click={() => viewActions.switchView(tab.id)}
            class="flex-1 min-w-30 flex items-center justify-center gap-2.5 px-4 h-12 rounded-lg text-sm font-bold uppercase tracking-wider {$currentView ===
            tab.id
              ? 'bg-white dark:bg-gray-700 text-primary dark:text-white shadow-sm ring-1 ring-black/5'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'}"
          >
            <div
              class="p-1 rounded-md {$currentView === tab.id
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
          on:click={() => (showTabSettings = !showTabSettings)}
          class="flex items-center justify-center w-12 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all shadow-sm"
          title={$_("page__tab_settings")}
        >
          <Settings2 size={20} />
        </button>

        {#if showTabSettings}
          <div
            class="absolute top-[calc(100%+1rem)] right-0 z-30 animate-fade-in origin-top-right"
          >
            <TabSettings
              on:close={() => (showTabSettings = false)}
              on:save={() => (showTabSettings = false)}
            />
          </div>
        {/if}

        <button
          on:click={() => {
            showForm = !showForm;
            editingTask = null;
            // Clear task param from URL
            if (browser) {
              const url = new URL(window.location.href);
              url.searchParams.delete("task");
              goto(url.toString(), { replaceState: true, noScroll: true });
            }
          }}
          class="flex-1 lg:flex-none flex items-center justify-center gap-3 px-6 h-12 bg-primary hover:bg-primary-dark text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-sm ring-1 ring-white/5 text-sm whitespace-nowrap active:scale-95"
        >
          <Plus size={22} strokeWidth={3} />
          <span>{$_("page__add_task")}</span>
        </button>
      </div>
    </div>
    <!-- Filters Panel -->
    {#if showFilters}
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
              placeholder="ค้นหาโปรเจค..."
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
                      a.id !== undefined &&
                      String(a.id) !== String(myAssigneeId),
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
              sprints={$sprints}
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
    {/if}

    <!-- Task Form -->
    <TaskForm
      show={showForm}
      {editingTask}
      {assignees}
      {isOwner}
      projects={projectList}
      sprints={$sprints}
      on:submit={handleAddTask}
      on:close={cancelEdit}
      on:addAssignee={handleAddAssignee}
      on:checklistUpdate={handleChecklistUpdate}
    />

    <!-- Views -->
    <div class="mt-8">
      {#if loadingData}
        <TaskViewPlaceholder loading={true} />
      {:else if filteredTasks.length === 0}
        <TaskViewPlaceholder loading={false} />
      {:else if $currentView === "kanban"}
        <div class="animate-fade-in">
          <KanbanBoard
            {tasks}
            sprints={$sprints}
            currentPage={$currentPage}
            {totalPages}
            {totalTasks}
            pageSize={$pageSize}
            on:move={(e) =>
              handleStatusChange({
                detail: { id: e.detail.id, status: e.detail.newStatus },
              } as any)}
            on:edit={handleEditTask}
            on:delete={handleDeleteTask}
            on:dragState={(e) => (isKanbanDragging = e.detail.dragging)}
            on:pageChange={(e) =>
              viewActions.handlePageChange(e.detail, totalPages)}
            on:pageSizeSettings={() => {
              newPageSize = $pageSize;
              showPageSizeModal = true;
            }}
          />
        </div>
      {:else if $currentView === "list"}
        <div class="animate-fade-in">
          <TaskList
            {tasks}
            sprints={$sprints}
            currentPage={$currentPage}
            {totalPages}
            {totalTasks}
            pageSize={$pageSize}
            on:edit={handleEditTask}
            on:delete={handleDeleteTask}
            on:statusChange={handleStatusChange}
            on:pageChange={(e) =>
              viewActions.handlePageChange(e.detail, totalPages)}
            on:pageSizeSettings={() => {
              newPageSize = $pageSize;
              showPageSizeModal = true;
            }}
          />
        </div>
      {:else if $currentView === "calendar"}
        <div class="animate-fade-in">
          <CalendarView tasks={filteredTasks} on:selectTask={handleEditTask} />
        </div>
      {:else if $currentView === "table"}
        <div class="animate-fade-in">
          <TableView
            {tasks}
            sprints={$sprints}
            currentPage={$currentPage}
            {totalPages}
            {totalTasks}
            pageSize={$pageSize}
            on:edit={handleEditTask}
            on:delete={handleDeleteTask}
            on:deleteSelected={handleDeleteSelectedTasks}
            on:statusChange={handleStatusChange}
            on:checklistToggle={handleChecklistToggle}
            on:exportQR={handleExportQR}
            on:pageChange={(e) =>
              viewActions.handlePageChange(e.detail, totalPages)}
            on:pageSizeSettings={() => {
              newPageSize = $pageSize;
              showPageSizeModal = true;
            }}
          />
        </div>
      {:else if $currentView === "gantt"}
        <GanttView
          tasks={filteredTasks}
          sprints={$sprints}
          on:edit={handleEditTask}
        />
      {:else if $currentView === "workload"}
        <WorkloadView
          tasks={sprintManagerTasks}
          {assignees}
          on:selectAssignee={handleSelectAssigneeFromWorkload}
        />
      {/if}
    </div>

    <PageSizeModal
      show={showPageSizeModal}
      value={newPageSize}
      on:close={() => (showPageSizeModal = false)}
      on:save={(e) => {
        newPageSize = e.detail.value;
        viewActions.setPageSize(newPageSize);
        showPageSizeModal = false;
      }}
    />

    {#if showMonthlySummary}
      <div
        class="fixed inset-0 bg-black/55 flex items-start justify-center z-20000 p-4 pt-20 backdrop-blur-sm"
        on:click|self={() => (showMonthlySummary = false)}
        on:keydown={(event) =>
          event.key === "Escape" && (showMonthlySummary = false)}
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
                on:click={handleExportMonthlyPDF}
                class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Export PDF"
                aria-label="Export PDF"
              >
                <FileText size={16} />
              </button>
              <button
                on:click={handleExportMonthlyXlsx}
                class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                title="Export XLSX"
                aria-label="Export XLSX"
              >
                <FileSpreadsheet size={16} />
              </button>
              <button
                on:click={handleExportMonthlyPng}
                class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                title="Export PNG"
                aria-label="Export PNG"
              >
                <ImageIcon size={16} />
              </button>
              <button
                on:click={handleExportMonthlyVideo}
                class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                title="Export Video"
                aria-label="Export Video"
              >
                <Video size={16} />
              </button>
              <button
                on:click={handleExportMonthlySlide}
                class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                title="Export Slide"
                aria-label="Export Slide"
              >
                <Presentation size={16} />
              </button>
              <button
                on:click={() => (showMonthlySummary = false)}
                class="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xl"
                title={$_("taskForm__btn_close")}
              >
                &times;
              </button>
            </div>
          </div>

          <div class="p-6 overflow-y-auto space-y-6">
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
                class="rounded-xl border border-amber-200/50 dark:border-amber-800/50 p-3 bg-amber-50/50 dark:bg-amber-900/20"
              >
                <p
                  class="text-xs text-amber-700 dark:text-amber-400 font-medium"
                >
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
                <p
                  class="text-xs text-purple-700 dark:text-purple-400 font-medium"
                >
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
                <p
                  class="text-xs text-green-700 dark:text-green-400 font-medium"
                >
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
                <p
                  class="text-xs text-slate-700 dark:text-slate-400 font-medium"
                >
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
                {$_("monthlyCharts__avg_day")}: {monthlySummary.avgPerDay.toFixed(
                  2,
                )} · {$_("monthlyCharts__total_time")}: {(
                  monthlySummary.totalMinutes / 60
                ).toFixed(1)}
                {$_("statsPanel__hours_short")}
              </p>
              <MonthlySummaryCharts
                done={monthlySummary.done}
                inProgress={monthlySummary.inProgress}
                todo={monthlySummary.todo}
                dailyTrend={monthlySummary.dailyTrend}
                projectBreakdown={monthlySummary.projectBreakdown}
                assigneeBreakdown={monthlySummary.assigneeBreakdown}
                categoryBreakdown={monthlySummary.categoryBreakdown}
              />
            </div>

            <div
              class="rounded-xl border border-gray-200 dark:border-gray-700 p-4"
            >
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
    {/if}

    <!-- Worker Manager Modal -->
    {#if showWorkerManager}
      <WorkerManager
        {assignees}
        {workerStats}
        isLoading={loadingData}
        {isOwner}
        workspaceId={$page.params.workspace_id}
        on:close={() => (showWorkerManager = false)}
        on:add={handleAddWorker}
        on:update={handleUpdateWorker}
        on:delete={handleDeleteWorker}
      />
    {/if}

    <!-- Sprint Manager Modal -->
    {#if showSprintManager}
      <SprintManager
        tasks={allTasksIncludingArchived.filter((t) => !t.is_archived)}
        on:close={() => (showSprintManager = false)}
        on:complete={handleCompleteSprint}
        on:completeAndExport={handleCompleteAndExport}
        on:deleteSprint={handleDeleteSprint}
        on:moveTasksToSprint={handleMoveTasksToSprint}
        on:exportMarkdown={handleExportMarkdown}
        on:exportVideo={handleExportVideo}
      />
    {/if}

    <!-- Project Manager Modal -->
    {#if showProjectManager}
      <ProjectManager
        projects={projectList}
        {projectStats}
        on:close={() => (showProjectManager = false)}
        on:add={handleAddProject}
        on:update={handleUpdateProject}
        on:delete={handleDeleteProject}
      />
    {/if}

    <!-- QR Export Modal -->
    <QRExportModal
      bind:show={showQRExport}
      selectedTasks={qrExportTasks}
      allProjects={projectList}
      allAssignees={assignees}
      on:close={() => {
        showQRExport = false;
        qrExportTasks = [];
      }}
      on:exportCSV={handleExportCSV}
    />

    <DailyReflect bind:show={showDailyReflect} />

    <!-- Keyboard Shortcuts Modal -->
    <CommandPalette
      open={showCommandPalette}
      {tasks}
      sprints={$sprints}
      projects={projectList}
      {assignees}
      toggleTheme={() => theme.toggle()}
      switchView={(id) => viewActions.switchView(id as any)}
      openTask={(task) => {
        editingTask = task;
        showForm = true;
      }}
      applyGlobalSearch={(q) =>
        handleSearchInput({ target: { value: q } } as any)}
      t={(key, values) => $_(key, values) as string}
      createTask={() => {
        showForm = true;
        editingTask = null;
      }}
      startTimer={() => taskActions.startTimerFromCommandPalette()}
      openQuickNotes={() => openUtilityModalFromCommand("quick-notes")}
      openBookmarks={() => openUtilityModalFromCommand("bookmark")}
      openWhiteboard={() => openUtilityModalFromCommand("whiteboard")}
      dailyReflect={() => {
        showDailyReflect = true;
      }}
      openPageSize={() => {
        newPageSize = $pageSize;
        showPageSizeModal = true;
      }}
      on:close={closeCommandPalette}
      on:clearFilters={clearFilters}
      on:filterProject={(e) => {
        filters = { ...filters, project: e.detail.project as any };
      }}
      on:filterAssignee={(e) => {
        filters = { ...filters, assignee_id: e.detail.assigneeId as any };
      }}
      on:filterSprint={(e) => {
        filters = { ...filters, sprint_id: e.detail.sprintId as any };
      }}
    />

    {#if $showKeyboardShortcuts}
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div
        class="fixed inset-0 bg-black/80 flex items-center justify-center z-20000 p-4 backdrop-blur-sm"
        on:click|self={() => ($showKeyboardShortcuts = false)}
        on:keydown={(event) =>
          event.key === "Escape" && ($showKeyboardShortcuts = false)}
        role="button"
        tabindex="0"
        aria-label={$_("shortcuts__close_modal")}
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 animate-modal-in"
        >
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              ⌨️ {$_("shortcuts__title")}
            </h3>
            <button
              on:click={() => ($showKeyboardShortcuts = false)}
              aria-label="ปิดหน้าต่างคีย์ลัด"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                ><line x1="18" y1="6" x2="6" y2="18"></line><line
                  x1="6"
                  y1="6"
                  x2="18"
                  y2="18"
                ></line></svg
              >
            </button>
          </div>

          <!-- View Shortcuts -->
          <div class="mb-4">
            <h4
              class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2"
            >
              {$_("shortcuts__views")}
            </h4>
            <div class="space-y-2">
              {#if visibleTabs.length === 0}
                <div
                  class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700"
                >
                  <span class="text-gray-700 dark:text-gray-300">-</span>
                  <span class="text-xs text-gray-400">no views</span>
                </div>
              {:else}
                {#each visibleTabs as tab, index (tab.id)}
                  <div
                    class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700"
                  >
                    <div class="flex items-center gap-3">
                      <kbd
                        class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300"
                        >{index + 1}</kbd
                      >
                      <span class="text-gray-700 dark:text-gray-300"
                        >{$_(`tabs__${tab.id}`)}</span
                      >
                    </div>
                    <span class="text-xs text-gray-400">view</span>
                  </div>
                {/each}
              {/if}
            </div>
          </div>

          <!-- Action Shortcuts -->
          <div class="mb-4">
            <h4
              class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2"
            >
              {$_("shortcuts__actions")}
            </h4>
            <div class="space-y-2">
              <div
                class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700"
              >
                <div class="flex items-center gap-3">
                  <kbd
                    class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300"
                    >/</kbd
                  >
                  <span class="text-gray-700 dark:text-gray-300"
                    >{$_("shortcuts__focus_search")}</span
                  >
                </div>
                <span class="text-xs text-gray-400">Focus search</span>
              </div>
              <div
                class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700"
              >
                <div class="flex items-center gap-3">
                  <kbd
                    class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300"
                    >N</kbd
                  >
                  <span class="text-gray-700 dark:text-gray-300"
                    >{$_("shortcuts__new_task")}</span
                  >
                </div>
                <span class="text-xs text-gray-400">New task</span>
              </div>
              <div
                class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700"
              >
                <div class="flex items-center gap-3">
                  <kbd
                    class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300"
                    >F</kbd
                  >
                  <span class="text-gray-700 dark:text-gray-300"
                    >{$_("shortcuts__toggle_filters")}</span
                  >
                </div>
                <span class="text-xs text-gray-400">Toggle filters</span>
              </div>
              <div
                class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700"
              >
                <div class="flex items-center gap-3">
                  <kbd
                    class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300"
                    >T</kbd
                  >
                  <span class="text-gray-700 dark:text-gray-300"
                    >{$_("shortcuts__toggle_theme")}</span
                  >
                </div>
                <span class="text-xs text-gray-400">Toggle theme</span>
              </div>
            </div>
          </div>

          <!-- System Shortcuts -->
          <div>
            <h4
              class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2"
            >
              {$_("shortcuts__system")}
            </h4>
            <div class="space-y-2">
              <div
                class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700"
              >
                <div class="flex items-center gap-3">
                  <kbd
                    class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300"
                    >Esc</kbd
                  >
                  <span class="text-gray-700 dark:text-gray-300"
                    >{$_("shortcuts__close_modal")}</span
                  >
                </div>
                <span class="text-xs text-gray-400">Close modal</span>
              </div>
              <div
                class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700"
              >
                <div class="flex items-center gap-3">
                  <kbd
                    class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300"
                    >?</kbd
                  >
                  <span class="text-gray-700 dark:text-gray-300"
                    >{$_("shortcuts__show_shortcuts")}</span
                  >
                </div>
                <span class="text-xs text-gray-400">Show shortcuts</span>
              </div>
              <div
                class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700"
              >
                <div class="flex items-center gap-3">
                  <kbd
                    class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300"
                    >⌘K / Ctrl+K</kbd
                  >
                  <span class="text-gray-700 dark:text-gray-300"
                    >{$_("shortcuts__open_commands")}</span
                  >
                </div>
                <span class="text-xs text-gray-400">Open commands</span>
              </div>
            </div>
          </div>

          <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p class="text-xs text-gray-500 dark:text-gray-400 text-center">
              💡 {$_("shortcuts__hint")}
            </p>
          </div>

          <div class="mt-4">
            <button
              on:click={() => ($showKeyboardShortcuts = false)}
              class="w-full px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors"
            >
              {$_("shortcuts__btn_got_it")}
            </button>
          </div>
        </div>
      </div>
    {/if}
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

  .animate-fade-in {
    animation: fade-in 0.3s ease-out;
  }

  @keyframes modal-in {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .animate-modal-in {
    animation: modal-in 0.2s ease-out;
  }
</style>
