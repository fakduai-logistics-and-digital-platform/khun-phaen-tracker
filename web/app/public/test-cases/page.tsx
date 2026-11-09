"use client";

import { useEffect, useMemo, useState } from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FileDown, List, LoaderCircle, Search, Table2 } from "lucide-react";
import { AppLogo } from "@/components/brand/app-logo";
import { ThemeSwitch } from "@/components/theme-switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PropertySelect } from "@/components/task-detail/property-select";
import { PublicRunBanner } from "@/components/test-cases/public-run-banner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PublicSuiteTable, type PublicView } from "@/components/test-cases/public-suite-table";
import { usePublicTestCases } from "@/components/test-cases/use-public-test-cases";
import { TcProjectSelect } from "@/components/test-cases/tc-project-select";
import { api } from "@/lib/api/apis";
import { useI18n } from "@/lib/i18n";
import type { Project } from "@/lib/types";

const VIEW_STORAGE_KEY = "public-test-cases-view";

function PublicTestCases() {
  const { t } = useI18n();
  const [view, setView] = useState<PublicView>("table");

  useEffect(() => {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === "table" || saved === "list") setView(saved);
  }, []);

  function changeView(next: string) {
    const value = next === "list" ? "list" : "table";
    setView(value);
    localStorage.setItem(VIEW_STORAGE_KEY, value);
  }
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("ws") ?? undefined;
  const [projectId, setProjectId] = useState(searchParams.get("project") || "all");
  const [projects, setProjects] = useState<Project[]>([]);
  const data = usePublicTestCases(workspaceId, projectId);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    void api.public
      .listProjects(workspaceId)
      .then((resp) => (resp.ok ? resp.json() : []))
      .then((list: Project[]) => {
        if (!cancelled) setProjects(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  function changeProject(next: string) {
    setProjectId(next);
    // Keep the address shareable without going through the router (it would re-add the base path).
    const url = new URL(window.location.href);
    if (next === "all") url.searchParams.delete("project");
    else url.searchParams.set("project", next);
    window.history.replaceState(null, "", url);
  }
  const { suites, latestRun } = data;

  useEffect(() => {
    document.title = t("tcpub__page_title");
  }, [t]);

  const totalCases = useMemo(() => suites.reduce((total, s) => total + (s.case_count || 0), 0), [suites]);
  const totalSuites = useMemo(() => suites.filter((s) => s.id !== "unassigned").length, [suites]);

  const priorityOptions = [
    { value: "", label: t("tcpub__all_priority") },
    { value: "high", label: t("tcopt__priority_high") },
    { value: "medium", label: t("tcopt__priority_medium") },
    { value: "low", label: t("tcopt__priority_low") },
  ];
  const statusOptions = [
    { value: "", label: t("tcpub__all_status") },
    ...["actual", "passed", "failed", "blocked", "draft", "deprecated"].map((value) => ({
      value,
      label: t(`tcopt__status_${value}`),
    })),
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <AppLogo alt="logo" className="size-8" />
            <div>
              <h1 className="text-lg font-semibold">{t("tcpub__heading")}</h1>
              <p className="text-sm text-muted-foreground">
                {t("tcopt__counts", { cases: totalCases, suites: totalSuites })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => void data.exportToCSV()} disabled={data.exporting}>
              {data.exporting ? <LoaderCircle className="animate-spin" /> : <FileDown />}
              {data.exporting ? t("tcpub__exporting") : t("tcpub__export")}
            </Button>
            <ThemeSwitch />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {latestRun && <PublicRunBanner run={latestRun} />}

        <div className="mb-8 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={data.query}
              onChange={(e) => data.setQuery(e.target.value)}
              placeholder={t("tcpub__search_ph")}
              aria-label={t("tcpub__search_ph")}
              className="pl-9"
            />
          </div>
          {projects.length > 0 && (
            <TcProjectSelect
              value={projectId}
              projects={projects}
              onChange={changeProject}
              includeAll
              className="h-9 w-48"
            />
          )}
          <PropertySelect
            id="public-filter-priority"
            value={data.filterPriority}
            options={priorityOptions}
            className="h-9 w-44"
            onSelect={(v) => data.setFilterPriority(String(v))}
          />
          <PropertySelect
            id="public-filter-status"
            value={data.filterStatus}
            options={statusOptions}
            className="h-9 w-44"
            onSelect={(v) => data.setFilterStatus(String(v))}
          />
          <Tabs value={view} onValueChange={changeView} aria-label={t("tcpub__view_aria")}>
            <TabsList>
              <TabsTrigger value="table">
                <Table2 />
                {t("tcpub__view_table")}
              </TabsTrigger>
              <TabsTrigger value="list">
                <List />
                {t("tcpub__view_list")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {data.loading ? (
          <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
            <LoaderCircle className="size-6 animate-spin" />
            <p className="text-sm">{t("tcpub__loading")}</p>
          </div>
        ) : suites.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-lg font-medium">{t("tcpub__empty_title")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("tcpub__empty_desc")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {suites.map((suite) => (
              <PublicSuiteTable
                key={suite.id}
                suite={suite}
                view={view}
                hasRun={!!latestRun}
                runCaseMap={data.runCaseMap}
                onToggle={data.toggleSuite}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="mt-16 border-t">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
          <span>{t("tcpub__footer_readonly")}</span>
          <span>{t("tcpub__footer_powered")}</span>
        </div>
      </footer>
    </div>
  );
}

export default function PublicTestCasesPage() {
  return (
    <Suspense>
      <PublicTestCases />
    </Suspense>
  );
}
