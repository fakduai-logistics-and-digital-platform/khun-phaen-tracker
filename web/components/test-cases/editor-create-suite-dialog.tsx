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
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { useI18n } from "@/lib/i18n";

type EditorCreateSuiteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (title: string) => Promise<boolean>;
};

export function EditorCreateSuiteDialog({ open, onOpenChange, onCreate }: EditorCreateSuiteDialogProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");

  async function create() {
    if (!name.trim()) return;
    if (await onCreate(name)) {
      setName("");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("tcEditor__suite_dialog_title")}</DialogTitle>
          <DialogDescription>{t("tcEditor__suite_dialog_desc")}</DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="new-suite-name">{t("tcEditor__suite_name")}</FieldLabel>
          <Input
            id="new-suite-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void create();
              }
            }}
            placeholder={t("tcEditor__suite_name_placeholder")}
          />
        </Field>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" disabled={!name.trim()} onClick={() => void create()}>
            {t("tcEditor__suite_create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
