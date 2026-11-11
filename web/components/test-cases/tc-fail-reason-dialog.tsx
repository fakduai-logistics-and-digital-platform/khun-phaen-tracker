"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";

export const MAX_FAIL_REASON_LENGTH = 1000;

type TcFailReasonDialogProps = {
  open: boolean;
  caseLabel: string;
  initialReason: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
};

// Remount with a new `key` per case so the draft resets without an effect.
export function TcFailReasonDialog({
  open,
  caseLabel,
  initialReason,
  onConfirm,
  onCancel,
}: TcFailReasonDialogProps) {
  const { t } = useI18n();
  const [reason, setReason] = useState(initialReason);
  const trimmed = reason.trim();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed) onConfirm(trimmed);
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("tc__fail_reason_title")}</DialogTitle>
            <DialogDescription>
              <span className="font-mono">{caseLabel}</span>
              {" · "}
              {t("tc__fail_reason_desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="run-case-fail-reason">
              {t("tc__fail_reason_label")}
            </Label>
            <Textarea
              id="run-case-fail-reason"
              value={reason}
              maxLength={MAX_FAIL_REASON_LENGTH}
              rows={4}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("tc__fail_reason_placeholder")}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t("tc__cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={!trimmed}>
              {t("tc__fail_reason_confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
