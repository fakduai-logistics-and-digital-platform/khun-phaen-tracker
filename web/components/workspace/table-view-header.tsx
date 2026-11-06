"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Calendar, Flag, Folder, User } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { tOr } from "./t-or";
import type { SortColumn, SortDirection } from "./table-view-config";
import type { ColumnKey } from "./use-table-column-widths";

export interface TableViewHeaderProps {
  enabled: Map<string, boolean>;
  allOnPageSelected: boolean;
  someOnPageSelected: boolean;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  resizingCol: ColumnKey | null;
  displayWidth: (col: ColumnKey) => number;
  onToggleSelectAll: () => void;
  onToggleSort: (column: SortColumn) => void;
  onStartResize: (col: ColumnKey, event: React.MouseEvent) => void;
}

const SORT_BUTTON = "flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground";

export function TableViewHeader({
  enabled,
  allOnPageSelected,
  someOnPageSelected,
  sortColumn,
  sortDirection,
  resizingCol,
  displayWidth,
  onToggleSelectAll,
  onToggleSort,
  onStartResize,
}: TableViewHeaderProps) {
  const { t } = useI18n();

  const sortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <ArrowUpDown size={12} />;
    return sortDirection === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  const resizeHandle = (col: ColumnKey) => (
    <div
      aria-hidden="true"
      onMouseDown={(e) => onStartResize(col, e)}
      className={cn(
        "absolute inset-y-0 right-0 z-[1] w-[5px] cursor-col-resize rounded-sm transition-colors select-none hover:bg-indigo-500/45",
        resizingCol === col && "bg-indigo-500/45",
      )}
    />
  );

  const sortable = (col: ColumnKey, column: SortColumn, className: string, label: React.ReactNode, px = "px-3") => (
    <th className={cn(px, "py-2 text-left relative", className)} style={{ width: displayWidth(col) }}>
      <button type="button" onClick={() => onToggleSort(column)} className={SORT_BUTTON}>
        {label}
        {sortIcon(column)}
      </button>
      {resizeHandle(col)}
    </th>
  );

  return (
    <thead className="border-b">
      <tr>
        <th className="w-10 px-3 py-2 text-left">
          <Checkbox
            checked={allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false}
            onCheckedChange={onToggleSelectAll}
            aria-label={tOr(t, "tableView__select_all", "Select all")}
          />
        </th>
        {enabled.get("priority") && sortable("priority", "priority", "", t("tableView__column_priority"), "px-2")}
        {sortable("title", "title", "", t("tableView__column_title"))}
        {enabled.get("project") &&
          sortable(
            "project",
            "project",
            "hidden lg:table-cell",
            <>
              <Folder size={12} />
              {t("tableView__column_project")}
            </>,
          )}
        {enabled.get("category") &&
          sortable("category", "category", "hidden xl:table-cell", t("tableView__column_category"))}
        {enabled.get("assignee") &&
          sortable(
            "assignee",
            "assignee",
            "",
            <>
              <User size={12} />
              <span className="hidden lg:inline">{t("tableView__column_assignee")}</span>
              <span className="lg:hidden">{t("tableView__column_assignee_short")}</span>
            </>,
          )}
        {enabled.get("sprint") && (
          <th className="relative hidden px-3 py-2 text-left xl:table-cell" style={{ width: displayWidth("sprint") }}>
            <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
              <Flag size={12} />
              {t("tableView__column_sprint")}
            </span>
            {resizeHandle("sprint")}
          </th>
        )}
        {enabled.get("status") && sortable("status", "status", "", t("tableView__column_status"))}
        {enabled.get("date") &&
          sortable(
            "date",
            "date",
            "",
            <>
              <Calendar size={12} />
              <span className="hidden lg:inline">{t("tableView__column_due_date")}</span>
              <span className="lg:hidden">{t("tableView__column_date_short")}</span>
            </>,
          )}
        <th className="w-20 px-3 py-2 text-center text-sm font-medium text-muted-foreground">
          {t("tableView__column_actions")}
        </th>
      </tr>
    </thead>
  );
}
