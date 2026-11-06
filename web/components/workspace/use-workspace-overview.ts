"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/apis";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { createKeyboardHandler } from "@/lib/stores/keyboardActions";
import { connectRealtime, disconnectRealtime } from "@/lib/stores/realtime";
import { sprints } from "@/lib/stores/sprintStore";
import { createUIActions, modals } from "@/lib/stores/uiActions";
import { createWorkspacePageStore } from "@/lib/stores/workspacePageStore";
import { getKeyboardConfig } from "@/lib/stores/workspaceKeyboardConfig";
import { taskPath, workspacePath } from "@/lib/routes";
import { useRouteIds } from "@/lib/use-route-ids";
import { useWorkspaceRoom } from "@/lib/use-workspace-room";
import {
  MY_TASKS_WORKSPACE_ID,
  currentWorkspaceName,
  currentWorkspaceOwnerId,
  setWorkspaceId,
} from "@/lib/stores/workspace";
import { buildMonthlySummary } from "@/lib/utils/monthly-summary";

export type TestCaseCounts = {
  total: number;
  draft: number;
  actual: number;
  passed: number;
  failed: number;
  blocked: number;
  deprecated: number;
};

export type TestRunSummary = {
  _id: string;
  name: string;
  status: "running" | "completed" | "aborted";
  created_at: string;
  stats?: { total: number; passed: number; failed: number; pending: number };
};

const EMPTY_COUNTS: TestCaseCounts = { total: 0, draft: 0, actual: 0, passed: 0, failed: 0, blocked: 0, deprecated: 0 };

export function useWorkspaceOverview() {
  const { t } = useI18n();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { workspaceId } = useRouteIds();
  const urlRoom = useWorkspaceRoom(workspaceId);

  const [ws] = useState(() => createWorkspacePageStore());
  const [uiActions] = useState(() => createUIActions());

  const stats = useStore(ws.stats);
  const workerStats = useStore(ws.workerStats);
  const projectStats = useStore(ws.projectStats);
  const assignees = useStore(ws.assignees);
  const projectList = useStore(ws.projectList);
  const allTasks = useStore(ws.allTasksIncludingArchived);
  const editingTask = useStore(ws.editingTask);
  const loadingData = useStore(ws.loadingData);
  const hasAccess = useStore(ws.hasAccess);
  const checkingAccess = useStore(ws.checkingAccess);
  const modalState = useStore(modals);
  const sprintList = useStore(sprints);
  const ownerId = useStore(currentWorkspaceOwnerId);
  const workspaceName = useStore(currentWorkspaceName);

  const [testCaseCounts, setTestCaseCounts] = useState<TestCaseCounts>(EMPTY_COUNTS);
  const [recentTestRuns, setRecentTestRuns] = useState<TestRunSummary[]>([]);
  const [loadingTestData, setLoadingTestData] = useState(false);
  const runId = useRef(0);

  const isOwner = ownerId === user?.id;
  const completionRate = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  const tcPassRate = testCaseCounts.total > 0 ? Math.round((testCaseCounts.passed / testCaseCounts.total) * 100) : 0;
  const monthlySummary = useMemo(() => buildMonthlySummary(allTasks), [allTasks]);

  const resolvedWorkerStats = useMemo(
    () =>
      (workerStats || [])
        .map((s: any) => {
          const assignee = (assignees || []).find((a) => String(a.id) === String(s.id));
          return { name: String(assignee ? assignee.name : s.id), count: s.taskCount as number };
        })
        .sort((a, b) => b.count - a.count),
    [workerStats, assignees],
  );

  const resolvedProjectStats = useMemo(
    () =>
      (projectStats || [])
        .map((s: any) => {
          const project = (projectList || []).find((p) => String(p.id) === String(s.id));
          return {
            name: String(project ? project.name : s.id === "none" ? t("page__unassigned_project") : s.id),
            count: s.taskCount as number,
          };
        })
        .sort((a, b) => b.count - a.count),
    [projectStats, projectList, t],
  );

  const loadTestData = useCallback(async (id: string) => {
    setLoadingTestData(true);
    try {
      const [casesRes, runsRes] = await Promise.all([
        api.data.testCases.list(id, { limit: 5000, page: 1 }),
        api.testRuns.list(id, 1, 5),
      ]);
      if (casesRes.ok) {
        // The /counts endpoint only returns per-suite totals, so the status breakdown is counted here.
        const d = await casesRes.json();
        const cases: { status?: string }[] = Array.isArray(d) ? d : (d.data ?? d.test_cases ?? []);
        const next: TestCaseCounts = { ...EMPTY_COUNTS, total: cases.length };
        for (const testCase of cases) {
          const status = testCase.status as keyof Omit<TestCaseCounts, "total"> | undefined;
          if (status && status in next) next[status] += 1;
        }
        setTestCaseCounts(next);
      }
      if (runsRes.ok) {
        const d = await runsRes.json();
        setRecentTestRuns(d.data ?? d.test_runs ?? d ?? []);
      }
    } catch {
      /* Test data is supplementary; the overview renders without it. */
    } finally {
      setLoadingTestData(false);
    }
  }, []);

  useEffect(() => {
    document.title = t("meta__overview_title", { name: workspaceName || "Khun Phaen" });
  }, [t, workspaceName]);

  useEffect(() => {
    if (!workspaceId || workspaceId === MY_TASKS_WORKSPACE_ID || authLoading || !user || urlRoom === undefined) return;
    const run = ++runId.current;

    async function initialize(id: string, room: string | null) {
      ws.checkingAccess.set(true);
      ws.hasAccess.set(false);
      disconnectRealtime();
      if (!room) {
        ws.checkingAccess.set(false);
        return;
      }

      try {
        const res = await api.workspaces.checkAccess(room);
        const data = await res.json();
        if (run !== runId.current) return;
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
        void ws.loadData();
        void loadTestData(id);
      } catch {
        if (run !== runId.current) return;
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
  }, [workspaceId, urlRoom, authLoading, user, ws, loadTestData]);

  useEffect(() => {
    const handler = createKeyboardHandler(
      getKeyboardConfig({
        uiActions,
        modals,
        editingTask: null,
        setEditingTask: (v) => ws.editingTask.set(v),
        searchInputRef: null,
        visibleTabs: [],
        viewActions: ws.viewActions,
      }),
    );
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [ws, uiActions]);

  const openTaskPage = useCallback(
    (task: { id?: string | number }) => router.push(taskPath(workspaceId!, task.id!)),
    [router, workspaceId],
  );

  const goToWorkspace = useCallback(() => router.push(workspacePath(workspaceId!)), [router, workspaceId]);
  const goToTestCases = useCallback(
    () => router.push(workspacePath(workspaceId!, "test-cases")),
    [router, workspaceId],
  );

  function cancelEdit() {
    ws.editingTask.set(null);
    uiActions.closeModal("form");
  }

  return {
    ws,
    t,
    uiActions,
    workspaceId,
    modalState,
    sprintList,
    stats,
    assignees,
    projectList,
    allTasks,
    editingTask,
    loadingData,
    workerStats,
    projectStats,
    hasAccess,
    checkingAccess,
    isOwner,
    completionRate,
    tcPassRate,
    monthlySummary,
    resolvedWorkerStats,
    resolvedProjectStats,
    testCaseCounts,
    recentTestRuns,
    loadingTestData,
    openTaskPage,
    goToWorkspace,
    goToTestCases,
    cancelEdit,
  };
}
