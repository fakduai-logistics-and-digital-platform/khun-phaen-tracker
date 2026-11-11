"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { api } from "@/lib/api/apis";
import type { User } from "@/lib/stores/auth";
import { translate } from "@/lib/i18n";
import { notify } from "./tc-notify";
import type { AssigneeRecord, NewTestRunForm, Suite, TestCase, TestRun, TestRunDetail } from "./tc-types";

const RUN_CREATORS_KEY = "test-run-creators";
const RUNS_PAGE_SIZE = 10;

type Creator = { created_by?: string; created_by_name?: string };

function saveRunCreator(runId: string, createdBy: string, createdByName: string) {
  try {
    const raw = localStorage.getItem(RUN_CREATORS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[runId] = { created_by: createdBy, created_by_name: createdByName };
    localStorage.setItem(RUN_CREATORS_KEY, JSON.stringify(map));
  } catch {}
}

function getRunCreator(runId: string): Creator {
  try {
    const raw = localStorage.getItem(RUN_CREATORS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return map[runId] ?? {};
  } catch {
    return {};
  }
}

function getAutoTestRunName(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `Test run ${dd}/${mm}/${now.getFullYear()} (auto)`;
}

type UseTcRunsArgs = {
  workspaceId: string;
  user: User | null;
  assignees: AssigneeRecord[];
  suites: Suite[];
  setSuites: Dispatch<SetStateAction<Suite[]>>;
  collapseSuites: () => void;
};

export function useTcRuns({ workspaceId, user, assignees, suites, setSuites, collapseSuites }: UseTcRunsArgs) {
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [testRunsPage, setTestRunsPage] = useState(1);
  const [testRunsTotal, setTestRunsTotal] = useState(0);
  const [isLoadingMoreRuns, setIsLoadingMoreRuns] = useState(false);
  const [viewMode, setViewMode] = useState<"suites" | "test-run">("suites");
  const [selectedRunDetail, setSelectedRunDetail] = useState<TestRunDetail | null>(null);
  const [isLoadingRunDetail, setIsLoadingRunDetail] = useState(false);
  const [updatingCaseId, setUpdatingCaseId] = useState<string | null>(null);
  const [showNewTestRunModal, setShowNewTestRunModal] = useState(false);
  const [newTestRunForm, setNewTestRunForm] = useState<NewTestRunForm>({
    name: "",
    description: "",
    defaultAssignee: "unassigned",
    operatingSystem: "",
  });
  const [selectedTestCaseIds, setSelectedTestCaseIds] = useState<Set<string>>(new Set());
  const [runToDelete, setRunToDelete] = useState<TestRun | null>(null);
  const [showDeleteRunModal, setShowDeleteRunModal] = useState(false);

  const resolveCreator = useCallback(
    (userId: string) => {
      const match = assignees.find((a) => String(a.user_id) === String(userId));
      const self = user && String(user.id) === String(userId) ? user : null;
      const selfName = self?.profile?.nickname || self?.profile?.first_name || self?.email.split("@")[0];
      return {
        name: match?.name ?? selfName ?? translate("tc__unknown_user"),
        avatarUrl: match?.avatar_url || match?.avatarUrl || undefined,
        color: match?.color || "#6366f1",
      };
    },
    [assignees, user],
  );

  const loadTestRuns = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setTestRunsPage(1);
      const res = await api.testRuns.list(workspaceId, 1, RUNS_PAGE_SIZE);
      if (res.ok) {
        const body = await res.json();
        setTestRuns(body.data ?? []);
        setTestRunsTotal(body.total ?? 0);
      }
    } catch {
      setTestRuns([]);
      setTestRunsTotal(0);
    }
  }, [workspaceId]);

  const loadMoreTestRuns = useCallback(async () => {
    if (!workspaceId || isLoadingMoreRuns) return;
    setIsLoadingMoreRuns(true);
    try {
      const nextPage = testRunsPage + 1;
      const res = await api.testRuns.list(workspaceId, nextPage, RUNS_PAGE_SIZE);
      if (res.ok) {
        const body = await res.json();
        setTestRuns((prev) => [...prev, ...(body.data ?? [])]);
        setTestRunsTotal(body.total ?? 0);
        setTestRunsPage(nextPage);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingMoreRuns(false);
    }
  }, [workspaceId, isLoadingMoreRuns, testRunsPage]);

  const openTestRun = useCallback(
    async (run: TestRun) => {
      if (!workspaceId) return;
      setIsLoadingRunDetail(true);
      setViewMode("test-run");
      setSelectedRunDetail(null);
      try {
        const res = await api.testRuns.get(workspaceId, run._id);
        if (res.ok) {
          const detail = await res.json();
          const localCreator = getRunCreator(run._id);
          const createdBy = detail.created_by || localCreator.created_by;
          if (createdBy) {
            const info = resolveCreator(createdBy);
            setSelectedRunDetail({
              ...detail,
              created_by: createdBy,
              created_by_name: info.name,
              created_by_avatar_url: info.avatarUrl,
              created_by_color: info.color,
            });
          } else {
            setSelectedRunDetail({ ...detail, created_by_name: localCreator.created_by_name });
          }
        }
      } catch {}
      setIsLoadingRunDetail(false);
    },
    [workspaceId, resolveCreator],
  );

  const closeTestRun = useCallback(() => {
    setViewMode("suites");
    setSelectedRunDetail(null);
  }, []);

  const openNewTestRunModal = useCallback(() => {
    const me = assignees.find((a) => String(a.user_id) === String(user?.id));
    setNewTestRunForm({
      name: getAutoTestRunName(),
      description: "",
      defaultAssignee: me ? String(me.id) : "unassigned",
      operatingSystem: "",
    });
    setSelectedTestCaseIds(new Set(suites.flatMap((s) => s.cases.map((c) => c.id))));
    setShowNewTestRunModal(true);
  }, [assignees, suites, user?.id]);

  const toggleTestCaseSelection = useCallback((id: string) => {
    setSelectedTestCaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSuiteSelection = useCallback((suite: Suite) => {
    setSelectedTestCaseIds((prev) => {
      const allSelected = suite.cases.every((c) => prev.has(c.id));
      const next = new Set(prev);
      suite.cases.forEach((c) => (allSelected ? next.delete(c.id) : next.add(c.id)));
      return next;
    });
  }, []);

  const createTestRun = useCallback(async () => {
    if (!newTestRunForm.name.trim() || !workspaceId) return;
    try {
      const res = await api.testRuns.create(workspaceId, {
        name: newTestRunForm.name.trim(),
        description: newTestRunForm.description.trim() || undefined,
        default_assignee: newTestRunForm.defaultAssignee,
        operating_system: newTestRunForm.operatingSystem,
        test_case_ids: Array.from(selectedTestCaseIds),
      });
      if (!res.ok) throw new Error(await res.text());
      const created: TestRun = await res.json();
      const creatorName = user ? user.profile?.nickname || user.profile?.first_name || user.email : "";
      saveRunCreator(created._id, user?.id ?? "", creatorName);
      setTestRuns((prev) => [created, ...prev]);
      setTestRunsTotal((n) => n + 1);
      setShowNewTestRunModal(false);
      collapseSuites();
      void openTestRun(created);
      notify("Test run created", "success");
    } catch {
      notify("Failed to create test run", "error");
    }
  }, [collapseSuites, newTestRunForm, openTestRun, selectedTestCaseIds, user, workspaceId]);

  const updateRunCaseStatus = useCallback(
    async (tcId: string, status: string, note?: string) => {
      if (!workspaceId || !selectedRunDetail) return;
      setUpdatingCaseId(tcId);
      try {
        const res = await api.testRuns.updateCaseStatus(workspaceId, selectedRunDetail.id, tcId, status, note);
        if (res.ok) {
          const savedNote = status === "failed" ? note?.trim() || null : null;
          const testCases = selectedRunDetail.test_cases.map((c) =>
            c.test_case_id === tcId ? { ...c, status, note: savedNote } : c,
          );
          const counts = { pending: 0, passed: 0, failed: 0, blocked: 0, skipped: 0, invalid: 0 };
          for (const c of testCases) {
            const k = c.status as keyof typeof counts;
            if (k in counts) counts[k]++;
            else counts.pending++;
          }
          setSelectedRunDetail({
            ...selectedRunDetail,
            test_cases: testCases,
            stats: { total: testCases.length, ...counts },
          });

          if (status === "passed" || status === "failed") {
            const tcRes = await api.data.testCases.updateStatus(tcId, status);
            if (tcRes.ok) {
              setSuites((prev) =>
                prev.map((s) => ({
                  ...s,
                  cases: s.cases.map((c) => (c.id === tcId ? { ...c, status: status as TestCase["status"] } : c)),
                })),
              );
            }
          }
        }
      } catch {}
      setUpdatingCaseId(null);
    },
    [workspaceId, selectedRunDetail, setSuites],
  );

  const updateRunStatus = useCallback(
    async (status: string) => {
      if (!workspaceId || !selectedRunDetail) return;
      const res = await api.testRuns.updateStatus(workspaceId, selectedRunDetail.id, status);
      if (res.ok) {
        const runId = selectedRunDetail.id;
        setSelectedRunDetail({ ...selectedRunDetail, status });
        setTestRuns((prev) => prev.map((r) => (r._id === runId ? { ...r, status: status as TestRun["status"] } : r)));
      }
    },
    [workspaceId, selectedRunDetail],
  );

  const requestDeleteRun = useCallback((run: TestRun | null) => {
    setRunToDelete(run);
    setShowDeleteRunModal(true);
  }, []);

  const cancelDeleteRun = useCallback(() => {
    setShowDeleteRunModal(false);
  }, []);

  const confirmDeleteTestRun = useCallback(async () => {
    const targetId = runToDelete?._id ?? selectedRunDetail?.id;
    if (!workspaceId || !targetId) return;
    const res = await api.testRuns.delete(workspaceId, targetId);
    if (res.ok) {
      setTestRuns((prev) => prev.filter((r) => r._id !== targetId));
      setTestRunsTotal((n) => Math.max(0, n - 1));
      if (selectedRunDetail?.id === targetId) closeTestRun();
      setShowDeleteRunModal(false);
      setRunToDelete(null);
      notify("Test run deleted", "success");
    } else {
      notify("Failed to delete test run", "error");
    }
  }, [closeTestRun, runToDelete, selectedRunDetail, workspaceId]);

  return {
    testRuns,
    testRunsTotal,
    isLoadingMoreRuns,
    viewMode,
    selectedRunDetail,
    isLoadingRunDetail,
    updatingCaseId,
    showNewTestRunModal,
    setShowNewTestRunModal,
    newTestRunForm,
    setNewTestRunForm,
    selectedTestCaseIds,
    showDeleteRunModal,
    loadTestRuns,
    loadMoreTestRuns,
    openTestRun,
    closeTestRun,
    openNewTestRunModal,
    toggleTestCaseSelection,
    toggleSuiteSelection,
    createTestRun,
    updateRunCaseStatus,
    updateRunStatus,
    requestDeleteRun,
    cancelDeleteRun,
    confirmDeleteTestRun,
  };
}
