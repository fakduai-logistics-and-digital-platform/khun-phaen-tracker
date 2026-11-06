"use client";

import { ChevronLeft, ChevronRight, Edit3, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { TcCaseRow } from "./tc-case-row";
import { TcQuickCreate } from "./tc-quick-create";
import { TcSheetTable } from "./tc-sheet-table";
import type { AssigneeOption, Suite, TestCase } from "./tc-types";

export type TcCaseHandlers = {
  onOpenDetail: (suite: Suite, testCase: TestCase) => void;
  onOpenEditor: (suiteId: string, caseId?: string) => void;
  onDeleteCase: (id: string) => void;
  onUpdateStatus: (testCase: TestCase, status: string) => void;
  onUpdateFixed: (testCase: TestCase, fixed: string) => void;
  onUpdatePriority: (testCase: TestCase, priority: string) => void;
  onUpdateAssignDev: (testCase: TestCase, assignee: string) => void;
  onQuickCreate: (suiteId: string, title: string) => Promise<void>;
};

export type TcView = "list" | "table";

type TcSuiteSectionProps = {
  suite: Suite;
  view: TcView;
  selected: boolean;
  selectedCaseId: string;
  isAuthorized: boolean;
  updatingPriorityIds: Set<string>;
  assigneeOptions: AssigneeOption[];
  handlers: TcCaseHandlers;
  onEditSuite: (suite: Suite) => void;
  onDeleteSuite: (suite: Suite) => void;
  onLoadPage: (suiteId: string, page: number) => void;
};

export function TcSuiteSection({
  suite,
  view,
  selectedCaseId,
  isAuthorized,
  updatingPriorityIds,
  assigneeOptions,
  handlers,
  onEditSuite,
  onDeleteSuite,
  onLoadPage,
}: TcSuiteSectionProps) {
  const { t } = useI18n();

  return (
    <section id={`suite-${suite.id}`} className="@container scroll-mt-4">
      <div
        className={cn(
          "flex min-h-12 items-center gap-3 rounded-t-lg px-5 transition-colors duration-300",
          "bg-muted/50",
        )}
      >
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{suite.title}</h3>
        {isAuthorized && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              title={t("tc__title_add_case")}
              aria-label={t("tc__title_add_case")}
              onClick={() => handlers.onOpenEditor(suite.id)}
            >
              <Plus />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              title={t("tc__title_edit_suite")}
              aria-label={t("tc__title_edit_suite")}
              onClick={() => onEditSuite(suite)}
            >
              <Edit3 />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-destructive hover:text-destructive"
              title={t("tc__title_delete_suite")}
              aria-label={t("tc__title_delete_suite")}
              onClick={() => onDeleteSuite(suite)}
            >
              <Trash2 />
            </Button>
          </>
        )}
      </div>

      {view === "table" && (
        <TcSheetTable
          suite={suite}
          selectedCaseId={selectedCaseId}
          isAuthorized={isAuthorized}
          updatingPriorityIds={updatingPriorityIds}
          assigneeOptions={assigneeOptions}
          handlers={handlers}
        />
      )}

      {view === "list" && (
        <div className="divide-y divide-border">
          {(suite.cases || []).map((testCase) => (
            <TcCaseRow
              key={testCase.id}
              testCase={testCase}
              selected={selectedCaseId === testCase.id}
              isAuthorized={isAuthorized}
              updatingPriority={updatingPriorityIds.has(testCase.id)}
              assigneeOptions={assigneeOptions}
              onOpenDetail={() => handlers.onOpenDetail(suite, testCase)}
              onOpenEditor={() => handlers.onOpenEditor(suite.id, testCase.id)}
              onDelete={() => handlers.onDeleteCase(testCase.id)}
              onUpdateStatus={(status) => handlers.onUpdateStatus(testCase, status)}
              onUpdateFixed={(fixed) => handlers.onUpdateFixed(testCase, fixed)}
              onUpdatePriority={(priority) => handlers.onUpdatePriority(testCase, priority)}
              onUpdateAssignDev={(assignee) => handlers.onUpdateAssignDev(testCase, assignee)}
            />
          ))}

          {suite.cases.length === 0 && (
            <div className="flex items-center justify-center py-4 opacity-50">
              <p className="text-xs font-medium text-muted-foreground">{t("testCases__empty_suite")}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border px-3 py-3">
        <div className="flex flex-1 items-center gap-4">
          {isAuthorized ? (
            <TcQuickCreate onCreate={(title) => handlers.onQuickCreate(suite.id, title)} />
          ) : (
            <div className="flex-1" />
          )}

          <div className="ml-auto flex gap-2">
            {(suite.page > 1 || suite.hasMore) && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={suite.page <= 1}
                  onClick={() => onLoadPage(suite.id, suite.page - 1)}
                >
                  <ChevronLeft />
                  {t("pagination__previous")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!suite.hasMore}
                  onClick={() => onLoadPage(suite.id, suite.page + 1)}
                >
                  {t("pagination__next")}
                  <ChevronRight />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
