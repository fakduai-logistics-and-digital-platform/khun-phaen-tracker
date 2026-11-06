/** Backend events over hibernating Durable Object WebSockets. No peer sync or queued writes. */
import { writable } from "@/lib/store";
import { API_BASE_URL, api } from "@/lib/api/apis";
import { readCache } from "@/lib/api/api-read-cache-db";

export type RealtimeStatus = "disconnected" | "connecting" | "connected";
export const realtimeStatus = writable<RealtimeStatus>("disconnected");
export const realtimePeers = writable(0);
export const dataChanged = writable<{
  entity: string;
  action: string;
  id?: string;
  data?: Record<string, unknown>;
  timestamp: number;
} | null>(null);

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let currentRoom: string | null = null;
let generation = 0;
let onChange: ((payload: any) => void) | undefined;
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || API_BASE_URL.replace(/^http/, "ws").replace(/\/api\/?$/, "/ws");

export function connectRealtime(roomCode: string, callback?: (payload: any) => void): void {
  if (currentRoom === roomCode && socket?.readyState === WebSocket.OPEN) {
    onChange = callback ?? onChange;
    return;
  }
  disconnectRealtime();
  currentRoom = roomCode;
  onChange = callback;
  const run = generation;
  void open(roomCode, run);
}

async function open(room: string, run: number): Promise<void> {
  if (run !== generation || currentRoom !== room) return;
  realtimeStatus.set("connecting");
  try {
    const response = await fetch(`${API_BASE_URL}/workspaces/${encodeURIComponent(room)}/realtime-ticket`, {
      method: "POST",
      headers: api.data._headers(true),
      credentials: "include",
      body: "{}",
    });
    if (run !== generation) return;
    if (response.status === 401 || response.status === 403) {
      disconnectRealtime();
      return;
    }
    if (!response.ok) throw new Error("Realtime ticket request failed");
    const { ticket } = await response.json();
    if (typeof ticket !== "string" || run !== generation) return;
    const target = new URL(WS_BASE);
    target.searchParams.set("ticket", ticket);
    const ws = new WebSocket(target.href);
    socket = ws;
    ws.onopen = () => {
      if (run !== generation) {
        ws.close();
        return;
      }
      realtimeStatus.set("connected");
      // Events can be missed while disconnected. Always refresh from the backend on reconnect.
      void refresh({ entity: "workspace", action: "refresh", timestamp: Date.now() }, run);
    };
    ws.onmessage = (event) => {
      if (run !== generation) return;
      try {
        const message = JSON.parse(event.data);
        if (message.type === "room_info" && Array.isArray(message.peers)) {
          realtimePeers.set(message.peers.length);
        } else if (message.type === "data" && typeof message.data === "string") {
          const payload = JSON.parse(message.data);
          if (typeof payload.entity === "string" && typeof payload.action === "string") {
            void refresh({ ...payload, timestamp: payload.timestamp || Date.now() }, run);
          }
        }
      } catch {
        /* Ignore malformed transport messages. */
      }
    };
    ws.onclose = () => retry(room, run);
    ws.onerror = () => ws.close();
  } catch {
    retry(room, run);
  }
}
async function refresh(payload: any, run: number): Promise<void> {
  try {
    await readCache.clear();
  } catch {
    /* Cache is optional. */
  }
  if (run !== generation) return;
  dataChanged.set(payload);
  onChange?.(payload);
}
function retry(room: string, run: number): void {
  if (run !== generation || currentRoom !== room) return;
  realtimeStatus.set("disconnected");
  realtimePeers.set(0);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => void open(room, run), 3000);
}
export function disconnectRealtime(): void {
  generation++;
  currentRoom = null;
  onChange = undefined;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (socket) {
    socket.onclose = null;
    socket.close();
  }
  socket = null;
  realtimeStatus.set("disconnected");
  realtimePeers.set(0);
}
