"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
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
import {
  DEFAULT_WORKSPACE_COLOR,
  DEFAULT_WORKSPACE_ICON,
  WORKSPACE_COLORS,
  WORKSPACE_ICONS,
} from "@/lib/dashboard/workspace-options";
import { useI18n } from "@/lib/i18n";
import type { Workspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export type WorkspaceFormValues = { name: string; color: string; icon: string };

export function WorkspaceFormDialog({
  open,
  workspace,
  submitting,
  onSubmit,
  onClose,
}: {
  open: boolean;
  /** When set, the dialog edits this workspace; otherwise it creates a new one. */
  workspace: Workspace | null;
  submitting: boolean;
  onSubmit: (values: WorkspaceFormValues) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const editing = workspace !== null;
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_WORKSPACE_COLOR);
  const [icon, setIcon] = useState(DEFAULT_WORKSPACE_ICON);

  useEffect(() => {
    if (!open) return;
    setName(workspace?.name ?? "");
    setColor(workspace?.color || DEFAULT_WORKSPACE_COLOR);
    setIcon(workspace?.icon || DEFAULT_WORKSPACE_ICON);
  }, [open, workspace]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg gap-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
              {editing ? <Pencil className="size-5" /> : <Plus className="size-5" />}
            </span>
            {editing ? t("dashboard__modal_edit_title") : t("dashboard__modal_title")}
          </DialogTitle>
          <DialogDescription>
            {editing ? t("dashboard__modal_edit_subtitle") : t("dashboard__modal_create_subtitle")}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onSubmit({ name: name.trim(), color, icon });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="workspace-name" className="font-bold">
              {t("dashboard__modal_name_label")}
            </Label>
            <Input
              id="workspace-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("dashboard__modal_name_placeholder")}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-bold">{t("dashboard__modal_color_label")}</legend>
            <div className="flex flex-wrap gap-2.5">
              {WORKSPACE_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  aria-label={`Select color ${c.name}`}
                  aria-pressed={color === c.value}
                  className={cn(
                    "size-7 rounded-full border-2 transition-opacity",
                    color === c.value
                      ? "border-primary ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
                      : "border-transparent opacity-60 hover:opacity-100",
                  )}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-bold">{t("dashboard__modal_icon_label")}</legend>
            <div className="grid grid-cols-7 gap-2">
              {WORKSPACE_ICONS.map(({ key, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  aria-label={`Select icon ${key}`}
                  aria-pressed={icon === key}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-xl border-2 transition-colors",
                    icon === key
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-transparent text-muted-foreground hover:bg-accent",
                  )}
                >
                  <Icon size={18} />
                </button>
              ))}
            </div>
          </fieldset>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("dashboard__modal_btn_cancel")}
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : editing ? (
                t("dashboard__modal_btn_save")
              ) : (
                t("dashboard__modal_btn_create_space")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
