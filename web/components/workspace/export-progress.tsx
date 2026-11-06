"use client";

import { useI18n } from "@/lib/i18n";

function formatElapsedTime(ms: number) {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export function ExportProgress({
  inProgress = false,
  percent = 0,
  elapsedMs = 0,
}: {
  inProgress?: boolean;
  percent?: number;
  elapsedMs?: number;
}) {
  const { t } = useI18n();
  if (!inProgress) return null;

  return (
    <div role="status" className="fixed top-20 right-4 z-[10000] animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex min-w-70 items-center gap-3 rounded-lg bg-blue-600 px-4 py-3 text-white">
        <svg
          className="animate-spin"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
          <path d="M22 12a10 10 0 0 1-10 10" />
        </svg>
        <div className="flex-1">
          <div className="text-sm font-semibold">{t("page__export_progress", { percent })}</div>
          <div className="text-xs text-blue-100">
            {t("page__video_export_time", { time: formatElapsedTime(elapsedMs) })}
          </div>
        </div>
      </div>
    </div>
  );
}
