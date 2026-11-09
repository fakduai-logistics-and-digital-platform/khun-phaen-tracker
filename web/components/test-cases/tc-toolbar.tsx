"use client";

import { List, Table2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TcView } from "./tc-suite-section";
import { useI18n } from "@/lib/i18n";
import { filterOptionsFor, filterProperties } from "./tc-options";
import { TcActionsMenu } from "./tc-actions-menu";
import { TcFilterChips } from "./tc-filter-chips";
import { TcFilterMenu } from "./tc-filter-menu";
import { TcSearchBox } from "./tc-search-box";
import type { ActiveFilters, AssigneeOption } from "./tc-types";

type TcToolbarProps = {
  view: TcView;
  onViewChange: (view: TcView) => void;
  workspaceId: string;
  projectId: string;
  workspaceLabel: string;
  caseCount: number;
  suiteCount: number;
  query: string;
  onQueryChange: (query: string) => void;
  field: string;
  onFieldChange: (field: string) => void;
  activeFilters: ActiveFilters;
  onToggleFilter: (property: string, value: string) => void;
  onClearFilter: (property: string) => void;
  onClearAllFilters: () => void;
  filterLabel: (property: string, value: string) => string;
  assigneeOptions: AssigneeOption[];
  isAuthorized: boolean;
  onDownloadTemplate: () => void;
  onImportFile: (file: File) => void;
  onExport: () => void;
  renumberTarget: string | null;
  renumberLabel: string;
  onRenumber: (target: string) => Promise<void>;
};

export function TcToolbar({
  view,
  onViewChange,
  workspaceId,
  projectId,
  workspaceLabel,
  caseCount,
  suiteCount,
  query,
  onQueryChange,
  field,
  onFieldChange,
  activeFilters,
  onToggleFilter,
  onClearFilter,
  onClearAllFilters,
  filterLabel,
  assigneeOptions,
  isAuthorized,
  onDownloadTemplate,
  onImportFile,
  onExport,
  renumberTarget,
  renumberLabel,
  onRenumber,
}: TcToolbarProps) {
  const { t } = useI18n();
  return (
    <header className="shrink-0 border-b border-border bg-background px-6 py-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {workspaceLabel} {t("tcopt__repository")}
          </h1>
          <span className="text-sm font-medium text-muted-foreground">
            {t("tcopt__counts", { cases: caseCount, suites: suiteCount })}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <TcSearchBox
              className="min-w-[320px]"
              value={query}
              onValueChange={onQueryChange}
              field={field}
              onFieldChange={onFieldChange}
              fieldSelectId="test-case-search-field"
            />

            <TcFilterChips
              filters={activeFilters}
              properties={filterProperties}
              labelFor={filterLabel}
              onRemove={(prop) => onClearFilter(prop)}
            />

            <TcFilterMenu
              properties={filterProperties}
              optionsFor={(prop) => filterOptionsFor(prop, assigneeOptions)}
              selected={activeFilters}
              onToggle={onToggleFilter}
              onClearAll={onClearAllFilters}
              clearLabel={t("tcopt__clear_selection")}
            />
          </div>

          <div className="flex items-center gap-3">
            <Tabs value={view} onValueChange={(next) => onViewChange(next === "list" ? "list" : "table")}>
              <TabsList aria-label={t("tcpub__view_aria")}>
                <TabsTrigger value="table">
                  <Table2 />
                  {t("tcpub__view_table")}
                </TabsTrigger>
                <TabsTrigger value="list">
                  <List />
                  {t("tcpub__view_list")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="h-6 w-px bg-border" />
            <TcActionsMenu
              workspaceId={workspaceId}
              projectId={projectId}
              isAuthorized={isAuthorized}
              onDownloadTemplate={onDownloadTemplate}
              onImportFile={onImportFile}
              onExport={onExport}
              renumberTarget={renumberTarget}
              renumberLabel={renumberLabel}
              onRenumber={onRenumber}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
