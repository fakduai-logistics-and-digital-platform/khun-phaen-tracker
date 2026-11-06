/** What the API returns for `/integrations/workzy/today`. */
export type WorkzyToday = {
  connected: boolean;
  configured?: boolean;
  server_now?: string;
  date?: string;
  day_target?: number | null;
  day_worked?: number | null;
  break_start?: string | null;
  break_end?: string | null;
  check_in?: string | null;
  credited_start?: string | null;
  target_at?: string | null;
  closed_at?: string | null;
};

export type WorkProgress = {
  checkIn: string;
  leaveAt: string;
  workedSeconds: number;
  remainingSeconds: number;
  percent: number;
};

const BANGKOK = "+07:00";

/** Seconds of [from, to] that fall outside the lunch break. */
function netSeconds(from: number, to: number, today: WorkzyToday) {
  let seconds = Math.max(0, to - from) / 1000;
  if (today.date && today.break_start && today.break_end) {
    const start = Date.parse(`${today.date}T${today.break_start}:00${BANGKOK}`);
    const end = Date.parse(`${today.date}T${today.break_end}:00${BANGKOK}`);
    seconds -= Math.max(0, Math.min(to, end) - Math.max(from, start)) / 1000;
  }
  return Math.max(0, seconds);
}

/** Null unless the employee is checked in with a work-time target today. */
export function computeProgress(today: WorkzyToday, nowMs: number): WorkProgress | null {
  if (!today.connected || !today.check_in || today.closed_at || !today.credited_start || !today.target_at) return null;
  const target = today.day_target ?? 0;
  if (target <= 0) return null;
  const worked = (today.day_worked ?? 0) + netSeconds(Date.parse(today.credited_start), nowMs, today);
  return {
    checkIn: today.check_in,
    leaveAt: today.target_at,
    workedSeconds: Math.floor(worked),
    remainingSeconds: Math.max(0, Math.ceil(target - worked)),
    percent: Math.min(100, (worked / target) * 100),
  };
}
