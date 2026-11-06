"use client";

import { LoaderCircle, Settings2 } from "lucide-react";
import { NativeSelect } from "@/components/settings/native-select";
import { SecretInput } from "@/components/settings/secret-input";
import { SettingsNotice } from "@/components/settings/settings-notice";
import {
  AWS_S3_DOCS_URL,
  AWS_S3_POLICY_DOCS_URL,
  RUSTFS_DOCS_URL,
  RUSTFS_SDK_URL,
} from "@/components/settings/storage-utils";
import type { StorageDraft } from "@/components/settings/use-storage-config";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import type { StorageProvider } from "@/lib/types";

type StorageProviderDialogProps = {
  open: boolean;
  draft: StorageDraft;
  modalError: string;
  modalSuccess: string;
  saving: boolean;
  resetting: boolean;
  onChange: <K extends keyof StorageDraft>(key: K, value: StorageDraft[K]) => void;
  onSave: () => void;
  onReset: () => void;
  onClose: () => void;
};

const DOC_LINK = "font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:opacity-80";

function DocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={DOC_LINK}>
      {children}
    </a>
  );
}

export function StorageProviderDialog({
  open,
  draft,
  modalError,
  modalSuccess,
  saving,
  resetting,
  onChange,
  onSave,
  onReset,
  onClose,
}: StorageProviderDialogProps) {
  const { t } = useI18n();
  const busy = saving || resetting;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b bg-gradient-to-br from-brand-500/15 via-muted/30 to-transparent px-6 py-5 text-left sm:px-7">
          <div className="flex items-center gap-3 pr-8">
            <div className="rounded-xl bg-primary/10 p-3 text-primary ring-1 ring-primary/20">
              <Settings2 size={18} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">{t("settings__storage_modal_title")}</DialogTitle>
              <DialogDescription asChild>
                <p>
                  {draft.provider === "env" ? (
                    <>
                      {t("settings__storage_modal_rustfs_help_before")}{" "}
                      <DocLink href={RUSTFS_DOCS_URL}>{t("settings__storage_modal_rustfs_docs")}</DocLink>{" "}
                      {t("settings__storage_modal_rustfs_help_and")}{" "}
                      <DocLink href={RUSTFS_SDK_URL}>{t("settings__storage_modal_rustfs_sdk")}</DocLink>
                    </>
                  ) : (
                    <>
                      {t("settings__storage_modal_s3_help_before")}{" "}
                      <DocLink href={AWS_S3_DOCS_URL}>{t("settings__storage_modal_s3_docs")}</DocLink>{" "}
                      {t("settings__storage_modal_rustfs_help_and")}{" "}
                      <DocLink href={AWS_S3_POLICY_DOCS_URL}>{t("settings__storage_modal_s3_policy")}</DocLink>
                    </>
                  )}
                </p>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-6 sm:px-7">
          {modalError && (
            <SettingsNotice kind="error" className="mb-4">
              {modalError}
            </SettingsNotice>
          )}
          {modalSuccess && (
            <SettingsNotice kind="success" className="mb-4">
              {modalSuccess}
            </SettingsNotice>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="storage-provider">{t("settings__storage_provider_label")}</Label>
              <NativeSelect
                id="storage-provider"
                value={draft.provider}
                onChange={(e) => onChange("provider", e.target.value as StorageProvider)}
              >
                <option value="env">{t("settings__storage_provider_rustfs")}</option>
                <option value="s3">{t("settings__storage_provider_s3")}</option>
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="storage-bucket">{t("settings__storage_field_bucket")}</Label>
              <Input
                id="storage-bucket"
                className="h-11"
                value={draft.bucket}
                onChange={(e) => onChange("bucket", e.target.value)}
              />
            </div>

            {draft.provider === "s3" ? (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="storage-region">{t("settings__storage_region_label")}</Label>
                <Input
                  id="storage-region"
                  className="h-11"
                  value={draft.region}
                  onChange={(e) => onChange("region", e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="storage-endpoint">{t("settings__storage_rustfs_url_label")}</Label>
                <Input
                  id="storage-endpoint"
                  className="h-11"
                  value={draft.endpoint}
                  onChange={(e) => onChange("endpoint", e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="storage-access-key">{t("settings__storage_access_key_label")}</Label>
              <SecretInput
                id="storage-access-key"
                value={draft.accessKey}
                onValueChange={(value) => onChange("accessKey", value)}
                showLabel={t("settings__storage_modal_show_access_key")}
                hideLabel={t("settings__storage_modal_hide_access_key")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="storage-secret-key">{t("settings__storage_secret_key_label")}</Label>
              <SecretInput
                id="storage-secret-key"
                value={draft.secretKey}
                onValueChange={(value) => onChange("secretKey", value)}
                showLabel={t("settings__storage_modal_show_secret_key")}
                hideLabel={t("settings__storage_modal_hide_secret_key")}
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <div className="mr-auto">
              <Button
                variant="outline"
                onClick={onReset}
                disabled={busy}
                className="border-warning/40 text-warning hover:text-warning"
              >
                {t("settings__storage_modal_reset")}
              </Button>
            </div>
            <Button variant="outline" onClick={onClose} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button onClick={onSave} disabled={busy} className="gap-2">
              {saving && <LoaderCircle size={16} className="animate-spin" />}
              {t("settings__storage_modal_save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
