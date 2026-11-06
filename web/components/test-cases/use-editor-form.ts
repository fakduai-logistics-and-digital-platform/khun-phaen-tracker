"use client";

import { consumeRoomParam } from "@/lib/room";
import { taskPath } from "@/lib/routes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Folder } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/apis";
import { useAuth } from "@/lib/auth/auth-provider";
import { getAssignees } from "@/lib/db";
import { connectRealtime } from "@/lib/stores/realtime";
import { broadcastTestCaseAssignment } from "@/lib/stores/testCaseNotifications";
import type { Assignee } from "@/lib/types";
import { createInitialForm, DEFAULT_GHERKIN_STEPS, type EditorForm, type EditorOption } from "./editor-options";
import { useEditorAttachments } from "./use-editor-attachments";

function suiteOption(value: string, label: string): EditorOption {
  return { value, label, icon: Folder, iconClass: "text-gray-400" };
}

export function useEditorForm(workspaceId: string | undefined) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const caseId = searchParams.get("case") || "";
  const isEditing = !!caseId;
  const suiteParam = searchParams.get("suite") || "";

  const [form, setForm] = useState<EditorForm>(() => ({ ...createInitialForm(suiteParam), testNo: caseId }));
  const [savedAssign, setSavedAssign] = useState({ dev: "unassigned", tester: "unassigned" });
  const [suiteOptions, setSuiteOptions] = useState<EditorOption[]>([]);
  const [workspaceAssignees, setWorkspaceAssignees] = useState<Assignee[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const attachmentState = useEditorAttachments();

  const isAuthorized = user?.role === "admin" || user?.profile?.position === "QA Tester";

  const setField = useCallback(
    <K extends keyof EditorForm>(key: K, value: EditorForm[K]) => setForm((f) => ({ ...f, [key]: value })),
    [],
  );

  const assigneeOptions = useMemo<EditorOption[]>(
    () => [
      { value: "unassigned", label: "Unassigned", user_id: undefined, avatarColor: "#64748b" },
      ...workspaceAssignees.map((a) => ({
        value: String(a.id || ""),
        label: a.name,
        user_id: a.user_id,
        avatarUrl: a.avatar_url,
        avatarColor: a.color,
      })),
    ],
    [workspaceAssignees],
  );

  const availableAssigneeOptions = useMemo(
    () =>
      isAuthorized
        ? assigneeOptions
        : assigneeOptions
            .filter((o) => o.value === "unassigned" || String(o.user_id) === String(user?.id))
            .map((o) => (String(o.user_id) === String(user?.id) ? { ...o, label: "me" } : o)),
    [isAuthorized, assigneeOptions, user?.id],
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const roomCode = workspaceId ? consumeRoomParam(workspaceId) : null;
        if (roomCode) connectRealtime(roomCode);

        const assignees = await getAssignees(true);
        if (cancelled) return;
        setWorkspaceAssignees(assignees);

        if (workspaceId) {
          const suiteResp = await api.data.testSuites.list(workspaceId);
          if (suiteResp.ok) {
            const suites = await suiteResp.json();
            const options = suites.map((s: any) => suiteOption(s.id || s._id, s.title));
            if (cancelled) return;
            setSuiteOptions(options);
            if (options.length > 0 && options[0].value) {
              setForm((f) => (f.suiteId ? f : { ...f, suiteId: options[0].value }));
            }
          }
        }

        if (!isEditing && workspaceId) {
          const resp = await api.data.testCases.nextNumber(workspaceId);
          if (resp.ok) {
            const data = await resp.json();
            if (!cancelled) setForm((f) => ({ ...f, testNo: `TC-${data.next_number}` }));
          }
        }

        if (isEditing && caseId) {
          const tcResp = await api.data.testCases.get(caseId);
          if (tcResp.ok) {
            const tc = await tcResp.json();
            if (cancelled) return;
            const assignDev = tc.assign_dev || "unassigned";
            const assignTester = tc.assign_tester || "unassigned";
            setSavedAssign({ dev: assignDev, tester: assignTester });
            setForm((f) => ({
              ...f,
              name: tc.name || "",
              suiteId: tc.suite_id || "",
              description: tc.description || "",
              preconditions: tc.preconditions || "",
              postconditions: tc.postconditions || "",
              status: tc.status || "actual",
              priority: tc.priority || "medium",
              assignDev,
              assignTester,
              testNo: `TC-${tc.test_no}`,
              input: tc.input || "",
              expectedResult: tc.expected_result || "",
              actualResult: tc.actual_result || "",
              fixed: tc.fixed || "no",
              devNote: tc.dev_note || "",
              testNote: tc.test_note || "",
              stepFormat: tc.step_format || "classic",
              gherkinSteps:
                tc.step_format === "gherkin"
                  ? tc.gherkin_steps && tc.gherkin_steps.length > 0
                    ? tc.gherkin_steps
                    : DEFAULT_GHERKIN_STEPS.map((s) => ({ ...s }))
                  : f.gherkinSteps,
              classicSteps:
                tc.step_format !== "gherkin" && tc.classic_steps && tc.classic_steps.length > 0
                  ? tc.classic_steps
                  : f.classicSteps,
            }));
          }
        }
      } catch (e) {
        console.error("Failed to initialize editor:", e);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, caseId]);

  const backToRepository = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("suite");
    params.delete("case");
    const query = params.toString();
    router.push(`/workspaces/test-cases/?${query}`);
  }, [router, searchParams]);

  const convertToTask = useCallback(async () => {
    if (!caseId) return;
    try {
      const resp = await api.data.testCases.convertToTask(caseId);
      if (resp.ok) {
        const data = await resp.json();
        toast.success("Task created successfully");
        router.push(taskPath(workspaceId!, data.task_id));
      } else {
        const error = await resp.text();
        toast.error(`Failed to create task: ${error}`);
      }
    } catch {
      toast.error("An error occurred");
    }
  }, [caseId, router, workspaceId]);

  const createSuite = useCallback(
    async (title: string): Promise<boolean> => {
      if (!title.trim() || !workspaceId) return false;
      try {
        const resp = await api.data.testSuites.create(workspaceId, { title });
        if (resp.ok) {
          const newSuite = await resp.json();
          const newId = newSuite.id || newSuite._id;
          setSuiteOptions((prev) => [...prev, suiteOption(newId, newSuite.title)]);
          setField("suiteId", newId);
          toast.success("Suite created successfully");
          return true;
        }
        toast.error("Failed to create suite");
      } catch (e) {
        console.error("Create suite error:", e);
        toast.error("An unexpected error occurred");
      }
      return false;
    },
    [workspaceId, setField],
  );

  const submit = useCallback(async () => {
    if (!form.name.trim()) return;
    setIsSaving(true);

    try {
      const payload = {
        suite_id: form.suiteId && form.suiteId !== "undefined" ? String(form.suiteId) : null,
        name: form.name.trim(),
        description: form.description,
        preconditions: form.preconditions,
        postconditions: form.postconditions,
        input: form.input,
        expected_result: form.expectedResult,
        actual_result: form.actualResult,
        status: form.status,
        priority: form.priority,
        fixed: form.fixed,
        assign_dev: form.assignDev,
        assign_tester: form.assignTester,
        dev_note: form.devNote,
        test_note: form.testNote,
        step_format: form.stepFormat,
        classic_steps: form.stepFormat === "classic" ? form.classicSteps : undefined,
        gherkin_steps: form.stepFormat === "gherkin" ? form.gherkinSteps : undefined,
      };

      if (!workspaceId) return;

      const resp =
        isEditing && caseId
          ? await api.data.testCases.update(caseId, payload)
          : await api.data.testCases.create(workspaceId, payload);

      if (resp.ok) {
        const result = isEditing ? { id: caseId } : await resp.json();
        const testCaseId = result.id;
        broadcastTestCaseAssignment({
          id: testCaseId,
          title: form.name.trim(),
          workspaceId,
          suiteId: form.suiteId,
          assignees: workspaceAssignees,
          nextAssigneeIds: [form.assignDev, form.assignTester],
          previousAssigneeIds: isEditing ? [savedAssign.dev, savedAssign.tester] : [],
          action: isEditing ? "update" : "create",
        });

        if (attachmentState.attachments.length > 0) {
          const formData = new FormData();
          attachmentState.attachments.forEach((a) => formData.append("files", a.file));
          await api.data.testCases.uploadAttachment(workspaceId, testCaseId, formData);
        }

        toast.success(isEditing ? "Test case updated successfully" : "Test case created successfully");
        backToRepository();
      } else {
        const error = await resp.json();
        toast.error(error.error || `Failed to ${isEditing ? "update" : "create"} test case`);
      }
    } catch (e) {
      console.error("Save error:", e);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  }, [
    form,
    workspaceId,
    isEditing,
    caseId,
    workspaceAssignees,
    savedAssign,
    attachmentState.attachments,
    backToRepository,
  ]);

  return {
    form,
    setField,
    caseId,
    isEditing,
    isAuthorized,
    isSaving,
    suiteOptions,
    assigneeOptions,
    availableAssigneeOptions,
    ...attachmentState,
    backToRepository,
    convertToTask,
    createSuite,
    submit,
  };
}
