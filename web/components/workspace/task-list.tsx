"use client";

import {
  Archive,
  Calendar,
  Check,
  Edit2,
  FileText,
  Flag,
  Folder,
  ListTodo,
  MoreVertical,
  Tag,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { PaginationFooter } from "@/components/shared/pagination-footer";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { columnSettings } from "@/lib/stores/columnSettings";
import { currentWorkspaceShortName } from "@/lib/stores/workspace";
import type { Sprint, Task } from "@/lib/types";

export interface TaskListProps {
  tasks?: Task[];
  sprints?: Sprint[];
  currentPage?: number;
  totalPages?: number;
  totalTasks?: number;
  pageSize?: number;
  onEdit?: (task: Task) => void;
  onDelete?: (id: number | string) => void;
  onStatusChange?: (detail: { id: number | string; status: Task["status"] }) => void;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

function getStatusVariant(status: Task["status"], isArchived = false) {
  if (isArchived || status === "pending") return "outline";
  if (status === "in-progress") return "default";
  return "secondary";
}

export function TaskList({
  tasks = [],
  sprints = [],
  currentPage = 1,
  totalPages = 1,
  totalTasks = 0,
  pageSize = 20,
  onEdit,
  onDelete,
  onStatusChange,
  onPageChange,
  onPageSizeChange,
}: TaskListProps) {
  const { t } = useI18n();
  const settings = useStore(columnSettings);
  const shortName = useStore(currentWorkspaceShortName);
  const enabled = new Map(settings.map((s) => [s.id, s.enabled]));

  const getSprintName = (sprintId: string | number | null | undefined) => {
    if (!sprintId) return null;
    return sprints.find((s) => String(s.id) === String(sprintId))?.name || null;
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const getStatusText = (status: Task["status"], isArchived = false) => {
    if (isArchived) return t("taskList__archived");
    switch (status) {
      case "pending":
        return t("taskList__status_pending");
      case "todo":
        return t("taskList__status_todo");
      case "in-progress":
        return t("taskList__status_in_progress");
      case "done":
        return t("taskList__status_done");
      case "in-test":
        return t("taskList__status_in_test");
    }
  };

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-col gap-3 p-4">
        {tasks.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <p>{t("taskList__no_tasks")}</p>
            <p className="mt-1 text-sm">{t("taskList__add_task_hint")}</p>
          </div>
        ) : (
          tasks.map((task) => {
            const sprintName = getSprintName(task.sprint_id);
            const checklist = task.checklist ?? [];
            const completed = checklist.filter((i) => i.completed).length;
            const percent = checklist.length ? Math.round((completed / checklist.length) * 100) : 0;
            return (
              <div
                key={String(task.id)}
                className="cursor-pointer rounded-lg border p-4 transition-colors hover:bg-accent/50"
                onClick={() => onEdit?.(task)}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && e.key === "Enter") onEdit?.(task);
                }}
                role="button"
                aria-label={task.title}
                tabIndex={0}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      {enabled.get("priority") && <PriorityBadge priority={task.priority} />}
                      <Badge variant={getStatusVariant(task.status, task.is_archived)}>
                        {getStatusText(task.status, task.is_archived)}
                      </Badge>
                    </div>
                    <h3 className="text-sm leading-snug font-medium">
                      {enabled.get("id") && task.task_number && (
                        <span className="mr-2 text-muted-foreground">
                          {task.workspace_short_name || shortName || "TASK"}-{task.task_number}
                        </span>
                      )}
                      {task.title}
                    </h3>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {enabled.get("date") && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-4" />
                          {formatDate(task.date)}
                        </span>
                      )}
                      {enabled.get("project") && task.project && (
                        <Badge variant="outline">
                          <Folder />
                          {task.project}
                        </Badge>
                      )}
                      {sprintName && (
                        <Badge variant="outline">
                          {task.is_archived ? <Archive /> : <Flag />}
                          {sprintName}
                        </Badge>
                      )}
                      {enabled.get("category") && (
                        <span className="flex items-center gap-1">
                          <Tag className="size-4" />
                          {task.category}
                        </span>
                      )}
                    </div>

                    {enabled.get("description") && task.notes && (
                      <p className="mt-2 flex items-start gap-1 text-sm text-muted-foreground">
                        <FileText className="mt-0.5 size-4 shrink-0" />
                        <span className="line-clamp-2">{task.notes}</span>
                      </p>
                    )}

                    {enabled.get("checklist") && checklist.length > 0 && (
                      <div className="mt-3 max-w-xs">
                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 tabular-nums">
                            <ListTodo className="size-3" />
                            Checklist: {completed}/{checklist.length}
                          </span>
                          <span className="tabular-nums">{percent}%</span>
                        </div>
                        <Progress value={percent} className="h-1.5" />
                      </div>
                    )}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={t("taskList__edit")}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onSelect={() => onEdit?.(task)}>
                        <Edit2 />
                        {t("taskList__edit")}
                      </DropdownMenuItem>
                      {task.status !== "done" && (
                        <DropdownMenuItem onSelect={() => onStatusChange?.({ id: task.id!, status: "done" })}>
                          <Check />
                          {t("taskList__mark_done")}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => onDelete?.(task.id!)}>
                        <Trash2 />
                        {t("taskList__delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalTasks > 0 && (
        <PaginationFooter
          currentPage={currentPage}
          totalPages={totalPages}
          totalTasks={totalTasks}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </Card>
  );
}
