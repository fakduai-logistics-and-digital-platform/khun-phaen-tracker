"use client";

import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import { useWorkzyTime } from "./use-workzy-time";

function clock(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Sidebar card with today's Workzy work time; renders nothing unless the user is linked and checked in. */
export function WorkzyTimeCard() {
  const { t, locale } = useI18n();
  const progress = useWorkzyTime();
  if (!progress) return null;

  const duration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const h = Math.floor(minutes / 60);
    return h > 0 ? t("workzy__dur_hm", { h, m: minutes % 60 }) : t("workzy__dur_m", { m: minutes });
  };
  const done = progress.remainingSeconds === 0;

  return (
    <section
      aria-label="Workzy"
      className="mx-2 mb-1 rounded-lg border bg-sidebar-accent/40 p-3 group-data-[collapsible=icon]:hidden"
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Workzy</span>
        <span className="tabular-nums">{t("workzy__checked_in_at", { time: clock(progress.checkIn, locale) })}</span>
      </div>
      <p className="mt-2 text-sm font-medium tabular-nums">
        {done ? t("workzy__done") : t("workzy__remaining", { time: duration(progress.remainingSeconds) })}
      </p>
      <Progress
        value={progress.percent}
        className="mt-2 h-1.5"
        aria-label={t("workzy__worked", { time: duration(progress.workedSeconds) })}
      />
      <div className="mt-2 flex flex-wrap justify-between gap-x-2 text-xs text-muted-foreground tabular-nums">
        <span>{t("workzy__worked", { time: duration(progress.workedSeconds) })}</span>
        {!done && <span>{t("workzy__leave_at", { time: clock(progress.leaveAt, locale) })}</span>}
      </div>
    </section>
  );
}
