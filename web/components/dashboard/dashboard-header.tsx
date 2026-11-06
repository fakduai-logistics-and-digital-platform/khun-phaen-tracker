"use client";

import { ArrowRight, Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n";

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

export function DashboardHeader({
  total,
  pinned,
  recent,
  hubTaskCount,
  onOpenHub,
  onCreate,
}: {
  total: number;
  pinned: number;
  recent: number;
  hubTaskCount: number;
  onOpenHub: () => void;
  onCreate: () => void;
}) {
  const { t } = useI18n();
  const { user } = useAuth();

  return (
    <header className="rounded-xl border bg-card p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{t("dashboard__title")}</h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">{user?.email ?? t("dashboard__loading_user")}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button variant="outline" onClick={onOpenHub} className="justify-between gap-3 sm:min-w-56">
            <span className="flex items-center gap-2">
              <Target className="size-4 text-muted-foreground" />
              {t("dashboard__hub_name")}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-xs tabular-nums text-muted-foreground">{hubTaskCount}</span>
              <ArrowRight className="size-4 text-muted-foreground" />
            </span>
          </Button>
          <Button onClick={onCreate} className="gap-2">
            <Plus className="size-4" />
            {t("dashboard__btn_create")}
          </Button>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-6 border-t pt-6">
        <Figure label={t("dashboard__stats_total_workspaces")} value={total} />
        <Figure label={t("dashboard__stats_pinned")} value={pinned} />
        <Figure label={t("dashboard__stats_recent")} value={recent} />
      </dl>
    </header>
  );
}
