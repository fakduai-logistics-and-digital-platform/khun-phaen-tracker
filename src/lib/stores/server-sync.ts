import { writable, get } from "svelte/store";
import { base } from "$app/paths";
import type { Task } from "$lib/types";
import { exportAllData, importAllData, applyCRDTTasksToSQLite } from "$lib/db";
import {
  initCRDT,
  exportCRDTDocument,
  mergeCRDTDocument,
  clearCRDTOperations,
  syncTasksToCRDT,
  getCRDTTasks,
  crdtReady,
} from "./crdt-sync";

// Auto-import flag
let autoImportEnabled = false;

// Enable auto-import (call this from +page.svelte)
export function enableAutoImport() {
  autoImportEnabled = true;
  console.log("✅ Auto-import enabled");

  // Update last seen on load
  updateLastSeen();

  // Update last seen before page unload
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
      updateLastSeen();
    });

    // Update last seen periodically while connected (every 30 seconds)
    setInterval(() => {
      if (get(serverStatus) === "connected") {
        updateLastSeen();
      }
    }, 30000);

    // Start health check ping to keep backend awake (every 1 minute)
    startHealthCheckPing();
  }

  // Initialize CRDT
  initCRDT();

  // Set up CRDT-based callbacks for auto-import (sync from server)
  if (!onDocumentReceived) {
    onDocumentReceived = async (data: string) => {
      console.log("📥 Auto-importing data from CRDT sync...");
      try {
        // Check if data is CRDT format (starts with {) or CSV
        if (data.trim().startsWith("{")) {
          // CRDT format - merge directly
          const result = mergeCRDTDocument(data);
          console.log(
            `✅ CRDT merge: +${result.added} ~${result.updated} tasks`,
          );

          // Sync merged CRDT tasks back to SQLite
          if (get(crdtReady)) {
            const crdtTasks = getCRDTTasks();
            const { added, updated } = await applyCRDTTasksToSQLite(crdtTasks);
            console.log(`📊 SQLite sync: +${added} added, ${updated} updated`);

            // Reload page to refresh data ONLY if something changed
            if (added > 0 || updated > 0) {
              console.log("🔄 Data changed, reloading page...");
              window.location.reload();
            }
          }
        } else {
          // Legacy CSV format - use old method
          const result = await importAllData(data, {
            clearExisting: true,
            useExistingIds: true,
          });
          console.log(`✅ CSV import: ${result.tasks} tasks`);
          // Reload for CSV as it's usually a full reset
          window.location.reload();
        }
      } catch (e) {
        console.error("❌ Auto-import failed:", e);
        throw e;
      }
    };
  }

  if (!onSyncRequest) {
    onSyncRequest = async () => {
      console.log("📤 Auto-exporting CRDT data...");

      // Ensure CRDT is up to date with SQLite
      if (!get(crdtReady)) {
        await initCRDT();
      }

      // Export CRDT document
      const crdtDoc = exportCRDTDocument();
      if (crdtDoc) {
        return crdtDoc;
      }

      // Fallback to CSV if CRDT not ready
      console.log("⚠️ CRDT not ready, falling back to CSV");
      return await exportAllData();
    };
  }
}

// Storage keys
const STORAGE_KEY_URL = "sync-server-url";
const STORAGE_KEY_ROOM = "sync-room-code";
const STORAGE_KEY_IS_HOST = "sync-is-host";
const STORAGE_KEY_PEER_ID = "sync-peer-id";
const STORAGE_KEY_LAST_SEEN = "sync-last-seen";

// Server connection state
export const serverUrl = writable<string>("");
export const serverStatus = writable<
  "disconnected" | "connecting" | "connected"
>("disconnected");
export const serverRoomCode = writable<string>("");
export const isServerHost = writable<boolean>(false);
export const serverPeers = writable<{ id: string; name: string }[]>([]);
export const lastServerSync = writable<Date | null>(null);
export const syncMessage = writable<string>("");
export const currentPeerIdStore = writable<string>("");

// Callbacks for sync operations
let onDocumentReceived: ((data: string) => Promise<void>) | null = null;
let onSyncRequest: (() => Promise<string>) | null = null;
export type MergeResult =
  | { added: number; updated: number; unchanged: number }
  | {
      tasks: { added: number; updated: number; unchanged: number };
      projects: { added: number; updated: number };
      assignees: { added: number; updated: number };
      sprints: { added: number; updated: number };
    };
let onDocumentMerge: ((data: string) => Promise<MergeResult>) | null = null;

let ws: WebSocket | null = null;
let reconnectInterval: ReturnType<typeof setInterval> | null = null;
let pingInterval: ReturnType<typeof setInterval> | null = null;
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
const HOST_AUTO_SYNC_DEBOUNCE_MS = 350;
let hostAutoSyncTimer: ReturnType<typeof setTimeout> | null = null;
let hostAutoSyncPending = false;
let syncInFlight = false;

// Persistent peer ID
let currentPeerId: string | null = null;

interface SyncDocumentOptions {
  silent?: boolean;
  source?: "manual" | "auto";
}

function canAutoSyncNow(): boolean {
  return get(serverStatus) === "connected" && Boolean(get(serverRoomCode));
}

function clearHostAutoSyncState() {
  if (hostAutoSyncTimer) {
    clearTimeout(hostAutoSyncTimer);
    hostAutoSyncTimer = null;
  }
  hostAutoSyncPending = false;
  syncInFlight = false;
}

// Queue sync after local changes. Debounced to prevent spam when many edits happen quickly.
export function scheduleRealtimeSync(
  reason: string = "local-change",
  debounceMs: number = HOST_AUTO_SYNC_DEBOUNCE_MS,
): boolean {
  if (!canAutoSyncNow()) return false;

  if (hostAutoSyncTimer) clearTimeout(hostAutoSyncTimer);
  hostAutoSyncTimer = setTimeout(() => {
    hostAutoSyncTimer = null;
    console.log(`⚡ Realtime sync triggered (${reason})`);
    void syncDocumentToServer({ silent: true, source: "auto" });
  }, debounceMs);

  return true;
}

// Keep the old name for backward compatibility during transition if needed
export const scheduleHostRealtimeSync = scheduleRealtimeSync;

// Save connection settings to localStorage
function saveConnectionSettings(
  url: string,
  roomCode: string,
  isHost: boolean,
  peerId: string,
) {
  try {
    localStorage.setItem(STORAGE_KEY_URL, url);
    localStorage.setItem(STORAGE_KEY_ROOM, roomCode);
    localStorage.setItem(STORAGE_KEY_IS_HOST, JSON.stringify(isHost));
    localStorage.setItem(STORAGE_KEY_PEER_ID, peerId);
    localStorage.setItem(STORAGE_KEY_LAST_SEEN, Date.now().toString());
    console.log("💾 Saved sync settings:", {
      url,
      roomCode,
      isHost,
      peerId: peerId.slice(0, 8),
    });
  } catch (e) {
    console.error("Failed to save sync settings:", e);
  }
}

// Update last seen timestamp
function updateLastSeen() {
  try {
    localStorage.setItem(STORAGE_KEY_LAST_SEEN, Date.now().toString());
  } catch (e) {
    console.error("Failed to update last seen:", e);
  }
}

// Keep saved room session until user explicitly disconnects.
// Refresh / reopen should auto-reconnect regardless of how long the tab was closed.
function shouldAutoReconnect(): boolean {
  return true;
}

// Clear connection settings (keep URL for reuse)
function clearConnectionSettings() {
  try {
    // Keep URL so user can reconnect with same server
    // localStorage.removeItem(STORAGE_KEY_URL);
    localStorage.removeItem(STORAGE_KEY_ROOM);
    localStorage.removeItem(STORAGE_KEY_IS_HOST);
    localStorage.removeItem(STORAGE_KEY_PEER_ID);
    localStorage.removeItem(STORAGE_KEY_LAST_SEEN);
    console.log("🗑️ Cleared room settings (kept URL)");
  } catch (e) {
    console.error("Failed to clear sync settings:", e);
  }
}

// Helper to normalize URL (remove trailing slash)
function normalizeUrl(url: string): string {
  return url ? url.replace(/\/+$/, "") : "";
}

// Load saved connection settings
export function loadSavedConnection(): {
  url: string;
  roomCode: string;
  isHost: boolean;
  peerId: string;
} | null {
  try {
    const url = localStorage.getItem(STORAGE_KEY_URL);
    const roomCode = localStorage.getItem(STORAGE_KEY_ROOM);
    const isHost = localStorage.getItem(STORAGE_KEY_IS_HOST);
    const peerId = localStorage.getItem(STORAGE_KEY_PEER_ID);

    if (url && roomCode && peerId) {
      return {
        url: normalizeUrl(url),
        roomCode,
        isHost: JSON.parse(isHost || "false"),
        peerId,
      };
    }
  } catch (e) {
    console.error("Failed to load sync settings:", e);
  }
  return null;
}

// Auto-reconnect with saved settings
export async function autoReconnect(): Promise<boolean> {
  if (!shouldAutoReconnect()) return false;

  const saved = loadSavedConnection();
  if (!saved) {
    console.log("ℹ️ No saved connection found");
    return false;
  }

  console.log("🔄 Auto-reconnecting to:", saved.url, "room:", saved.roomCode);

  // Set the saved URL
  serverUrl.set(saved.url);
  currentPeerId = saved.peerId;
  currentPeerIdStore.set(saved.peerId);

  // Connect to server
  connectToServer(saved.url);

  // Wait for connection
  try {
    await waitForConnection();

    // Set stores before joining so handleServerMessage sees correct state
    const normalizedCode = saved.roomCode.toUpperCase();
    serverRoomCode.set(normalizedCode);
    isServerHost.set(saved.isHost);

    // Rejoin room
    sendMessage({
      action: "join",
      room_code: normalizedCode,
      peer_id: saved.peerId,
      is_host: saved.isHost,
      metadata: { name: saved.isHost ? "Host" : "Guest" },
    });

    console.log("✅ Auto-reconnect successful");
    return true;
  } catch (error) {
    console.error("❌ Auto-reconnect failed:", error);
    return false;
  }
}

// Update server URL
export function updateServerUrl(url: string) {
  url = normalizeUrl(url);
  serverUrl.set(url);
  // Always save URL to localStorage immediately
  try {
    localStorage.setItem(STORAGE_KEY_URL, url);
    console.log("💾 URL saved to localStorage:", url);
  } catch (e) {
    console.error("Failed to save URL:", e);
  }

  // Also update full settings if already connected
  const currentRoom = get(serverRoomCode);
  const host = get(isServerHost);
  if (currentRoom && currentPeerId) {
    saveConnectionSettings(url, currentRoom, host, currentPeerId);
  }
}

// Set callbacks
export function setSyncCallbacks(
  onReceive: (data: string) => Promise<void>,
  onRequest: () => Promise<string>,
  onMerge?: (data: string) => Promise<MergeResult>,
) {
  console.log("🔄 Sync callbacks registered");
  onDocumentReceived = onReceive;
  onSyncRequest = onRequest;
  if (onMerge) {
    onDocumentMerge = onMerge;
    console.log("🔄 Merge callback registered");
  }
}

// Set merge callback separately
export function setMergeCallback(
  onMerge: (data: string) => Promise<MergeResult>,
) {
  onDocumentMerge = onMerge;
  console.log("🔄 Merge callback set");
}

// Initialize server connection
export function initServerSync(url: string) {
  url = normalizeUrl(url);
  serverUrl.set(url);
  connectToServer(url);
}

// Connect to sync server
function connectToServer(url: string) {
  url = normalizeUrl(url);
  if (ws?.readyState === WebSocket.OPEN) {
    ws.close();
  }

  serverStatus.set("connecting");

  try {
    const wsUrl = url.replace(/^http/, "ws") + "/ws";
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("✅ Connected to sync server:", url);
      serverStatus.set("connected");
      syncMessage.set("เชื่อมต่อสำเร็จ");
      startPing();
      updateLastSeen(); // Update last seen on successful connection

      // Auto-clear message after 2 seconds
      setTimeout(() => syncMessage.set(""), 2000);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch (e) {
        console.error("Invalid message from server:", e);
      }
    };

    ws.onclose = () => {
      console.log("🔌 Disconnected from server");
      serverStatus.set("disconnected");
      stopPing();
      clearHostAutoSyncState();
      scheduleReconnect(url);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      serverStatus.set("disconnected");
      syncMessage.set("การเชื่อมต่อผิดพลาด");
    };
  } catch (error) {
    console.error("Failed to connect:", error);
    serverStatus.set("disconnected");
    syncMessage.set("ไม่สามารถเชื่อมต่อได้");
  }
}

// Handle server messages
function handleServerMessage(msg: any) {
  switch (msg.type) {
    case "connected":
      console.log("Connected as peer:", msg.peer_id);
      syncMessage.set("เชื่อมต่อกับห้อง " + msg.room_code);
      setTimeout(() => syncMessage.set(""), 2000);
      break;

    case "room_info":
      serverRoomCode.set(msg.room_code);
      serverPeers.set(
        msg.peers.map((p: any) => ({
          id: p.id,
          name: p.metadata?.name || p.id,
        })),
      );
      console.log("Room info:", msg.peers.length, "peers");
      break;

    case "peer_joined":
      const peerName = msg.peer.metadata?.name || msg.peer.id;
      serverPeers.update((peers) => [
        ...peers,
        { id: msg.peer.id, name: peerName },
      ]);
      syncMessage.set("มีผู้เข้าร่วม: " + peerName);
      setTimeout(() => syncMessage.set(""), 3000);

      // If host, sync document to new peer immediately
      if (get(isServerHost)) {
        console.log(
          "👋 Host: New peer joined, syncing immediately to:",
          msg.peer.id,
        );
        syncDocumentToServer();
      }
      break;

    case "peer_left":
      serverPeers.update((peers) => peers.filter((p) => p.id !== msg.peer_id));
      const leftPeer = get(serverPeers).find((p) => p.id === msg.peer_id);
      syncMessage.set(
        "ผู้เข่าร่วมออก: " + (leftPeer?.name || msg.peer_id).substring(0, 20),
      );
      setTimeout(() => syncMessage.set(""), 3000);
      break;

    case "document_sync":
      console.log(
        "📄 Received document_sync, length:",
        msg.document?.length || 0,
      );
      syncMessage.set("ได้รับข้อมูลใหม่ กำลังนำเข้า...");

      // Import the document immediately
      if (onDocumentReceived && msg.document) {
        console.log("📥 Calling onDocumentReceived callback...");
        onDocumentReceived(msg.document)
          .then(() => {
            console.log("✅ Document imported successfully");
            syncMessage.set("นำเข้าข้อมูลสำเร็จ");
            setTimeout(() => syncMessage.set(""), 2000);
          })
          .catch((err) => {
            console.error("❌ Failed to import document:", err);
            syncMessage.set("นำเข้าล้มเหลว");
            setTimeout(() => syncMessage.set(""), 3000);
          });
      } else {
        console.warn("⚠️ No callback or empty document", {
          hasCallback: !!onDocumentReceived,
          hasDocument: !!msg.document,
        });
      }

      lastServerSync.set(new Date());
      break;

    case "data":
      console.log(
        "Data from",
        msg.from,
        ":",
        msg.data.substring(0, 50) + "...",
      );
      break;

    case "pong":
      // Server is alive
      break;

    case "error":
      // Handle Room not found for Host (restoration)
      if (msg.message === "Room not found" && get(isServerHost)) {
        const room = get(serverRoomCode);
        if (room && currentPeerId) {
          console.log("🔄 Host attempting to restore room:", room);
          syncMessage.set("กำลังกู้คืนห้อง...");

          // Attempt to re-create the room with same code and host ID
          createServerRoom(get(serverUrl), room, currentPeerId)
            .then((code) => {
              if (code) {
                console.log("✅ Room restored successfully");
                syncMessage.set("กู้คืนห้องสำเร็จ");
              } else {
                console.error("❌ Failed to restore room");
                syncMessage.set("กู้คืนห้องล้มเหลว");
              }
            })
            .catch((e) => {
              console.error("❌ Error restoring room:", e);
            });
          return;
        }
      } else if (msg.message === "Room not found" && !get(isServerHost)) {
        // Guest logic: Room gone (server restart?), wait for host to restore
        console.log("❌ Room not found, waiting for host to restore...");
        syncMessage.set("ไม่พบห้อง กำลังรอ Host...");
        // Disconnect to trigger auto-reconnect loop
        setTimeout(() => {
          if (ws) ws.close();
        }, 5000);
        return;
      }

      console.error("Server error:", msg.message);
      syncMessage.set("Error: " + msg.message);
      break;
  }
}

// Create room on server
export async function createServerRoom(
  url: string,
  desiredRoomCode?: string,
  desiredHostId?: string,
): Promise<string | null> {
  url = normalizeUrl(url);
  try {
    const response = await fetch(`${url}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        desired_room_code: desiredRoomCode,
        desired_host_id: desiredHostId,
      }),
    });

    const data = await response.json();

    if (data.success) {
      // Save settings
      currentPeerId = data.host_id;
      currentPeerIdStore.set(data.host_id);
      saveConnectionSettings(url, data.room_code, true, data.host_id);

      // Connect to WebSocket
      initServerSync(url);

      // Wait for connection then join as host
      await waitForConnection();

      serverRoomCode.set(data.room_code);
      isServerHost.set(true);

      sendMessage({
        action: "join",
        room_code: data.room_code,
        peer_id: data.host_id,
        is_host: true,
        metadata: { name: "Host" },
      });

      return data.room_code;
    }

    return null;
  } catch (error) {
    console.error("Failed to create room:", error);
    syncMessage.set("สร้างห้องไม่สำเร็จ");
    return null;
  }
}

// Join existing room on server
export async function joinServerRoom(
  url: string,
  roomCode: string,
  peerName: string = "Guest",
): Promise<boolean> {
  try {
    // Generate or reuse peer ID
    const peerId =
      currentPeerId || "peer_" + Math.random().toString(36).substring(2, 8);
    currentPeerId = peerId;
    currentPeerIdStore.set(peerId);

    // Save settings
    url = normalizeUrl(url);
    saveConnectionSettings(url, roomCode.toUpperCase(), false, peerId);

    initServerSync(url);

    await waitForConnection();

    serverRoomCode.set(roomCode);
    isServerHost.set(false);

    sendMessage({
      action: "join",
      room_code: roomCode.toUpperCase(),
      peer_id: peerId,
      is_host: false,
      metadata: { name: peerName },
    });

    return true;
  } catch (error) {
    console.error("Failed to join room:", error);
    syncMessage.set("เข้าร่วมไม่สำเร็จ");
    return false;
  }
}

// Leave room
export function leaveServerRoom() {
  sendMessage({ action: "leave" });

  if (ws) {
    ws.close();
    ws = null;
  }

  // Clear saved settings
  clearConnectionSettings();
  currentPeerId = null;
  currentPeerIdStore.set("");

  serverRoomCode.set("");
  isServerHost.set(false);
  serverPeers.set([]);
  serverStatus.set("disconnected");
  syncMessage.set("ออกจากห้องแล้ว");

  stopPing();
  clearHostAutoSyncState();
  stopHealthCheckPing();
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
    reconnectInterval = null;
  }
}

// Sync document to server (all peers can sync)
export async function syncDocumentToServer(options: SyncDocumentOptions = {}) {
  const { silent = false, source = "manual" } = options;

  if (!get(serverRoomCode)) {
    if (!silent) {
      syncMessage.set("ไม่ได้เชื่อมต่อห้อง");
      setTimeout(() => syncMessage.set(""), 2000);
    }
    return;
  }

  if (!onSyncRequest) {
    console.error("❌ No sync callback registered");
    if (!silent) {
      syncMessage.set("ไม่ได้ตั้งค่า callback");
      setTimeout(() => syncMessage.set(""), 2000);
    }
    return;
  }

  if (syncInFlight) {
    if (source === "auto") {
      hostAutoSyncPending = true;
    } else if (!silent) {
      syncMessage.set("กำลังส่งข้อมูล...");
      setTimeout(() => syncMessage.set(""), 1200);
    }
    return;
  }

  syncInFlight = true;
  if (!silent) {
    syncMessage.set("กำลังส่งข้อมูล...");
  }

  try {
    // Get data from callback (async)
    const documentData = await onSyncRequest();

    if (!documentData) {
      if (!silent) {
        syncMessage.set("ไม่มีข้อมูลให้ sync");
        setTimeout(() => syncMessage.set(""), 2000);
      }
      return;
    }

    console.log("📤 Sending sync_document, data length:", documentData.length);

    sendMessage({
      action: "sync_document",
      document: documentData,
    });

    if (!silent) {
      syncMessage.set("ส่งข้อมูลสำเร็จ");
      setTimeout(() => syncMessage.set(""), 2000);
    }
    lastServerSync.set(new Date());
  } catch (error) {
    console.error("❌ Sync failed:", error);
    if (!silent) {
      syncMessage.set("Sync ล้มเหลว");
    }
  } finally {
    syncInFlight = false;
    if (hostAutoSyncPending) {
      hostAutoSyncPending = false;
      // Flush one final update that happened while previous sync was in-flight.
      scheduleHostRealtimeSync("flush-pending");
    }
  }
}

// Request sync from host
export function requestSyncFromServer() {
  syncMessage.set("กำลังขอข้อมูล...");

  console.log("📤 Sending request_sync");
  sendMessage({ action: "request_sync" });

  // Clear message after timeout if no response
  setTimeout(() => {
    if (get(syncMessage) === "กำลังขอข้อมูล...") {
      syncMessage.set("ไม่ได้รับการตอบสนอง");
      setTimeout(() => syncMessage.set(""), 2000);
    }
  }, 5000);
}

// Request merge from server (uses onDocumentMerge callback)
export function requestMergeFromServer(): Promise<MergeResult> {
  return new Promise((resolve, reject) => {
    if (!get(serverRoomCode)) {
      reject(new Error("ไม่ได้เชื่อมต่อห้อง"));
      return;
    }

    if (!onDocumentMerge) {
      reject(new Error("ไม่ได้ตั้งค่า merge callback"));
      return;
    }

    syncMessage.set("กำลังขอข้อมูลสำหรับ Merge...");

    // Store the resolve function temporarily
    const originalOnDocumentReceived = onDocumentReceived;
    let resolved = false;

    // Override temporarily to capture the merge result
    onDocumentReceived = async (data: string) => {
      if (resolved) return; // Prevent double resolve
      resolved = true;

      try {
        // Handle empty document (no data on server yet)
        if (!data || data.trim() === "") {
          console.log("ℹ️ No data on server yet");
          syncMessage.set("ยังไม่มีข้อมูลบน server");
          setTimeout(() => syncMessage.set(""), 2000);

          // Restore original callback
          onDocumentReceived = originalOnDocumentReceived;

          resolve({ added: 0, updated: 0, unchanged: 0 });
          return;
        }

        const result = await onDocumentMerge!(data);
        if ("tasks" in result) {
          syncMessage.set(
            `Merge สำเร็จ: +${result.tasks.added} ~${result.tasks.updated}`,
          );
        } else {
          syncMessage.set(`Merge สำเร็จ: +${result.added} ~${result.updated}`);
        }
        setTimeout(() => syncMessage.set(""), 3000);

        // Restore original callback
        onDocumentReceived = originalOnDocumentReceived;

        resolve(result);
      } catch (error) {
        // Restore original callback
        onDocumentReceived = originalOnDocumentReceived;
        reject(error);
      }
    };

    console.log("📤 Sending request_sync for merge");
    sendMessage({ action: "request_sync" });

    // Timeout - increased to 15 seconds
    setTimeout(() => {
      if (!resolved) {
        onDocumentReceived = originalOnDocumentReceived;
        if (get(syncMessage) === "กำลังขอข้อมูลสำหรับ Merge...") {
          syncMessage.set("ไม่ได้รับการตอบสนอง");
          setTimeout(() => syncMessage.set(""), 2000);
        }
        reject(new Error("Timeout"));
      }
    }, 15000);
  });
}

// Helper functions
function sendMessage(msg: any) {
  if (ws?.readyState === WebSocket.OPEN) {
    const json = JSON.stringify(msg);
    console.log(
      "📨 WS Send:",
      msg.action || msg.type,
      "- length:",
      json.length,
    );
    ws.send(json);
    updateLastSeen(); // Update last seen on any message sent
  } else {
    console.warn("⚠️ WebSocket not connected, state:", ws?.readyState);
    syncMessage.set("ไม่ได้เชื่อมต่อ");
  }
}

function waitForConnection(): Promise<void> {
  return new Promise((resolve, reject) => {
    const checkInterval = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);

    setTimeout(() => {
      clearInterval(checkInterval);
      reject(new Error("Connection timeout"));
    }, 5000);
  });
}

function scheduleReconnect(url: string) {
  if (reconnectInterval) return;

  reconnectInterval = setInterval(() => {
    if (get(serverStatus) === "disconnected" && get(serverRoomCode)) {
      console.log("Attempting to reconnect...");
      connectToServer(url);
    }
  }, 5000);
}

function startPing() {
  pingInterval = setInterval(() => {
    sendMessage({ action: "ping" });
  }, 30000);
}

function stopPing() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

// Default server URL for health check
const DEFAULT_SERVER_URL = "http://localhost:3001";

// Health check ping to backend (fire and forget, to keep server awake)
// This runs in background even when not connected to any room
function startHealthCheckPing() {
  // Clear existing interval if any
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }

  // Function to get URL for health check
  const getHealthCheckUrl = (): string => {
    // Priority: saved URL > current serverUrl store > default
    try {
      const savedUrl = localStorage.getItem(STORAGE_KEY_URL);
      if (savedUrl) return savedUrl;
    } catch (e) {
      // Ignore localStorage errors
    }

    const currentUrl = get(serverUrl);
    if (currentUrl) return currentUrl;

    return DEFAULT_SERVER_URL;
  };

  // Function to perform health check
  const doHealthCheck = () => {
    const url = getHealthCheckUrl();

    // Fire and forget - don't care about result
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    fetch(`${url}/health`, {
      method: "GET",
      signal: controller.signal,
      // Prevent caching
      cache: "no-store",
    })
      .then(() => {
        clearTimeout(timeoutId);
        console.log("💓 Background health check ping sent to:", url);
      })
      .catch(() => {
        clearTimeout(timeoutId);
        // Ignore all errors - this is just to wake up the server
      });
  };

  // Do immediate first ping (delayed slightly to not block page load)
  setTimeout(doHealthCheck, 2000);

  // Then ping every 1 minute
  healthCheckInterval = setInterval(doHealthCheck, 60000);

  console.log("💓 Background health check ping started (every 1 minute)");
}

function stopHealthCheckPing() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    console.log("💓 Health check ping stopped");
  }
}

// Get server connection info
export function getServerInfo() {
  return {
    url: get(serverUrl),
    status: get(serverStatus),
    roomCode: get(serverRoomCode),
    isHost: get(isServerHost),
    peers: get(serverPeers),
  };
}
