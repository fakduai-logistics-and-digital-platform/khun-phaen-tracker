"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  DragOverlay,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PaginationFooter } from "@/components/shared/pagination-footer";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { columnSettings } from "@/lib/stores/columnSettings";
import { currentWorkspaceShortName } from "@/lib/stores/workspace";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { KanbanCard, KanbanCardView } from "./kanban-card";
import { useFlipLayout } from "./use-flip-layout";

type ColumnStatus = "todo" | "in-progress" | "in-test" | "tested" | "done";
type Columns = Record<ColumnStatus, Task[]>;

const COLUMN_ORDER: ColumnStatus[] = ["todo", "in-progress", "in-test", "tested", "done"];

const COLUMN_STYLE: Record<ColumnStatus, { labelKey: string; dotClass: string }> = {
  todo: { labelKey: "kanbanBoard__column_todo", dotClass: "border-2 border-muted-foreground/60" },
  "in-progress": { labelKey: "kanbanBoard__column_in_progress", dotClass: "bg-primary" },
  "in-test": { labelKey: "kanbanBoard__column_in_test", dotClass: "bg-warning" },
  tested: { labelKey: "kanbanBoard__column_tested", dotClass: "bg-teal-500" },
  done: { labelKey: "kanbanBoard__column_done", dotClass: "bg-success" },
};

function groupTasks(tasks: Task[]): Columns {
  const hasId = (t: Task) => t.id !== undefined && t.id !== null;
  return {
    todo: tasks.filter((t) => (t.status === "todo" || t.status === "pending") && hasId(t)),
    "in-progress": tasks.filter((t) => t.status === "in-progress" && hasId(t)),
    "in-test": tasks.filter((t) => t.status === "in-test" && hasId(t)),
    tested: tasks.filter((t) => t.status === "tested" && hasId(t)),
    done: tasks.filter((t) => t.status === "done" && hasId(t)),
  };
}

function KanbanColumn({ status, items, children }: { status: ColumnStatus; items: Task[]; children: React.ReactNode }) {
  const { t } = useI18n();
  const { setNodeRef } = useDroppable({ id: status });
  const style = COLUMN_STYLE[status];

  return (
    <div className="flex min-w-65 flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={cn("size-2.5 shrink-0 rounded-full", style.dotClass)} />
          <span className="text-sm font-semibold">{t(style.labelKey)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="rounded-full tabular-nums">
            {items.length}
          </Badge>
          <GripVertical className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>
      </div>

      <div ref={setNodeRef} className="flex min-h-75 flex-1 flex-col gap-3">
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const skipFlipRef = useRef(false);
  useFlipLayout(rootRef, skipFlipRef, [columns]);

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

  function handleDragStart({ active }: DragStartEvent) {
    draggingRef.current = true;
    setActiveId(String(active.id));
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
    setActiveId(null);
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
          skipFlipRef.current = true;
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

  const activeTask = activeId
    ? COLUMN_ORDER.flatMap((status) => columns[status]).find((task) => String(task.id) === activeId)
    : undefined;

  return (
    <div ref={rootRef} className="relative flex flex-col">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-1 gap-6 overflow-x-auto pb-4 md:grid-cols-2 lg:grid-cols-4">
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
        <DragOverlay>
          {activeTask && (
            <KanbanCardView
              task={activeTask}
              done={activeTask.status === "done"}
              enabledColumns={enabledColumns}
              shortName={shortName}
              className="rotate-2 cursor-grabbing bg-card shadow-xl"
            />
          )}
        </DragOverlay>
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
