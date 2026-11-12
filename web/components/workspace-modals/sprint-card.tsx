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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import type { Sprint } from "@/lib/types";
import { formatDuration, formatSprintDate } from "./sprint-utils";

const STATUS_BADGE_VARIANT: Record<Sprint["status"], "default" | "secondary" | "outline"> = {
  active: "default",
  completed: "secondary",
  planned: "outline",
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
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h4 className="truncate font-medium">{sprint.name}</h4>
            <Badge variant={STATUS_BADGE_VARIANT[sprint.status]}>{statusLabel}</Badge>
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>
              {formatSprintDate(sprint.start_date)} - {formatSprintDate(sprint.end_date)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar size={12} />
              {formatDuration(t, sprint.start_date, sprint.end_date)}
            </span>
            {sprint.completed_at && (
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 size={12} />
                {t("sprintManager__completed_on", { date: formatSprintDate(sprint.completed_at) })}
              </span>
            )}
          </p>

          {sprint.scope && (
            <p className="mt-2 line-clamp-3 text-sm whitespace-pre-line text-muted-foreground">{sprint.scope}</p>
          )}

          {sprint.status === "completed" ? (
            <p className="mt-2 text-sm">
              <Archive size={14} className="mr-1 inline text-muted-foreground" />
              {t("sprintManager__archived_tasks", { count: sprint.archived_count || 0 })}
              <span className="ml-1 text-muted-foreground">
                {sprint.archived_count ? t("sprintManager__archived_tasks_done") : t("sprintManager__no_tasks")}
              </span>
            </p>
          ) : (
            <p className="mt-2 text-sm tabular-nums">
              {stats.done}/{stats.total} {t("sprintManager__tasks_done")}
              {stats.total > 0 && (
                <span className="text-muted-foreground"> ({Math.round((stats.done / stats.total) * 100)}%)</span>
              )}
            </p>
          )}

          {stats.total > 0 && <Progress value={(stats.done / stats.total) * 100} className="mt-2 h-1.5" />}
        </div>

        {isOwner && (
          <div className="flex items-center gap-1">
            {(sprint.status === "completed" || sprint.status === "active") && (
              <>
                <ActionButton icon={FileText} title={t("sprintManager__view_markdown_hint")} onClick={onViewMarkdown} />
                <ActionButton icon={Eye} title={t("sprintManager__view_done_tasks_hint")} onClick={onViewDoneTasks} />
                <ActionButton
                  icon={FileCode}
                  title={t("sprintManager__export_markdown_hint")}
                  onClick={onExportMarkdown}
                />
                {sprint.status === "completed" && (
                  <ActionButton icon={Video} title={t("sprintManager__export_video_hint")} onClick={onExportVideo} />
                )}
              </>
            )}

            {sprint.status === "planned" && (
              <ActionButton icon={Play} title={t("sprintManager__start_hint")} onClick={onStart} />
            )}

            {sprint.status === "active" && (
              <ActionButton icon={CheckCircle2} title={t("sprintManager__complete_hint")} onClick={onComplete} />
            )}

            <ActionButton icon={Edit2} title={t("common.update")} onClick={onEdit} />

            {sprint.status !== "active" && (
              <ActionButton
                icon={X}
                title={t("workerManager__btn_delete")}
                className="text-destructive hover:text-destructive"
                onClick={onDelete}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
