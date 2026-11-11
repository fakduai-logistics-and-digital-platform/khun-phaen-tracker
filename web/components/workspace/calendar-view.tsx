"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import en from "@/lib/i18n/locales/en.json";
import th from "@/lib/i18n/locales/th.json";
import { useStore } from "@/lib/store";
import { currentWorkspaceShortName } from "@/lib/stores/workspace";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CalendarDayPopover } from "./calendar-day-popover";

const CALENDAR_STATE_STORAGE_KEY = "calendar-view-state-v1";
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const MONTHS: Record<string, string[]> = {
  th: th["calendarView__months"],
  en: en["calendarView__months"],
};

function restoreCalendarState(): { currentDate: Date; selectedDate: string | null } {
  const fallback = { currentDate: new Date(), selectedDate: null };
  if (typeof localStorage === "undefined") return fallback;
  const raw = localStorage.getItem(CALENDAR_STATE_STORAGE_KEY);
  if (!raw) return fallback;
  try {
    const saved = JSON.parse(raw) as { currentMonth?: string; selectedDate?: string | null };
    const restored = saved.currentMonth ? new Date(saved.currentMonth) : null;
    return {
      currentDate: restored && !Number.isNaN(restored.getTime()) ? restored : fallback.currentDate,
      selectedDate: saved.selectedDate || null,
    };
  } catch {
    localStorage.removeItem(CALENDAR_STATE_STORAGE_KEY);
    return fallback;
  }
}

function normalizeDateKey(dateText: string) {
  const isoMatch = dateText.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) return dateText;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface CalendarViewProps {
  tasks?: Task[];
  onSelectTask?: (task: Task) => void;
}

export function CalendarView({ tasks = [], onSelectTask }: CalendarViewProps) {
  const { t, locale } = useI18n();
  const shortName = useStore(currentWorkspaceShortName);
  const [initial] = useState(restoreCalendarState);
  const [currentDate, setCurrentDate] = useState(initial.currentDate);
  const [selectedDate, setSelectedDate] = useState<string | null>(initial.selectedDate);
  const [popover, setPopover] = useState({ top: 0, left: 0, placement: "bottom" as "top" | "bottom", arrowLeft: 28 });
  const selectedCellRef = useRef<HTMLElement | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const isThai = locale.startsWith("th");
  const monthNames = MONTHS[locale] ?? MONTHS.th;

  const tasksByDate = useMemo(() => {
    const acc: Record<string, Task[]> = {};
    for (const task of tasks) {
      if (!task.date) continue;
      const key = normalizeDateKey(task.date);
      (acc[key] ||= []).push(task);
    }
    return acc;
  }, [tasks]);

  const selectedDateTasks = selectedDate ? tasksByDate[selectedDate] || [] : [];

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(
      CALENDAR_STATE_STORAGE_KEY,
      JSON.stringify({
        currentMonth: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString(),
        selectedDate,
      }),
    );
  }, [currentDate, selectedDate]);

  const updatePopoverPosition = useCallback(() => {
    const cell = selectedCellRef.current;
    const container = gridRef.current;
    if (!cell || !container) return;

    const cellRect = cell.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const popoverWidth = popoverRef.current?.offsetWidth || 320;
    const popoverHeight = popoverRef.current?.offsetHeight || 320;
    const offset = 10;

    const belowTop = cellRect.top - containerRect.top + cellRect.height + offset;
    const aboveTop = cellRect.top - containerRect.top - popoverHeight - offset;
    const availableBelow = containerRect.bottom - cellRect.bottom;
    const availableAbove = cellRect.top - containerRect.top;

    let placement: "top" | "bottom" = "bottom";
    let top = belowTop;
    if (availableBelow < popoverHeight && availableAbove > availableBelow) {
      placement = "top";
      top = aboveTop;
    }

    const maxTop = containerRect.height - popoverHeight - 8;
    if (top < 8) top = 8;
    if (top > maxTop) top = Math.max(8, maxTop);

    let left = cellRect.left - containerRect.left - 8;
    const maxLeft = containerRect.width - popoverWidth - 12;
    if (left > maxLeft) left = maxLeft;
    if (left < 12) left = 12;

    const cellCenter = cellRect.left - containerRect.left + cellRect.width / 2;
    const arrowLeft = Math.min(Math.max(cellCenter - left, 18), popoverWidth - 18);

    setPopover({ top, left, placement, arrowLeft });
  }, []);

  useLayoutEffect(() => {
    if (selectedDate && selectedDateTasks.length > 0) updatePopoverPosition();
  }, [selectedDate, selectedDateTasks.length, updatePopoverPosition]);

  useEffect(() => {
    if (!selectedDate) return;
    window.addEventListener("resize", updatePopoverPosition);
    return () => window.removeEventListener("resize", updatePopoverPosition);
  }, [selectedDate, updatePopoverPosition]);

  const getDateKey = (day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const formatDuration = (minutes: number) => {
    if (minutes === 0) return "";
    const mandays = minutes / 60 / 8;
    if (mandays >= 0.125) return mandays.toFixed(2);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}${t("statsPanel__hours_short")}`;
    return `${m}${t("statsPanel__minutes_short")}`;
  };

  function selectDate(date: string, cell: HTMLElement) {
    if ((tasksByDate[date] || []).length === 0 || selectedDate === date) {
      setSelectedDate(null);
      selectedCellRef.current = null;
      return;
    }
    selectedCellRef.current = cell;
    setSelectedDate(date);
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarIcon className="size-5 text-muted-foreground" />
          {monthNames[month] || ""} {isThai ? year + 543 : year}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            aria-label={t("calendarView__prev_month")}
          >
            <ChevronLeft />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            {t("calendarView__today")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            aria-label={t("calendarView__next_month")}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div ref={gridRef} className="relative overflow-visible rounded-xl border bg-card shadow-sm">
        <div className="grid grid-cols-7 border-b">
          {DAY_KEYS.map((dayKey) => (
            <div key={dayKey} className="py-2 text-center text-sm font-medium text-muted-foreground">
              {t(`calendarView__day_${dayKey}`)}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: firstDayOfMonth }, (_, i) => (
            <div key={`blank-${i}`} className="aspect-square border-r border-b bg-muted/40" />
          ))}

          {Array.from({ length: daysInMonth }, (_, dayIndex) => {
            const day = dayIndex + 1;
            const dateKey = getDateKey(day);
            const dayTasks = tasksByDate[dateKey] || [];
            const totalMinutes = dayTasks.reduce((sum, task) => sum + task.duration_minutes, 0);
            const isToday = dateKey === today;
            const isSelected = selectedDate === dateKey;

            return (
              <button
                key={dateKey}
                type="button"
                onClick={(event) => selectDate(dateKey, event.currentTarget)}
                aria-pressed={isSelected}
                className={cn(
                  "relative aspect-square border-r border-b p-1.5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset",
                  isSelected && "bg-accent",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isToday
                        ? "flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                        : "text-foreground",
                    )}
                  >
                    {day}
                  </span>
                  {totalMinutes > 0 && (
                    <span className="text-xs font-medium text-success">{formatDuration(totalMinutes)}</span>
                  )}
                </div>

                {dayTasks.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {dayTasks.slice(0, 3).map((task) => (
                      <div
                        key={String(task.id)}
                        className={cn(
                          "h-1.5 min-w-0 flex-1 rounded-full",
                          task.status === "done"
                            ? "bg-success"
                            : task.status === "in-progress"
                              ? "bg-primary"
                              : task.status === "in-test"
                                ? "bg-warning"
                                : task.status === "tested"
                                  ? "bg-teal-500"
                                  : "bg-muted-foreground",
                        )}
                        title={`${task.priority && task.priority !== "none" ? `${task.priority} ` : ""}${task.workspace_short_name || shortName || "TASK"}-${task.task_number} ${task.title}`}
                      />
                    ))}
                    {dayTasks.length > 3 && (
                      <span className="text-xs text-muted-foreground">+{dayTasks.length - 3}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {selectedDate && selectedDateTasks.length > 0 && (
          <CalendarDayPopover
            ref={popoverRef}
            date={selectedDate}
            tasks={selectedDateTasks}
            position={{ top: popover.top, left: popover.left }}
            placement={popover.placement}
            arrowLeft={popover.arrowLeft}
            onSelectTask={onSelectTask}
          />
        )}
      </div>
    </div>
  );
}
