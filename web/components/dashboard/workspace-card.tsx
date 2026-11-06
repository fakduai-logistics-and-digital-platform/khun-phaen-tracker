"use client";

import { ArrowRight, Check, Copy, Pencil, Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getWorkspaceIcon } from "@/lib/dashboard/workspace-options";
import { useI18n } from "@/lib/i18n";
import type { Workspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export interface WorkspaceCardProps {
  workspace: Workspace;
  variant: "grid" | "list";
  pinned: boolean;
  isOwner: boolean;
  taskCount?: number | null;
  copied: boolean;
  createdLabel: string;
  onOpen: () => void;
  onTogglePin: () => void;
  onCopyLink: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function WorkspaceBadges({ isOwner, taskCount }: { isOwner: boolean; taskCount?: number | null }) {
  const { t } = useI18n();
  return (
    <>
      {taskCount !== undefined && taskCount !== null && (
        <Badge variant="secondary" className="text-[10px]">
          {t("dashboard__card_tasks", { count: taskCount })}
        </Badge>
      )}
      {isOwner ? (
        <Badge className="bg-primary/10 text-[10px] font-bold text-primary hover:bg-primary/10">
          {t("dashboard__card_owner_badge")}
        </Badge>
      ) : (
        <Badge variant="secondary" className="text-[10px] font-bold">
          {t("dashboard__card_member_badge")}
        </Badge>
      )}
    </>
  );
}

function ActionButtons(props: WorkspaceCardProps & { size: number }) {
  const { t } = useI18n();
  const { pinned, copied, isOwner, size } = props;
  const base = "rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent";
  return (
    <>
      <button
        type="button"
        onClick={props.onTogglePin}
        className={cn(base, pinned ? "text-amber-500" : "hover:text-amber-500")}
        title={pinned ? t("dashboard__btn_unpin") : t("dashboard__btn_pin")}
        aria-label={pinned ? t("dashboard__btn_unpin") : t("dashboard__btn_pin")}
      >
        <Star size={size} fill={pinned ? "currentColor" : "none"} />
      </button>
      <button
        type="button"
        onClick={props.onCopyLink}
        className={cn(base, copied && "text-success")}
        title={copied ? t("dashboard__copy_success") : t("dashboard__btn_copy_link")}
        aria-label={t("dashboard__btn_copy_link")}
      >
        {copied ? <Check size={size} /> : <Copy size={size} />}
      </button>
      {isOwner && (
        <>
          <button
            type="button"
            onClick={props.onEdit}
            className={cn(base, "hover:text-primary")}
            title={t("dashboard__btn_edit")}
            aria-label={t("dashboard__btn_edit")}
          >
            <Pencil size={size} />
          </button>
          <button
            type="button"
            onClick={props.onDelete}
            className={cn(base, "hover:text-destructive")}
            title={t("dashboard__btn_delete")}
            aria-label={t("dashboard__btn_delete")}
          >
            <Trash2 size={size} />
          </button>
        </>
      )}
    </>
  );
}

export function WorkspaceCard(props: WorkspaceCardProps) {
  const { t } = useI18n();
  const { workspace: ws, variant, pinned, isOwner, taskCount, createdLabel, onOpen } = props;
  const Icon = getWorkspaceIcon(ws.icon);
  const color = ws.color || "#6366f1";
  const iconStyle = { backgroundColor: `${color}1a`, color };
  const border = pinned ? "border-amber-200 dark:border-amber-500/30" : "border-border";

  if (variant === "list") {
    return (
      <div
        className={cn(
          "group flex items-center gap-4 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-accent/40",
          border,
        )}
      >
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-4 text-left">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg" style={iconStyle}>
            <Icon size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{ws.name}</span>
            <span className="block text-[11px] text-muted-foreground">
              {t("dashboard__card_created", { date: createdLabel })}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <WorkspaceBadges isOwner={isOwner} taskCount={taskCount} />
          <ActionButtons {...props} size={14} />
          <ArrowRight size={14} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex h-full w-full flex-col rounded-xl border bg-card p-5 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          border,
        )}
      >
        <span className="mb-3 flex size-10 shrink-0 items-center justify-center rounded-lg" style={iconStyle}>
          <Icon size={20} />
        </span>
        <h3 className="mb-1 line-clamp-2 text-base font-semibold">{ws.name}</h3>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {t("dashboard__card_created", { date: createdLabel })}
          </span>
          <WorkspaceBadges isOwner={isOwner} taskCount={taskCount} />
        </div>
        <div className="mt-auto flex items-center justify-end border-t pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 font-medium transition-colors group-hover:text-primary">
            {t("dashboard__btn_open")}
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </button>
      <div className="absolute right-3 top-3 z-10 flex gap-1 rounded-lg bg-card p-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <ActionButtons {...props} size={15} />
      </div>
    </div>
  );
}
