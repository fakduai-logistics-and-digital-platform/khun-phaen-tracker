"use client";

import { useState } from "react";
import { Check, ClipboardList, Download, Edit2, ListChecks, Plus, Trash2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import type { ChecklistTemplate } from "@/lib/types";

const NO_TEMPLATES: ChecklistTemplate[] = [];
const PREVIEW_ITEM_COUNT = 3;

export function ChecklistTemplateModal({
  templates = NO_TEMPLATES,
  isOwner = true,
  showImport = false,
  onClose,
  onAdd,
  onUpdate,
  onDelete,
  onImport,
}: {
  templates?: ChecklistTemplate[];
  isOwner?: boolean;
  showImport?: boolean;
  onClose?: () => void;
  onAdd?: (detail: { name: string; items: string[] }) => void;
  onUpdate?: (detail: { id: string; name: string; items: string[] }) => void;
  onDelete?: (id: string) => void;
  onImport?: (template: ChecklistTemplate) => void;
}) {
  const { t } = useI18n();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null);
  const [name, setName] = useState("");
  const [itemsText, setItemsText] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function startAdd() {
    setShowAddForm(true);
    setEditingTemplate(null);
    setName("");
    setItemsText("");
  }

  function startEdit(template: ChecklistTemplate) {
    setEditingTemplate(template);
    setShowAddForm(true);
    setName(template.name);
    setItemsText(template.items.join("\n"));
  }

  function cancelEdit() {
    setShowAddForm(false);
    setEditingTemplate(null);
  }

  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const items = itemsText
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (editingTemplate) {
      onUpdate?.({ id: editingTemplate.id, name: trimmedName, items });
    } else {
      onAdd?.({ name: trimmedName, items });
    }
    cancelEdit();
  }

  function handleDelete(id: string) {
    onDelete?.(id);
    setDeleteConfirmId(null);
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden rounded-lg p-0 sm:max-w-lg">
        <DialogHeader className="flex-row items-center gap-4 border-b border-border p-6 text-left">
          <div className="flex size-12 shrink-0 rotate-3 items-center justify-center rounded-lg bg-primary/10 shadow-inner">
            <ClipboardList size={24} className="-rotate-3 text-primary" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-xl font-medium">{t("checklistTemplate__title")}</DialogTitle>
            <DialogDescription>
              {templates.length} {t("checklistTemplate__list_title")}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {showAddForm && isOwner ? (
            <div className="animate-in space-y-5 rounded-lg border border-border bg-muted/40 p-6 shadow-black/5 duration-500 fade-in slide-in-from-top-4">
              <div className="space-y-2">
                <Label htmlFor="template-name" className="ml-1 text-xs font-semibold text-primary">
                  {t("checklistTemplate__name_label")}
                </Label>
                <Input
                  id="template-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("checklistTemplate__name_placeholder")}
                  className="h-auto rounded-lg border-2 px-5 py-3.5 font-medium"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-items" className="ml-1 text-xs font-semibold text-primary">
                  {t("checklistTemplate__items_label")}
                </Label>
                <textarea
                  id="template-items"
                  value={itemsText}
                  onChange={(e) => setItemsText(e.target.value)}
                  rows={5}
                  placeholder={t("checklistTemplate__items_placeholder")}
                  className="w-full resize-none rounded-lg border-2 border-input bg-background px-5 py-4 text-sm leading-relaxed font-medium shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={!name.trim()}
                  className="h-auto flex-[2.5] rounded-lg px-6 py-4 font-semibold"
                >
                  {editingTemplate ? (
                    <>
                      <Check size={20} />
                      {t("checklistTemplate__btn_save")}
                    </>
                  ) : (
                    <>
                      <Plus size={20} />
                      {t("checklistTemplate__btn_add")}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelEdit}
                  className="h-auto flex-1 rounded-lg border-2 px-6 py-4 font-medium"
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            isOwner && (
              <button
                type="button"
                onClick={startAdd}
                className="group flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border px-8 py-6 text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary active:scale-[0.98]"
              >
                <div className="flex size-12 items-center justify-center rounded-lg bg-muted shadow-inner transition-colors group-hover:rotate-12 group-hover:bg-primary group-hover:text-primary-foreground">
                  <Plus size={24} />
                </div>
                <span className="text-sm font-semibold">{t("checklistTemplate__add_new")}</span>
              </button>
            )
          )}

          <div className="space-y-4">
            {templates.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full border border-border bg-muted">
                  <ClipboardList size={32} className="text-muted-foreground/60" />
                </div>
                <p className="mb-1 font-medium text-foreground">{t("checklistTemplate__no_templates")}</p>
                <p className="text-sm text-muted-foreground">{t("checklistTemplate__add_hint")}</p>
              </div>
            ) : (
              templates.map((template) => (
                <div
                  key={template.id}
                  className="group relative rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/20 hover:hover:"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h4 className="mb-1 flex items-center gap-2 truncate font-medium text-foreground">
                        <ListChecks size={16} className="text-primary/60" />
                        {template.name}
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {template.items.slice(0, PREVIEW_ITEM_COUNT).map((item, index) => (
                          <span
                            key={`${item}-${index}`}
                            className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                          >
                            {item}
                          </span>
                        ))}
                        {template.items.length > PREVIEW_ITEM_COUNT && (
                          <span className="pt-0.5 text-xs font-medium text-muted-foreground">
                            {t("checklistTemplateModal__more_items", {
                              count: template.items.length - PREVIEW_ITEM_COUNT,
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                      {showImport && (
                        <button
                          type="button"
                          onClick={() => onImport?.(template)}
                          className="rounded-lg p-2 text-primary transition-colors hover:bg-primary/10"
                          title={t("checklistTemplate__btn_import")}
                          aria-label={t("checklistTemplate__btn_import")}
                        >
                          <Download size={18} />
                        </button>
                      )}
                      {isOwner && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(template)}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            title={t("common.update")}
                            aria-label={t("common.update")}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(template.id)}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            title={t("workerManager__btn_delete")}
                            aria-label={t("workerManager__btn_delete")}
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {deleteConfirmId === template.id && (
                    <div className="mt-4 animate-in rounded-lg border border-destructive/20 bg-destructive/10 p-4 duration-200 fade-in zoom-in-95">
                      <p className="mb-3 text-xs font-medium text-destructive">
                        {t("checklistTemplate__delete_confirm", { name: template.name })}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="flex-1 text-xs font-medium"
                          onClick={() => handleDelete(template.id)}
                        >
                          {t("workerManager__confirm_delete")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs font-medium"
                          onClick={() => setDeleteConfirmId(null)}
                        >
                          {t("common.cancel")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter className="justify-center border-t border-border bg-muted/50 p-4 sm:justify-center">
          <p className="text-center text-xs font-medium text-muted-foreground">{t("checklistTemplate__footer_hint")}</p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
