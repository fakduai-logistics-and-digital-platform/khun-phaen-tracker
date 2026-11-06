"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";

export type WhiteboardSnapshot = {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: Record<string, unknown>;
};

export type ExcalidrawCanvasHandle = {
  exportPng: () => Promise<string | null>;
  clear: () => void;
};

type Props = {
  ref?: React.Ref<ExcalidrawCanvasHandle>;
  initialSnapshot: Partial<WhiteboardSnapshot> | null;
  isDarkMode: boolean;
  onUserSnapshot: (snapshot: WhiteboardSnapshot) => void;
  onReady?: () => void;
};

// Excalidraw inverts the canvas itself in its dark theme, so both modes use light-mode colors.
const palette = { stroke: "#1e1e1e", background: "#ffffff" };

function themedInitialData(snapshot: Partial<WhiteboardSnapshot> | null, isDarkMode: boolean) {
  const appState = (snapshot?.appState ?? {}) as Partial<AppState>;
  return {
    elements: snapshot?.elements ?? [],
    appState: {
      ...appState,
      collaborators: appState.collaborators instanceof Map ? appState.collaborators : new Map(),
      followedBy: appState.followedBy instanceof Set ? appState.followedBy : new Set(),
      theme: isDarkMode ? "dark" : "light",
      currentItemStrokeColor: palette.stroke,
      viewBackgroundColor: palette.background,
      exportWithDarkMode: isDarkMode,
    } as Partial<AppState>,
    files: (snapshot?.files ?? {}) as never,
  };
}

/** Client-only Excalidraw surface; load it with React.lazy so the library never runs during SSR. */
export default function ExcalidrawCanvas({ ref, initialSnapshot, isDarkMode, onUserSnapshot, onReady }: Props) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const initializedRef = useRef(false);
  const initialDataRef = useRef(themedInitialData(initialSnapshot, isDarkMode));

  useImperativeHandle(ref, () => ({
    async exportPng() {
      const api = apiRef.current;
      if (!api) return null;
      const elements = api.getSceneElements();
      if (elements.length === 0) return null;
      try {
        const blob = await exportToBlob({
          elements,
          appState: api.getAppState(),
          files: api.getFiles(),
          mimeType: "image/png",
        });
        return URL.createObjectURL(blob);
      } catch (error) {
        console.error("Export failed", error);
        return null;
      }
    },
    clear() {
      apiRef.current?.updateScene({ elements: [] });
    },
  }));

  useEffect(
    () => () => {
      apiRef.current = null;
      initializedRef.current = false;
    },
    [],
  );

  return (
    <div className="relative h-full w-full">
      <Excalidraw
        excalidrawAPI={(api) => {
          apiRef.current = api;
          initializedRef.current = true;
          onReady?.();
        }}
        initialData={initialDataRef.current}
        onChange={(elements, appState, files) => {
          if (!initializedRef.current) return;
          onUserSnapshot({ elements, appState, files });
        }}
        theme={isDarkMode ? "dark" : "light"}
        UIOptions={{
          canvasActions: {
            loadScene: true,
            export: { saveFileToDisk: true },
            clearCanvas: true,
            toggleTheme: true,
            saveAsImage: true,
          },
        }}
      />
    </div>
  );
}
