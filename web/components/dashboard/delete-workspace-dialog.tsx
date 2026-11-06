"use client";

import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

export function DeleteWorkspaceDialog({
  open,
  deleting,
  onConfirm,
  onClose,
}: {
  open: boolean;
  deleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader className="items-center sm:text-center">
          <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Trash2 className="size-6" />
          </span>
          <DialogTitle className="text-xl font-bold">{t("dashboard__modal_delete_title")}</DialogTitle>
          <DialogDescription>{t("dashboard__modal_delete_warning")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-center">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            {t("dashboard__modal_btn_cancel")}
          </Button>
          <Button type="button" variant="destructive" className="flex-1" disabled={deleting} onClick={onConfirm}>
            {deleting ? <Loader2 className="size-4 animate-spin" /> : t("dashboard__modal_btn_delete_confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
