"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/apis";
import {
  buildCsv,
  downloadCsv,
  mapCase,
  PAGE_SIZE,
  type LatestTestRun,
  type PublicSuite,
  type PublicTestCase,
} from "./public-model";

export function usePublicTestCases(workspaceId: string | undefined) {
  const [suites, setSuites] = useState<PublicSuite[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [query, setQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [latestRun, setLatestRun] = useState<LatestTestRun | null>(null);
  const [runCaseMap, setRunCaseMap] = useState<Map<string, string>>(new Map());

  const requestId = useRef(0);
  const previousQuery = useRef(query);

  const loadData = useCallback(async () => {
    if (!workspaceId) return;
    const current = ++requestId.current;
    setLoading(true);
    try {
      const [suiteResp, runResp] = await Promise.all([
        api.public.listSuites(workspaceId),
        api.public.getLatestTestRun(workspaceId),
      ]);

      if (!suiteResp.ok) return;
      const suiteData = await suiteResp.json();

      if (runResp.ok) {
        const runData: LatestTestRun = await runResp.json();
        if (current !== requestId.current) return;
        setLatestRun(runData);
        setRunCaseMap(new Map(runData.test_cases.map((tc) => [tc.test_case_id, tc.status])));
      }

      const suiteList: PublicSuite[] = suiteData.map((s: any) => ({
        id: s.id || s._id,
        title: s.title,
        case_count: s.case_count ?? 0,
        collapsed: false,
        page: 1,
        hasMore: false,
        cases: [] as PublicTestCase[],
      }));

      const params: Record<string, any> = { limit: PAGE_SIZE };
      if (query) params.q = query;
      if (filterPriority) params.priority = filterPriority;
      if (filterStatus) params.status = filterStatus;

      const responses = await Promise.all(
        suiteList.map((s) =>
          api.public.listTestCases(workspaceId, {
            suite_id: s.id === "unassigned" ? "none" : s.id,
            ...params,
          }),
        ),
      );
      for (let i = 0; i < suiteList.length; i++) {
        if (responses[i].ok) {
          const data = await responses[i].json();
          suiteList[i].cases = data.map(mapCase);
          suiteList[i].hasMore = data.length >= PAGE_SIZE;
        }
      }

      if (current !== requestId.current) return;
      setSuites(suiteList);
    } catch (e) {
      console.error("Failed to load public data:", e);
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [workspaceId, query, filterPriority, filterStatus]);

  useEffect(() => {
    const delay = previousQuery.current !== query ? 300 : 0;
    previousQuery.current = query;
    const timer = setTimeout(() => void loadData(), delay);
    return () => clearTimeout(timer);
  }, [loadData, query]);

  const exportToCSV = useCallback(async () => {
    if (!workspaceId || exporting) return;
    setExporting(true);
    try {
      const casesResp = await api.public.getAllTestCases(workspaceId);
      if (!casesResp.ok) return;
      const allCases: PublicTestCase[] = (await casesResp.json()).map(mapCase);

      const suiteTitles = new Map<string, string>(suites.map((s) => [s.id, s.title]));
      suiteTitles.set("unassigned", "Unassigned");

      downloadCsv(buildCsv(allCases, suiteTitles, runCaseMap), `test_cases_${workspaceId}.csv`);
    } catch (e) {
      console.error("Failed to export:", e);
    } finally {
      setExporting(false);
    }
  }, [workspaceId, exporting, suites, runCaseMap]);

  const toggleSuite = useCallback((id: string) => {
    setSuites((prev) => prev.map((s) => (s.id === id ? { ...s, collapsed: !s.collapsed } : s)));
  }, []);

  return {
    suites,
    loading,
    exporting,
    query,
    setQuery,
    filterPriority,
    setFilterPriority,
    filterStatus,
    setFilterStatus,
    latestRun,
    runCaseMap,
    exportToCSV,
    toggleSuite,
  };
}
