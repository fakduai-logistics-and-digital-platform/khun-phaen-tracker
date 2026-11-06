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
  attendances?: { check_in: string; check_out: string | null }[];
};

/**
 * `target`: checked in on a day with a work-time goal, so there is a time left and a leave time.
 * `open`: checked in on a day without a goal (day off, no policy), only the time worked so far.
 * `done`: checked out; the day's total is still shown.
 */
export type WorkProgress = {
  kind: "target" | "open" | "done";
  checkIn: string;
  checkOut: string | null;
  leaveAt: string | null;
  workedSeconds: number;
  remainingSeconds: number;
  percent: number;
};

const BANGKOK = "+07:00";

/** Seconds of [from, to] that fall outside the lunch break (when the day has one). */
function netSeconds(from: number, to: number, today: WorkzyToday) {
  let seconds = Math.max(0, to - from) / 1000;
  if (today.date && today.break_start && today.break_end) {
    const start = Date.parse(`${today.date}T${today.break_start}:00${BANGKOK}`);
    const end = Date.parse(`${today.date}T${today.break_end}:00${BANGKOK}`);
    seconds -= Math.max(0, Math.min(to, end) - Math.max(from, start)) / 1000;
  }
  return Math.max(0, seconds);
}

/** Null when there is no check-in today. */
export function computeProgress(today: WorkzyToday, nowMs: number): WorkProgress | null {
  if (!today.connected) return null;
  const target = today.day_target ?? 0;

  if (today.check_in && !today.closed_at && today.credited_start && today.target_at && target > 0) {
    const worked = (today.day_worked ?? 0) + netSeconds(Date.parse(today.credited_start), nowMs, today);
    return {
      kind: "target",
      checkIn: today.check_in,
      checkOut: null,
      leaveAt: today.target_at,
      workedSeconds: Math.floor(worked),
      remainingSeconds: Math.max(0, Math.ceil(target - worked)),
      percent: Math.min(100, (worked / target) * 100),
    };
  }

  const rows = today.attendances ?? [];
  if (rows.length === 0) return null;
  const open = rows.some((row) => !row.check_out);
  const worked = rows.reduce(
    (sum, row) => sum + netSeconds(Date.parse(row.check_in), row.check_out ? Date.parse(row.check_out) : nowMs, today),
    0,
  );
  return {
    kind: open ? "open" : "done",
    checkIn: rows[0].check_in,
    checkOut: open ? null : rows[rows.length - 1].check_out,
    leaveAt: null,
    workedSeconds: Math.floor(worked),
    remainingSeconds: 0,
    percent: 0,
  };
}
