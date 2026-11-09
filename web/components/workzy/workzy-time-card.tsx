"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import { useWorkzyTime } from "./use-workzy-time";
import { WorkzyLogo } from "./workzy-logo";

const WORKZY_CHECK_OUT_URL = "https://workzy-app.pages.dev/employee";

function clock(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Sidebar card with today's Workzy time; renders nothing unless the user is linked and has checked in today. */
export function WorkzyTimeCard() {
  const { t, locale } = useI18n();
  const progress = useWorkzyTime();
  const [open, setOpen] = useState(false);
  if (!progress) return null;

  const duration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor(seconds / 60) % 60;
    const s = seconds % 60;
    return h > 0 ? t("workzy__dur_hms", { h, m, s }) : t("workzy__dur_ms", { m, s });
  };
  const worked = t("workzy__worked", {
    time: duration(progress.workedSeconds),
  });
  const target = progress.kind === "target";
  const done = progress.kind === "done" || (target && progress.remainingSeconds === 0);

  const rows: [string, string][] = [
    [t("workzy__label_check_in"), clock(progress.checkIn, locale)],
    ...(progress.checkOut
      ? ([[t("workzy__label_check_out"), clock(progress.checkOut, locale)]] as [string, string][])
      : []),
    ...(target && progress.leaveAt && !done
      ? ([[t("workzy__label_leave"), clock(progress.leaveAt, locale)]] as [string, string][])
      : []),
    [t("workzy__label_worked"), duration(progress.workedSeconds)],
    ...(target && !done
      ? ([[t("workzy__label_remaining"), duration(progress.remainingSeconds)]] as [string, string][])
      : []),
  ];

  return (
    <>
      <button
        type="button"
        aria-label={t("workzy__details_title")}
        onClick={() => setOpen(true)}
        className="mx-2 mb-1 block w-auto rounded-lg border bg-sidebar-accent/40 p-3 text-left transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none group-data-[collapsible=icon]:hidden"
      >
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <WorkzyLogo className="size-4" />
            Workzy
          </span>
          <span className="tabular-nums">
            {progress.checkOut
              ? t("workzy__in_out", {
                  in: clock(progress.checkIn, locale),
                  out: clock(progress.checkOut, locale),
                })
              : t("workzy__checked_in_at", {
                  time: clock(progress.checkIn, locale),
                })}
          </span>
        </div>
        <p className="mt-2 text-sm font-medium tabular-nums">
          {target
            ? done
              ? t("workzy__done")
              : t("workzy__remaining", {
                  time: duration(progress.remainingSeconds),
                })
            : worked}
        </p>
        {target && <Progress value={progress.percent} className="mt-2 h-1.5" aria-label={worked} />}
        <div className="mt-2 flex flex-wrap justify-between gap-x-2 text-xs text-muted-foreground tabular-nums">
          {target ? (
            <>
              <span>{worked}</span>
              {!done && progress.leaveAt && (
                <span>
                  {t("workzy__leave_at", {
                    time: clock(progress.leaveAt, locale),
                  })}
                </span>
              )}
            </>
          ) : (
            <span>{progress.kind === "done" ? t("workzy__checked_out") : t("workzy__no_target")}</span>
          )}
        </div>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("workzy__details_title")}</DialogTitle>
            <DialogDescription>
              {target
                ? done
                  ? t("workzy__done")
                  : t("workzy__remaining", {
                      time: duration(progress.remainingSeconds),
                    })
                : progress.kind === "done"
                  ? t("workzy__checked_out")
                  : t("workzy__no_target")}
            </DialogDescription>
          </DialogHeader>
          {target && <Progress value={progress.percent} className="h-2" aria-label={worked} />}
          <dl className="divide-y text-sm tabular-nums">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between py-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          {done && !progress.checkOut && (
            <Button asChild>
              <a href={WORKZY_CHECK_OUT_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                {t("workzy__check_out_action")}
              </a>
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
