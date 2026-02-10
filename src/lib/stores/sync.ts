import { writable, get } from 'svelte/store';
import { base } from '$app/paths';
import type { Task } from '$lib/types';
import { 
    webrtcStatus, 
    myPeerId, 
    hostPeerId,
    connectedPeersList,
    incomingSyncData,
    initSignaling,
    createRoom as createWebRTCRoom,
    joinRoom as joinWebRTCRoom,
    leaveRoom as leaveWebRTCRoom,
    broadcastData,
    getRoomInfo
} from './webrtc';

// Re-export for compatibility
export const syncStatus = webrtcStatus;
export const syncCode = writable<string>('');
export const isHost = writable<boolean>(false);
export const connectedPeers = connectedPeersList;
export const lastSyncTime = writable<Date | null>(null);
export const pendingChanges = writable<number>(0);
export const syncError = writable<string | null>(null);

// CRDT Document instance
let crdtDoc: any = null;
let wasmModule: any = null;
let nodeId: string = '';

// Initialize CRDT and Signaling
export async function initCrdt() {
    try {
        const wasm = await import(`${base}/wasm-crdt/wasm_crdt.js`);
        await wasm.default();
        wasmModule = wasm;
        
        // Initialize signaling
        initSignaling();
        
        // Generate or load node ID
        const timestamp = Date.now() & 0xFFFFFFFF;
        nodeId = localStorage.getItem('sync-node-id') || wasm.generate_node_id(timestamp);
        localStorage.setItem('sync-node-id', nodeId);
        
        crdtDoc = new wasm.CrdtDocument(nodeId);
        
        // Load existing document if any
        const savedDoc = localStorage.getItem('crdt-document');
        if (savedDoc) {
            crdtDoc.import(savedDoc);
        }
        
        // Subscribe to incoming sync data
        incomingSyncData.subscribe(handleIncomingSyncData);
        
        console.log('✅ CRDT initialized for node:', nodeId);
        
        return true;
    } catch (error) {
        console.error('❌ CRDT init failed:', error);
        syncError.set('ไม่สามารถโหลด CRDT ได้');
        return false;
    }
}

// Handle incoming sync data from peers
function handleIncomingSyncData(data: { type: string; document?: string; sprints?: any[] } | null) {
    if (!data || !crdtDoc) return;
    
    if (data.type === 'full-sync' && data.document) {
        try {
            // Merge CRDT document
            crdtDoc.merge(data.document);
            saveDocument();
            
            // Import sprints if included
            if (data.sprints && Array.isArray(data.sprints) && typeof window !== 'undefined') {
                try {
                    const existingData = localStorage.getItem('sprints-data-v1');
                    let existingSprints: any[] = [];
                    if (existingData) {
                        existingSprints = JSON.parse(existingData);
                    }
                    
                    // Merge sprints, avoid duplicates by id
                    const sprintMap = new Map(existingSprints.map(s => [s.id, s]));
                    for (const sprint of data.sprints) {
                        if (!sprintMap.has(sprint.id)) {
                            sprintMap.set(sprint.id, sprint);
                        } else {
                            // Use newer data based on created_at or id
                            const existing = sprintMap.get(sprint.id);
                            if (sprint.updated_at && existing.updated_at) {
                                if (new Date(sprint.updated_at) > new Date(existing.updated_at)) {
                                    sprintMap.set(sprint.id, sprint);
                                }
                            }
                        }
                    }
                    
                    localStorage.setItem('sprints-data-v1', JSON.stringify(Array.from(sprintMap.values())));
                    console.log(`✅ Synced ${data.sprints.length} sprints from peer`);
                } catch (e) {
                    console.warn('Failed to sync sprints:', e);
                }
            }
            
            lastSyncTime.set(new Date());
            pendingChanges.set(0);
            console.log('✅ Full sync completed from peer');
        } catch (error) {
            console.error('Failed to handle full-sync:', error);
            syncError.set('Sync ล้มเหลว');
        }
    }
}

// Create sync room (as host)
export async function createSyncRoom(): Promise<string> {
    const roomCode = createWebRTCRoom();
    syncCode.set(roomCode);
    isHost.set(true);
    syncStatus.set('host');
    
    console.log('🏠 Created sync room:', roomCode);
    return roomCode;
}

// Join sync room (as peer)
export async function joinSyncRoom(code: string): Promise<boolean> {
    syncStatus.set('connecting');
    syncError.set(null);
    
    const success = await joinWebRTCRoom(code);
    
    if (success) {
        syncCode.set(code);
        isHost.set(false);
        syncStatus.set('connected');
        
        // Request sync from host
        requestSyncFromHost();
        
        return true;
    } else {
        syncStatus.set('idle');
        syncError.set('ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบรหัสห้อง');
        return false;
    }
}

// Leave sync room
export function leaveSyncRoom() {
    leaveWebRTCRoom();
    syncCode.set('');
    isHost.set(false);
    syncStatus.set('idle');
    syncError.set(null);
}

// Request sync data from host
function requestSyncFromHost() {
    // In real implementation, this would request full document state
    console.log('📥 Requesting sync from host...');
}

// Export data for sharing
export function exportSyncData(): string {
    if (!crdtDoc) return '';
    
    // Get sprints from localStorage
    let sprints: any[] = [];
    if (typeof window !== 'undefined') {
        try {
            const saved = localStorage.getItem('sprints-data-v1');
            if (saved) {
                sprints = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Failed to load sprints for sync export:', e);
        }
    }
    
    const data = {
        node_id: nodeId,
        sync_code: get(syncCode),
        document: crdtDoc.export(),
        sprints: sprints,
        timestamp: Date.now(),
    };
    
    return btoa(JSON.stringify(data));
}

// Import data from sync
export function importSyncData(encodedData: string): boolean {
    try {
        const data = JSON.parse(atob(encodedData));
        
        if (crdtDoc && data.document) {
            crdtDoc.merge(data.document);
            saveDocument();
            
            // Import sprints if included
            if (data.sprints && Array.isArray(data.sprints) && typeof window !== 'undefined') {
                try {
                    const existingData = localStorage.getItem('sprints-data-v1');
                    let existingSprints: any[] = [];
                    if (existingData) {
                        existingSprints = JSON.parse(existingData);
                    }
                    
                    // Merge sprints, avoid duplicates by id
                    const sprintMap = new Map(existingSprints.map(s => [s.id, s]));
                    for (const sprint of data.sprints) {
                        if (!sprintMap.has(sprint.id)) {
                            sprintMap.set(sprint.id, sprint);
                        } else {
                            // Use newer data based on created_at or id
                            const existing = sprintMap.get(sprint.id);
                            if (sprint.updated_at && existing.updated_at) {
                                if (new Date(sprint.updated_at) > new Date(existing.updated_at)) {
                                    sprintMap.set(sprint.id, sprint);
                                }
                            }
                        }
                    }
                    
                    localStorage.setItem('sprints-data-v1', JSON.stringify(Array.from(sprintMap.values())));
                    console.log(`✅ Imported ${data.sprints.length} sprints from sync`);
                } catch (e) {
                    console.warn('Failed to import sprints from sync:', e);
                }
            }
            
            lastSyncTime.set(new Date());
            pendingChanges.set(0);
            
            console.log('✅ Sync data imported from:', data.node_id);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Import failed:', error);
        syncError.set('ไม่สามารถนำเข้าข้อมูลได้');
        return false;
    }
}

// Generate shareable link
export function generateShareLink(): string {
    const data = exportSyncData();
    return `${window.location.origin}${window.location.pathname}?sync=${data}`;
}

// Perform manual sync
export async function performSync(): Promise<boolean> {
    const status = get(syncStatus);
    if (status !== 'connected' && status !== 'host') return false;
    
    syncStatus.set('connecting');
    
    try {
        // Get sprints from localStorage
        let sprints: any[] = [];
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('sprints-data-v1');
                if (saved) {
                    sprints = JSON.parse(saved);
                }
            } catch (e) {
                console.warn('Failed to load sprints for sync:', e);
            }
        }
        
        // Broadcast document to all peers
        if (crdtDoc) {
            broadcastData({
                type: 'full-sync',
                document: crdtDoc.export(),
                sprints: sprints
            });
        }
        
        lastSyncTime.set(new Date());
        pendingChanges.set(0);
        syncStatus.set(get(isHost) ? 'host' : 'connected');
        
        return true;
    } catch (error) {
        syncStatus.set('error');
        syncError.set('Sync ล้มเหลว');
        return false;
    }
}

// Convert Task to CRDT format
export function syncTask(task: Task) {
    if (!crdtDoc) return;
    
    crdtDoc.upsert_field(task.id!, 'title', task.title);
    crdtDoc.upsert_field(task.id!, 'project', task.project || '');
    crdtDoc.upsert_field(task.id!, 'category', task.category);
    crdtDoc.upsert_field(task.id!, 'status', task.status);
    crdtDoc.upsert_field(task.id!, 'notes', task.notes || '');
    crdtDoc.upsert_field(task.id!, 'date', task.date);
    crdtDoc.upsert_field(task.id!, 'assignee', task.assignee?.name || '');
    
    saveDocument();
    incrementPendingChanges();
}

// Delete task in CRDT
export function syncDeleteTask(taskId: number) {
    if (!crdtDoc) return;
    
    crdtDoc.delete_task(taskId);
    saveDocument();
    incrementPendingChanges();
}

// Save document to localStorage
function saveDocument() {
    if (!crdtDoc) return;
    localStorage.setItem('crdt-document', crdtDoc.export());
}

// Increment pending changes
function incrementPendingChanges() {
    pendingChanges.update(n => n + 1);
}

// Get all tasks from CRDT
export function getCrdtTasks(): Task[] {
    if (!crdtDoc) return [];
    
    const tasks = crdtDoc.get_tasks();
    return tasks.map((t: any) => ({
        id: t.id,
        title: t.fields.title?.value || '',
        project: t.fields.project?.value || '',
        category: t.fields.category?.value || 'งานหลัก',
        status: t.fields.status?.value || 'todo',
        notes: t.fields.notes?.value || '',
        date: t.fields.date?.value || new Date().toISOString().split('T')[0],
        duration_minutes: 0,
        assignee: t.fields.assignee?.value ? {
            name: t.fields.assignee.value,
            color: '#6366F1'
        } : null,
        assignee_id: null,
    }));
}

// Get sync statistics
export function getSyncStats() {
    if (!crdtDoc) return null;
    return crdtDoc.stats();
}
