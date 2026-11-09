"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaginationFooter } from "@/components/shared/pagination-footer";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { columnSettings } from "@/lib/stores/columnSettings";
import { currentWorkspaceShortName } from "@/lib/stores/workspace";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { KanbanCard } from "./kanban-card";

type ColumnStatus = "todo" | "in-progress" | "in-test" | "done";
type Columns = Record<ColumnStatus, Task[]>;

const COLUMN_ORDER: ColumnStatus[] = ["todo", "in-progress", "in-test", "done"];

const COLUMN_STYLE: Record<ColumnStatus, { labelKey: string; dotClass: string }> = {
  todo: { labelKey: "kanbanBoard__column_todo", dotClass: "border-2 border-muted-foreground/60" },
  "in-progress": { labelKey: "kanbanBoard__column_in_progress", dotClass: "bg-primary" },
  "in-test": { labelKey: "kanbanBoard__column_in_test", dotClass: "bg-warning" },
  done: { labelKey: "kanbanBoard__column_done", dotClass: "bg-success" },
};

function groupTasks(tasks: Task[]): Columns {
  const hasId = (t: Task) => t.id !== undefined && t.id !== null;
  return {
    todo: tasks.filter((t) => (t.status === "todo" || t.status === "pending") && hasId(t)),
    "in-progress": tasks.filter((t) => t.status === "in-progress" && hasId(t)),
    "in-test": tasks.filter((t) => t.status === "in-test" && hasId(t)),
    done: tasks.filter((t) => t.status === "done" && hasId(t)),
  };
}

function KanbanColumn({ status, items, children }: { status: ColumnStatus; items: Task[]; children: React.ReactNode }) {
  const { t } = useI18n();
  const { setNodeRef } = useDroppable({ id: status });
  const style = COLUMN_STYLE[status];

  return (
    <div className="flex min-w-65 flex-col gap-3 rounded-xl bg-muted/40 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("size-2.5 shrink-0 rounded-full", style.dotClass)} />
          <span className="text-sm font-medium">{t(style.labelKey)}</span>
          <Badge variant="secondary" className="tabular-nums">
            {items.length}
          </Badge>
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-7" title="Add task" aria-label="Add task">
          <Plus />
        </Button>
      </div>

      <div ref={setNodeRef} className="flex min-h-75 flex-1 flex-col gap-2">
        {children}
      </div>
    </div>
  );
}

export interface KanbanBoardProps {
  tasks?: Task[];
  currentPage?: number;
  totalPages?: number;
  totalTasks?: number;
  pageSize?: number;
  onMove?: (detail: { id: string | number; newStatus: Task["status"] }) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (id: string | number) => void;
  onDragState?: (detail: { dragging: boolean }) => void;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function KanbanBoard({
  tasks = [],
  currentPage = 1,
  totalPages = 1,
  totalTasks = 0,
  pageSize = 20,
  onMove,
  onEdit,
  onDelete,
  onDragState,
  onPageChange,
  onPageSizeChange,
}: KanbanBoardProps) {
  const settings = useStore(columnSettings);
  const shortName = useStore(currentWorkspaceShortName);
  const enabledColumns = new Map(settings.map((s) => [s.id, s.enabled]));
  const [columns, setColumns] = useState<Columns>(() => groupTasks(tasks));
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!draggingRef.current) setColumns(groupTasks(tasks));
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  const findColumn = (id: string | number, from: Columns): ColumnStatus | undefined => {
    if ((COLUMN_ORDER as string[]).includes(String(id))) return String(id) as ColumnStatus;
    return COLUMN_ORDER.find((status) => from[status].some((task) => String(task.id) === String(id)));
  };

  function handleDragStart(_event: DragStartEvent) {
    draggingRef.current = true;
    onDragState?.({ dragging: true });
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    setColumns((prev) => {
      const from = findColumn(active.id, prev);
      const to = findColumn(over.id, prev);
      if (!from || !to || from === to) return prev;

      const moving = prev[from].find((task) => String(task.id) === String(active.id));
      if (!moving) return prev;
      const overIndex = prev[to].findIndex((task) => String(task.id) === String(over.id));
      const insertAt = overIndex >= 0 ? overIndex : prev[to].length;

      return {
        ...prev,
        [from]: prev[from].filter((task) => String(task.id) !== String(active.id)),
        [to]: [...prev[to].slice(0, insertAt), moving, ...prev[to].slice(insertAt)],
      };
    });
  }

  function finishDrag() {
    draggingRef.current = false;
    onDragState?.({ dragging: false });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const droppedId = active.id;
    let finalColumn = findColumn(droppedId, columns);

    if (over && finalColumn) {
      const overColumn = findColumn(over.id, columns);
      if (overColumn === finalColumn && String(over.id) !== String(droppedId)) {
        const oldIndex = columns[finalColumn].findIndex((task) => String(task.id) === String(droppedId));
        const newIndex = columns[finalColumn].findIndex((task) => String(task.id) === String(over.id));
        if (oldIndex >= 0 && newIndex >= 0) {
          const next = arrayMove(columns[finalColumn], oldIndex, newIndex);
          setColumns((prev) => ({ ...prev, [finalColumn as ColumnStatus]: next }));
        }
      }
    } else {
      finalColumn = undefined;
    }

    if (finalColumn) {
      const original = tasks.find((task) => task.id !== undefined && String(task.id) === String(droppedId));
      if (original && original.status !== finalColumn) {
        onMove?.({ id: original.id!, newStatus: finalColumn });
      }
    } else {
      setColumns(groupTasks(tasks));
    }
    finishDrag();
  }

  function handleDragCancel() {
    setColumns(groupTasks(tasks));
    finishDrag();
  }

  return (
    <div className="flex flex-col">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-1 gap-3 overflow-x-auto pb-4 md:grid-cols-2 lg:grid-cols-4">
          {COLUMN_ORDER.map((status) => (
            <KanbanColumn key={status} status={status} items={columns[status]}>
              <SortableContext
                items={columns[status].map((task) => String(task.id))}
                strategy={verticalListSortingStrategy}
              >
                {columns[status].map((task) => (
                  <KanbanCard
                    key={String(task.id)}
                    task={task}
                    done={status === "done"}
                    enabledColumns={enabledColumns}
                    shortName={shortName}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </SortableContext>
            </KanbanColumn>
          ))}
        </div>
      </DndContext>

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
    </div>
  );
}
