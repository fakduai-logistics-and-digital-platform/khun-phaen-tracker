"use client";

import { withBase } from "@/lib/base-path";
import { useEffect, useState } from "react";
import { XCircle } from "lucide-react";
import { POSITION_OPTIONS } from "@/components/profile/position-options";
import type { ManagedUser } from "@/components/settings/user-types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api/apis";
import { useI18n } from "@/lib/i18n";

type FormData = {
  email: string;
  password: string;
  role: string;
  first_name: string;
  last_name: string;
  nickname: string;
  position: string;
  discord_id: string;
};

export type RegistrationMode = "invite" | "password";

type UserFormDialogProps = {
  open: boolean;
  editingUser: ManagedUser | null;
  initialMode?: RegistrationMode;
  onClose: () => void;
  onSaved: () => void;
};

const EMPTY_FORM: FormData = {
  email: "",
  password: "",
  role: "user",
  first_name: "",
  last_name: "",
  nickname: "",
  position: "",
  discord_id: "",
};

function formFromUser(user: ManagedUser): FormData {
  return {
    email: user.email,
    password: "",
    role: user.role,
    first_name: user.profile?.first_name || "",
    last_name: user.profile?.last_name || "",
    nickname: user.profile?.nickname || "",
    position: user.profile?.position || "",
    discord_id: user.discord_id || "",
  };
}

export function UserFormDialog({ open, editingUser, initialMode = "invite", onClose, onSaved }: UserFormDialogProps) {
  const { t } = useI18n();
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [mode, setMode] = useState<RegistrationMode>("invite");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [setupLink, setSetupLink] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(editingUser ? formFromUser(editingUser) : EMPTY_FORM);
    setMode(initialMode);
    setError("");
    setSetupLink("");
  }, [open, editingUser, initialMode]);

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSetupLink("");

    try {
      const payload: Partial<FormData> = { ...form };
      if (mode === "invite") {
        delete payload.password;
      } else if (!payload.password && !editingUser) {
        setError("Password is required");
        return;
      }
      if (editingUser && !payload.password) delete payload.password;

      const res = editingUser ? await api.auth.updateUser(editingUser.id, payload) : await api.auth.invite(payload);
      const data = await res.json();

      if (res.ok) {
        onSaved();
        if (data.setup_link) setSetupLink(window.location.origin + withBase(data.setup_link));
        else onClose();
      } else {
        setError(data.error || "User operation failed");
      }
    } catch {
      setError("User operation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Update User" : t("users__modal_title")}</DialogTitle>
            <DialogDescription>
              {editingUser ? "Edit user profile information" : t("users__modal_subtitle")}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            {!editingUser && (
              <Tabs value={mode} onValueChange={(value) => setMode(value as RegistrationMode)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="invite">{t("users__mode_invite")}</TabsTrigger>
                  <TabsTrigger value="password">{t("users__mode_password")}</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            <Field>
              <FieldLabel htmlFor="user-email">{t("users__form_email")}</FieldLabel>
              <Input
                id="user-email"
                type="email"
                required
                readOnly={!!editingUser}
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="colleague@example.com"
              />
            </Field>

            {(mode === "password" || editingUser) && (
              <Field>
                <FieldLabel htmlFor="user-password">
                  {editingUser ? "Reset Password (optional)" : t("users__form_password")}
                </FieldLabel>
                <Input
                  id="user-password"
                  type="password"
                  autoComplete="new-password"
                  required={!editingUser}
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  placeholder={editingUser ? "Leave blank to keep current" : "••••••••"}
                />
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="user-role">{t("users__table_role")}</FieldLabel>
              <Select value={form.role} onValueChange={(value) => setField("role", value)}>
                <SelectTrigger id="user-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{t("users__role_user")}</SelectItem>
                  <SelectItem value="admin">{t("users__role_admin")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="user-first-name">{t("users__form_first_name")}</FieldLabel>
                <Input
                  id="user-first-name"
                  value={form.first_name}
                  onChange={(e) => setField("first_name", e.target.value)}
                  placeholder="John"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="user-last-name">{t("users__form_last_name")}</FieldLabel>
                <Input
                  id="user-last-name"
                  value={form.last_name}
                  onChange={(e) => setField("last_name", e.target.value)}
                  placeholder="Doe"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="user-nickname">{t("users__form_nickname")}</FieldLabel>
                <Input
                  id="user-nickname"
                  value={form.nickname}
                  onChange={(e) => setField("nickname", e.target.value)}
                  placeholder="Johnny"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="user-position">{t("users__form_position")}</FieldLabel>
                <Select value={form.position} onValueChange={(value) => setField("position", value)}>
                  <SelectTrigger id="user-position" className="w-full">
                    <SelectValue placeholder="Developer" />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="user-discord-id">{t("users__form_discord_id")}</FieldLabel>
              <Input
                id="user-discord-id"
                value={form.discord_id}
                onChange={(e) => setField("discord_id", e.target.value)}
                placeholder="123456789012345678"
              />
            </Field>
          </FieldGroup>

          {error && (
            <Alert variant="destructive" role="alert">
              <XCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {setupLink && (
            <Field>
              <FieldLabel htmlFor="user-setup-link">{t("users__invite_link_generated")}</FieldLabel>
              <div className="flex gap-2">
                <Input id="user-setup-link" readOnly value={setupLink} className="font-mono text-xs" />
                <Button type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(setupLink)}>
                  {t("users__btn_copy")}
                </Button>
              </div>
              <FieldDescription>{t("users__copy_link_hint")}</FieldDescription>
            </Field>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t("users__btn_cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading}>
              {loading && <Spinner data-icon="inline-start" />}
              {editingUser
                ? "Update Profile"
                : mode === "invite"
                  ? t("users__btn_create_invite")
                  : t("users__btn_create_user")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
