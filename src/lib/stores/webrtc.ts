import { writable, get } from 'svelte/store';

// Simple Signaling Server using BroadcastChannel (same browser) or localStorage (cross-tab)
const SIGNAL_CHANNEL = 'khu-phaen-sync';

export const webrtcStatus = writable<'idle' | 'connecting' | 'connected' | 'host'>('idle');
export const myPeerId = writable<string>('');
export const hostPeerId = writable<string>('');
export const connectedPeersList = writable<string[]>([]);

// Store for incoming sync data (for sync.ts to subscribe)
export const incomingSyncData = writable<{ type: string; document?: string; sprints?: any[] } | null>(null);

let bc: BroadcastChannel | null = null;
let currentRoomCode: string = '';
let isHostPeer: boolean = false;

// Initialize signaling
export function initSignaling() {
    if (typeof window === 'undefined') return;
    
    try {
        bc = new BroadcastChannel(SIGNAL_CHANNEL);
        
        bc.onmessage = (event) => {
            const data = event.data;
            handleSignalMessage(data);
        };
        
        console.log('✅ Signaling initialized');
    } catch (e) {
        console.error('BroadcastChannel not supported:', e);
    }
}

function handleSignalMessage(data: any) {
    if (!data || data.roomCode !== currentRoomCode) return;
    
    switch (data.type) {
        case 'join-request':
            if (isHostPeer) {
                // Host received join request
                console.log('📥 Join request from:', data.peerId);
                connectedPeersList.update(list => [...list, data.peerId]);
                
                // Send acknowledgment
                broadcast({
                    type: 'join-ack',
                    roomCode: currentRoomCode,
                    peerId: get(myPeerId),
                    targetPeer: data.peerId,
                    peers: get(connectedPeersList)
                });
            }
            break;
            
        case 'join-ack':
            if (!isHostPeer && data.targetPeer === get(myPeerId)) {
                // Peer received acknowledgment from host
                console.log('✅ Joined room:', data.roomCode);
                hostPeerId.set(data.peerId);
                connectedPeersList.set([data.peerId, ...data.peers.filter((p: string) => p !== get(myPeerId))]);
                webrtcStatus.set('connected');
            }
            break;
            
        case 'peer-list':
            if (isHostPeer) {
                connectedPeersList.set(data.peers);
            }
            break;
            
        case 'sync-data':
            // Handle incoming sync data
            console.log('📦 Received sync data from:', data.peerId);
            // Pass to sync.ts via store
            if (data.data) {
                incomingSyncData.set(data.data);
            }
            break;
    }
}

function broadcast(data: any) {
    if (bc) {
        bc.postMessage(data);
    }
}

// Create room as host
export function createRoom(): string {
    const roomCode = generateRoomCode();
    currentRoomCode = roomCode;
    isHostPeer = true;
    
    const peerId = 'host_' + roomCode;
    myPeerId.set(peerId);
    hostPeerId.set(peerId);
    connectedPeersList.set([]);
    webrtcStatus.set('host');
    
    console.log('🏠 Created room:', roomCode);
    return roomCode;
}

// Join existing room
export function joinRoom(roomCode: string): Promise<boolean> {
    return new Promise((resolve) => {
        currentRoomCode = roomCode.toUpperCase();
        isHostPeer = false;
        
        const peerId = 'peer_' + generateRandomId();
        myPeerId.set(peerId);
        
        webrtcStatus.set('connecting');
        
        // Send join request
        broadcast({
            type: 'join-request',
            roomCode: currentRoomCode,
            peerId: peerId,
            timestamp: Date.now()
        });
        
        // Wait for acknowledgment
        setTimeout(() => {
            const status = get(webrtcStatus);
            if (status !== 'connected') {
                webrtcStatus.set('idle');
                resolve(false);
            } else {
                resolve(true);
            }
        }, 2000);
    });
}

// Leave room
export function leaveRoom() {
    if (isHostPeer) {
        broadcast({
            type: 'host-left',
            roomCode: currentRoomCode
        });
    }
    
    currentRoomCode = '';
    isHostPeer = false;
    webrtcStatus.set('idle');
    connectedPeersList.set([]);
    hostPeerId.set('');
}

// Send data to all peers
export function broadcastData(data: any) {
    broadcast({
        type: 'sync-data',
        roomCode: currentRoomCode,
        peerId: get(myPeerId),
        data: data,
        timestamp: Date.now()
    });
}

// Generate 6-character room code
function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function generateRandomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Get current room info
export function getRoomInfo() {
    return {
        roomCode: currentRoomCode,
        isHost: isHostPeer,
        myId: get(myPeerId),
        hostId: get(hostPeerId),
        peers: get(connectedPeersList)
    };
}
