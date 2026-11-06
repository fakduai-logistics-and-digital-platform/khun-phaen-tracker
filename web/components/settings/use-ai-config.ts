"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/apis";
import { requestConfirm } from "@/lib/stores/confirmStore";
import type { AiConfig } from "@/lib/types";

export type AiFields = {
  embeddings_url: string;
  embeddings_api_key: string;
  embeddings_model: string;
  llm_url: string;
  llm_api_key: string;
  llm_model: string;
  tts_url: string;
  tts_api_key: string;
  tts_model: string;
};

export type AiService = "embeddings" | "llm";

const EMPTY_FIELDS: AiFields = {
  embeddings_url: "",
  embeddings_api_key: "",
  embeddings_model: "",
  llm_url: "",
  llm_api_key: "",
  llm_model: "",
  tts_url: "",
  tts_api_key: "",
  tts_model: "",
};

function toFields(config: AiConfig): AiFields {
  return {
    embeddings_url: config.embeddings_url || "",
    embeddings_api_key: config.embeddings_api_key || "",
    embeddings_model: config.embeddings_model || "",
    llm_url: config.llm_url || "",
    llm_api_key: config.llm_api_key || "",
    llm_model: config.llm_model || "",
    tts_url: config.tts_url || "",
    tts_api_key: config.tts_api_key || "",
    tts_model: config.tts_model || "",
  };
}

function nullIfEmpty(value: string) {
  return value || null;
}

export function useAiConfig() {
  const [config, setConfig] = useState<AiFields>(EMPTY_FIELDS);
  const [draft, setDraft] = useState<AiFields>(EMPTY_FIELDS);
  const [pageSuccess, setPageSuccess] = useState("");
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [models, setModels] = useState<Record<AiService, string[]>>({ embeddings: [], llm: [] });
  const [loadingModels, setLoadingModels] = useState<Record<AiService, boolean>>({ embeddings: false, llm: false });

  const loadConfig = useCallback(async () => {
    try {
      const response = await api.admin.aiConfig();
      const data = await response.json();
      if (!response.ok) {
        setModalError("Failed to load AI config");
        return;
      }
      const next = toFields(data.config || {});
      setConfig(next);
      setDraft(next);
    } catch (error) {
      console.error("Failed to load AI config:", error);
      setModalError("Failed to load AI config");
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const loadModels = useCallback(
    async (service: AiService) => {
      const urlReady =
        service === "llm" ? draft.llm_url && draft.llm_api_key : draft.embeddings_url && draft.embeddings_api_key;
      if (!urlReady) return;

      setLoadingModels((prev) => ({ ...prev, [service]: true }));
      try {
        const response = await (service === "llm" ? api.admin.listLlmModels() : api.admin.listEmbeddingsModels());
        const data = await response.json();
        if (response.ok && data.success) {
          setModels((prev) => ({ ...prev, [service]: data.models || [] }));
        } else {
          console.error(`Failed to fetch ${service} models:`, data.error);
          setModels((prev) => ({ ...prev, [service]: [] }));
        }
      } catch (error) {
        console.error(`Failed to fetch ${service} models:`, error);
        setModels((prev) => ({ ...prev, [service]: [] }));
      } finally {
        setLoadingModels((prev) => ({ ...prev, [service]: false }));
      }
    },
    [draft],
  );

  function openModal() {
    setModalError("");
    setModalSuccess("");
    setDraft(config);
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalError("");
    setModalSuccess("");
    setModalOpen(false);
  }

  function updateDraft(key: keyof AiFields, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    const confirmed = await requestConfirm({
      title: "Save AI Configuration",
      message: "Apply this AI configuration now? The AI chat feature will use these settings.",
      confirmText: "Save",
      cancelText: "Cancel",
      type: "warning",
    });
    if (!confirmed) return;

    setSaving(true);
    setModalError("");
    setModalSuccess("");
    try {
      const response = await api.admin.updateAiConfig({
        embeddings_url: nullIfEmpty(draft.embeddings_url),
        embeddings_api_key: nullIfEmpty(draft.embeddings_api_key),
        embeddings_model: nullIfEmpty(draft.embeddings_model),
        llm_url: nullIfEmpty(draft.llm_url),
        llm_api_key: nullIfEmpty(draft.llm_api_key),
        llm_model: nullIfEmpty(draft.llm_model),
        tts_url: nullIfEmpty(draft.tts_url),
        tts_api_key: nullIfEmpty(draft.tts_api_key),
        tts_model: nullIfEmpty(draft.tts_model),
      });
      const data = await response.json();
      if (!response.ok) {
        setModalError(data?.error || "Failed to save AI config");
        return;
      }
      setPageSuccess("AI configuration saved successfully");
      setModalSuccess("AI configuration saved successfully");
      setModalOpen(false);
      await loadConfig();
    } catch (error) {
      console.error("Failed to save AI config:", error);
      setModalError("Failed to save AI config");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    const confirmed = await requestConfirm({
      title: "Reset AI Configuration",
      message: "Reset AI configuration to environment defaults? This will remove all custom settings.",
      confirmText: "Reset",
      cancelText: "Cancel",
      type: "danger",
    });
    if (!confirmed) return;

    setResetting(true);
    setModalError("");
    setModalSuccess("");
    try {
      const response = await api.admin.resetAiConfig();
      await response.json();
      if (!response.ok) {
        setModalError("Failed to reset AI config");
        return;
      }
      setPageSuccess("AI configuration reset successfully");
      setModalSuccess("AI configuration reset successfully");
      setModalOpen(false);
      await loadConfig();
    } catch (error) {
      console.error("Failed to reset AI config:", error);
      setModalError("Failed to reset AI config");
    } finally {
      setResetting(false);
    }
  }

  return {
    config,
    draft,
    pageSuccess,
    modalError,
    modalSuccess,
    saving,
    resetting,
    modalOpen,
    models,
    loadingModels,
    openModal,
    closeModal,
    updateDraft,
    loadModels,
    save,
    reset,
  };
}
