import { useSync } from "@tldraw/sync";
import { inlineBase64AssetStore } from "@tldraw/editor";
import { createElement, useEffect, useMemo, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import {
  Tldraw,
  type Editor,
  type TLEditorSnapshot,
  type TLStoreSnapshot,
} from "tldraw";
import "tldraw/tldraw.css";

type Snapshot = Partial<TLEditorSnapshot> | TLStoreSnapshot;

export type TldrawBridgeMode = "offline" | "sync";
export type TldrawBridgeSyncStatus =
  | "offline"
  | "connecting"
  | "online"
  | "error";

interface BaseBridgeProps {
  initialSnapshot: Snapshot | null;
  onEditorReady: (editor: Editor) => void;
  onUserSnapshot: (snapshot: Snapshot) => void;
}

interface OfflineCanvasProps extends BaseBridgeProps {
  mode: "offline";
}

interface SyncCanvasProps extends BaseBridgeProps {
  mode: "sync";
  syncRoomId: string;
  syncHost: string;
  onSyncStatus: (status: TldrawBridgeSyncStatus, message: string) => void;
}

type BridgeAppProps = OfflineCanvasProps | SyncCanvasProps;

function registerSnapshotListener(
  editor: Editor,
  onUserSnapshot: (snapshot: Snapshot) => void,
): () => void {
  return editor.store.listen((entry) => {
    if (entry.source !== "user") return;
    onUserSnapshot(editor.getSnapshot());
  });
}

function OfflineCanvas({
  initialSnapshot,
  onEditorReady,
  onUserSnapshot,
}: OfflineCanvasProps) {
  const initializedRef = useRef(false);
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      unlistenRef.current?.();
      unlistenRef.current = null;
    };
  }, []);

  return createElement(Tldraw, {
    autoFocus: true,
    onMount: (editor: Editor) => {
      unlistenRef.current?.();
      if (!initializedRef.current && initialSnapshot) {
        try {
          editor.loadSnapshot(initialSnapshot);
        } catch (error) {
          console.warn("Failed to load initial whiteboard snapshot", error);
        }
      }
      initializedRef.current = true;
      unlistenRef.current = registerSnapshotListener(editor, onUserSnapshot);
      onEditorReady(editor);
    },
  });
}

function SyncCanvas({
  syncRoomId,
  syncHost,
  onSyncStatus,
  onEditorReady,
  onUserSnapshot,
}: SyncCanvasProps) {
  const unlistenRef = useRef<(() => void) | null>(null);
  const userInfo = useMemo(() => {
    const palette = [
      "#2563eb",
      "#16a34a",
      "#dc2626",
      "#9333ea",
      "#ea580c",
      "#0891b2",
    ];
    const color = palette[Math.floor(Math.random() * palette.length)];
    return {
      id: `wb-${crypto.randomUUID().slice(0, 8)}`,
      name: `WB-${Math.floor(Math.random() * 1000)}`,
      color,
    };
  }, []);

  const uri = useMemo(() => {
    const base = syncHost.replace(/\/+$/, "");
    return `${base}/connect/${encodeURIComponent(syncRoomId)}`;
  }, [syncHost, syncRoomId]);

  const store = useSync({
    uri,
    assets: inlineBase64AssetStore,
    userInfo,
  });

  useEffect(() => {
    return () => {
      unlistenRef.current?.();
      unlistenRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (store.status === "loading") {
      onSyncStatus("connecting", "กำลังเชื่อมต่อ tldraw sync...");
      return;
    }
    if (store.status === "error") {
      onSyncStatus("error", `Sync error: ${store.error.message}`);
      return;
    }
    const status = store.connectionStatus;
    if (status === "online") {
      onSyncStatus("online", `Live: ห้อง ${syncRoomId}`);
      return;
    }
    onSyncStatus("offline", "หลุดการเชื่อมต่อ กำลังพยายามใหม่");
  }, [onSyncStatus, store, syncRoomId]);

  if (store.status !== "synced-remote") {
    return createElement("div", {
      className:
        "flex h-full w-full items-center justify-center text-sm text-gray-500",
      children:
        store.status === "error"
          ? "ไม่สามารถเชื่อมต่อ live sync ได้"
          : "กำลังเชื่อมต่อ live sync...",
    });
  }

  return createElement(Tldraw, {
    store: store.store,
    autoFocus: true,
    onMount: (editor: Editor) => {
      unlistenRef.current?.();
      unlistenRef.current = registerSnapshotListener(editor, onUserSnapshot);
      onEditorReady(editor);
    },
  });
}

function BridgeApp(props: BridgeAppProps) {
  if (props.mode === "sync") {
    return createElement(SyncCanvas, props);
  }
  return createElement(OfflineCanvas, props);
}

export interface MountedTldrawBridge {
  unmount: () => void;
  loadSnapshot: (snapshot: Snapshot) => boolean;
  exportPng: () => Promise<string | null>;
  clearCurrentPage: () => void;
}

export interface MountTldrawBridgeOptions {
  target: HTMLElement;
  mode: TldrawBridgeMode;
  initialSnapshot: Snapshot | null;
  onUserSnapshot: (snapshot: Snapshot) => void;
  onSyncStatus?: (status: TldrawBridgeSyncStatus, message: string) => void;
  syncRoomId?: string;
  syncHost?: string;
}

export function mountTldrawBridge({
  target,
  mode,
  initialSnapshot,
  onUserSnapshot,
  onSyncStatus,
  syncRoomId,
  syncHost,
}: MountTldrawBridgeOptions): MountedTldrawBridge {
  let root: Root | null = createRoot(target);
  let editor: Editor | null = null;
  let isUnmounted = false;

  if (mode === "sync" && (!syncRoomId || !syncHost)) {
    throw new Error("syncRoomId and syncHost are required in sync mode");
  }

  const bridgeKey =
    mode === "sync"
      ? `sync-${syncRoomId}-${Date.now()}`
      : `offline-${Date.now()}`;

  if (mode === "sync") {
    root.render(
      createElement(BridgeApp, {
        key: bridgeKey,
        mode: "sync",
        initialSnapshot,
        onUserSnapshot,
        onEditorReady: (nextEditor: Editor) => {
          if (!isUnmounted) editor = nextEditor;
        },
        syncRoomId: syncRoomId!,
        syncHost: syncHost!,
        onSyncStatus:
          onSyncStatus ??
          (() => {
            /* no-op */
          }),
      }),
    );
  } else {
    root.render(
      createElement(BridgeApp, {
        key: bridgeKey,
        mode: "offline",
        initialSnapshot,
        onUserSnapshot,
        onEditorReady: (nextEditor: Editor) => {
          if (!isUnmounted) editor = nextEditor;
        },
      }),
    );
  }

  const loadSnapshot = (snapshot: Snapshot): boolean => {
    if (!editor) return false;
    try {
      editor.store.mergeRemoteChanges(() => {
        editor?.loadSnapshot(snapshot);
      });
      return true;
    } catch (error) {
      console.warn("Failed to apply whiteboard snapshot", error);
      return false;
    }
  };

  const exportPng = async (): Promise<string | null> => {
    if (!editor) return null;
    const shapeIds = Array.from(editor.getCurrentPageShapeIds());
    if (shapeIds.length === 0) return null;
    const result = await editor.toImageDataUrl(shapeIds, {
      format: "png",
      background: true,
      padding: 24,
      pixelRatio: 2,
    });
    return result.url;
  };

  const clearCurrentPage = () => {
    if (!editor) return;
    const shapeIds = Array.from(editor.getCurrentPageShapeIds());
    if (shapeIds.length === 0) return;
    editor.deleteShapes(shapeIds);
  };

  return {
    unmount: () => {
      if (!root || isUnmounted) return;
      isUnmounted = true;
      flushSync(() => {
        root?.unmount();
      });
      root = null;
      editor = null;
    },
    loadSnapshot,
    exportPng,
    clearCurrentPage,
  };
}
