import { writable, get } from 'svelte/store';
import { base } from '$app/paths';
import type { Task } from '$lib/types';
import { exportAllData, importAllData } from '$lib/db';
import { 
    initCRDT, 
    exportCRDTDocument, 
    mergeCRDTDocument, 
    clearCRDTOperations,
    syncTasksToCRDT,
    getCRDTTasks,
    crdtReady
} from './crdt-sync';

// Auto-import flag
let autoImportEnabled = false;

// Enable auto-import (call this from +page.svelte)
export function enableAutoImport() {
    autoImportEnabled = true;
    console.log('✅ Auto-import enabled');
    
    // Update last seen on load
    updateLastSeen();
    
    // Update last seen before page unload
    if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', () => {
            updateLastSeen();
        });
        
        // Update last seen periodically while connected (every 30 seconds)
        setInterval(() => {
            if (get(serverStatus) === 'connected') {
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
            console.log('📥 Auto-importing data from CRDT sync...');
            try {
                // Check if data is CRDT format (starts with {) or CSV
                if (data.trim().startsWith('{')) {
                    // CRDT format - merge directly
                    const result = mergeCRDTDocument(data);
                    console.log(`✅ CRDT merge: +${result.added} ~${result.updated} tasks`);
                    
                    // Sync merged CRDT tasks back to SQLite
                    if ($crdtReady) {
                        const crdtTasks = getCRDTTasks();
                        // This will be handled by the app reloading data
                        console.log(`📊 ${crdtTasks.length} tasks in CRDT after merge`);
                    }
                } else {
                    // Legacy CSV format - use old method
                    const result = await importAllData(data, { clearExisting: true, useExistingIds: true });
                    console.log(`✅ CSV import: ${result.tasks} tasks`);
                }
                
                // Reload page to refresh data
                window.location.reload();
            } catch (e) {
                console.error('❌ Auto-import failed:', e);
                throw e;
            }
        };
    }
    
    if (!onSyncRequest) {
        onSyncRequest = async () => {
            console.log('📤 Auto-exporting CRDT data...');
            
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
            console.log('⚠️ CRDT not ready, falling back to CSV');
            return await exportAllData();
        };
    }
}

// Storage keys
const STORAGE_KEY_URL = 'sync-server-url';
const STORAGE_KEY_ROOM = 'sync-room-code';
const STORAGE_KEY_IS_HOST = 'sync-is-host';
const STORAGE_KEY_PEER_ID = 'sync-peer-id';
const STORAGE_KEY_LAST_SEEN = 'sync-last-seen';
const AUTO_DISCONNECT_AFTER_MINUTES = 5; // ยกเลิกการเชื่อมต่ออัตโนมัติถ้าไม่ได้เข้ามา 5 นาที

// Server connection state
export const serverUrl = writable<string>('');
export const serverStatus = writable<'disconnected' | 'connecting' | 'connected'>('disconnected');
export const serverRoomCode = writable<string>('');
export const isServerHost = writable<boolean>(false);
export const serverPeers = writable<{ id: string; name: string }[]>([]);
export const lastServerSync = writable<Date | null>(null);
export const syncMessage = writable<string>('');
export const currentPeerIdStore = writable<string>('');

// Callbacks for sync operations
let onDocumentReceived: ((data: string) => Promise<void>) | null = null;
let onSyncRequest: (() => Promise<string>) | null = null;
let onDocumentMerge: ((data: string) => Promise<{ added: number; updated: number; unchanged: number }>) | null = null;

let ws: WebSocket | null = null;
let reconnectInterval: ReturnType<typeof setInterval> | null = null;
let pingInterval: ReturnType<typeof setInterval> | null = null;
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

// Persistent peer ID
let currentPeerId: string | null = null;

// Save connection settings to localStorage
function saveConnectionSettings(url: string, roomCode: string, isHost: boolean, peerId: string) {
    try {
        localStorage.setItem(STORAGE_KEY_URL, url);
        localStorage.setItem(STORAGE_KEY_ROOM, roomCode);
        localStorage.setItem(STORAGE_KEY_IS_HOST, JSON.stringify(isHost));
        localStorage.setItem(STORAGE_KEY_PEER_ID, peerId);
        localStorage.setItem(STORAGE_KEY_LAST_SEEN, Date.now().toString());
        console.log('💾 Saved sync settings:', { url, roomCode, isHost, peerId: peerId.slice(0, 8) });
    } catch (e) {
        console.error('Failed to save sync settings:', e);
    }
}

// Update last seen timestamp
function updateLastSeen() {
    try {
        localStorage.setItem(STORAGE_KEY_LAST_SEEN, Date.now().toString());
    } catch (e) {
        console.error('Failed to update last seen:', e);
    }
}

// Check if should auto-reconnect based on last seen time
function shouldAutoReconnect(): boolean {
    try {
        const lastSeen = localStorage.getItem(STORAGE_KEY_LAST_SEEN);
        if (!lastSeen) return true; // No last seen, allow reconnect
        
        const lastSeenTime = parseInt(lastSeen, 10);
        const now = Date.now();
        const diffMinutes = (now - lastSeenTime) / (1000 * 60);
        
        if (diffMinutes > AUTO_DISCONNECT_AFTER_MINUTES) {
            console.log(`⏰ Last seen ${diffMinutes.toFixed(1)} minutes ago, clearing saved connection`);
            clearConnectionSettings();
            return false;
        }
        return true;
    } catch (e) {
        console.error('Failed to check last seen:', e);
        return true;
    }
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
        console.log('🗑️ Cleared room settings (kept URL)');
    } catch (e) {
        console.error('Failed to clear sync settings:', e);
    }
}

// Load saved connection settings
export function loadSavedConnection(): { url: string; roomCode: string; isHost: boolean; peerId: string } | null {
    try {
        const url = localStorage.getItem(STORAGE_KEY_URL);
        const roomCode = localStorage.getItem(STORAGE_KEY_ROOM);
        const isHost = localStorage.getItem(STORAGE_KEY_IS_HOST);
        const peerId = localStorage.getItem(STORAGE_KEY_PEER_ID);
        
        if (url && roomCode && peerId) {
            return {
                url,
                roomCode,
                isHost: JSON.parse(isHost || 'false'),
                peerId
            };
        }
    } catch (e) {
        console.error('Failed to load sync settings:', e);
    }
    return null;
}

// Auto-reconnect with saved settings
export async function autoReconnect(): Promise<boolean> {
    // Check if we should auto-reconnect based on last seen time
    if (!shouldAutoReconnect()) {
        console.log('⏰ Auto-reconnect skipped: away too long (>5 minutes)');
        return false;
    }
    
    const saved = loadSavedConnection();
    if (!saved) {
        console.log('ℹ️ No saved connection found');
        return false;
    }
    
    console.log('🔄 Auto-reconnecting to:', saved.url, 'room:', saved.roomCode);
    
    // Set the saved URL
    serverUrl.set(saved.url);
    currentPeerId = saved.peerId;
    currentPeerIdStore.set(saved.peerId);
    
    // Connect to server
    connectToServer(saved.url);
    
    // Wait for connection
    try {
        await waitForConnection();
        
        // Rejoin room
        sendMessage({
            action: 'join',
            room_code: saved.roomCode,
            peer_id: saved.peerId,
            is_host: saved.isHost,
            metadata: { name: saved.isHost ? 'Host' : 'Guest' }
        });
        
        serverRoomCode.set(saved.roomCode);
        isServerHost.set(saved.isHost);
        
        console.log('✅ Auto-reconnect successful');
        return true;
    } catch (error) {
        console.error('❌ Auto-reconnect failed:', error);
        return false;
    }
}

// Update server URL
export function updateServerUrl(url: string) {
    serverUrl.set(url);
    // Always save URL to localStorage immediately
    try {
        localStorage.setItem(STORAGE_KEY_URL, url);
        console.log('💾 URL saved to localStorage:', url);
    } catch (e) {
        console.error('Failed to save URL:', e);
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
    onMerge?: (data: string) => Promise<{ added: number; updated: number; unchanged: number }>
) {
    console.log('🔄 Sync callbacks registered');
    onDocumentReceived = onReceive;
    onSyncRequest = onRequest;
    if (onMerge) {
        onDocumentMerge = onMerge;
        console.log('🔄 Merge callback registered');
    }
}

// Set merge callback separately
export function setMergeCallback(
    onMerge: (data: string) => Promise<{ added: number; updated: number; unchanged: number }>
) {
    onDocumentMerge = onMerge;
    console.log('🔄 Merge callback set');
}

// Initialize server connection
export function initServerSync(url: string) {
    serverUrl.set(url);
    connectToServer(url);
}

// Connect to sync server
function connectToServer(url: string) {
    if (ws?.readyState === WebSocket.OPEN) {
        ws.close();
    }

    serverStatus.set('connecting');

    try {
        const wsUrl = url.replace(/^http/, 'ws') + '/ws';
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('✅ Connected to sync server:', url);
            serverStatus.set('connected');
            syncMessage.set('เชื่อมต่อสำเร็จ');
            startPing();
            updateLastSeen(); // Update last seen on successful connection
            
            // Auto-clear message after 2 seconds
            setTimeout(() => syncMessage.set(''), 2000);
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                handleServerMessage(msg);
            } catch (e) {
                console.error('Invalid message from server:', e);
            }
        };

        ws.onclose = () => {
            console.log('🔌 Disconnected from server');
            serverStatus.set('disconnected');
            stopPing();
            scheduleReconnect(url);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            serverStatus.set('disconnected');
            syncMessage.set('การเชื่อมต่อผิดพลาด');
        };
    } catch (error) {
        console.error('Failed to connect:', error);
        serverStatus.set('disconnected');
        syncMessage.set('ไม่สามารถเชื่อมต่อได้');
    }
}

// Handle server messages
function handleServerMessage(msg: any) {
    switch (msg.type) {
        case 'connected':
            console.log('Connected as peer:', msg.peer_id);
            syncMessage.set('เชื่อมต่อกับห้อง ' + msg.room_code);
            setTimeout(() => syncMessage.set(''), 2000);
            break;

        case 'room_info':
            serverRoomCode.set(msg.room_code);
            serverPeers.set(msg.peers.map((p: any) => ({ 
                id: p.id, 
                name: p.metadata?.name || p.id 
            })));
            console.log('Room info:', msg.peers.length, 'peers');
            break;

        case 'peer_joined':
            const peerName = msg.peer.metadata?.name || msg.peer.id;
            serverPeers.update(peers => [...peers, { id: msg.peer.id, name: peerName }]);
            syncMessage.set('มีผู้เข้าร่วม: ' + peerName);
            setTimeout(() => syncMessage.set(''), 3000);
            
            // If host, sync document to new peer immediately
            if (get(isServerHost)) {
                console.log('👋 Host: New peer joined, syncing immediately to:', msg.peer.id);
                syncDocumentToServer();
            }
            break;

        case 'peer_left':
            serverPeers.update(peers => peers.filter(p => p.id !== msg.peer_id));
            const leftPeer = get(serverPeers).find(p => p.id === msg.peer_id);
            syncMessage.set('ผู้เข่าร่วมออก: ' + (leftPeer?.name || msg.peer_id).substring(0, 20));
            setTimeout(() => syncMessage.set(''), 3000);
            break;

        case 'document_sync':
            console.log('📄 Received document_sync, length:', msg.document?.length || 0);
            syncMessage.set('ได้รับข้อมูลใหม่ กำลังนำเข้า...');
            
            // Import the document immediately
            if (onDocumentReceived && msg.document) {
                console.log('📥 Calling onDocumentReceived callback...');
                onDocumentReceived(msg.document)
                    .then(() => {
                        console.log('✅ Document imported successfully');
                        syncMessage.set('นำเข้าข้อมูลสำเร็จ');
                        setTimeout(() => syncMessage.set(''), 2000);
                    })
                    .catch((err) => {
                        console.error('❌ Failed to import document:', err);
                        syncMessage.set('นำเข้าล้มเหลว');
                        setTimeout(() => syncMessage.set(''), 3000);
                    });
            } else {
                console.warn('⚠️ No callback or empty document', { 
                    hasCallback: !!onDocumentReceived, 
                    hasDocument: !!msg.document 
                });
            }
            
            lastServerSync.set(new Date());
            break;

        case 'data':
            console.log('Data from', msg.from, ':', msg.data.substring(0, 50) + '...');
            break;

        case 'pong':
            // Server is alive
            break;

        case 'error':
            console.error('Server error:', msg.message);
            syncMessage.set('Error: ' + msg.message);
            break;
    }
}

// Create room on server
export async function createServerRoom(url: string): Promise<string | null> {
    try {
        const response = await fetch(`${url}/api/rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
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
            
            sendMessage({
                action: 'join',
                room_code: data.room_code,
                peer_id: data.host_id,
                is_host: true,
                metadata: { name: 'Host' }
            });

            serverRoomCode.set(data.room_code);
            isServerHost.set(true);
            
            return data.room_code;
        }
        
        return null;
    } catch (error) {
        console.error('Failed to create room:', error);
        syncMessage.set('สร้างห้องไม่สำเร็จ');
        return null;
    }
}

// Join existing room on server
export async function joinServerRoom(url: string, roomCode: string, peerName: string = 'Guest'): Promise<boolean> {
    try {
        // Generate or reuse peer ID
        const peerId = currentPeerId || 'peer_' + Math.random().toString(36).substring(2, 8);
        currentPeerId = peerId;
        currentPeerIdStore.set(peerId);
        
        // Save settings
        saveConnectionSettings(url, roomCode.toUpperCase(), false, peerId);
        
        initServerSync(url);
        
        await waitForConnection();
        
        sendMessage({
            action: 'join',
            room_code: roomCode.toUpperCase(),
            peer_id: peerId,
            is_host: false,
            metadata: { name: peerName }
        });

        serverRoomCode.set(roomCode);
        isServerHost.set(false);
        
        return true;
    } catch (error) {
        console.error('Failed to join room:', error);
        syncMessage.set('เข้าร่วมไม่สำเร็จ');
        return false;
    }
}

// Leave room
export function leaveServerRoom() {
    sendMessage({ action: 'leave' });
    
    if (ws) {
        ws.close();
        ws = null;
    }
    
    // Clear saved settings
    clearConnectionSettings();
    currentPeerId = null;
    currentPeerIdStore.set('');
    
    serverRoomCode.set('');
    isServerHost.set(false);
    serverPeers.set([]);
    serverStatus.set('disconnected');
    syncMessage.set('ออกจากห้องแล้ว');
    
    stopPing();
    stopHealthCheckPing();
    if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
    }
}

// Sync document to server (all peers can sync)
export async function syncDocumentToServer() {
    if (!get(serverRoomCode)) {
        syncMessage.set('ไม่ได้เชื่อมต่อห้อง');
        setTimeout(() => syncMessage.set(''), 2000);
        return;
    }
    
    if (!onSyncRequest) {
        console.error('❌ No sync callback registered');
        syncMessage.set('ไม่ได้ตั้งค่า callback');
        setTimeout(() => syncMessage.set(''), 2000);
        return;
    }
    
    syncMessage.set('กำลังส่งข้อมูล...');
    
    try {
        // Get data from callback (async)
        const documentData = await onSyncRequest();
        
        if (!documentData) {
            syncMessage.set('ไม่มีข้อมูลให้ sync');
            setTimeout(() => syncMessage.set(''), 2000);
            return;
        }
        
        console.log('📤 Sending sync_document, data length:', documentData.length);
        
        sendMessage({
            action: 'sync_document',
            document: documentData
        });
        
        syncMessage.set('ส่งข้อมูลสำเร็จ');
        lastServerSync.set(new Date());
        setTimeout(() => syncMessage.set(''), 2000);
    } catch (error) {
        console.error('❌ Sync failed:', error);
        syncMessage.set('Sync ล้มเหลว');
    }
}

// Request sync from host
export function requestSyncFromServer() {
    syncMessage.set('กำลังขอข้อมูล...');
    
    console.log('📤 Sending request_sync');
    sendMessage({ action: 'request_sync' });
    
    // Clear message after timeout if no response
    setTimeout(() => {
        if (get(syncMessage) === 'กำลังขอข้อมูล...') {
            syncMessage.set('ไม่ได้รับการตอบสนอง');
            setTimeout(() => syncMessage.set(''), 2000);
        }
    }, 5000);
}

// Request merge from server (uses onDocumentMerge callback)
export function requestMergeFromServer(): Promise<{ added: number; updated: number; unchanged: number }> {
    return new Promise((resolve, reject) => {
        if (!get(serverRoomCode)) {
            reject(new Error('ไม่ได้เชื่อมต่อห้อง'));
            return;
        }
        
        if (!onDocumentMerge) {
            reject(new Error('ไม่ได้ตั้งค่า merge callback'));
            return;
        }
        
        syncMessage.set('กำลังขอข้อมูลสำหรับ Merge...');
        
        // Store the resolve function temporarily
        const originalOnDocumentReceived = onDocumentReceived;
        let resolved = false;
        
        // Override temporarily to capture the merge result
        onDocumentReceived = async (data: string) => {
            if (resolved) return; // Prevent double resolve
            resolved = true;
            
            try {
                // Handle empty document (no data on server yet)
                if (!data || data.trim() === '') {
                    console.log('ℹ️ No data on server yet');
                    syncMessage.set('ยังไม่มีข้อมูลบน server');
                    setTimeout(() => syncMessage.set(''), 2000);
                    
                    // Restore original callback
                    onDocumentReceived = originalOnDocumentReceived;
                    
                    resolve({ added: 0, updated: 0, unchanged: 0 });
                    return;
                }
                
                const result = await onDocumentMerge!(data);
                syncMessage.set(`Merge สำเร็จ: +${result.added} ~${result.updated}`);
                setTimeout(() => syncMessage.set(''), 3000);
                
                // Restore original callback
                onDocumentReceived = originalOnDocumentReceived;
                
                resolve(result);
            } catch (error) {
                // Restore original callback
                onDocumentReceived = originalOnDocumentReceived;
                reject(error);
            }
        };
        
        console.log('📤 Sending request_sync for merge');
        sendMessage({ action: 'request_sync' });
        
        // Timeout - increased to 15 seconds
        setTimeout(() => {
            if (!resolved) {
                onDocumentReceived = originalOnDocumentReceived;
                if (get(syncMessage) === 'กำลังขอข้อมูลสำหรับ Merge...') {
                    syncMessage.set('ไม่ได้รับการตอบสนอง');
                    setTimeout(() => syncMessage.set(''), 2000);
                }
                reject(new Error('Timeout'));
            }
        }, 15000);
    });
}

// Helper functions
function sendMessage(msg: any) {
    if (ws?.readyState === WebSocket.OPEN) {
        const json = JSON.stringify(msg);
        console.log('📨 WS Send:', msg.action || msg.type, '- length:', json.length);
        ws.send(json);
        updateLastSeen(); // Update last seen on any message sent
    } else {
        console.warn('⚠️ WebSocket not connected, state:', ws?.readyState);
        syncMessage.set('ไม่ได้เชื่อมต่อ');
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
            reject(new Error('Connection timeout'));
        }, 5000);
    });
}

function scheduleReconnect(url: string) {
    if (reconnectInterval) return;
    
    reconnectInterval = setInterval(() => {
        if (get(serverStatus) === 'disconnected' && get(serverRoomCode)) {
            console.log('Attempting to reconnect...');
            connectToServer(url);
        }
    }, 5000);
}

function startPing() {
    pingInterval = setInterval(() => {
        sendMessage({ action: 'ping' });
    }, 30000);
}

function stopPing() {
    if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
    }
}

// Default server URL for health check
const DEFAULT_SERVER_URL = 'http://localhost:3001';

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
            method: 'GET',
            signal: controller.signal,
            // Prevent caching
            cache: 'no-store'
        }).then(() => {
            clearTimeout(timeoutId);
            console.log('💓 Background health check ping sent to:', url);
        }).catch(() => {
            clearTimeout(timeoutId);
            // Ignore all errors - this is just to wake up the server
        });
    };
    
    // Do immediate first ping (delayed slightly to not block page load)
    setTimeout(doHealthCheck, 2000);
    
    // Then ping every 1 minute
    healthCheckInterval = setInterval(doHealthCheck, 60000);
    
    console.log('💓 Background health check ping started (every 1 minute)');
}

function stopHealthCheckPing() {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
        console.log('💓 Health check ping stopped');
    }
}

// Get server connection info
export function getServerInfo() {
    return {
        url: get(serverUrl),
        status: get(serverStatus),
        roomCode: get(serverRoomCode),
        isHost: get(isServerHost),
        peers: get(serverPeers)
    };
}
