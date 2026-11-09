"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Separator } from "@/components/ui/separator";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { useI18n } from "@/lib/i18n";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { dueDateOf } from "./table-view-config";

export interface KanbanCardProps {
  task: Task;
  done: boolean;
  enabledColumns: Map<string, boolean>;
  shortName: string | null;
  onEdit?: (task: Task) => void;
  onDelete?: (id: string | number) => void;
}

type ViewProps = KanbanCardProps & React.ComponentProps<typeof Card>;

/** Presentational card, shared by the sortable item and the drag preview. */
export function KanbanCardView({
  task,
  done,
  enabledColumns,
  shortName,
  onEdit,
  onDelete,
  className,
  ...props
}: ViewProps) {
  const { t, locale } = useI18n();
  const taskId = task.task_number ? `${task.workspace_short_name || shortName || "TASK"}-${task.task_number}` : "";
  const checklist = task.checklist ?? [];
  const completed = checklist.filter((i) => i.completed).length;
  const percent = checklist.length ? Math.round((completed / checklist.length) * 100) : 0;
  const assignee = task.assignees?.[0];
  const due = dueDateOf(task);
  const showPriority = enabledColumns.get("priority") && task.priority && task.priority !== "none";

  return (
    <Card {...props} className={cn("group cursor-pointer gap-3 p-4 transition-colors hover:bg-accent/40", className)}>
      <div className="flex items-start justify-between gap-2">
        {task.category ? (
          <Badge variant="secondary" className="rounded-md font-normal">
            {task.category}
          </Badge>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1">
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
          {assignee && (
            <Avatar className="size-6" title={assignee.name}>
              <AvatarFallback className="text-xs">{assignee.name?.[0]?.toUpperCase() || "?"}</AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>

      <h4 className={cn("text-sm leading-snug font-semibold", done && "text-muted-foreground line-through")}>
        {enabledColumns.get("id") && taskId && (
          <span className="mr-1.5 font-normal text-muted-foreground">{taskId}</span>
        )}
        {task.title}
      </h4>

      {enabledColumns.get("description") && task.notes && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{task.notes}</p>
      )}

      {enabledColumns.get("checklist") && checklist.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("kanbanBoard__progress")}</span>
            <span className="tabular-nums">{percent}%</span>
          </div>
          <Progress value={percent} className="h-1.5" aria-label={t("kanbanBoard__progress")} />
        </div>
      )}

      {(showPriority || due) && (
        <>
          <Separator />
          <div className="flex min-h-5 items-center justify-between gap-2 text-xs text-muted-foreground">
            {showPriority ? <PriorityBadge priority={task.priority} /> : <span />}
            {due && (
              <span className="flex items-center gap-1.5 tabular-nums">
                <CalendarDays className="size-3.5" />
                {new Date(due).toLocaleDateString(locale, { month: "short", day: "2-digit" })}
              </span>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

export function KanbanCard(props: KanbanCardProps) {
  const { task } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(task.id),
  });

  return (
    <KanbanCardView
      {...props}
      ref={setNodeRef}
      data-flip-id={String(task.id)}
      data-flip-active={isDragging}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => props.onEdit?.(task)}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && e.key === "Enter") props.onEdit?.(task);
        else listeners?.onKeyDown?.(e);
      }}
      className={cn(isDragging && "opacity-40")}
    />
  );
}
