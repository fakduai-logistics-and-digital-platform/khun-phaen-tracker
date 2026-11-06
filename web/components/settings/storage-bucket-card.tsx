"use client";

import { HardDrive, Settings2 } from "lucide-react";
import { InfoTile } from "@/components/settings/info-tile";
import { SettingsNotice } from "@/components/settings/settings-notice";
import { formatStorageSize } from "@/components/settings/storage-utils";
import type { StorageDraft } from "@/components/settings/use-storage-config";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

type StorageBucketCardProps = {
  settings: StorageDraft;
  usedGb: number;
  objectCount: number;
  pageError: string;
  pageSuccess: string;
  onOpenSettings: () => void;
};

export function StorageBucketCard({
  settings,
  usedGb,
  objectCount,
  pageError,
  pageSuccess,
  onOpenSettings,
}: StorageBucketCardProps) {
  const { t } = useI18n();
  const normalizedUsedGb = Number.isFinite(usedGb) && usedGb >= 0 ? usedGb : 0;
  const providerLabel =
    settings.provider === "env" ? t("settings__storage_provider_rustfs") : t("settings__storage_provider_s3");

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <HardDrive size={18} />
          </div>
          <div>
            <h3 className="text-lg font-bold">{t("settings__storage_bucket_title")}</h3>
            <p className="text-sm text-muted-foreground">{t("settings__storage_bucket_subtitle")}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="icon-lg"
          onClick={onOpenSettings}
          aria-label={t("settings__storage_settings_open")}
          title={t("settings__storage_settings_open")}
        >
          <Settings2 size={18} />
        </Button>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <InfoTile
          label={t("settings__storage_provider_label")}
          value={<span className="font-semibold">{providerLabel}</span>}
        />
        <InfoTile label={t("settings__storage_field_bucket")} value={settings.bucket} mono />
        {settings.provider === "s3" && <InfoTile label={t("settings__storage_region_label")} value={settings.region} />}
        {settings.provider === "env" && (
          <InfoTile
            label={t("settings__storage_rustfs_url_label")}
            value={settings.endpoint}
            className="lg:col-span-2"
          />
        )}
        <InfoTile
          label={t("settings__storage_metric_used")}
          value={<span className="font-semibold">{formatStorageSize(normalizedUsedGb)}</span>}
        />
        <InfoTile
          label={t("settings__storage_metric_objects")}
          value={<span className="font-semibold">{objectCount.toLocaleString()}</span>}
        />
      </div>

      {pageError && (
        <SettingsNotice kind="error" className="mt-4">
          {pageError}
        </SettingsNotice>
      )}
      {pageSuccess && (
        <SettingsNotice kind="success" className="mt-4">
          {pageSuccess}
        </SettingsNotice>
      )}
    </section>
  );
}
