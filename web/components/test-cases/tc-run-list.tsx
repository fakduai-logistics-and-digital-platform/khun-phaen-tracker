"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { TcRowMenu } from "./tc-row-menu";
import { TcSidebarSectionHeader } from "./tc-sidebar-section";
import type { TestRun } from "./tc-types";

type TcRunListProps = {
  runs: TestRun[];
  total: number;
  selectedRunId?: string;
  isAuthorized: boolean;
  open: boolean;
  isLoadingMore: boolean;
  onToggleOpen: () => void;
  onOpenRun: (run: TestRun) => void;
  onNewRun: () => void;
  onDeleteRun: (run: TestRun) => void;
  onLoadMore: () => void;
};

const STATUS_DOT: Record<string, string> = {
  completed: "bg-emerald-500",
  running: "bg-amber-400",
};

export function TcRunList({
  runs,
  total,
  selectedRunId,
  isAuthorized,
  open,
  isLoadingMore,
  onToggleOpen,
  onOpenRun,
  onNewRun,
  onDeleteRun,
  onLoadMore,
}: TcRunListProps) {
  const { t } = useI18n();

  return (
    <div className="mt-6 border-t border-border pt-4">
      <TcSidebarSectionHeader
        title="Test Runs"
        open={open}
        onToggle={onToggleOpen}
        toggleLabel={t("tc__title_toggle_runs")}
        count={total || runs.length}
        actionLabel={t("tc__title_new_run")}
        onAction={isAuthorized ? onNewRun : undefined}
      />

      {open &&
        (runs.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">No test runs yet</p>
        ) : (
          <div className="space-y-1">
            {runs.map((run) => {
              const selected = selectedRunId === run._id;
              return (
                <div
                  key={run._id}
                  className={cn(
                    "group relative flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
                    selected ? "bg-primary/10" : "hover:bg-muted/50",
                  )}
                >
                  <button
                    type="button"
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2 text-left",
                      selected ? "text-primary" : "text-muted-foreground",
                    )}
                    onClick={() => onOpenRun(run)}
                  >
                    <div
                      className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[run.status] ?? "bg-muted-foreground/40")}
                    />
                    <span className="min-w-0 flex-1 truncate">{run.name}</span>
                    <span className="text-xs font-semibold text-muted-foreground">{run.test_cases.length}</span>
                  </button>
                  {isAuthorized && (
                    <TcRowMenu
                      triggerLabel={`Run actions: ${run.name}`}
                      deleteLabel="Delete run"
                      onDelete={() => onDeleteRun(run)}
                    />
                  )}
                </div>
              );
            })}
            {runs.length < total && (
              <button
                type="button"
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                disabled={isLoadingMore}
                onClick={onLoadMore}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    <span>{t("tc__loading")}</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-3" strokeWidth={2.5} />
                    <span>{total - runs.length} more</span>
                  </>
                )}
              </button>
            )}
          </div>
        ))}
    </div>
  );
}
