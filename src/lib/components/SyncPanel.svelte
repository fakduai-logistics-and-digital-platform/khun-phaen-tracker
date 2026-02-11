<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { 
        syncStatus, 
        syncCode, 
        isHost, 
        connectedPeers, 
        lastSyncTime, 
        pendingChanges,
        syncError,
        initCrdt,
        createSyncRoom,
        joinSyncRoom,
        leaveSyncRoom,
        generateShareLink,
        performSync,
        exportSyncData,
        importSyncData
    } from '$lib/stores/sync';
    import { Wifi, WifiOff, Users, Copy, QrCode, RefreshCw, Share2, LogOut, AlertCircle, CheckCircle2, Crown, User } from 'lucide-svelte';
    
    let showPanel = false;
    let panelRef: HTMLDivElement;
    let joinCode = '';
    let shareData = '';
    let copied = false;
    
    onMount(() => {
        initCrdt();
    });
    
    function copyCode() {
        navigator.clipboard.writeText($syncCode);
        copied = true;
        setTimeout(() => copied = false, 2000);
    }
    
    function copyLink() {
        navigator.clipboard.writeText(generateShareLink());
        copied = true;
        setTimeout(() => copied = false, 2000);
    }
    
    async function handleJoin() {
        if (joinCode.length === 6) {
            await joinSyncRoom(joinCode.toUpperCase());
        }
    }
    
    function handleImport() {
        if (shareData.trim()) {
            importSyncData(shareData.trim());
            shareData = '';
        }
    }
    
    function getStatusIcon() {
        switch ($syncStatus) {
            case 'connected': return CheckCircle2;
            case 'connecting': return RefreshCw;
            case 'syncing': return RefreshCw;
            case 'error': return AlertCircle;
            default: return WifiOff;
        }
    }
    
    function getStatusColor() {
        switch ($syncStatus) {
            case 'connected': return 'text-green-500';
            case 'connecting': return 'text-yellow-500';
            case 'syncing': return 'text-blue-500';
            case 'error': return 'text-red-500';
            default: return 'text-gray-400';
        }
    }
    
    function getStatusText() {
        switch ($syncStatus) {
            case 'connected': return 'เชื่อมต่อแล้ว';
            case 'connecting': return 'กำลังเชื่อมต่อ...';
            case 'syncing': return 'กำลังซิงค์...';
            case 'error': return 'ผิดพลาด';
            default: return 'ไม่เชื่อมต่อ';
        }
    }

    function togglePanel() {
        showPanel = !showPanel;
    }

    function handleClickOutside(event: MouseEvent) {
        if (panelRef && !panelRef.contains(event.target as Node)) {
            showPanel = false;
        }
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            showPanel = false;
        }
    }
</script>

<svelte:window on:click={handleClickOutside} on:keydown={handleKeyDown} />

<div class="relative" bind:this={panelRef}>
    <!-- Sync Button -->
    <button
        on:click={togglePanel}
        class="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors {($syncStatus === 'connected') ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}"
    >
        <svelte:component this={getStatusIcon()} size={18} class={getStatusColor()} />
        <span class="hidden sm:inline">{getStatusText()}</span>
        {#if $pendingChanges > 0}
            <span class="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{$pendingChanges}</span>
        {/if}
    </button>
    
    <!-- Sync Panel -->
    {#if showPanel}
        <div class="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 z-50 animate-fade-in">
            <div class="flex items-center justify-between mb-4">
                <h3 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Wifi size={18} />
                    ซิงค์ข้อมูล (P2P)
                </h3>
                <button 
                    on:click={() => showPanel = false}
                    class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                    ×
                </button>
            </div>
            
            {#if $syncError}
                <div class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
                    <AlertCircle size={16} />
                    {$syncError}
                </div>
            {/if}
            
            <!-- Not Connected State -->
            {#if $syncStatus === 'idle'}
                <div class="space-y-4">
                    <!-- Create Room -->
                    <div class="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                        <h4 class="font-medium text-gray-900 dark:text-white mb-2">สร้างห้องซิงค์</h4>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
                            เป็นผู้ดูแลหลัก คนอื่นสามารถเข้าร่วมด้วยรหัส
                        </p>
                        <button
                            on:click={() => createSyncRoom()}
                            class="w-full py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Wifi size={16} />
                            สร้างห้อง
                        </button>
                    </div>
                    
                    <!-- Join Room -->
                    <div class="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                        <h4 class="font-medium text-gray-900 dark:text-white mb-2">เข้าร่วมห้อง</h4>
                        <div class="flex gap-2">
                            <input
                                type="text"
                                bind:value={joinCode}
                                placeholder="รหัส 6 ตัว"
                                maxlength="6"
                                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none uppercase text-center tracking-widest dark:bg-gray-700 dark:text-white"
                            />
                            <button
                                on:click={handleJoin}
                                disabled={joinCode.length !== 6}
                                class="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                            >
                                เข้าร่วม
                            </button>
                        </div>
                    </div>
                    
                    <!-- Import Data -->
                    <div class="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                        <h4 class="font-medium text-gray-900 dark:text-white mb-2">นำเข้าข้อมูล</h4>
                        <textarea
                            bind:value={shareData}
                            placeholder="วางข้อมูลที่ได้รับ..."
                            rows="3"
                            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none text-xs dark:bg-gray-700 dark:text-white"
                        ></textarea>
                        <button
                            on:click={handleImport}
                            disabled={!shareData.trim()}
                            class="w-full mt-2 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors text-sm"
                        >
                            นำเข้า
                        </button>
                    </div>
                </div>
            {:else}
                <!-- Connected State -->
                <div class="space-y-4">
                    <!-- Room Code Display -->
                    <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                        {#if $isHost}
                            <p class="text-sm text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
                                🏠 คุณเป็นเจ้าของห้อง (Host)
                            </p>
                        {:else}
                            <p class="text-sm text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
                                🔗 เชื่อมต่อกับห้อง
                            </p>
                        {/if}
                        <div class="flex items-center gap-2">
                            <code class="flex-1 text-2xl font-mono font-bold text-green-800 dark:text-green-300 tracking-widest text-center bg-white dark:bg-green-900/40 py-2 rounded">
                                {$syncCode}
                            </code>
                            <button
                                on:click={copyCode}
                                class="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-lg transition-colors"
                                title="คัดลอกรหัส"
                            >
                                <Copy size={20} />
                            </button>
                        </div>
                        {#if copied}
                            <p class="text-xs text-green-600 mt-1 text-center">คัดลอกแล้ว!</p>
                        {/if}
                        {#if !$isHost}
                            <p class="text-xs text-green-600 mt-1 text-center flex items-center justify-center gap-1">
                                <CheckCircle2 size={12} />
                                เชื่อมต่อสำเร็จ
                            </p>
                        {/if}
                    </div>
                    
                    <!-- Share Link -->
                    <div class="flex gap-2">
                        <button
                            on:click={copyLink}
                            class="flex-1 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Share2 size={16} />
                            คัดลอกลิงก์
                        </button>
                        <button
                            on:click={() => exportSyncData()}
                            class="flex-1 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <QrCode size={16} />
                            ส่งออก
                        </button>
                    </div>
                    
                    <!-- Connected Peers -->
                    <div class="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                        <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                            <Users size={16} />
                            <span>ผู้เชื่อมต่อ ({$connectedPeers.length + ($isHost ? 0 : 1)})</span>
                        </div>
                        
                        {#if $isHost}
                            <!-- Host View: Show connected peers -->
                            {#if $connectedPeers.length > 0}
                                <ul class="space-y-1">
                                    <li class="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                        <Crown size={14} class="text-yellow-500" />
                                        <span class="font-medium">คุณ (Host)</span>
                                    </li>
                                    {#each $connectedPeers as peer}
                                        <li class="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2 pl-5">
                                            <User size={14} class="text-green-500" />
                                            {peer}
                                        </li>
                                    {/each}
                                </ul>
                            {:else}
                                <ul class="space-y-1">
                                    <li class="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                        <Crown size={14} class="text-yellow-500" />
                                        <span class="font-medium">คุณ (Host)</span>
                                    </li>
                                </ul>
                                <p class="text-sm text-gray-400 italic mt-2 text-center">
                                    รอผู้เข้าร่วม...
                                </p>
                            {/if}
                        {:else}
                            <!-- Peer View: Show host and other peers -->
                            <ul class="space-y-1">
                                <li class="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <Crown size={14} class="text-yellow-500" />
                                    <span class="font-medium">Host</span>
                                </li>
                                <li class="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2 pl-5">
                                    <User size={14} class="text-blue-500" />
                                    <span>คุณ</span>
                                </li>
                                {#each $connectedPeers.filter(p => !p.includes('host_')) as peer}
                                    <li class="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2 pl-5">
                                        <User size={14} class="text-green-500" />
                                        {peer}
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                    </div>
                    
                    <!-- Last Sync -->
                    {#if $lastSyncTime}
                        <p class="text-xs text-gray-500 dark:text-gray-400 text-center">
                            ซิงค์ล่าสุด: {$lastSyncTime.toLocaleTimeString('th-TH')}
                        </p>
                    {/if}
                    
                    <!-- Actions -->
                    <div class="flex gap-2">
                        <button
                            on:click={() => performSync()}
                            disabled={$syncStatus === 'syncing'}
                            class="flex-1 py-2 bg-primary hover:bg-primary-dark disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={16} class={$syncStatus === 'syncing' ? 'animate-spin' : ''} />
                            {$syncStatus === 'syncing' ? 'กำลังซิงค์...' : 'ซิงค์ตอนนี้'}
                        </button>
                        <button
                            on:click={() => leaveSyncRoom()}
                            class="px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg font-medium transition-colors"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            {/if}
            
            <!-- Info -->
            <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p class="text-xs text-gray-400 text-center">
                    🔒 ข้อมูลถูกส่งตรงระหว่างอุปกรณ์ (Peer-to-Peer)
                </p>
            </div>
        </div>
    {/if}
</div>

<style>
    @keyframes fade-in {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .animate-fade-in {
        animation: fade-in 0.2s ease-out;
    }
    
</style>
