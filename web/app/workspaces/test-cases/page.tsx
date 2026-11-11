"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FirstVisitTutorial } from "@/components/help/first-visit-tutorial";
import { QA_VIDEO } from "@/components/help/help-videos";
import { LanguagePicker } from "@/components/language-picker";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { PaletteSwitch } from "@/components/palette-switch";
import { Search as HeaderSearch } from "@/components/search";
import { ThemeSwitch } from "@/components/theme-switch";
import { TcDetailPanel } from "@/components/test-cases/tc-detail-panel";
import { TcDialogs } from "@/components/test-cases/tc-dialogs";
import { TcLightboxView } from "@/components/test-cases/tc-lightbox-view";
import { TcNewRunDialog } from "@/components/test-cases/tc-new-run-dialog";
import { TcMoveDialog } from "@/components/test-cases/tc-move-dialog";
import { TcProjectPicker } from "@/components/test-cases/tc-project-picker";
import { TcRunView } from "@/components/test-cases/tc-run-view";
import { TcSidebar } from "@/components/test-cases/tc-sidebar";
import { TcSuiteSection, type TcCaseHandlers, type TcView } from "@/components/test-cases/tc-suite-section";
import { TcToolbar } from "@/components/test-cases/tc-toolbar";
import { buildAssigneeOptions } from "@/components/test-cases/tc-assignees";
import { filterOptionsFor } from "@/components/test-cases/tc-options";
import { useTcCaseActions } from "@/components/test-cases/use-tc-case-actions";
import { useTcData } from "@/components/test-cases/use-tc-data";
import { useTcDetail } from "@/components/test-cases/use-tc-detail";
import { useTcImportExport } from "@/components/test-cases/use-tc-import-export";
import { useTcLightbox } from "@/components/test-cases/use-tc-lightbox";
import { useTcResize } from "@/components/test-cases/use-tc-resize";
import { useTcRuns } from "@/components/test-cases/use-tc-runs";
import { useTcSuites } from "@/components/test-cases/use-tc-suites";
import { downloadTemplate } from "@/components/test-cases/tc-csv";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { taskPath } from "@/lib/routes";
import { useRouteIds } from "@/lib/use-route-ids";
import { useWorkspaceRoom } from "@/lib/use-workspace-room";
import { currentWorkspaceName } from "@/lib/stores/workspace";

export default function TestCasesPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { workspaceId: routeWorkspaceId } = useRouteIds();
  const workspaceId = routeWorkspaceId ?? "";
  const workspaceName = useStore(currentWorkspaceName);

  const roomCode = useWorkspaceRoom(workspaceId) ?? null;

  const isAuthorized = user?.role === "admin" || user?.profile?.position === "QA Tester";

  const data = useTcData({ workspaceId, roomCode });
  const suites = useTcSuites({
    workspaceId,
    setSuites: data.setSuites,
    projectId: data.projectId,
    reload: () => data.loadData(undefined, undefined, true),
  });
  const resize = useTcResize();
  const lightbox = useTcLightbox();
  const [showDetail, setShowDetail] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [view, setView] = useState<TcView>("table");
  useEffect(() => {
    const saved = localStorage.getItem("test-cases-view");
    if (saved === "table" || saved === "list") setView(saved);
  }, []);
  function changeView(next: TcView) {
    setView(next);
    localStorage.setItem("test-cases-view", next);
  }
  const [isSuitesOpen, setIsSuitesOpen] = useState(true);
  const [isRunsOpen, setIsRunsOpen] = useState(true);

  const openTaskDetail = useCallback(
    (taskId: string) => router.push(taskPath(workspaceId, taskId)),
    [router, workspaceId],
  );

  const actions = useTcCaseActions({
    workspaceId,
    assignees: data.assignees,
    projectId: data.projectId,
    setSuites: data.setSuites,
    patchTestCase: data.patchTestCase,
    selectedCaseId: data.selectedCaseId,
    setSelectedCaseId: data.setSelectedCaseId,
    setSelectedSuiteId: data.setSelectedSuiteId,
    setShowDetail,
    openTaskDetail,
  });

  const runs = useTcRuns({
    workspaceId,
    user,
    assignees: data.assignees,
    suites: data.suites,
    setSuites: data.setSuites,
    collapseSuites: () => setIsSuitesOpen(false),
  });

  const detail = useTcDetail({ selectedCase: data.selectedCase, isAuthorized, setSuites: data.setSuites });
  const imports = useTcImportExport({
    workspaceId,
    projects: data.projects,
    projectId: data.projectId,
    suites: data.suites,
    selectedSuiteId: data.selectedSuiteId,
    reload: () => data.loadData(undefined, undefined, true),
  });

  useEffect(() => {
    void data.loadData();
    void runs.loadTestRuns();
    // Initial load only; refreshes come from realtime events and the interval in useTcData.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  useEffect(() => {
    document.title = `${t("tc__test_case")} — Khun Phaen`;
  }, [t]);

  const { assigneeOptions, availableAssigneeOptions, testRunAssigneeOptions } = useMemo(
    () => buildAssigneeOptions(data.assignees, user?.id, isAuthorized),
    [data.assignees, user?.id, isAuthorized],
  );

  const editorUrl = (suiteId: string, caseId = "") => {
    const qs = new URLSearchParams(searchParams.toString());
    qs.set("suite", suiteId);
    if (data.projectId !== "all" && data.projectId !== "none") qs.set("project", data.projectId);
    else qs.delete("project");
    if (caseId) qs.set("case", caseId);
    else qs.delete("case");
    return `/workspaces/test-cases/editor/?${qs.toString()}`;
  };

  const filterLabel = (property: string, value: string) =>
    filterOptionsFor(property, assigneeOptions).find((o) => o.value === value)?.label ?? value;

  const handlers: TcCaseHandlers = {
    onOpenDetail: (suite, testCase) => {
      data.setSelectedSuiteId(suite.id);
      data.setSelectedCaseId(testCase.id);
      setShowDetail(true);
    },
    onOpenEditor: (suiteId, caseId) => router.push(editorUrl(suiteId, caseId)),
    onDeleteCase: actions.requestDeleteCase,
    onUpdateStatus: actions.updateStatus,
    onUpdateFixed: actions.updateFixed,
    onUpdatePriority: actions.updatePriority,
    onUpdateAssignDev: actions.updateAssignDev,
    onQuickCreate: actions.quickCreate,
  };

  // Runs after render so the list is mounted even when a run view was open.
  const [scrollToSuiteId, setScrollToSuiteId] = useState<string | null>(null);
  useEffect(() => {
    if (!scrollToSuiteId) return;
    document.getElementById(`suite-${scrollToSuiteId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setScrollToSuiteId(null);
  }, [scrollToSuiteId, data.filteredSuites]);

  // Project switch: the current list pushes out to the left, then the new one pushes in from the right.
  const [slide, setSlide] = useState<"idle" | "out" | "waiting" | "in">("idle");
  const slideTimer = useRef<number>(0);
  const switchProject = (next: string) => {
    if (next === data.projectId) return;
    window.clearTimeout(slideTimer.current);
    setSlide("out");
    slideTimer.current = window.setTimeout(() => {
      data.changeProject(next);
      setSlide("waiting");
    }, 160);
  };
  useEffect(() => {
    if (slide !== "waiting" || data.fetching) return;
    setSlide("in");
    slideTimer.current = window.setTimeout(() => setSlide("idle"), 320);
  }, [slide, data.fetching]);
  useEffect(() => () => window.clearTimeout(slideTimer.current), []);

  const projectName =
    data.projectId === "none"
      ? t("tcProject__none")
      : data.projects.find((p) => String(p.id) === data.projectId)?.name || "";
  const selectedCase = data.selectedCase;
  const selectedSuite = data.selectedSuite;
  const inRunView = runs.viewMode === "test-run";

  return (
    <AuthenticatedLayout>
      <Header>
        <HeaderSearch />
        <div className="ms-auto flex items-center gap-2">
          <LanguagePicker />
          <PaletteSwitch />
          <ThemeSwitch />
        </div>
      </Header>

      <FirstVisitTutorial video={QA_VIDEO} />
      <Main id="content" fixed fluid className="p-0">
        <div className="flex min-h-0 flex-1">
          <TcSidebar
            width={resize.leftSidebarWidth}
            onStartResize={resize.startSidebarResize}
            isAuthorized={isAuthorized}
            projects={data.projects}
            projectId={data.projectId}
            onProjectChange={switchProject}
            suites={data.suites}
            selectedSuiteId={data.selectedSuiteId}
            isSuitesOpen={isSuitesOpen}
            onToggleSuites={() => setIsSuitesOpen((v) => !v)}
            onSelectSuite={(suite) => {
              data.setSelectedSuiteId(suite.id);
              runs.closeTestRun();
              setScrollToSuiteId(suite.id);
            }}
            onAddSuite={() => suites.setShowCreateSuite(true)}
            onDeleteSuite={(suite) => suites.requestDeleteSuite(suite)}
            runs={runs.testRuns}
            runsTotal={runs.testRunsTotal}
            selectedRunId={runs.selectedRunDetail?.id}
            isRunsOpen={isRunsOpen}
            isLoadingMoreRuns={runs.isLoadingMoreRuns}
            onToggleRuns={() => setIsRunsOpen((v) => !v)}
            onOpenRun={(run) => void runs.openTestRun(run)}
            onNewRun={runs.openNewTestRunModal}
            onDeleteRun={(run) => runs.requestDeleteRun(run)}
            onLoadMoreRuns={() => void runs.loadMoreTestRuns()}
          />

          <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {data.needsProjectChoice ? (
              <TcProjectPicker projects={data.projects} onSelect={data.changeProject} />
            ) : inRunView ? (
              <TcRunView
                detail={runs.selectedRunDetail}
                loading={runs.isLoadingRunDetail}
                isAuthorized={isAuthorized}
                updatingCaseId={runs.updatingCaseId}
                onBack={runs.closeTestRun}
                onUpdateRunStatus={(status) => void runs.updateRunStatus(status)}
                onDeleteRun={() =>
                  runs.selectedRunDetail && runs.requestDeleteRun({ _id: runs.selectedRunDetail.id } as never)
                }
                onUpdateCaseStatus={(caseId, status, note) => void runs.updateRunCaseStatus(caseId, status, note)}
                onViewCase={(entry) => {
                  const caseId = entry.test_case?.id;
                  if (!caseId) return;
                  data.setSelectedSuiteId(entry.test_case?.suite_id || data.selectedSuiteId);
                  data.setSelectedCaseId(caseId);
                  setShowDetail(true);
                }}
              />
            ) : (
              <>
                <TcToolbar
                  view={view}
                  onViewChange={changeView}
                  workspaceId={workspaceId}
                  projectId={data.projectId}
                  workspaceLabel={[workspaceName || t("tcEditor__workspace_fallback"), projectName]
                    .filter(Boolean)
                    .join(" / ")}
                  caseCount={data.caseCount}
                  suiteCount={data.suiteCount}
                  query={data.query}
                  onQueryChange={data.setQuery}
                  field={data.field}
                  onFieldChange={data.setField}
                  activeFilters={data.activeFilters}
                  onToggleFilter={data.toggleFilterValue}
                  onClearFilter={data.clearFilter}
                  onClearAllFilters={data.clearAllFilters}
                  filterLabel={filterLabel}
                  assigneeOptions={assigneeOptions}
                  isAuthorized={isAuthorized}
                  onDownloadTemplate={downloadTemplate}
                  onImportFile={(file) => void imports.importFile(file)}
                  onExport={() => void imports.exportToCSV()}
                  renumberTarget={data.projectId === "all" ? (data.projects.length ? null : "none") : data.projectId}
                  renumberLabel={projectName || t("tcProject__none")}
                  onRenumber={imports.renumber}
                  onMoveCases={() => setShowMove(true)}
                />
                <div
                  className="relative h-0.5 shrink-0 overflow-hidden bg-transparent"
                  role="progressbar"
                  aria-hidden={!data.fetching}
                  aria-label={t("tcLoading__label")}
                >
                  <div
                    className={cn(
                      "absolute inset-y-0 w-1/3 rounded-full bg-primary opacity-0 transition-opacity duration-200",
                      data.fetching && "animate-tc-load opacity-100",
                    )}
                  />
                </div>
                <div
                  className={cn(
                    "min-h-0 flex-1 space-y-4 overflow-y-auto p-4 transition-opacity duration-200",
                    data.fetching && data.loaded && slide === "idle" && "opacity-70",
                    (slide === "out" || slide === "waiting") &&
                      "pointer-events-none -translate-x-8 opacity-0 transition-[opacity,translate] duration-150 ease-in",
                    slide === "in" && "duration-300 animate-in fade-in slide-in-from-right-8",
                  )}
                >
                  {!data.loaded && data.filteredSuites.length === 0 && (
                    <div className="space-y-3" aria-busy="true">
                      {[0, 1, 2].map((row) => (
                        <Skeleton key={row} className="h-12 w-full" style={{ animationDelay: `${row * 120}ms` }} />
                      ))}
                    </div>
                  )}
                  {data.filteredSuites.map((suite) => (
                    <TcSuiteSection
                      key={suite.id}
                      suite={suite}
                      view={view}
                      selected={suite.id === data.selectedSuiteId}
                      selectedCaseId={showDetail ? data.selectedCaseId : ""}
                      isAuthorized={isAuthorized}
                      updatingPriorityIds={actions.updatingPriorityIds}
                      assigneeOptions={availableAssigneeOptions}
                      handlers={handlers}
                      onEditSuite={(s) => suites.setEditingSuite({ ...s })}
                      onDeleteSuite={(s) => suites.requestDeleteSuite(s)}
                      onLoadPage={(suiteId, page) => void data.loadSuitePage(suiteId, page)}
                    />
                  ))}
                </div>
              </>
            )}
          </section>

          {showDetail && selectedCase && (
            <TcDetailPanel
              testCase={selectedCase}
              suite={selectedSuite}
              detail={detail}
              isAuthorized={isAuthorized}
              width={resize.detailPanelWidth}
              assigneeOptions={assigneeOptions}
              availableAssigneeOptions={availableAssigneeOptions}
              onStartResize={resize.startPanelResize}
              onClose={() => setShowDetail(false)}
              onConvertToTask={() => void actions.convertToTask(selectedCase.id)}
              onEdit={() => router.push(editorUrl(selectedSuite?.id || data.selectedSuiteId, selectedCase.id))}
              onDelete={() => actions.requestDeleteCase(selectedCase.id)}
              onUpdatePriority={(v) => actions.updatePriority(selectedCase, v)}
              onUpdateStatus={(v) => actions.updateStatus(selectedCase, v)}
              onUpdateFixed={(v) => actions.updateFixed(selectedCase, v)}
              onUpdateAssignDev={(v) => actions.updateAssignDev(selectedCase, v)}
              onUpdateAssignTester={(v) => actions.updateAssignTester(selectedCase, v)}
              onOpenAttachment={lightbox.openLightbox}
            />
          )}
        </div>
      </Main>

      <TcNewRunDialog
        runs={runs}
        suites={data.suites}
        assigneeOptions={testRunAssigneeOptions}
        onSubmit={() => void runs.createTestRun()}
      />
      <TcMoveDialog
        open={showMove}
        onOpenChange={setShowMove}
        workspaceId={workspaceId}
        projects={data.projects}
        suites={data.suites}
        currentProject={data.projectId}
        onMoved={() => data.loadData(undefined, undefined, true)}
      />
      <TcDialogs
        suites={suites}
        projects={data.projects}
        actions={actions}
        runs={runs}
        importProgress={imports.showImportModal ? imports.importProgress : null}
        importSummary={imports.importSummary}
        onCloseImportSummary={imports.closeImportSummary}
      />
      <TcLightboxView lightbox={lightbox} />
    </AuthenticatedLayout>
  );
}
