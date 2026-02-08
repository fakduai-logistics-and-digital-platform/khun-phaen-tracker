import { writable, get } from 'svelte/store';
import { base } from '$app/paths';
import type { Task } from '$lib/types';
import { exportToCSV, importFromCSV } from '$lib/db';

// Auto-import flag
let autoImportEnabled = false;

// Enable auto-import (call this from +page.svelte)
export function enableAutoImport() {
    autoImportEnabled = true;
    console.log('✅ Auto-import enabled');
    
    // Set up default callbacks for auto-import
    if (!onDocumentReceived) {
        onDocumentReceived = async (csvData: string) => {
            console.log('📥 Auto-importing data...');
            try {
                const imported = await importFromCSV(csvData, { clearExisting: true });
                console.log(`✅ Auto-imported ${imported} tasks`);
                
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
            console.log('📤 Auto-exporting data...');
            return await exportToCSV();
        };
    }
}

// Storage keys
const STORAGE_KEY_URL = 'sync-server-url';
const STORAGE_KEY_ROOM = 'sync-room-code';
const STORAGE_KEY_IS_HOST = 'sync-is-host';
const STORAGE_KEY_PEER_ID = 'sync-peer-id';

// Server connection state
export const serverUrl = writable<string>('');
export const serverStatus = writable<'disconnected' | 'connecting' | 'connected'>('disconnected');
export const serverRoomCode = writable<string>('');
export const isServerHost = writable<boolean>(false);
export const serverPeers = writable<string[]>([]);
export const lastServerSync = writable<Date | null>(null);
export const syncMessage = writable<string>('');

// Callbacks for sync operations
let onDocumentReceived: ((data: string) => Promise<void>) | null = null;
let onSyncRequest: (() => Promise<string>) | null = null;
let onDocumentMerge: ((data: string) => Promise<{ added: number; updated: number; unchanged: number }>) | null = null;

let ws: WebSocket | null = null;
let reconnectInterval: ReturnType<typeof setInterval> | null = null;
let pingInterval: ReturnType<typeof setInterval> | null = null;

// Persistent peer ID
let currentPeerId: string | null = null;

// Save connection settings to localStorage
function saveConnectionSettings(url: string, roomCode: string, isHost: boolean, peerId: string) {
    try {
        localStorage.setItem(STORAGE_KEY_URL, url);
        localStorage.setItem(STORAGE_KEY_ROOM, roomCode);
        localStorage.setItem(STORAGE_KEY_IS_HOST, JSON.stringify(isHost));
        localStorage.setItem(STORAGE_KEY_PEER_ID, peerId);
        console.log('💾 Saved sync settings:', { url, roomCode, isHost, peerId: peerId.slice(0, 8) });
    } catch (e) {
        console.error('Failed to save sync settings:', e);
    }
}

// Clear connection settings
function clearConnectionSettings() {
    try {
        localStorage.removeItem(STORAGE_KEY_URL);
        localStorage.removeItem(STORAGE_KEY_ROOM);
        localStorage.removeItem(STORAGE_KEY_IS_HOST);
        localStorage.removeItem(STORAGE_KEY_PEER_ID);
        console.log('🗑️ Cleared sync settings');
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
    const saved = loadSavedConnection();
    if (!saved) {
        console.log('ℹ️ No saved connection found');
        return false;
    }
    
    console.log('🔄 Auto-reconnecting to:', saved.url, 'room:', saved.roomCode);
    
    // Set the saved URL
    serverUrl.set(saved.url);
    currentPeerId = saved.peerId;
    
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
    // Save if already connected
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
            serverPeers.set(msg.peers.map((p: any) => p.id));
            console.log('Room info:', msg.peers.length, 'peers');
            break;

        case 'peer_joined':
            serverPeers.update(peers => [...peers, msg.peer.id]);
            syncMessage.set('มีผู้เข้าร่วม: ' + msg.peer.id.substring(0, 8));
            setTimeout(() => syncMessage.set(''), 3000);
            break;

        case 'peer_left':
            serverPeers.update(peers => peers.filter(p => p !== msg.peer_id));
            syncMessage.set('ผู้เข้าร่วมออก: ' + msg.peer_id.substring(0, 8));
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
    
    serverRoomCode.set('');
    isServerHost.set(false);
    serverPeers.set([]);
    serverStatus.set('disconnected');
    syncMessage.set('ออกจากห้องแล้ว');
    
    stopPing();
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
        
        // Override temporarily to capture the merge result
        onDocumentReceived = async (data: string) => {
            try {
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
        
        // Timeout
        setTimeout(() => {
            onDocumentReceived = originalOnDocumentReceived;
            if (get(syncMessage) === 'กำลังขอข้อมูลสำหรับ Merge...') {
                syncMessage.set('ไม่ได้รับการตอบสนอง');
                setTimeout(() => syncMessage.set(''), 2000);
            }
            reject(new Error('Timeout'));
        }, 10000);
    });
}

// Helper functions
function sendMessage(msg: any) {
    if (ws?.readyState === WebSocket.OPEN) {
        const json = JSON.stringify(msg);
        console.log('📨 WS Send:', msg.action || msg.type, '- length:', json.length);
        ws.send(json);
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
