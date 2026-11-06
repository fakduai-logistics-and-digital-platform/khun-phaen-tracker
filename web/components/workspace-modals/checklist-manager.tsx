"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ClipboardList, ListTodo, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/apis";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { currentWorkspaceId } from "@/lib/stores/workspace";
import type { ChecklistItem, ChecklistTemplate } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChecklistTemplateModal } from "./checklist-template-modal";

const PAGE_SIZE = 10;
const NO_ITEMS: ChecklistItem[] = [];

function createChecklistItemId() {
  return Date.now().toString() + Math.random().toString(36).substring(2);
}

function toItems(texts: string[]): ChecklistItem[] {
  return texts.map((text) => ({ id: createChecklistItemId(), text, completed: false }));
}

export function ChecklistManager({
  checklist = NO_ITEMS,
  autoDispatch = true,
  onChecklistChange,
  onUpdate,
}: {
  checklist?: ChecklistItem[];
  /** Emit `onUpdate` on every change (edit mode); otherwise only `onChecklistChange` fires. */
  autoDispatch?: boolean;
  onChecklistChange?: (checklist: ChecklistItem[]) => void;
  onUpdate?: (detail: { checklist: ChecklistItem[] }) => void;
}) {
  const { t } = useI18n();
  const workspaceId = useStore(currentWorkspaceId);

  const [newItem, setNewItem] = useState("");
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const editStartTextRef = useRef("");

  const completedCount = useMemo(() => checklist.filter((i) => i.completed).length, [checklist]);
  const progress = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0;
  const visibleChecklist = checklist.slice(0, visibleCount);
  const hasMore = checklist.length > visibleCount;
  const allSelected = selectedIds.size === checklist.length;

  function commit(next: ChecklistItem[], notify = true) {
    onChecklistChange?.(next);
    if (notify && autoDispatch) onUpdate?.({ checklist: next });
  }

  function addItem() {
    const text = newItem.trim();
    if (!text) return;
    commit([...checklist, { id: createChecklistItemId(), text, completed: false }]);
    setNewItem("");
  }

  function submitNewItem() {
    if (newItem.trim()) addItem();
    else setIsAddingItem(false);
  }

  function cancelAddItem() {
    setIsAddingItem(false);
    setNewItem("");
  }

  function closeBulkAdd() {
    setBulkOpen(false);
    setBulkText("");
  }

  function addItemsFromBulkText() {
    const lines = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length > 0) commit([...checklist, ...toItems(lines)]);
    closeBulkAdd();
  }

  function removeItem(id: string) {
    commit(checklist.filter((item) => item.id !== id));
  }

  function toggleItem(id: string) {
    commit(checklist.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item)));
  }

  function editItemText(id: string, text: string) {
    commit(
      checklist.map((item) => (item.id === id ? { ...item, text } : item)),
      false,
    );
  }

  function finishEditItemText(item: ChecklistItem) {
    if (item.text !== editStartTextRef.current && autoDispatch) onUpdate?.({ checklist });
  }

  function deleteAll() {
    setSelectedIds(new Set());
    setSelectMode(false);
    commit([]);
  }

  function deleteSelected() {
    const remaining = checklist.filter((i) => !selectedIds.has(i.id));
    setSelectedIds(new Set());
    if (remaining.length === 0) setSelectMode(false);
    commit(remaining);
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(checklist.map((i) => i.id)));
  }

  function toggleSelectMode() {
    if (selectMode) setSelectedIds(new Set());
    setSelectMode(!selectMode);
  }

  function toggleSelectItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function loadTemplates() {
    if (!workspaceId) return;
    try {
      const res = await api.data.checklistTemplates.list(workspaceId);
      if (res.ok) {
        const data = await res.json();
        setTemplates(
          (data.templates || []).map((tpl: ChecklistTemplate & { _id?: string }) => ({
            ...tpl,
            id: tpl.id || tpl._id,
          })),
        );
      }
    } catch (err) {
      console.error("Failed to load templates:", err);
    }
  }

  useEffect(() => {
    if (showTemplateModal) void loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTemplateModal, workspaceId]);

  async function handleAddTemplate(detail: { name: string; items: string[] }) {
    if (!workspaceId) return;
    try {
      const res = await api.data.checklistTemplates.create(workspaceId, detail);
      if (res.ok) {
        toast.success(t("checklistTemplate__save_success"));
        void loadTemplates();
      }
    } catch {
      toast.error(t("checklistManager__error_save"));
    }
  }

  async function handleUpdateTemplate(detail: { id: string; name: string; items: string[] }) {
    if (!workspaceId) return;
    try {
      const { id, ...updates } = detail;
      const res = await api.data.checklistTemplates.update(workspaceId, id, updates);
      if (res.ok) {
        toast.success(t("checklistTemplate__save_success"));
        void loadTemplates();
      }
    } catch {
      toast.error(t("checklistManager__error_update"));
    }
  }

  async function handleDeleteTemplate(id: string) {
    if (!workspaceId) return;
    try {
      const res = await api.data.checklistTemplates.delete(workspaceId, id);
      if (res.ok) void loadTemplates();
    } catch {
      toast.error(t("checklistManager__error_delete"));
    }
  }

  function handleImportTemplate(template: ChecklistTemplate) {
    commit([...checklist, ...toItems(template.items)]);
    toast.success(t("checklistTemplate__import_success"));
    setShowTemplateModal(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo size={16} className="text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">{t("taskForm__checklist_label")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowTemplateModal(true)}
            className="rounded-lg text-xs font-semibold text-muted-foreground"
          >
            <ClipboardList size={14} className="opacity-80" />
            {t("taskForm__checklist_templates")}
          </Button>

          {checklist.length > 0 && (
            <>
              <Button
                type="button"
                variant={selectMode ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={selectMode}
                onClick={toggleSelectMode}
                className="rounded-lg text-xs font-semibold"
              >
                {selectMode ? t("checklistManager__select_mode_done") : t("checklistManager__select_mode_select")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={deleteAll}
                className="rounded-lg text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                {t("checklistManager__delete_all")}
              </Button>
            </>
          )}
        </div>
      </div>

      {selectMode && checklist.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-1 py-1">
          <Button type="button" variant="ghost" size="sm" onClick={toggleSelectAll}>
            {allSelected ? t("checklistManager__deselect_all") : t("checklistManager__select_all")}
          </Button>
          {selectedIds.size > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={deleteSelected}
            >
              <Trash2 />
              {t("checklistManager__delete_selected", { count: selectedIds.size })}
            </Button>
          )}
          <span className="ml-auto text-xs font-medium text-muted-foreground">
            {selectedIds.size}/{checklist.length}
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <span className="w-7 text-xs font-semibold text-muted-foreground">{progress}%</span>
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted shadow-inner"
        >
          <div
            className="h-full rounded-full bg-primary/60 transition-colors duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="space-y-1">
        {visibleChecklist.map((item) => {
          const selected = selectedIds.has(item.id);
          return (
            <div
              key={item.id}
              className={cn(
                "group flex items-start gap-2 px-0 py-1.5 transition-colors",
                selectMode && selected && "bg-primary/5",
              )}
            >
              {selectMode ? (
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => toggleSelectItem(item.id)}
                  aria-label={item.text}
                  className="mt-0.5"
                />
              ) : (
                <Checkbox
                  checked={item.completed}
                  onCheckedChange={() => toggleItem(item.id)}
                  aria-label={item.text}
                  className="mt-0.5"
                />
              )}

              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  value={item.text}
                  aria-label={item.text}
                  onFocus={() => (editStartTextRef.current = item.text)}
                  onChange={(e) => editItemText(item.id, e.target.value)}
                  onBlur={() => finishEditItemText(item)}
                  className={cn(
                    "w-full border-none bg-transparent p-0 text-sm font-semibold outline-none transition-colors",
                    item.completed ? "text-muted-foreground line-through opacity-50" : "text-foreground",
                  )}
                />
              </div>

              <div
                className={cn(
                  "flex items-center gap-1 transition-opacity focus-within:opacity-100",
                  deletingItemId === item.id ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
              >
                {deletingItemId === item.id ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label="Confirm delete checklist item"
                      onClick={() => {
                        removeItem(item.id);
                        setDeletingItemId(null);
                      }}
                    >
                      <Check />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:text-destructive"
                      aria-label="Cancel delete checklist item"
                      onClick={() => setDeletingItemId(null)}
                    >
                      <X />
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={t("workerManager__btn_delete")}
                    onClick={() => setDeletingItemId(item.id)}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
        >
          {t("checklistManager__show_more", {
            count: Math.min(PAGE_SIZE, checklist.length - visibleCount),
            current: visibleCount,
            total: checklist.length,
          })}
        </Button>
      )}

      {isAddingItem ? (
        <div className="animate-in space-y-3 rounded-lg border border-border bg-muted/50 p-4 duration-200 fade-in slide-in-from-top-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitNewItem();
              } else if (e.key === "Escape") {
                cancelAddItem();
              }
            }}
            placeholder={t("checklistManager__placeholder")}
            className="rounded-lg border-2 border-primary/20 bg-background px-4 py-2.5 text-sm"
          />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" className="rounded-lg font-medium" onClick={submitNewItem}>
              {t("checklistManager__add_item")}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="font-medium" onClick={cancelAddItem}>
              {t("checklistManager__cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsAddingItem(true)}
            className="rounded-lg font-medium text-muted-foreground"
          >
            <Plus size={14} />
            {t("checklistManager__add_item")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setBulkOpen(true);
              setBulkText("");
            }}
            className="rounded-lg font-medium text-muted-foreground"
          >
            <ListTodo size={14} />
            {t("checklistManager__add_multiple")}
          </Button>
        </div>
      )}

      {showTemplateModal && (
        <ChecklistTemplateModal
          templates={templates}
          isOwner
          showImport
          onClose={() => setShowTemplateModal(false)}
          onAdd={handleAddTemplate}
          onUpdate={handleUpdateTemplate}
          onDelete={handleDeleteTemplate}
          onImport={handleImportTemplate}
        />
      )}

      <Dialog open={bulkOpen} onOpenChange={(next) => !next && closeBulkAdd()}>
        <DialogContent className="max-w-lg gap-4 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-medium">{t("checklistManager__bulk_modal_title")}</DialogTitle>
            <DialogDescription className="text-xs">{t("checklistManager__bulk_modal_desc")}</DialogDescription>
          </DialogHeader>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={8}
            placeholder={t("checklistManager__bulk_modal_placeholder")}
            aria-label={t("checklistManager__bulk_modal_title")}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                addItemsFromBulkText();
              }
            }}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/50"
          />
          <DialogFooter>
            <Button type="button" variant="ghost" className="font-medium" onClick={closeBulkAdd}>
              {t("checklistManager__cancel")}
            </Button>
            <Button type="button" className="rounded-lg font-medium" onClick={addItemsFromBulkText}>
              {t("checklistManager__bulk_modal_add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
