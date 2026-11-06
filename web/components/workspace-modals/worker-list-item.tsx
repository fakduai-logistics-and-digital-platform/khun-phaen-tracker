"use client";

import { Briefcase, Edit2, Link as LinkIcon, Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import type { Assignee } from "@/lib/types";
import { DEFAULT_WORKER_COLOR } from "./worker-colors";
import type { SystemUser } from "./worker-form";

export function WorkerListItem({
  worker,
  linkedUser,
  taskCount,
  isOwner,
  confirmingDelete,
  onEdit,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  worker: Assignee;
  linkedUser: SystemUser | null | undefined;
  taskCount: number;
  isOwner: boolean;
  confirmingDelete: boolean;
  onEdit: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  const { t } = useI18n();
  const isLinked = !!worker.user_id || !!linkedUser;
  const displayEmail = worker.email || linkedUser?.email;

  return (
    <>
      <div className="group flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm transition-colors hover:border-primary/30 hover:bg-accent/40">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-lg text-lg font-semibold text-white shadow-sm"
          style={{ backgroundColor: worker.color || DEFAULT_WORKER_COLOR }}
        >
          {worker.name.charAt(0)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate font-medium">{worker.name}</h4>
            {isLinked && (
              <div
                className="flex items-center gap-0.5 rounded bg-success/10 px-1.5 py-0.5 text-xs font-semibold text-success"
                title={`${t("workerManager__linked_status")}${displayEmail ? `: ${displayEmail}` : ""}`}
              >
                <LinkIcon size={8} />
                {t("workerManager__linked_status")}
              </div>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3">
            {displayEmail && (
              <div className="flex items-center gap-1 truncate text-xs font-medium text-muted-foreground">
                <Mail size={10} />
                <span className="truncate" title={displayEmail}>
                  {displayEmail}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Briefcase size={10} />
              <span>
                {taskCount} {t("workerManager__task_count_suffix")}
              </span>
            </div>
          </div>
        </div>

        {isOwner && (
          <div className="flex items-center gap-1 opacity-0 transition-colors group-focus-within:opacity-100 group-hover:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onEdit}
              title={t("workerManager__btn_edit")}
              aria-label={t("workerManager__btn_edit")}
            >
              <Edit2 size={14} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="hover:text-destructive"
              onClick={onRequestDelete}
              title={t("workerManager__btn_delete")}
              aria-label={t("workerManager__btn_delete")}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        )}
      </div>

      {confirmingDelete && (
        <div className="mt-2 mb-4 animate-in rounded-lg border border-destructive/20 bg-destructive/10 p-4 fade-in slide-in-from-top-2">
          <p className="mb-3 text-sm font-medium text-destructive">
            {t("workerManager__delete_confirm", { name: worker.name })}
            {taskCount > 0 && (
              <span className="mt-1 block text-xs opacity-80">{t("workerManager__delete_warning")}</span>
            )}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="destructive" size="sm" className="font-medium" onClick={onConfirmDelete}>
              {t("workerManager__confirm_delete")}
            </Button>
            <Button type="button" variant="outline" size="sm" className="font-medium" onClick={onCancelDelete}>
              {t("workerManager__btn_cancel")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
