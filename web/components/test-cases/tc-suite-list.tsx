"use client";

import { ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { TcRowMenu } from "./tc-row-menu";
import { TcSidebarSectionHeader } from "./tc-sidebar-section";
import type { Suite } from "./tc-types";

type TcSuiteListProps = {
  suites: Suite[];
  selectedSuiteId: string;
  isAuthorized: boolean;
  open: boolean;
  onToggleOpen: () => void;
  onSelectSuite: (suite: Suite) => void;
  onAddSuite: () => void;
  onDeleteSuite: (suite: Suite) => void;
};

export function TcSuiteList({
  suites,
  selectedSuiteId,
  isAuthorized,
  open,
  onToggleOpen,
  onSelectSuite,
  onAddSuite,
  onDeleteSuite,
}: TcSuiteListProps) {
  const { t } = useI18n();

  return (
    <>
      <TcSidebarSectionHeader
        title="Suites"
        open={open}
        onToggle={onToggleOpen}
        toggleLabel={t("tc__title_toggle_suites")}
        actionLabel={t("tc__title_add_suite")}
        onAction={isAuthorized ? onAddSuite : undefined}
      />

      {open && (
        <div className="space-y-1">
          {suites.map((suite) => {
            const selected = selectedSuiteId === suite.id;
            return (
              <div
                key={suite.id}
                className={cn(
                  "group relative flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                  selected ? "bg-muted" : "hover:bg-muted/50",
                )}
              >
                <button
                  type="button"
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 text-left",
                    selected ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
                  )}
                  onClick={() => onSelectSuite(suite)}
                >
                  <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{suite.title}</span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {suite.totalCount ?? suite.cases?.length ?? 0}
                  </span>
                </button>
                {isAuthorized && (
                  <TcRowMenu
                    triggerLabel={`Suite actions: ${suite.title}`}
                    deleteLabel="Delete suite"
                    onDelete={() => onDeleteSuite(suite)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
