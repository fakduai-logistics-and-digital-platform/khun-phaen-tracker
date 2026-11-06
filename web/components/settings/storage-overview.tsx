"use client";

import { DatabaseBackup, HardDrive } from "lucide-react";
import { SettingsHero } from "@/components/settings/settings-hero";
import { formatStorageSize } from "@/components/settings/storage-utils";
import { useI18n } from "@/lib/i18n";

type StorageOverviewProps = {
  usedGb: number;
  objectCount: number;
  bucket: string;
};

export function StorageOverview({ usedGb, objectCount, bucket }: StorageOverviewProps) {
  const { t } = useI18n();
  const normalizedUsedGb = Number.isFinite(usedGb) && usedGb >= 0 ? usedGb : 0;

  return (
    <SettingsHero
      icon={HardDrive}
      title={t("settings__storage_title")}
      badge={t("settings__storage_badge")}
      subtitle={t("settings__storage_subtitle")}
    >
      <div className="w-full max-w-sm rounded-2xl border bg-background/70 p-5 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {t("settings__storage_capacity_used")}
            </p>
            <p className="mt-2 text-3xl font-black tracking-tight">{formatStorageSize(normalizedUsedGb)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {objectCount.toLocaleString()} {t("settings__storage_objects_suffix")}
            </p>
          </div>
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <DatabaseBackup size={18} />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("settings__storage_capacity_live")}</span>
          <span>{bucket}</span>
        </div>
      </div>
    </SettingsHero>
  );
}
