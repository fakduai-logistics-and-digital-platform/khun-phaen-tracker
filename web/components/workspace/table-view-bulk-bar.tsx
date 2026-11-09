"use client";

import type { LucideIcon } from "lucide-react";
import { createPortal } from "react-dom";
import { CheckCircle2, Flag, Folder, QrCode, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n";

export interface TableViewBulkBarProps {
  count: number;
  onClear: () => void;
  onChangeStatus: () => void;
  onChangeProject: () => void;
  onChangeSprint: () => void;
  onExportQR: () => void;
  onDelete: () => void;
}

function BulkAction({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant={destructive ? "destructive" : "outline"}
          className="size-8"
          onClick={onClick}
          aria-label={label}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Floating bar fixed at the bottom centre of the screen while rows are selected (shadcn-admin DataTableBulkActions). */
export function TableViewBulkBar({
  count,
  onClear,
  onChangeStatus,
  onChangeProject,
  onChangeSprint,
  onExportQR,
  onDelete,
}: TableViewBulkBarProps) {
  const { t } = useI18n();
  const clear = t("tableView__btn_clear_selection");

  return createPortal(
    <div
      role="toolbar"
      aria-label={t("tableView__selected_count", { count })}
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border bg-background/95 p-2 shadow-xl backdrop-blur duration-200 animate-in fade-in slide-in-from-bottom-4"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="outline" size="icon" className="size-8" onClick={onClear} aria-label={clear}>
            <X />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{clear}</TooltipContent>
      </Tooltip>
      <Badge variant="secondary" className="min-w-8 rounded-full tabular-nums">
        {count}
      </Badge>
      <span className="pe-1 text-sm font-medium">{t("tableView__selected_label")}</span>
      <BulkAction icon={CheckCircle2} label={t("tableView__btn_change_status")} onClick={onChangeStatus} />
      <BulkAction icon={Folder} label={t("tableView__btn_change_project")} onClick={onChangeProject} />
      <BulkAction icon={Flag} label={t("tableView__btn_change_sprint")} onClick={onChangeSprint} />
      <BulkAction icon={QrCode} label={t("tableView__btn_qr_export")} onClick={onExportQR} />
      <BulkAction icon={Trash2} label={t("tableView__btn_delete_selected")} onClick={onDelete} destructive />
    </div>,
    document.body,
  );
}
