"use client";

import { Check } from "lucide-react";
import type { LoginSummary } from "@/lib/login/summary";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { LoginSampleRun } from "./login-sample-run";

const TONE_CLASS = {
  amber: "text-warning",
  cyan: "text-foreground",
  blue: "text-primary",
} as const;

/** One entrance for the page: a short fade and rise, delayed per element through `style.animationDelay`. */
export const ENTER_CLASS =
  "animate-in fade-in slide-in-from-bottom-2 duration-500 [animation-fill-mode:backwards] motion-reduce:animate-none";

export function LoginHeroText() {
  const { t } = useI18n();
  const valueProps = [t("login__value_prop_1"), t("login__value_prop_2")];
  const words = t("login__hero_title").split(" ");

  return (
    <section className="min-w-0">
      <h1 className="max-w-xl text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
        {words.map((word, i) => (
          <span key={`${word}-${i}`}>
            {i > 0 && " "}
            <span
              className={cn("inline-block", ENTER_CLASS)}
              style={{ animationDelay: `${100 + i * 70}ms` }}
            >
              {word}
            </span>
          </span>
        ))}
      </h1>
      <p
        className={cn("mt-4 max-w-lg text-muted-foreground", ENTER_CLASS)}
        style={{ animationDelay: "350ms" }}
      >
        {t("login__hero_desc")}
      </p>

      <ul className="mt-6 flex flex-col gap-3 sm:mt-8">
        {valueProps.map((prop, i) => (
          <li
            key={prop}
            className={cn("flex items-center gap-3 text-sm", ENTER_CLASS)}
            style={{ animationDelay: `${450 + i * 80}ms` }}
          >
            <Check className="size-4 shrink-0 text-muted-foreground" />
            {prop}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** `summary` is real data of a public workspace; without one the hero shows a playable sample run, labelled as a sample. */
export function LoginHeroVisual({ summary }: { summary: LoginSummary | null }) {
  if (!summary) return <LoginSampleRun />;
  return (
    <div className="w-full max-w-lg overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="truncate text-sm font-medium">
          {summary.latestRunName}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {summary.latestRunSubtitle}
        </span>
      </div>
      <ul className="divide-y">
        {summary.sampleCases.map((item) => (
          <li
            key={item.name}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm">{item.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.detail}
              </p>
            </div>
            <span className={cn("shrink-0 text-xs", TONE_CLASS[item.tone])}>
              {item.badge}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
