"use client";

import { useState } from "react";
import {
  Activity,
  AlertOctagon,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  MinusCircle,
  SkipForward,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import { runStatusLabel } from "./public-labels";
import { formatDate, type LatestTestRun } from "./public-model";

export function PublicRunBanner({ run }: { run: LatestTestRun }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);
  const { stats } = run;
  const passPct = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;

  const chips = [
    { icon: CheckCircle2, key: "tcpub__n_passed", count: stats.passed, show: true },
    { icon: XCircle, key: "tcpub__n_failed", count: stats.failed, show: true },
    { icon: MinusCircle, key: "tcpub__n_blocked", count: stats.blocked, show: true },
    { icon: Clock, key: "tcpub__n_pending", count: stats.pending, show: true },
    { icon: SkipForward, key: "tcpub__n_skipped", count: stats.skipped, show: stats.skipped > 0 },
    { icon: AlertOctagon, key: "tcpub__n_invalid", count: stats.invalid, show: stats.invalid > 0 },
    { icon: Layers, key: "tcpub__total", count: stats.total, show: true },
  ];

  return (
    <Card className="mb-8">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Activity className="mt-1 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{t("tcpub__latest_run")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{run.name}</CardTitle>
              <Badge variant="outline">{runStatusLabel(run.status)}</Badge>
              {run.operating_system && <Badge variant="secondary">{run.operating_system}</Badge>}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:block">{formatDate(run.created_at)}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp /> : <ChevronDown />}
            {expanded ? t("tcpub__hide") : t("tcpub__show")}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground tabular-nums">
                {t("tcpub__progress", { passed: stats.passed, total: stats.total })}
              </span>
              <span className="font-medium tabular-nums">{passPct}%</span>
            </div>
            <Progress value={passPct} />
          </div>

          <div className="flex flex-wrap gap-2">
            {chips
              .filter((chip) => chip.show)
              .map(({ icon: Icon, key, count }) => (
                <Badge key={key} variant="outline" className="tabular-nums">
                  <Icon />
                  {t(key, { count })}
                </Badge>
              ))}
          </div>

          {run.description && <p className="border-t pt-3 text-sm text-muted-foreground">{run.description}</p>}
        </CardContent>
      )}
    </Card>
  );
}
