"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomDatePicker } from "@/components/shared/custom-date-picker";
import { useI18n } from "@/lib/i18n";
import type { Assignee, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BattleHealthDashboard } from "./battle-health-dashboard";

type Period = "7d" | "1m" | "3m" | "1y" | "all" | "custom";
const PERIODS: Period[] = ["7d", "1m", "3m", "1y", "all", "custom"];

type WorkloadItem = {
  assigneeId: string | number | null;
  assigneeName: string;
  color: string;
  total: number;
  todo: number;
  inProgress: number;
  inTest: number;
  done: number;
  overdue: number;
  totalMinutes: number;
  activeLoadScore: number;
};

export interface WorkloadViewProps {
  tasks?: Task[];
  assignees?: Assignee[];
  onSelectAssignee?: (detail: { assigneeId: string | number | "all" | null }) => void;
}

function isOverdue(task: Task) {
  if (!task.date || task.status === "done") return false;
  const today = new Date();
  const due = new Date(task.date);
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

function filterByPeriod(tasks: Task[], period: Period, start: string, end: string) {
  if (period === "all") return tasks;

  const now = new Date();
  now.setHours(23, 59, 59, 999);

  if (period === "custom") {
    const startDate = start ? new Date(start) : new Date(0);
    const endDate = end ? new Date(end) : new Date();
    endDate.setHours(23, 59, 59, 999);
    return tasks.filter((task) => {
      if (!task.date) return false;
      const d = new Date(task.date);
      return d >= startDate && d <= endDate;
    });
  }

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  if (period === "7d") startDate.setDate(now.getDate() - 7);
  else if (period === "1m") startDate.setMonth(now.getMonth() - 1);
  else if (period === "3m") startDate.setMonth(now.getMonth() - 3);
  else if (period === "1y") startDate.setFullYear(now.getFullYear() - 1);

  return tasks.filter((task) => {
    if (!task.date) return false;
    const d = new Date(task.date);
    return d >= startDate && d <= now;
  });
}

export function WorkloadView({ tasks = [], assignees = [], onSelectAssignee }: WorkloadViewProps) {
  const { t } = useI18n();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const workloadRows = useMemo<WorkloadItem[]>(() => {
    const filtered = filterByPeriod(tasks, selectedPeriod, customStartDate, customEndDate);
    const map = new Map<string | number | null, WorkloadItem>();
    const assigneeById = new Map<string | number, Assignee>(
      assignees
        .filter((assignee): assignee is Assignee & { id: string | number } => assignee.id !== undefined)
        .map((assignee) => [assignee.id, assignee]),
    );

    for (const task of filtered) {
      const assigneeIds: (string | number | null)[] = [
        ...(task.assignee_ids || (task.assignee_id ? [task.assignee_id] : [null])),
      ];
      if (assigneeIds.length === 0) assigneeIds.push(null);

      for (const key of assigneeIds) {
        const assignee = key === null ? null : assigneeById.get(key);
        let row = map.get(key);
        if (!row) {
          row = {
            assigneeId: key,
            assigneeName: assignee?.name ?? t("page__unassigned"),
            color: assignee?.color ?? "#94a3b8",
            total: 0,
            todo: 0,
            inProgress: 0,
            inTest: 0,
            done: 0,
            overdue: 0,
            totalMinutes: 0,
            activeLoadScore: 0,
          };
          map.set(key, row);
        }

        row.total += 1;
        row.totalMinutes += task.duration_minutes || 0;
        if (task.status === "todo" || task.status === "pending") row.todo += 1;
        if (task.status === "in-progress") row.inProgress += 1;
        if (task.status === "in-test") row.inTest += 1;
        if (task.status === "done") row.done += 1;
        if (isOverdue(task)) row.overdue += 1;
      }
    }

    for (const row of map.values()) {
      row.activeLoadScore = row.todo + row.inProgress * 2 + row.inTest * 1.5 + row.overdue * 3;
    }

    return [...map.values()].sort((a, b) => {
      if (b.activeLoadScore !== a.activeLoadScore) return b.activeLoadScore - a.activeLoadScore;
      if (b.overdue !== a.overdue) return b.overdue - a.overdue;
      return b.total - a.total;
    });
  }, [tasks, assignees, selectedPeriod, customStartDate, customEndDate, t]);

  const summaryCards = [
    { label: t("workload__total_people"), value: workloadRows.length, className: "" },
    {
      label: t("workload__overdue_tasks"),
      value: workloadRows.reduce((sum, row) => sum + row.overdue, 0),
      className: "text-destructive ",
    },
    {
      label: t("workload__active_tasks"),
      value: workloadRows.reduce((sum, row) => sum + row.todo + row.inProgress + row.inTest, 0),
      className: "",
    },
  ];

  const headers: { key: string; align: string }[] = [
    { key: "workload__person", align: "text-left" },
    { key: "workload__todo", align: "text-right" },
    { key: "workload__in_progress", align: "text-right" },
    { key: "workload__in_test", align: "text-right" },
    { key: "workload__overdue", align: "text-right" },
    { key: "workload__done", align: "text-right" },
    { key: "workload__total", align: "text-right" },
    { key: "workload__score", align: "text-right" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="size-4 text-muted-foreground" />
        <Tabs
          value={selectedPeriod}
          onValueChange={(value) => {
            setSelectedPeriod(value as Period);
            setShowCustomPicker(value === "custom");
          }}
        >
          <TabsList>
            {PERIODS.map((period) => (
              <TabsTrigger key={period} value={period}>
                {t(`workload__filter_${period}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {(selectedPeriod === "custom" || showCustomPicker) && (
          <div className="flex items-center gap-2">
            <div className="w-44">
              <CustomDatePicker
                value={customStartDate}
                onValueChange={setCustomStartDate}
                placeholder={t("page__filter_start_date")}
              />
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            <div className="w-44">
              <CustomDatePicker
                value={customEndDate}
                onValueChange={setCustomEndDate}
                placeholder={t("page__filter_end_date")}
              />
            </div>
          </div>
        )}
      </div>

      <BattleHealthDashboard tasks={tasks} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {summaryCards.map((card) => (
          <Card key={card.label} className="gap-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold tabular-nums", card.className)}>{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header.key} className={cn("px-4", header.align)}>
                  {t(header.key)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {workloadRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  {t("workload__no_data")}
                </TableCell>
              </TableRow>
            ) : (
              workloadRows.map((row) => (
                <TableRow key={String(row.assigneeId)}>
                  <TableCell className="px-4">
                    <button
                      type="button"
                      className="text-left font-medium hover:underline"
                      onClick={() => onSelectAssignee?.({ assigneeId: row.assigneeId })}
                    >
                      {row.assigneeName}
                    </button>
                  </TableCell>
                  <TableCell className="px-4 text-right tabular-nums">{row.todo}</TableCell>
                  <TableCell className="px-4 text-right tabular-nums">{row.inProgress}</TableCell>
                  <TableCell className="px-4 text-right tabular-nums">{row.inTest}</TableCell>
                  <TableCell
                    className={cn("px-4 text-right tabular-nums", row.overdue > 0 && "font-medium text-destructive")}
                  >
                    {row.overdue}
                  </TableCell>
                  <TableCell className="px-4 text-right tabular-nums">{row.done}</TableCell>
                  <TableCell className="px-4 text-right tabular-nums">{row.total}</TableCell>
                  <TableCell className="px-4 text-right font-medium tabular-nums">
                    {row.activeLoadScore.toFixed(1)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
