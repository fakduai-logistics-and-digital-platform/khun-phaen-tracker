"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Calendar, CheckCircle2, FileCode, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n";
import type { Sprint, Task } from "@/lib/types";
import { formatDuration, formatSprintDate, getStatusLabel, getTaskAssigneeLabel } from "./sprint-utils";

export function MoveTasksDialog({
  pending,
  taskCount,
  onConfirm,
  onCancel,
}: {
  pending: { name: string; start_date: string; end_date: string } | null;
  taskCount: number;
  onConfirm: (moveTasks: boolean) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog open={pending !== null} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-md">
        {pending && (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>{t("sprintManager__btn_create_new")}</DialogTitle>
              <DialogDescription>{t("sprintManager__move_tasks_subtitle")}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium">{pending.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSprintDate(pending.start_date)} - {formatSprintDate(pending.end_date)}
                  <span className="ml-1 inline-flex items-center gap-1">
                    <Calendar size={10} />
                    {formatDuration(t, pending.start_date, pending.end_date)}
                  </span>
                </p>
              </div>

              {taskCount > 0 && (
                <div className="rounded-lg border p-3">
                  <p
                    className="text-sm"
                    dangerouslySetInnerHTML={{ __html: t("sprintManager__tasks_to_move", { count: taskCount }) }}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{t("sprintManager__tasks_to_move_hint")}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button type="button" onClick={() => onConfirm(true)} className="flex-1">
                <CheckCircle2 size={16} />
                {t("sprintManager__btn_create_and_move")}
              </Button>
              <Button type="button" variant="outline" onClick={() => onConfirm(false)}>
                {t("sprintManager__btn_create_only")}
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                {t("common.cancel")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function SprintMarkdownDialog({
  sprint,
  text,
  onClose,
}: {
  sprint: Sprint | null;
  text: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [sprint]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (error) {
      console.error("Copy markdown failed", error);
    }
  }

  return (
    <Dialog open={sprint !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b p-5 pr-14 text-left">
          <DialogTitle className="text-lg font-medium">{t("sprintManager__markdown_modal_title")}</DialogTitle>
          <DialogDescription>{sprint?.name}</DialogDescription>
        </DialogHeader>
        <div className="overflow-auto p-5">
          <div className="mb-3 flex justify-end">
            <Button type="button" size="sm" variant={copied ? "secondary" : "default"} onClick={() => void copy()}>
              {copied ? t("sprintManager__copied") : t("sprintManager__copy_markdown")}
            </Button>
          </div>
          <textarea
            readOnly
            value={text}
            aria-label={t("sprintManager__markdown_modal_title")}
            className="min-h-[360px] w-full resize-y rounded-md border border-input bg-transparent p-4 font-mono text-sm leading-6 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CompletedTasksDialog({
  sprint,
  tasks,
  onClose,
}: {
  sprint: Sprint | null;
  tasks: Task[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const completedTasks = sprint
    ? tasks.filter((task) => String(task.sprint_id) === String(sprint.id) && task.status === "done")
    : [];

  return (
    <Dialog open={sprint !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="border-b p-5 pr-14 text-left">
          <DialogTitle className="text-lg font-medium">{t("sprintManager__done_tasks_title")}</DialogTitle>
          <DialogDescription>
            {sprint?.name} • {t("sprintManager__done_count", { count: completedTasks.length })}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-auto p-5">
          {completedTasks.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">{t("sprintManager__done_tasks_empty")}</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">#</TableHead>
                    <TableHead>{t("tableView__column_title")}</TableHead>
                    <TableHead>{t("tableView__column_assignee")}</TableHead>
                    <TableHead>{t("tableView__column_category")}</TableHead>
                    <TableHead>{t("tableView__column_date_short")}</TableHead>
                    <TableHead>{t("tableView__column_status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedTasks.map((task, index) => (
                    <TableRow key={task.id}>
                      <TableCell className="px-4 text-muted-foreground tabular-nums">{index + 1}</TableCell>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell className="text-muted-foreground">{getTaskAssigneeLabel(t, task)}</TableCell>
                      <TableCell className="text-muted-foreground">{task.category || "-"}</TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {task.date ? formatSprintDate(task.date) : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{getStatusLabel(t, task.status)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CompleteSprintDialog({
  sprintId,
  tasks,
  onConfirm,
  onConfirmWithExport,
  onCancel,
}: {
  sprintId: string | number | null;
  tasks: Task[];
  onConfirm: () => void;
  onConfirmWithExport: (format: "markdown" | "video") => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const sprintTasks = sprintId === null ? [] : tasks.filter((task) => String(task.sprint_id) === String(sprintId));
  const completedCount = sprintTasks.filter((task) => task.status === "done").length;
  const incompleteCount = sprintTasks.length - completedCount;

  return (
    <Dialog open={sprintId !== null} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>{t("sprintManager__complete_title")}</DialogTitle>
          <DialogDescription>{t("sprintManager__complete_subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border p-3">
            <p className="text-sm">
              <CheckCircle2 size={14} className="mr-1 inline" />
              <span
                dangerouslySetInnerHTML={{
                  __html: t("sprintManager__completed_tasks_msg", { count: completedCount }),
                }}
              />
            </p>
          </div>

          {incompleteCount > 0 && (
            <div className="rounded-lg border p-3">
              <p className="text-sm">
                <AlertCircle size={14} className="mr-1 inline" />
                <span
                  dangerouslySetInnerHTML={{
                    __html: t("sprintManager__incomplete_tasks_msg", { count: incompleteCount }),
                  }}
                />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t("sprintManager__incomplete_tasks_wait")}</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Button type="button" onClick={onConfirm} className="w-full">
            <CheckCircle2 />
            {t("sprintManager__btn_confirm_complete")}
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs whitespace-nowrap text-muted-foreground">ส่งออกพร้อมจบ Sprint</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onConfirmWithExport("markdown")}>
              <FileCode />
              {t("sprintManager__btn_complete_export_md")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onConfirmWithExport("video")}>
              <Video />
              {t("sprintManager__btn_complete_export_video")}
            </Button>
          </div>

          <Button type="button" variant="outline" onClick={onCancel} className="w-full">
            {t("common.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
