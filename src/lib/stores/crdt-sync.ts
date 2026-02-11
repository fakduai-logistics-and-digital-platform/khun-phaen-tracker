import { writable, get } from 'svelte/store';
import { base } from '$app/paths';
import type { Task } from '$lib/types';
import { browser } from '$app/environment';

// CRDT WASM Module
let wasmModule: any = null;
let crdtDoc: any = null;
let nodeId: string = '';
let isInitializing = false;
let initPromise: Promise<boolean> | null = null;

// Stores
export const crdtReady = writable(false);
export const crdtStatus = writable<'idle' | 'loading' | 'ready' | 'error'>('idle');
export const pendingOperations = writable<number>(0);

const STORAGE_KEY = 'crdt-document-v2';
const NODE_ID_KEY = 'crdt-node-id';

/**
 * Initialize CRDT WASM module
 */
export async function initCRDT(): Promise<boolean> {
    if (!browser) return false;
    
    if (crdtDoc && wasmModule) {
        return true;
    }
    
    if (initPromise) {
        return initPromise;
    }
    
    initPromise = doInit();
    return initPromise;
}

async function doInit(): Promise<boolean> {
    crdtStatus.set('loading');
    
    try {
        console.log('🔄 Initializing CRDT WASM...');
        
        // Load WASM module
        const wasm = await import(`${base}/wasm-crdt/wasm_crdt.js`);
        await wasm.default();
        wasmModule = wasm;
        
        // Generate or load node ID
        const timestamp = Date.now() & 0xFFFFFFFF;
        nodeId = localStorage.getItem(NODE_ID_KEY) || wasm.generate_node_id(timestamp);
        localStorage.setItem(NODE_ID_KEY, nodeId);
        
        // Create CRDT document
        crdtDoc = new wasm.CrdtDocument(nodeId);
        
        // Load existing document if any
        const savedDoc = localStorage.getItem(STORAGE_KEY);
        if (savedDoc) {
            try {
                crdtDoc.import(savedDoc);
                console.log('✅ CRDT document loaded:', crdtDoc.stats());
            } catch (e) {
                console.warn('⚠️ Failed to load existing CRDT doc, starting fresh');
            }
        }
        
        crdtReady.set(true);
        crdtStatus.set('ready');
        updatePendingCount();
        
        console.log('✅ CRDT initialized for node:', nodeId.slice(0, 8));
        return true;
        
    } catch (error) {
        console.error('❌ CRDT init failed:', error);
        crdtStatus.set('error');
        return false;
    }
}

/**
 * Sync a task to CRDT (call this after any task change)
 */
export function syncTaskToCRDT(task: Task): void {
    if (!crdtDoc || !task.id) return;
    
    try {
        // Sync all task fields
        crdtDoc.upsert_field(task.id, 'title', task.title);
        crdtDoc.upsert_field(task.id, 'project', task.project || '');
        crdtDoc.upsert_field(task.id, 'category', task.category);
        crdtDoc.upsert_field(task.id, 'status', task.status);
        crdtDoc.upsert_field(task.id, 'notes', task.notes || '');
        crdtDoc.upsert_field(task.id, 'date', task.date);
        crdtDoc.upsert_field(task.id, 'assignee', task.assignee?.name || '');
        crdtDoc.upsert_field(task.id, 'sprint_id', String(task.sprint_id || ''));
        crdtDoc.upsert_field(task.id, 'is_archived', String(task.is_archived ? 1 : 0));
        
        saveCRDTDocument();
        updatePendingCount();
        
    } catch (error) {
        console.error('❌ Failed to sync task to CRDT:', error);
    }
}

/**
 * Delete task from CRDT
 */
export function deleteTaskFromCRDT(taskId: number): void {
    if (!crdtDoc) return;
    
    try {
        crdtDoc.delete_task(taskId);
        saveCRDTDocument();
        updatePendingCount();
        
    } catch (error) {
        console.error('❌ Failed to delete task from CRDT:', error);
    }
}

/**
 * Sync multiple tasks to CRDT (bulk sync)
 */
export function syncTasksToCRDT(tasks: Task[]): void {
    if (!crdtDoc) return;
    
    console.log(`🔄 Syncing ${tasks.length} tasks to CRDT...`);
    
    for (const task of tasks) {
        if (task.id) {
            syncTaskToCRDT(task);
        }
    }
    
    saveCRDTDocument();
    updatePendingCount();
    console.log('✅ Bulk sync complete');
}

/**
 * Get CRDT document for syncing (call this when sending to server)
 */
export function exportCRDTDocument(): string {
    if (!crdtDoc) return '';
    
    try {
        return crdtDoc.export();
    } catch (error) {
        console.error('❌ Failed to export CRDT:', error);
        return '';
    }
}

/**
 * Merge remote CRDT document (call this when receiving from server)
 */
export function mergeCRDTDocument(remoteDoc: string): { added: number; updated: number; unchanged: number } {
    if (!crdtDoc || !remoteDoc) {
        return { added: 0, updated: 0, unchanged: 0 };
    }
    
    try {
        // Get current tasks before merge
        const beforeTasks = getCRDTTasks();
        const beforeMap = new Map(beforeTasks.map(t => [t.id, t]));
        
        // Merge
        crdtDoc.merge(remoteDoc);
        saveCRDTDocument();
        
        // Get tasks after merge
        const afterTasks = getCRDTTasks();
        
        // Calculate changes
        let added = 0;
        let updated = 0;
        let unchanged = 0;
        
        for (const task of afterTasks) {
            const before = beforeMap.get(task.id);
            if (!before) {
                added++;
            } else if (JSON.stringify(before) !== JSON.stringify(task)) {
                updated++;
            } else {
                unchanged++;
            }
        }
        
        updatePendingCount();
        
        console.log(`✅ CRDT merge: +${added} ~${updated} =${unchanged}`);
        return { added, updated, unchanged };
        
    } catch (error) {
        console.error('❌ Failed to merge CRDT:', error);
        return { added: 0, updated: 0, unchanged: 0 };
    }
}

/**
 * Get all tasks from CRDT
 */
export function getCRDTTasks(): Task[] {
    if (!crdtDoc) return [];
    
    try {
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
            sprint_id: t.fields.sprint_id?.value ? parseInt(t.fields.sprint_id.value) : null,
            is_archived: t.fields.is_archived?.value === '1',
        }));
    } catch (error) {
        console.error('❌ Failed to get CRDT tasks:', error);
        return [];
    }
}

/**
 * Get pending operations count
 */
function updatePendingCount(): void {
    if (!crdtDoc) return;
    
    try {
        const stats = crdtDoc.stats();
        pendingOperations.set(stats.pending_operations || 0);
    } catch (error) {
        pendingOperations.set(0);
    }
}

/**
 * Save CRDT document to localStorage
 */
function saveCRDTDocument(): void {
    if (!crdtDoc || !browser) return;
    
    try {
        const doc = crdtDoc.export();
        localStorage.setItem(STORAGE_KEY, doc);
    } catch (error) {
        console.error('❌ Failed to save CRDT document:', error);
    }
}

/**
 * Get CRDT stats
 */
export function getCRDTStats(): any {
    if (!crdtDoc) return null;
    
    try {
        return crdtDoc.stats();
    } catch (error) {
        return null;
    }
}

/**
 * Get sync code for peer connection
 */
export function getCRDTSyncCode(): string {
    if (!crdtDoc) return '';
    
    try {
        return crdtDoc.get_sync_code();
    } catch (error) {
        return nodeId.slice(0, 6).toUpperCase();
    }
}

/**
 * Clear CRDT operations after successful sync
 */
export function clearCRDTOperations(): void {
    if (!crdtDoc) return;
    
    try {
        crdtDoc.clear_operations();
        saveCRDTDocument();
        updatePendingCount();
    } catch (error) {
        console.error('❌ Failed to clear CRDT operations:', error);
    }
}

/**
 * Reset CRDT (use with caution!)
 */
export function resetCRDT(): void {
    if (!browser) return;
    
    try {
        localStorage.removeItem(STORAGE_KEY);
        if (wasmModule && nodeId) {
            crdtDoc = new wasmModule.CrdtDocument(nodeId);
        }
        updatePendingCount();
        console.log('🔄 CRDT reset complete');
    } catch (error) {
        console.error('❌ Failed to reset CRDT:', error);
    }
}

// Initialize on module load if in browser
if (browser) {
    initCRDT();
}
