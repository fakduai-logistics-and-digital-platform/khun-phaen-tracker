"use client";

import { useEffect, useState } from "react";
import { StorageBucketCard } from "@/components/settings/storage-bucket-card";
import { StorageObjectsCard } from "@/components/settings/storage-objects-card";
import { StorageOverview } from "@/components/settings/storage-overview";
import { StoragePreviewDialog } from "@/components/settings/storage-preview-dialog";
import { StorageProviderDialog } from "@/components/settings/storage-provider-dialog";
import { useStorageConfig } from "@/components/settings/use-storage-config";
import { useStorageObjects } from "@/components/settings/use-storage-objects";
import { useI18n } from "@/lib/i18n";

export default function StorageSettingsPage() {
  const { t } = useI18n();
  const [pageError, setPageError] = useState("");
  const [previewKey, setPreviewKey] = useState("");

  const config = useStorageConfig({ setPageError, onChanged: (): Promise<void> => objects.loadObjects() });
  const objects = useStorageObjects({ setPageError, onMutated: config.loadStats });

  useEffect(() => {
    document.title = t("meta__settings_storage_title");
  }, [t]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-300">
      <StorageOverview
        usedGb={config.stats.usedGb}
        objectCount={config.stats.objectCount}
        bucket={config.settings.bucket}
      />

      <StorageBucketCard
        settings={config.settings}
        usedGb={config.stats.usedGb}
        objectCount={config.stats.objectCount}
        pageError={pageError}
        pageSuccess={config.pageSuccess}
        onOpenSettings={config.openModal}
      />

      <StorageObjectsCard state={objects} onPreview={(item) => setPreviewKey(item.key)} />

      <StoragePreviewDialog
        previewKey={previewKey}
        siblingKeys={objects.objects.map((item) => item.key)}
        onClose={() => setPreviewKey("")}
      />

      <StorageProviderDialog
        open={config.modalOpen}
        draft={config.draft}
        modalError={config.modalError}
        modalSuccess={config.modalSuccess}
        saving={config.saving}
        resetting={config.resetting}
        onChange={config.updateDraft}
        onSave={() => void config.save()}
        onReset={() => void config.reset()}
        onClose={config.closeModal}
      />
    </div>
  );
}
