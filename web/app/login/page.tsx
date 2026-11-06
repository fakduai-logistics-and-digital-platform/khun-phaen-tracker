"use client";

import { withBase } from "@/lib/base-path";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "./login.css";
import { LanguagePicker } from "@/components/language-picker";
import { PaletteSwitch } from "@/components/palette-switch";
import { LegalFooter } from "@/components/login/legal-footer";
import { LoginForm } from "@/components/login/login-form";
import { LoginHero } from "@/components/login/login-hero";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n";
import { FALLBACK_SUMMARY, loadPublicLoginSummary, type LoginSummary } from "@/lib/login/summary";

export default function LoginPage() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<LoginSummary>(FALLBACK_SUMMARY);

  useEffect(() => {
    document.title = t("meta__login_title");
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    loadPublicLoginSummary().then((next) => {
      if (next && !cancelled) setSummary(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  return (
    <div className="login-shell dark min-h-screen w-full bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={withBase("/logo-dark.svg")} alt="" className="size-8 rounded-md" />
            <span className="font-bold">{t("login__brand_name")}</span>
          </div>
          <div className="flex items-center gap-2">
            <PaletteSwitch />
            <LanguagePicker />
          </div>
        </header>

        <main className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.8fr)] lg:gap-20">
          <LoginHero summary={summary} />
          <section className="mx-auto w-full max-w-md">
            <LoginForm />
            <LegalFooter />
          </section>
        </main>
      </div>
    </div>
  );
}
