"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const COL_WIDTHS_KEY = "tableView_colWidths_v2";
const STATIC_TABLE_WIDTH = 120;

export type ColumnKey = "priority" | "title" | "project" | "category" | "assignee" | "sprint" | "status" | "date";
type ColumnWidths = Record<ColumnKey, number>;

const DEFAULT_WIDTHS: ColumnWidths = {
  priority: 65,
  title: 200,
  project: 120,
  category: 100,
  assignee: 130,
  sprint: 110,
  status: 100,
  date: 100,
};

function loadWidths(): ColumnWidths {
  try {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(COL_WIDTHS_KEY) : null;
    return saved ? { ...DEFAULT_WIDTHS, ...JSON.parse(saved) } : { ...DEFAULT_WIDTHS };
  } catch {
    return { ...DEFAULT_WIDTHS };
  }
}

export function useTableColumnWidths() {
  const [widths, setWidths] = useState<ColumnWidths>(loadWidths);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [resizingCol, setResizingCol] = useState<ColumnKey | null>(null);
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  const total = Object.values(widths).reduce((sum, w) => sum + Number(w || 0), 0);
  const scale = viewportWidth > STATIC_TABLE_WIDTH + total ? (viewportWidth - STATIC_TABLE_WIDTH) / total : 1;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const displayWidth = (col: ColumnKey) => Math.round((widths[col] ?? DEFAULT_WIDTHS[col]) * scale);

  const observerRef = useRef<ResizeObserver | null>(null);
  const viewportRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    if (!node) return;
    setViewportWidth(node.clientWidth);
    observerRef.current = new ResizeObserver(() => setViewportWidth(node.clientWidth));
    observerRef.current.observe(node);
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  const startResize = useCallback((col: ColumnKey, event: React.MouseEvent) => {
    event.preventDefault();
    setResizingCol(col);
    const startX = event.clientX;
    const startWidth = widthsRef.current[col] ?? 120;

    const onMove = (e: MouseEvent) => {
      const next = Math.max(60, startWidth + (e.clientX - startX) / scaleRef.current);
      setWidths((prev) => ({ ...prev, [col]: next }));
    };
    const onUp = () => {
      setResizingCol(null);
      try {
        localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(widthsRef.current));
      } catch {
        /* storage may be unavailable */
      }
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  return { displayWidth, viewportRef, resizingCol, startResize };
}
