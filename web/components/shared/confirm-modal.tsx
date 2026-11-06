"use client";

import { AlertTriangle, CheckCircle2, CircleAlert } from "lucide-react";
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
import { cn } from "@/lib/utils";

type ConfirmModalProps = {
  show?: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info";
  onConfirm?: () => void;
  onClose?: () => void;
};

const TYPE_STYLES = {
  danger: { icon: AlertTriangle, iconClass: "text-destructive", variant: "destructive" },
  warning: { icon: CircleAlert, iconClass: "text-warning", variant: "default" },
  info: { icon: CheckCircle2, iconClass: "text-primary", variant: "default" },
} as const;

export function ConfirmModal({
  show = false,
  title = "",
  message = "",
  confirmText = "",
  cancelText = "",
  type = "danger",
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const { t } = useI18n();
  const { icon: Icon, iconClass, variant } = TYPE_STYLES[type];

  return (
    <Dialog open={show} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={cn("size-5", iconClass)} />
            {title || t("common.confirm")}
          </DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onClose?.()}>
            {cancelText || t("common.cancel")}
          </Button>
          <Button type="button" variant={variant} onClick={() => onConfirm?.()}>
            {confirmText || t("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
