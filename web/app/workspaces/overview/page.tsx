"use client";

import { Badge } from "@/components/ui/badge";
import { LayoutDashboard } from "lucide-react";
import { LanguagePicker } from "@/components/language-picker";
import { PaletteSwitch } from "@/components/palette-switch";
import { Search as HeaderSearch } from "@/components/search";
import { ThemeSwitch } from "@/components/theme-switch";
import { AccessDenied } from "@/components/shared/access-denied";
import { WorkspaceLoading } from "@/components/shared/workspace-loading";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { CommandPalette } from "@/components/workspace/command-palette";
import {
  OverviewHealthCard,
  OverviewProgressCard,
  OverviewProjectsCard,
  OverviewTeamCard,
} from "@/components/workspace/overview-progress-panels";
import { OverviewTestCasesCard, OverviewTestRunsCard } from "@/components/workspace/overview-test-panels";
import { StatsPanel } from "@/components/workspace/stats-panel";
import { ev } from "@/components/workspace/use-workspace-page";
import { useWorkspaceOverview } from "@/components/workspace/use-workspace-overview";
import { WorkspaceModals } from "@/components/workspace-modals/workspace-modals";
import { theme } from "@/lib/stores/theme";

export default function WorkspaceOverviewPage() {
  const page = useWorkspaceOverview();
  const { ws, t, uiActions, modalState } = page;
  const { taskActions, workspaceActions, sprintActions } = ws;

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

      <Main id="content" className="space-y-8 pb-24">
        {page.checkingAccess ? (
          <WorkspaceLoading />
        ) : !page.hasAccess ? (
          <AccessDenied />
        ) : (
          <>
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-semibold">
                  <LayoutDashboard className="size-6 text-muted-foreground" />
                  {t("sidebar__overview")}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">{t("overview__welcome_subtitle")}</p>
              </div>
              <Badge variant="outline" className="h-7 gap-2 px-3">
                <span className="size-2 rounded-full bg-success" />
                {t("overview__live_updates")}
              </Badge>
            </div>

            <StatsPanel stats={page.stats} isOwner={page.isOwner} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <OverviewProgressCard stats={page.stats} completionRate={page.completionRate} />
              <OverviewTeamCard workers={page.resolvedWorkerStats} onViewAll={page.goToWorkspace} />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <OverviewProjectsCard projects={page.resolvedProjectStats} total={page.stats.total} />
              <OverviewHealthCard />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <OverviewTestCasesCard
                counts={page.testCaseCounts}
                passRate={page.tcPassRate}
                loading={page.loadingTestData}
                onViewAll={page.goToTestCases}
              />
              <OverviewTestRunsCard
                runs={page.recentTestRuns}
                loading={page.loadingTestData}
                onViewAll={page.goToTestCases}
              />
            </div>

            <WorkspaceModals
              modals={modalState}
              editingTask={page.editingTask}
              assignees={page.assignees}
              isOwner={page.isOwner}
              projectList={page.projectList}
              sprints={page.sprintList}
              allTasksIncludingArchived={page.allTasks}
              qrExportTasks={[]}
              loadingData={page.loadingData}
              workerStats={page.workerStats}
              projectStats={page.projectStats}
              monthlySummary={page.monthlySummary}
              workspaceId={String(page.workspaceId || "")}
              newPageSize={20}
              onAddTask={(detail) => void taskActions.handleAddTask(ev(detail))}
              onCancelEdit={page.cancelEdit}
              onAddAssignee={(detail) => void taskActions.handleAddAssignee(ev(detail))}
              onChecklistUpdate={(detail) => void taskActions.handleChecklistUpdate(ev(detail))}
              onCloseModal={(name) => uiActions.closeModal(name)}
              onCloseWorkerManager={() => uiActions.closeModal("workerManager")}
              onAddWorker={(detail) => void workspaceActions.handleAddWorker(ev(detail))}
              onUpdateWorker={(detail) => void workspaceActions.handleUpdateWorker(ev(detail))}
              onDeleteWorker={(id) => void workspaceActions.handleDeleteWorker(ev(id))}
              onCloseSprintManager={() => uiActions.closeModal("sprintManager")}
              onCompleteSprint={(detail) => void sprintActions.handleCompleteSprint(ev(detail))}
              onDeleteSprint={(id) => void sprintActions.handleDeleteSprint(ev(id))}
              onMoveTasksToSprint={(detail) => void sprintActions.handleMoveTasksToSprint(ev(detail))}
              onCloseProjectManager={() => uiActions.closeModal("projectManager")}
              onAddProject={(detail) => void workspaceActions.handleAddProject(ev(detail))}
              onUpdateProject={(detail) => void workspaceActions.handleUpdateProject(ev(detail))}
              onDeleteProject={(id) => void workspaceActions.handleDeleteProject(ev(id))}
            />

            <CommandPalette
              open={modalState.commandPalette}
              tasks={page.allTasks}
              sprints={page.sprintList}
              projects={page.projectList}
              assignees={page.assignees}
              t={t}
              toggleTheme={() => theme.toggle()}
              switchView={(view) => {
                if (view === "overview") return;
                page.goToWorkspace();
              }}
              openTask={page.openTaskPage}
              createTask={() => {
                ws.editingTask.set(null);
                uiActions.openModal("form");
              }}
              startTimer={() => {}}
              openQuickNotes={() => {}}
              applyGlobalSearch={(query) => {
                ws.searchInput.set(query);
                uiActions.closeModal("commandPalette");
                page.goToWorkspace();
              }}
              openBookmarks={() => {}}
              openWhiteboard={() => {}}
              dailyReflect={() => uiActions.openModal("dailyReflect")}
              openPageSize={() => uiActions.openModal("pageSize")}
              onClose={() => uiActions.closeModal("commandPalette")}
            />
          </>
        )}
      </Main>
    </AuthenticatedLayout>
  );
}
