"use client";

import { Eye, LoaderCircle, Trash2 } from "lucide-react";
import { NativeSelect } from "@/components/settings/native-select";
import { buildFileUrl, formatBytes, formatStorageKeyLabel, formatTimestamp } from "@/components/settings/storage-utils";
import type { useStorageObjects } from "@/components/settings/use-storage-objects";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import type { StorageObjectItem } from "@/lib/types";

type StorageObjects = ReturnType<typeof useStorageObjects>;

type StorageObjectsCardProps = {
  state: StorageObjects;
  onPreview: (item: StorageObjectItem) => void;
};

const TH = "px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground";
const CHECKBOX = "size-4 rounded border-input accent-primary";

export function StorageObjectsCard({ state, onPreview }: StorageObjectsCardProps) {
  const { t, locale } = useI18n();
  const {
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
  } = state;
  const pageStart = totalObjects === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, totalObjects);

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold">{t("settings__storage_files_title")}</h3>
          <p className="text-sm text-muted-foreground">{t("settings__storage_files_subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {selectedKeys.size > 0 && (
            <Button
              variant="outline"
              onClick={() => void state.deleteSelected()}
              disabled={deletingSelected}
              className="gap-2 border-destructive/30 text-destructive hover:text-destructive"
            >
              {deletingSelected ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}
              {t("settings__storage_bulk_delete_action")} ({selectedKeys.size})
            </Button>
          )}
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <span>{t("settings__storage_pagination_limit")}</span>
            <NativeSelect
              className="h-9 w-auto font-semibold normal-case tracking-normal"
              value={pageSize}
              onChange={(e) => void state.changePageSize(Number(e.target.value))}
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </NativeSelect>
          </label>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {totalObjects.toLocaleString()} {t("settings__storage_objects_suffix")}
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted/50">
              <tr>
                <th className={`${TH} text-center`}>
                  <input
                    type="checkbox"
                    className={CHECKBOX}
                    checked={allVisibleSelected}
                    onChange={state.toggleSelectAllVisible}
                    aria-label={t("settings__storage_table_select")}
                  />
                </th>
                <th className={TH}>{t("settings__storage_table_key")}</th>
                <th className={TH}>{t("settings__storage_table_size")}</th>
                <th className={TH}>{t("settings__storage_table_modified")}</th>
                <th className={`${TH} text-right`}>{t("settings__storage_table_action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    {t("settings__storage_loading")}
                  </td>
                </tr>
              ) : objects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    {t("settings__storage_empty")}
                  </td>
                </tr>
              ) : (
                objects.map((item) => (
                  <tr key={item.key} className="bg-card">
                    <td className="px-4 py-3 text-center align-top">
                      <input
                        type="checkbox"
                        className={`${CHECKBOX} mt-1`}
                        checked={selectedKeys.has(item.key)}
                        onChange={() => state.toggleSelection(item.key)}
                        aria-label={t("settings__storage_table_select")}
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <a
                        href={buildFileUrl(item.key)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block max-w-[520px] truncate text-sm underline decoration-transparent underline-offset-4 transition hover:text-primary hover:decoration-current"
                        title={item.key}
                      >
                        {formatStorageKeyLabel(item.key)}
                      </a>
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-muted-foreground">
                      {formatBytes(item.size_bytes)}
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-muted-foreground">
                      {formatTimestamp(item.last_modified, locale)}
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => onPreview(item)}
                          title={t("settings__storage_view_action")}
                          aria-label={t("settings__storage_view_action")}
                        >
                          <Eye size={15} />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="border-destructive/30 text-destructive hover:text-destructive"
                          disabled={deletingKey === item.key}
                          onClick={() => void state.deleteObject(item)}
                          title={t("settings__storage_delete_action")}
                          aria-label={t("settings__storage_delete_action")}
                        >
                          {deletingKey === item.key ? (
                            <LoaderCircle size={15} className="animate-spin" />
                          ) : (
                            <Trash2 size={15} />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && totalObjects > 0 && (
        <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {t("settings__storage_pagination_summary", { start: pageStart, end: pageEnd, total: totalObjects })}
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button variant="outline" onClick={() => void state.goToPage(currentPage - 1)} disabled={currentPage === 1}>
              {t("settings__storage_pagination_prev")}
            </Button>
            <div className="rounded-md border px-3 py-1.5 text-sm font-semibold">
              {currentPage} / {totalPages}
            </div>
            <Button
              variant="outline"
              onClick={() => void state.goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              {t("settings__storage_pagination_next")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
