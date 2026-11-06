"use client";

import { ChevronRight, FlaskConical, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import { runStatusLabel } from "@/components/test-cases/public-labels";
import type { TestCaseCounts, TestRunSummary } from "./use-workspace-overview";

const STATUS_KEYS: (keyof Omit<TestCaseCounts, "total">)[] = [
  "draft",
  "actual",
  "passed",
  "failed",
  "blocked",
  "deprecated",
];

function runBadgeVariant(status: string) {
  if (status === "aborted") return "destructive";
  if (status === "completed") return "secondary";
  return "outline";
}

function ViewAllButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick}>
      {t("overview__view_all")}
      <ChevronRight />
    </Button>
  );
}

export function OverviewTestCasesCard({
  counts,
  passRate,
  loading,
  onViewAll,
}: {
  counts: TestCaseCounts;
  passRate: number;
  loading: boolean;
  onViewAll: () => void;
}) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="size-4 text-muted-foreground" />
          {t("overview__test_cases")}
        </CardTitle>
        <ViewAllButton onClick={onViewAll} />
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("overview__loading")}</p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <div className="flex items-end justify-between">
                <span className="text-sm text-muted-foreground">{t("overview__pass_rate")}</span>
                <span className="text-2xl font-bold tabular-nums">{passRate}%</span>
              </div>
              <Progress value={passRate} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {STATUS_KEYS.map((key) => (
                <Card key={key} className="gap-1 py-3">
                  <CardContent className="px-3">
                    <p className="text-sm text-muted-foreground">{t(`tcopt__status_${key}`)}</p>
                    <p className="text-xl font-bold tabular-nums">{counts[key] ?? 0}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex items-center justify-between border-t pt-4 text-sm">
              <span className="text-muted-foreground">{t("overview__total")}</span>
              <span className="text-lg font-bold tabular-nums">{counts.total ?? 0}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function OverviewTestRunsCard({
  runs,
  loading,
  onViewAll,
}: {
  runs: TestRunSummary[];
  loading: boolean;
  onViewAll: () => void;
}) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Play className="size-4 text-muted-foreground" />
          {t("overview__test_runs")}
        </CardTitle>
        <ViewAllButton onClick={onViewAll} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("overview__loading")}</p>
        ) : runs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("overview__no_runs")}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {runs.map((run) => (
              <li key={run._id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <span className="truncate text-sm font-medium">{run.name}</span>
                <div className="flex shrink-0 items-center gap-2">
                  {run.stats && (
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {run.stats.passed}/{run.stats.passed + run.stats.failed}
                    </span>
                  )}
                  <Badge variant={runBadgeVariant(run.status)}>{runStatusLabel(run.status)}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
