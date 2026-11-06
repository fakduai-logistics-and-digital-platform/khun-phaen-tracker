import {
  AlertCircle,
  Ban,
  Check,
  CheckCircle2,
  CircleDashed,
  History,
  ListChecks,
  MinusCircle,
  SignalHigh,
  SignalLow,
  SignalMedium,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { translate } from "@/lib/i18n";
import type { TestCasePriority } from "./tc-types";

/** Label resolved at read time so option lists follow the active locale. */
function tr<T extends object>(key: string, rest: T): T & { label: string } {
  return Object.defineProperty({ ...rest }, "label", { get: () => translate(key), enumerable: true }) as T & {
    label: string;
  };
}

export const fieldOptions = [
  tr("tcopt__field_all", { value: "all" }),
  tr("tcopt__field_test_no", { value: "test_no" }),
  tr("tcopt__field_name", { value: "name" }),
  tr("tcopt__field_suite", { value: "suite" }),
  tr("tcopt__field_description", { value: "description" }),
  tr("tcopt__field_preconditions", { value: "preconditions" }),
  tr("tcopt__field_postconditions", { value: "postconditions" }),
  tr("tcopt__field_custom_fields", { value: "custom_fields" }),
  tr("tcopt__field_comments", { value: "comments" }),
  tr("tcopt__field_steps", { value: "steps" }),
];

export const priorityOptions = [
  tr("tcopt__priority_high", {
    value: "high",
    icon: SignalHigh,
    iconClass: "text-white",
    pillClass: "bg-orange-600 text-white px-1.5 py-0.5 rounded shadow-sm border border-orange-700",
  }),
  tr("tcopt__priority_medium", {
    value: "medium",
    icon: SignalMedium,
    iconClass: "text-orange-600 dark:text-orange-400",
    pillClass:
      "bg-orange-900/40 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded border border-orange-900/50",
  }),
  tr("tcopt__priority_low", {
    value: "low",
    icon: SignalLow,
    iconClass: "text-muted-foreground",
    pillClass: "bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border",
  }),
];

type PriorityTone = { button: string; menu: string; dot: string; icon: LucideIcon };

const priorityTone: Record<TestCasePriority, PriorityTone> = {
  high: {
    button: "bg-orange-600 text-white border-orange-700 shadow-sm",
    menu: "text-orange-600 dark:text-orange-400",
    dot: "bg-orange-600",
    icon: SignalHigh,
  },
  medium: {
    button: "bg-orange-900/40 text-orange-600 dark:text-orange-400 border-orange-900/50",
    menu: "text-orange-600 dark:text-orange-400",
    dot: "bg-orange-400",
    icon: SignalMedium,
  },
  low: {
    button: "bg-muted text-muted-foreground border-border",
    menu: "text-muted-foreground",
    dot: "bg-muted-foreground",
    icon: SignalLow,
  },
};

export function getPriorityMeta(priority: string | null | undefined): PriorityTone {
  return priorityTone[(priority || "medium") as TestCasePriority] || priorityTone.medium;
}

export function getPriorityLabel(priority: string | null | undefined) {
  return priorityOptions.find((o) => o.value === priority)?.label || translate("tcopt__priority_medium");
}

export const statusOptions = [
  tr("tcopt__status_draft", {
    value: "draft",
    icon: CircleDashed,
    iconClass: "text-slate-400",
    pillClass: "text-slate-400 dark:text-slate-300 font-medium",
  }),
  tr("tcopt__status_actual", {
    value: "actual",
    icon: ListChecks,
    iconClass: "text-blue-400",
    pillClass: "text-blue-500 dark:text-blue-400 font-medium",
  }),
  tr("tcopt__status_passed", {
    value: "passed",
    icon: CheckCircle2,
    iconClass: "text-emerald-400",
    pillClass: "text-emerald-500 dark:text-emerald-400 font-medium",
  }),
  tr("tcopt__status_failed", {
    value: "failed",
    icon: XCircle,
    iconClass: "text-red-400",
    pillClass: "text-red-500 dark:text-red-400 font-medium",
  }),
  tr("tcopt__status_blocked", {
    value: "blocked",
    icon: Ban,
    iconClass: "text-orange-400",
    pillClass: "text-orange-500 dark:text-orange-400 font-medium",
  }),
  tr("tcopt__status_deprecated", {
    value: "deprecated",
    icon: History,
    iconClass: "text-slate-500",
    pillClass: "text-slate-400 dark:text-slate-500 font-medium",
  }),
];

export const fixedOptions = [
  tr("tcopt__fixed_no", { value: "no", icon: AlertCircle, iconClass: "text-amber-400" }),
  tr("tcopt__fixed_yes", { value: "yes", icon: Check, iconClass: "text-green-400" }),
];

export const stepFormatOptions = [
  { value: "classic", label: "Classic" },
  { value: "gherkin", label: "Gherkin" },
];

export const filterProperties = [
  tr("tcopt__prop_priority", { id: "priority" }),
  tr("tcopt__prop_status", { id: "status" }),
  tr("tcopt__prop_fixed", { id: "fixed" }),
  tr("tcopt__prop_assign_dev", { id: "assign_dev" }),
];

export const testRunFilterProperties = [
  tr("tcopt__prop_priority", { id: "priority" }),
  tr("tcopt__prop_status", { id: "status" }),
];

export const osOptions = [
  { value: "", label: "Select value" },
  { value: "windows", label: "Windows" },
  { value: "macos", label: "macOS" },
  { value: "linux", label: "Linux" },
  { value: "ios", label: "iOS" },
  { value: "android", label: "Android" },
  { value: "other", label: "Other" },
];

export const RUN_CASE_STATUSES = [
  tr("tcopt__run_pending", { value: "pending", icon: CircleDashed, iconClass: "text-slate-400" }),
  tr("tcopt__status_passed", { value: "passed", icon: CheckCircle2, iconClass: "text-emerald-500" }),
  tr("tcopt__status_failed", { value: "failed", icon: XCircle, iconClass: "text-red-500" }),
  tr("tcopt__status_blocked", { value: "blocked", icon: Ban, iconClass: "text-orange-500" }),
  tr("tcopt__run_skipped", { value: "skipped", icon: MinusCircle, iconClass: "text-blue-400" }),
  tr("tcopt__run_invalid", { value: "invalid", icon: AlertCircle, iconClass: "text-purple-500" }),
];

export const RUN_ROW_TONE: Record<string, string> = {
  passed: "border-l-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10",
  failed: "border-l-red-500 bg-red-500/5 hover:bg-red-500/10",
  blocked: "border-l-orange-500 bg-orange-500/5 hover:bg-orange-500/10",
  skipped: "border-l-blue-400 bg-blue-400/5 hover:bg-blue-400/10",
  invalid: "border-l-purple-500 bg-purple-500/5 hover:bg-purple-500/10",
};

export const PROPERTY_SELECT = "tc-prop-select";

export function filterOptionsFor(
  property: string,
  assigneeOptions: { value: string; label: string }[],
): { value: string; label: string }[] {
  if (property === "priority") return priorityOptions;
  if (property === "status") return statusOptions;
  if (property === "fixed") return fixedOptions;
  if (property === "assign_dev") return assigneeOptions;
  return [];
}
