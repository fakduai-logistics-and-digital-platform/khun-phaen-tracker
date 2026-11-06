"use client";

import { ListTodo } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function TaskViewPlaceholder({ loading = false }: { loading?: boolean }) {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="flex min-h-90 flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/30">
        <div className="size-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        <p className="text-sm font-semibold text-muted-foreground">{t("taskList__loading")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-6 rounded-lg border border-dashed bg-muted/30 py-32">
      <div className="flex size-24 items-center justify-center rounded-full bg-muted">
        <ListTodo size={48} className="text-muted-foreground/50" />
      </div>
      <div className="text-center">
        <h3 className="mb-2 text-xl font-medium text-foreground">{t("taskList__no_tasks")}</h3>
        <p className="text-muted-foreground">{t("taskList__add_task_hint")}</p>
      </div>
    </div>
  );
}
