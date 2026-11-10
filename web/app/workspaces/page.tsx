"use client";

import { createPortal } from "react-dom";
import { LanguagePicker } from "@/components/language-picker";
import { PaletteSwitch } from "@/components/palette-switch";
import { Search as HeaderSearch } from "@/components/search";
import { ThemeSwitch } from "@/components/theme-switch";
import { AccessDenied } from "@/components/shared/access-denied";
import { StatusToast } from "@/components/shared/status-toast";
import { WorkspaceLoading } from "@/components/shared/workspace-loading";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { Header } from "@/components/layout/header";
import { Main } from "@/components/layout/main";
import { AiTaskChat } from "@/components/workspace/ai-task-chat";
import { CommandPalette } from "@/components/workspace/command-palette";
import { DailyReflect } from "@/components/workspace/daily-reflect";
import { ExportProgress } from "@/components/workspace/export-progress";
import { FilterPanel } from "@/components/workspace/filter-panel";
import { MilestoneCountdown } from "@/components/workspace/milestone-countdown";
import { SearchAndActions } from "@/components/workspace/search-and-actions";
import { StatsPanel } from "@/components/workspace/stats-panel";
import { ev, useWorkspacePage } from "@/components/workspace/use-workspace-page";
import { ViewSelector } from "@/components/workspace/view-selector";
import { WorkspaceViews } from "@/components/workspace/workspace-views";
import { WorkspaceModals } from "@/components/workspace-modals/workspace-modals";
import { useStore } from "@/lib/store";
import { theme } from "@/lib/stores/theme";
import { toast } from "@/lib/stores/uiActions";
import type { ViewMode } from "@/lib/types";

export default function WorkspacePage() {
  const page = useWorkspacePage();
  const { ws, t, modalState, assignees, sprintList, isOwner, isMyTasksWorkspace, allTasks, projectList } = page;
  const { uiActions, viewActions, taskActions, workspaceActions, sprintActions, exportActions } = ws;
  const toastState = useStore(toast);

  const closeModal = (name: Parameters<typeof uiActions.closeModal>[0]) => {
    uiActions.closeModal(name);
    if (name === "milestoneManager") page.setEditingMilestone(null);
  };

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

      <Main id="content" className="space-y-6 pb-24">
        {page.checkingAccess ? (
          <WorkspaceLoading />
        ) : !page.hasAccess ? (
          <AccessDenied />
        ) : (
          <>
            <ExportProgress
              inProgress={page.videoExportState.inProgress}
              percent={page.videoExportState.percent}
              elapsedMs={page.videoExportState.elapsedMs}
            />
            <StatusToast message={toastState?.message || ""} type={toastState?.type || "success"} />

            {page.milestones.length > 0 && (
              <div className="grid gap-6">
                {page.milestones.map((milestone) => (
                  <MilestoneCountdown
                    key={milestone.id}
                    milestone={milestone}
                    isOwner={isOwner}
                    onEdit={(m) => {
                      page.setEditingMilestone(m);
                      uiActions.openModal("milestoneManager");
                    }}
                    onDelete={() => uiActions.openModal("milestoneManager")}
                    onHide={() => void page.fetchMilestones()}
                  />
                ))}
              </div>
            )}

            <StatsPanel
              stats={page.stats}
              isOwner={isOwner}
              videoExportState={ws.videoExportState}
              onFilterStatus={({ status }) => ws.filters.update((f) => ({ ...f, status }))}
              onExportCSV={() => void exportActions.handleExportCSV()}
              onExportPDF={() => exportActions.handleExportPDF()}
              onExportMarkdown={(detail) => void exportActions.handleExportMarkdown(ev(detail))}
              onExportVideo={(detail) => void exportActions.handleExportVideo(ev(detail))}
              onExportVideoWithVoice={(detail) => void exportActions.handleExportVideoWithVoice(ev(detail))}
              onExportSlide={(detail) => void exportActions.handleExportSlide(ev(detail))}
              onExportDatabase={(detail) => void exportActions.handleExportDatabase(ev(detail))}
              onImportCSV={(content) => void exportActions.handleImportCSV(ev(content))}
            />

            <div className="relative z-40" ref={page.filterDropdownRef}>
              <SearchAndActions
                isFiltersOpen={modalState.filters}
                isOwner={isOwner}
                isMyTasksActive={page.isMyTasksActive}
                showTeam={!isMyTasksWorkspace}
                showProjects={!isMyTasksWorkspace}
                showSprints={!isMyTasksWorkspace}
                showWorkspaceSettings={!isMyTasksWorkspace}
                showMilestones={!isMyTasksWorkspace}
                onToggleFilters={(position) => {
                  if (position) page.setFilterPanelPos(position);
                  uiActions.toggleModal("filters");
                }}
                onCloseFilters={() => uiActions.closeModal("filters")}
                onOpenWorkerManager={() => uiActions.openModal("workerManager")}
                onOpenProjectManager={() => uiActions.openModal("projectManager")}
                onOpenSprintManager={() => uiActions.openModal("sprintManager")}
                onOpenMonthlySummary={() => uiActions.openModal("monthlySummary")}
                onOpenDailyReflect={() => uiActions.openModal("dailyReflect")}
                onOpenMilestoneManager={() => uiActions.openModal("milestoneManager")}
                onOpenWorkspaceSettings={() => uiActions.openModal("workspaceSettings")}
                onToggleMyTasks={page.toggleMyTasksFilter}
              />

              {modalState.filters &&
                createPortal(
                  <div
                    ref={page.filterPanelRef}
                    className="fixed z-[9999]"
                    style={{ top: page.filterPanelPos.top, left: page.filterPanelPos.left }}
                  >
                    <FilterPanel
                      filters={page.filters}
                      onFiltersChange={(next) => ws.filters.set(next)}
                      categories={page.categories}
                      projects={page.projects}
                      assignees={assignees}
                      sprints={sprintList}
                      tasks={allTasks}
                      myAssigneeId={page.myAssigneeId}
                      onClearFilters={page.clearFilters}
                    />
                  </div>,
                  document.body,
                )}
            </div>

            <ViewSelector
              currentView={page.currentView}
              visibleTabs={page.visibleTabs}
              isTabSettingsOpen={modalState.tabSettings}
              showAddTask={!isMyTasksWorkspace}
              hiddenTabIds={page.restrictedTabIds}
              onSwitchView={(id) => viewActions.switchView(id)}
              onToggleTabSettings={() => uiActions.toggleModal("tabSettings")}
              onCloseTabSettings={() => uiActions.closeModal("tabSettings")}
              onAddTask={page.addTaskFromViewSelector}
            />

            <WorkspaceViews
              loadingData={page.loadingData}
              filteredTasks={page.filteredTasks}
              tasks={page.tasks}
              currentView={page.currentView}
              sprints={sprintList}
              currentPage={page.currentPage}
              totalPages={page.totalPages}
              totalTasks={page.totalTasks}
              pageSize={page.pageSize}
              allTasks={allTasks}
              sprintManagerTasks={page.filteredTasks}
              assignees={assignees}
              projects={projectList}
              onTaskUpdate={(detail) => void taskActions.handleTaskUpdate(ev(detail))}
              onStatusChange={(detail) => void taskActions.handleStatusChange(ev(detail))}
              onPriorityChange={(detail) => void taskActions.handlePriorityChange(ev(detail))}
              onEdit={page.openTaskPage}
              onDuplicate={(task) => void taskActions.handleDuplicateTask(task)}
              onDelete={(id) => void taskActions.handleDeleteTask(ev(id))}
              onPageChange={(next) => viewActions.handlePageChange(next, page.totalPages)}
              onPageSizeChange={viewActions.setPageSize}
              onDeleteSelected={(ids) => void taskActions.handleDeleteSelectedTasks(ev(ids as number[]))}
              onChecklistToggle={(detail) =>
                void taskActions.handleChecklistToggle(ev(detail as { taskId: number; checklistItemId: string }))
              }
              onExportQR={(ids) => {
                const wanted = ids.map(String);
                page.setQrExportTasks(page.tasks.filter((task) => wanted.includes(String(task.id))));
                uiActions.openModal("qrExport");
              }}
              onSelectAssignee={({ assigneeId }) => {
                ws.filters.update((f) => ({ ...f, assignee_id: assigneeId }));
                viewActions.switchView("list");
                void ws.loadData();
              }}
            />

            <WorkspaceModals
              modals={modalState}
              editingTask={page.editingTask}
              assignees={assignees}
              isOwner={isOwner}
              projectList={projectList}
              sprints={sprintList}
              allTasksIncludingArchived={allTasks}
              qrExportTasks={page.qrExportTasks}
              loadingData={page.loadingData}
              workerStats={page.workerStats}
              projectStats={page.projectStats}
              monthlySummary={page.monthlySummary}
              workspaceId={String(page.workspaceId || "")}
              newPageSize={page.newPageSize}
              editingMilestone={page.editingMilestone}
              assigneeGroups={page.assigneeGroups}
              onAddTask={(detail) => void taskActions.handleAddTask(ev(detail))}
              onCancelEdit={page.cancelEdit}
              onAddAssignee={(detail) => void taskActions.handleAddAssignee(ev(detail))}
              onChecklistUpdate={(detail) => void taskActions.handleChecklistUpdate(ev(detail))}
              onCloseModal={closeModal}
              onSavePageSize={({ value }) => {
                page.setNewPageSize(value);
                viewActions.setPageSize(value);
                uiActions.closeModal("pageSize");
              }}
              onCloseWorkerManager={() => uiActions.closeModal("workerManager")}
              onAddWorker={(detail) => void workspaceActions.handleAddWorker(ev(detail))}
              onUpdateWorker={(detail) => void workspaceActions.handleUpdateWorker(ev(detail))}
              onDeleteWorker={(id) => void workspaceActions.handleDeleteWorker(ev(id))}
              onGroupsChanged={() => void page.loadAssigneeGroups()}
              onCloseSprintManager={() => uiActions.closeModal("sprintManager")}
              onCompleteSprint={(detail) => void sprintActions.handleCompleteSprint(ev(detail))}
              onCompleteAndExport={(detail) => void exportActions.handleCompleteAndExport(ev(detail))}
              onDeleteSprint={(id) => void sprintActions.handleDeleteSprint(ev(id))}
              onMoveTasksToSprint={(detail) => void sprintActions.handleMoveTasksToSprint(ev(detail))}
              onExportMarkdown={(detail) => void exportActions.handleExportMarkdown(ev(detail as number))}
              onExportVideo={(detail) => void exportActions.handleExportVideo(ev(detail as number))}
              onCloseProjectManager={() => uiActions.closeModal("projectManager")}
              onAddProject={(detail) => void workspaceActions.handleAddProject(ev(detail))}
              onUpdateProject={(detail) => void workspaceActions.handleUpdateProject(ev(detail))}
              onDeleteProject={(id) => void workspaceActions.handleDeleteProject(ev(id))}
              onExportMonthlyPDF={() => void exportActions.handleExportMonthlyPDF()}
              onMilestonesUpdated={() => void page.fetchMilestones()}
            />

            <DailyReflect
              show={modalState.dailyReflect}
              onShowChange={(show) => uiActions.setModalState("dailyReflect", show)}
              isOwner={isOwner}
            />

            {!isMyTasksWorkspace && (
              <AiTaskChat
                workspaceId={page.workspaceId}
                myAssigneeId={page.myAssigneeId}
                onOpenTask={page.openTaskPage}
                onTaskCreated={() => ws.loadData()}
              />
            )}

            <CommandPalette
              open={modalState.commandPalette}
              tasks={allTasks}
              sprints={sprintList}
              projects={projectList}
              assignees={assignees}
              t={t}
              toggleTheme={() => theme.toggle()}
              switchView={(view) => viewActions.switchView(view as ViewMode)}
              openTask={page.openTaskPage}
              createTask={() => {
                if (isMyTasksWorkspace) return;
                ws.editingTask.set(null);
                uiActions.openModal("form");
                page.updateUrlTask(null);
              }}
              startTimer={() => {}}
              openQuickNotes={() => {}}
              applyGlobalSearch={(query) => {
                ws.searchInput.set(query);
                uiActions.closeModal("commandPalette");
              }}
              openBookmarks={() => {}}
              openWhiteboard={() => {}}
              dailyReflect={() => uiActions.openModal("dailyReflect")}
              openPageSize={() => uiActions.openModal("pageSize")}
              onClose={() => uiActions.closeModal("commandPalette")}
              onClearFilters={page.clearFilters}
            />
          </>
        )}
      </Main>
    </AuthenticatedLayout>
  );
}
