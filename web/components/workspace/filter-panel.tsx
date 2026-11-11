"use client";

import { useMemo, useState } from "react";
import {
  ArchiveX,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleDot,
  Clock3,
  Folder,
  ListFilter,
  PlayCircle,
  Tag,
  Trash2,
  User,
  Zap,
  type LucideIcon,
  BadgeCheck,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Assignee, FilterOptions, Sprint, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

type FilterGroup = "status" | "priority" | "assignee" | "project" | "label" | "dueDate" | "sprint";
type FilterValue = string | number | null;
type MenuOption = {
  value: FilterValue;
  label: string;
  count: number;
  icon?: LucideIcon;
  iconClass?: string;
  dotColor?: string;
};
type GroupConfig = {
  id: FilterGroup;
  label: string;
  icon: LucideIcon;
  value: FilterValue;
  options: MenuOption[];
};

export interface FilterPanelProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  categories?: string[];
  projects?: string[];
  assignees?: Assignee[];
  sprints?: Sprint[];
  myAssigneeId?: string | number;
  tasks?: Task[];
  onClearFilters?: () => void;
}

function sameValue(a: FilterValue | undefined, b: FilterValue) {
  if (a === null || b === null) return a === b;
  if (a === undefined) return b === "all";
  return String(a) === String(b);
}

function assigneeMatches(task: Task, value: FilterValue) {
  if (value === "all") return true;
  if (value === null) return !(task.assignees?.length || task.assignee_id || task.assignee);
  return (
    task.assignees?.some((assignee) => String(assignee.id) === String(value)) ||
    String(task.assignee_id || "") === String(value)
  );
}

function sprintMatches(task: Task, value: FilterValue) {
  if (value === "all") return true;
  if (value === null) return !task.sprint_id;
  return String(task.sprint_id || "") === String(value);
}

function dueDateMatches(task: Task, value: FilterValue) {
  if (value === "all") return true;
  const dueDate = task.due_date || task.end_date || "";
  if (value === "no_dates") return !dueDate;
  if (!dueDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  if (value === "overdue") return due < today && task.status !== "done";
  const days = value === "next_day" ? 1 : value === "next_week" ? 7 : 30;
  const limit = new Date(today);
  limit.setDate(limit.getDate() + days);
  return due >= today && due <= limit;
}

export function FilterPanel({
  filters,
  onFiltersChange,
  categories = [],
  projects = [],
  assignees = [],
  sprints = [],
  myAssigneeId,
  tasks = [],
  onClearFilters,
}: FilterPanelProps) {
  const { t } = useI18n();
  const [activeGroup, setActiveGroup] = useState<FilterGroup | null>(null);

  const groups = useMemo<GroupConfig[]>(() => {
    const count = (predicate: (task: Task) => boolean) => tasks.filter(predicate).length;
    const live = (status: Task["status"]) => count((task) => task.status === status && !task.is_archived);

    const statusOptions: MenuOption[] = [
      {
        value: "all",
        label: t("page__filter_status_all"),
        count: tasks.length,
        icon: ListFilter,
        iconClass: "text-muted-foreground",
      },
      {
        value: "pending",
        label: t("page__filter_status_pending"),
        count: live("pending"),
        icon: Circle,
        iconClass: "text-slate-400",
      },
      {
        value: "todo",
        label: t("page__filter_status_todo"),
        count: live("todo"),
        icon: CircleDot,
        iconClass: "text-muted-foreground",
      },
      {
        value: "in-progress",
        label: t("page__filter_status_in_progress"),
        count: live("in-progress"),
        icon: PlayCircle,
        iconClass: "text-amber-400",
      },
      {
        value: "in-test",
        label: t("page__filter_status_in_test"),
        count: live("in-test"),
        icon: CircleDot,
        iconClass: "text-success",
      },
      {
        value: "tested",
        label: t("page__filter_status_tested"),
        count: live("tested"),
        icon: BadgeCheck,
        iconClass: "text-teal-500",
      },
      {
        value: "done",
        label: t("page__filter_status_done"),
        count: live("done"),
        icon: CheckCircle2,
        iconClass: "text-blue-400",
      },
      {
        value: "archived",
        label: t("page__filter_status_archived"),
        count: count((task) => !!task.is_archived),
        icon: ArchiveX,
        iconClass: "text-muted-foreground",
      },
    ];

    const priorityOptions: MenuOption[] = [
      {
        value: "all",
        label: "All priorities",
        count: tasks.length,
        icon: ListFilter,
        iconClass: "text-muted-foreground",
      },
      { value: "urgent", label: "Urgent", count: count((task) => task.priority === "urgent"), dotColor: "#ef4444" },
      { value: "high", label: "High", count: count((task) => task.priority === "high"), dotColor: "#f97316" },
      { value: "medium", label: "Medium", count: count((task) => task.priority === "medium"), dotColor: "#eab308" },
      { value: "low", label: "Low", count: count((task) => task.priority === "low"), dotColor: "#22c55e" },
      {
        value: "none",
        label: "None",
        count: count((task) => !task.priority || task.priority === "none"),
        dotColor: "#64748b",
      },
    ];

    const assigneeOptions: MenuOption[] = [
      {
        value: "all",
        label: t("page__filter_assignee_all"),
        count: tasks.length,
        icon: User,
        iconClass: "text-muted-foreground",
      },
      ...(myAssigneeId !== undefined && myAssigneeId !== null
        ? [
            {
              value: myAssigneeId,
              label: t("page__filter_assignee_me"),
              count: count((task) => assigneeMatches(task, myAssigneeId)),
              dotColor: "#14b8a6",
            },
          ]
        : []),
      {
        value: null,
        label: t("page__unassigned"),
        count: count((task) => assigneeMatches(task, null)),
        dotColor: "#64748b",
      },
      ...assignees
        .filter((assignee) => assignee.id !== undefined && String(assignee.id) !== String(myAssigneeId))
        .map((assignee) => ({
          value: assignee.id!,
          label: assignee.name,
          count: count((task) => assigneeMatches(task, assignee.id!)),
          dotColor: assignee.color || "#94a3b8",
        })),
    ];

    const projectOptions: MenuOption[] = [
      {
        value: "all",
        label: t("page__filter_project_all"),
        count: tasks.length,
        icon: Folder,
        iconClass: "text-muted-foreground",
      },
      ...projects.map((project) => ({
        value: project,
        label: project,
        count: count((task) => task.project === project),
        icon: Folder,
        iconClass: "text-purple-400",
      })),
    ];

    const labelOptions: MenuOption[] = [
      {
        value: "all",
        label: t("page__filter_category_all"),
        count: tasks.length,
        icon: Tag,
        iconClass: "text-muted-foreground",
      },
      ...categories.map((category) => ({
        value: category,
        label: category,
        count: count((task) => task.category === category),
        icon: Tag,
        iconClass: "text-indigo-400",
      })),
    ];

    const dueDateOptions: MenuOption[] = [
      {
        value: "all",
        label: t("page__filter_due_date_all"),
        count: tasks.length,
        icon: Calendar,
        iconClass: "text-muted-foreground",
      },
      {
        value: "no_dates",
        label: t("page__filter_due_date_no_dates"),
        count: count((task) => dueDateMatches(task, "no_dates")),
        icon: Calendar,
        iconClass: "text-slate-400",
      },
      {
        value: "overdue",
        label: t("page__filter_due_date_overdue"),
        count: count((task) => dueDateMatches(task, "overdue")),
        icon: Clock3,
        iconClass: "text-destructive",
      },
      {
        value: "next_day",
        label: t("page__filter_due_date_next_day"),
        count: count((task) => dueDateMatches(task, "next_day")),
        icon: Calendar,
        iconClass: "text-blue-400",
      },
      {
        value: "next_week",
        label: t("page__filter_due_date_next_week"),
        count: count((task) => dueDateMatches(task, "next_week")),
        icon: Calendar,
        iconClass: "text-blue-400",
      },
      {
        value: "next_month",
        label: t("page__filter_due_date_next_month"),
        count: count((task) => dueDateMatches(task, "next_month")),
        icon: Calendar,
        iconClass: "text-blue-400",
      },
    ];

    const sprintOptions: MenuOption[] = [
      {
        value: "all",
        label: t("page__filter_sprint_all"),
        count: tasks.length,
        icon: Zap,
        iconClass: "text-muted-foreground",
      },
      {
        value: null,
        label: t("page__filter_sprint_none"),
        count: count((task) => sprintMatches(task, null)),
        icon: Zap,
        iconClass: "text-slate-400",
      },
      ...sprints
        .filter((sprint) => sprint.id !== undefined)
        .map((sprint) => ({
          value: sprint.id!,
          label: sprint.name,
          count: count((task) => sprintMatches(task, sprint.id!)),
          icon: Zap,
          iconClass: sprint.status === "active" ? "text-success" : "text-amber-400",
        })),
    ];

    return [
      {
        id: "status",
        label: t("page__filter_status"),
        icon: CircleDot,
        value: filters.status ?? "all",
        options: statusOptions,
      },
      { id: "priority", label: "Priority", icon: Zap, value: filters.priority ?? "all", options: priorityOptions },
      {
        id: "assignee",
        label: t("page__filter_assignee"),
        icon: User,
        value: filters.assignee_id ?? "all",
        options: assigneeOptions,
      },
      {
        id: "project",
        label: t("page__filter_project"),
        icon: Folder,
        value: filters.project ?? "all",
        options: projectOptions,
      },
      { id: "label", label: "Label", icon: Tag, value: filters.category ?? "all", options: labelOptions },
      {
        id: "dueDate",
        label: t("page__filter_due_date"),
        icon: Calendar,
        value: filters.dueDatePreset ?? "all",
        options: dueDateOptions,
      },
      {
        id: "sprint",
        label: t("page__filter_sprint"),
        icon: Zap,
        value: filters.sprint_id ?? "all",
        options: sprintOptions,
      },
    ];
  }, [t, tasks, categories, projects, assignees, sprints, myAssigneeId, filters]);

  const active = activeGroup ? groups.find((group) => group.id === activeGroup) : undefined;

  function selectOption(value: FilterValue) {
    switch (activeGroup) {
      case "status":
        return onFiltersChange({ ...filters, status: value as FilterOptions["status"] });
      case "priority":
        return onFiltersChange({ ...filters, priority: value as FilterOptions["priority"] });
      case "assignee":
        return onFiltersChange({ ...filters, assignee_id: value as FilterOptions["assignee_id"] });
      case "project":
        return onFiltersChange({ ...filters, project: value as FilterOptions["project"] });
      case "label":
        return onFiltersChange({ ...filters, category: value as FilterOptions["category"] });
      case "dueDate":
        return onFiltersChange({ ...filters, dueDatePreset: value as FilterOptions["dueDatePreset"] });
      case "sprint":
        return onFiltersChange({ ...filters, sprint_id: value as FilterOptions["sprint_id"] });
    }
  }

  return (
    <div
      onMouseLeave={() => setActiveGroup(null)}
      className="inline-flex overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
    >
      <div className="w-40 border-r p-1">
        {groups.map((group) => {
          const GroupIcon = group.icon;
          return (
            <button
              key={group.id}
              type="button"
              onMouseEnter={() => setActiveGroup(group.id)}
              onFocus={() => setActiveGroup(group.id)}
              onClick={() => setActiveGroup(group.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                activeGroup === group.id && "bg-accent",
              )}
            >
              <GroupIcon size={14} className="shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{group.label}</span>
              {!sameValue(group.value, "all") && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
              <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
            </button>
          );
        })}

        <div className="-mx-1 my-1 h-px bg-border" />
        <button
          type="button"
          onClick={onClearFilters}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Trash2 size={14} className="shrink-0" />
          <span className="flex-1 truncate">{t("page__btn_clear")}</span>
        </button>
      </div>

      {active && (
        <div className="max-h-80 w-52 overflow-y-auto p-1">
          {active.options.map((option) => {
            const OptionIcon = option.icon;
            const selected = sameValue(active.value, option.value);
            return (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => selectOption(option.value)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {option.dotColor ? (
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: option.dotColor }} />
                  ) : (
                    OptionIcon && <OptionIcon size={15} className={option.iconClass || "text-muted-foreground"} />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{option.count}</span>
                {selected && <Check size={13} className="shrink-0 text-muted-foreground" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
