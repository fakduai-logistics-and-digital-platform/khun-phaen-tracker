"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type PredictionLabels = {
  prediction: string;
  predictionDesc: string;
  predictionNextMonth: string;
  predictionConfidence: string;
  predictionTasks: string;
  predictionExperimental: string;
  predictionHelpTitle: string;
  predictionHelpContent: string;
};

function predictNextMonth(dailyTrend: { date: string; count: number }[]) {
  if (dailyTrend.length < 2) return { nextMonthTotal: 0, confidence: 0 };

  const n = dailyTrend.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  dailyTrend.forEach((d, i) => {
    sumX += i;
    sumY += d.count;
    sumXY += i * d.count;
    sumX2 += i * i;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  let nextMonthTotal = 0;
  for (let i = n; i < n + 30; i++) {
    nextMonthTotal += Math.max(0, slope * i + intercept);
  }

  const avgY = sumY / n;
  let ssRes = 0;
  let ssTot = 0;
  dailyTrend.forEach((d, i) => {
    const yPred = slope * i + intercept;
    ssRes += Math.pow(d.count - yPred, 2);
    ssTot += Math.pow(d.count - avgY, 2);
  });

  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  const confidence = Math.min(100, Math.max(0, rSquared * 100));

  return {
    nextMonthTotal: Math.round(nextMonthTotal),
    confidence: Math.round(confidence),
  };
}

export function SummaryPredictionRow({
  dailyTrend,
  labels,
}: {
  dailyTrend: { date: string; count: number }[];
  labels: PredictionLabels;
}) {
  const [showHelp, setShowHelp] = useState(false);
  const prediction = useMemo(() => predictNextMonth(dailyTrend), [dailyTrend]);

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="relative flex items-center gap-6 overflow-visible rounded-lg border border-indigo-200 bg-indigo-50/50 p-6 shadow-sm md:col-span-2 dark:border-indigo-500/30 dark:bg-indigo-500/5">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white shadow-indigo-500/20">
          <Sparkles className="size-8" />
        </div>
        <div className="flex-1">
          <h4 className="flex items-center gap-2 font-medium text-indigo-900 dark:text-indigo-200">
            {labels.prediction}
            <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-xs font-semibold text-white">
              {labels.predictionExperimental}
            </span>
          </h4>
          <p className="mt-1 text-sm font-medium text-indigo-700/70 dark:text-indigo-300/60">
            &quot;{labels.predictionDesc}&quot;
          </p>
        </div>
      </div>

      <div className="relative flex flex-col justify-center overflow-visible rounded-lg border border-border bg-card/90 p-6 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{labels.predictionNextMonth}</p>
          <button
            type="button"
            aria-label={labels.predictionHelpTitle}
            aria-expanded={showHelp}
            className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-primary hover:text-primary-foreground"
            onMouseEnter={() => setShowHelp(true)}
            onMouseLeave={() => setShowHelp(false)}
            onClick={() => setShowHelp((v) => !v)}
          >
            i
          </button>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold text-primary">{prediction.nextMonthTotal}</span>
          <span className="text-xs font-medium text-muted-foreground">{labels.predictionTasks}</span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-colors duration-1000",
                prediction.confidence > 70
                  ? "bg-success"
                  : prediction.confidence > 40
                    ? "bg-amber-500"
                    : "bg-destructive",
              )}
              style={{ width: `${prediction.confidence}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-muted-foreground">{prediction.confidence}%</span>
        </div>

        <p className="mt-1 text-xs font-medium text-muted-foreground">{labels.predictionConfidence}</p>

        {showHelp && (
          <div className="pointer-events-none absolute top-0 right-0 z-50 mt-12 mr-2 w-64 animate-in rounded-lg border border-border bg-popover p-4 fade-in">
            <p className="mb-1 text-xs font-medium text-foreground">{labels.predictionHelpTitle}</p>
            <p className="text-xs leading-relaxed font-medium text-muted-foreground">{labels.predictionHelpContent}</p>
            <div className="absolute top-0 right-4 -mt-2 size-4 rotate-45 border-t border-l border-border bg-popover" />
          </div>
        )}
      </div>
    </div>
  );
}
