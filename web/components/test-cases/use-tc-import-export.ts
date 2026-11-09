"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api/apis";
import { useI18n } from "@/lib/i18n";
import type { Project } from "@/lib/types";
import { downloadCsv, EXPORT_HEADERS, parseCSV, stepsToText, toCsv } from "./tc-csv";
import { notify } from "./tc-notify";
import { mapBackendToFrontend, type ImportProgress, type ImportSummary, type Suite, type TestCase } from "./tc-types";

type UseTcImportExportArgs = {
  workspaceId: string;
  projects: Project[];
  /** `all`, `none` or a project id: what the repository currently shows. */
  projectId: string;
  suites: Suite[];
  selectedSuiteId: string;
  reload: () => Promise<void>;
};

export function useTcImportExport({
  workspaceId,
  projects,
  projectId,
  suites,
  selectedSuiteId,
  reload,
}: UseTcImportExportArgs) {
  const { t } = useI18n();
  const [showImportModal, setShowImportModal] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    current: 0,
    total: 0,
    status: "",
  });
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const exportToCSV = useCallback(async () => {
    if (!workspaceId) return;
    try {
      notify("Preparing export...", "info");
      const unassignedLabel = () => {
        const label = t("testCase__unassigned");
        return label === "testCase__unassigned" ? "Unassigned" : label;
      };

      const usersResp = await api.auth.listUsers(workspaceId);
      const usersData = await usersResp.json();
      const userPositionMap = new Map<string, string>();
      const userNameMap = new Map<string, string>();

      if (usersData.success && Array.isArray(usersData.users)) {
        usersData.users.forEach((u: any) => {
          const id = u.id || u.user_id;
          userNameMap.set(id, u.profile?.nickname || u.profile?.first_name || u.email);
          userPositionMap.set(id, u.profile?.position || "");
        });
      }

      // Only what is on screen: a selected project exports just that project's cases.
      const casesResp = await api.data.testCases.all(workspaceId, {
        project_id: projectId === "all" ? undefined : projectId,
      });
      if (!casesResp.ok) {
        notify("Failed to fetch test cases for export", "error");
        return;
      }
      const allCases: TestCase[] = (await casesResp.json()).map(mapBackendToFrontend);

      const suitesResp = await api.data.testSuites.list(workspaceId);
      const suitesData = await suitesResp.json();
      const suiteMap = new Map<string, string>(suitesData.map((s: any) => [s.id || s._id, String(s.title || "")]));
      suiteMap.set("unassigned", "Unassigned");

      const nameOf = (id: string) => userNameMap.get(id) || (id === "unassigned" ? unassignedLabel() : id);

      const projectNames = new Map(projects.map((p) => [String(p.id), p.name]));
      const rows = allCases.map((c) => {
        const testerId = c.assignee || "unassigned";
        const devId = c.assign_dev || "unassigned";
        return [
          String(projectNames.get(c.project_id || "") || ""),
          String(suiteMap.get(c.suite_id) || "Unassigned"),
          String(c.test_no),
          String(c.title || ""),
          String(c.status || ""),
          String(nameOf(testerId)),
          String(userPositionMap.get(testerId) || ""),
          String(nameOf(devId)),
          String(userPositionMap.get(devId) || ""),
          String(c.preconditions || ""),
          String(c.input || ""),
          String(c.expected_result || ""),
          String(c.actual_result || ""),
          String(stepsToText(c) || ""),
        ];
      });

      downloadCsv(toCsv(EXPORT_HEADERS, rows), `test_cases_export_${new Date().toISOString().split("T")[0]}.csv`);
      notify("Export complete", "success");
    } catch (e) {
      console.error("Export error:", e);
      notify("Failed to export test cases", "error");
    }
  }, [projectId, projects, t, workspaceId]);

  const importFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length <= 1) {
        notify("CSV file appears to be empty or has only headers.", "error");
        return;
      }

      const headers = rows[0].map((h, i) => {
        let cleaned = h.trim().toLowerCase();
        if (i === 0) cleaned = cleaned.replace(/^﻿/, "");
        return cleaned;
      });

      const casesToCreate: Record<string, any>[] = [];
      // Suites are matched by title inside their own project, so the same title may exist in several projects.
      const suiteKey = (project: string, title: string) => `${project}\u0000${title.toLowerCase().trim()}`;
      const suiteMap = new Map<string, string>();
      if (workspaceId) {
        const resp = await api.data.testSuites.list(workspaceId);
        if (resp.ok) {
          for (const s of await resp.json()) {
            const id = s.id || s._id;
            if (id !== "unassigned") suiteMap.set(suiteKey(s.project_id || "", String(s.title || "")), id);
          }
        }
      }
      const baseProject = projectId === "all" || projectId === "none" ? "" : projectId;
      const selectedProject = suites.find((s) => s.id === selectedSuiteId)?.project_id || "";

      const skipped: ImportSummary["skipped"] = [];

      for (let i = 1; i < rows.length; i++) {
        const values = rows[i];
        if (values.length === 0) continue;

        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = (values[idx] || "").trim();
        });

        const title = row["test name"] || row["title"] || row["test name "] || row["name"] || row["testname"];

        if (!title) {
          skipped.push({ row: i + 1, reason: 'Missing "Test Name" column or value.' });
          continue;
        }

        // A "Project" column picks the project by name; without it rows go to the project on screen.
        let rowProject = baseProject;
        const projectName = row["project"];
        if (projectName) {
          const found = projects.find((p) => p.name.toLowerCase().trim() === projectName.toLowerCase().trim());
          if (!found) {
            skipped.push({ row: i + 1, reason: `Unknown project "${projectName}".` });
            continue;
          }
          rowProject = String(found.id);
        }

        let suiteId: string | null =
          selectedSuiteId !== "unassigned" && selectedProject === rowProject ? selectedSuiteId : null;
        const suiteName = row["suite"] || row["collection"] || row["test suite"] || row["suit"];

        if (suiteName && suiteName.trim() && suiteName.trim().toLowerCase() !== "unassigned") {
          const key = suiteKey(rowProject, suiteName);
          if (suiteMap.has(key)) {
            suiteId = suiteMap.get(key) || null;
          } else {
            try {
              if (workspaceId) {
                const sResp = await api.data.testSuites.create(workspaceId, {
                  title: suiteName.trim(),
                  project_id: rowProject,
                });
                if (sResp.ok) {
                  const newS = await sResp.json();
                  const newSId = newS.id || newS._id;
                  suiteMap.set(key, newSId);
                  suiteId = newSId;
                }
              }
            } catch (err) {
              console.error("Failed to create suite:", err);
            }
          }
        }

        const stepsStr = row["test step"] || row["steps"] || row["step"] || row["test steps"] || "";
        const classicSteps = stepsStr
          .split("\n")
          .map((s) => s.trim())
          .filter((s) => s)
          .map((s) => ({ action: s, data: "", expected: "" }));

        casesToCreate.push({
          name: title,
          description: row["description"] || "",
          preconditions: row["precondition"] || row["pre-condition"] || "",
          postconditions: row["postcondition"] || row["post-condition"] || "",
          input: row["input"] || "",
          expected_result: row["expected result"] || row["expected"] || "",
          actual_result: row["actual result"] || row["actual"] || "",
          status: row["status"] || "actual",
          priority: row["priority"] || "medium",
          fixed: row["fixed"] || "no",
          assign_dev: row["assign dev"] || row["developer"] || "unassigned",
          assign_tester: row["assign tester"] || row["tester"] || "unassigned",
          step_format: "classic",
          classic_steps: classicSteps.length > 0 ? classicSteps : undefined,
          suite_id: suiteId,
          project_id: rowProject,
        });
      }

      if (casesToCreate.length === 0) {
        notify(`No test cases found. Detected headers: ${headers.join(", ")}`, "error");
        return;
      }

      setShowImportModal(true);
      setImportProgress({ current: 0, total: casesToCreate.length, status: "Starting import..." });

      let successCount = 0;
      let failedCount = 0;
      const failedNames: string[] = [];

      for (let i = 0; i < casesToCreate.length; i++) {
        const tc = casesToCreate[i];
        setImportProgress({
          current: i + 1,
          total: casesToCreate.length,
          status: `Creating: ${tc.name}`,
        });

        try {
          if (!workspaceId) continue;
          const resp = await api.data.testCases.create(workspaceId, tc);
          if (resp.ok) {
            successCount++;
          } else {
            failedCount++;
            failedNames.push(tc.name);
            console.error(`Failed "${tc.name}":`, await resp.text());
          }
        } catch (err) {
          failedCount++;
          failedNames.push(tc.name);
          console.error("Import error:", err);
        }
      }

      setImportProgress((p) => ({ ...p, status: "Refreshing data..." }));
      await reload();
      setShowImportModal(false);
      setImportSummary({ success: successCount, failed: failedCount, failedNames, skipped });
    },
    [projectId, projects, reload, selectedSuiteId, suites, workspaceId],
  );

  const closeImportSummary = useCallback(() => setImportSummary(null), []);

  return {
    showImportModal,
    importProgress,
    importSummary,
    closeImportSummary,
    exportToCSV,
    importFile,
  };
}
