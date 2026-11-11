import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  FlaskConical,
  Minus,
  PlayCircle,
  SignalHigh,
  SignalLow,
  SignalMedium,
  type LucideIcon,
  BadgeCheck,
} from "lucide-react";
import type { Task } from "@/lib/types";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export type PriorityValue = "urgent" | "high" | "medium" | "low" | "none";

export const PRIORITY_OPTIONS: { value: PriorityValue; label: string; icon: LucideIcon; colorClass: string }[] = [
  { value: "urgent", label: "Urgent", icon: AlertTriangle, colorClass: "text-orange-500" },
  { value: "high", label: "High", icon: SignalHigh, colorClass: "text-orange-600" },
  { value: "medium", label: "Medium", icon: SignalMedium, colorClass: "text-yellow-500" },
  { value: "low", label: "Low", icon: SignalLow, colorClass: "text-gray-400" },
  { value: "none", label: "None", icon: Minus, colorClass: "text-gray-300" },
];

export const STATUS_OPTIONS: { value: Task["status"]; labelKey: string; icon: LucideIcon; colorClass: string }[] = [
  { value: "pending", labelKey: "page__filter_status_pending", icon: Circle, colorClass: "text-slate-500" },
  { value: "in-progress", labelKey: "page__filter_status_in_progress", icon: PlayCircle, colorClass: "text-blue-500" },
  { value: "in-test", labelKey: "page__filter_status_in_test", icon: FlaskConical, colorClass: "text-purple-500" },
  { value: "tested", labelKey: "page__filter_status_tested", icon: BadgeCheck, colorClass: "text-teal-500" },
  { value: "done", labelKey: "page__filter_status_done", icon: CheckCircle2, colorClass: "text-green-500" },
];

export type SortColumn =
  "priority" | "title" | "project" | "date" | "status" | "category" | "assignee" | "updated_at" | "created_at";
export type SortDirection = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };

export function dueDateOf(task: Task) {
  return task.due_date || task.end_date || "";
}

/** Ascending comparison of two tasks by one column; callers flip the sign for descending. */
export function compareTasks(a: Task, b: Task, column: SortColumn) {
  let aVal: string | number;
  let bVal: string | number;

  switch (column) {
    case "priority":
      aVal = PRIORITY_ORDER[a.priority || "none"] ?? 0;
      bVal = PRIORITY_ORDER[b.priority || "none"] ?? 0;
      break;
    case "assignee":
      aVal = a.assignees && a.assignees.length > 0 ? a.assignees[0].name : "";
      bVal = b.assignees && b.assignees.length > 0 ? b.assignees[0].name : "";
      break;
    case "updated_at":
      aVal = a.updated_at || "";
      bVal = b.updated_at || "";
      break;
    case "created_at":
      aVal = a.created_at || "";
      bVal = b.created_at || "";
      break;
    case "date":
      aVal = dueDateOf(a);
      bVal = dueDateOf(b);
      break;
    default:
      aVal = ((a as unknown as Record<string, string>)[column] as string) || "";
      bVal = ((b as unknown as Record<string, string>)[column] as string) || "";
  }

  if (typeof aVal === "string") {
    aVal = aVal.toLowerCase();
    bVal = (bVal as string).toLowerCase();
  }
  if (aVal === bVal) return 0;
  return aVal > bVal ? 1 : -1;
}

export function isOverdue(dateStr: string, status: Task["status"], isArchived = false) {
  if (status === "done" || isArchived) return false;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

export function getStatusIcon(status: Task["status"]): LucideIcon {
  switch (status) {
    case "done":
      return CheckCircle2;
    case "in-progress":
      return PlayCircle;
    case "in-test":
      return FlaskConical;
    case "tested":
      return BadgeCheck;
    default:
      return Circle;
  }
}

export function getStatusClass(status: Task["status"], isArchived = false) {
  if (isArchived) return "text-muted-foreground bg-muted";
  switch (status) {
    case "pending":
      return "text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900/30";
    case "done":
      return "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20";
    case "in-progress":
      return "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20";
    case "in-test":
      return "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20";
    case "tested":
      return "text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20";
    default:
      return "text-muted-foreground bg-muted/50";
  }
}

export function getStatusLabel(status: Task["status"], t: Translate, isArchived = false) {
  if (isArchived) return t("taskList__archived");
  switch (status) {
    case "pending":
      return t("page__filter_status_pending");
    case "in-progress":
      return t("page__filter_status_in_progress");
    case "in-test":
      return t("page__filter_status_in_test");
    case "tested":
      return t("page__filter_status_tested");
    case "done":
      return t("page__filter_status_done");
    default:
      return t("page__filter_status_todo");
  }
}

export function getStatusShort(status: Task["status"], t: Translate) {
  switch (status) {
    case "pending":
      return t("tableView__status_short_pending");
    case "in-progress":
      return t("tableView__status_short_in_progress");
    case "in-test":
      return t("tableView__status_short_in_test");
    case "tested":
      return t("tableView__status_short_tested");
    case "done":
      return t("tableView__status_short_done");
    default:
      return t("tableView__status_short_todo");
  }
}

export function formatDate(dateStr: string, todayLabel: string) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (date.toDateString() === new Date().toDateString()) return todayLabel;
  return date.toLocaleDateString("th-TH", { month: "short", day: "numeric" });
}

export function formatDateFull(dateStr: string) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
}

export function formatDuration(minutes: number) {
  if (!minutes || minutes === 0) return "-";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}ชม ${mins}น`;
  if (hours > 0) return `${hours}ชม`;
  return `${mins}น`;
}
