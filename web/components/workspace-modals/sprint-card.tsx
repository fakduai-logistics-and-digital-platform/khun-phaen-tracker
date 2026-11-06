"use client";

import {
  Archive,
  Calendar,
  CheckCircle2,
  Edit2,
  Eye,
  FileCode,
  FileText,
  Play,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import type { Sprint } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatDuration, formatSprintDate } from "./sprint-utils";

const STATUS_ICON_CLASS: Record<Sprint["status"], string> = {
  active: "bg-success text-white",
  completed: "bg-gray-400 text-white",
  planned: "bg-muted-foreground/20 text-muted-foreground",
};

const STATUS_BADGE_CLASS: Record<Sprint["status"], string> = {
  active: "bg-success text-success ",
  completed: "bg-muted text-muted-foreground",
  planned: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

function ActionButton({
  icon: Icon,
  title,
  className,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  className?: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={className}
    >
      <Icon size={16} />
    </Button>
  );
}

export function SprintCard({
  sprint,
  stats,
  isOwner,
  onViewMarkdown,
  onViewDoneTasks,
  onExportMarkdown,
  onExportVideo,
  onStart,
  onComplete,
  onEdit,
  onDelete,
}: {
  sprint: Sprint;
  stats: { total: number; done: number };
  isOwner: boolean;
  onViewMarkdown: () => void;
  onViewDoneTasks: () => void;
  onExportMarkdown: () => void;
  onExportVideo: () => void;
  onStart: () => void;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const statusLabel =
    sprint.status === "active"
      ? t("sprintManager__status_active")
      : sprint.status === "completed"
        ? t("sprintManager__status_completed")
        : t("sprintManager__status_planned");

  return (
    <div className="rounded-lg bg-muted/60 p-4 transition-colors">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            STATUS_ICON_CLASS[sprint.status],
          )}
        >
          {sprint.status === "active" ? (
            <Play size={18} />
          ) : sprint.status === "completed" ? (
            <CheckCircle2 size={18} />
          ) : (
            <Calendar size={18} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h4 className="truncate font-semibold">{sprint.name}</h4>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_BADGE_CLASS[sprint.status])}>
              {statusLabel}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatSprintDate(sprint.start_date)} - {formatSprintDate(sprint.end_date)}
            <span className="ml-1 inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs">
              <Calendar size={10} />
              {formatDuration(t, sprint.start_date, sprint.end_date)}
            </span>
            {sprint.completed_at && (
              <span className="ml-1 inline-flex items-center gap-1 rounded bg-success px-1.5 py-0.5 text-xs text-success">
                <CheckCircle2 size={10} />
                {t("sprintManager__completed_on", { date: formatSprintDate(sprint.completed_at) })}
              </span>
            )}
          </p>

          {sprint.status === "completed" ? (
            <p className="mt-1 text-sm">
              <Archive size={14} className="mr-1 inline text-muted-foreground" />
              {t("sprintManager__archived_tasks", { count: sprint.archived_count || 0 })}
              <span className="ml-1 text-muted-foreground">
                {sprint.archived_count ? t("sprintManager__archived_tasks_done") : t("sprintManager__no_tasks")}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-sm">
              {stats.done}/{stats.total} {t("sprintManager__tasks_done")}
              {stats.total > 0 && (
                <span className="text-muted-foreground"> ({Math.round((stats.done / stats.total) * 100)}%)</span>
              )}
            </p>
          )}

          {stats.total > 0 && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted-foreground/20">
              <div
                className="h-full bg-success transition-colors"
                style={{ width: `${(stats.done / stats.total) * 100}%` }}
              />
            </div>
          )}
        </div>

        {isOwner && (
          <div className="flex items-center gap-1">
            {(sprint.status === "completed" || sprint.status === "active") && (
              <>
                <ActionButton
                  icon={FileText}
                  title={t("sprintManager__view_markdown_hint")}
                  className="text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                  onClick={onViewMarkdown}
                />
                <ActionButton
                  icon={Eye}
                  title={t("sprintManager__view_done_tasks_hint")}
                  className="text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20"
                  onClick={onViewDoneTasks}
                />
                <ActionButton
                  icon={FileCode}
                  title={t("sprintManager__export_markdown_hint")}
                  className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  onClick={onExportMarkdown}
                />
                {sprint.status === "completed" && (
                  <ActionButton
                    icon={Video}
                    title={t("sprintManager__export_video_hint")}
                    className="text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                    onClick={onExportVideo}
                  />
                )}
              </>
            )}

            {sprint.status === "planned" && (
              <ActionButton
                icon={Play}
                title={t("sprintManager__start_hint")}
                className="text-success hover:bg-success dark:hover:bg-success/20"
                onClick={onStart}
              />
            )}

            {sprint.status === "active" && (
              <ActionButton
                icon={CheckCircle2}
                title={t("sprintManager__complete_hint")}
                className="text-success hover:bg-success dark:hover:bg-success/20"
                onClick={onComplete}
              />
            )}

            <ActionButton icon={Edit2} title={t("common.update")} onClick={onEdit} />

            {sprint.status !== "active" && (
              <ActionButton
                icon={X}
                title={t("workerManager__btn_delete")}
                className="text-destructive hover:bg-destructive/10"
                onClick={onDelete}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
