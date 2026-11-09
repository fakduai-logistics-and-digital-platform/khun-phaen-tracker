"use client";

import { Circle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UsersFacetedFilter } from "@/components/settings/users-faceted-filter";
import { useI18n } from "@/lib/i18n";
import type { FilterOptions } from "@/lib/types";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "./table-view-config";
import { TableViewColumnToggle } from "./table-view-column-toggle";

type Props = {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
};

/** Filters are applied by the workspace store (one value per field), so each facet picks a single value. */
export function TableViewToolbar({ filters, onFiltersChange }: Props) {
  const { t } = useI18n();
  const status = filters.status && filters.status !== "all" ? filters.status : null;
  const priority = filters.priority && filters.priority !== "all" ? filters.priority : null;
  const search = filters.search ?? "";
  const filtered = Boolean(status || priority || search);
  const noResults = t("users__no_results");
  const reset = t("users__clear_filters");

  const statusOptions = [
    { value: "todo", label: t("page__filter_status_todo"), icon: Circle },
    ...STATUS_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey), icon: o.icon })),
  ];
  const priorityOptions = PRIORITY_OPTIONS.map((o) => ({ value: o.value, label: o.label, icon: o.icon }));

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          placeholder={t("tableView__filter_placeholder")}
          aria-label={t("tableView__filter_placeholder")}
          className="h-8 w-40 lg:w-64"
        />
        <UsersFacetedFilter
          title={t("tableView__column_status")}
          options={statusOptions}
          selected={new Set(status ? [status] : [])}
          onToggle={(value) =>
            onFiltersChange({ ...filters, status: value === status ? "all" : (value as FilterOptions["status"]) })
          }
          onClear={() => onFiltersChange({ ...filters, status: "all" })}
          clearLabel={reset}
          emptyLabel={noResults}
        />
        <UsersFacetedFilter
          title={t("tableView__column_priority")}
          options={priorityOptions}
          selected={new Set(priority ? [priority] : [])}
          onToggle={(value) =>
            onFiltersChange({ ...filters, priority: value === priority ? "all" : (value as FilterOptions["priority"]) })
          }
          onClear={() => onFiltersChange({ ...filters, priority: "all" })}
          clearLabel={reset}
          emptyLabel={noResults}
        />
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 lg:px-3"
            onClick={() => onFiltersChange({ ...filters, status: "all", priority: "all", search: "" })}
          >
            {reset}
            <X />
          </Button>
        )}
      </div>
      <TableViewColumnToggle />
    </div>
  );
}
