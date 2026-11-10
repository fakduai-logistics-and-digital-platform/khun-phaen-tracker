"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Download, LoaderCircle, Maximize2, Minimize2, PenTool, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { requestConfirm } from "@/lib/stores/confirmStore";
import { ToolModal } from "./tool-modal";
import type { ExcalidrawCanvasHandle, WhiteboardSnapshot } from "./excalidraw-canvas";

const ExcalidrawCanvas = lazy(() => import("./excalidraw-canvas"));

const SYNC_ROOM_KEY = "sync-room-code";
const SNAPSHOT_KEY = "excalidraw-snapshot-v1";
const MODE_KEY = "whiteboard-mode";
/** Longer than the dialog's open animation. Excalidraw measures its box once on mount, and a box that is still scaling up measures a few percent too small. */
const MOUNT_DELAY_MS = 300;

const FULLSCREEN_CLASS =
  "top-0 left-0 h-dvh w-dvw max-w-none translate-x-0 translate-y-0 rounded-none border-0 sm:max-w-none";

function readFullscreen() {
  try {
    return localStorage.getItem(MODE_KEY) === "full";
  } catch {
    return false;
  }
}

function readSnapshot(): Partial<WhiteboardSnapshot> | null {
  const raw = localStorage.getItem(SNAPSHOT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Partial<WhiteboardSnapshot>;
  } catch {
    localStorage.removeItem(SNAPSHOT_KEY);
    return null;
  }
}

export function WhiteboardModal({
  onClose,
  onNotify,
}: {
  onClose: () => void;
  onNotify?: (event: { message: string; type: "success" | "error" }) => void;
}) {
  const { t } = useI18n();
  const { resolvedTheme } = useTheme();
  const canvasRef = useRef<ExcalidrawCanvasHandle>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [initialSnapshot] = useState(readSnapshot);
  const [hasRoom] = useState(() => Boolean(localStorage.getItem(SYNC_ROOM_KEY)?.trim()));
  const [isBooting, setIsBooting] = useState(true);
  const [fullscreen, setFullscreen] = useState(readFullscreen);
  const [canMount, setCanMount] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setCanMount(true), MOUNT_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  function toggleFullscreen() {
    const next = !fullscreen;
    setFullscreen(next);
    try {
      localStorage.setItem(MODE_KEY, next ? "full" : "mini");
    } catch {
      /* The mode is a convenience; it simply resets when storage is unavailable. */
    }
  }
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  function handleUserSnapshot(snapshot: WhiteboardSnapshot) {
    try {
      const serialized = JSON.stringify(snapshot);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => localStorage.setItem(SNAPSHOT_KEY, serialized), 500);
    } catch (error) {
      console.warn("Failed to persist whiteboard snapshot", error);
    }
  }

  async function handleExportPng() {
    const dataUrl = await canvasRef.current?.exportPng();
    if (!dataUrl) {
      onNotify?.({ message: t("whiteboard__notify_export_error"), type: "error" });
      return;
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `whiteboard-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    a.click();
    onNotify?.({ message: t("whiteboard__notify_export_success"), type: "success" });
  }

  async function handleClearBoard() {
    const confirmed = await requestConfirm({
      title: t("common.confirm"),
      message: t("whiteboard__confirm_clear"),
      type: "danger",
    });
    if (!confirmed) return;
    canvasRef.current?.clear();
    localStorage.removeItem(SNAPSHOT_KEY);
    onNotify?.({ message: t("whiteboard__notify_clear_success"), type: "success" });
  }

  return (
    <ToolModal
      onClose={onClose}
      title={t("whiteboard__title")}
      subtitle={hasRoom ? t("whiteboard__status_offline") : t("whiteboard__status_no_room")}
      icon={PenTool}
      contentClassName={fullscreen ? FULLSCREEN_CLASS : undefined}
      headerActions={
        <>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            title={fullscreen ? t("whiteboard__mode_mini") : t("whiteboard__mode_fullscreen")}
            aria-label={fullscreen ? t("whiteboard__mode_mini") : t("whiteboard__mode_fullscreen")}
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Minimize2 /> : <Maximize2 />}
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void handleExportPng()}>
            <Download className="size-4" />
            {t("whiteboard__btn_export")}
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void handleClearBoard()}>
            <Trash2 className="size-4" />
            {t("whiteboard__btn_clear")}
          </Button>
        </>
      }
    >
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border">
        {isBooting && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              <span>{t("whiteboard__loading")}</span>
            </div>
          </div>
        )}
        <Suspense fallback={null}>
          {canMount && (
            <ExcalidrawCanvas
              ref={canvasRef}
              initialSnapshot={initialSnapshot}
              isDarkMode={resolvedTheme === "dark"}
              onUserSnapshot={handleUserSnapshot}
              onReady={() => setIsBooting(false)}
            />
          )}
        </Suspense>
      </div>
    </ToolModal>
  );
}
