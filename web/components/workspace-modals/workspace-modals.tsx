"use client";

import type { RefObject } from "react";
import type { ModalName } from "@/lib/stores/uiActions";
import type { Assignee, AssigneeGroup, ChecklistItem, Project, Sprint, Task } from "@/lib/types";
import type { Milestone } from "@/lib/types/milestone";
import { MilestoneManager } from "./milestone-manager";
import { MonthlySummaryModal } from "./monthly-summary-modal";
import { PageSizeModal } from "./page-size-modal";
import { ProjectManager, type ProjectPayload } from "./project-manager";
import { QRExportModal } from "./qr-export-modal";
import { SprintManager } from "./sprint-manager";
import { TaskForm } from "./task-form";
import { WorkerManager } from "./worker-manager";
import { WorkspaceSettings } from "./workspace-settings";

type Id = string | number;
type ModalState = Record<string, boolean>;

type WorkspaceModalsProps = {
  modals: ModalState;
  editingTask: Task | null;
  assignees: Assignee[];
  assigneeGroups?: AssigneeGroup[];
  isOwner: boolean;
  projectList: Project[];
  sprints: Sprint[];
  allTasksIncludingArchived: Task[];
  qrExportTasks: Task[];
  monthlySummary: React.ComponentProps<typeof MonthlySummaryModal>["monthlySummary"];
  monthlySummaryRef?: RefObject<HTMLDivElement | null>;
  loadingData: boolean;
  workerStats: { id: Id; taskCount: number }[];
  projectStats: { id: Id; taskCount: number }[];
  workspaceId: string;
  newPageSize: number;
  editingMilestone?: Milestone | null;

  onAddTask?: (detail: Omit<Task, "created_at" | "id">) => void;
  onCancelEdit?: () => void;
  onAddAssignee?: (detail: { name: string; color: string }) => void;
  onChecklistUpdate?: (detail: { checklist: ChecklistItem[] }) => void;
  onCloseModal?: (modal: ModalName) => void;
  onSavePageSize?: (detail: { value: number }) => void;
  onCloseWorkerManager?: () => void;
  onAddWorker?: React.ComponentProps<typeof WorkerManager>["onAdd"];
  onUpdateWorker?: React.ComponentProps<typeof WorkerManager>["onUpdate"];
  onDeleteWorker?: (id: Id) => void;
  onGroupsChanged?: () => void;
  onCloseSprintManager?: () => void;
  onCompleteSprint?: React.ComponentProps<typeof SprintManager>["onComplete"];
  onCompleteAndExport?: React.ComponentProps<typeof SprintManager>["onCompleteAndExport"];
  onDeleteSprint?: (id: Id) => void;
  onMoveTasksToSprint?: React.ComponentProps<typeof SprintManager>["onMoveTasksToSprint"];
  onExportMarkdown?: React.ComponentProps<typeof SprintManager>["onExportMarkdown"];
  onExportVideo?: React.ComponentProps<typeof SprintManager>["onExportVideo"];
  onCloseProjectManager?: () => void;
  onAddProject?: (data: ProjectPayload) => void;
  onUpdateProject?: (data: ProjectPayload & { id: Id }) => void;
  onDeleteProject?: (id: Id) => void;
  onWorkspaceUpdated?: () => void;
  onMilestonesUpdated?: () => void;
  onExportMonthlyPDF?: () => void;
  onExportMonthlyXlsx?: () => void;
  onExportMonthlyPng?: () => void;
  onExportMonthlyVideo?: () => void;
  onExportMonthlySlide?: () => void;
};

/** Renders every workspace-level modal; the page owns state and passes handlers. */
export function WorkspaceModals(props: WorkspaceModalsProps) {
  const { modals, workspaceId } = props;

  return (
    <>
      <TaskForm
        show={!!modals.form}
        editingTask={props.editingTask}
        assignees={props.assignees}
        isOwner={props.isOwner}
        projects={props.projectList}
        sprints={props.sprints}
        onSubmit={props.onAddTask}
        onClose={props.onCancelEdit}
        onAddAssignee={props.onAddAssignee}
        onAddTask={props.onAddTask}
        onChecklistUpdate={props.onChecklistUpdate}
      />

      <PageSizeModal
        show={!!modals.pageSize}
        value={props.newPageSize}
        onClose={() => props.onCloseModal?.("pageSize")}
        onSave={props.onSavePageSize}
      />

      {modals.monthlySummary && (
        <MonthlySummaryModal
          monthlySummary={props.monthlySummary}
          monthlySummaryRef={props.monthlySummaryRef}
          onClose={() => props.onCloseModal?.("monthlySummary")}
          onExportPDF={props.onExportMonthlyPDF}
          onExportXlsx={props.onExportMonthlyXlsx}
          onExportPng={props.onExportMonthlyPng}
          onExportVideo={props.onExportMonthlyVideo}
          onExportSlide={props.onExportMonthlySlide}
        />
      )}

      {modals.workerManager && (
        <WorkerManager
          assignees={props.assignees}
          workerStats={props.workerStats}
          isLoading={props.loadingData}
          isOwner={props.isOwner}
          workspaceId={workspaceId}
          onClose={props.onCloseWorkerManager}
          onAdd={props.onAddWorker}
          onUpdate={props.onUpdateWorker}
          onDelete={props.onDeleteWorker}
          onGroupsChanged={props.onGroupsChanged}
        />
      )}

      {modals.sprintManager && (
        <SprintManager
          tasks={props.allTasksIncludingArchived}
          isOwner={props.isOwner}
          onClose={props.onCloseSprintManager}
          onComplete={props.onCompleteSprint}
          onCompleteAndExport={props.onCompleteAndExport}
          onDeleteSprint={props.onDeleteSprint}
          onMoveTasksToSprint={props.onMoveTasksToSprint}
          onExportMarkdown={props.onExportMarkdown}
          onExportVideo={props.onExportVideo}
        />
      )}

      {modals.projectManager && (
        <ProjectManager
          projects={props.projectList}
          projectStats={props.projectStats}
          isOwner={props.isOwner}
          onClose={props.onCloseProjectManager}
          onAdd={props.onAddProject}
          onUpdate={props.onUpdateProject}
          onDelete={props.onDeleteProject}
        />
      )}

      <QRExportModal
        show={!!modals.qrExport}
        selectedTasks={props.qrExportTasks}
        allProjects={props.projectList}
        allAssignees={props.assignees}
        onClose={() => props.onCloseModal?.("qrExport")}
      />

      {modals.workspaceSettings && (
        <WorkspaceSettings
          workspaceId={workspaceId}
          onClose={() => props.onCloseModal?.("workspaceSettings")}
          onWorkspaceUpdated={props.onWorkspaceUpdated}
        />
      )}

      {modals.milestoneManager && (
        <MilestoneManager
          workspaceId={workspaceId}
          isOwner={props.isOwner}
          editTask={props.editingMilestone}
          onClose={() => props.onCloseModal?.("milestoneManager")}
          onUpdated={props.onMilestonesUpdated}
        />
      )}
    </>
  );
}
