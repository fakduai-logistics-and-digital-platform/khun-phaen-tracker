"use client";

import { Briefcase, ChevronRight, Gauge, HeartPulse, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import type { WorkspaceStats } from "./stats-panel";

type NamedCount = { name: string; count: number };

export function OverviewProgressCard({ stats, completionRate }: { stats: WorkspaceStats; completionRate: number }) {
  const { t } = useI18n();
  const items = [
    { label: t("statsPanel__in_progress"), value: stats.in_progress },
    { label: t("statsPanel__in_test"), value: stats.in_test },
    { label: t("overview__overdue"), value: 0 },
    { label: t("statsPanel__done"), value: stats.done },
  ];

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="size-4 text-muted-foreground" />
          {t("overview__project_status")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-end justify-between">
            <span className="text-sm text-muted-foreground">{t("overview__overall_completion")}</span>
            <span className="text-3xl font-bold tabular-nums">{completionRate}%</span>
          </div>
          <Progress value={completionRate} />
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {items.map((item) => (
            <Card key={item.label} className="gap-1 py-4">
              <CardContent className="px-4">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="text-2xl font-bold tabular-nums">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function OverviewTeamCard({ workers, onViewAll }: { workers: NamedCount[]; onViewAll: () => void }) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4 text-muted-foreground" />
          {t("overview__team_activity")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <ul className="flex flex-col gap-3">
          {workers.slice(0, 4).map((worker) => (
            <li key={worker.name} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="size-8">
                  <AvatarFallback>{worker.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="truncate text-sm font-medium">{worker.name}</span>
              </div>
              <Badge variant="secondary" className="tabular-nums">
                {t("overview__tasks_count", { count: worker.count })}
              </Badge>
            </li>
          ))}
        </ul>

        {workers.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("overview__no_team_activity")}</p>
        )}

        <Button type="button" variant="outline" className="mt-auto w-full" onClick={onViewAll}>
          {t("overview__view_all_issues")}
          <ChevronRight />
        </Button>
      </CardContent>
    </Card>
  );
}

export function OverviewProjectsCard({ projects, total }: { projects: NamedCount[]; total: number }) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Briefcase className="size-4 text-muted-foreground" />
          {t("overview__active_projects")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {projects.map((project) => (
          <div key={project.name} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{project.name}</span>
              <span className="text-muted-foreground tabular-nums">
                {t("overview__tasks_count", { count: project.count })}
              </span>
            </div>
            <Progress value={Math.min(100, (project.count / (total || 1)) * 100)} className="h-1.5" />
          </div>
        ))}
        {projects.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("overview__no_projects")}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function OverviewHealthCard() {
  const { t } = useI18n();
  const rows = [
    { label: t("overview__health_reliability"), value: t("overview__health_reliability_value") },
    { label: t("overview__health_deadline"), value: t("overview__health_deadline_value") },
    { label: t("overview__health_load"), value: t("overview__health_load_value") },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HeartPulse className="size-4 text-muted-foreground" />
          {t("overview__project_health")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col divide-y">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
