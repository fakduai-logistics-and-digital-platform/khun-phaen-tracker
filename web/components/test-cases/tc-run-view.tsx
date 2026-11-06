"use client";

import { ChevronLeft, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PROPERTY_SELECT, RUN_CASE_STATUSES, RUN_ROW_TONE } from "./tc-options";
import type { TestRunCaseDetail, TestRunDetail } from "./tc-types";
import "./tc-property-select.css";

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

const RUN_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  completed: {
    label: "Completed",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  },
  aborted: { label: "Aborted", className: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" },
  running: { label: "Running", className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" },
};

const STAT_ITEMS = [
  { key: "passed", className: "text-emerald-600 dark:text-emerald-400" },
  { key: "failed", className: "text-red-500" },
  { key: "blocked", className: "text-orange-500" },
  { key: "skipped", className: "text-blue-400" },
  { key: "invalid", className: "text-purple-500" },
  { key: "pending", className: "text-muted-foreground" },
] as const;

const ROW_GRID = "grid grid-cols-[60px_52px_1fr_140px] items-center gap-3";

function priorityBadgeClass(priority?: string) {
  if (priority === "high") return "bg-orange-600 text-white border-orange-700";
  if (priority === "medium") return "bg-orange-900/40 text-orange-600 dark:text-orange-400 border-orange-900/50";
  return "bg-muted text-muted-foreground border-border";
}

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
  const badge = detail ? (RUN_STATUS_BADGE[detail.status] ?? RUN_STATUS_BADGE.running) : null;
  const stats = detail?.stats;
  const creatorName = detail?.created_by_name || detail?.created_by;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-4">
        <button
          type="button"
          className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          aria-label="Back to suites"
          onClick={onBack}
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <h2 className="truncate text-base font-semibold text-foreground">{detail?.name ?? "Test run"}</h2>
          {badge && (
            <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", badge.className)}>
              {badge.label}
            </span>
          )}
        </div>
        {isAuthorized && (
          <>
            {detail?.status === "running" ? (
              <button
                type="button"
                className="shrink-0 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                onClick={() => onUpdateRunStatus("completed")}
              >
                {t("tc__mark_complete")}
              </button>
            ) : detail?.status === "completed" ? (
              <button
                type="button"
                className="shrink-0 rounded-xl bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-400"
                onClick={() => onUpdateRunStatus("running")}
              >
                {t("tc__reopen")}
              </button>
            ) : null}
            <button
              type="button"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              title={t("tc__title_delete_run")}
              aria-label={t("tc__title_delete_run")}
              onClick={onDeleteRun}
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>

      {detail && stats && (
        <div className="flex shrink-0 flex-wrap items-center gap-5 border-b border-border px-6 py-3 text-xs font-medium">
          <span className="text-muted-foreground">{stats.total} total</span>
          {STAT_ITEMS.map(({ key, className }) =>
            stats[key] ? (
              <span key={key} className={className}>
                {stats[key]} {key}
              </span>
            ) : null,
          )}
          {creatorName && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              Created by
              <span className="flex items-center gap-1">
                <span
                  className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full text-[9px] font-bold text-white"
                  style={{ backgroundColor: detail.created_by_color || "#6366f1" }}
                >
                  {detail.created_by_avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={detail.created_by_avatar_url} alt="" className="size-full object-cover" />
                  ) : (
                    creatorName[0].toUpperCase()
                  )}
                </span>
                <span className="font-medium text-foreground">{creatorName}</span>
              </span>
            </span>
          )}
          <div className="h-1.5 min-w-[80px] flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${stats.total ? Math.round((stats.passed / stats.total) * 100) : 0}%` }}
            />
          </div>
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
                "border-b border-border bg-muted/50 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground",
              )}
            >
              <span>#</span>
              <span />
              <span>{t("tc__test_case")}</span>
              <span>{t("tc__status")}</span>
            </div>
            <div className="divide-y divide-border">
              {detail.test_cases.map((entry) => {
                const locked = updatingCaseId === entry.test_case_id || detail.status === "completed";
                return (
                  <div
                    key={entry.test_case_id}
                    className={cn(
                      ROW_GRID,
                      "border-l-4 py-3 pl-4 pr-5 transition-colors",
                      RUN_ROW_TONE[entry.status] ?? "border-l-transparent hover:bg-muted/50",
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
                    <span
                      className={cn(
                        "flex items-center justify-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium shadow-sm",
                        priorityBadgeClass(entry.test_case?.priority),
                      )}
                    >
                      {entry.test_case?.priority ?? "—"}
                    </span>
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">
                      {entry.test_case?.name ?? entry.test_case_id}
                    </span>
                    <div
                      className={cn(
                        PROPERTY_SELECT,
                        "w-[130px]",
                        isAuthorized ? locked && "pointer-events-none opacity-50" : "pointer-events-none opacity-70",
                      )}
                    >
                      <SearchableSelect
                        id={`run-case-status-${isAuthorized ? "" : "ro-"}${entry.test_case_id}`}
                        value={entry.status}
                        options={RUN_CASE_STATUSES}
                        showSearch={false}
                        minimal
                        dropdownClass="w-full"
                        onSelect={isAuthorized ? (v) => onUpdateCaseStatus(entry.test_case_id, String(v)) : undefined}
                      />
                    </div>
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
