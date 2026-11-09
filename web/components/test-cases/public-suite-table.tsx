"use client";

import {
  AlertOctagon,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  MinusCircle,
  SkipForward,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatDateTime, TcTimes } from "./tc-times";
import { fixedLabel, priorityLabel, priorityVariant, resultVariant, statusLabel } from "./public-labels";
import type { PublicSuite } from "./public-model";

function RunResultIcon({ status }: { status: string }) {
  switch (status) {
    case "passed":
      return <CheckCircle2 />;
    case "failed":
      return <XCircle />;
    case "blocked":
      return <MinusCircle />;
    case "skipped":
      return <SkipForward />;
    case "invalid":
      return <AlertOctagon />;
    default:
      return <Clock />;
  }
}

// Spreadsheet-style grid: every cell has a hairline border on its right and bottom edge.
const CELL = "h-9 border-r border-b px-3 py-1.5 last:border-r-0";

export type PublicView = "table" | "list";

type PublicSuiteTableProps = {
  suite: PublicSuite;
  view: PublicView;
  hasRun: boolean;
  runCaseMap: Map<string, string>;
  onToggle: (id: string) => void;
};

export function PublicSuiteTable({ suite, view, hasRun, runCaseMap, onToggle }: PublicSuiteTableProps) {
  const { t, locale } = useI18n();

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-6 py-4 text-left transition-colors hover:bg-accent/50"
        aria-expanded={!suite.collapsed}
        onClick={() => onToggle(suite.id)}
      >
        {suite.collapsed ? (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        )}
        <h2 className="text-base font-semibold">{suite.title}</h2>
        <Badge variant="secondary" className="tabular-nums">
          {suite.case_count}
        </Badge>
      </button>

      {!suite.collapsed && view === "list" && (
        <ul className="divide-y border-t">
          {suite.cases.map((tc) => {
            const runStatus = runCaseMap.get(tc.id);
            return (
              <li key={tc.id} className="flex flex-col gap-2 px-6 py-3">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-sm text-muted-foreground">TC-{tc.test_no}</span>
                  <span className="text-sm font-medium">{tc.title}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={priorityVariant(tc.priority)}>{priorityLabel(tc.priority)}</Badge>
                  <Badge variant={resultVariant(tc.status)}>{statusLabel(tc.status)}</Badge>
                  <Badge variant={tc.fixed === "yes" ? "secondary" : "outline"}>{fixedLabel(tc.fixed)}</Badge>
                  {hasRun && runStatus && (
                    <Badge variant={resultVariant(runStatus)}>
                      <RunResultIcon status={runStatus} />
                      {statusLabel(runStatus)}
                    </Badge>
                  )}
                  {tc.assign_dev !== "unassigned" && (
                    <span className="text-sm text-muted-foreground">{tc.assign_dev}</span>
                  )}
                </div>
                <TcTimes updatedAt={tc.updated_at} passedAt={tc.passed_at} />
              </li>
            );
          })}
          {suite.cases.length === 0 && (
            <li className="px-6 py-6 text-center text-sm text-muted-foreground">{t("tcpub__no_cases_in_suite")}</li>
          )}
        </ul>
      )}

      {!suite.collapsed && view === "table" && (
        <Table className="border-collapse border-t text-sm">
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead className={cn(CELL, "w-10 text-center text-muted-foreground")}>#</TableHead>
              <TableHead className={cn(CELL, "w-24")}>{t("tcpub__col_id")}</TableHead>
              <TableHead className={cn(CELL, "min-w-[360px]")}>{t("tcpub__col_title")}</TableHead>
              <TableHead className={cn(CELL, "w-32")}>{t("tcpub__col_priority")}</TableHead>
              <TableHead className={cn(CELL, "w-32")}>{t("tcpub__col_status")}</TableHead>
              <TableHead className={cn(CELL, "w-32")}>{t("tcpub__col_fixed")}</TableHead>
              {hasRun && <TableHead className={cn(CELL, "w-32")}>{t("tcpub__col_run_result")}</TableHead>}
              <TableHead className={cn(CELL, "min-w-40")}>{t("tcpub__col_developer")}</TableHead>
              <TableHead className={cn(CELL, "w-44")}>{t("tcTime__col_edited")}</TableHead>
              <TableHead className={cn(CELL, "w-44")}>{t("tcTime__col_passed")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suite.cases.map((tc, index) => {
              const runStatus = runCaseMap.get(tc.id);
              return (
                <TableRow key={tc.id} className="hover:bg-accent/40">
                  <TableCell className={cn(CELL, "bg-muted/60 text-center text-xs text-muted-foreground tabular-nums")}>
                    {index + 1}
                  </TableCell>
                  <TableCell className={cn(CELL, "font-mono text-muted-foreground")}>TC-{tc.test_no}</TableCell>
                  <TableCell className={cn(CELL, "whitespace-normal")}>{tc.title}</TableCell>
                  <TableCell className={CELL}>
                    <Badge variant={priorityVariant(tc.priority)}>{priorityLabel(tc.priority)}</Badge>
                  </TableCell>
                  <TableCell className={CELL}>
                    <Badge variant={resultVariant(tc.status)}>{statusLabel(tc.status)}</Badge>
                  </TableCell>
                  <TableCell className={CELL}>
                    <Badge variant={tc.fixed === "yes" ? "secondary" : "outline"}>{fixedLabel(tc.fixed)}</Badge>
                  </TableCell>
                  {hasRun && (
                    <TableCell className={CELL}>
                      {runStatus ? (
                        <Badge variant={resultVariant(runStatus)}>
                          <RunResultIcon status={runStatus} />
                          {statusLabel(runStatus)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className={cn(CELL, "text-muted-foreground")}>
                    {tc.assign_dev === "unassigned" ? "—" : tc.assign_dev}
                  </TableCell>
                  <TableCell className={cn(CELL, "text-xs text-muted-foreground tabular-nums")}>
                    {formatDateTime(tc.updated_at, locale) || "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      CELL,
                      "text-xs tabular-nums",
                      tc.passed_at ? "text-success" : "text-muted-foreground",
                    )}
                  >
                    {formatDateTime(tc.passed_at, locale) || "—"}
                  </TableCell>
                </TableRow>
              );
            })}
            {suite.cases.length === 0 && (
              <TableRow>
                <TableCell colSpan={hasRun ? 10 : 9} className={cn(CELL, "py-6 text-center text-muted-foreground")}>
                  {t("tcpub__no_cases_in_suite")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
