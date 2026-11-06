"use client";

import type { RefObject } from "react";
import { FileSpreadsheet, FileText, Image as ImageIcon, Presentation, Video, X, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { normalizeTaskDate } from "@/lib/utils/date";
import type { MonthlySummary } from "@/lib/utils/monthly-summary";
import { cn } from "@/lib/utils";
import { MonthlySummaryCharts } from "./monthly-summary-charts";

type StatCard = {
  key: keyof Pick<MonthlySummary, "total" | "pending" | "todo" | "inProgress" | "inTest" | "done" | "archived">;
  labelKey: string;
  box: string;
  label: string;
  value: string;
};

const STAT_CARDS: StatCard[] = [
  {
    key: "total",
    labelKey: "statsPanel__total_tasks",
    box: "border-border bg-muted/60",
    label: "text-muted-foreground ",
    value: "text-foreground",
  },
  {
    key: "pending",
    labelKey: "page__filter_status_pending",
    box: "border-slate-200/50 bg-slate-50/50 dark:border-slate-700/50 dark:bg-slate-900/20",
    label: "text-slate-700 dark:text-slate-400",
    value: "text-slate-700 dark:text-slate-300",
  },
  {
    key: "todo",
    labelKey: "page__filter_status_todo",
    box: "border-amber-200/50 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-900/20",
    label: "text-amber-700 dark:text-amber-400",
    value: "text-amber-700 dark:text-amber-300",
  },
  {
    key: "inProgress",
    labelKey: "page__filter_status_in_progress",
    box: "border-blue-200/50 bg-blue-50/50 dark:border-blue-800/50 dark:bg-blue-900/20",
    label: "text-blue-700 dark:text-blue-400",
    value: "text-blue-700 dark:text-blue-300",
  },
  {
    key: "inTest",
    labelKey: "page__filter_status_in_test",
    box: "border-purple-200/50 bg-purple-50/50 dark:border-purple-800/50 dark:bg-purple-900/20",
    label: "text-purple-700 dark:text-purple-400",
    value: "text-purple-700 dark:text-purple-300",
  },
  {
    key: "done",
    labelKey: "page__filter_status_done",
    box: "border-success/50 bg-success/50 ",
    label: "text-success ",
    value: "text-success ",
  },
  {
    key: "archived",
    labelKey: "taskList__archived",
    box: "border-slate-200/50 bg-slate-50/50 dark:border-slate-700/50 dark:bg-slate-900/20",
    label: "text-slate-700 dark:text-slate-400",
    value: "text-slate-700 dark:text-slate-300",
  },
];

const STATUS_BADGES: Record<string, { labelKey: string; className: string }> = {
  done: {
    labelKey: "page__filter_status_done",
    className: "bg-success text-success ",
  },
  "in-progress": {
    labelKey: "page__filter_status_in_progress",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  "in-test": {
    labelKey: "page__filter_status_in_test",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
};
const DEFAULT_STATUS_BADGE = {
  labelKey: "page__filter_status_todo",
  className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

export function MonthlySummaryModal({
  monthlySummary,
  monthlySummaryRef,
  onClose,
  onExportPDF,
  onExportXlsx,
  onExportPng,
  onExportVideo,
  onExportSlide,
}: {
  monthlySummary: MonthlySummary;
  monthlySummaryRef?: RefObject<HTMLDivElement | null>;
  onClose?: () => void;
  onExportPDF?: () => void;
  onExportXlsx?: () => void;
  onExportPng?: () => void;
  onExportVideo?: () => void;
  onExportSlide?: () => void;
}) {
  const { t } = useI18n();

  const exportButtons: {
    label: string;
    icon: LucideIcon;
    className: string;
    onClick?: () => void;
  }[] = [
    {
      label: "Export PDF",
      icon: FileText,
      className: "text-destructive hover:bg-destructive dark:hover:bg-destructive/20",
      onClick: onExportPDF,
    },
    {
      label: "Export XLSX",
      icon: FileSpreadsheet,
      className: "text-success hover:bg-success dark:hover:bg-success/20",
      onClick: onExportXlsx,
    },
    {
      label: "Export PNG",
      icon: ImageIcon,
      className: "text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20",
      onClick: onExportPng,
    },
    {
      label: "Export Video",
      icon: Video,
      className: "text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20",
      onClick: onExportVideo,
    },
    {
      label: "Export Slide",
      icon: Presentation,
      className: "text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20",
      onClick: onExportSlide,
    },
  ];

  return (
    <Dialog open onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent
        ref={monthlySummaryRef}
        showCloseButton={false}
        className="flex max-h-[85vh] w-full max-w-7xl flex-col gap-0 overflow-hidden rounded-lg p-0 sm:max-w-7xl"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <DialogTitle className="text-xl font-medium">{t("page__summary_30_days")}</DialogTitle>
            <DialogDescription>{monthlySummary.periodLabel}</DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            {exportButtons.map(({ label, icon: Icon, className, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                title={label}
                aria-label={label}
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg border border-border transition-colors",
                  className,
                )}
              >
                <Icon size={16} />
              </button>
            ))}
            <button
              type="button"
              onClick={onClose}
              title={t("taskForm__btn_close")}
              aria-label={t("taskForm__btn_close")}
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-6 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
            {STAT_CARDS.map((card) => (
              <div key={card.key} className={cn("rounded-lg border p-3", card.box)}>
                <p className={cn("text-xs font-medium", card.label)}>{t(card.labelKey)}</p>
                <p className={cn("text-2xl leading-tight font-semibold", card.value)}>{monthlySummary[card.key]}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-linear-to-br from-slate-50 to-blue-50 p-4 dark:from-gray-800 dark:to-gray-900">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {t("monthlyCharts__avg_day")}: {monthlySummary.avgPerDay.toFixed(2)} · {t("monthlyCharts__total_time")}:{" "}
              {(monthlySummary.totalMinutes / 60).toFixed(1)} {t("statsPanel__hours_short")}
            </p>
            <MonthlySummaryCharts
              done={monthlySummary.done}
              inProgress={monthlySummary.inProgress}
              inTest={monthlySummary.inTest}
              pending={monthlySummary.pending}
              todo={monthlySummary.todo}
              dailyTrend={monthlySummary.dailyTrend}
              projectBreakdown={monthlySummary.projectBreakdown}
              assigneeBreakdown={monthlySummary.assigneeBreakdown}
              categoryBreakdown={monthlySummary.categoryBreakdown}
            />
          </div>

          <div className="rounded-lg border border-border p-4">
            <h4 className="mb-3 flex items-center gap-2 font-medium text-foreground">
              <span className="h-4 w-1 rounded-full bg-primary" />
              {t("monthlyCharts__recent_tasks_title")}
            </h4>
            <div className="space-y-0.5">
              {monthlySummary.recentTasks.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">{t("monthlyCharts__no_tasks_period")}</p>
                </div>
              ) : (
                monthlySummary.recentTasks.map((task, index) => {
                  const badge = STATUS_BADGES[task.status] ?? DEFAULT_STATUS_BADGE;
                  return (
                    <div
                      key={task.id ?? index}
                      className="flex items-center justify-between gap-3 rounded-lg border-b border-border px-2 py-3 transition-colors last:border-0 hover:bg-accent/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{task.title}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="max-w-30 truncate rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                            {task.project || t("page__unassigned_project")}
                          </span>
                          <span className="text-xs font-medium text-muted-foreground">
                            {task.assignee?.name || t("page__unassigned")}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="mb-1 text-xs font-medium text-muted-foreground">{normalizeTaskDate(task.date)}</p>
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium ", badge.className)}>
                          {t(badge.labelKey)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
