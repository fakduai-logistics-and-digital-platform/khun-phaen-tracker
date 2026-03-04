import { writable, get } from "svelte/store";
import { browser } from "$app/environment";
import { page } from "$app/stores";
import { api } from "$lib/apis";
import { _ } from "svelte-i18n";
import type {
  Task,
  Project,
  Assignee,
  FilterOptions,
  ChecklistItem,
} from "$lib/types";
import {
  loadWorkspaceData as loadDBData,
  currentWorkspaceOwnerId,
  setWorkspaceId,
} from "./workspace";
import { createViewActions } from "./viewActions";
import { createUIActions } from "./uiActions";
import { createSearchActions } from "./search";
import { createWorkspaceActions } from "./workspaceActions";
import { createTaskActions } from "./taskActions";
import { createSprintActions } from "./sprintActions";
import { createExportActions } from "./exportActions";
import { createKeyboardHandler } from "./keyboardActions";
import { connectRealtime, disconnectRealtime } from "./realtime";
import {
  DEFAULT_FILTERS,
  restoreFilters,
  persistFilters,
  clearSavedFilters,
  normalizeSprintFilterValue,
} from "./filterActions";
import { sprints } from "./sprintStore";
import { getKeyboardConfig } from "./workspaceKeyboardConfig";
import { buildMonthlySummary } from "$lib/utils/monthly-summary";

export function createWorkspacePageStore() {
  const loadingData = writable(false);
  const tasks = writable<Task[]>([]);
  const allTasksIncludingArchived = writable<Task[]>([]);
  const monthlySummaryTasks = writable<Task[]>([]);
  const filteredTasks = writable<Task[]>([]);
  const categories = writable<string[]>([]);
  const projects = writable<string[]>([]);
  const projectList = writable<Project[]>([]);
  const assignees = writable<Assignee[]>([]);
  const workerStats = writable<any[]>([]);
  const stats = writable<any>({
    total: 0,
    todo: 0,
    in_progress: 0,
    in_test: 0,
    done: 0,
    total_minutes: 0,
  });

  const totalTasks = writable(0);
  const totalPages = writable(1);
  const hasAccess = writable(false);
  const checkingAccess = writable(true);
  const filters = writable<FilterOptions>({ ...DEFAULT_FILTERS });
  const searchInput = writable("");

  const videoExportState = writable({
    inProgress: false,
    percent: 0,
    elapsedMs: 0,
    timer: null as any,
  });

  const editingTask = writable<Task | null>(null);

  const viewActions = createViewActions({
    loadData: () => loadData(),
  });

  const uiActions = createUIActions({});

  const searchActions = createSearchActions({
    getFilters: () => get(filters),
    setFilters: (f) => {
      filters.set(f);
    },
  });

  const showMessage = (msg: string, type: "success" | "error" = "success") => {
    uiActions.showMessage(msg, type);
  };

  const workspaceActions = createWorkspaceActions({
    loadData: () => loadData(),
    debouncedLoadData: () => debouncedLoadData(),
    notify: showMessage,
    t: (key: string, options?: any) => get(_)(key, options) as string,
    trackRealtime: (reason: string) => {},
    getAssignees: () => get(assignees),
    setAssignees: (v) => assignees.set(v),
    getProjectList: () => get(projectList),
    setProjectList: (v) => projectList.set(v),
    getProjects: () => get(projects),
    setProjects: (v) => projects.set(v),
    setStats: (v) => stats.set(v),
    getTasks: () => get(tasks),
    setTasks: (v) => tasks.set(v),
    getFilteredTasks: () => get(filteredTasks),
    setFilteredTasks: (v) => filteredTasks.set(v),
  });

  const _actionDepsBase = {
    loadData: () => loadData(),
    notify: showMessage,
    t: (key: string, options?: any) => get(_)(key, options) as string,
    trackRealtime: (reason: string) => {},
  };

  const taskActions = createTaskActions({
    ..._actionDepsBase,
    getTasks: () => get(tasks),
    setTasks: (v) => tasks.set(v),
    getFilteredTasks: () => get(filteredTasks),
    setFilteredTasks: (v) => filteredTasks.set(v),
    getEditingTask: () => get(editingTask),
    setEditingTask: (v) => editingTask.set(v),
    setShowForm: (v) => uiActions.setModalState("form", v),
    setAssignees: (v) => assignees.set(v as any),
  });

  const sprintActions = createSprintActions({
    ..._actionDepsBase,
    getTasks: () => get(tasks),
    setTasks: (v) => tasks.set(v),
    getFilteredTasks: () => get(filteredTasks),
    setFilteredTasks: (v) => filteredTasks.set(v),
    getAllTasks: () => get(allTasksIncludingArchived),
    setAllTasks: (v) => allTasksIncludingArchived.set(v),
    getFilters: () => get(filters),
    setFilters: (v) => filters.set(v),
  });

  const exportActions = createExportActions({
    ..._actionDepsBase,
    getTasks: () => get(tasks),
    getAllTasksIncludingArchived: () => get(allTasksIncludingArchived),
    getAssignees: () => get(assignees),
    getProjectList: () => get(projectList),
    getSprints: () => get(sprints),
    getMonthlySummary: () =>
      buildMonthlySummary(get(allTasksIncludingArchived)),
    getMonthlySummaryRef: () => undefined,
    getVideoExportState: () => get(videoExportState),
    setVideoExportState: (st) => videoExportState.set(st),
    getFilters: () => get(filters),
    setFilters: (v) => filters.set(v),
    setSearchInput: (v) => searchInput.set(v),
    handleCompleteSprint: (ev) => sprintActions.handleCompleteSprint(ev),
  });

  let loadDataTimer: any;
  function debouncedLoadData() {
    clearTimeout(loadDataTimer);
    loadDataTimer = setTimeout(() => {
      void loadData();
    }, 300);
  }

  let isPending = false;
  async function loadData() {
    if (get(loadingData)) {
      isPending = true;
      return;
    }
    loadingData.set(true);
    try {
      const result = await loadDBData({
        filters: get(filters),
        currentPage: get(viewActions.currentPage),
        pageSize: get(viewActions.pageSize),
      });
      tasks.set(result.paginatedTasks);
      totalTasks.set(result.totalTasks);
      totalPages.set(result.totalPages);
      allTasksIncludingArchived.set(result.allTasks);
      monthlySummaryTasks.set(result.monthlySummaryTasks);
      if (result.categories) categories.set(result.categories);
      if (result.projects) projects.set(result.projects);
      if (result.projectList) projectList.set(result.projectList as Project[]);
      if (result.assignees) assignees.set(result.assignees as Assignee[]);
      if (result.workerStats) workerStats.set(result.workerStats);
      if (result.stats) stats.set(result.stats);
      filteredTasks.set(get(tasks));
    } catch (e) {
      console.error("❌ loadData failed:", e);
    } finally {
      loadingData.set(false);
      if (isPending) {
        isPending = false;
        void loadData();
      }
    }
  }

  return {
    loadingData,
    tasks,
    allTasksIncludingArchived,
    filteredTasks,
    categories,
    projects,
    projectList,
    assignees,
    workerStats,
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
    showMessage,
    videoExportState,
    editingTask,
  };
}
