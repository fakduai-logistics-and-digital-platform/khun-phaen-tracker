"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { api } from "@/lib/api/apis";
import { useI18n } from "@/lib/i18n";
import { broadcastTestCaseAssignment } from "@/lib/stores/testCaseNotifications";
import { notify } from "./tc-notify";
import {
  mapBackendToFrontend,
  type AssigneeRecord,
  type Suite,
  type TestCase,
  type TestCasePriority,
} from "./tc-types";

type UseTcCaseActionsArgs = {
  workspaceId: string;
  assignees: AssigneeRecord[];
  setSuites: Dispatch<SetStateAction<Suite[]>>;
  patchTestCase: (caseId: string, patch: Partial<TestCase>) => void;
  selectedCaseId: string;
  setSelectedCaseId: (id: string) => void;
  setSelectedSuiteId: (id: string) => void;
  setShowDetail: (show: boolean) => void;
  openTaskDetail: (taskId: string) => void;
};

export function useTcCaseActions({
  workspaceId,
  assignees,
  setSuites,
  patchTestCase,
  selectedCaseId,
  setSelectedCaseId,
  setSelectedSuiteId,
  setShowDetail,
  openTaskDetail,
}: UseTcCaseActionsArgs) {
  const { t } = useI18n();
  const [updatingPriorityIds, setUpdatingPriorityIds] = useState<Set<string>>(new Set());
  const [caseToDeleteId, setCaseToDeleteId] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const updateStatus = useCallback(
    async (testCase: TestCase, newStatus: string) => {
      try {
        const resp = await api.data.testCases.updateStatus(testCase.id, newStatus);
        if (resp.ok) {
          patchTestCase(testCase.id, { status: newStatus as TestCase["status"] });
          notify("Status updated", "success");
        }
      } catch {
        notify("Failed to update status", "error");
      }
    },
    [patchTestCase],
  );

  const updateFixed = useCallback(
    async (testCase: TestCase, newFixed: string) => {
      try {
        const resp = await api.data.testCases.updateFixed(testCase.id, newFixed);
        if (resp.ok) {
          patchTestCase(testCase.id, { fixed: newFixed as TestCase["fixed"] });
          notify("Fixed status updated", "success");
        } else {
          notify("Failed to update fixed status", "error");
        }
      } catch {
        notify("Failed to update fixed status", "error");
      }
    },
    [patchTestCase],
  );

  const updatePriority = useCallback(
    async (testCase: TestCase, newPriority: string) => {
      const priority = newPriority as TestCasePriority;
      if (testCase.priority === priority) return;

      const previousPriority = testCase.priority;
      setUpdatingPriorityIds((prev) => new Set(prev).add(testCase.id));
      patchTestCase(testCase.id, { priority });

      try {
        const resp = await api.data.testCases.updatePriority(testCase.id, priority);
        if (resp.ok) {
          notify("Priority updated", "success");
        } else {
          patchTestCase(testCase.id, { priority: previousPriority });
          notify("Failed to update priority", "error");
        }
      } catch {
        patchTestCase(testCase.id, { priority: previousPriority });
        notify("Failed to update priority", "error");
      } finally {
        setUpdatingPriorityIds((prev) => {
          const next = new Set(prev);
          next.delete(testCase.id);
          return next;
        });
      }
    },
    [patchTestCase],
  );

  const updateAssignTester = useCallback(
    async (testCase: TestCase, newAssignTester: string) => {
      try {
        const resp = await api.data.testCases.updateAssignTester(testCase.id, newAssignTester);
        if (resp.ok) {
          const previousAssignee = testCase.assignee || "unassigned";
          patchTestCase(testCase.id, { assignee: newAssignTester });
          broadcastTestCaseAssignment({
            id: testCase.id,
            title: testCase.title,
            workspaceId,
            suiteId: testCase.suite_id,
            assignees,
            nextAssigneeIds: [newAssignTester],
            previousAssigneeIds: [previousAssignee],
            action: "update",
          });
          notify("Tester updated", "success");
        } else {
          notify("Failed to update tester", "error");
        }
      } catch {
        notify("Failed to update tester", "error");
      }
    },
    [assignees, patchTestCase, workspaceId],
  );

  const updateAssignDev = useCallback(
    async (testCase: TestCase, newAssignDev: string) => {
      try {
        const resp = await api.data.testCases.updateAssignDev(testCase.id, newAssignDev);
        if (resp.ok) {
          const previousAssignee = testCase.assign_dev || "unassigned";
          patchTestCase(testCase.id, { assign_dev: newAssignDev });
          broadcastTestCaseAssignment({
            id: testCase.id,
            title: testCase.title,
            workspaceId,
            suiteId: testCase.suite_id,
            assignees,
            nextAssigneeIds: [newAssignDev],
            previousAssigneeIds: [previousAssignee],
            action: "update",
          });
          notify("Assignee updated", "success");
        } else {
          const err = await resp.text();
          notify(`Failed to update assignee: ${err}`, "error");
        }
      } catch {
        notify("Failed to update assignee", "error");
      }
    },
    [assignees, patchTestCase, workspaceId],
  );

  const requestDeleteCase = useCallback((id: string) => {
    setCaseToDeleteId(id);
    setShowDeleteModal(true);
  }, []);

  const cancelDeleteCase = useCallback(() => {
    setShowDeleteModal(false);
    setCaseToDeleteId("");
  }, []);

  const confirmDeleteCase = useCallback(async () => {
    if (!caseToDeleteId) return;
    try {
      const resp = await api.data.testCases.delete(caseToDeleteId);
      if (resp.ok) {
        setSuites((prev) =>
          prev.map((s) => {
            const filtered = s.cases.filter((c) => c.id !== caseToDeleteId);
            const removed = filtered.length < s.cases.length;
            return {
              ...s,
              cases: filtered,
              totalCount: removed
                ? Math.max(0, (s.totalCount ?? s.cases.length) - 1)
                : (s.totalCount ?? s.cases.length),
            };
          }),
        );
        if (selectedCaseId === caseToDeleteId) setSelectedCaseId("");
        notify("Test case deleted", "success");
      } else {
        notify("Failed to delete test case", "error");
      }
    } catch {
      notify("An error occurred", "error");
    } finally {
      setShowDeleteModal(false);
      setCaseToDeleteId("");
    }
  }, [caseToDeleteId, selectedCaseId, setSelectedCaseId, setSuites]);

  const convertToTask = useCallback(
    async (id: string) => {
      try {
        const resp = await api.data.testCases.convertToTask(id);
        if (resp.ok) {
          const data = await resp.json();
          notify("Task created successfully", "success");
          openTaskDetail(data.task_id);
        } else {
          const error = await resp.text();
          notify(`Failed to create task: ${error}`, "error");
        }
      } catch {
        notify("An error occurred", "error");
      }
    },
    [openTaskDetail],
  );

  const quickCreate = useCallback(
    async (suiteId: string, title: string) => {
      if (!title.trim() || !workspaceId) return;

      const payload = {
        suite_id: suiteId === "unassigned" ? null : suiteId,
        name: title.trim(),
        description: "",
        preconditions: "",
        postconditions: "",
        status: "actual",
        assign_tester: "unassigned",
        step_format: "gherkin",
        gherkin_steps: [],
      };

      try {
        const resp = await api.data.testCases.create(workspaceId, payload);
        if (resp.ok) {
          const newTcData = await resp.json();

          if (!newTcData.test_no) {
            const nextResp = await api.data.testCases.nextNumber(workspaceId);
            if (nextResp.ok) {
              const nextData = await nextResp.json();
              newTcData.test_no = (nextData.next_number || 1) - 1;
            }
          }

          const newCase = mapBackendToFrontend(newTcData);

          setSuites((prev) =>
            prev.map((suite) =>
              suite.id === (newCase.suite_id || "unassigned")
                ? {
                    ...suite,
                    cases: [...(suite.cases || []), newCase],
                    totalCount: (suite.totalCount ?? suite.cases.length) + 1,
                  }
                : suite,
            ),
          );

          setSelectedSuiteId(newCase.suite_id || "unassigned");
          setSelectedCaseId(newCase.id);
          setShowDetail(true);
          notify(t("testCases__created_success"), "success");
        } else {
          notify(t("testCases__created_error"), "error");
        }
      } catch (e) {
        console.error("Quick create error:", e);
        notify(t("page__error"), "error");
      }
    },
    [setSelectedCaseId, setSelectedSuiteId, setShowDetail, setSuites, t, workspaceId],
  );

  return {
    updatingPriorityIds,
    showDeleteModal,
    updateStatus,
    updateFixed,
    updatePriority,
    updateAssignTester,
    updateAssignDev,
    requestDeleteCase,
    cancelDeleteCase,
    confirmDeleteCase,
    convertToTask,
    quickCreate,
  };
}
