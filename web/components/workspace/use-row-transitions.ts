import { useEffect, useRef, useState } from "react";

type Keyed = { id?: string | number };
export type RowPhase = "enter" | "leave" | undefined;
export type TransitionRow<T> = { item: T; phase: RowPhase };

const EXIT_MS = 220;
const ENTER_MS = 400;

/**
 * Marks rows that appeared or disappeared between two refreshes so they can animate in and out.
 * Removed rows stay in the list for a moment at their old position. A page or filter change replaces
 * the whole set, so those rows fade in without ghosts of the old ones.
 */
export function useRowTransitions<T extends Keyed>(items: T[]): TransitionRow<T>[] {
  const previous = useRef<T[]>(items);
  const mounted = useRef(false);
  const [rows, setRows] = useState<TransitionRow<T>[]>(() => items.map((item) => ({ item, phase: undefined })));

  useEffect(() => {
    const before = previous.current;
    previous.current = items;
    const nowIds = new Set(items.map((item) => String(item.id)));
    const beforeIds = new Set(before.map((item) => String(item.id)));
    const survivors = items.filter((item) => beforeIds.has(String(item.id))).length;
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (before.length === items.length && survivors === items.length) {
      setRows(items.map((item) => ({ item, phase: undefined })));
      return;
    }

    const next: TransitionRow<T>[] = items.map((item) => ({
      item,
      phase: beforeIds.has(String(item.id)) ? undefined : "enter",
    }));
    if (survivors > 0) {
      before.forEach((item, index) => {
        if (!nowIds.has(String(item.id))) next.splice(Math.min(index, next.length), 0, { item, phase: "leave" });
      });
    }
    setRows(next);

    const timers = [
      window.setTimeout(() => setRows((current) => current.filter((row) => row.phase !== "leave")), EXIT_MS),
      window.setTimeout(
        () => setRows((current) => current.map((row) => (row.phase === "enter" ? { ...row, phase: undefined } : row))),
        ENTER_MS,
      ),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [items]);

  return rows;
}
