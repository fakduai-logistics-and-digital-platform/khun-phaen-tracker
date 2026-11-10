"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PaginationFooter } from "@/components/shared/pagination-footer";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { columnSettings } from "@/lib/stores/columnSettings";
import { currentWorkspaceShortName } from "@/lib/stores/workspace";
import type { Assignee, Project, Sprint, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PriorityDropdown, StatusDropdown, type DropdownAnchor } from "./table-view-dropdowns";
import { TableViewToolbar } from "./table-view-toolbar";
import { TableViewBulkBar } from "./table-view-bulk-bar";
import { TableViewHeader } from "./table-view-header";
import { TableViewMobileCard } from "./table-view-mobile-card";
import { TableViewQuickPreview } from "./table-view-quick-preview";
import { TableViewRow } from "./table-view-row";
import { type PriorityValue, type SortColumn } from "./table-view-config";
import { applyTableQuery, DEFAULT_SORTS, useTableQuery } from "./table-query";
import { useFlipLayout } from "./use-flip-layout";
import { useRowTransitions } from "./use-row-transitions";
import { useTableColumnWidths } from "./use-table-column-widths";

type Id = string | number;

export interface TableViewProps {
  tasks?: Task[];
  sprints?: Sprint[];
  assignees?: Assignee[];
  projects?: Project[];
  onTaskUpdate?: (detail: { id: Id; updates: Partial<Task> }) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (id: Id) => void;
  onDeleteSelected?: (ids: Id[]) => void;
  onStatusChange?: (detail: { id: Id; status: Task["status"] }) => void;
  onPriorityChange?: (detail: { id: Id; priority: Task["priority"] }) => void;
  onChecklistToggle?: (detail: { taskId: Id; checklistItemId: string }) => void;
  onChangeSprint?: (ids: Id[]) => void;
  onChangeStatus?: (ids: Id[]) => void;
  onChangeProject?: (ids: Id[]) => void;
  onExportQR?: (ids: Id[]) => void;
}

function toggleInSet(set: Set<Id>, id: Id) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function TableView({
  tasks = [],
  sprints = [],
  assignees = [],
  projects = [],
  onTaskUpdate,
  onEdit,
  onDelete,
  onDeleteSelected,
  onStatusChange,
  onPriorityChange,
  onChecklistToggle,
  onChangeSprint,
  onChangeStatus,
  onChangeProject,
  onExportQR,
}: TableViewProps) {
  const { t } = useI18n();
  const settings = useStore(columnSettings);
  const shortName = useStore(currentWorkspaceShortName);
  const enabled = useMemo(() => new Map(settings.map((s) => [s.id, s.enabled])), [settings]);

  const [query, setQuery] = useTableQuery(20);
  const [page, setPage] = useState(1);
  const sortColumn = query.sorts[0]?.id ?? DEFAULT_SORTS[0].id;
  const sortDirection = (query.sorts[0] ?? DEFAULT_SORTS[0]).desc ? "desc" : "asc";
  const [selected, setSelected] = useState<Set<Id>>(new Set());
  const [expandedMobile, setExpandedMobile] = useState<Set<Id>>(new Set());
  const [expandedChecklists, setExpandedChecklists] = useState<Set<Id>>(new Set());
  const [priorityAnchor, setPriorityAnchor] = useState<DropdownAnchor | null>(null);
  const [statusAnchor, setStatusAnchor] = useState<DropdownAnchor | null>(null);
  const [previewId, setPreviewId] = useState<Id | null>(null);
  const { displayWidth, viewportRef, resizingCol, startResize } = useTableColumnWidths();

  const matched = useMemo(
    () =>
      applyTableQuery(
        tasks.filter((task) => !task.is_archived),
        query,
      ),
    [tasks, query],
  );
  const totalTasks = matched.length;
  const totalPages = Math.max(1, Math.ceil(totalTasks / query.pageSize));
  const currentPage = Math.min(page, totalPages);
  const sortedTasks = useMemo(
    () => matched.slice((currentPage - 1) * query.pageSize, currentPage * query.pageSize),
    [matched, currentPage, query.pageSize],
  );
  const rows = useRowTransitions(sortedTasks);
  const tableRef = useRef<HTMLTableElement>(null);
  const noFlipRef = useRef(false);
  useFlipLayout(tableRef, noFlipRef, [rows]);
  const sortedTaskIds = useMemo(
    () => sortedTasks.map((task) => task.id).filter((id): id is Id => id !== undefined),
    [sortedTasks],
  );
  const previewTask = previewId === null ? null : (tasks.find((task) => String(task.id) === String(previewId)) ?? null);

  useEffect(() => {
    const valid = new Set(sortedTaskIds);
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [sortedTaskIds]);

  useEffect(() => {
    if (!priorityAnchor && !statusAnchor) return;
    const closeAll = () => {
      setPriorityAnchor(null);
      setStatusAnchor(null);
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        priorityAnchor &&
        !target.closest(".priority-dropdown-portal") &&
        !target.closest(".priority-dropdown-trigger")
      ) {
        setPriorityAnchor(null);
      }
      if (statusAnchor && !target.closest(".status-dropdown-portal") && !target.closest(".status-dropdown-trigger")) {
        setStatusAnchor(null);
      }
    };
    window.addEventListener("click", onClick);
    window.addEventListener("scroll", closeAll);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("scroll", closeAll);
    };
  }, [priorityAnchor, statusAnchor]);

  const selectedOnPage = sortedTaskIds.filter((id) => selected.has(id)).length;
  const allOnPageSelected = sortedTaskIds.length > 0 && selectedOnPage === sortedTaskIds.length;
  const someOnPageSelected = selectedOnPage > 0 && !allOnPageSelected;
  const selectedIds = [...selected];

  function toggleSort(column: SortColumn) {
    const current = query.sorts[0];
    setQuery({ sorts: [{ id: column, desc: current?.id === column ? !current.desc : false }] });
  }

  function toggleSelectAll() {
    const next = new Set(selected);
    if (allOnPageSelected) sortedTaskIds.forEach((id) => next.delete(id));
    else sortedTaskIds.forEach((id) => next.add(id));
    setSelected(next);
  }

  function openPriority(id: Id, anchor: HTMLElement) {
    if (priorityAnchor?.taskId === id) {
      setPriorityAnchor(null);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    setPriorityAnchor({ taskId: id, top: rect.bottom + 4, left: rect.left });
  }

  function openStatus(id: Id, anchor: HTMLElement) {
    if (statusAnchor?.taskId === id) {
      setStatusAnchor(null);
      return;
    }
    setPriorityAnchor(null);
    const rect = anchor.getBoundingClientRect();
    setStatusAnchor({ taskId: id, top: rect.bottom + 4, left: rect.left });
  }

  function selectPriority(taskId: Id, priority: PriorityValue) {
    onPriorityChange?.({ id: taskId, priority });
    setPriorityAnchor(null);
  }

  function selectStatus(taskId: Id, status: Task["status"]) {
    onStatusChange?.({ id: taskId, status });
    setStatusAnchor(null);
  }

  const sprintNameOf = (sprintId: Id | null | undefined) =>
    sprintId ? sprints.find((s) => String(s.id) === String(sprintId))?.name || null : null;
  const findTask = (id: Id) => sortedTasks.find((task) => task.id === id);
  const checklistIndent = 40 + (enabled.get("priority") ? displayWidth("priority") + 16 : 0);

  const emptyState = (
    <div className="flex flex-col items-center gap-2 duration-300 animate-in fade-in">
      <svg
        className="size-10 text-muted-foreground/40 lg:size-12"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
      <p className="text-sm lg:text-base">{t("tableView__no_tasks")}</p>
    </div>
  );

  return (
    <>
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="hidden border-b md:block">
          <TableViewToolbar
            tasks={tasks}
            sprints={sprints}
            query={query}
            onQueryChange={(patch) => {
              setQuery(patch);
              setPage(1);
            }}
          />
        </div>
        {selected.size > 0 && (
          <TableViewBulkBar
            count={selected.size}
            onClear={() => setSelected(new Set())}
            onChangeStatus={() => onChangeStatus?.(selectedIds)}
            onChangeProject={() => onChangeProject?.(selectedIds)}
            onChangeSprint={() => onChangeSprint?.(selectedIds)}
            onExportQR={() => onExportQR?.(selectedIds)}
            onDelete={() => onDeleteSelected?.(selectedIds)}
          />
        )}

        <div
          ref={viewportRef}
          className={cn("hidden overflow-x-auto md:block", resizingCol && "cursor-col-resize select-none")}
          onScroll={() => {
            setPriorityAnchor(null);
            setStatusAnchor(null);
          }}
        >
          <table ref={tableRef} className="w-full min-w-[1080px] table-fixed [&_td]:overflow-hidden">
            <TableViewHeader
              enabled={enabled}
              allOnPageSelected={allOnPageSelected}
              someOnPageSelected={someOnPageSelected}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              resizingCol={resizingCol}
              displayWidth={displayWidth}
              onToggleSelectAll={toggleSelectAll}
              onToggleSort={toggleSort}
              onStartResize={startResize}
            />
            <tbody className="divide-y">
              {sortedTasks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    {emptyState}
                  </td>
                </tr>
              ) : (
                rows.map(({ item: task, phase }) => (
                  <TableViewRow
                    key={String(task.id)}
                    task={task}
                    phase={phase}
                    enabled={enabled}
                    shortName={shortName}
                    sprintName={sprintNameOf(task.sprint_id)}
                    selected={selected.has(task.id!)}
                    checklistExpanded={expandedChecklists.has(task.id!)}
                    checklistIndent={checklistIndent}
                    onToggleSelect={(id) => setSelected((prev) => toggleInSet(prev, id))}
                    onToggleChecklist={(id) => setExpandedChecklists((prev) => toggleInSet(prev, id))}
                    onEdit={(item) => onEdit?.(item)}
                    onDelete={(id) => onDelete?.(id)}
                    onPreview={(item) => setPreviewId(item.id ?? null)}
                    onChecklistToggle={(detail) => onChecklistToggle?.(detail)}
                    onOpenPriority={openPriority}
                    onOpenStatus={openStatus}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden">
          {sortedTasks.length > 0 ? (
            <div className="divide-y">
              {sortedTasks.map((task) => (
                <TableViewMobileCard
                  key={String(task.id)}
                  task={task}
                  shortName={shortName}
                  sprintName={sprintNameOf(task.sprint_id)}
                  selected={selected.has(task.id!)}
                  expanded={expandedMobile.has(task.id!)}
                  onToggleSelect={(id) => setSelected((prev) => toggleInSet(prev, id))}
                  onToggleExpand={(id) => setExpandedMobile((prev) => toggleInSet(prev, id))}
                  onEdit={(item) => onEdit?.(item)}
                  onDelete={(id) => onDelete?.(id)}
                  onPreview={(item) => setPreviewId(item.id ?? null)}
                  onOpenPriority={openPriority}
                  onOpenStatus={openStatus}
                />
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-muted-foreground">{emptyState}</div>
          )}
        </div>

        {totalTasks > 0 && (
          <PaginationFooter
            currentPage={currentPage}
            totalPages={totalPages}
            totalTasks={totalTasks}
            pageSize={query.pageSize}
            onPageChange={setPage}
            onPageSizeChange={(pageSize) => {
              setQuery({ pageSize });
              setPage(1);
            }}
          />
        )}
      </div>

      <TableViewQuickPreview
        task={previewTask}
        assignees={assignees}
        projects={projects}
        onUpdate={(id, updates) => onTaskUpdate?.({ id, updates })}
        onClose={() => setPreviewId(null)}
        onOpenFull={(task) => onEdit?.(task)}
      />
      {priorityAnchor && (
        <PriorityDropdown anchor={priorityAnchor} task={findTask(priorityAnchor.taskId)} onSelect={selectPriority} />
      )}
      {statusAnchor && (
        <StatusDropdown anchor={statusAnchor} task={findTask(statusAnchor.taskId)} onSelect={selectStatus} />
      )}
    </>
  );
}
