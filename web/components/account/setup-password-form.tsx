"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, ShieldCheck, X } from "lucide-react";
import { AccountField } from "@/components/account/account-field";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/apis";
import { useI18n } from "@/lib/i18n";

const REDIRECT_DELAY_MS = 3000;

function SuccessPanel() {
  const { t } = useI18n();
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="animate-in fade-in text-center duration-300">
      <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-emerald-500/20">
        <ShieldCheck className="size-10 text-emerald-400" />
      </div>
      <h1 className="mb-4 text-3xl font-bold text-white">{t("setup__success_title")}</h1>
      <p className="mb-8 text-muted-foreground">{t("setup__success_desc")}</p>
      <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full bg-emerald-500 transition-[width] ease-linear"
          style={{ width: filled ? "100%" : "0%", transitionDuration: `${REDIRECT_DELAY_MS}ms` }}
        />
      </div>
    </div>
  );
}

export function SetupPasswordForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const urlToken = new URLSearchParams(window.location.search).get("token") || "";
    setToken(urlToken);
    if (!urlToken) {
      setError(t("setup__error_no_token"));
      setInitializing(false);
      return;
    }

    let cancelled = false;
    let redirectTimer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const res = await api.auth.getSetupInfo(urlToken);
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setEmail(data.email);
        } else {
          setError(data.error || t("setup__error_invalid_token"));
          redirectTimer = setTimeout(() => router.push("/login"), REDIRECT_DELAY_MS);
        }
      } catch {
        if (!cancelled) setError(t("setup__error_verify"));
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();

    return () => {
      cancelled = true;
      if (redirectTimer) clearTimeout(redirectTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => router.push("/login"), REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [success, router]);

  async function handleSetup(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;

    if (password.length < 8) {
      setError(t("setup__error_min_length"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("setup__error_mismatch"));
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await api.auth.setupPassword(token, password);
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || t("setup__error_default"));
      }
    } catch {
      setError(t("setup__error_generic"));
    } finally {
      setLoading(false);
    }
  }

  if (success) return <SuccessPanel />;

  return (
    <>
      <div className="mb-8 text-center lg:text-left">
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-white">{t("setup__title")}</h1>
        {initializing ? (
          <p className="animate-pulse text-sm text-brand-300">{t("setup__verifying_token")}</p>
        ) : email ? (
          <p className="text-sm text-muted-foreground">
            {t("setup__setting_up_for")} <span className="font-semibold text-brand-300">{email}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("setup__default_subtitle")}</p>
        )}
      </div>

      <form onSubmit={handleSetup} className="space-y-5">
        <AccountField
          id="password"
          type="password"
          label={t("setup__new_password_label")}
          icon={Lock}
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        <AccountField
          id="confirmPassword"
          type="password"
          label={t("setup__confirm_password_label")}
          icon={Lock}
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
        />

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-3 text-sm font-semibold text-rose-200"
          >
            <X className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          type="submit"
          disabled={loading || !token}
          className="group mt-2 h-12 w-full gap-2 rounded-lg bg-brand-600 text-sm font-bold text-white hover:bg-brand-500"
        >
          {loading ? (
            <span className="size-5 animate-spin rounded-full border-2 border-foreground/30 border-t-white" />
          ) : (
            <>
              {t("setup__btn_submit")}
              <ArrowRight className="size-[18px] transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>
      </form>
    </>
  );
}
