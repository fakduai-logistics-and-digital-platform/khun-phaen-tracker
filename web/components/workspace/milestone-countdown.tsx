"use client";

import { useEffect, useState } from "react";
import { CheckCircle, EyeOff, Pencil, Rocket, Trophy } from "lucide-react";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { api } from "@/lib/api/apis";
import { useI18n } from "@/lib/i18n";
import { showMessage } from "@/lib/stores/uiActions";
import type { Milestone } from "@/lib/types/milestone";
import { cn } from "@/lib/utils";
import "./milestone-countdown.css";

type Duration = { days: number; hours: number; minutes: number; seconds: number };
type TimeLeft = Duration & { isOver: boolean };

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const ZERO: Duration = { days: 0, hours: 0, minutes: 0, seconds: 0 };

function splitDuration(ms: number): Duration {
  return {
    days: Math.floor(ms / (1000 * 60 * 60 * 24)),
    hours: Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((ms % (1000 * 60)) / 1000),
  };
}

function formatThaiDate(dateStr: string) {
  const date = new Date(dateStr);
  const time = date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${date.getFullYear() + 543} (${time} น.)`;
}

function useMilestoneTime(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ ...ZERO, isOver: false });
  const [elapsed, setElapsed] = useState<Duration>(ZERO);

  useEffect(() => {
    function calculate() {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ ...ZERO, isOver: true });
        setElapsed(splitDuration(Math.abs(diff)));
        return;
      }
      setTimeLeft({ ...splitDuration(diff), isOver: false });
    }
    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return { timeLeft, elapsed };
}

export interface MilestoneCountdownProps {
  milestone: Milestone;
  isOwner?: boolean;
  onEdit?: (milestone: Milestone) => void;
  onDelete?: (milestone: Milestone) => void;
  onHide?: (milestone: Milestone) => void;
}

export function MilestoneCountdown({ milestone, isOwner = false, onEdit, onHide }: MilestoneCountdownProps) {
  const { t } = useI18n();
  const [showHideConfirm, setShowHideConfirm] = useState(false);
  const { timeLeft, elapsed } = useMilestoneTime(milestone.target_date);
  const isOver = timeLeft.isOver;
  const isNearLaunch =
    !isOver && timeLeft.days === 0 && (timeLeft.hours > 0 || timeLeft.minutes > 0 || timeLeft.seconds > 0);

  async function handleHide() {
    try {
      const res = await api.workspaces.updateMilestone(milestone.workspace_id, milestone.id, { is_hidden: true });
      if (res.ok) {
        showMessage(t("page__success"));
        onHide?.(milestone);
      }
    } catch {
      showMessage(t("page__error"), "error");
    } finally {
      setShowHideConfirm(false);
    }
  }

  const display = isOver ? elapsed : timeLeft;
  const units = [
    {
      label: "days",
      value: display.days,
      color: isOver ? "from-emerald-400 to-teal-400" : "from-blue-400 to-indigo-400",
    },
    {
      label: "hours",
      value: display.hours,
      color: isOver ? "from-teal-400 to-cyan-400" : "from-indigo-400 to-purple-400",
    },
    {
      label: "mins",
      value: display.minutes,
      color: isOver ? "from-cyan-400 to-sky-400" : "from-purple-400 to-pink-400",
    },
    { label: "secs", value: display.seconds, color: isOver ? "from-sky-400 to-blue-400" : "from-pink-400 to-rose-400" },
  ];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-white/20 p-6 text-white transition-colors animate-in fade-in hover:scale-[1.005]",
        isOver
          ? "bg-linear-to-br from-emerald-600 via-teal-600 to-cyan-700 shadow-emerald-500/30"
          : "bg-linear-to-br from-indigo-600 via-indigo-700 to-purple-800 shadow-indigo-500/30",
      )}
    >
      {isOver && <div className="animate-shimmer absolute inset-0 z-0 rounded-lg" />}

      <div
        className={cn(
          "absolute -top-24 -left-24 size-64 rounded-full blur-[80px]",
          isOver ? "bg-success/15" : "bg-white/10",
        )}
      />
      <div
        className={cn(
          "absolute -right-24 -bottom-24 size-64 rounded-full blur-[80px]",
          isOver ? "bg-cyan-300/15" : "bg-purple-400/20",
        )}
      />

      <div className="relative z-10 flex flex-col items-center gap-8 xl:flex-row">
        <div className="min-w-0 flex-1 text-center xl:text-left">
          <div className="mb-3 flex items-center justify-center gap-3 xl:justify-start">
            {isOver ? (
              <div className="animate-gentle-float rounded-lg border border-amber-300/40 bg-amber-400/20 p-2.5 shadow-amber-500/20 backdrop-blur-md">
                <Trophy className="size-6 text-amber-300" />
              </div>
            ) : (
              <div
                className={cn(
                  "rounded-lg border border-white/30 bg-white/20 p-2.5 backdrop-blur-md transition-colors",
                  isNearLaunch
                    ? "animate-rocket-launch border-orange-300/40 bg-orange-500/30 shadow-orange-500/20"
                    : "animate-gentle-float",
                )}
              >
                <Rocket className="size-6 text-white" />
              </div>
            )}
            <div>
              <h3 className="flex items-center gap-2.5 truncate text-2xl leading-none font-semibold drop-md:text-3xl">
                {milestone.title}
                {isOver ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-success/40 bg-success/20 px-2 py-0.5 text-xs font-semibold text-success">
                    <CheckCircle className="size-3" />
                    DONE
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/20 px-2 py-0.5 text-xs font-semibold text-destructive">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-destructive" />
                    </span>
                    LIVE
                  </span>
                )}
              </h3>
              <p className="mt-1 text-sm font-medium text-white/70">{formatThaiDate(milestone.target_date)}</p>
            </div>
          </div>
          <p className="line-clamp-2 max-w-xl text-sm font-medium text-white/80 md:text-base">
            {milestone.description || t("milestone.no_description")}
          </p>

          {isOwner && (
            <div className="mt-5 flex items-center justify-center gap-3 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 xl:justify-start">
              <button
                type="button"
                onClick={() => onEdit?.(milestone)}
                className="group/btn rounded-lg border border-white/20 bg-white/10 p-2.5 backdrop-blur-md transition-colors hover:border-white/40 hover:bg-white/20"
                title={t("milestone.edit_tooltip")}
                aria-label={t("milestone.edit_tooltip")}
              >
                <Pencil size={18} className="text-white transition-transform group-hover/btn:scale-110" />
              </button>
              <button
                type="button"
                onClick={() => setShowHideConfirm(true)}
                className="group/btn rounded-lg border border-white/20 bg-white/10 p-2.5 backdrop-blur-md transition-colors hover:border-white/40 hover:bg-white/20"
                title={t("milestone.hide_tooltip")}
                aria-label={t("milestone.hide_tooltip")}
              >
                <EyeOff size={18} className="text-white transition-transform group-hover/btn:scale-110" />
              </button>
            </div>
          )}
        </div>

        <div
          className={cn(
            "flex shrink-0 items-center gap-3 rounded-[2.5rem] border p-5 backdrop-blur-lg md:gap-6 md:p-7",
            isOver ? "border-white/15 bg-white/10" : "border-white/10 bg-black/20",
          )}
        >
          {units.map((unit) => (
            <div key={unit.label} className="contents">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "group/unit relative flex size-16 items-center justify-center overflow-hidden rounded-lg border bg-linear-to-b from-white/10 to-white/5 md:size-24",
                    isOver ? "border-success/20" : "border-white/20",
                  )}
                >
                  <div
                    className={cn(
                      "absolute inset-0 bg-linear-to-br transition-opacity",
                      unit.color,
                      isOver ? "opacity-10" : "opacity-0 group-hover/unit:opacity-20",
                    )}
                  />
                  <span className="text-3xl font-semibold text-white tabular-nums drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] md:text-5xl">
                    {String(unit.value).padStart(2, "0")}
                  </span>
                </div>
                <span className="mt-3 text-xs font-semibold text-white/50 md:text-xs">
                  {t(`milestone.${unit.label}`)}
                </span>
              </div>
              {unit.label !== "secs" && <div className="mb-8 text-2xl font-semibold text-white/40 md:text-4xl">:</div>}
            </div>
          ))}
        </div>

        {isOver && (
          <>
            <div className="animate-glow-pulse absolute top-4 right-4 flex items-center gap-2 rounded-full border border-white/30 bg-amber-500/90 px-4 py-2.5 text-xs font-semibold text-white shadow-amber-500/40">
              <Trophy className="size-3.5" />
              {t("milestone.launched")}
            </div>
            <div className="absolute right-4 bottom-4 text-xs font-medium text-white/40">
              ↑ {t("milestone.elapsed")}
            </div>
          </>
        )}
      </div>

      <ConfirmModal
        show={showHideConfirm}
        title={t("milestone.hide_title")}
        message={t("milestone.hide_confirm")}
        confirmText={t("common.hide")}
        type="warning"
        onClose={() => setShowHideConfirm(false)}
        onConfirm={handleHide}
      />
    </div>
  );
}
