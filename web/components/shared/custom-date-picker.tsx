"use client";

import { useMemo, useState } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import en from "@/lib/i18n/locales/en.json";
import th from "@/lib/i18n/locales/th.json";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useBindable } from "./use-bindable";

type CustomDatePickerProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  onSelect?: (value: string) => void;
  placeholder?: string;
  id?: string;
  minimal?: boolean;
  dropdownPosition?: "top" | "bottom";
};

type ViewMode = "days" | "months" | "years";
type CalendarDay = { date: number; month: number; year: number; isCurrentMonth: boolean };

const MONTHS = {
  th: { full: th.calendarView__months as string[], short: th.calendarView__short_months as string[] },
  en: { full: en.calendarView__months as string[], short: en.calendarView__short_months as string[] },
};
const DAY_NAMES = {
  th: ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"],
  en: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
};
const QUICK_LABELS = {
  th: { today: "วันนี้", tomorrow: "พรุ่งนี้", nextWeek: "สัปดาห์หน้า", month: "เลือกเดือน", year: "เลือกปี" },
  en: { today: "Today", tomorrow: "Tomorrow", nextWeek: "Next Week", month: "Select Month", year: "Select Year" },
};

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();

function getCalendarDays(currentMonth: number, currentYear: number): CalendarDay[] {
  const days: CalendarDay[] = [];
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const daysInPrevMonth = getDaysInMonth(prevMonth, prevYear);

  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({ date: daysInPrevMonth - i, month: prevMonth, year: prevYear, isCurrentMonth: false });
  }
  for (let i = 1; i <= getDaysInMonth(currentMonth, currentYear); i++) {
    days.push({ date: i, month: currentMonth, year: currentYear, isCurrentMonth: true });
  }
  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
  const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
  const remainingSlots = 42 - days.length;
  for (let i = 1; i <= remainingSlots; i++) {
    days.push({ date: i, month: nextMonth, year: nextYear, isCurrentMonth: false });
  }
  return days;
}

const isSameDay = (day: Pick<CalendarDay, "date" | "month" | "year">, date: Date | null) =>
  !!date && day.date === date.getDate() && day.month === date.getMonth() && day.year === date.getFullYear();

const ICON_BUTTON = "rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
const QUICK_BUTTON =
  "flex-1 rounded-lg bg-muted px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

export function CustomDatePicker({
  value: valueProp = "",
  onValueChange,
  onSelect,
  placeholder = "เลือกวันที่...",
  id = "date-picker",
  minimal = false,
  dropdownPosition = "bottom",
}: CustomDatePickerProps) {
  const { locale } = useI18n();
  const lang = locale === "th" ? "th" : "en";
  const yearOffset = lang === "th" ? 543 : 0;
  const [value, setValue] = useBindable(valueProp, onValueChange);
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [viewMode, setViewMode] = useState<ViewMode>("days");

  const { full: monthNames, short: shortMonthNames } = MONTHS[lang];
  const labels = QUICK_LABELS[lang];
  const selectedDate = value ? parseDate(value) : null;
  const displayValue = selectedDate
    ? `${selectedDate.getDate()} ${shortMonthNames[selectedDate.getMonth()]} ${selectedDate.getFullYear() + yearOffset}`
    : placeholder;
  const calendarDays = useMemo(() => getCalendarDays(currentMonth, currentYear), [currentMonth, currentYear]);
  const yearRange = Array.from({ length: 12 }, (_, i) => currentYear - 6 + i);

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (open && selectedDate) {
      setCurrentMonth(selectedDate.getMonth());
      setCurrentYear(selectedDate.getFullYear());
    }
    setViewMode("days");
  }

  function selectDate(date: Date) {
    const next = formatDate(date);
    setValue(next);
    setIsOpen(false);
    onSelect?.(next);
  }

  function selectRelativeDay(offsetDays: number) {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    selectDate(date);
  }

  function previousMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  }

  const headerButton = "text-sm font-medium text-foreground/90 transition-colors hover:text-foreground";
  const gridButton = (active: boolean) =>
    cn(
      "rounded-lg px-2 py-3 text-sm font-medium transition-colors duration-200",
      active ? "bg-primary text-primary-foreground " : "text-foreground/80 hover:bg-accent",
    );

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
      <div className={cn("relative", isOpen ? "z-[99999]" : "z-auto")}>
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            id={id}
            className={cn(
              "group flex w-full items-center justify-between rounded-lg border text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              minimal
                ? "h-8 border-transparent bg-transparent px-2.5 text-xs hover:bg-accent"
                : "h-10 border-input bg-background px-3",
            )}
          >
            <span className="flex items-center gap-2 truncate">
              {!minimal && (
                <Calendar size={16} className="text-muted-foreground transition-colors group-hover:text-primary" />
              )}
              <span className={value ? "text-foreground" : "text-muted-foreground"}>{displayValue}</span>
            </span>
            {!minimal && (
              <ChevronDown
                size={16}
                className={cn(
                  "ml-2 shrink-0 text-muted-foreground transition-transform duration-300",
                  isOpen && "rotate-180",
                )}
              />
            )}
          </button>
        </PopoverPrimitive.Trigger>
      </div>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={dropdownPosition}
          align="end"
          sideOffset={dropdownPosition === "top" ? 8 : 4}
          collisionPadding={4}
          className="z-[99999] w-64 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="border-b border-border px-4 py-2">
            <div className="flex items-center justify-between">
              {viewMode === "days" ? (
                <>
                  <button
                    type="button"
                    className={cn(headerButton, "flex items-center gap-1")}
                    onClick={() => setViewMode("months")}
                  >
                    {monthNames[currentMonth]}
                    <ChevronDown size={14} />
                  </button>
                  <button type="button" className={headerButton} onClick={() => setViewMode("years")}>
                    {currentYear + yearOffset}
                  </button>
                </>
              ) : viewMode === "months" ? (
                <>
                  <button type="button" className={headerButton} onClick={() => setViewMode("years")}>
                    {currentYear + yearOffset}
                  </button>
                  <span className="text-sm font-semibold">{labels.month}</span>
                </>
              ) : (
                <span className="text-sm font-semibold">{labels.year}</span>
              )}

              {viewMode === "days" && (
                <div className="flex gap-0.5">
                  <button type="button" className={ICON_BUTTON} onClick={previousMonth} aria-label="Previous month">
                    <ChevronLeft size={16} />
                  </button>
                  <button type="button" className={ICON_BUTTON} onClick={nextMonth} aria-label="Next month">
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {viewMode === "days" && (
            <>
              <div className="p-3">
                <div className="mb-2 grid grid-cols-7 gap-1">
                  {DAY_NAMES[lang].map((day) => (
                    <div key={day} className="py-1 text-center text-xs font-medium text-muted-foreground">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {calendarDays.map((day) => {
                    const selected = isSameDay(day, selectedDate);
                    const today = isSameDay(day, new Date());
                    return (
                      <button
                        key={`${day.year}-${day.month}-${day.date}`}
                        type="button"
                        aria-pressed={selected}
                        className={cn(
                          "relative aspect-square overflow-hidden rounded-lg text-xs font-medium transition-colors duration-200",
                          day.isCurrentMonth
                            ? "text-foreground/80 hover:bg-accent"
                            : "text-muted-foreground/50 hover:bg-accent",
                          selected && "bg-accent text-foreground shadow-sm",
                          today && !selected && "font-medium text-primary",
                        )}
                        onClick={() => selectDate(new Date(day.year, day.month, day.date))}
                      >
                        <span className="relative z-10">{day.date}</span>
                        {today && selected && (
                          <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-foreground/50" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-border px-3 pt-2 pb-3">
                <div className="flex gap-1.5">
                  <button type="button" className={QUICK_BUTTON} onClick={() => selectRelativeDay(0)}>
                    {labels.today}
                  </button>
                  <button type="button" className={QUICK_BUTTON} onClick={() => selectRelativeDay(1)}>
                    {labels.tomorrow}
                  </button>
                  <button type="button" className={QUICK_BUTTON} onClick={() => selectRelativeDay(7)}>
                    {labels.nextWeek}
                  </button>
                </div>
              </div>
            </>
          )}

          {viewMode === "months" && (
            <div className="p-3">
              <div className="grid grid-cols-3 gap-2">
                {monthNames.map((monthName, index) => (
                  <button
                    key={monthName}
                    type="button"
                    className={gridButton(currentMonth === index)}
                    onClick={() => {
                      setCurrentMonth(index);
                      setViewMode("days");
                    }}
                  >
                    {monthName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {viewMode === "years" && (
            <div className="p-3">
              <div className="grid grid-cols-3 gap-2">
                {yearRange.map((year) => (
                  <button
                    key={year}
                    type="button"
                    className={gridButton(currentYear === year)}
                    onClick={() => {
                      setCurrentYear(year);
                      setViewMode("days");
                    }}
                  >
                    {year + yearOffset}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex justify-between px-1">
                <button
                  type="button"
                  className="rounded-lg p-2 transition-colors hover:bg-accent"
                  onClick={() => setCurrentYear(currentYear - 12)}
                  aria-label="Previous years"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2 transition-colors hover:bg-accent"
                  onClick={() => setCurrentYear(currentYear + 12)}
                  aria-label="Next years"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
