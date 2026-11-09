"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PropertySelect } from "@/components/task-detail/property-select";
import { useI18n } from "@/lib/i18n";
import { TcRowActions } from "./tc-row-actions";
import type { TransitionRow } from "@/components/workspace/use-row-transitions";
import { formatDateTime } from "./tc-times";
import { cn } from "@/lib/utils";
import { fixedOptions, statusOptions } from "./tc-options";
import { TcPriorityMenu } from "./tc-priority-menu";
import type { TcCaseHandlers } from "./tc-suite-section";
import type { AssigneeOption, Suite, TestCase } from "./tc-types";

// Spreadsheet-style grid: every cell has a hairline border on its right and bottom edge.
const CELL = "h-9 border-r border-b px-2 py-1 last:border-r-0";

type TcSheetTableProps = {
  suite: Suite;
  rows: TransitionRow<TestCase>[];
  selectedCaseId: string;
  isAuthorized: boolean;
  updatingPriorityIds: Set<string>;
  assigneeOptions: AssigneeOption[];
  handlers: TcCaseHandlers;
};

export function TcSheetTable({
  suite,
  rows,
  selectedCaseId,
  isAuthorized,
  updatingPriorityIds,
  assigneeOptions,
  handlers,
}: TcSheetTableProps) {
  const { t, locale } = useI18n();

  return (
    <Table className="border-collapse border-t text-sm">
      <TableHeader>
        <TableRow className="bg-muted/60 hover:bg-muted/60">
          <TableHead className={cn(CELL, "w-10 text-center text-muted-foreground")}>#</TableHead>
          <TableHead className={cn(CELL, "w-24")}>{t("tcpub__col_id")}</TableHead>
          <TableHead className={cn(CELL, "min-w-[280px]")}>{t("tcpub__col_title")}</TableHead>
          <TableHead className={cn(CELL, "w-32")}>{t("tcpub__col_priority")}</TableHead>
          <TableHead className={cn(CELL, "w-36")}>{t("tcpub__col_status")}</TableHead>
          <TableHead className={cn(CELL, "w-36")}>{t("tcpub__col_fixed")}</TableHead>
          <TableHead className={cn(CELL, "w-44")}>{t("tcopt__prop_assign_dev")}</TableHead>
          <TableHead className={cn(CELL, "w-40")}>{t("tcTime__col_passed")}</TableHead>
          <TableHead className={cn(CELL, "w-32")} />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ item: testCase, phase }, index) => (
          <TableRow
            key={testCase.id}
            className={cn(
              "hover:bg-accent/40",
              selectedCaseId === testCase.id && "bg-accent",
              phase === "enter" && "duration-300 animate-in fade-in slide-in-from-top-2",
              phase === "leave" &&
                "pointer-events-none duration-200 animate-out fill-mode-forwards fade-out slide-out-to-right-8",
            )}
          >
            <TableCell className={cn(CELL, "bg-muted/60 text-center text-xs text-muted-foreground tabular-nums")}>
              {index + 1}
            </TableCell>
            <TableCell className={cn(CELL, "font-mono text-muted-foreground")}>TC-{testCase.test_no}</TableCell>
            <TableCell className={cn(CELL, "whitespace-normal")}>
              <button
                type="button"
                className="text-left font-medium hover:underline"
                onClick={() => handlers.onOpenDetail(suite, testCase)}
              >
                {testCase.title}
              </button>
            </TableCell>
            <TableCell className={CELL}>
              <div className="[&>div]:block">
                <TcPriorityMenu
                  testNo={testCase.test_no}
                  priority={testCase.priority}
                  updating={updatingPriorityIds.has(testCase.id)}
                  readOnly={!isAuthorized}
                  onChange={(priority) => handlers.onUpdatePriority(testCase, priority)}
                />
              </div>
            </TableCell>
            <TableCell className={CELL}>
              <PropertySelect
                id={`sheet-status-${testCase.id}`}
                value={testCase.status}
                options={statusOptions}
                disabled={!isAuthorized}
                className="h-7 w-full max-w-none border-0 shadow-none"
                onSelect={(v) => handlers.onUpdateStatus(testCase, String(v))}
              />
            </TableCell>
            <TableCell className={CELL}>
              <PropertySelect
                id={`sheet-fixed-${testCase.id}`}
                value={testCase.fixed}
                options={fixedOptions}
                className="h-7 w-full max-w-none border-0 shadow-none"
                onSelect={(v) => handlers.onUpdateFixed(testCase, String(v))}
              />
            </TableCell>
            <TableCell className={CELL}>
              <PropertySelect
                id={`sheet-dev-${testCase.id}`}
                value={testCase.assign_dev || "unassigned"}
                options={assigneeOptions}
                className="h-7 w-full max-w-none border-0 shadow-none"
                onSelect={(v) => handlers.onUpdateAssignDev(testCase, String(v))}
              />
            </TableCell>
            <TableCell
              className={cn(
                CELL,
                "text-xs tabular-nums",
                testCase.passed_at ? "text-success" : "text-muted-foreground",
              )}
            >
              {formatDateTime(testCase.passed_at, locale) || "—"}
            </TableCell>
            <TableCell className={CELL}>
              <TcRowActions
                testCase={testCase}
                isAuthorized={isAuthorized}
                onOpenEditor={() => handlers.onOpenEditor(suite.id, testCase.id)}
                onDelete={() => handlers.onDeleteCase(testCase.id)}
              />
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={9} className={cn(CELL, "py-6 text-center text-muted-foreground")}>
              {t("testCases__empty_suite")}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
