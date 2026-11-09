"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { api } from "@/lib/api/apis";
import { notify } from "./tc-notify";
import type { Suite } from "./tc-types";

type UseTcSuitesArgs = {
  workspaceId: string;
  setSuites: Dispatch<SetStateAction<Suite[]>>;
  /** Project currently shown (`all`, `none` or an id); new suites start there. */
  projectId: string;
  reload: () => void | Promise<void>;
};

export function useTcSuites({ workspaceId, setSuites, projectId, reload }: UseTcSuitesArgs) {
  const [showCreateSuite, setShowCreateSuite] = useState(false);
  const [newSuiteName, setNewSuiteName] = useState("");
  const [newSuiteProject, setNewSuiteProject] = useState("none");
  useEffect(() => {
    if (showCreateSuite) setNewSuiteProject(projectId === "all" ? "none" : projectId);
  }, [showCreateSuite, projectId]);
  const [editingSuite, setEditingSuite] = useState<Suite | null>(null);
  const [suiteToDelete, setSuiteToDelete] = useState<Suite | null>(null);
  const [deleteMode, setDeleteMode] = useState<"move" | "delete">("move");

  const createSuite = useCallback(async () => {
    if (!newSuiteName.trim() || !workspaceId) return;
    try {
      const resp = await api.data.testSuites.create(workspaceId, {
        title: newSuiteName,
        project_id: newSuiteProject === "none" ? "" : newSuiteProject,
      });
      if (resp.ok) {
        const newSuite = await resp.json();
        setSuites((prev) => [
          ...prev,
          { ...newSuite, id: newSuite.id || newSuite._id, cases: [], page: 1, hasMore: false },
        ]);
        setNewSuiteName("");
        setShowCreateSuite(false);
        notify("Suite created successfully", "success");
      } else {
        notify("Failed to create suite", "error");
      }
    } catch (e) {
      console.error("Create suite error:", e);
      notify("An unexpected error occurred", "error");
    }
    // The new suite may belong to a project other than the one on screen.
    void reload();
  }, [newSuiteName, newSuiteProject, reload, setSuites, workspaceId]);

  const updateSuite = useCallback(async () => {
    if (!editingSuite || !editingSuite.title.trim()) return;
    const suiteId = editingSuite.id || (editingSuite as unknown as { _id: string })._id;
    const newTitle = editingSuite.title;
    try {
      const project = editingSuite.project_id || "";
      const resp = await api.data.testSuites.update(suiteId, { title: newTitle, project_id: project });
      if (resp.ok) {
        setSuites((prev) =>
          prev.map((s) => {
            const currentId = s.id || (s as unknown as { _id: string })._id;
            return currentId === suiteId ? { ...s, title: newTitle } : s;
          }),
        );
        notify("Suite updated", "success");
        setEditingSuite(null);
        void reload();
      } else {
        const errorData = await resp.text();
        console.error("Failed to update suite. Status:", resp.status, "Error:", errorData);
        notify(`Failed to update suite: ${errorData}`, "error");
      }
    } catch (e) {
      console.error("Update suite error:", e);
      notify("An error occurred", "error");
    }
  }, [editingSuite, reload, setSuites]);

  const deleteSuite = useCallback(async () => {
    if (!suiteToDelete) return;
    try {
      const resp = await api.data.testSuites.delete(suiteToDelete.id, deleteMode);
      if (resp.ok) {
        const movedCases = suiteToDelete.cases || [];
        setSuites((prev) => {
          let next = prev;
          if (deleteMode === "move") {
            next = prev.some((s) => s.id === "unassigned")
              ? prev.map((s) => (s.id === "unassigned" ? { ...s, cases: [...s.cases, ...movedCases] } : s))
              : [
                  ...prev,
                  {
                    id: "unassigned",
                    title: "Unassigned",
                    description: "",
                    cases: movedCases,
                    page: 1,
                    hasMore: false,
                  },
                ];
          }
          return next.filter((s) => s.id !== suiteToDelete.id);
        });
        notify("Suite deleted", "success");
        setSuiteToDelete(null);
      } else {
        notify("Failed to delete suite", "error");
      }
    } catch {
      notify("An error occurred", "error");
    }
  }, [deleteMode, setSuites, suiteToDelete]);

  const requestDeleteSuite = useCallback((suite: Suite, mode?: "move" | "delete") => {
    setSuiteToDelete(suite);
    const resolved = mode ?? (suite.id === "unassigned" ? "delete" : undefined);
    if (resolved) setDeleteMode(resolved);
  }, []);

  return {
    showCreateSuite,
    setShowCreateSuite,
    newSuiteName,
    setNewSuiteName,
    newSuiteProject,
    setNewSuiteProject,
    editingSuite,
    setEditingSuite,
    suiteToDelete,
    setSuiteToDelete,
    deleteMode,
    setDeleteMode,
    createSuite,
    updateSuite,
    deleteSuite,
    requestDeleteSuite,
  };
}
