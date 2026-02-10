<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import { 
        serverUrl,
        serverStatus,
        serverRoomCode,
        isServerHost,
        serverPeers,
        lastServerSync,
        syncMessage,
        createServerRoom,
        joinServerRoom,
        leaveServerRoom,
        syncDocumentToServer,
        requestSyncFromServer,
        getServerInfo,
        setSyncCallbacks,
        loadSavedConnection,
        autoReconnect,
        updateServerUrl
    } from '$lib/stores/server-sync';
    import { exportAllData, importAllData, getTasks } from '$lib/db';
    import { Server, Link, LogOut, Users, RefreshCw, Copy, CheckCircle2, AlertCircle, Globe, Save, Edit2 } from 'lucide-svelte';
    
    const dispatch = createEventDispatcher<{
        dataImported: { count: number };
        error: { message: string };
    }>();
    
    // Set up sync callbacks
    setSyncCallbacks(
        // On receive document from server
        async (csvData: string) => {
            console.log('📥 Importing data from server...', csvData.substring(0, 100) + '...');
            try {
                const result = await importAllData(csvData, { clearExisting: true, useExistingIds: true });
                console.log(`✅ Imported ${result.tasks} tasks, ${result.projects} projects, ${result.assignees} assignees, ${result.sprints} sprints from server`);
                
                // Notify parent to reload data instead of page reload
                dispatch('dataImported', { count: result.tasks + result.projects + result.assignees + result.sprints });
                
                // Small delay to allow UI to update
                setTimeout(() => {
                    syncMessage.set(`นำเข้าสำเร็จ ${result.tasks} งาน, ${result.projects} โปรเจค, ${result.assignees} ผู้รับผิดชอบ, ${result.sprints} sprint`);
                    setTimeout(() => syncMessage.set(''), 3000);
                }, 100);
            } catch (e) {
                console.error('❌ Failed to import:', e);
                const errorMsg = e instanceof Error ? e.message : 'Import failed';
                syncMessage.set('นำเข้าล้มเหลว: ' + errorMsg);
                setTimeout(() => syncMessage.set(''), 5000);
                dispatch('error', { message: errorMsg });
            }
        },
        // On request document to send
        async () => {
            console.log('📤 Exporting data to server...');
            try {
                const csv = await exportAllData();
                console.log(`📄 Exported data with ${csv.split('\n').length} lines`);
                return csv;
            } catch (e) {
                console.error('❌ Failed to export:', e);
                return '';
            }
        }
    );
    
    let showPanel = false;
    let hostUrl = 'http://localhost:3001';
    let joinRoomCode = '';
    let peerName = '';
    let copied = false;
    let error: string | null = null;
    let isEditingUrl = false;
    let editedUrl = '';
    
    // Load saved peer name
    function loadSavedPeerName() {
        try {
            const saved = localStorage.getItem('sync-peer-name');
            if (saved) {
                peerName = saved;
            } else {
                // Default to a random friendly name
                peerName = 'ผู้ใช้ ' + Math.floor(Math.random() * 1000);
            }
        } catch (e) {
            peerName = 'ผู้ใช้ ' + Math.floor(Math.random() * 1000);
        }
    }
    
    // Save peer name
    function savePeerName(name: string) {
        try {
            localStorage.setItem('sync-peer-name', name);
        } catch (e) {
            console.error('Failed to save peer name:', e);
        }
    }
    
    // Function to load saved URL
    function loadSavedUrl() {
        try {
            const savedUrl = localStorage.getItem('sync-server-url');
            if (savedUrl) {
                hostUrl = savedUrl;
                console.log('📂 Loaded saved URL:', hostUrl);
            }
        } catch (e) {
            console.error('Failed to load URL:', e);
        }
    }
    
    // Load saved URL on mount
    onMount(() => {
        // Load peer name
        loadSavedPeerName();
        
        // Check for URL params (shared link) first
        const urlParams = new URLSearchParams(window.location.search);
        const sharedServer = urlParams.get('sync_server');
        const sharedRoom = urlParams.get('room');
        
        if (sharedServer) {
            hostUrl = sharedServer;
            console.log('🔗 Using shared server URL:', hostUrl);
        } else {
            // Otherwise load from localStorage
            loadSavedUrl();
        }
        
        // Auto-connect if we have saved connection (silent, don't show panel)
        const saved = loadSavedConnection();
        if (saved && !sharedRoom) {
            console.log('🔄 Auto-connecting to saved room:', saved.roomCode);
            autoReconnect(); // Silent reconnect, no need to show panel
        } else if (sharedRoom) {
            // Join shared room
            joinRoomCode = sharedRoom;
            console.log('🔗 Joining shared room:', sharedRoom);
        }
    });
    
    // Reactively load URL when panel opens
    $: if (showPanel) {
        loadSavedUrl();
    }
    
    function startEditUrl() {
        editedUrl = hostUrl;
        isEditingUrl = true;
    }
    
    function saveUrl() {
        if (editedUrl.trim()) {
            hostUrl = editedUrl.trim();
            updateServerUrl(hostUrl);
            console.log('💾 Saved new URL:', hostUrl);
            
            // Force save to localStorage immediately even if not connected
            try {
                localStorage.setItem('sync-server-url', hostUrl);
                console.log('💾 Force saved URL to localStorage');
            } catch (e) {
                console.error('Failed to save URL:', e);
            }
        }
        isEditingUrl = false;
    }
    
    function cancelEditUrl() {
        isEditingUrl = false;
        editedUrl = '';
    }
    
    async function handleCreateRoom() {
        error = null;
        const roomCode = await createServerRoom(hostUrl);
        
        if (roomCode) {
            console.log('Created room:', roomCode);
        } else {
            error = 'ไม่สามารถสร้างห้องได้ กรุณาตรวจสอบว่า server รันอยู่';
        }
    }
    
    async function handleJoinRoom() {
        if (!joinRoomCode.trim()) return;
        
        // Save peer name before joining
        if (peerName.trim()) {
            savePeerName(peerName.trim());
        }
        
        error = null;
        const success = await joinServerRoom(hostUrl, joinRoomCode.trim(), peerName.trim() || 'ผู้ใช้');
        
        if (!success) {
            error = 'ไม่สามารถเข้าร่วมห้องได้';
        }
    }
    
    function copyShareLink() {
        const info = getServerInfo();
        const shareUrl = `${window.location.origin}${window.location.pathname}?sync_server=${encodeURIComponent(info.url)}&room=${info.roomCode}`;
        navigator.clipboard.writeText(shareUrl);
        copied = true;
        setTimeout(() => copied = false, 2000);
    }
    
    function getStatusIcon() {
        switch ($serverStatus) {
            case 'connected': return CheckCircle2;
            case 'connecting': return RefreshCw;
            default: return AlertCircle;
        }
    }
    
    function getStatusColor() {
        switch ($serverStatus) {
            case 'connected': return 'text-green-500';
            case 'connecting': return 'text-yellow-500';
            default: return 'text-gray-400';
        }
    }
</script>

<div class="relative">
    <!-- Server Sync Button -->
    <button
        on:click={() => showPanel = !showPanel}
        class="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors {($serverStatus === 'connected') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}"
    >
        <svelte:component this={getStatusIcon()} size={18} class={getStatusColor()} />
        <span class="hidden sm:inline">Server Sync</span>
        {#if $serverStatus === 'connected'}
            <span class="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full">{$serverPeers.length + 1}</span>
        {/if}
    </button>
    
    <!-- Server Sync Panel -->
    {#if showPanel}
        <div class="absolute top-full right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 z-50 animate-fade-in">
            <div class="flex items-center justify-between mb-4">
                <h3 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Server size={18} />
                    Server Sync
                    {#if $serverStatus === 'connected'}
                        <span class="text-xs text-green-600">●</span>
                    {/if}
                </h3>
                <button 
                    on:click={() => showPanel = false}
                    class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                    ×
                </button>
            </div>
            
            {#if error}
                <div class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
                    <AlertCircle size={16} />
                    {error}
                </div>
            {/if}
            
            {#if $syncMessage}
                <div class="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 p-3 rounded-lg mb-4 text-sm flex items-center gap-2 animate-pulse">
                    <RefreshCw size={16} class={$syncMessage.includes('กำลัง') ? 'animate-spin' : ''} />
                    {$syncMessage}
                </div>
            {/if}
            
            <!-- Server URL Input -->
            <div class="mb-4">
                <label class="block text-sm text-gray-600 dark:text-gray-400 mb-1">Server URL</label>
                <div class="flex gap-2">
                    {#if $serverStatus === 'connected' && !isEditingUrl}
                        <div class="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 truncate">
                            {$serverUrl || hostUrl}
                        </div>
                        <button
                            on:click={startEditUrl}
                            class="px-3 py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 rounded-lg transition-colors"
                            title="แก้ไข URL"
                        >
                            <Edit2 size={16} />
                        </button>
                        <button
                            on:click={leaveServerRoom}
                            class="px-3 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 rounded-lg transition-colors"
                            title="Disconnect"
                        >
                            <LogOut size={16} />
                        </button>
                    {:else if isEditingUrl}
                        <input
                            type="text"
                            bind:value={editedUrl}
                            placeholder="http://localhost:3001"
                            class="flex-1 px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                        />
                        <button
                            on:click={saveUrl}
                            class="px-3 py-2 bg-green-100 hover:bg-green-200 dark:bg-green-900/20 dark:hover:bg-green-900/40 text-green-600 rounded-lg transition-colors"
                            title="บันทึก"
                        >
                            <Save size={16} />
                        </button>
                        <button
                            on:click={cancelEditUrl}
                            class="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 rounded-lg transition-colors"
                            title="ยกเลิก"
                        >
                            ×
                        </button>
                    {:else}
                        <input
                            type="text"
                            bind:value={hostUrl}
                            placeholder="http://localhost:3001"
                            class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                        />
                        <button
                            on:click={() => {
                                if (hostUrl.trim()) {
                                    updateServerUrl(hostUrl.trim());
                                    syncMessage.set('บันทึก URL แล้ว');
                                    setTimeout(() => syncMessage.set(''), 2000);
                                }
                            }}
                            class="px-3 py-2 bg-green-100 hover:bg-green-200 dark:bg-green-900/20 dark:hover:bg-green-900/40 text-green-600 rounded-lg transition-colors"
                            title="บันทึก URL"
                        >
                            <Save size={16} />
                        </button>
                    {/if}
                </div>
                {#if $serverStatus === 'connected'}
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        กด ✎ เพื่อเปลี่ยน URL หรือ 🔌 เพื่อออกจากห้อง
                    </p>
                {/if}
            </div>
            
            {#if $serverStatus === 'disconnected'}
                <!-- Not Connected - Show Create/Join options -->
                <div class="space-y-4">
                    <!-- Create Room -->
                    <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <h4 class="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <Globe size={16} />
                            สร้างห้องใหม่
                        </h4>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
                            เป็น Host รัน server แล้วให้คนอื่นเชื่อมต่อ
                        </p>
                        <button
                            on:click={handleCreateRoom}
                            class="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Server size={16} />
                            สร้างห้องบน Server
                        </button>
                    </div>
                    
                    <!-- Join Room -->
                    <div class="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                        <h4 class="font-medium text-gray-900 dark:text-white mb-2">เข้าร่วมห้อง</h4>
                        <div class="space-y-3">
                            <input
                                type="text"
                                bind:value={peerName}
                                placeholder="ชื่อของคุณ"
                                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                            />
                            <div class="flex gap-2">
                                <input
                                    type="text"
                                    bind:value={joinRoomCode}
                                    placeholder="รหัสห้อง 6 ตัว"
                                    maxlength="6"
                                    class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg uppercase text-center tracking-widest dark:bg-gray-700 dark:text-white"
                                />
                                <button
                                    on:click={handleJoinRoom}
                                    disabled={!joinRoomCode.trim()}
                                    class="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                                >
                                    เข้าร่วม
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Instructions -->
                    <div class="text-xs text-gray-500 dark:text-gray-400 space-y-2">
                        <p>📝 วิธีใช้งาน:</p>
                        <ol class="list-decimal list-inside space-y-1 pl-2">
                            <li>Host รัน <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">cargo run</code> ใน sync-server/</li>
                            <li>Host กด "สร้างห้องบน Server"</li>
                            <li>แจ้ง URL และรหัสห้องให้ทีม</li>
                            <li>ทีมใส่ URL และรหัสห้อง แล้วกดเข้าร่วม</li>
                        </ol>
                    </div>
                </div>
                
            {:else}
                <!-- Connected State -->
                <div class="space-y-4">
                    <!-- Room Info -->
                    <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                        {#if $isServerHost}
                            <p class="text-sm text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
                                🏠 คุณเป็น Host
                            </p>
                        {:else}
                            <p class="text-sm text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
                                🔗 เชื่อมต่อกับห้อง
                            </p>
                        {/if}
                        
                        <div class="flex items-center gap-2">
                            <code class="flex-1 text-2xl font-mono font-bold text-green-800 dark:text-green-300 tracking-widest text-center bg-white dark:bg-green-900/40 py-2 rounded">
                                {$serverRoomCode}
                            </code>
                            <button
                                on:click={copyShareLink}
                                class="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-lg transition-colors"
                                title="คัดลอกลิงก์แชร์"
                            >
                                <Link size={20} />
                            </button>
                        </div>
                        
                        {#if copied}
                            <p class="text-xs text-green-600 mt-1 text-center">คัดลอกลิงก์แล้ว!</p>
                        {/if}
                    </div>
                    
                    <!-- Peers List -->
                    <div class="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                        <div class="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                            <div class="flex items-center gap-2">
                                <Users size={16} />
                                <span>ผู้เชื่อมต่อ</span>
                            </div>
                            <span class="font-medium">{$serverPeers.length + 1}</span>
                        </div>
                        <ul class="space-y-1">
                            {#if $isServerHost}
                                <li class="text-sm flex items-center gap-2">
                                    <span class="w-2 h-2 bg-yellow-500 rounded-full"></span>
                                    <span class="font-medium">คุณ (Host)</span>
                                </li>
                            {:else}
                                <!-- Find host from peers list -->
                                {#each $serverPeers.filter(p => p.id.startsWith('host_')) as host}
                                    <li class="text-sm flex items-center gap-2">
                                        <span class="w-2 h-2 bg-yellow-500 rounded-full"></span>
                                        <span class="font-medium">{host.name}</span>
                                    </li>
                                {/each}
                            {/if}
                            {#each $serverPeers.filter(p => !p.id.startsWith('host_')) as peer}
                                <li class="text-sm flex items-center gap-2 pl-4">
                                    <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                                    <span>{peer.name}</span>
                                </li>
                            {/each}
                        </ul>
                    </div>
                    
                    <!-- Actions -->
                    <div class="flex gap-2">
                        <!-- All peers can sync up -->
                        <button
                            on:click={() => syncDocumentToServer()}
                            disabled={$syncMessage.includes('กำลัง')}
                            class="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 dark:disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            title="ส่งข้อมูลของคุณให้ทุกคนในห้อง"
                        >
                            <RefreshCw size={16} class={$syncMessage.includes('กำลังส่ง') ? 'animate-spin' : ''} />
                            ส่งข้อมูลขึ้น
                        </button>
                        <!-- All peers can request latest -->
                        <button
                            on:click={requestSyncFromServer}
                            disabled={$syncMessage.includes('กำลัง')}
                            class="flex-1 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 dark:disabled:bg-gray-700 dark:disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            title="ขอข้อมูลล่าสุดจากห้อง"
                        >
                            <RefreshCw size={16} class={$syncMessage.includes('กำลังขอ') ? 'animate-spin' : ''} />
                            ดึงข้อมูลล่าสุด
                        </button>
                    </div>
                    
                    {#if $lastServerSync}
                        <p class="text-xs text-gray-500 dark:text-gray-400 text-center">
                            Sync ล่าสุด: {$lastServerSync.toLocaleTimeString('th-TH')}
                        </p>
                    {/if}
                </div>
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
