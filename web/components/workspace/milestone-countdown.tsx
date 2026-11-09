"use client";

import { useEffect, useState } from "react";
import { CheckCircle, EyeOff, Pencil, Rocket, Trophy } from "lucide-react";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api/apis";
import { useI18n } from "@/lib/i18n";
import { showMessage } from "@/lib/stores/uiActions";
import type { Milestone } from "@/lib/types/milestone";
import { cn } from "@/lib/utils";

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
    { label: "days", value: display.days },
    { label: "hours", value: display.hours },
    { label: "mins", value: display.minutes },
    { label: "secs", value: display.seconds },
  ];

  return (
    <Card className="group flex-col gap-6 p-6 duration-300 animate-in fade-in xl:flex-row xl:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            {isOver ? <Trophy /> : <Rocket className={cn(isNearLaunch && "text-warning")} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-lg leading-tight font-semibold">{milestone.title}</h3>
              {isOver ? (
                <Badge variant="outline" className="shrink-0 gap-1 border-success/40 text-success">
                  <CheckCircle />
                  {t("milestone.launched")}
                </Badge>
              ) : (
                <Badge variant="outline" className="shrink-0 gap-1.5">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-destructive" />
                  </span>
                  LIVE
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{formatThaiDate(milestone.target_date)}</p>
          </div>
        </div>
        <p className="line-clamp-2 max-w-xl text-sm text-muted-foreground">
          {milestone.description || t("milestone.no_description")}
        </p>

        {isOwner && (
          <div className="flex items-center gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => onEdit?.(milestone)}
              title={t("milestone.edit_tooltip")}
              aria-label={t("milestone.edit_tooltip")}
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setShowHideConfirm(true)}
              title={t("milestone.hide_tooltip")}
              aria-label={t("milestone.hide_tooltip")}
            >
              <EyeOff />
            </Button>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex items-start gap-2 md:gap-3">
          {units.map((unit, index) => (
            <div key={unit.label} className="contents">
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex size-16 items-center justify-center rounded-lg border bg-muted/50 md:size-20">
                  <span className="text-3xl font-semibold tabular-nums md:text-4xl">
                    {String(unit.value).padStart(2, "0")}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{t(`milestone.${unit.label}`)}</span>
              </div>
              {index < units.length - 1 && (
                <span className="mt-5 text-2xl font-semibold text-muted-foreground md:mt-6">:</span>
              )}
            </div>
          ))}
        </div>
        {isOver && <p className="text-center text-xs text-muted-foreground">↑ {t("milestone.elapsed")}</p>}
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
    </Card>
  );
}
