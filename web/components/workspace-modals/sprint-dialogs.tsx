"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Calendar, CheckCircle2, FileCode, Flag, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import type { Sprint, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
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
            <DialogHeader className="flex-row items-center gap-3 text-left">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Flag size={24} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-medium">สร้าง Sprint ใหม่</DialogTitle>
                <DialogDescription>{t("sprintManager__move_tasks_subtitle")}</DialogDescription>
              </div>
            </DialogHeader>

            <div className="space-y-3">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">{pending.name}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  {formatSprintDate(pending.start_date)} - {formatSprintDate(pending.end_date)}
                  <span className="ml-1 inline-flex items-center gap-1">
                    <Calendar size={10} />
                    {formatDuration(t, pending.start_date, pending.end_date)}
                  </span>
                </p>
              </div>

              {taskCount > 0 && (
                <div className="rounded-lg border bg-muted/50 p-3">
                  <p
                    className="text-sm"
                    dangerouslySetInnerHTML={{ __html: t("sprintManager__tasks_to_move", { count: taskCount }) }}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{t("sprintManager__tasks_to_move_hint")}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => onConfirm(true)}
                className="flex-1 bg-blue-600 text-sm text-white hover:bg-blue-700"
              >
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
            <Button
              type="button"
              size="sm"
              onClick={() => void copy()}
              className={cn(
                copied ? "bg-success text-success hover:bg-success " : "bg-indigo-600 text-white hover:bg-indigo-700",
              )}
            >
              {copied ? t("sprintManager__copied") : t("sprintManager__copy_markdown")}
            </Button>
          </div>
          <textarea
            readOnly
            value={text}
            aria-label={t("sprintManager__markdown_modal_title")}
            className="min-h-[360px] w-full resize-y rounded-lg border bg-muted/50 p-4 font-mono text-sm leading-6 focus:outline-none"
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
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">#</th>
                    <th className="px-4 py-3 text-left font-semibold">{t("tableView__column_title")}</th>
                    <th className="px-4 py-3 text-left font-semibold">{t("tableView__column_assignee")}</th>
                    <th className="px-4 py-3 text-left font-semibold">{t("tableView__column_category")}</th>
                    <th className="px-4 py-3 text-left font-semibold">{t("tableView__column_date_short")}</th>
                    <th className="px-4 py-3 text-left font-semibold">{t("tableView__column_status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {completedTasks.map((task, index) => (
                    <tr key={task.id} className="transition-colors hover:bg-accent/40">
                      <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                      <td className="px-4 py-3 font-medium">{task.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">{getTaskAssigneeLabel(t, task)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{task.category || "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {task.date ? formatSprintDate(task.date) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-success px-2 py-0.5 text-xs font-medium text-success">
                          {getStatusLabel(t, task.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        <DialogHeader className="flex-row items-center gap-3 text-left">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-success">
            <CheckCircle2 size={24} className="text-success" />
          </div>
          <div>
            <DialogTitle className="text-lg font-medium">{t("sprintManager__complete_title")}</DialogTitle>
            <DialogDescription>{t("sprintManager__complete_subtitle")}</DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-success bg-success p-3">
            <p className="text-sm text-success">
              <CheckCircle2 size={14} className="mr-1 inline" />
              <span
                dangerouslySetInnerHTML={{
                  __html: t("sprintManager__completed_tasks_msg", { count: completedCount }),
                }}
              />
            </p>
          </div>

          {incompleteCount > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <AlertCircle size={14} className="mr-1 inline" />
                <span
                  dangerouslySetInnerHTML={{
                    __html: t("sprintManager__incomplete_tasks_msg", { count: incompleteCount }),
                  }}
                />
              </p>
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                {t("sprintManager__incomplete_tasks_wait")}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Button
            type="button"
            onClick={onConfirm}
            className="h-auto w-full bg-success py-2.5 text-base font-semibold text-white hover:bg-success"
          >
            <CheckCircle2 size={18} />
            {t("sprintManager__btn_confirm_complete")}
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs whitespace-nowrap text-muted-foreground">ส่งออกพร้อมจบ Sprint</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onConfirmWithExport("markdown")}
              className="text-xs text-muted-foreground hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20"
            >
              <FileCode size={13} />
              {t("sprintManager__btn_complete_export_md")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onConfirmWithExport("video")}
              className="text-xs text-muted-foreground hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-900/20"
            >
              <Video size={13} />
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
