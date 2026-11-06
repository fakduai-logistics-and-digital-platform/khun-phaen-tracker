"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/apis";
import { computeProgress, type WorkzyToday } from "@/lib/workzy/work-time";

export const WORKZY_CHANGED = "workzy:changed";
const REFRESH_MS = 5 * 60 * 1000;
const TICK_MS = 30 * 1000;

/** Today's Workzy work time, refreshed every few minutes and ticking locally in between. */
export function useWorkzyTime() {
  const [today, setToday] = useState<WorkzyToday | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const clockOffset = useRef(0);
  const fetchedAt = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const res = await api.workzy.today();
      if (!res.ok) {
        setToday(null);
        return;
      }
      const data = (await res.json()) as WorkzyToday;
      fetchedAt.current = Date.now();
      clockOffset.current = data.server_now ? Date.parse(data.server_now) - fetchedAt.current : 0;
      setToday(data.connected ? data : null);
    } catch {
      /* Keep the last known state when the network drops. */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const reload = window.setInterval(() => void refresh(), REFRESH_MS);
    const tick = window.setInterval(() => setNow(Date.now()), TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - fetchedAt.current > 60_000) void refresh();
    };
    const onChanged = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(WORKZY_CHANGED, onChanged);
    return () => {
      window.clearInterval(reload);
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(WORKZY_CHANGED, onChanged);
    };
  }, [refresh]);

  return today ? computeProgress(today, now + clockOffset.current) : null;
}
