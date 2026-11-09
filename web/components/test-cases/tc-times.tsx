"use client";

import { CheckCircle2, Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** "9 Nov 2026, 14:30" in the interface language; empty string when there is no usable date. */
export function formatDateTime(iso: string | null | undefined, locale: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(locale === "th" ? "th-TH" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
}

type Props = { updatedAt?: string | null; passedAt?: string | null; className?: string };

/** When a test case was last edited and when a tester marked it as passed. */
export function TcTimes({ updatedAt, passedAt, className }: Props) {
  const { t, locale } = useI18n();
  const edited = formatDateTime(updatedAt, locale);
  const passed = formatDateTime(passedAt, locale);
  if (!edited && !passed) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground", className)}>
      {edited && (
        <span className="flex items-center gap-1.5 tabular-nums">
          <Clock className="size-3.5" />
          {t("tcTime__edited")} {edited}
        </span>
      )}
      {passed && (
        <span className="flex items-center gap-1.5 tabular-nums text-success">
          <CheckCircle2 className="size-3.5" />
          {t("tcTime__passed")} {passed}
        </span>
      )}
    </div>
  );
}
