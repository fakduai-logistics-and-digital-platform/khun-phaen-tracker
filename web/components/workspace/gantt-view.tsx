"use client";

import { useCallback, useMemo, useState } from "react";
import { Flag, Folder, Pencil } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { SearchableSprintSelect } from "@/components/shared/searchable-sprint-select";
import { useI18n } from "@/lib/i18n";
import en from "@/lib/i18n/locales/en.json";
import th from "@/lib/i18n/locales/th.json";
import { useStore } from "@/lib/store";
import { currentWorkspaceShortName } from "@/lib/stores/workspace";
import type { Sprint, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 40;
const DAY_WIDTH = 40;
const SIDEBAR_WIDTH = 250;
const PADDING_DAYS = 7;
const DAY_MS = 1000 * 60 * 60 * 24;
const LAST_GROUP_KEYS = ["Unassigned", "No Sprint", "Unknown Sprint", "No Project"];
const MONTHS_SHORT: Record<string, string[]> = {
  th: th["ganttView__months_short"],
  en: en["ganttView__months_short"],
};

type GroupBy = "project" | "sprint";
type ParsedTask = Task & { _start: Date; _end: Date };

function normalizeDate(dateStr?: string) {
  if (!dateStr) return new Date();
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getDates(start: Date, end: Date) {
  const dates: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export interface GanttViewProps {
  tasks?: Task[];
  sprints?: Sprint[];
  onEdit?: (task: Task) => void;
}

export function GanttView({ tasks = [], sprints = [], onEdit }: GanttViewProps) {
  const { t, locale } = useI18n();
  const shortName = useStore(currentWorkspaceShortName);
  const [groupBy, setGroupBy] = useState<GroupBy>("project");
  const [selectedSprintId, setSelectedSprintId] = useState<string | number | "all" | null>("all");
  const monthsShort = MONTHS_SHORT[locale] ?? MONTHS_SHORT.th;

  const parsedTasks = useMemo<ParsedTask[]>(() => {
    return tasks
      .filter((task) => {
        if (selectedSprintId === "all") return true;
        if (selectedSprintId === null) return task.sprint_id === null;
        return task.sprint_id === selectedSprintId;
      })
      .map((task) => {
        const start = normalizeDate(task.date);
        let end = task.end_date ? normalizeDate(task.end_date) : new Date(start);
        if (end < start) end = new Date(start);
        return { ...task, _start: start, _end: end };
      })
      .sort((a, b) => b._start.getTime() - a._start.getTime());
  }, [tasks, selectedSprintId]);

  const { minDate, timelineDates } = useMemo(() => {
    const min =
      parsedTasks.length > 0
        ? addDays(
            parsedTasks.reduce((m, task) => (task._start < m ? task._start : m), parsedTasks[0]._start),
            -PADDING_DAYS,
          )
        : addDays(new Date(), -PADDING_DAYS);
    const max =
      parsedTasks.length > 0
        ? addDays(
            parsedTasks.reduce((m, task) => (task._end > m ? task._end : m), parsedTasks[0]._end),
            PADDING_DAYS,
          )
        : addDays(new Date(), PADDING_DAYS);
    return { minDate: min, timelineDates: getDates(min, max) };
  }, [parsedTasks]);

  const totalWidth = timelineDates.length * DAY_WIDTH;

  const getSprintName = useCallback(
    (sprintId: string | number | null | undefined) => {
      if (!sprintId) return "No Sprint";
      const sprint = sprints.find((s) => String(s.id) === String(sprintId));
      return sprint ? sprint.name : "Unknown Sprint";
    },
    [sprints],
  );

  const getGroupDisplayName = (groupName: string) => {
    if (groupName === "Unassigned") return t("ganttView__unassigned_project");
    if (groupName === "No Sprint") return t("ganttView__unassigned_sprint");
    if (groupName === "Unknown Sprint") return t("ganttView__unknown_sprint");
    return groupName;
  };

  const groupedTasks = useMemo(() => {
    const groups: Record<string, ParsedTask[]> = {};
    for (const task of parsedTasks) {
      const key = groupBy === "project" ? task.project || "Unassigned" : getSprintName(task.sprint_id);
      (groups[key] ||= []).push(task);
    }
    return Object.entries(groups).sort((a, b) => {
      const aIsLast = LAST_GROUP_KEYS.some((k) => a[0].includes(k));
      const bIsLast = LAST_GROUP_KEYS.some((k) => b[0].includes(k));
      if (aIsLast && !bIsLast) return 1;
      if (!aIsLast && bIsLast) return -1;
      const aMax = Math.max(...a[1].map((task) => task._start.getTime()));
      const bMax = Math.max(...b[1].map((task) => task._start.getTime()));
      return bMax - aMax;
    });
  }, [parsedTasks, groupBy, getSprintName]);

  const getX = (date: Date) => Math.floor((date.getTime() - minDate.getTime()) / DAY_MS) * DAY_WIDTH;
  const getWidth = (start: Date, end: Date) => (Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1) * DAY_WIDTH;
  const taskLabel = (task: Task) =>
    `${task.workspace_short_name || shortName || "TASK"}-${task.task_number} ${task.title}`;
  const GroupIcon = groupBy === "project" ? Folder : Flag;

  const sidebarStyle = { width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH };
  const gridLines = (className: string) =>
    timelineDates.map((_, idx) => (
      <div
        key={idx}
        className={cn("pointer-events-none absolute top-0 bottom-0 border-r border-dashed", className)}
        style={{ left: (idx + 1) * DAY_WIDTH }}
      />
    ));

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <Tabs value={groupBy} onValueChange={(mode) => setGroupBy(mode as "project" | "sprint")}>
          <TabsList>
            {(["project", "sprint"] as const).map((mode) => {
              const Icon = mode === "project" ? Folder : Flag;
              return (
                <TabsTrigger key={mode} value={mode}>
                  <Icon />
                  {t(mode === "project" ? "ganttView__tab_project" : "ganttView__tab_sprint")}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-4">
          <div className="w-48">
            <SearchableSprintSelect
              sprints={sprints}
              value={selectedSprintId}
              onValueChange={setSelectedSprintId}
              id="gantt-sprint-filter"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {t("ganttView__tasks_count", { count: parsedTasks.length })}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="relative flex-1 overflow-auto">
          <div className="sticky top-0 z-20 flex border-b bg-muted">
            <div className="sticky left-0 z-30 border-r bg-muted p-3 text-sm font-medium" style={sidebarStyle}>
              {t("ganttView__task_name")}
            </div>
            <div className="flex" style={{ width: totalWidth }}>
              {timelineDates.map((date) => (
                <div
                  key={date.getTime()}
                  className="shrink-0 border-r p-2 text-center text-xs text-muted-foreground"
                  style={{ width: DAY_WIDTH }}
                >
                  <span className="block font-semibold">{date.getDate()}</span>
                  <span className="block text-xs">{monthsShort[date.getMonth()]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            {groupedTasks.map(([groupName, groupTasks]) => {
              const muted = ["Unassigned", "No Sprint"].includes(groupName);
              return (
                <div key={groupName}>
                  <div className="flex items-center border-b bg-muted/50">
                    <div
                      className="sticky left-0 z-10 flex items-center gap-2 border-r bg-muted/80 p-2 text-xs font-medium"
                      style={{ ...sidebarStyle, height: ROW_HEIGHT }}
                    >
                      <span
                        className={cn(
                          "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                          muted
                            ? "bg-muted text-muted-foreground"
                            : "border border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
                        )}
                      >
                        <GroupIcon size={10} />
                        {getGroupDisplayName(groupName)}
                      </span>
                    </div>
                    <div className="relative flex items-center" style={{ width: totalWidth, height: ROW_HEIGHT }}>
                      {gridLines("border-border/50")}
                    </div>
                  </div>

                  {groupTasks.map((task) => (
                    <div
                      key={String(task.id)}
                      className="group flex cursor-pointer items-center transition-colors hover:bg-accent/50"
                      onClick={() => onEdit?.(task)}
                      onKeyDown={(e) => {
                        if (e.target === e.currentTarget && e.key === "Enter") onEdit?.(task);
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div
                        className="sticky left-0 z-10 flex items-center justify-between truncate border-r bg-card p-3 text-sm group-hover:bg-accent"
                        style={{ ...sidebarStyle, height: ROW_HEIGHT }}
                      >
                        <div
                          className="flex min-w-0 flex-1 items-center gap-2"
                          title={`${task.priority && task.priority !== "none" ? `${task.priority} ` : ""}${taskLabel(task)}`}
                        >
                          {task.priority && task.priority !== "none" && <PriorityBadge priority={task.priority} />}
                          <span className="truncate font-medium">
                            {task.task_number && (
                              <span className="mr-1 text-xs font-medium text-muted-foreground">
                                {task.workspace_short_name || shortName || "TASK"}-{task.task_number}
                              </span>
                            )}
                            {task.title}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-blue-500 focus-visible:opacity-100"
                          aria-label="Edit task"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit?.(task);
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                      </div>

                      <div className="relative flex items-center" style={{ width: totalWidth, height: ROW_HEIGHT }}>
                        {gridLines("border-border/60")}
                        <div
                          className={cn(
                            "absolute flex cursor-pointer items-center truncate rounded px-2 text-xs text-white shadow-sm transition-opacity hover:opacity-90",
                            task.status === "done"
                              ? "bg-success"
                              : task.status === "in-progress"
                                ? "bg-blue-500"
                                : task.status === "in-test"
                                  ? "bg-purple-500"
                                  : "bg-gray-400",
                          )}
                          style={{
                            left: getX(task._start),
                            width: Math.max(getWidth(task._start, task._end), DAY_WIDTH - 4),
                            height: ROW_HEIGHT - 12,
                            marginLeft: 2,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit?.(task);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.stopPropagation();
                              onEdit?.(task);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          title={`${task.priority && task.priority !== "none" ? `${task.priority} ` : ""}${taskLabel(task)} (${task._start.toLocaleDateString()} - ${task._end.toLocaleDateString()})`}
                        >
                          {task.task_number
                            ? `${task.workspace_short_name || shortName || "TASK"}-${task.task_number} `
                            : ""}
                          {task.title}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
