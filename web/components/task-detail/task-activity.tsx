"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import type { TaskActivityChange, TaskActivityEntry } from "@/lib/types";
import { getStatusLabel } from "@/components/workspace/table-view-config";
import { tOr } from "@/components/workspace/t-or";

type Translate = ReturnType<typeof useI18n>["t"];

const FIELD_LABEL: Record<string, string> = {
  title: "taskActivity__field_title",
  status: "taskActivity__field_status",
  priority: "taskActivity__field_priority",
  category: "taskActivity__field_category",
  task_type: "taskActivity__field_task_type",
  project: "taskActivity__field_project",
  assignee_ids: "taskActivity__field_assignees",
  sprint_id: "taskActivity__field_sprint",
  start_date: "taskActivity__field_start_date",
  due_date: "taskActivity__field_due_date",
  duration_minutes: "taskActivity__field_duration",
  notes: "taskActivity__field_notes",
  checklist: "taskActivity__field_checklist",
  links: "taskActivity__field_links",
  testcase_id: "taskActivity__field_test_case",
  is_archived: "taskActivity__field_archived",
};

function valueText(
  change: TaskActivityChange,
  side: "from" | "to",
  t: Translate,
) {
  const value = String(change[side] ?? "");
  if (change.field === "status") return getStatusLabel(value as never, t);
  if (change.field === "priority") return tOr(t, `priority__${value}`, value);
  return value;
}

function changeText(change: TaskActivityChange, t: Translate) {
  const field = t(FIELD_LABEL[change.field] ?? "taskActivity__field_other");
  if (change.field === "is_archived") {
    return change.to
      ? t("taskActivity__archived")
      : t("taskActivity__restored");
  }
  // Notes, checklists and links are too large to list, so only the fact that they changed is stored.
  if (change.from === null || change.to === null)
    return t("taskActivity__edited", { field });
  const from = valueText(change, "from", t);
  const to = valueText(change, "to", t);
  if (!from) return t("taskActivity__set", { field, to });
  if (!to) return t("taskActivity__cleared", { field, from });
  return t("taskActivity__changed", { field, from, to });
}

function formatTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

export function ActivityDetailsToggle({
  shown,
  onToggle,
}: {
  shown: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      aria-pressed={shown}
      onClick={onToggle}
    >
      {shown
        ? t("taskActivity__hide_details")
        : t("taskActivity__show_details")}
    </Button>
  );
}

/** One line per change, newest first; the server returns entries already in that order. */
export function TaskActivityList({
  entries,
}: {
  entries: TaskActivityEntry[];
}) {
  const { t } = useI18n();
  const rows = entries.flatMap((entry, i) => {
    const lines =
      entry.action === "create"
        ? [t("taskActivity__created")]
        : entry.changes.map((c) => changeText(c, t));
    return lines.map((line, j) => ({
      key: `${entry.id ?? i}-${j}`,
      entry,
      line,
    }));
  });
  if (rows.length === 0) return null;

  return (
    <ul className="flex flex-col gap-3">
      {rows.map(({ key, entry, line }) => (
        <li key={key} className="flex items-start gap-3 text-sm">
          <Avatar className="size-7">
            <AvatarFallback className="bg-muted text-xs font-medium">
              {entry.user_name?.[0]?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <p className="break-words">
              <span className="font-medium">
                {entry.user_name || t("taskActivity__someone")}
              </span>{" "}
              {line}
            </p>
            <time dateTime={entry.at} className="text-xs text-muted-foreground">
              {formatTime(entry.at)}
            </time>
          </div>
        </li>
      ))}
    </ul>
  );
}
