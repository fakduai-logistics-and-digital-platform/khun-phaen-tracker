"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { useTheme } from "next-themes";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";
import { RechartsSummary, type RechartsSummaryProps } from "./recharts-summary";

type NamedCount = { name: string; count: number };
type TrendMode = RechartsSummaryProps["trendMode"];

const TREND_MODES: { mode: TrendMode; labelKey: string }[] = [
  { mode: "line", labelKey: "monthlyCharts__btn_line" },
  { mode: "bar", labelKey: "monthlyCharts__btn_bar" },
];

export function MonthlySummaryCharts({
  done = 0,
  inProgress = 0,
  inTest = 0,
  pending = 0,
  todo = 0,
  dailyTrend = [],
  projectBreakdown = [],
  assigneeBreakdown = [],
  categoryBreakdown = [],
}: {
  done?: number;
  inProgress?: number;
  inTest?: number;
  pending?: number;
  todo?: number;
  dailyTrend?: { date: string; count: number }[];
  projectBreakdown?: NamedCount[];
  assigneeBreakdown?: NamedCount[];
  categoryBreakdown?: NamedCount[];
}) {
  const { t } = useI18n();
  const { resolvedTheme } = useTheme();
  const [trendMode, setTrendMode] = useState<TrendMode>("line");

  const labels = useMemo<RechartsSummaryProps["labels"]>(
    () => ({
      status: t("monthlyCharts__status_title"),
      trend: t("monthlyCharts__trend_title"),
      project: t("monthlyCharts__project_title"),
      assignee: t("monthlyCharts__assignee_title"),
      category: t("monthlyCharts__category_dist"),
      prediction: t("monthlyCharts__prediction_title"),
      predictionDesc: t("monthlyCharts__prediction_desc"),
      predictionNextMonth: t("monthlyCharts__prediction_next_month"),
      predictionConfidence: t("monthlyCharts__prediction_confidence"),
      predictionTasks: t("monthlyCharts__prediction_tasks"),
      predictionExperimental: t("monthlyCharts__label_experimental"),
      predictionHelpTitle: t("monthlyCharts__prediction_help_title"),
      predictionHelpContent: t("monthlyCharts__prediction_help_content"),
      tasksCount: t("monthlyCharts__tasks_count"),
      done: t("page__filter_status_done"),
      inProgress: t("page__filter_status_in_progress"),
      inTest: t("page__filter_status_in_test"),
      pending: t("page__filter_status_pending"),
      todo: t("page__filter_status_todo"),
    }),
    [t],
  );

  return (
    <div className="space-y-3 pt-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{t("monthlyCharts__visualization")}</p>
        <Tabs value={trendMode} onValueChange={(value) => setTrendMode(value as TrendMode)}>
          <TabsList>
            {TREND_MODES.map(({ mode, labelKey }) => (
              <TabsTrigger key={mode} value={mode}>
                {t(labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <RechartsSummary
        done={done}
        inProgress={inProgress}
        inTest={inTest}
        pending={pending}
        todo={todo}
        dailyTrend={dailyTrend}
        projectBreakdown={projectBreakdown}
        assigneeBreakdown={assigneeBreakdown}
        categoryBreakdown={categoryBreakdown}
        isDark={resolvedTheme === "dark"}
        trendMode={trendMode}
        labels={labels}
      />

      <div className="flex items-start gap-3 rounded-lg border p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{t("monthlyCharts__insight_title")}</p>
          <p className="text-sm text-muted-foreground">{t("monthlyCharts__insight_body")}</p>
        </div>
      </div>
    </div>
  );
}
