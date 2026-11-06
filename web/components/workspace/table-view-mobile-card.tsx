"use client";

import { Calendar, ChevronDown, ChevronUp, Clock, Edit2, Eye, Flag, Folder, ListTodo, Trash2 } from "lucide-react";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { Tooltip } from "@/components/shared/tooltip";
import { useI18n } from "@/lib/i18n";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { tOr } from "./t-or";
import {
  dueDateOf,
  formatDate,
  formatDateFull,
  formatDuration,
  getStatusClass,
  getStatusIcon,
  getStatusLabel,
  isOverdue,
} from "./table-view-config";

export interface TableViewMobileCardProps {
  task: Task;
  shortName: string | null;
  sprintName: string | null;
  selected: boolean;
  expanded: boolean;
  onToggleSelect: (id: string | number) => void;
  onToggleExpand: (id: string | number) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string | number) => void;
  onPreview: (task: Task) => void;
  onOpenPriority: (id: string | number, anchor: HTMLElement) => void;
  onOpenStatus: (id: string | number, anchor: HTMLElement) => void;
}

const ACTION = "rounded-lg p-1.5 text-muted-foreground transition-colors";

export function TableViewMobileCard({
  task,
  shortName,
  sprintName,
  selected,
  expanded,
  onToggleSelect,
  onToggleExpand,
  onEdit,
  onDelete,
  onPreview,
  onOpenPriority,
  onOpenStatus,
}: TableViewMobileCardProps) {
  const { t } = useI18n();
  const id = task.id!;
  const StatusIcon = getStatusIcon(task.status);
  const due = dueDateOf(task);
  const overdue = isOverdue(due, task.status, task.is_archived);
  const checklist = task.checklist ?? [];
  const completed = checklist.filter((i) => i.completed).length;
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
      className="cursor-pointer p-3 transition-colors hover:bg-accent/50 sm:p-4"
      onClick={() => onEdit(task)}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && e.key === "Enter") onEdit(task);
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={task.title}
          className="mt-1 size-4 shrink-0 rounded border-input accent-primary"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {task.priority && task.priority !== "none" && (
                <div className="mb-1 flex items-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPriority(id, e.currentTarget);
                    }}
                    className="priority-dropdown-trigger rounded p-0.5 transition-colors hover:bg-accent"
                  >
                    <PriorityBadge priority={task.priority} />
                  </button>
                </div>
              )}
              <Tooltip text={task.title}>
                <h3 className="line-clamp-2 text-sm font-semibold">
                  {task.task_number && (
                    <span className="mr-1.5 text-xs font-medium text-muted-foreground">
                      {task.workspace_short_name || shortName || "TASK"}-{task.task_number}
                    </span>
                  )}
                  {task.title}
                </h3>
              </Tooltip>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={stop(() => onPreview(task))}
                className={cn(ACTION, "hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/20")}
                aria-label={tOr(t, "tableView__quick_preview", "Quick preview")}
              >
                <Eye size={16} />
              </button>
              <button
                type="button"
                onClick={stop(() => onEdit(task))}
                className={cn(ACTION, "hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20")}
                aria-label={t("taskList__edit")}
              >
                <Edit2 size={16} />
              </button>
              <button
                type="button"
                onClick={stop(() => onDelete(id))}
                className={cn(ACTION, "hover:bg-destructive hover:text-destructive dark:hover:bg-destructive/20")}
                aria-label={t("taskList__delete")}
              >
                <Trash2 size={16} />
              </button>
              <button
                type="button"
                onClick={stop(() => onToggleExpand(id))}
                aria-expanded={expanded}
                className={cn(ACTION, "hover:bg-accent hover:text-foreground")}
                aria-label={t("tableView__column_actions")}
              >
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!task.is_archived) onOpenStatus(id, e.currentTarget);
              }}
              className={cn(
                "status-dropdown-trigger inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
                getStatusClass(task.status, task.is_archived),
              )}
              disabled={task.is_archived}
            >
              <StatusIcon size={12} />
              {getStatusLabel(task.status, t, task.is_archived)}
              {!task.is_archived && <ChevronDown size={10} className="ml-0.5 opacity-60" />}
            </button>

            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs text-muted-foreground",
                overdue && "font-medium text-destructive ",
              )}
            >
              <Calendar size={12} />
              {formatDate(due, t("tableView__today"))}
              {overdue && <span className="text-destructive">{t("tableView__overdue_label")}</span>}
            </span>

            {sprintName && (
              <span className="inline-flex items-center gap-1 rounded bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                <Flag size={10} />
                {sprintName}
              </span>
            )}

            {task.duration_minutes > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock size={12} />
                {formatDuration(task.duration_minutes)}
              </span>
            )}

            {checklist.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                <ListTodo size={12} />
                {completed}/{checklist.length}
              </span>
            )}
          </div>

          {expanded && (
            <div className="mt-3 space-y-2 border-t pt-3 animate-in fade-in slide-in-from-top-1 duration-200">
              {task.project && (
                <div className="flex items-center gap-2">
                  <Folder size={14} className="shrink-0 text-muted-foreground" />
                  <span className="text-xs">{task.project}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t("tableView__column_category")}:</span>
                <span className="text-xs">{task.category || t("tableView__category_other")}</span>
              </div>

              {task.assignees && task.assignees.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {task.assignees.map((assignee, i) => (
                    <div key={`${assignee.id ?? i}`} className="flex items-center gap-1.5">
                      <div
                        className="flex size-5 items-center justify-center rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: assignee.color || "#6366F1" }}
                      >
                        {assignee.name.charAt(0)}
                      </div>
                      <span className="text-xs">{assignee.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {sprintName && (
                <div className="flex items-center gap-2">
                  <Flag size={14} className="shrink-0 text-indigo-500" />
                  <span className="text-xs">{sprintName}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Calendar size={14} className="shrink-0 text-muted-foreground" />
                <span className="text-xs">{formatDateFull(due)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
