"use client";

import type { Assignee, FilterOptions, Sprint, Task } from "@/lib/types";
import { CalendarView } from "./calendar-view";
import { GanttView } from "./gantt-view";
import { KanbanBoard } from "./kanban-board";
import { TableView } from "./table-view";
import { TaskList } from "./task-list";
import { TaskViewPlaceholder } from "./task-view-placeholder";
import { WorkloadView } from "./workload-view";

type Id = string | number;
const FADE_IN = "animate-in fade-in duration-200";

export interface WorkspaceViewsProps {
  loadingData: boolean;
  filteredTasks: Task[];
  tasks: Task[];
  currentView: string;
  sprints: Sprint[];
  currentPage: number;
  totalPages: number;
  totalTasks: number;
  pageSize: number;
  filters?: FilterOptions;
  onFiltersChange?: (filters: FilterOptions) => void;
  sprintManagerTasks: Task[];
  assignees: Assignee[];
  onStatusChange?: (detail: { id: Id; status: Task["status"] }) => void;
  onPriorityChange?: (detail: { id: Id; priority: Task["priority"] }) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (id: Id) => void;
  onDragState?: (detail: { dragging: boolean }) => void;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onDeleteSelected?: (ids: Id[]) => void;
  onChecklistToggle?: (detail: { taskId: Id; checklistItemId: string }) => void;
  onExportQR?: (ids: Id[]) => void;
  onSelectAssignee?: (detail: { assigneeId: Id | "all" | null }) => void;
}

export function WorkspaceViews({
  loadingData,
  filteredTasks,
  tasks,
  currentView,
  sprints,
  currentPage,
  totalPages,
  totalTasks,
  pageSize,
  filters,
  onFiltersChange,
  sprintManagerTasks,
  assignees,
  onStatusChange,
  onPriorityChange,
  onEdit,
  onDelete,
  onDragState,
  onPageChange,
  onPageSizeChange,
  onDeleteSelected,
  onChecklistToggle,
  onExportQR,
  onSelectAssignee,
}: WorkspaceViewsProps) {
  const paging = { currentPage, totalPages, totalTasks, pageSize, onPageChange, onPageSizeChange };

  return (
    <div className="mt-8">
      {loadingData && filteredTasks.length === 0 ? (
        <TaskViewPlaceholder loading />
      ) : filteredTasks.length === 0 ? (
        <TaskViewPlaceholder loading={false} />
      ) : currentView === "kanban" ? (
        <div className={FADE_IN}>
          <KanbanBoard
            tasks={tasks}
            {...paging}
            onMove={({ id, newStatus }) => onStatusChange?.({ id, status: newStatus })}
            onEdit={onEdit}
            onDelete={onDelete}
            onDragState={onDragState}
          />
        </div>
      ) : currentView === "list" ? (
        <div className={FADE_IN}>
          <TaskList
            tasks={tasks}
            sprints={sprints}
            {...paging}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
          />
        </div>
      ) : currentView === "calendar" ? (
        <div className={FADE_IN}>
          <CalendarView tasks={filteredTasks} onSelectTask={onEdit} />
        </div>
      ) : currentView === "table" ? (
        <div className={FADE_IN}>
          <TableView
            tasks={tasks}
            sprints={sprints}
            filters={filters}
            onFiltersChange={onFiltersChange}
            {...paging}
            onEdit={onEdit}
            onDelete={onDelete}
            onDeleteSelected={onDeleteSelected}
            onStatusChange={onStatusChange}
            onPriorityChange={onPriorityChange}
            onChecklistToggle={onChecklistToggle}
            onExportQR={onExportQR}
          />
        </div>
      ) : currentView === "gantt" ? (
        <GanttView tasks={filteredTasks} sprints={sprints} onEdit={onEdit} />
      ) : currentView === "workload" ? (
        <WorkloadView tasks={sprintManagerTasks} assignees={assignees} onSelectAssignee={onSelectAssignee} />
      ) : null}
    </div>
  );
}
