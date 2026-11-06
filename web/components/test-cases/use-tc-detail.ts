"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { api } from "@/lib/api/apis";
import { notify } from "./tc-notify";
import type { Suite, SidebarTab, TestCase } from "./tc-types";

function initialSteps(testCase: TestCase, format: "classic" | "gherkin"): any[] {
  return format === "gherkin"
    ? [...(testCase.gherkin_steps || [])]
    : [...(testCase.classic_steps || testCase.steps || [])];
}

type UseTcDetailArgs = {
  selectedCase: TestCase | null;
  isAuthorized: boolean;
  setSuites: Dispatch<SetStateAction<Suite[]>>;
};

export function useTcDetail({ selectedCase, isAuthorized, setSuites }: UseTcDetailArgs) {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("general");
  const [sidebarSteps, setSidebarSteps] = useState<any[]>([]);
  const [sidebarStepFormat, setSidebarStepFormat] = useState<"classic" | "gherkin">("classic");
  const [isEditingSteps, setIsEditingSteps] = useState(false);
  const [isSavingSteps, setIsSavingSteps] = useState(false);
  const [devNote, setDevNote] = useState("");
  const [testNote, setTestNote] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempFieldValue, setTempFieldValue] = useState("");
  const [isSavingField, setIsSavingField] = useState(false);

  const selectedCaseId = selectedCase?.id;
  useEffect(() => {
    if (!selectedCase) return;
    const format = selectedCase.step_format || "classic";
    setIsEditingSteps(false);
    setSidebarStepFormat(format);
    setSidebarSteps(initialSteps(selectedCase, format));
    setDevNote(selectedCase.dev_note || "");
    setTestNote(selectedCase.test_note || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCaseId]);

  const patchSelected = useCallback(
    (patch: Partial<TestCase>) => {
      if (!selectedCaseId) return;
      setSuites((prev) =>
        prev.map((s) => ({
          ...s,
          cases: s.cases.map((c) => (c.id === selectedCaseId ? { ...c, ...patch } : c)),
        })),
      );
    },
    [selectedCaseId, setSuites],
  );

  const startEditing = useCallback(
    (field: string, value: string) => {
      if (!isAuthorized) return;
      setEditingField(field);
      setTempFieldValue(value || "");
    },
    [isAuthorized],
  );

  const cancelEditing = useCallback(() => setEditingField(null), []);

  const saveField = useCallback(
    async (field: string) => {
      if (!selectedCaseId) return;
      setIsSavingField(true);
      try {
        const dbField = field === "title" ? "name" : field;
        const resp = await api.data.testCases.update(selectedCaseId, { [dbField]: tempFieldValue });
        if (resp.ok) {
          patchSelected({ [field]: tempFieldValue } as Partial<TestCase>);
          setEditingField(null);
          notify("Field updated", "success");
        } else {
          notify("Failed to update field", "error");
        }
      } catch {
        notify("An error occurred", "error");
      } finally {
        setIsSavingField(false);
      }
    },
    [patchSelected, selectedCaseId, tempFieldValue],
  );

  const saveSteps = useCallback(async () => {
    if (!selectedCaseId) return;
    setIsSavingSteps(true);
    try {
      const payload = {
        step_format: sidebarStepFormat,
        classic_steps: sidebarStepFormat === "classic" ? sidebarSteps : undefined,
        gherkin_steps: sidebarStepFormat === "gherkin" ? sidebarSteps : undefined,
      };
      const resp = await api.data.testCases.updateSteps(selectedCaseId, payload);
      if (resp.ok) {
        setIsEditingSteps(false);
        notify("Steps updated", "success");
        patchSelected({
          step_format: sidebarStepFormat,
          classic_steps: payload.classic_steps,
          gherkin_steps: payload.gherkin_steps,
          steps:
            sidebarStepFormat === "classic"
              ? sidebarSteps
              : sidebarSteps.map((gs) => ({ action: `${gs.keyword} ${gs.text}`, data: "", expected: "" })),
        });
      } else {
        notify("Failed to update steps", "error");
      }
    } catch {
      notify("An error occurred", "error");
    } finally {
      setIsSavingSteps(false);
    }
  }, [patchSelected, selectedCaseId, sidebarStepFormat, sidebarSteps]);

  const cancelStepsEdit = useCallback(() => {
    if (!selectedCase) return;
    const format = selectedCase.step_format || "classic";
    setIsEditingSteps(false);
    setSidebarStepFormat(format);
    setSidebarSteps(initialSteps(selectedCase, format));
  }, [selectedCase]);

  const saveNotes = useCallback(async () => {
    if (!selectedCaseId) return;
    setIsSavingNotes(true);
    try {
      const resp = await api.data.testCases.updateNotes(selectedCaseId, {
        dev_note: devNote,
        test_note: testNote,
      });
      if (resp.ok) {
        notify("Notes updated", "success");
        patchSelected({ dev_note: devNote, test_note: testNote });
      } else {
        notify("Failed to update notes", "error");
      }
    } catch {
      notify("An error occurred", "error");
    } finally {
      setIsSavingNotes(false);
    }
  }, [devNote, patchSelected, selectedCaseId, testNote]);

  return {
    sidebarTab,
    setSidebarTab,
    sidebarSteps,
    setSidebarSteps,
    sidebarStepFormat,
    setSidebarStepFormat,
    isEditingSteps,
    setIsEditingSteps,
    isSavingSteps,
    devNote,
    setDevNote,
    testNote,
    setTestNote,
    isSavingNotes,
    editingField,
    tempFieldValue,
    setTempFieldValue,
    isSavingField,
    startEditing,
    cancelEditing,
    saveField,
    saveSteps,
    cancelStepsEdit,
    saveNotes,
  };
}
