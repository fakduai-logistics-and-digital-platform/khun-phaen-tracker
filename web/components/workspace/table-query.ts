import { useCallback, useState } from "react";
import type { Task } from "@/lib/types";
import { compareTasks, type SortColumn } from "./table-view-config";

export type SortRule = { id: SortColumn; desc: boolean };
export type FilterField = "title" | "status" | "priority" | "category" | "project" | "assignee" | "sprint";
export type FilterOperator = "any" | "none" | "contains" | "not_contains";
export type FilterRule = { id: FilterField; operator: FilterOperator; values: string[] };
export type TableQuery = { sorts: SortRule[]; filters: FilterRule[]; pageSize: number };

export const SORT_FIELDS: SortColumn[] = [
  "title",
  "status",
  "priority",
  "project",
  "category",
  "assignee",
  "date",
  "created_at",
];
export const FILTER_FIELDS: FilterField[] = [
  "title",
  "status",
  "priority",
  "category",
  "project",
  "assignee",
  "sprint",
];
export const DEFAULT_SORTS: SortRule[] = [{ id: "created_at", desc: true }];

const STORAGE_KEY = "table-view-query-v1";

function isSortRule(value: unknown): value is SortRule {
  const rule = value as SortRule;
  return !!rule && SORT_FIELDS.includes(rule.id) && typeof rule.desc === "boolean";
}

function isFilterRule(value: unknown): value is FilterRule {
  const rule = value as FilterRule;
  return (
    !!rule &&
    FILTER_FIELDS.includes(rule.id) &&
    ["any", "none", "contains", "not_contains"].includes(rule.operator) &&
    Array.isArray(rule.values)
  );
}

function load(defaultPageSize: number): TableQuery {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved) {
      return {
        sorts: Array.isArray(saved.sorts) ? saved.sorts.filter(isSortRule) : DEFAULT_SORTS,
        filters: Array.isArray(saved.filters) ? saved.filters.filter(isFilterRule) : [],
        pageSize: typeof saved.pageSize === "number" && saved.pageSize > 0 ? saved.pageSize : defaultPageSize,
      };
    }
  } catch {
    /* A corrupt saved query falls back to the defaults. */
  }
  return { sorts: DEFAULT_SORTS, filters: [], pageSize: defaultPageSize };
}

/** Sort, filter and page-size choices of the task table, remembered in localStorage. */
export function useTableQuery(defaultPageSize: number) {
  const [query, setQueryState] = useState(() => load(defaultPageSize));
  const setQuery = useCallback((patch: Partial<TableQuery>) => {
    setQueryState((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  return [query, setQuery] as const;
}

function valuesOf(task: Task, field: FilterField): string[] {
  switch (field) {
    case "title":
      return [task.title];
    case "status":
      return [task.status];
    case "priority":
      return [task.priority || "none"];
    case "category":
      return [task.category || ""];
    case "project":
      return [task.project || ""];
    case "sprint":
      return [String(task.sprint_id ?? "")];
    case "assignee":
      return (task.assignees ?? []).map((assignee) => String(assignee.id));
  }
}

function matches(task: Task, rule: FilterRule) {
  if (rule.values.length === 0 || (rule.id === "title" && !rule.values[0])) return true;
  const actual = valuesOf(task, rule.id);
  if (rule.operator === "contains" || rule.operator === "not_contains") {
    const found = actual[0].toLowerCase().includes(rule.values[0].toLowerCase());
    return rule.operator === "contains" ? found : !found;
  }
  const found = actual.some((value) => rule.values.includes(value));
  return rule.operator === "any" ? found : !found;
}

export function applyTableQuery(tasks: Task[], { sorts, filters }: Pick<TableQuery, "sorts" | "filters">) {
  const kept = tasks.filter((task) => filters.every((rule) => matches(task, rule)));
  return kept.sort((a, b) => {
    for (const rule of sorts) {
      const order = compareTasks(a, b, rule.id);
      if (order !== 0) return rule.desc ? -order : order;
    }
    return 0;
  });
}
