"use client";

import { AtSign, Fingerprint, Lock, Mail, Save, User as UserIcon } from "lucide-react";
import { POSITION_OPTIONS } from "@/components/profile/position-options";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";

export type ProfileFormValues = {
  firstName: string;
  lastName: string;
  nickname: string;
  position: string;
  discordId: string;
  password: string;
  confirmPassword: string;
};

type ProfileFormProps = {
  email: string;
  values: ProfileFormValues;
  loading: boolean;
  error: string;
  saveSuccess: boolean;
  onChange: <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => void;
  onSubmit: () => void;
};

const LABEL = "mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground";
const ICON =
  "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary";
const FIELD = "h-10 pl-10";

function DiscordIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.196.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z" />
    </svg>
  );
}

export function ProfileForm({ email, values, loading, error, saveSuccess, onChange, onSubmit }: ProfileFormProps) {
  const { t } = useI18n();

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="space-y-6 p-6"
      >
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive"
          >
            {error}
          </div>
        )}
        {saveSuccess && (
          <div
            role="status"
            className="rounded-xl border border-success/30 bg-success/10 p-3 text-sm font-medium text-success"
          >
            {t("profileModal__save_success")}
          </div>
        )}

        <div>
          <Label htmlFor="email" className={`${LABEL} flex items-center gap-1.5`}>
            <Mail size={12} />
            {t("profileModal__email_readonly")}
          </Label>
          <div className="relative">
            <Input id="email" type="email" value={email} disabled className="h-10 pr-10" />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Lock size={14} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="firstName" className={LABEL}>
              {t("users__form_first_name")}
            </Label>
            <div className="group relative">
              <div className={ICON}>
                <UserIcon size={16} />
              </div>
              <Input
                id="firstName"
                value={values.firstName}
                onChange={(e) => onChange("firstName", e.target.value)}
                placeholder={t("profileModal__first_name_placeholder")}
                className={FIELD}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="lastName" className={LABEL}>
              {t("users__form_last_name")}
            </Label>
            <div className="group relative">
              <div className={ICON}>
                <UserIcon size={16} />
              </div>
              <Input
                id="lastName"
                value={values.lastName}
                onChange={(e) => onChange("lastName", e.target.value)}
                placeholder={t("profileModal__last_name_placeholder")}
                className={FIELD}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="nickname" className={LABEL}>
              {t("users__form_nickname")}
            </Label>
            <div className="group relative">
              <div className={ICON}>
                <AtSign size={16} />
              </div>
              <Input
                id="nickname"
                value={values.nickname}
                onChange={(e) => onChange("nickname", e.target.value)}
                placeholder={t("profileModal__nickname_placeholder")}
                className={FIELD}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="position" className={LABEL}>
              {t("users__form_position")}
            </Label>
            <div className="group relative">
              <div className={`${ICON} z-10`}>
                <Fingerprint size={16} />
              </div>
              <SearchableSelect
                id="position"
                value={values.position}
                onValueChange={(value) => onChange("position", String(value ?? ""))}
                options={POSITION_OPTIONS}
                placeholder={t("profileModal__position_placeholder")}
                showSearch={false}
                customClass="pl-10"
              />
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="discordId" className={LABEL}>
            {t("users__form_discord_id")}
          </Label>
          <div className="group relative">
            <div className={ICON}>
              <DiscordIcon />
            </div>
            <Input
              id="discordId"
              value={values.discordId}
              onChange={(e) => onChange("discordId", e.target.value)}
              placeholder={t("profileModal__discord_id_placeholder")}
              className={FIELD}
            />
          </div>
        </div>

        <hr className="border-border" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="password" className={LABEL}>
              {t("profileModal__new_password")}
            </Label>
            <div className="group relative">
              <div className={ICON}>
                <Lock size={16} />
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={values.password}
                onChange={(e) => onChange("password", e.target.value)}
                placeholder="••••••••"
                className={FIELD}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="confirmPassword" className={LABEL}>
              {t("profileModal__confirm_password")}
            </Label>
            <div className="group relative">
              <div className={ICON}>
                <Lock size={16} />
              </div>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={values.confirmPassword}
                onChange={(e) => onChange("confirmPassword", e.target.value)}
                placeholder="••••••••"
                className={FIELD}
              />
            </div>
          </div>
        </div>

        <div className="pt-2">
          <Button type="submit" disabled={loading} className="h-11 w-full gap-2 font-bold">
            {loading ? (
              <span className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Save size={18} />
            )}
            {t("profileModal__btn_save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
