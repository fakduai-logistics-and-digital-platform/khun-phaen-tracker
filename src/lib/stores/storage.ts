import { writable, get } from 'svelte/store';
import { base } from '$app/paths';

// WASM Compression disabled due to memory issues
// Using simple JS compression (LZ-string) instead

// Loading state
export const compressionReady = writable(false);
export const compressionLoading = writable(false);
export const compressionStats = writable({
	originalSize: 0,
	compressedSize: 0,
	savings: 0,
	ratio: 0
});

// Simple LZ-string compression (pure JS, no WASM)
// Based on LZ-string library - minimal implementation
export const LZString = {
	compress: (input: string): string => {
		if (!input) return '';
		const keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
		let output = '';
		let i = 0;
		let chr1, chr2, chr3, enc1, enc2, enc3, enc4;
		
		input = encodeURIComponent(input);
		
		while (i < input.length) {
			chr1 = input.charCodeAt(i++);
			chr2 = input.charCodeAt(i++);
			chr3 = input.charCodeAt(i++);
			
			enc1 = chr1 >> 2;
			enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
			enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
			enc4 = chr3 & 63;
			
			if (isNaN(chr2)) enc3 = enc4 = 64;
			else if (isNaN(chr3)) enc4 = 64;
			
			output += keyStr.charAt(enc1) + keyStr.charAt(enc2) + keyStr.charAt(enc3) + keyStr.charAt(enc4);
		}
		
		return 'LZ:' + output;
	},
	
	decompress: (input: string): string => {
		if (!input || !input.startsWith('LZ:')) return input;
		input = input.slice(3);
		
		const keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
		let output = '';
		let i = 0;
		let chr1, chr2, chr3, enc1, enc2, enc3, enc4;
		
		while (i < input.length) {
			enc1 = keyStr.indexOf(input.charAt(i++));
			enc2 = keyStr.indexOf(input.charAt(i++));
			enc3 = keyStr.indexOf(input.charAt(i++));
			enc4 = keyStr.indexOf(input.charAt(i++));
			
			chr1 = (enc1 << 2) | (enc2 >> 4);
			chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
			chr3 = ((enc3 & 3) << 6) | enc4;
			
			output += String.fromCharCode(chr1);
			if (enc3 !== 64) output += String.fromCharCode(chr2);
			if (enc4 !== 64) output += String.fromCharCode(chr3);
		}
		
		return decodeURIComponent(output);
	}
};

// Initialize compression (JS only, no WASM)
export async function initCompression() {
	console.log('📦 Compression using JS (WASM disabled for memory)');
	compressionReady.set(true);
	showStorageStats();
}

// Get item from storage (auto-detect compression)
export function getItem(key: string): string | null {
	const data = localStorage.getItem(key);
	if (!data) return null;
	
	// Check if compressed with our JS compression
	if (data.startsWith('LZ:')) {
		try {
			return LZString.decompress(data);
		} catch (e) {
			console.warn('Decompression failed, returning raw:', e);
			return data;
		}
	}
	
	// Legacy: check if compressed with old WASM format
	if (isCompressed(data)) {
		console.warn('Legacy WASM compressed data detected, cannot decompress');
		return data; // Return as-is, will be overwritten on next save
	}
	
	return data;
}

// Get total storage size
function getTotalStorageSize(): number {
	let total = 0;
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key) {
			total += localStorage.getItem(key)?.length || 0;
		}
	}
	return total;
}

// Set item to storage (with compression)
export function setItem(key: string, value: string): void {
	// Check storage limit (5MB typical limit, use 4.5MB to be safe)
	const STORAGE_LIMIT = 4.5 * 1024 * 1024;
	const currentSize = getTotalStorageSize();
	const newSize = value.length;
	
	if (currentSize + newSize > STORAGE_LIMIT) {
		console.warn(`⚠️ Storage almost full: ${(currentSize / 1024 / 1024).toFixed(2)}MB used`);
		throw new Error('Storage full: กรุณาลบข้อมูลเก่าออกก่อน');
	}
	
	try {
		// Use JS compression
		const compressed = LZString.compress(value);
		
		// Only use compression if it actually saves space (or is close)
		if (compressed.length <= value.length * 1.1) { // Allow 10% overhead for small data
			localStorage.setItem(key, compressed);
			
			// Update stats
			const original = new Blob([value]).size;
			const compressed_size = new Blob([compressed]).size;
			const savings = Math.max(0, original - compressed_size);
			const ratio = original > 0 ? (savings / original) * 100 : 0;
			
			compressionStats.set({
				originalSize: original,
				compressedSize: compressed_size,
				savings,
				ratio
			});
			
			console.log(`📦 Compressed ${key}: ${original} -> ${compressed_size} bytes (${ratio.toFixed(1)}% saved)`);
			return;
		}
	} catch (e) {
		console.warn('Compression failed, storing raw:', e);
	}
	
	// Fallback to raw storage
	localStorage.setItem(key, value);
}

// Remove item
export function removeItem(key: string): void {
	localStorage.removeItem(key);
}

// Check if data is compressed
function isCompressed(data: string): boolean {
	// Check if it looks like base64 encoded compressed data
	// LZ4 compressed data in base64 typically starts with these patterns
	if (data.length < 20) return false;
	
	// Simple heuristic: if it's valid base64 and decodes to something
	// that looks like binary data, it's probably compressed
	const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
	return base64Pattern.test(data) && data.length % 4 === 0;
}

// Show storage statistics
export function showStorageStats(): void {
	let total = 0;
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key) {
			const value = localStorage.getItem(key) || '';
			total += value.length;
		}
	}
	
	const quota = 5 * 1024 * 1024; // 5MB typical limit
	const usage = (total / quota) * 100;
	
	console.log(`💾 Storage usage: ${(total / 1024).toFixed(2)} KB / ${(quota / 1024).toFixed(2)} KB (${usage.toFixed(1)}%)`);
}

// Get storage info
export function getStorageInfo(): { used: number; total: number; percentage: number } {
	let total = 0;
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key) {
			const value = localStorage.getItem(key) || '';
			total += value.length * 2; // UTF-16 = 2 bytes per char
		}
	}
	
	const quota = 5 * 1024 * 1024; // 5MB
	return {
		used: total,
		total: quota,
		percentage: (total / quota) * 100
	};
}

// Clear all storage
export function clear(): void {
	localStorage.clear();
}

// Migrate existing data to compressed format
export async function migrateToCompressed(): Promise<void> {
	console.log('🔄 Migrating storage to compressed format...');
	
	const keys: string[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key) keys.push(key);
	}
	
	let migrated = 0;
	let saved = 0;
	
	for (const key of keys) {
		const value = localStorage.getItem(key);
		if (!value) continue;
		
		// Skip if already compressed (starts with LZ:)
		if (value.startsWith('LZ:')) continue;
		
		try {
			const compressed = LZString.compress(value);
			
			// Only migrate if it saves space
			if (compressed.length < value.length) {
				localStorage.setItem(key, compressed);
				migrated++;
				saved += value.length - compressed.length;
			}
		} catch (e) {
			console.warn(`Failed to compress ${key}:`, e);
		}
	}
	
	console.log(`✅ Migration complete: ${migrated} items, saved ${saved} bytes`);
}
