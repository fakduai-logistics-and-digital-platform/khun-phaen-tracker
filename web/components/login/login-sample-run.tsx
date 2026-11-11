"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Status = "pending" | "passed" | "failed";

const NEXT_STATUS: Record<Status, Status> = {
  pending: "passed",
  passed: "failed",
  failed: "pending",
};

const STATUS_VIEW = {
  pending: {
    icon: CircleDashed,
    label: "tcopt__run_pending",
    tone: "text-muted-foreground",
    edge: "border-l-border",
  },
  passed: {
    icon: CheckCircle2,
    label: "tcopt__status_passed",
    tone: "text-success",
    edge: "border-l-success",
  },
  failed: {
    icon: XCircle,
    label: "tcopt__status_failed",
    tone: "text-destructive",
    edge: "border-l-destructive",
  },
} as const;

const START: Status[] = ["pending", "pending", "pending", "pending"];
/** The run plays itself once on load so the page shows a run in progress; the first click takes over. */
const PLAYBACK: [number, Status][] = [
  [0, "passed"],
  [1, "passed"],
  [2, "failed"],
];
const CASE_KEYS = [
  "login__sample_case_1",
  "login__sample_case_2",
  "login__sample_case_3",
  "login__sample_case_4",
];

/** A small playable run so the sign-in page shows what the product does; the data is local sample content. */
export function LoginSampleRun() {
  const { t } = useI18n();
  const [statuses, setStatuses] = useState<Status[]>(START);
  const touched = useRef(false);
  const passed = statuses.filter((s) => s === "passed").length;

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timers = PLAYBACK.map(([index, status], step) =>
      window.setTimeout(
        () => {
          if (touched.current) return;
          setStatuses((prev) => prev.map((s, i) => (i === index ? status : s)));
        },
        reduced ? 0 : 900 + step * 700,
      ),
    );
    return () => timers.forEach(window.clearTimeout);
  }, []);

  function cycle(index: number) {
    touched.current = true;
    setStatuses((prev) =>
      prev.map((s, i) => (i === index ? NEXT_STATUS[s] : s)),
    );
  }

  return (
    <div className="w-full max-w-lg overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-col gap-3 border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-medium">
            {t("login__sample_run_title")}
          </span>
          <span
            aria-live="polite"
            className="shrink-0 text-xs tabular-nums text-muted-foreground"
          >
            <span
              key={passed}
              className="inline-block animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none"
            >
              {t("login__sample_passed", { passed, total: statuses.length })}
            </span>
          </span>
        </div>
        <Progress
          value={(passed / statuses.length) * 100}
          className="h-1.5 bg-muted [&>div]:bg-success [&>div]:duration-300 [&>div]:ease-out motion-reduce:[&>div]:transition-none"
        />
      </div>
      <ul className="divide-y">
        {statuses.map((status, index) => {
          const view = STATUS_VIEW[status];
          const Icon = view.icon;
          const name = t(CASE_KEYS[index]);
          return (
            <li
              key={CASE_KEYS[index]}
              style={{ animationDelay: `${300 + index * 60}ms` }}
              className={cn(
                "flex items-center justify-between gap-3 border-l-2 py-2 ps-4 pe-2 transition-colors duration-200",
                "animate-in fade-in slide-in-from-bottom-1 duration-300 [animation-fill-mode:backwards] motion-reduce:animate-none",
                view.edge,
              )}
            >
              <span className="min-w-0 truncate text-sm">{name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "shrink-0 transition-[color,background-color,transform] duration-150 active:scale-95",
                  view.tone,
                )}
                aria-label={`${name}: ${t(view.label)}`}
                onClick={() => cycle(index)}
              >
                <Icon
                  key={status}
                  className="animate-in zoom-in-75 fade-in duration-200 motion-reduce:animate-none"
                  data-icon="inline-start"
                />
                {t(view.label)}
              </Button>
            </li>
          );
        })}
      </ul>
      <p className="border-t px-4 py-2 text-xs text-muted-foreground">
        {t("login__sample_hint")}
      </p>
    </div>
  );
}
