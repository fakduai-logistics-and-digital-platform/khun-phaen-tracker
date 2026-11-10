"use client";

import { ChevronLeft, Trash2 } from "lucide-react";
import { PropertySelect } from "@/components/task-detail/property-select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { tOr } from "@/components/workspace/t-or";
import { RUN_CASE_STATUSES, RUN_ROW_TONE } from "./tc-options";
import type { TestRunCaseDetail, TestRunDetail } from "./tc-types";

type TcRunViewProps = {
  detail: TestRunDetail | null;
  loading: boolean;
  isAuthorized: boolean;
  updatingCaseId: string | null;
  onBack: () => void;
  onUpdateRunStatus: (status: string) => void;
  onDeleteRun: () => void;
  onUpdateCaseStatus: (caseId: string, status: string) => void;
  onViewCase: (entry: TestRunCaseDetail) => void;
};

const RUN_STATUS_BADGE: Record<string, { key: string; className: string }> = {
  completed: {
    key: "tc__run_status_completed",
    className: "bg-success/15 text-success",
  },
  aborted: {
    key: "tc__run_status_aborted",
    className: "bg-destructive/15 text-destructive",
  },
  running: {
    key: "tc__run_status_running",
    className: "bg-warning/15 text-warning",
  },
};

const STAT_ITEMS = [
  { key: "passed", label: "tcopt__status_passed", className: "text-success" },
  {
    key: "failed",
    label: "tcopt__status_failed",
    className: "text-destructive",
  },
  { key: "blocked", label: "tcopt__status_blocked", className: "text-warning" },
  {
    key: "skipped",
    label: "tcopt__run_skipped",
    className: "text-muted-foreground",
  },
  {
    key: "invalid",
    label: "tcopt__run_invalid",
    className: "text-muted-foreground",
  },
  {
    key: "pending",
    label: "tcopt__run_pending",
    className: "text-muted-foreground",
  },
] as const;

const ROW_GRID = "grid grid-cols-[60px_76px_1fr_140px] items-center gap-3";

const PRIORITY_VARIANT = { high: "destructive", medium: "secondary" } as const;

export function TcRunView({
  detail,
  loading,
  isAuthorized,
  updatingCaseId,
  onBack,
  onUpdateRunStatus,
  onDeleteRun,
  onUpdateCaseStatus,
  onViewCase,
}: TcRunViewProps) {
  const { t } = useI18n();
  const badge = detail
    ? (RUN_STATUS_BADGE[detail.status] ?? RUN_STATUS_BADGE.running)
    : null;
  const stats = detail?.stats;
  const creatorName = detail?.created_by_name || detail?.created_by;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b px-6 py-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("tc__back_to_suites")}
          onClick={onBack}
        >
          <ChevronLeft />
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <h2 className="truncate text-base font-semibold">
            {detail?.name ?? t("tc__run_fallback_name")}
          </h2>
          {badge && (
            <Badge
              variant="secondary"
              className={cn("shrink-0", badge.className)}
            >
              {t(badge.key)}
            </Badge>
          )}
        </div>
        {isAuthorized && (
          <>
            {detail?.status === "running" ? (
              <Button
                type="button"
                size="sm"
                onClick={() => onUpdateRunStatus("completed")}
              >
                {t("tc__mark_complete")}
              </Button>
            ) : detail?.status === "completed" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onUpdateRunStatus("running")}
              >
                {t("tc__reopen")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title={t("tc__title_delete_run")}
              aria-label={t("tc__title_delete_run")}
              onClick={onDeleteRun}
            >
              <Trash2 />
            </Button>
          </>
        )}
      </div>

      {detail && stats && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b px-6 py-3 text-sm">
          <span className="text-muted-foreground">
            {t("tc__stat_total", { count: stats.total })}
          </span>
          {STAT_ITEMS.map(({ key, label, className }) =>
            stats[key] ? (
              <span key={key} className={className}>
                {stats[key]} {t(label)}
              </span>
            ) : null,
          )}
          {creatorName && (
            <span className="flex items-center gap-2 text-muted-foreground">
              {t("tc__created_by")}
              <Avatar className="size-5">
                {detail.created_by_avatar_url && (
                  <AvatarImage src={detail.created_by_avatar_url} alt="" />
                )}
                <AvatarFallback
                  className="text-xs font-medium text-white"
                  style={{
                    backgroundColor: detail.created_by_color || "#6366f1",
                  }}
                >
                  {creatorName[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-foreground">{creatorName}</span>
            </span>
          )}
          <Progress
            value={
              stats.total ? Math.round((stats.passed / stats.total) * 100) : 0
            }
            className="h-1.5 min-w-20 flex-1 bg-muted [&>div]:bg-success"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            <div className="size-6 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        ) : detail ? (
          <>
            <div
              className={cn(
                ROW_GRID,
                "border-b bg-muted/50 px-5 py-2 text-xs font-medium text-muted-foreground",
              )}
            >
              <span>#</span>
              <span />
              <span>{t("tc__test_case")}</span>
              <span>{t("tc__status")}</span>
            </div>
            <div className="divide-y">
              {detail.test_cases.map((entry) => {
                const locked =
                  updatingCaseId === entry.test_case_id ||
                  detail.status === "completed";
                return (
                  <div
                    key={entry.test_case_id}
                    className={cn(
                      ROW_GRID,
                      "border-l-4 py-3 pl-4 pr-5 transition-colors",
                      RUN_ROW_TONE[entry.status] ??
                        "border-l-transparent hover:bg-muted/50",
                    )}
                  >
                    <button
                      type="button"
                      className="text-left font-mono text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                      title={t("tc__title_view_case")}
                      onClick={() => onViewCase(entry)}
                    >
                      TC-{entry.test_case?.test_no ?? "?"}
                    </button>
                    <Badge
                      variant={
                        PRIORITY_VARIANT[entry.test_case?.priority as "high"] ??
                        "outline"
                      }
                    >
                      {entry.test_case?.priority
                        ? tOr(
                            t,
                            `priority__${entry.test_case.priority}`,
                            entry.test_case.priority,
                          )
                        : "—"}
                    </Badge>
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">
                      {entry.test_case?.name ?? entry.test_case_id}
                    </span>
                    <PropertySelect
                      id={`run-case-status-${entry.test_case_id}`}
                      value={entry.status}
                      options={RUN_CASE_STATUSES}
                      disabled={!isAuthorized || locked}
                      onSelect={(v) =>
                        onUpdateCaseStatus(entry.test_case_id, String(v))
                      }
                    />
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
