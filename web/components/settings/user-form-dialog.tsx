"use client";

import { withBase } from "@/lib/base-path";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Edit2,
  KeyRound,
  Mail,
  Shield,
  Tag,
  User as UserIcon,
  UserPlus,
  XCircle,
} from "lucide-react";
import { POSITION_OPTIONS } from "@/components/profile/position-options";
import type { ManagedUser } from "@/components/settings/user-types";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api/apis";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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

const LABEL = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const FIELD = "h-10 pl-11";
const ICON_WRAP = "pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-muted-foreground";

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

  const roleButton = (role: "user" | "admin", Icon: typeof UserIcon, label: string, tone: string) => (
    <button
      type="button"
      onClick={() => setField("role", role)}
      aria-pressed={form.role === role}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 transition-all",
        form.role === role
          ? `${tone} font-bold`
          : "border-border bg-muted/40 text-muted-foreground hover:border-ring/50",
      )}
    >
      <Icon size={14} />
      <span className="text-xs">{label}</span>
    </button>
  );

  const modeButton = (value: RegistrationMode, Icon: typeof Mail, label: string) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      aria-pressed={mode === value}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all",
        mode === value ? "bg-card text-primary shadow-sm" : "text-muted-foreground",
      )}
    >
      <Icon size={14} />
      {label}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-6 text-left">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold leading-normal">
            {editingUser ? (
              <>
                <Edit2 className="text-primary" size={24} />
                Update User
              </>
            ) : (
              <>
                <UserPlus className="text-primary" size={24} />
                {t("users__modal_title")}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {editingUser ? "Edit user profile information" : t("users__modal_subtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[75vh] overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="mb-2 grid grid-cols-2 gap-3">
              {roleButton("user", UserIcon, t("users__role_user"), "border-primary bg-primary/10 text-primary")}
              {roleButton(
                "admin",
                Shield,
                t("users__role_admin"),
                "border-purple-500 bg-purple-500/10 text-purple-500",
              )}
            </div>

            {!editingUser && (
              <div className="mb-4 flex rounded-xl bg-muted p-1">
                {modeButton("invite", Mail, t("users__mode_invite"))}
                {modeButton("password", KeyRound, t("users__mode_password"))}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="user-email" className={LABEL}>
                {t("users__form_email")}
              </Label>
              <div className="relative">
                <div className={ICON_WRAP}>
                  <Mail size={16} />
                </div>
                <Input
                  id="user-email"
                  type="email"
                  required
                  readOnly={!!editingUser}
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="colleague@example.com"
                  className={cn(FIELD, editingUser && "cursor-not-allowed opacity-60")}
                />
              </div>
            </div>

            {(mode === "password" || editingUser) && (
              <div className="space-y-1.5">
                <Label htmlFor="user-password" className={LABEL}>
                  {editingUser ? "Reset Password (optional)" : t("users__form_password")}
                </Label>
                <div className="relative">
                  <div className={ICON_WRAP}>
                    <KeyRound size={16} />
                  </div>
                  <Input
                    id="user-password"
                    type="password"
                    autoComplete="new-password"
                    required={!editingUser}
                    value={form.password}
                    onChange={(e) => setField("password", e.target.value)}
                    placeholder={editingUser ? "Leave blank to keep current" : "••••••••"}
                    className={FIELD}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="user-first-name" className={LABEL}>
                  {t("users__form_first_name")}
                </Label>
                <div className="relative">
                  <div className={ICON_WRAP}>
                    <UserIcon size={16} />
                  </div>
                  <Input
                    id="user-first-name"
                    value={form.first_name}
                    onChange={(e) => setField("first_name", e.target.value)}
                    placeholder="John"
                    className={FIELD}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-last-name" className={LABEL}>
                  {t("users__form_last_name")}
                </Label>
                <Input
                  id="user-last-name"
                  value={form.last_name}
                  onChange={(e) => setField("last_name", e.target.value)}
                  placeholder="Doe"
                  className="h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="user-nickname" className={LABEL}>
                  {t("users__form_nickname")}
                </Label>
                <div className="relative">
                  <div className={ICON_WRAP}>
                    <Tag size={16} />
                  </div>
                  <Input
                    id="user-nickname"
                    value={form.nickname}
                    onChange={(e) => setField("nickname", e.target.value)}
                    placeholder="Johnny"
                    className={FIELD}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="position" className={LABEL}>
                  {t("users__form_position")}
                </Label>
                <div className="relative">
                  <div className={cn(ICON_WRAP, "z-10")}>
                    <Briefcase size={16} />
                  </div>
                  <SearchableSelect
                    id="position"
                    value={form.position}
                    onValueChange={(value) => setField("position", String(value ?? ""))}
                    options={POSITION_OPTIONS}
                    placeholder="Developer"
                    showSearch={false}
                    customClass="pl-11"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="user-discord-id" className={LABEL}>
                {t("users__form_discord_id")}
              </Label>
              <div className="relative">
                <div className={ICON_WRAP}>
                  <div className="flex size-4 items-center justify-center rounded-full bg-primary/20 text-[8px] font-bold text-primary">
                    D
                  </div>
                </div>
                <Input
                  id="user-discord-id"
                  value={form.discord_id}
                  onChange={(e) => setField("discord_id", e.target.value)}
                  placeholder="123456789012345678"
                  className={FIELD}
                />
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                <XCircle size={16} />
                {error}
              </div>
            )}

            {setupLink && (
              <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/10 p-4">
                <div className="flex items-center gap-2 border-b border-primary/20 pb-2 text-sm font-bold text-primary">
                  <CheckCircle2 size={16} />
                  {t("users__invite_link_generated")}
                </div>
                <p className="text-xs text-muted-foreground">{t("users__copy_link_hint")}</p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={setupLink}
                    aria-label={t("users__invite_link_generated")}
                    className="h-8 flex-1 font-mono text-xs text-primary"
                  />
                  <Button type="button" size="sm" onClick={() => void navigator.clipboard.writeText(setupLink)}>
                    {t("users__btn_copy")}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="h-11 flex-1">
                {t("users__btn_cancel")}
              </Button>
              <Button type="submit" disabled={loading} className="group h-11 flex-[2] gap-2 font-bold">
                {loading ? (
                  <span className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    {editingUser
                      ? "Update Profile"
                      : mode === "invite"
                        ? t("users__btn_create_invite")
                        : t("users__btn_create_user")}
                    <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
