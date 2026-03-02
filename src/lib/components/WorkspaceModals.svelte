<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import TaskForm from "./TaskForm.svelte";
  import PageSizeModal from "./PageSizeModal.svelte";
  import WorkerManager from "./WorkerManager.svelte";
  import SprintManager from "./SprintManager.svelte";
  import ProjectManager from "./ProjectManager.svelte";
  import QRExportModal from "./QRExportModal.svelte";
  import MonthlySummaryModal from "./MonthlySummaryModal.svelte";
  import WorkspaceSettings from "./WorkspaceSettings.svelte";
  import type { Task, Project, Assignee, ChecklistItem } from "$lib/types";
  import type { Sprint } from "$lib/stores/sprintStore";

  export let modals: any;
  export let editingTask: Task | null;
  export let assignees: Assignee[];
  export let isOwner: boolean;
  export let projectList: Project[];
  export let sprints: Sprint[];
  export let allTasksIncludingArchived: Task[];
  export let qrExportTasks: Task[];
  export let monthlySummary: any;
  export let monthlySummaryRef: HTMLDivElement | null = null;
  export let loadingData: boolean;
  export let workerStats: any[];
  export let projectStats: any[];
  export let workspaceId: string;
  export let newPageSize: number;

  const dispatch = createEventDispatcher();

  // Task actions
  function handleAddTask(event: CustomEvent<any>) {
    dispatch("addTask", event.detail);
  }
  function cancelEdit() {
    dispatch("cancelEdit");
  }
  function handleAddAssignee(event: CustomEvent<any>) {
    dispatch("addAssignee", event.detail);
  }
  function handleChecklistUpdate(event: CustomEvent<any>) {
    dispatch("checklistUpdate", event.detail);
  }

  // Page size actions
  function closePageSizeModal() {
    dispatch("closePageSize", { detail: { modal: "pageSize" } });
  } // Simplified event
  function savePageSize(event: CustomEvent<any>) {
    dispatch("savePageSize", event.detail);
  }

  // Worker actions
  function closeWorkerManager() {
    dispatch("closeWorkerManager");
  }
  function handleAddWorker(event: CustomEvent<any>) {
    dispatch("addWorker", event.detail);
  }
  function handleUpdateWorker(event: CustomEvent<any>) {
    dispatch("updateWorker", event.detail);
  }
  function handleDeleteWorker(event: CustomEvent<any>) {
    dispatch("deleteWorker", event.detail);
  }

  // Sprint actions
  function closeSprintManager() {
    dispatch("closeSprintManager");
  }
  function handleCompleteSprint(event: CustomEvent<any>) {
    dispatch("completeSprint", event.detail);
  }
  function handleCompleteAndExport(event: CustomEvent<any>) {
    dispatch("completeAndExport", event.detail);
  }
  function handleDeleteSprint(event: CustomEvent<any>) {
    dispatch("deleteSprint", event.detail);
  }
  function handleMoveTasksToSprint(event: CustomEvent<any>) {
    dispatch("moveTasksToSprint", event.detail);
  }
  function handleExportMarkdown(event: CustomEvent<any>) {
    dispatch("exportMarkdown", event.detail);
  }
  function handleExportVideo(event: CustomEvent<any>) {
    dispatch("exportVideo", event.detail);
  }

  // Project actions
  function closeProjectManager() {
    dispatch("closeProjectManager");
  }
  function handleAddProject(event: CustomEvent<any>) {
    dispatch("addProject", event.detail);
  }
  function handleUpdateProject(event: CustomEvent<any>) {
    dispatch("updateProject", event.detail);
  }
  function handleDeleteProject(event: CustomEvent<any>) {
    dispatch("deleteProject", event.detail);
  }
</script>

<!-- Task Form -->
<TaskForm
  show={modals.form}
  {editingTask}
  {assignees}
  {isOwner}
  projects={projectList}
  {sprints}
  on:submit={handleAddTask}
  on:close={cancelEdit}
  on:addAssignee={handleAddAssignee}
  on:checklistUpdate={handleChecklistUpdate}
/>

<PageSizeModal
  show={modals.pageSize}
  value={newPageSize}
  on:close={() => dispatch("closeModal", "pageSize")}
  on:save={savePageSize}
/>

<!-- Monthly Summary Modal -->
{#if modals.monthlySummary}
  <MonthlySummaryModal
    {monthlySummary}
    {monthlySummaryRef}
    on:close={() => dispatch("closeModal", "monthlySummary")}
    on:exportPDF={() => dispatch("exportMonthlyPDF")}
    on:exportXlsx={() => dispatch("exportMonthlyXlsx")}
    on:exportPng={() => dispatch("exportMonthlyPng")}
    on:exportVideo={() => dispatch("exportMonthlyVideo")}
    on:exportSlide={() => dispatch("exportMonthlySlide")}
  />
{/if}

<!-- Worker Manager Modal -->
{#if modals.workerManager}
  <WorkerManager
    {assignees}
    {workerStats}
    isLoading={loadingData}
    {isOwner}
    {workspaceId}
    on:close={closeWorkerManager}
    on:add={handleAddWorker}
    on:update={handleUpdateWorker}
    on:delete={handleDeleteWorker}
  />
{/if}

<!-- Sprint Manager Modal -->
{#if modals.sprintManager}
  <SprintManager
    tasks={allTasksIncludingArchived.filter((t) => !t.is_archived)}
    on:close={closeSprintManager}
    on:complete={handleCompleteSprint}
    on:completeAndExport={handleCompleteAndExport}
    on:deleteSprint={handleDeleteSprint}
    on:moveTasksToSprint={handleMoveTasksToSprint}
    on:exportMarkdown={(e) => handleExportMarkdown(e)}
    on:exportVideo={(e) => handleExportVideo(e)}
  />
{/if}

<!-- Project Manager Modal -->
{#if modals.projectManager}
  <ProjectManager
    projects={projectList}
    {projectStats}
    on:close={closeProjectManager}
    on:add={handleAddProject}
    on:update={handleUpdateProject}
    on:delete={handleDeleteProject}
  />
{/if}

<!-- QR Export Modal -->
<QRExportModal
  show={modals.qrExport}
  selectedTasks={qrExportTasks}
  on:close={() => dispatch("closeModal", "qrExport")}
/>

{#if modals.workspaceSettings}
  <WorkspaceSettings
    {workspaceId}
    on:close={() => dispatch("closeModal", "workspaceSettings")}
    on:workspaceUpdated={() => dispatch("workspaceUpdated")}
  />
{/if}
