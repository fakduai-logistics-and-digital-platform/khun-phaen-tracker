"use client";

import { useI18n } from "@/lib/i18n";

export function WorkspaceLoading() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center space-y-4 py-32">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      <p className="font-medium text-muted-foreground">{t("page__checking_access")}</p>
    </div>
  );
}
