"use client";

import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useI18n } from "@/lib/i18n";
import { ConnectGuide, CopyButton } from "./api-key-connect";

type CreateDialogProps = {
  open: boolean;
  name: string;
  busy: boolean;
  error: string;
  createdKey: string | null;
  mcpUrl: string;
  onNameChange: (name: string) => void;
  onSubmit: () => void;
  onClose: () => void;
};

export function CreateKeyDialog({
  open,
  name,
  busy,
  error,
  createdKey,
  mcpUrl,
  onNameChange,
  onSubmit,
  onClose,
}: CreateDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{createdKey ? t("apiKeys__created_title") : t("apiKeys__create")}</DialogTitle>
          <DialogDescription>{createdKey ? t("apiKeys__created_desc") : t("apiKeys__create_desc")}</DialogDescription>
        </DialogHeader>

        {createdKey ? (
          <div className="min-w-0 space-y-4">
            <Alert>
              <TriangleAlert />
              <AlertTitle>{t("apiKeys__created_warning")}</AlertTitle>
              <AlertDescription>{t("apiKeys__security_desc")}</AlertDescription>
            </Alert>
            <div className="flex items-center gap-2">
              <Input readOnly value={createdKey} aria-label={t("apiKeys__col_key")} className="font-mono text-xs" />
              <CopyButton value={createdKey} label={t("apiKeys__col_key")} />
            </div>
            <ConnectGuide apiKey={createdKey} url={mcpUrl} />
            <DialogFooter>
              <Button type="button" onClick={onClose}>
                {t("apiKeys__done")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
            className="space-y-4"
          >
            <FieldGroup>
              <Field data-invalid={!!error}>
                <FieldLabel htmlFor="api-key-name">{t("apiKeys__name_label")}</FieldLabel>
                <Input
                  id="api-key-name"
                  value={name}
                  maxLength={64}
                  aria-invalid={!!error}
                  placeholder={t("apiKeys__name_placeholder")}
                  onChange={(event) => onNameChange(event.target.value)}
                />
                <FieldDescription>{t("apiKeys__name_hint")}</FieldDescription>
                {error && <FieldError>{error}</FieldError>}
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("apiKeys__cancel")}
              </Button>
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy && <Spinner />}
                {t("apiKeys__create")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

type DeleteDialogProps = {
  name: string | null;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function DeleteKeyDialog({ name, busy, onConfirm, onClose }: DeleteDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={name !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("apiKeys__delete_title")}</DialogTitle>
          <DialogDescription>{t("apiKeys__delete_desc", { name: name ?? "" })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("apiKeys__cancel")}
          </Button>
          <Button type="button" variant="destructive" disabled={busy} onClick={onConfirm}>
            {busy && <Spinner />}
            {t("apiKeys__delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
