"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api/apis";
import { getAssignees, getProjectsList } from "@/lib/db";
import { connectRealtime } from "@/lib/stores/realtime";
import type { Project } from "@/lib/types";
import {
  EMPTY_FILTERS,
  mapBackendToFrontend,
  type ActiveFilters,
  type AssigneeRecord,
  type Suite,
  type TestCase,
} from "./tc-types";

const PAGE_SIZE = 10;
const AUTO_REFRESH_MS = 300000;

type Snapshot = {
  suites: Suite[];
  query: string;
  field: string;
  activeFilters: ActiveFilters;
  selectedSuiteId: string;
  selectedCaseId: string;
  projectId: string;
};
/** Last repository state per workspace, so coming back from the editor paints at once and refreshes quietly. */
const snapshots = new Map<string, Snapshot>();

type UseTcDataArgs = {
  workspaceId: string;
  roomCode: string | null;
};

export function useTcData({ workspaceId, roomCode }: UseTcDataArgs) {
  const [restored] = useState(() => snapshots.get(workspaceId));
  const [suites, setSuites] = useState<Suite[]>(restored?.suites ?? []);
  const [assignees, setAssignees] = useState<AssigneeRecord[]>([]);
  const [query, setQuery] = useState(restored?.query ?? "");
  const [field, setField] = useState(restored?.field ?? "all");
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>(restored?.activeFilters ?? { ...EMPTY_FILTERS });
  const [selectedSuiteId, setSelectedSuiteId] = useState(restored?.selectedSuiteId ?? "");
  const [selectedCaseId, setSelectedCaseId] = useState(restored?.selectedCaseId ?? "");
  const [projects, setProjects] = useState<Project[]>([]);
  /** `all`, `none` (cases without a project) or a project id. */
  const [projectId, setProjectId] = useState(restored?.projectId ?? "all");
  const [fetchCount, setFetchCount] = useState(0);
  const [loaded, setLoaded] = useState(!!restored);

  const latest = useRef({ query, field, activeFilters, suites, selectedSuiteId, selectedCaseId, projectId });
  latest.current = { query, field, activeFilters, suites, selectedSuiteId, selectedCaseId, projectId };

  const loadData = useCallback(
    async (q?: string, searchField?: string, keepState = false, filtersOverride?: ActiveFilters) => {
      if (!workspaceId) return;
      setFetchCount((n) => n + 1);
      try {
        const cur = latest.current;
        const filters = filtersOverride ?? cur.activeFilters;
        const prevPages = new Map(cur.suites.map((s) => [s.id, s.page]));
        const prevSelectedSuiteId = cur.selectedSuiteId;
        const prevSelectedCaseId = cur.selectedCaseId;

        const filterParams: Record<string, string | undefined> = {
          q: q || cur.query || undefined,
          field: searchField || cur.field || undefined,
          priority: filters.priority?.length > 0 ? filters.priority.join(",") : undefined,
          status: filters.status?.length > 0 ? filters.status.join(",") : undefined,
          fixed: filters.fixed?.length > 0 ? filters.fixed.join(",") : undefined,
          assign_dev: filters.assign_dev?.length > 0 ? filters.assign_dev.join(",") : undefined,
        };

        const project = cur.projectId;
        const suiteResp = await api.data.testSuites.list(workspaceId, project);
        if (!suiteResp.ok) return;
        const suiteData = await suiteResp.json();

        const suiteList = suiteData.map((s: any) => ({
          ...s,
          id: s.id || s._id,
          totalCount: s.case_count ?? 0,
        }));

        const casesResponses = await Promise.all(
          suiteList.map((s: any) => {
            const page = keepState ? prevPages.get(s.id) || 1 : 1;
            return api.data.testCases.list(workspaceId, {
              suite_id: s.id === "unassigned" ? "none" : s.id,
              project_id: project === "all" ? undefined : project,
              page,
              limit: PAGE_SIZE,
              ...Object.fromEntries(Object.entries(filterParams).filter(([, v]) => v !== undefined)),
            });
          }),
        );

        const newSuites: Suite[] = [];
        for (let i = 0; i < suiteList.length; i++) {
          const s = suiteList[i];
          const page = keepState ? prevPages.get(s.id) || 1 : 1;
          let cases: TestCase[] = [];
          if (casesResponses[i].ok) {
            const data = await casesResponses[i].json();
            cases = data.map(mapBackendToFrontend);
          }
          newSuites.push({ ...s, cases, page, hasMore: cases.length >= PAGE_SIZE });
        }

        setSuites(newSuites);

        if (newSuites.length > 0) {
          const suiteExists = newSuites.some((s) => s.id === prevSelectedSuiteId);
          if (!keepState || !prevSelectedSuiteId || !suiteExists) {
            setSelectedSuiteId(newSuites[0].id);
            if (newSuites[0].cases.length > 0) setSelectedCaseId(newSuites[0].cases[0].id);
          } else {
            const currentSuite = newSuites.find((s) => s.id === prevSelectedSuiteId);
            const caseExists = currentSuite?.cases.some((c) => c.id === prevSelectedCaseId);
            if (caseExists) setSelectedCaseId(prevSelectedCaseId);
            else if (currentSuite && currentSuite.cases.length > 0) {
              setSelectedCaseId(currentSuite.cases[0].id);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load test cases:", e);
      } finally {
        setFetchCount((n) => n - 1);
        setLoaded(true);
      }
    },
    [workspaceId],
  );

  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  const projectKey = `tc-project:${workspaceId}`;
  useEffect(() => {
    if (!workspaceId) return;
    const saved = localStorage.getItem(projectKey) || "all";
    // Read by loadData through the ref in the same commit, before the first fetch.
    latest.current.projectId = saved;
    setProjectId(saved);
    let cancelled = false;
    void getProjectsList().then((list) => {
      if (cancelled) return;
      setProjects(list);
      // A saved project that no longer exists falls back to every project.
      if (saved !== "all" && saved !== "none" && !list.some((p) => String(p.id) === saved)) {
        latest.current.projectId = "all";
        setProjectId("all");
        void loadDataRef.current();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectKey]);

  const changeProject = useCallback(
    (next: string) => {
      latest.current.projectId = next;
      setProjectId(next);
      localStorage.setItem(projectKey, next);
      void loadDataRef.current();
    },
    [projectKey],
  );

  useEffect(() => {
    let cancelled = false;
    void getAssignees(true).then((list) => {
      if (!cancelled) setAssignees(list as AssigneeRecord[]);
    });
    if (roomCode) {
      connectRealtime(roomCode, (payload) => {
        if (payload.entity === "test_case" || payload.action === "refresh") {
          void loadDataRef.current(undefined, undefined, true);
        }
      });
    }
    void loadDataRef.current(undefined, undefined, !!snapshots.get(workspaceId));
    const interval = setInterval(() => {
      void loadDataRef.current(undefined, undefined, true);
    }, AUTO_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [roomCode, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !loaded) return;
    snapshots.set(workspaceId, { suites, query, field, activeFilters, selectedSuiteId, selectedCaseId, projectId });
  }, [workspaceId, loaded, suites, query, field, activeFilters, selectedSuiteId, selectedCaseId, projectId]);

  const searchMounted = useRef(false);
  useEffect(() => {
    if (!searchMounted.current) {
      searchMounted.current = true;
      return;
    }
    const timeout = setTimeout(() => {
      void loadDataRef.current(query, field);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, field]);

  const loadSuitePage = useCallback(
    async (suiteId: string, page: number) => {
      if (!workspaceId) return;
      try {
        const resp = await api.data.testCases.list(workspaceId, {
          suite_id: suiteId === "unassigned" ? "none" : suiteId,
          project_id: latest.current.projectId === "all" ? undefined : latest.current.projectId,
          page,
          limit: PAGE_SIZE,
        });
        if (resp.ok) {
          const data = await resp.json();
          const mapped: TestCase[] = data.map(mapBackendToFrontend);
          setSuites((prev) =>
            prev.map((s) =>
              s.id === suiteId ? { ...s, cases: mapped, page, hasMore: mapped.length >= PAGE_SIZE } : s,
            ),
          );
        }
      } catch (e) {
        console.error("Failed to load suite page:", e);
      }
    },
    [workspaceId],
  );

  const patchTestCase = useCallback((caseId: string, patch: Partial<TestCase>) => {
    setSuites((prev) =>
      prev.map((s) => ({
        ...s,
        cases: s.cases.map((c) =>
          c.id === caseId ? { ...c, ...patch, updated_at: new Date().toISOString() } : c,
        ),
      })),
    );
  }, []);

  const toggleFilterValue = useCallback(
    (property: string, value: string) => {
      const current = latest.current.activeFilters[property] ?? [];
      const nextValues = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      const next = { ...latest.current.activeFilters, [property]: nextValues };
      setActiveFilters(next);
      void loadData(latest.current.query, latest.current.field, false, next);
    },
    [loadData],
  );

  const clearFilter = useCallback(
    (property: string) => {
      const next = { ...latest.current.activeFilters, [property]: [] };
      setActiveFilters(next);
      void loadData(latest.current.query, latest.current.field, false, next);
    },
    [loadData],
  );

  const clearAllFilters = useCallback(() => {
    const next = { ...EMPTY_FILTERS };
    setActiveFilters(next);
    void loadData(latest.current.query, latest.current.field, false, next);
  }, [loadData]);

  const selectedSuite = useMemo(
    () => suites.find((suite) => suite.id === selectedSuiteId) || suites[0],
    [suites, selectedSuiteId],
  );

  const selectedCase = useMemo<TestCase | null>(
    () =>
      suites.flatMap((suite) => suite.cases || []).find((c) => c.id === selectedCaseId) ||
      (selectedSuite?.cases ? selectedSuite.cases[0] : null) ||
      null,
    [suites, selectedCaseId, selectedSuite],
  );

  const filteredSuites = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suites
      .map((suite) => ({
        ...suite,
        cases: (suite.cases || []).filter((testCase) =>
          `${suite.title} ${testCase.id} ${testCase.title} ${testCase.description}`.toLowerCase().includes(q),
        ),
      }))
      .filter((suite) => (suite.cases?.length || 0) > 0 || suite.title.toLowerCase().includes(q));
  }, [suites, query]);

  const suiteCount = useMemo(() => suites.filter((s) => s.id !== "unassigned").length, [suites]);
  const caseCount = useMemo(
    () => suites.reduce((total, suite) => total + (suite.totalCount ?? suite.cases?.length ?? 0), 0),
    [suites],
  );

  return {
    suites,
    setSuites,
    fetching: fetchCount > 0,
    loaded,
    assignees,
    projects,
    projectId,
    changeProject,
    query,
    setQuery,
    field,
    setField,
    activeFilters,
    selectedSuiteId,
    setSelectedSuiteId,
    selectedCaseId,
    setSelectedCaseId,
    selectedSuite,
    selectedCase,
    filteredSuites,
    suiteCount,
    caseCount,
    loadData,
    loadSuitePage,
    patchTestCase,
    toggleFilterValue,
    clearFilter,
    clearAllFilters,
  };
}
