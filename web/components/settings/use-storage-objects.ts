"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/apis";
import { useI18n } from "@/lib/i18n";
import { requestConfirm } from "@/lib/stores/confirmStore";
import type { StorageObjectItem } from "@/lib/types";

type Options = {
  setPageError: (message: string) => void;
  onMutated: () => Promise<void>;
};

export function useStorageObjects({ setPageError, onMutated }: Options) {
  const { t } = useI18n();
  const [objects, setObjects] = useState<StorageObjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalObjects, setTotalObjects] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [deletingKey, setDeletingKey] = useState("");
  const [deletingSelected, setDeletingSelected] = useState(false);
  const pagingRef = useRef({ page: currentPage, size: pageSize });
  pagingRef.current = { page: currentPage, size: pageSize };

  const load = useCallback(
    async (page: number, size: number) => {
      setLoading(true);
      setPageError("");
      try {
        const response = await api.admin.listStorageObjects(page, size);
        const data = await response.json();
        if (!response.ok) {
          setPageError(t("settings__storage_modal_error_load_objects"));
          return;
        }
        const items: StorageObjectItem[] = data.objects || [];
        const total = Number(data.total || items.length || 0);
        setObjects(items);
        setTotalObjects(total);
        setTotalPages(Math.max(1, Number(data.pages || Math.ceil(Math.max(total, 1) / size))));
        setCurrentPage(Math.max(1, Number(data.page || page)));
      } catch (error) {
        console.error("Failed to load storage objects:", error);
        setPageError(t("settings__storage_modal_error_load_objects"));
      } finally {
        setLoading(false);
      }
    },
    [t, setPageError],
  );

  const loadObjects = useCallback(() => load(pagingRef.current.page, pagingRef.current.size), [load]);

  useEffect(() => {
    void loadObjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function goToPage(page: number) {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    await load(page, pageSize);
  }

  async function changePageSize(size: number) {
    if (!Number.isFinite(size) || size <= 0) return;
    setPageSize(size);
    setCurrentPage(1);
    await load(1, size);
  }

  function toggleSelection(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const visibleKeys = objects.map((item) => item.key);
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selectedKeys.has(key));

  function toggleSelectAllVisible() {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const key of visibleKeys) {
        if (allVisibleSelected) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  }

  async function deleteObject(item: StorageObjectItem) {
    const confirmed = await requestConfirm({
      title: t("settings__storage_delete_title"),
      message: t("settings__storage_delete_message", { key: item.key }),
      confirmText: t("settings__storage_delete_confirm"),
      cancelText: t("common.cancel"),
      type: "danger",
    });
    if (!confirmed) return;

    setDeletingKey(item.key);
    setPageError("");
    try {
      const response = await api.admin.deleteStorageObject(encodeURIComponent(item.key));
      await response.json();
      if (!response.ok) {
        setPageError(t("settings__storage_modal_error_delete_object"));
        return;
      }
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        next.delete(item.key);
        return next;
      });
      await Promise.all([onMutated(), loadObjects()]);
    } catch (error) {
      console.error("Failed to delete storage object:", error);
      setPageError(t("settings__storage_modal_error_delete_object"));
    } finally {
      setDeletingKey("");
    }
  }

  async function deleteSelected() {
    const keys = Array.from(selectedKeys);
    if (keys.length === 0) return;

    const confirmed = await requestConfirm({
      title: t("settings__storage_bulk_delete_title"),
      message: t("settings__storage_bulk_delete_message", { count: keys.length }),
      confirmText: t("settings__storage_bulk_delete_confirm"),
      cancelText: t("common.cancel"),
      type: "danger",
    });
    if (!confirmed) return;

    setDeletingSelected(true);
    setPageError("");
    try {
      const response = await api.admin.bulkDeleteStorageObjects(keys);
      await response.json();
      if (!response.ok) {
        setPageError(t("settings__storage_modal_error_bulk_delete_object"));
        return;
      }
      setSelectedKeys(new Set());
      await Promise.all([onMutated(), loadObjects()]);
    } catch (error) {
      console.error("Failed to delete selected storage objects:", error);
      setPageError(t("settings__storage_modal_error_bulk_delete_object"));
    } finally {
      setDeletingSelected(false);
    }
  }

  return {
    objects,
    loading,
    currentPage,
    pageSize,
    totalObjects,
    totalPages,
    selectedKeys,
    allVisibleSelected,
    deletingKey,
    deletingSelected,
    loadObjects,
    goToPage,
    changePageSize,
    toggleSelection,
    toggleSelectAllVisible,
    deleteObject,
    deleteSelected,
  };
}
