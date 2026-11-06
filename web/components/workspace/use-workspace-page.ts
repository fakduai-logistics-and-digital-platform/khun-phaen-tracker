"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/apis";
import { getAssigneeGroups } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { get, useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth/auth-provider";
import { user as authUserStore } from "@/lib/stores/auth";
import {
  DEFAULT_FILTERS,
  clearSavedFilters,
  normalizeSprintFilterValue,
  persistFilters,
  restoreFilters,
} from "@/lib/stores/filterActions";
import { createKeyboardHandler } from "@/lib/stores/keyboardActions";
import { connectRealtime, disconnectRealtime } from "@/lib/stores/realtime";
import { taskPath } from "@/lib/routes";
import { useRouteIds } from "@/lib/use-route-ids";
import { useWorkspaceRoom } from "@/lib/use-workspace-room";
import { indexTasks, initWasmSearch, wasmReady } from "@/lib/stores/search";
import { sprints } from "@/lib/stores/sprintStore";
import { tabSettings, type TabId } from "@/lib/stores/tabSettings";
import { modals } from "@/lib/stores/uiActions";
import { createWorkspacePageStore } from "@/lib/stores/workspacePageStore";
import { getKeyboardConfig } from "@/lib/stores/workspaceKeyboardConfig";
import {
  MY_TASKS_WORKSPACE_ID,
  currentWorkspaceName,
  currentWorkspaceOwnerId,
  setWorkspaceId,
} from "@/lib/stores/workspace";
import type { AssigneeGroup, Task } from "@/lib/types";
import type { Milestone } from "@/lib/types/milestone";
import { buildMonthlySummary } from "@/lib/utils/monthly-summary";

type SavedMyTasksFilter = { enabled: boolean; assignee_id: string | number | null };
const MY_TASKS_FILTER_STORAGE_KEY = "workspace-my-tasks-filter";

/** Wraps a payload as the CustomEvent the shared action modules (lib/stores/*Actions) expect. */
export function ev<T>(detail: T) {
  return new CustomEvent("action", { detail }) as CustomEvent<T>;
}

function normalizeMilestone(m: any): Milestone {
  return {
    ...m,
    id: m.id || m._id || "",
    workspace_id: typeof m.workspace_id === "object" && m.workspace_id?.$oid ? m.workspace_id.$oid : m.workspace_id,
  };
}

export function useWorkspacePage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: authUser, loading: authLoading } = useAuth();
  const { workspaceId } = useRouteIds();
  const authUserId = authUser?.id;
  const urlRoom = useWorkspaceRoom(workspaceId);
  const urlTaskId = searchParams.get("task");

  const [ws] = useState(() => createWorkspacePageStore());
  const { viewActions, uiActions } = ws;

  const loadingData = useStore(ws.loadingData);
  const tasks = useStore(ws.tasks);
  const allTasks = useStore(ws.allTasksIncludingArchived);
  const filteredTasks = useStore(ws.filteredTasks);
  const categories = useStore(ws.categories);
  const projects = useStore(ws.projects);
  const projectList = useStore(ws.projectList);
  const assignees = useStore(ws.assignees);
  const workerStats = useStore(ws.workerStats);
  const projectStats = useStore(ws.projectStats);
  const stats = useStore(ws.stats);
  const totalTasks = useStore(ws.totalTasks);
  const totalPages = useStore(ws.totalPages);
  const hasAccess = useStore(ws.hasAccess);
  const checkingAccess = useStore(ws.checkingAccess);
  const filters = useStore(ws.filters);
  const editingTask = useStore(ws.editingTask);
  const videoExportState = useStore(ws.videoExportState);
  const currentView = useStore(viewActions.currentView);
  const pageSize = useStore(viewActions.pageSize);
  const currentPage = useStore(viewActions.currentPage);
  const modalState = useStore(modals);
  const sprintList = useStore(sprints);
  const tabs = useStore(tabSettings);
  const ownerId = useStore(currentWorkspaceOwnerId);
  const workspaceName = useStore(currentWorkspaceName);
  const wasmIsReady = useStore(wasmReady);

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [assigneeGroups, setAssigneeGroups] = useState<AssigneeGroup[]>([]);
  const [qrExportTasks, setQrExportTasks] = useState<Task[]>([]);
  const [newPageSize, setNewPageSize] = useState(20);
  const [filterPanelPos, setFilterPanelPos] = useState({ top: 0, left: 0 });
  const runId = useRef(0);

  const isMyTasksWorkspace = workspaceId === MY_TASKS_WORKSPACE_ID;
  const myAssigneeId = assignees.find((a) => a.user_id === authUser?.id || a.user_id === authUser?.user_id)?.id;
  const myTasksStorageKey = `${MY_TASKS_FILTER_STORAGE_KEY}:${workspaceId}:${authUser?.id || authUser?.user_id || "anon"}`;
  const isMyTasksActive =
    myAssigneeId !== undefined && myAssigneeId !== null && String(filters?.assignee_id) === String(myAssigneeId);
  const isOwner = !isMyTasksWorkspace && ownerId && authUser?.id ? ownerId === authUser.id : false;
  const isAdminOrOwner = isOwner || authUser?.role === "admin";
  const visibleMilestones = milestones.filter((m) => !m.is_hidden);
  const monthlySummary = useMemo(() => buildMonthlySummary(allTasks), [allTasks]);

  const restrictedTabIds = useMemo<TabId[]>(
    () => [
      ...(isMyTasksWorkspace ? (["workload"] as TabId[]) : []),
      ...(!isAdminOrOwner && !isMyTasksWorkspace ? (["gantt", "workload"] as TabId[]) : []),
    ],
    [isMyTasksWorkspace, isAdminOrOwner],
  );
  const visibleTabs = useMemo(
    () =>
      tabs
        .filter((tab) => tab.enabled !== false)
        .filter((tab) => !restrictedTabIds.includes(tab.id))
        .map((tab) => ({ id: tab.id, icon: tab.icon })),
    [tabs, restrictedTabIds],
  );

  const loadAssigneeGroups = useCallback(async () => {
    try {
      setAssigneeGroups(await getAssigneeGroups(true));
    } catch (e) {
      console.error("Failed to load assignee groups:", e);
      setAssigneeGroups([]);
    }
  }, []);

  const fetchMilestones = useCallback(async () => {
    if (!workspaceId || workspaceId === MY_TASKS_WORKSPACE_ID) return;
    try {
      const res = await api.workspaces.getMilestones(workspaceId);
      if (res.ok) setMilestones((await res.json()).map(normalizeMilestone));
    } catch {
      /* Milestones are optional; the page works without them. */
    }
  }, [workspaceId]);

  const openTaskPage = useCallback(
    (task: Task) => {
      let taskId: unknown = task.id;
      if (typeof taskId === "object" && taskId !== null) taskId = (taskId as any).$oid || String(taskId);
      router.push(taskPath(workspaceId!, String(taskId)));
    },
    [router, workspaceId],
  );

  const updateUrlTask = useCallback(
    (id: string | number | null) => {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set("task", String(id));
      else url.searchParams.delete("task");
      router.replace(url.pathname + url.search, { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    document.title = t("meta__workspace_title", { name: workspaceName || "Khun Phaen" });
  }, [t, workspaceName]);

  useEffect(() => {
    if (!workspaceId || authLoading || !authUserId || urlRoom === undefined) return;
    const run = ++runId.current;
    const stale = () => run !== runId.current;

    async function initialize(id: string, room: string | null) {
      ws.checkingAccess.set(true);
      ws.hasAccess.set(false);
      setMilestones([]);
      setEditingMilestone(null);
      setAssigneeGroups([]);
      ws.editingTask.set(null);
      disconnectRealtime();

      if (id === MY_TASKS_WORKSPACE_ID) {
        ws.checkingAccess.set(false);
        ws.hasAccess.set(true);
        setWorkspaceId(id, "โฟกัสฮับ", "", "#0f766e", "Target", "FOCUS");
        if (get(viewActions.currentView) === "workload") viewActions.currentView.set("table");
        await loadAssigneeGroups();
        if (stale()) return;
        void initWasmSearch();
        ws.filters.set({ ...DEFAULT_FILTERS, sprint_id: "all", assignee_id: "all" });
        await ws.loadData();
        return;
      }

      if (!room) {
        router.push("/dashboard");
        return;
      }

      try {
        const res = await api.workspaces.checkAccess(room);
        const data = await res.json();
        if (stale()) return;
        ws.checkingAccess.set(false);
        if (!(data.success && data.has_access)) {
          ws.hasAccess.set(false);
          return;
        }

        ws.hasAccess.set(true);
        setWorkspaceId(
          id,
          data.workspace?.name || "",
          data.workspace?.owner_id || "",
          data.workspace?.color,
          data.workspace?.icon,
          data.workspace?.short_name,
        );
        connectRealtime(room, (payload) => ws.workspaceActions.handleRealtimeUpdate(payload));
        await sprints.refresh();
        await fetchMilestones();
        await loadAssigneeGroups();
        if (stale()) return;

        let initialFilters = { ...restoreFilters(get(sprints)) };
        const currentUser = get(authUserStore);
        const storageKey = `${MY_TASKS_FILTER_STORAGE_KEY}:${id}:${currentUser?.id || currentUser?.user_id || "anon"}`;
        const savedRaw = localStorage.getItem(storageKey);
        if (savedRaw) {
          try {
            const saved = JSON.parse(savedRaw) as SavedMyTasksFilter;
            if (saved.enabled && saved.assignee_id !== null) {
              initialFilters = { ...initialFilters, assignee_id: saved.assignee_id };
            }
          } catch {
            /* A corrupt saved filter is ignored. */
          }
        }
        ws.filters.set(initialFilters);
        void initWasmSearch();
      } catch {
        if (stale()) return;
        ws.checkingAccess.set(false);
        ws.hasAccess.set(false);
      }
    }

    const runs = runId;
    void initialize(workspaceId, urlRoom);
    return () => {
      runs.current++;
      disconnectRealtime();
    };
  }, [workspaceId, urlRoom, authLoading, authUserId, ws, viewActions, router, loadAssigneeGroups, fetchMilestones]);

  useEffect(() => {
    if (!hasAccess || checkingAccess || !filters) return;
    const normalized = normalizeSprintFilterValue(filters.sprint_id, sprintList);
    if (filters.sprint_id !== normalized) {
      ws.filters.update((f) => ({ ...f, sprint_id: normalized }));
    } else {
      persistFilters(filters);
      viewActions.currentPage.set(1);
      ws.debouncedLoadData();
    }
  }, [hasAccess, checkingAccess, filters, sprintList, ws, viewActions]);

  useEffect(() => {
    if (wasmIsReady) indexTasks(tasks);
  }, [wasmIsReady, tasks]);

  useEffect(() => {
    if (loadingData || allTasks.length === 0 || !urlTaskId) return;
    const task = allTasks.find((item) => String(item.id) === urlTaskId);
    if (task) openTaskPage(task);
  }, [loadingData, allTasks, urlTaskId, openTaskPage]);

  useEffect(() => {
    const handler = createKeyboardHandler(
      getKeyboardConfig({
        uiActions,
        modals,
        editingTask: null,
        setEditingTask: (v) => ws.editingTask.set(v),
        searchInputRef: null,
        visibleTabs,
        viewActions,
      }),
    );
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [ws, uiActions, viewActions, visibleTabs]);

  const filterPanelRef = useRef<HTMLDivElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!modalState.filters) return;
    function handleWindowClick(event: MouseEvent) {
      const target = event.target as Node;
      if (filterDropdownRef.current?.contains(target)) return;
      if (filterPanelRef.current?.contains(target)) return;
      uiActions.closeModal("filters");
    }
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, [modalState.filters, uiActions]);

  function cancelEdit() {
    ws.editingTask.set(null);
    uiActions.closeModal("form");
    updateUrlTask(null);
  }

  function toggleMyTasksFilter() {
    if (myAssigneeId === undefined || myAssigneeId === null) return;
    ws.filters.update((f) => {
      const nextIsActive = f.assignee_id !== myAssigneeId;
      const payload: SavedMyTasksFilter = nextIsActive
        ? { enabled: true, assignee_id: myAssigneeId }
        : { enabled: false, assignee_id: null };
      localStorage.setItem(myTasksStorageKey, JSON.stringify(payload));
      return { ...f, assignee_id: nextIsActive ? myAssigneeId : "all" };
    });
  }

  function clearFilters() {
    ws.filters.set({ ...DEFAULT_FILTERS });
    clearSavedFilters();
  }

  function addTaskFromViewSelector() {
    uiActions.toggleModal("form");
    ws.editingTask.set(null);
    updateUrlTask(null);
  }

  function openPageSize() {
    setNewPageSize(pageSize);
    uiActions.openModal("pageSize");
  }

  return {
    ws,
    t,
    workspaceId,
    urlRoom,
    modalState,
    sprintList,
    loadingData,
    tasks,
    allTasks,
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
    editingTask,
    videoExportState,
    currentView,
    pageSize,
    currentPage,
    milestones: visibleMilestones,
    editingMilestone,
    setEditingMilestone,
    assigneeGroups,
    qrExportTasks,
    setQrExportTasks,
    newPageSize,
    setNewPageSize,
    filterPanelPos,
    setFilterPanelPos,
    filterPanelRef,
    filterDropdownRef,
    monthlySummary,
    isMyTasksWorkspace,
    myAssigneeId,
    isMyTasksActive,
    isOwner,
    restrictedTabIds,
    visibleTabs,
    loadAssigneeGroups,
    fetchMilestones,
    openTaskPage,
    updateUrlTask,
    cancelEdit,
    toggleMyTasksFilter,
    clearFilters,
    addTaskFromViewSelector,
    openPageSize,
  };
}
