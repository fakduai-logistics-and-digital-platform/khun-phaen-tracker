"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Flag, Folder, QrCode, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n";
import type { Project, Sprint, Task } from "@/lib/types";
import { STATUS_OPTIONS } from "./table-view-config";

export interface TableViewBulkBarProps {
  count: number;
  onClear: () => void;
  sprints: Sprint[];
  projects: Project[];
  onApply: (updates: Partial<Task>) => void;
  onExportQR: () => void;
  onDelete: () => void;
}

function BulkAction({
  icon: Icon,
  label,
  onClick,
  destructive,
  menu,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  destructive?: boolean;
  menu?: ReactNode;
}) {
  const button = (
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
  );
  const trigger = menu ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center" className="max-h-72 overflow-y-auto">
        {menu}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    button
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Floating bar fixed at the bottom centre of the screen while rows are selected (shadcn-admin DataTableBulkActions). */
export function TableViewBulkBar({
  count,
  onClear,
  sprints,
  projects,
  onApply,
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
      <BulkAction
        icon={CheckCircle2}
        label={t("tableView__btn_change_status")}
        menu={STATUS_OPTIONS.map(({ value, labelKey, icon: StatusIcon, colorClass }) => (
          <DropdownMenuItem key={value} onSelect={() => onApply({ status: value })}>
            <StatusIcon className={colorClass} />
            {t(labelKey)}
          </DropdownMenuItem>
        ))}
      />
      <BulkAction
        icon={Folder}
        label={t("tableView__btn_change_project")}
        menu={
          <>
            {projects.map((project) => (
              <DropdownMenuItem key={String(project.id)} onSelect={() => onApply({ project: project.name })}>
                {project.name}
              </DropdownMenuItem>
            ))}
            {projects.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onSelect={() => onApply({ project: "" })}>{t("tableView__bulk_no_project")}</DropdownMenuItem>
          </>
        }
      />
      <BulkAction
        icon={Flag}
        label={t("tableView__btn_change_sprint")}
        menu={
          <>
            {sprints.map((sprint) => (
              <DropdownMenuItem key={String(sprint.id)} onSelect={() => onApply({ sprint_id: sprint.id ?? null })}>
                {sprint.name}
              </DropdownMenuItem>
            ))}
            {sprints.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onSelect={() => onApply({ sprint_id: null })}>{t("taskMenu__no_sprint")}</DropdownMenuItem>
          </>
        }
      />
      <BulkAction icon={QrCode} label={t("tableView__btn_qr_export")} onClick={onExportQR} />
      <BulkAction icon={Trash2} label={t("tableView__btn_delete_selected")} onClick={onDelete} destructive />
    </div>,
    document.body,
  );
}
