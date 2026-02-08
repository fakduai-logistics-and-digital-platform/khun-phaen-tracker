<script lang="ts">
    import { onMount } from 'svelte';
    import { 
        serverUrl,
        serverStatus,
        serverRoomCode,
        serverPeers,
        lastServerSync,
        syncMessage,
        requestMergeFromServer,
        getServerInfo
    } from '$lib/stores/server-sync';
    import { mergeTasksFromCSV, getTaskStats, exportToCSV } from '$lib/db';
    import { RefreshCw, Users, Database, Clock, ArrowDown, ArrowUp, CheckCircle, AlertCircle } from 'lucide-svelte';
    
    // Props
    export let onDataMerged: (result: { added: number; updated: number; unchanged: number }) => void = () => {};
    
    let showPanel = false;
    let isSyncing = false;
    let lastMergeResult: { added: number; updated: number; unchanged: number } | null = null;
    let localStats = { total: 0, byStatus: {} as Record<string, number>, lastUpdated: null as string | null };
    
    // Update local stats when panel opens
    $: if (showPanel) {
        updateLocalStats();
    }
    
    function updateLocalStats() {
        try {
            localStats = getTaskStats();
        } catch (e) {
            console.error('Failed to get stats:', e);
        }
    }
    
    async function handlePullLatest() {
        if (!$serverRoomCode) {
            alert('ไม่ได้เชื่อมต่อห้อง');
            return;
        }
        
        isSyncing = true;
        syncMessage.set('กำลังดึงข้อมูล...');
        
        try {
            // Request latest data from server with merge
            const result = await requestMergeFromServer();
            lastMergeResult = result;
            
            // Notify parent
            onDataMerged(result);
            
            // Refresh local stats
            updateLocalStats();
            
            syncMessage.set(`Merge สำเร็จ: +${result.added} ~${result.updated}`);
        } catch (e) {
            console.error('Pull failed:', e);
            syncMessage.set('ดึงข้อมูลล้มเหลว');
        } finally {
            isSyncing = false;
            setTimeout(() => syncMessage.set(''), 3000);
        }
    }
    

    
    function formatTime(date: Date | null): string {
        if (!date) return 'ไม่มีข้อมูล';
        return date.toLocaleTimeString('th-TH', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    function formatDate(date: string | null): string {
        if (!date) return 'ไม่ระบุ';
        return new Date(date).toLocaleString('th-TH');
    }
</script>

<div class="relative">
    <!-- Main Sync Button -->
    <button
        on:click={() => showPanel = !showPanel}
        disabled={$serverStatus !== 'connected'}
        class="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors {($serverStatus === 'connected') ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}"
        title={$serverStatus === 'connected' ? 'คลิกเพื่อซิงค์ข้อมูล' : 'ไม่ได้เชื่อมต่อ'}
    >
        <RefreshCw size={18} class={isSyncing ? 'animate-spin' : ''} />
        <span class="hidden sm:inline">Sync</span>
        {#if $serverStatus === 'connected' && $lastServerSync}
            <span class="text-xs opacity-70">
                {formatTime($lastServerSync)}
            </span>
        {/if}
    </button>
    
    <!-- Sync Panel -->
    {#if showPanel}
        <div class="absolute top-full right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 z-50 animate-fade-in">
            <div class="flex items-center justify-between mb-4">
                <h3 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Database size={18} />
                    Sync & Merge
                </h3>
                <button 
                    on:click={() => showPanel = false}
                    class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                    ×
                </button>
            </div>
            
            {#if $syncMessage}
                <div class="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 p-3 rounded-lg mb-4 text-sm flex items-center gap-2 animate-pulse">
                    <RefreshCw size={16} class={isSyncing ? 'animate-spin' : ''} />
                    {$syncMessage}
                </div>
            {/if}
            
            {#if $serverStatus !== 'connected'}
                <div class="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 p-4 rounded-lg mb-4 text-sm">
                    <AlertCircle size={16} class="inline mr-2" />
                    ไม่ได้เชื่อมต่อกับห้อง กรุณาเชื่อมต่อก่อน
                </div>
            {:else}
                <!-- Room Info -->
                <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg mb-4">
                    <div class="flex items-center gap-2 text-green-700 dark:text-green-400 mb-2">
                        <Users size={16} />
                        <span class="font-medium">ห้อง {$serverRoomCode}</span>
                    </div>
                    <p class="text-sm text-green-600 dark:text-green-300">
                        สมาชิก {$serverPeers.length + 1} คน
                    </p>
                    
                    <!-- Peer List -->
                    {#if $serverPeers.length > 0}
                        <div class="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                            <p class="text-xs text-green-600 dark:text-green-400 mb-1">สมาชิกในห้อง:</p>
                            <ul class="space-y-1">
                                <li class="text-xs flex items-center gap-2">
                                    <span class="w-2 h-2 bg-yellow-500 rounded-full"></span>
                                    <span>คุณ ({$serverPeers.length === 0 ? 'Host' : 'Peer'})</span>
                                </li>
                                {#each $serverPeers as peer}
                                    <li class="text-xs flex items-center gap-2 pl-4">
                                        <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                                        <span class="font-mono">{peer.slice(0, 8)}...</span>
                                    </li>
                                {/each}
                            </ul>
                        </div>
                    {/if}
                </div>
                
                <!-- Local Stats -->
                <div class="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg mb-4">
                    <div class="flex items-center gap-2 text-gray-700 dark:text-gray-300 mb-2">
                        <Database size={16} />
                        <span class="font-medium">ข้อมูลในเครื่อง</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div class="bg-white dark:bg-gray-700 p-2 rounded">
                            <span class="text-gray-500 dark:text-gray-400 text-xs">งานทั้งหมด</span>
                            <p class="font-bold text-lg">{localStats.total}</p>
                        </div>
                        <div class="bg-white dark:bg-gray-700 p-2 rounded">
                            <span class="text-gray-500 dark:text-gray-400 text-xs">อัพเดทล่าสุด</span>
                            <p class="font-medium text-xs">{formatDate(localStats.lastUpdated)}</p>
                        </div>
                    </div>
                    {#if localStats.byStatus && Object.keys(localStats.byStatus).length > 0}
                        <div class="mt-2 flex flex-wrap gap-1">
                            {#each Object.entries(localStats.byStatus) as [status, count]}
                                <span class="text-xs px-2 py-1 rounded-full bg-white dark:bg-gray-700">
                                    {status}: {count}
                                </span>
                            {/each}
                        </div>
                    {/if}
                </div>
                
                <!-- Sync Actions -->
                <div class="space-y-2">
                    <button
                        on:click={handlePullLatest}
                        disabled={isSyncing}
                        class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 dark:disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <ArrowDown size={16} class={isSyncing ? 'animate-bounce' : ''} />
                        ดึงข้อมูลล่าสุด (Merge)
                    </button>
                    <p class="text-xs text-gray-500 dark:text-gray-400 text-center">
                        รวมข้อมูลใหม่จากห้องเข้ากับเครื่องคุณ
                    </p>
                    
                    {#if lastMergeResult}
                        <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg mt-2">
                            <div class="flex items-center gap-2 text-green-700 dark:text-green-400 mb-1">
                                <CheckCircle size={16} />
                                <span class="font-medium">ผลการรวมข้อมูล</span>
                            </div>
                            <div class="grid grid-cols-3 gap-2 text-center text-sm">
                                <div class="bg-white dark:bg-green-900/40 p-2 rounded">
                                    <span class="text-green-600 dark:text-green-300 font-bold">{lastMergeResult.added}</span>
                                    <p class="text-xs text-gray-500">เพิ่มใหม่</p>
                                </div>
                                <div class="bg-white dark:bg-green-900/40 p-2 rounded">
                                    <span class="text-blue-600 dark:text-blue-300 font-bold">{lastMergeResult.updated}</span>
                                    <p class="text-xs text-gray-500">อัพเดท</p>
                                </div>
                                <div class="bg-white dark:bg-green-900/40 p-2 rounded">
                                    <span class="text-gray-600 dark:text-gray-300 font-bold">{lastMergeResult.unchanged}</span>
                                    <p class="text-xs text-gray-500">เดิม</p>
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
                
                {#if $lastServerSync}
                    <div class="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 text-center">
                        <p class="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
                            <Clock size={12} />
                            Sync ล่าสุด: {$lastServerSync.toLocaleString('th-TH')}
                        </p>
                    </div>
                {/if}
            {/if}
        </div>
    {/if}
</div>

<style>
    @keyframes fade-in {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in { animation: fade-in 0.2s ease-out; }
</style>
