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

/** Fires whenever remote data changes so the UI can re-fetch */
export const dataChanged = writable<{
  entity: string;
  action: string;
  id?: string;
  timestamp: number;
} | null>(null);

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let currentRoomCode: string | null = null;
let _onDataChanged: (() => void) | null = null;

const WS_BASE = "ws://127.0.0.1:3002/ws";

/** Connect to the workspace room for real-time updates */
export function connectRealtime(roomCode: string, onDataChanged?: () => void) {
  // Don't reconnect to the same room
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

      // Join the room
      ws?.send(
        JSON.stringify({
          type: "join",
          room: roomCode,
          peerId: generatePeerId(),
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
            console.log("🔄 Realtime: reconnecting...");
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

/** Broadcast a data change to all peers in the room */
export function broadcastChange(
  entity: "task" | "project" | "assignee",
  action: "create" | "update" | "delete",
  id?: string,
) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const event = {
    type: "data_change",
    entity,
    action,
    id: id || undefined,
    timestamp: Date.now(),
  };

  ws.send(JSON.stringify(event));
}

// ===== Internal =====

function handleMessage(msg: any) {
  switch (msg.type) {
    case "system":
      // Peer count updates
      if (msg.event === "peer_joined" || msg.event === "peer_left") {
        if (typeof msg.peer_count === "number") {
          realtimePeers.set(msg.peer_count);
        }
      }
      break;

    case "data_change":
      // Another user changed data — trigger refresh
      console.log(
        `📡 Realtime: ${msg.entity} ${msg.action}${msg.id ? ` (${msg.id})` : ""}`,
      );
      dataChanged.set({
        entity: msg.entity,
        action: msg.action,
        id: msg.id,
        timestamp: msg.timestamp || Date.now(),
      });

      // Call the callback to refresh data
      if (_onDataChanged) {
        _onDataChanged();
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
