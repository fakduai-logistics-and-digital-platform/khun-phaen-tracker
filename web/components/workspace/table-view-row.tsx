"use client";

import { Check, ChevronDown, ChevronRight, Edit2, Eye, Flag, Minus, MoreHorizontal, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { Tooltip } from "@/components/shared/tooltip";
import { useI18n } from "@/lib/i18n";
import type { Task } from "@/lib/types";
import type { TaskType } from "@/lib/utils/branch-name";
import { cn } from "@/lib/utils";
import { tOr } from "./t-or";
import type { RowPhase } from "./use-row-transitions";
import {
  TASK_TYPE_BADGE,
  dueDateOf,
  formatDate,
  getStatusClass,
  getStatusIcon,
  getStatusLabel,
  getStatusShort,
  isOverdue,
} from "./table-view-config";

function RowActions({
  task,
  onPreview,
  onEdit,
  onDelete,
}: {
  task: Task;
  onPreview: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex justify-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={(e) => e.stopPropagation()}
            aria-label={t("tableView__column_actions")}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onSelect={() => onPreview(task)}>
            <Eye />
            {tOr(t, "tableView__quick_preview", "Quick preview")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onEdit(task)}>
            <Edit2 />
            {t("taskList__edit")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <Trash2 />
            {t("taskList__delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export interface TableViewRowProps {
  task: Task;
  enabled: Map<string, boolean>;
  shortName: string | null;
  sprintName: string | null;
  selected: boolean;
  checklistExpanded: boolean;
  checklistIndent: number;
  onToggleSelect: (id: string | number) => void;
  onToggleChecklist: (id: string | number) => void;
  phase?: RowPhase;
  onEdit: (task: Task) => void;
  onDelete: (id: string | number) => void;
  onPreview: (task: Task) => void;
  onChecklistToggle: (detail: { taskId: string | number; checklistItemId: string }) => void;
  onOpenPriority: (id: string | number, anchor: HTMLElement) => void;
  onOpenStatus: (id: string | number, anchor: HTMLElement) => void;
}

export function TableViewRow({
  task,
  enabled,
  shortName,
  sprintName,
  selected,
  checklistExpanded,
  checklistIndent,
  onToggleSelect,
  onToggleChecklist,
  phase,
  onEdit,
  onDelete,
  onPreview,
  onChecklistToggle,
  onOpenPriority,
  onOpenStatus,
}: TableViewRowProps) {
  const { t } = useI18n();
  const id = task.id!;
  const StatusIcon = getStatusIcon(task.status);
  const due = dueDateOf(task);
  const overdue = isOverdue(due, task.status, task.is_archived);
  const checklist = task.checklist ?? [];
  const completed = checklist.filter((i) => i.completed).length;
  const badge = task.task_type ? TASK_TYPE_BADGE[task.task_type as TaskType] : undefined;
  const assignees = task.assignees ?? [];

  return (
    <>
      <tr
        data-flip-id={String(id)}
        data-flip-active={phase === "leave"}
        className={cn(
          "cursor-pointer transition-colors hover:bg-accent/50",
          phase === "enter" && "duration-300 animate-in fade-in slide-in-from-top-2",
          phase === "leave" &&
            "pointer-events-none duration-200 animate-out fill-mode-forwards fade-out slide-out-to-right-8",
        )}
        onClick={() => onPreview(task)}
      >
        <td
          className="px-3 py-2"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(id);
          }}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(id)}
            onClick={(e) => e.stopPropagation()}
            aria-label={task.title}
          />
        </td>
        {enabled.get("priority") && (
          <td className="px-2 py-2">
            <div className="@container w-full">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPriority(id, e.currentTarget);
                }}
                className="priority-dropdown-trigger max-w-full rounded p-0.5 transition-colors hover:bg-accent"
                title={tOr(t, "tableView__priority_click_hint", "Click to change priority")}
                aria-label={tOr(t, "tableView__priority_click_hint", "Click to change priority")}
              >
                <PriorityBadge priority={task.priority} collapsible />
                {(!task.priority || task.priority === "none") && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                    <Minus size={10} />-
                  </span>
                )}
              </button>
            </div>
          </td>
        )}
        <td className="overflow-hidden px-3 py-2">
          <div className="flex w-full min-w-0 flex-col gap-1">
            <Tooltip text={task.title}>
              <div className="truncate text-sm leading-tight font-medium">
                {badge && (
                  <span
                    className={cn(
                      "mr-1.5 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ",
                      badge.className,
                    )}
                  >
                    {badge.label}
                  </span>
                )}
                {task.task_number && (
                  <span className="mr-1.5 text-xs font-medium text-muted-foreground">
                    {task.workspace_short_name || shortName || "TASK"}-{task.task_number}
                  </span>
                )}
                {task.title}
              </div>
            </Tooltip>

            {checklist.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleChecklist(id);
                }}
                aria-expanded={checklistExpanded}
                className="mt-1 -ml-1.5 flex items-center gap-1.5 rounded px-1.5 py-1 transition-colors hover:bg-accent"
              >
                {checklistExpanded ? (
                  <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
                )}
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full transition-colors duration-300",
                      completed === checklist.length ? "bg-success" : "bg-blue-500",
                    )}
                    style={{ width: `${(completed / checklist.length) * 100}%` }}
                  />
                </div>
                <span
                  className={cn(
                    "text-xs whitespace-nowrap",
                    completed === checklist.length ? "text-success" : "text-muted-foreground",
                  )}
                >
                  {completed}/{checklist.length}
                </span>
              </button>
            )}
            {task.project && (
              <Badge variant="outline" className="mt-1 lg:hidden">
                {task.project}
              </Badge>
            )}
          </div>
        </td>
        {enabled.get("project") && (
          <td className="hidden px-3 py-2 lg:table-cell">
            {task.project ? (
              <Badge variant="outline" className="max-w-25 truncate" title={task.project}>
                {task.project}
              </Badge>
            ) : (
              <span className="text-sm text-muted-foreground">-</span>
            )}
          </td>
        )}
        {enabled.get("category") && (
          <td className="hidden px-3 py-2 xl:table-cell">
            <Badge variant="secondary">{task.category || t("tableView__category_other")}</Badge>
          </td>
        )}
        {enabled.get("assignee") && (
          <td className="px-3 py-2">
            <div className="flex items-center -space-x-2 overflow-visible">
              {assignees.length > 0 ? (
                <Tooltip
                  content={assignees.map((assignee, i) => (
                    <span key={`${assignee.id ?? i}`} className="block">
                      {assignee.name}
                    </span>
                  ))}
                >
                  <div className="flex items-center -space-x-2">
                    {assignees.slice(0, 3).map((assignee, i) => (
                      <div
                        key={`${assignee.id ?? i}`}
                        className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: assignee.color || "#6366f1" }}
                      >
                        {assignee.avatar_url ? (
                          <img src={assignee.avatar_url} alt={assignee.name} className="size-full object-cover" />
                        ) : (
                          assignee.name?.[0]?.toUpperCase() || "?"
                        )}
                      </div>
                    ))}
                    {assignees.length > 3 && (
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        +{assignees.length - 3}
                      </div>
                    )}
                  </div>
                </Tooltip>
              ) : (
                <span className="text-sm text-muted-foreground">-</span>
              )}
            </div>
          </td>
        )}
        {enabled.get("sprint") && (
          <td className="hidden px-3 py-2 xl:table-cell">
            {sprintName ? (
              <Badge variant="outline" className="max-w-25 truncate" title={sprintName}>
                <Flag />
                {sprintName}
              </Badge>
            ) : (
              <span className="text-sm text-muted-foreground">-</span>
            )}
          </td>
        )}
        {enabled.get("status") && (
          <td className="px-3 py-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenStatus(id, e.currentTarget);
              }}
              className={cn(
                "status-dropdown-trigger inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors hover:opacity-80",
                getStatusClass(task.status, task.is_archived),
              )}
              title={t("tableView__status_click_hint")}
              disabled={task.is_archived}
            >
              <StatusIcon size={11} />
              <span className="hidden sm:inline">{getStatusLabel(task.status, t, task.is_archived)}</span>
              <span className="sm:hidden">{getStatusShort(task.status, t)}</span>
              <ChevronDown size={10} className="ml-0.5 opacity-60" />
            </button>
          </td>
        )}
        {enabled.get("date") && (
          <td className="px-3 py-2">
            <span className={cn("text-xs", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
              {formatDate(due, t("tableView__today"))}
              {overdue && <span className="ml-1 text-destructive">!</span>}
            </span>
          </td>
        )}
        <td className="px-3 py-2">
          <RowActions task={task} onPreview={onPreview} onEdit={onEdit} onDelete={() => onDelete(id)} />
        </td>
      </tr>

      {checklist.length > 0 && checklistExpanded && (
        <tr className="bg-muted/30">
          <td colSpan={9} className="py-2 pr-4" style={{ paddingLeft: checklistIndent }}>
            <div className="max-h-45 space-y-1 overflow-y-auto pr-2">
              {checklist.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="group flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1 text-left transition-colors hover:bg-accent"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChecklistToggle({ taskId: id, checklistItemId: item.id });
                  }}
                >
                  <div
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                      item.completed
                        ? "border-success bg-success text-white"
                        : "border-input group-hover:border-blue-500",
                    )}
                  >
                    {item.completed && <Check size={10} strokeWidth={3} />}
                  </div>
                  <span className={cn("flex-1 text-xs", item.completed && "text-muted-foreground line-through")}>
                    {item.text}
                  </span>
                </button>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
