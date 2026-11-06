"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/apis";
import { useI18n } from "@/lib/i18n";
import { requestConfirm } from "@/lib/stores/confirmStore";
import type { StorageConfig, StorageProvider } from "@/lib/types";

export type StorageDraft = {
  provider: StorageProvider;
  bucket: string;
  region: string;
  endpoint: string;
  accessKey: string;
  secretKey: string;
};

type StorageSettings = StorageDraft;

const DEFAULTS: StorageSettings = {
  provider: "env",
  bucket: "khunphaen-assets",
  region: "us-east-1",
  endpoint: "RustFS / S3-compatible",
  accessKey: "",
  secretKey: "",
};

type StorageStats = { usedGb: number; objectCount: number };

type Options = {
  setPageError: (message: string) => void;
  onChanged: () => Promise<void>;
};

export function useStorageConfig({ setPageError, onChanged }: Options) {
  const { t } = useI18n();
  const [settings, setSettings] = useState<StorageSettings>(DEFAULTS);
  const [draft, setDraft] = useState<StorageDraft>(DEFAULTS);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [stats, setStats] = useState<StorageStats>({ usedGb: 0, objectCount: 0 });
  const [pageSuccess, setPageSuccess] = useState("");
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadStats = useCallback(async () => {
    setPageError("");
    try {
      const response = await api.admin.storageStats();
      const data = await response.json();
      if (!response.ok) {
        setPageError(t("settings__storage_modal_error_load_stats"));
        return;
      }
      const prev = settingsRef.current;
      const next = {
        ...prev,
        bucket: data.bucket || prev.bucket,
        endpoint: data.endpoint || prev.endpoint,
        region: data.region || prev.region,
      };
      settingsRef.current = next;
      setSettings(next);
      setStats({
        usedGb: Number(data.used_bytes || 0) / 1024 / 1024 / 1024,
        objectCount: Number(data.object_count || 0),
      });
    } catch (error) {
      console.error("Failed to load storage stats:", error);
      setPageError(t("settings__storage_modal_error_load_stats"));
    }
  }, [t, setPageError]);

  const loadConfig = useCallback(async () => {
    try {
      const response = await api.admin.storageConfig();
      const data = await response.json();
      if (!response.ok) {
        setModalError(t("settings__storage_modal_error_load_config"));
        return;
      }
      const config: StorageConfig = data.config || {};
      const prev = settingsRef.current;
      const next: StorageSettings = {
        provider: config.provider || "env",
        bucket: config.bucket || prev.bucket,
        region: config.region || prev.region,
        endpoint: config.endpoint || prev.endpoint,
        accessKey: config.access_key || "",
        secretKey: config.secret_key || "",
      };
      settingsRef.current = next;
      setSettings(next);
      setDraft(next);
    } catch (error) {
      console.error("Failed to load storage config:", error);
      setModalError(t("settings__storage_modal_error_load_config"));
    }
  }, [t]);

  useEffect(() => {
    void loadConfig();
    void loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function mapErrorMessage(message?: string) {
    switch (message) {
      case "Bucket name is required":
        return t("settings__storage_validation_bucket_required");
      case "Region is required":
        return t("settings__storage_validation_region_required");
      case "Storage endpoint is required":
        return t("settings__storage_validation_endpoint_required");
      case "Access key and secret key are required":
        return t("settings__storage_validation_credentials_required");
      default:
        return null;
    }
  }

  function openModal() {
    setModalError("");
    setModalSuccess("");
    setDraft(settings);
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalError("");
    setModalSuccess("");
    setModalOpen(false);
  }

  function updateDraft<K extends keyof StorageDraft>(key: K, value: StorageDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function refreshAll() {
    await Promise.all([loadConfig(), loadStats(), onChanged()]);
  }

  async function save() {
    const confirmed = await requestConfirm({
      title: t("settings__storage_modal_confirm_save_title"),
      message: t("settings__storage_modal_confirm_save_message"),
      confirmText: t("settings__storage_modal_confirm_save_action"),
      cancelText: t("common.cancel"),
      type: "warning",
    });
    if (!confirmed) return;

    setSaving(true);
    setModalError("");
    setModalSuccess("");
    try {
      const response = await api.admin.updateStorageConfig({
        provider: draft.provider,
        bucket: draft.bucket,
        region: draft.region,
        endpoint: draft.provider === "env" ? draft.endpoint : undefined,
        access_key: draft.accessKey,
        secret_key: draft.secretKey,
      });
      const data = await response.json();
      if (!response.ok) {
        setModalError(mapErrorMessage(data?.error) || t("settings__storage_modal_error_save_config"));
        return;
      }
      setPageSuccess(t("settings__storage_modal_success_saved"));
      setModalSuccess(t("settings__storage_modal_success_saved"));
      setModalOpen(false);
      await refreshAll();
    } catch (error) {
      console.error("Failed to save storage config:", error);
      setModalError(t("settings__storage_modal_error_save_config"));
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    const confirmed = await requestConfirm({
      title: t("settings__storage_modal_reset_title"),
      message: t("settings__storage_modal_reset_message"),
      confirmText: t("settings__storage_modal_reset"),
      cancelText: t("common.cancel"),
      type: "danger",
    });
    if (!confirmed) return;

    setResetting(true);
    setModalError("");
    setModalSuccess("");
    try {
      const response = await api.admin.resetStorageConfig();
      await response.json();
      if (!response.ok) {
        setModalError(t("settings__storage_modal_error_reset_config"));
        return;
      }
      setPageSuccess(t("settings__storage_modal_success_reset"));
      setModalSuccess(t("settings__storage_modal_success_reset"));
      setModalOpen(false);
      await refreshAll();
    } catch (error) {
      console.error("Failed to reset storage config:", error);
      setModalError(t("settings__storage_modal_error_reset_config"));
    } finally {
      setResetting(false);
    }
  }

  return {
    settings,
    draft,
    stats,
    pageSuccess,
    modalError,
    modalSuccess,
    modalOpen,
    saving,
    resetting,
    loadStats,
    openModal,
    closeModal,
    updateDraft,
    save,
    reset,
  };
}
