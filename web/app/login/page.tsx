"use client";

import { withBase } from "@/lib/base-path";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "./login.css";
import { LanguagePicker } from "@/components/language-picker";
import { PaletteSwitch } from "@/components/palette-switch";
import { LegalFooter } from "@/components/login/legal-footer";
import { LoginForm } from "@/components/login/login-form";
import {
  ENTER_CLASS,
  LoginHeroText,
  LoginHeroVisual,
} from "@/components/login/login-hero";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { loadPublicLoginSummary, type LoginSummary } from "@/lib/login/summary";

export default function LoginPage() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<LoginSummary | null>(null);

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
        <header className="flex items-center justify-between py-2 animate-in fade-in duration-500 motion-reduce:animate-none">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={withBase("/logo-dark.svg")}
              alt=""
              className="size-8 rounded-md"
            />
            <span className="font-semibold">{t("login__brand_name")}</span>
          </div>
          <div className="flex items-center gap-2">
            <PaletteSwitch />
            <LanguagePicker />
          </div>
        </header>

        <main className="grid flex-1 content-center gap-8 py-6 sm:py-10 lg:grid-cols-2 lg:gap-x-20 lg:gap-y-10">
          <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
            <LoginHeroText />
          </div>
          <section
            className={cn(
              "mx-auto w-full max-w-md lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center",
              ENTER_CLASS,
            )}
            style={{ animationDelay: "250ms" }}
          >
            <LoginForm />
            <LegalFooter />
          </section>
          <div className="lg:col-start-1 lg:row-start-2 lg:self-start">
            <LoginHeroVisual summary={summary} />
          </div>
        </main>
      </div>
    </div>
  );
}
