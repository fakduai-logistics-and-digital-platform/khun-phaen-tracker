"use client";

import { CheckCircle2, Flag, Folder, QrCode, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface TableViewBulkBarProps {
  count: number;
  onClear: () => void;
  onChangeStatus: () => void;
  onChangeProject: () => void;
  onChangeSprint: () => void;
  onExportQR: () => void;
  onDelete: () => void;
}

const BUTTON = "flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors";

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

  return (
    <div className="flex flex-col gap-1.5 border-b bg-primary/10 px-3 py-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4">
      <span className="text-xs font-medium text-primary sm:text-sm">{t("tableView__selected_count", { count })}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={onClear} className={cn(BUTTON, "text-muted-foreground hover:bg-accent")}>
          {t("tableView__btn_clear_selection")}
        </button>
        <button
          type="button"
          onClick={onChangeStatus}
          className={cn(
            BUTTON,
            "border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-900/20",
          )}
        >
          <CheckCircle2 size={13} />
          {t("tableView__btn_change_status")}
        </button>
        <button
          type="button"
          onClick={onChangeProject}
          className={cn(
            BUTTON,
            "border-purple-300 text-purple-600 hover:bg-purple-50 dark:border-purple-500 dark:text-purple-400 dark:hover:bg-purple-900/20",
          )}
        >
          <Folder size={13} />
          {t("tableView__btn_change_project")}
        </button>
        <button
          type="button"
          onClick={onChangeSprint}
          className={cn(
            BUTTON,
            "border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-500 dark:text-amber-400 dark:hover:bg-amber-900/20",
          )}
        >
          <Flag size={13} />
          {t("tableView__btn_change_sprint")}
        </button>
        <button
          type="button"
          onClick={onExportQR}
          className={cn(
            BUTTON,
            "border-teal-300 text-teal-600 hover:bg-teal-50 dark:border-teal-500 dark:text-teal-400 dark:hover:bg-teal-900/20",
          )}
        >
          <QrCode size={13} />
          {t("tableView__btn_qr_export")}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className={cn(
            BUTTON,
            "border-destructive text-destructive hover:bg-destructive dark:hover:bg-destructive/20",
          )}
        >
          <Trash2 size={13} />
          {t("tableView__btn_delete_selected")}
        </button>
      </div>
    </div>
  );
}
