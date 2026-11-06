"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DETAIL_KEY = "test-case-detail-panel-width";
const SIDEBAR_KEY = "test-case-left-sidebar-width";

function clampDetailWidth(width: number) {
  const maxWidth = Math.max(420, window.innerWidth - 520);
  return Math.min(Math.max(width, 360), maxWidth);
}

function clampSidebarWidth(width: number) {
  return Math.min(Math.max(width, 180), 480);
}

export function useTcResize() {
  const [detailPanelWidth, setDetailPanelWidth] = useState(420);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(256);
  const stopDrag = useRef<(() => void) | null>(null);

  useEffect(() => {
    const savedWidth = Number(localStorage.getItem(DETAIL_KEY));
    if (Number.isFinite(savedWidth) && savedWidth > 0) {
      setDetailPanelWidth(clampDetailWidth(savedWidth));
    }
    const savedSidebar = Number(localStorage.getItem(SIDEBAR_KEY));
    if (Number.isFinite(savedSidebar) && savedSidebar > 0) {
      setLeftSidebarWidth(clampSidebarWidth(savedSidebar));
    }
    return () => stopDrag.current?.();
  }, []);

  const beginDrag = useCallback(
    (
      event: React.PointerEvent,
      startWidth: number,
      resolve: (startX: number, startWidth: number, clientX: number) => number,
      setWidth: (width: number) => void,
      storageKey: string,
    ) => {
      event.preventDefault();
      const startX = event.clientX;
      let latestWidth = startWidth;

      const onMove = (e: PointerEvent) => {
        latestWidth = resolve(startX, startWidth, e.clientX);
        setWidth(latestWidth);
      };
      const onUp = () => {
        localStorage.setItem(storageKey, String(latestWidth));
        stopDrag.current?.();
        stopDrag.current = null;
      };

      stopDrag.current?.();
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      stopDrag.current = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    },
    [],
  );

  const startPanelResize = useCallback(
    (event: React.PointerEvent) =>
      beginDrag(
        event,
        detailPanelWidth,
        (startX, startWidth, clientX) => clampDetailWidth(startWidth + startX - clientX),
        setDetailPanelWidth,
        DETAIL_KEY,
      ),
    [beginDrag, detailPanelWidth],
  );

  const startSidebarResize = useCallback(
    (event: React.PointerEvent) =>
      beginDrag(
        event,
        leftSidebarWidth,
        (startX, startWidth, clientX) => clampSidebarWidth(startWidth + clientX - startX),
        setLeftSidebarWidth,
        SIDEBAR_KEY,
      ),
    [beginDrag, leftSidebarWidth],
  );

  return { detailPanelWidth, leftSidebarWidth, startPanelResize, startSidebarResize };
}
