"use client";

import { useMemo } from "react";
import { Flame, ShieldAlert, Skull, Sword, TrendingDown, TrendingUp, Users, Zap, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import type { Task } from "@/lib/types";
import { calculateBattleHealthStats } from "@/lib/utils/battleHealth";

const MORALE_ICON: Record<string, LucideIcon> = {
  excellent: Flame,
  stable: Sword,
  warning: ShieldAlert,
  critical: Skull,
};

export function BattleHealthDashboard({ tasks = [] }: { tasks?: Task[] }) {
  const { t } = useI18n();
  const stats = useMemo(() => calculateBattleHealthStats(tasks), [tasks]);
  const MoraleIcon = MORALE_ICON[stats.morale] ?? Users;

  const trendLabel =
    stats.velocityTrend > 0
      ? t("workload__velocity_up")
      : stats.velocityTrend < 0
        ? t("workload__velocity_down")
        : t("workload__velocity_stable");

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t("workload__battle_dashboard")}</h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="gap-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">{t("workload__project_velocity")}</CardTitle>
            <Zap className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums">{stats.velocity}</span>
              <span className="text-sm text-muted-foreground">tasks/day</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {stats.velocityTrend > 0 && <TrendingUp className="size-4" />}
              {stats.velocityTrend < 0 && <TrendingDown className="size-4" />}
              <span className="tabular-nums">
                {stats.velocityTrend > 0 ? "+" : ""}
                {stats.velocityTrend}
              </span>
              <span>{trendLabel}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">{t("workload__overdue_ratio")}</CardTitle>
            <ShieldAlert className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="text-2xl font-bold tabular-nums">{stats.overdueRatio.toFixed(0)}%</div>
            <Progress value={Math.min(stats.overdueRatio, 100)} />
            <p className="text-xs text-muted-foreground">
              {t("workload__overdue_tasks_summary", { overdue: stats.overdueCount, active: stats.activeTasksCount })}
            </p>
          </CardContent>
        </Card>

        <Card className="gap-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">{t("workload__army_morale")}</CardTitle>
            <MoraleIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="text-2xl font-bold">{t(`workload__morale_${stats.morale}`)}</div>
            <CardDescription>{t("workload__status_report")}</CardDescription>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                +{stats.doneTasksLast7Days} {t("workload__cleared_unit")}
              </Badge>
              <Badge variant="outline">
                {stats.overdueCount} {t("workload__casualties_unit")}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
