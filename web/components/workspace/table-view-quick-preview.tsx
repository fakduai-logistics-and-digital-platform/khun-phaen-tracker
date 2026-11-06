"use client";

import { Calendar, Edit2, Eye, Folder } from "lucide-react";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { currentWorkspaceShortName } from "@/lib/stores/workspace";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { tOr } from "./t-or";
import {
  dueDateOf,
  formatDateFull,
  getStatusClass,
  getStatusIcon,
  getStatusLabel,
  isOverdue,
} from "./table-view-config";

const FIELD_LABEL = "w-20 shrink-0 text-xs font-medium text-muted-foreground ";

export function TableViewQuickPreview({
  task,
  onClose,
  onOpenFull,
}: {
  task: Task | null;
  onClose: () => void;
  onOpenFull: (task: Task) => void;
}) {
  const { t } = useI18n();
  const shortName = useStore(currentWorkspaceShortName);
  const previewLabel = tOr(t, "tableView__quick_preview", "Quick preview");

  const due = task ? dueDateOf(task) : "";
  const checklist = task?.checklist ?? [];
  const completed = checklist.filter((i) => i.completed).length;
  const StatusIcon = task ? getStatusIcon(task.status) : null;

  return (
    <Dialog open={task !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton className="z-[10000] max-w-md gap-0 overflow-hidden rounded-lg p-0 sm:max-w-md">
        {task && StatusIcon && (
          <>
            <div className="flex items-center gap-2 border-b bg-muted/50 px-5 py-3">
              <Eye size={16} className="text-indigo-500" />
              <DialogTitle className="text-sm font-semibold">{previewLabel}</DialogTitle>
              <DialogDescription className="sr-only">{task.title}</DialogDescription>
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
              <div>
                {task.task_number && (
                  <span className="text-xs font-medium text-muted-foreground">
                    {task.workspace_short_name || shortName || "TASK"}-{task.task_number}
                  </span>
                )}
                <h2 className="mt-0.5 text-lg leading-snug font-medium">{task.title}</h2>
              </div>

              <div className="flex items-center gap-2">
                <span className={FIELD_LABEL}>{t("tableView__column_priority")}</span>
                <PriorityBadge priority={task.priority} />
                {(!task.priority || task.priority === "none") && (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className={FIELD_LABEL}>{t("tableView__column_status")}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                    getStatusClass(task.status, task.is_archived),
                  )}
                >
                  <StatusIcon size={12} />
                  {getStatusLabel(task.status, t, task.is_archived)}
                </span>
              </div>

              <div className="flex items-start gap-2">
                <span className={cn(FIELD_LABEL, "pt-1")}>{t("tableView__column_assignee")}</span>
                <div className="flex flex-wrap gap-2">
                  {task.assignees && task.assignees.length > 0 ? (
                    task.assignees.map((assignee, i) => (
                      <div
                        key={`${assignee.id ?? i}`}
                        className="flex items-center gap-1.5 rounded-full bg-muted py-0.5 pr-2.5 pl-0.5"
                      >
                        <div
                          className="flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: assignee.color || "#6366f1" }}
                        >
                          {assignee.avatar_url ? (
                            <img
                              src={assignee.avatar_url}
                              alt={assignee.name}
                              className="size-full rounded-full object-cover"
                            />
                          ) : (
                            assignee.name?.[0]?.toUpperCase() || "?"
                          )}
                        </div>
                        <span className="text-xs">{assignee.name}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </div>

              <div>
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  {tOr(t, "tableView__notes_label", "Notes")}
                </span>
                {task.notes ? (
                  <div className="max-h-48 overflow-y-auto rounded-lg border bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap">
                    {task.notes}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">{tOr(t, "tableView__no_notes", "No notes")}</span>
                )}
              </div>

              {due && (
                <div className="flex items-center gap-2">
                  <span className={FIELD_LABEL}>{t("tableView__column_due_date")}</span>
                  <span className="flex items-center gap-1 text-xs">
                    <Calendar size={12} />
                    {formatDateFull(due)}
                    {isOverdue(due, task.status, task.is_archived) && (
                      <span className="ml-1 font-medium text-destructive">{t("tableView__overdue_label")}</span>
                    )}
                  </span>
                </div>
              )}

              {task.project && (
                <div className="flex items-center gap-2">
                  <span className={FIELD_LABEL}>{t("tableView__column_project")}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                    <Folder size={10} />
                    {task.project}
                  </span>
                </div>
              )}

              {checklist.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className={FIELD_LABEL}>Checklist</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full transition-colors",
                          completed === checklist.length ? "bg-success" : "bg-blue-500",
                        )}
                        style={{ width: `${(completed / checklist.length) * 100}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-xs font-medium",
                        completed === checklist.length ? "text-success" : "text-muted-foreground",
                      )}
                    >
                      {completed}/{checklist.length}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t bg-muted/50 px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
              >
                {tOr(t, "tableView__close", "Close")}
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFull(task);
                }}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Edit2 size={12} />
                {tOr(t, "tableView__open_full", "Open full")}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
