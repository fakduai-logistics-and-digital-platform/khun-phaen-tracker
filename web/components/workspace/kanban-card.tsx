"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ListTodo, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { useI18n } from "@/lib/i18n";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface KanbanCardProps {
  task: Task;
  done: boolean;
  enabledColumns: Map<string, boolean>;
  shortName: string | null;
  onEdit?: (task: Task) => void;
  onDelete?: (id: string | number) => void;
}

export function KanbanCard({ task, done, enabledColumns, shortName, onEdit, onDelete }: KanbanCardProps) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(task.id),
  });

  const taskId = task.task_number ? `${task.workspace_short_name || shortName || "TASK"}-${task.task_number}` : "";
  const checklist = task.checklist ?? [];
  const completed = checklist.filter((i) => i.completed).length;
  const percent = checklist.length ? Math.round((completed / checklist.length) * 100) : 0;
  const assignees = task.assignees ?? [];

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => onEdit?.(task)}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && e.key === "Enter") onEdit?.(task);
        else listeners?.onKeyDown?.(e);
      }}
      className={cn(
        "group cursor-pointer gap-2 p-3 transition-colors hover:bg-accent/50",
        done && "opacity-60",
        isDragging && "z-10 opacity-50",
      )}
    >
      <div className="flex min-h-6 items-center justify-between">
        {enabledColumns.get("priority") && task.priority && task.priority !== "none" ? (
          <PriorityBadge priority={task.priority} />
        ) : (
          <span />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={t("kanbanBoard__edit")}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem onSelect={() => onEdit?.(task)}>{t("kanbanBoard__edit")}</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete?.(task.id!)}>
              {t("kanbanBoard__delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <h4 className={cn("text-sm leading-snug font-medium", done && "line-through")}>
        {enabledColumns.get("id") && taskId && <span className="mr-1.5 text-muted-foreground">{taskId}</span>}
        {task.title}
      </h4>

      {enabledColumns.get("description") && task.notes && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{task.notes}</p>
      )}

      {enabledColumns.get("checklist") && checklist.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ListTodo className="size-3" />
          <span className="tabular-nums">
            {completed}/{checklist.length}
          </span>
          <Progress value={percent} className="h-1.5 flex-1" />
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center -space-x-1.5">
          {assignees.slice(0, 3).map((assignee, index) => (
            <div
              key={`${assignee.id ?? index}`}
              className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-card text-xs font-medium text-white"
              style={{ backgroundColor: assignee.color || "#6366f1" }}
              title={assignee.name}
            >
              {assignee.name?.[0]?.toUpperCase() || "?"}
            </div>
          ))}
          {assignees.length > 3 && (
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-card bg-muted text-xs font-medium text-muted-foreground">
              +{assignees.length - 3}
            </div>
          )}
        </div>
        {task.category && <Badge variant="secondary">{task.category}</Badge>}
      </div>
    </Card>
  );
}
