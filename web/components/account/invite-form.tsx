"use client";

import { withBase } from "@/lib/base-path";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Briefcase, CheckCircle2, Mail, Shield, Tag, User, X } from "lucide-react";
import { AccountField } from "@/components/account/account-field";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/apis";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type FormData = {
  email: string;
  role: "user" | "admin";
  first_name: string;
  last_name: string;
  nickname: string;
  position: string;
};

const INITIAL: FormData = { email: "", role: "user", first_name: "", last_name: "", nickname: "", position: "" };

export function InviteForm() {
  const { t } = useI18n();
  const [form, setForm] = useState<FormData>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [setupLink, setSetupLink] = useState("");

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSetupLink("");

    try {
      const res = await api.auth.invite(form);
      const data = await res.json();
      if (res.ok) {
        setSetupLink(window.location.origin + withBase(data.setup_link));
      } else {
        setError(data.error || t("create__error_default"));
      }
    } catch {
      setError(t("create__error_default"));
    } finally {
      setLoading(false);
    }
  }

  const roleButton = (role: FormData["role"], Icon: typeof User, label: string) => (
    <button
      type="button"
      onClick={() => setField("role", role)}
      aria-pressed={form.role === role}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 transition-all",
        form.role === role
          ? "border-brand-400/70 bg-brand-500/15 font-bold text-brand-200"
          : "border-slate-700/50 bg-slate-900/50 text-muted-foreground hover:border-slate-600",
      )}
    >
      <Icon size={14} />
      <span className="text-xs">{label}</span>
    </button>
  );

  return (
    <>
      <div className="mb-7 text-center lg:text-left">
        <h1 className="text-3xl font-bold tracking-tight text-white">{t("create__title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("create__subtitle")}</p>
      </div>

      <form onSubmit={handleInvite} className="space-y-4">
        <div className="mb-2 grid grid-cols-2 gap-3">
          {roleButton("user", User, t("create__role_user"))}
          {roleButton("admin", Shield, t("create__role_admin"))}
        </div>

        <AccountField
          id="email"
          type="email"
          label={t("create__email_label")}
          icon={Mail}
          required
          autoComplete="off"
          value={form.email}
          onChange={(e) => setField("email", e.target.value)}
          placeholder={t("create__email_placeholder")}
        />

        <div className="grid grid-cols-2 gap-4">
          <AccountField
            id="first_name"
            label={t("create__first_name_label")}
            icon={User}
            value={form.first_name}
            onChange={(e) => setField("first_name", e.target.value)}
            placeholder={t("create__first_name_placeholder")}
          />
          <AccountField
            id="last_name"
            label={t("create__last_name_label")}
            icon={User}
            value={form.last_name}
            onChange={(e) => setField("last_name", e.target.value)}
            placeholder={t("create__last_name_placeholder")}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <AccountField
            id="nickname"
            label={t("create__nickname_label")}
            icon={Tag}
            value={form.nickname}
            onChange={(e) => setField("nickname", e.target.value)}
            placeholder={t("create__nickname_placeholder")}
          />
          <AccountField
            id="position"
            label={t("create__position_label")}
            icon={Briefcase}
            value={form.position}
            onChange={(e) => setField("position", e.target.value)}
            placeholder={t("create__position_placeholder")}
          />
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-3 text-sm font-semibold text-rose-200"
          >
            <X className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {setupLink && (
          <div className="space-y-3 rounded-lg border border-brand-400/20 bg-brand-500/10 p-4">
            <div className="flex items-center gap-2 border-b border-brand-400/20 pb-2 text-sm font-bold text-brand-200">
              <CheckCircle2 size={16} />
              {t("create__invite_generated")}
            </div>
            <p className="text-xs text-muted-foreground">{t("create__copy_link_hint")}</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={setupLink}
                aria-label={t("create__invite_generated")}
                className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-brand-200 outline-none"
              />
              <Button type="button" size="sm" onClick={() => void navigator.clipboard.writeText(setupLink)}>
                {t("create__btn_copy")}
              </Button>
            </div>
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="group mt-2 h-12 w-full gap-2 rounded-lg bg-brand-600 text-sm font-bold text-white hover:bg-brand-500"
        >
          {loading ? (
            <span className="size-5 animate-spin rounded-full border-2 border-foreground/30 border-t-white" />
          ) : (
            <>
              {t("create__btn_submit")}
              <ArrowRight className="size-[18px] transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm">
        <span className="text-muted-foreground">{t("create__has_account")}</span>
        <Link
          href="/login"
          className="ml-1.5 font-medium text-brand-300 underline-offset-4 transition-colors hover:text-brand-200 hover:underline"
        >
          {t("create__link_login")}
        </Link>
      </div>
    </>
  );
}
