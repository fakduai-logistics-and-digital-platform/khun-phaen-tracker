"use client";

import { consumeRoomParam } from "@/lib/room";
import { taskPath } from "@/lib/routes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Folder } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/apis";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n";
import { getAssignees, getProjectsList } from "@/lib/db";
import { connectRealtime } from "@/lib/stores/realtime";
import { broadcastTestCaseAssignment } from "@/lib/stores/testCaseNotifications";
import type { Assignee, Project } from "@/lib/types";
import { createInitialForm, DEFAULT_GHERKIN_STEPS, type EditorForm, type EditorOption } from "./editor-options";
import { useEditorAttachments } from "./use-editor-attachments";

function suiteOption(value: string, label: string, project_id = ""): EditorOption {
  return { value, label, project_id, icon: Folder, iconClass: "text-muted-foreground" };
}

export function useEditorForm(workspaceId: string | undefined) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { t } = useI18n();
  const caseId = searchParams.get("case") || "";
  const isEditing = !!caseId;
  const suiteParam = searchParams.get("suite") || "";
  const projectParam = searchParams.get("project") || "";

  const [form, setForm] = useState<EditorForm>(() => ({ ...createInitialForm(suiteParam), testNo: caseId }));
  const [savedAssign, setSavedAssign] = useState({ dev: "unassigned", tester: "unassigned" });
  const [allSuiteOptions, setAllSuiteOptions] = useState<EditorOption[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaceAssignees, setWorkspaceAssignees] = useState<Assignee[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [numberError, setNumberError] = useState<"" | "invalid" | "duplicate">("");
  const numberEdited = useRef(false);
  const attachmentState = useEditorAttachments();

  const isAuthorized = user?.role === "admin" || user?.profile?.position === "QA Tester";

  const setField = useCallback(
    <K extends keyof EditorForm>(key: K, value: EditorForm[K]) => setForm((f) => ({ ...f, [key]: value })),
    [],
  );

  // With projects, a case can only sit in a suite of its own project; without any, every suite is offered.
  const suiteOptions = useMemo(
    () =>
      projects.length > 0
        ? allSuiteOptions.filter((option) => (option.project_id || "") === form.projectId)
        : allSuiteOptions,
    [allSuiteOptions, projects.length, form.projectId],
  );

  /** Switching project leaves the suite alone only when it belongs to the new project. */
  const setProject = useCallback(
    (projectId: string) =>
      setForm((f) => {
        const inProject = allSuiteOptions.filter((o) => (o.project_id || "") === projectId);
        const keep = inProject.some((o) => o.value === f.suiteId);
        return { ...f, projectId, suiteId: keep ? f.suiteId : (inProject[0]?.value ?? "") };
      }),
    [allSuiteOptions],
  );

  const setTestNo = useCallback((value: string) => {
    numberEdited.current = true;
    setForm((f) => ({ ...f, testNo: value.replace(/\D/g, "") }));
  }, []);

  // A new case starts at the next free number of its project; typing a number takes over.
  useEffect(() => {
    if (isEditing || !workspaceId || numberEdited.current) return;
    let cancelled = false;
    void (async () => {
      const resp = await api.data.testCases.nextNumber(workspaceId, form.projectId);
      if (!resp.ok || cancelled || numberEdited.current) return;
      const data = await resp.json();
      if (!cancelled) setForm((f) => ({ ...f, testNo: String(data.next_number) }));
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditing, workspaceId, form.projectId]);

  // Numbers are unique within a project: look the number up before the user saves.
  useEffect(() => {
    if (!form.testNo) {
      setNumberError("");
      return;
    }
    const number = Number(form.testNo);
    if (!Number.isInteger(number) || number < 1) {
      setNumberError("invalid");
      return;
    }
    if (!workspaceId) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const resp = await api.data.testCases.all(workspaceId, {
          project_id: form.projectId || "none",
          field: "test_no",
          q: String(number),
        });
        if (!resp.ok || cancelled) return;
        const found = await resp.json();
        const rows: any[] = Array.isArray(found) ? found : (found.data ?? []);
        const taken = rows.some((row) => Number(row.test_no) === number && (row.id || row._id) !== caseId);
        setNumberError(taken ? "duplicate" : "");
      } catch {
        /* The server still rejects a duplicate on save. */
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.testNo, form.projectId, workspaceId, caseId]);

  const assigneeOptions = useMemo<EditorOption[]>(
    () => [
      { value: "unassigned", label: t("tcEditor__unassigned"), user_id: undefined, avatarColor: "#64748b" },
      ...workspaceAssignees.map((a) => ({
        value: String(a.id || ""),
        label: a.name,
        user_id: a.user_id,
        avatarUrl: a.avatar_url,
        avatarColor: a.color,
      })),
    ],
    [workspaceAssignees, t],
  );

  const availableAssigneeOptions = useMemo(
    () =>
      isAuthorized
        ? assigneeOptions
        : assigneeOptions
            .filter((o) => o.value === "unassigned" || String(o.user_id) === String(user?.id))
            .map((o) => (String(o.user_id) === String(user?.id) ? { ...o, label: t("tcEditor__me") } : o)),
    [isAuthorized, assigneeOptions, user?.id, t],
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
          const [suiteResp, projectList] = await Promise.all([
            api.data.testSuites.list(workspaceId),
            getProjectsList(),
          ]);
          if (cancelled) return;
          setProjects(projectList);
          if (suiteResp.ok) {
            const suites = await suiteResp.json();
            const options: EditorOption[] = suites
              .filter((s: any) => (s.id || s._id) !== "unassigned")
              .map((s: any) => suiteOption(s.id || s._id, s.title, s.project_id || ""));
            if (cancelled) return;
            setAllSuiteOptions(options);
            if (!isEditing) {
              // New case: start in the requested suite (or project) and take that suite's project.
              const requested = options.find((o) => o.value === suiteParam);
              const projectId = requested ? requested.project_id || "" : projectParam;
              const first = requested ?? options.find((o) => (o.project_id || "") === projectId);
              setForm((f) => ({ ...f, projectId, suiteId: first?.value ?? "" }));
            }
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
              projectId: tc.project_id || "",
              description: tc.description || "",
              preconditions: tc.preconditions || "",
              postconditions: tc.postconditions || "",
              status: tc.status || "actual",
              priority: tc.priority || "medium",
              assignDev,
              assignTester,
              testNo: String(tc.test_no ?? ""),
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
        toast.success(t("tcEditor__task_created"));
        router.push(taskPath(workspaceId!, data.task_id));
      } else {
        const error = await resp.text();
        toast.error(`${t("tcEditor__task_create_failed")}: ${error}`);
      }
    } catch {
      toast.error(t("tcEditor__error"));
    }
  }, [caseId, router, workspaceId, t]);

  const createSuite = useCallback(
    async (title: string): Promise<boolean> => {
      if (!title.trim() || !workspaceId) return false;
      try {
        const resp = await api.data.testSuites.create(workspaceId, { title, project_id: form.projectId });
        if (resp.ok) {
          const newSuite = await resp.json();
          const newId = newSuite.id || newSuite._id;
          setAllSuiteOptions((prev) => [...prev, suiteOption(newId, newSuite.title, form.projectId)]);
          setField("suiteId", newId);
          toast.success(t("tcEditor__suite_created"));
          return true;
        }
        toast.error(t("tcEditor__suite_create_failed"));
      } catch (e) {
        console.error("Create suite error:", e);
        toast.error(t("tcEditor__unexpected_error"));
      }
      return false;
    },
    [workspaceId, form.projectId, setField, t],
  );

  const submit = useCallback(async () => {
    if (!form.name.trim()) return;
    if (numberError) {
      toast.error(t(numberError === "duplicate" ? "tcEditor__test_no_duplicate" : "tcEditor__test_no_invalid"));
      return;
    }
    setIsSaving(true);

    try {
      const payload = {
        suite_id: form.suiteId && form.suiteId !== "undefined" ? String(form.suiteId) : null,
        project_id: form.projectId,
        test_no: form.testNo ? Number(form.testNo) : undefined,
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

        toast.success(isEditing ? t("tcEditor__updated") : t("tcEditor__created"));
        backToRepository();
      } else {
        const error = await resp.json();
        if (resp.status === 409) setNumberError("duplicate");
        toast.error(resp.status === 409 ? t("tcEditor__test_no_duplicate") : error.error || (isEditing ? t("tcEditor__update_failed") : t("tcEditor__create_failed")));
      }
    } catch (e) {
      console.error("Save error:", e);
      toast.error(t("tcEditor__unexpected_error"));
    } finally {
      setIsSaving(false);
    }
  }, [
    form,
    numberError,
    workspaceId,
    isEditing,
    caseId,
    workspaceAssignees,
    savedAssign,
    attachmentState.attachments,
    backToRepository,
    t,
  ]);

  return {
    form,
    setField,
    caseId,
    isEditing,
    isAuthorized,
    isSaving,
    numberError,
    setTestNo,
    suiteOptions,
    projects,
    setProject,
    assigneeOptions,
    availableAssigneeOptions,
    ...attachmentState,
    backToRepository,
    convertToTask,
    createSuite,
    submit,
  };
}
