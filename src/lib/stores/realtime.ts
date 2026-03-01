/**
 * realtime.ts — WebSocket-based real-time collaboration
 *
 * When a user modifies data (tasks, projects, assignees), a lightweight
 * event is broadcast to all other users in the same workspace room.
 * Receivers simply re-fetch from the API — no CRDT complexity needed.
 */

import { writable, get } from "svelte/store";

export type RealtimeStatus = "disconnected" | "connecting" | "connected";

export const realtimeStatus = writable<RealtimeStatus>("disconnected");
export const realtimePeers = writable<number>(0);

/** Fires whenever remote data changes so the UI can update instantly */
export const dataChanged = writable<{
  entity: string;
  action: string;
  id?: string;
  data?: any;
  timestamp: number;
} | null>(null);

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let currentRoomCode: string | null = null;
let _onDataChanged: ((payload: any) => void) | null = null;

const WS_BASE = import.meta.env.VITE_WS_URL || "ws://127.0.0.1:3002/ws";

/** Connect to the workspace room for real-time updates */
export function connectRealtime(
  roomCode: string,
  onDataChanged?: (payload: any) => void,
) {
  if (currentRoomCode === roomCode && ws?.readyState === WebSocket.OPEN) return;

  disconnectRealtime();
  currentRoomCode = roomCode;
  _onDataChanged = onDataChanged || null;

  realtimeStatus.set("connecting");

  try {
    ws = new WebSocket(WS_BASE);

    ws.onopen = () => {
      console.log("🔗 Realtime: connected");
      realtimeStatus.set("connected");

      // Join the room (MATCHES RUST EXPECTATIONS)
      ws?.send(
        JSON.stringify({
          action: "join",
          room_code: roomCode,
          peer_id: generatePeerId(),
          is_host: false,
          metadata: null,
        }),
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch {
        // Ignore non-JSON messages
      }
    };

    ws.onclose = () => {
      console.log("🔌 Realtime: disconnected");
      realtimeStatus.set("disconnected");
      realtimePeers.set(0);

      // Auto-reconnect after 3 seconds
      if (currentRoomCode) {
        reconnectTimer = setTimeout(() => {
          if (currentRoomCode) {
            connectRealtime(currentRoomCode, _onDataChanged || undefined);
          }
        }, 3000);
      }
    };

    ws.onerror = () => {
      console.warn("⚠️ Realtime: connection error");
    };
  } catch (e) {
    console.warn("⚠️ Realtime: failed to connect", e);
    realtimeStatus.set("disconnected");
  }
}

/** Disconnect from real-time */
export function disconnectRealtime() {
  currentRoomCode = null;
  _onDataChanged = null;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.onclose = null; // Prevent auto-reconnect
    ws.close();
    ws = null;
  }
  realtimeStatus.set("disconnected");
  realtimePeers.set(0);
}

/** Broadcast a data change with payload to all peers */
export function broadcastChange(
  entity: "task" | "project" | "assignee" | "sprint",
  action: "create" | "update" | "delete",
  id?: string,
  data?: any,
) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  // We wrap our structural event into the string `data` field expected by the Rust server's `Broadcast` action
  const payload = JSON.stringify({
    entity,
    action,
    id: id || undefined,
    data,
    timestamp: Date.now(),
  });

  const event = {
    action: "broadcast",
    data: payload,
  };

  ws.send(JSON.stringify(event));
}

// ===== Internal =====

function handleMessage(msg: any) {
  // Handle ServerMessage format from Rust
  switch (msg.type) {
    case "room_info":
      if (Array.isArray(msg.peers)) {
        realtimePeers.set(msg.peers.length);
      }
      break;

    case "peer_joined":
      realtimePeers.set(get(realtimePeers) + 1);
      break;

    case "peer_left":
      const count = get(realtimePeers);
      if (count > 0) realtimePeers.set(count - 1);
      break;

    case "data":
      // Message comes wrapped inside the 'data' field
      try {
        const payload = JSON.parse(msg.data);
        console.log(
          `📡 Realtime: ${payload.entity} ${payload.action}${payload.id ? ` (${payload.id})` : ""}`,
        );
        dataChanged.set({
          entity: payload.entity,
          action: payload.action,
          id: payload.id,
          data: payload.data,
          timestamp: payload.timestamp || Date.now(),
        });

        // Call callback passing the payload to mutate local state immediately
        if (_onDataChanged) {
          _onDataChanged(payload);
        }
      } catch (e) {
        console.warn("Realtime: Failed to parse data payload", e);
      }
      break;
  }
}

function generatePeerId(): string {
  return (
    "peer_" +
    Math.random().toString(36).substring(2, 8) +
    "_" +
    Date.now().toString(36)
  );
}
