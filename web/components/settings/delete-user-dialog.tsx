"use client";

import { Trash2 } from "lucide-react";
import type { ManagedUser } from "@/components/settings/user-types";
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

type DeleteUserDialogProps = {
  user: ManagedUser | null;
  deleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function DeleteUserDialog({ user, deleting, onConfirm, onClose }: DeleteUserDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={user !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader className="items-center text-center sm:text-center">
          <div className="mb-2 flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-8 ring-destructive/5">
            <Trash2 size={32} />
          </div>
          <DialogTitle className="text-lg font-bold">{t("users__delete_title")}</DialogTitle>
          <DialogDescription>{t("users__delete_confirm_text", { email: user?.email ?? "" })}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          <Button variant="outline" onClick={onClose}>
            {t("users__btn_cancel")}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={deleting}>
            {deleting ? (
              <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              t("users__btn_confirm_delete")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
