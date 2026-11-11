"use client";

import type { RefObject } from "react";
import { FileSpreadsheet, FileText, Image as ImageIcon, Presentation, Video, X, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { normalizeTaskDate } from "@/lib/utils/date";
import type { MonthlySummary } from "@/lib/utils/monthly-summary";
import { MonthlySummaryCharts } from "./monthly-summary-charts";

type StatKey = keyof Pick<MonthlySummary, "total" | "pending" | "todo" | "inProgress" | "inTest" | "done" | "archived">;

const STAT_CARDS: { key: StatKey; labelKey: string }[] = [
  { key: "total", labelKey: "statsPanel__total_tasks" },
  { key: "pending", labelKey: "page__filter_status_pending" },
  { key: "todo", labelKey: "page__filter_status_todo" },
  { key: "inProgress", labelKey: "page__filter_status_in_progress" },
  { key: "inTest", labelKey: "page__filter_status_in_test" },
  { key: "done", labelKey: "page__filter_status_done" },
  { key: "archived", labelKey: "taskList__archived" },
];

const STATUS_LABEL_KEY: Record<string, string> = {
  done: "page__filter_status_done",
  "in-progress": "page__filter_status_in_progress",
  "in-test": "page__filter_status_in_test",
  tested: "page__filter_status_tested",
};
const DEFAULT_STATUS_LABEL_KEY = "page__filter_status_todo";

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

  const exportButtons: { label: string; icon: LucideIcon; onClick?: () => void }[] = [
    { label: "Export PDF", icon: FileText, onClick: onExportPDF },
    { label: "Export XLSX", icon: FileSpreadsheet, onClick: onExportXlsx },
    { label: "Export PNG", icon: ImageIcon, onClick: onExportPng },
    { label: "Export Video", icon: Video, onClick: onExportVideo },
    { label: "Export Slide", icon: Presentation, onClick: onExportSlide },
  ];

  return (
    <Dialog open onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent
        ref={monthlySummaryRef}
        showCloseButton={false}
        className="flex max-h-[85vh] w-full max-w-7xl flex-col gap-0 overflow-hidden rounded-lg p-0 sm:max-w-7xl"
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <DialogTitle>{t("page__summary_30_days")}</DialogTitle>
            <DialogDescription>{monthlySummary.periodLabel}</DialogDescription>
          </div>
          <div className="flex items-center gap-1">
            {exportButtons.map(({ label, icon: Icon, onClick }) => (
              <Button
                key={label}
                type="button"
                variant="outline"
                size="icon"
                onClick={onClick}
                title={label}
                aria-label={label}
              >
                <Icon />
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              title={t("taskForm__btn_close")}
              aria-label={t("taskForm__btn_close")}
            >
              <X />
            </Button>
          </div>
        </div>

        <div className="space-y-6 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
            {STAT_CARDS.map((card) => (
              <div key={card.key} className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground">{t(card.labelKey)}</p>
                <p className="text-2xl leading-tight font-semibold tabular-nums">{monthlySummary[card.key]}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border p-4">
            <p className="mb-4 text-sm text-muted-foreground tabular-nums">
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
            <h4 className="mb-3 text-sm font-medium">{t("monthlyCharts__recent_tasks_title")}</h4>
            <div className="space-y-0.5">
              {monthlySummary.recentTasks.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">{t("monthlyCharts__no_tasks_period")}</p>
                </div>
              ) : (
                monthlySummary.recentTasks.map((task, index) => {
                  const statusLabelKey = STATUS_LABEL_KEY[task.status] ?? DEFAULT_STATUS_LABEL_KEY;
                  return (
                    <div
                      key={task.id ?? index}
                      className="flex items-center justify-between gap-3 border-b px-2 py-3 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{task.title}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="max-w-30 truncate text-xs text-muted-foreground">
                            {task.project || t("page__unassigned_project")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {task.assignee?.name || t("page__unassigned")}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="mb-1 text-xs text-muted-foreground">{normalizeTaskDate(task.date)}</p>
                        <Badge variant="secondary">{t(statusLabelKey)}</Badge>
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
