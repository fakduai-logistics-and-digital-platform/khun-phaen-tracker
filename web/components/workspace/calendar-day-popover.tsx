"use client";

import { forwardRef } from "react";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { useI18n } from "@/lib/i18n";
import th from "@/lib/i18n/locales/th.json";
import en from "@/lib/i18n/locales/en.json";
import { useStore } from "@/lib/store";
import { currentWorkspaceShortName } from "@/lib/stores/workspace";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const SHORT_MONTHS: Record<string, string[]> = {
  th: th["calendarView__short_months"],
  en: en["calendarView__short_months"],
};

function truncate(text: string, max = 95) {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

function getStatusVariant(status: Task["status"]) {
  if (status === "in-progress") return "default";
  if (status === "done") return "secondary";
  return "outline";
}

export interface CalendarDayPopoverProps {
  date: string;
  tasks: Task[];
  position: { top: number; left: number };
  placement: "top" | "bottom";
  arrowLeft: number;
  onSelectTask?: (task: Task) => void;
}

export const CalendarDayPopover = forwardRef<HTMLDivElement, CalendarDayPopoverProps>(function CalendarDayPopover(
  { date, tasks, position, placement, arrowLeft, onSelectTask },
  ref,
) {
  const { t, locale } = useI18n();
  const shortName = useStore(currentWorkspaceShortName);
  const isThai = locale.startsWith("th");

  const formatPopoverDate = (dateText: string) => {
    const d = new Date(dateText);
    const monthText = (SHORT_MONTHS[locale] ?? SHORT_MONTHS.th)[d.getMonth()] || "";
    const displayYear = isThai ? d.getFullYear() + 543 : d.getFullYear();
    return `${d.getDate()} ${monthText} ${displayYear}`;
  };

  const getStatusLabel = (status: Task["status"]) => {
    switch (status) {
      case "in-progress":
        return t("page__filter_status_in_progress");
      case "in-test":
        return t("page__filter_status_in_test");
      case "done":
        return t("page__filter_status_done");
      default:
        return t("page__filter_status_todo");
    }
  };

  return (
    <div
      ref={ref}
      className="absolute z-20 w-[320px] max-w-[calc(100%-24px)]"
      style={{ top: position.top, left: position.left }}
    >
      <div className="relative flex flex-col gap-3 rounded-xl border bg-popover p-3 text-popover-foreground shadow-md">
        <div
          className={cn(
            "absolute size-3 rotate-45 bg-popover",
            placement === "bottom" ? "-top-1.5 border-t border-l" : "-bottom-1.5 border-r border-b",
          )}
          style={{ left: arrowLeft }}
        />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{t("calendarView__popover_title")}</p>
            <p className="text-base font-semibold">{formatPopoverDate(date)}</p>
          </div>
          <Badge variant="secondary">{t("calendarView__items_count", { count: tasks.length })}</Badge>
        </div>

        <div className="flex max-h-48 flex-col gap-2 overflow-auto">
          {tasks.map((task) => (
            <button
              key={String(task.id)}
              type="button"
              onClick={() => onSelectTask?.(task)}
              className="flex w-full flex-col gap-1 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent/50"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {task.priority && task.priority !== "none" && <PriorityBadge priority={task.priority} />}
                  <div className="truncate text-sm font-medium">
                    {task.task_number && (
                      <span className="mr-1.5 text-xs whitespace-nowrap text-muted-foreground">
                        {task.workspace_short_name || shortName || "TASK"}-{task.task_number}
                      </span>
                    )}
                    {task.title}
                  </div>
                </div>
                <span className="flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                  <Clock className="size-3" />
                  {Math.floor(task.duration_minutes / 60)}:{String(task.duration_minutes % 60).padStart(2, "0")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getStatusVariant(task.status)}>{getStatusLabel(task.status)}</Badge>
                {task.category && <span className="text-xs text-muted-foreground">{task.category}</span>}
              </div>
              {task.notes && <p className="text-xs leading-snug text-muted-foreground">{truncate(task.notes)}</p>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
