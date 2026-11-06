"use client";

import { useState } from "react";
import { AlertCircle, Bookmark as BookmarkIcon, Edit2, ExternalLink, GripVertical, Plus, Trash2 } from "lucide-react";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { bookmarks, MAX_BOOKMARKS, type Bookmark } from "@/lib/stores/bookmarks";
import { ToolModal } from "./tool-modal";

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function ensureProtocol(url: string): string {
  if (!url) return url;
  return url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
}

function openUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function BookmarkManager({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const items = useStore(bookmarks);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [removeId, setRemoveId] = useState<string | null>(null);

  function startAdd() {
    setShowAddForm(true);
    setNewTitle("");
    setNewUrl("");
    setError("");
    setEditingId(null);
  }

  function cancelAdd() {
    setShowAddForm(false);
    setNewTitle("");
    setNewUrl("");
    setError("");
  }

  function saveNew() {
    if (!newTitle.trim()) return setError("bookmarks__error_name");
    if (!newUrl.trim()) return setError("bookmarks__error_url_required");
    const url = ensureProtocol(newUrl.trim());
    if (!isValidUrl(url)) return setError("bookmarks__error_url_invalid");
    bookmarks.add(newTitle.trim(), url);
    cancelAdd();
  }

  function startEdit(bookmark: Bookmark) {
    setEditingId(bookmark.id);
    setEditTitle(bookmark.title);
    setEditUrl(bookmark.url);
    setShowAddForm(false);
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
    setEditUrl("");
    setError("");
  }

  function saveEdit() {
    if (!editTitle.trim()) return setError("bookmarks__error_name");
    const url = ensureProtocol(editUrl.trim());
    if (!isValidUrl(url)) return setError("bookmarks__error_url_invalid");
    if (editingId) bookmarks.update(editingId, editTitle.trim(), url);
    cancelEdit();
  }

  function confirmRemove() {
    if (removeId) bookmarks.remove(removeId);
    setRemoveId(null);
  }

  function handleDragOver(event: React.DragEvent, index: number) {
    event.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    bookmarks.reorder(dragIndex, index);
    setDragIndex(index);
  }

  const errorLine = error ? (
    <p className="flex items-center gap-1 text-sm text-destructive">
      <AlertCircle size={12} />
      {t(error)}
    </p>
  ) : null;

  return (
    <>
      <ToolModal
        onClose={onClose}
        title={t("bookmarks__title")}
        subtitle={t("bookmarks__subtitle", { count: items.length, max: MAX_BOOKMARKS })}
        icon={BookmarkIcon}
        footer={
          items.length >= MAX_BOOKMARKS ? (
            <p className="me-auto text-sm text-muted-foreground">{t("bookmarks__full", { max: MAX_BOOKMARKS })}</p>
          ) : !showAddForm ? (
            <Button variant="outline" className="gap-2" onClick={startAdd}>
              <Plus className="size-4" />
              {t("bookmarks__add")}
            </Button>
          ) : null
        }
      >
        {items.length === 0 && !showAddForm ? (
          <div className="py-10 text-center">
            <BookmarkIcon className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="mb-1 text-sm font-medium">{t("bookmarks__empty_title")}</p>
            <p className="text-sm text-muted-foreground">{t("bookmarks__empty_hint")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((bookmark, index) => (
              <div
                key={bookmark.id}
                className="group flex items-center gap-2 rounded-md border p-3 transition-colors hover:bg-accent/40"
                draggable={editingId !== bookmark.id}
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={() => setDragIndex(null)}
              >
                {editingId !== bookmark.id && (
                  <div className="cursor-move text-muted-foreground hover:text-foreground">
                    <GripVertical size={16} />
                  </div>
                )}

                {editingId === bookmark.id ? (
                  <div className="flex-1 space-y-2">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder={t("bookmarks__name_placeholder")}
                    />
                    <Input
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      placeholder="https://example.com"
                    />
                    {errorLine}
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={saveEdit}>
                        {t("common.save")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={() => openUrl(bookmark.url)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-medium">{bookmark.title}</p>
                      <p className="truncate text-sm text-muted-foreground">{bookmark.url}</p>
                    </button>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => openUrl(bookmark.url)}
                        title={t("bookmarks__open")}
                        aria-label={t("bookmarks__open")}
                      >
                        <ExternalLink className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => startEdit(bookmark)}
                        title={t("bookmarks__edit")}
                        aria-label={t("bookmarks__edit")}
                      >
                        <Edit2 className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => setRemoveId(bookmark.id)}
                        title={t("bookmarks__delete")}
                        aria-label={t("bookmarks__delete")}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {showAddForm && (
          <div className="mt-4 rounded-md border p-4">
            <h4 className="mb-3 text-sm font-medium">{t("bookmarks__add_title")}</h4>
            <div className="space-y-3">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t("bookmarks__new_name_placeholder")}
              />
              <Input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder={t("bookmarks__new_url_placeholder")}
              />
              {errorLine}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={saveNew}>
                  {t("common.save")}
                </Button>
                <Button variant="ghost" onClick={cancelAdd}>
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </ToolModal>
      <ConfirmModal
        show={removeId !== null}
        title={t("bookmarks__delete_title")}
        message={t("bookmarks__delete_confirm")}
        onConfirm={confirmRemove}
        onClose={() => setRemoveId(null)}
      />
    </>
  );
}
