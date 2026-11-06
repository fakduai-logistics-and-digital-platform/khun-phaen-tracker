"use client";

import { Check } from "lucide-react";
import type { LoginSummary } from "@/lib/login/summary";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const TONE_CLASS = {
  amber: "text-warning",
  cyan: "text-foreground",
  blue: "text-primary",
} as const;

export function LoginHero({ summary }: { summary: LoginSummary }) {
  const { t } = useI18n();
  const valueProps = [t("login__value_prop_1"), t("login__value_prop_2"), t("login__value_prop_3")];

  return (
    <section className="hidden min-w-0 lg:block">
      <h1 className="max-w-xl text-5xl font-bold leading-[1.2]">
        {t("login__hero_title_1")}
        <span className="block text-primary">{t("login__hero_title_2")}</span>
      </h1>
      <p className="mt-6 max-w-lg leading-8 text-muted-foreground">{t("login__hero_desc")}</p>

      <ul className="mt-8 space-y-3">
        {valueProps.map((prop) => (
          <li key={prop} className="flex items-center gap-3 text-sm">
            <Check className="size-4 shrink-0 text-primary" />
            {prop}
          </li>
        ))}
      </ul>

      <div className="mt-12 max-w-lg overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="truncate text-sm font-bold">{summary.latestRunName}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{summary.latestRunSubtitle}</span>
        </div>
        <ul className="divide-y">
          {summary.sampleCases.map((item) => (
            <li key={item.name} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm">{item.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
              </div>
              <span className={cn("shrink-0 text-xs", TONE_CLASS[item.tone])}>{item.badge}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
