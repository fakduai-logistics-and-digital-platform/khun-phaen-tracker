<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { base } from '$app/paths';
    import { locale } from '$lib/i18n';
    import { user, authLoading } from '$lib/stores/auth';
    import { _ } from '$lib/i18n';
    import { api } from '$lib/apis';
    import { setWorkspaceId } from '$lib/stores/workspace';
    import {
        Plus, LayoutTemplate, ArrowRight, Loader2, FolderOpen,
        Pencil, Trash2, Search, ArrowUpDown, LayoutGrid, List,
        Star, Clock, Layers
    } from 'lucide-svelte';

    interface Workspace {
        id: string;
        name: string;
        room_code: string;
        created_at: string;
        owner_id: string;
    }

    interface RecentEntry {
        id: string;
        name: string;
        timestamp: number;
    }

    // --- Core state ---
    let workspaces: Workspace[] = [];
    let loading = true;
    let creating = false;
    let newWorkspaceName = '';
    let showCreateModal = false;
    let error = '';

    // Edit
    let showEditModal = false;
    let editingWorkspace: Workspace | null = null;
    let editWorkspaceName = '';
    let updating = false;

    // Delete
    let showDeleteModal = false;
    let deletingWorkspace: Workspace | null = null;
    let deleting = false;

    // --- New feature state ---
    let searchQuery = '';
    let sortBy: 'name_asc' | 'name_desc' | 'newest' | 'oldest' | 'recent' = 'newest';
    let viewMode: 'grid' | 'list' = 'grid';
    let pinnedIds: string[] = [];
    let recentEntries: RecentEntry[] = [];
    let workspaceTaskCounts: Record<string, number | null> = {};
    let showSortDropdown = false;

    // --- localStorage helpers ---
    function loadPinned() {
        try {
            const raw = localStorage.getItem('pinned-workspaces');
            pinnedIds = raw ? JSON.parse(raw) : [];
        } catch { pinnedIds = []; }
    }
    function savePinned() {
        localStorage.setItem('pinned-workspaces', JSON.stringify(pinnedIds));
    }
    function loadRecent() {
        try {
            const raw = localStorage.getItem('recent-workspaces');
            recentEntries = raw ? JSON.parse(raw) : [];
        } catch { recentEntries = []; }
    }
    function saveRecent() {
        localStorage.setItem('recent-workspaces', JSON.stringify(recentEntries));
    }
    function loadViewMode() {
        const raw = localStorage.getItem('dashboard-view-mode');
        if (raw === 'list' || raw === 'grid') viewMode = raw;
    }
    function saveViewMode() {
        localStorage.setItem('dashboard-view-mode', viewMode);
    }

    function togglePin(wsId: string) {
        if (pinnedIds.includes(wsId)) {
            pinnedIds = pinnedIds.filter(id => id !== wsId);
        } else {
            pinnedIds = [...pinnedIds, wsId];
        }
        savePinned();
    }

    function trackRecent(ws: Workspace) {
        recentEntries = [
            { id: ws.id, name: ws.name, timestamp: Date.now() },
            ...recentEntries.filter(r => r.id !== ws.id)
        ].slice(0, 5);
        saveRecent();
    }

    // --- Fetch ---
    onMount(() => {
        loadPinned();
        loadRecent();
        loadViewMode();

        const unsubscribe = authLoading.subscribe((isLoading) => {
            if (!isLoading) {
                if (!$user) {
                    goto(`${base}/login`);
                } else {
                    fetchWorkspaces();
                }
            }
        });
        return unsubscribe;
    });

    async function fetchWorkspaces() {
        loading = true;
        error = '';
        try {
            const res = await api.workspaces.getList();
            const data = await res.json();
            if (res.ok) {
                workspaces = data.workspaces || [];
                // Fetch task counts in parallel (fire-and-forget)
                fetchAllTaskCounts();
            } else {
                error = data.error || 'Failed to load workspaces';
            }
        } catch (e) {
            error = 'Network error fetching workspaces';
        } finally {
            loading = false;
        }
    }

    async function fetchAllTaskCounts() {
        try {
            const res = await api.workspaces.getStats();
            const data = await res.json();
            if (res.ok && data.task_counts) {
                workspaceTaskCounts = data.task_counts;
            }
        } catch {
            // silently skip
        }
    }

    async function createWorkspace() {
        if (!newWorkspaceName.trim()) return;
        creating = true;
        error = '';
        try {
            const res = await api.workspaces.create(newWorkspaceName);
            const data = await res.json();
            if (res.ok && data.workspace) {
                workspaces = [...workspaces, data.workspace];
                showCreateModal = false;
                newWorkspaceName = '';
            } else {
                error = data.error || 'Failed to create workspace';
            }
        } catch (e) {
            error = 'Network error creating workspace';
        } finally {
            creating = false;
        }
    }

    function openEditModal(ws: Workspace) {
        editingWorkspace = ws;
        editWorkspaceName = ws.name;
        showEditModal = true;
    }

    async function updateWorkspace() {
        if (!editingWorkspace || !editingWorkspace.id || !editWorkspaceName.trim()) return;
        updating = true;
        error = '';
        try {
            const res = await api.workspaces.update(editingWorkspace.id, editWorkspaceName);
            if (res.ok) {
                workspaces = workspaces.map(ws =>
                    ws.id === editingWorkspace!.id ? { ...ws, name: editWorkspaceName } : ws
                );
                showEditModal = false;
                editingWorkspace = null;
                editWorkspaceName = '';
            } else {
                const data = await res.json();
                error = data.error || $_('dashboard__error_update');
            }
        } catch (e) {
            error = $_('dashboard__error_update');
        } finally {
            updating = false;
        }
    }

    function openDeleteModal(ws: Workspace) {
        deletingWorkspace = ws;
        showDeleteModal = true;
    }

    async function deleteWorkspace() {
        if (!deletingWorkspace || !deletingWorkspace.id) return;
        deleting = true;
        error = '';
        try {
            const res = await api.workspaces.delete(deletingWorkspace.id);
            if (res.ok) {
                workspaces = workspaces.filter(ws => ws.id !== deletingWorkspace!.id);
                // Clean up pinned & recent
                pinnedIds = pinnedIds.filter(id => id !== deletingWorkspace!.id);
                savePinned();
                recentEntries = recentEntries.filter(r => r.id !== deletingWorkspace!.id);
                saveRecent();
                showDeleteModal = false;
                deletingWorkspace = null;
            } else {
                const data = await res.json();
                error = data.error || $_('dashboard__error_delete');
            }
        } catch (e) {
            error = $_('dashboard__error_delete');
        } finally {
            deleting = false;
        }
    }

    function enterWorkspace(workspace: Workspace) {
        trackRecent(workspace);
        if (workspace.id) {
            setWorkspaceId(workspace.id, workspace.name, workspace.owner_id);
        }
        localStorage.setItem('sync-room-code', workspace.room_code);
        localStorage.setItem('backend-server-url', import.meta.env.VITE_SERVER_URL || 'http://127.0.0.1:3002');
        const targetUrl = `${base}/workspace/${workspace.id}?room=${workspace.room_code}`;
        window.location.href = targetUrl;
    }

    // --- Reactive: filter + sort ---
    $: filteredWorkspaces = (() => {
        let result = workspaces;

        // Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(ws => ws.name.toLowerCase().includes(q));
        }

        // Sort
        result = [...result].sort((a, b) => {
            switch (sortBy) {
                case 'name_asc': return a.name.localeCompare(b.name);
                case 'name_desc': return b.name.localeCompare(a.name);
                case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                case 'recent': {
                    const aRecent = recentEntries.find(r => r.id === a.id)?.timestamp ?? 0;
                    const bRecent = recentEntries.find(r => r.id === b.id)?.timestamp ?? 0;
                    return bRecent - aRecent;
                }
                default: return 0;
            }
        });

        return result;
    })();

    $: pinnedWorkspaces = filteredWorkspaces.filter(ws => pinnedIds.includes(ws.id));
    $: unpinnedWorkspaces = filteredWorkspaces.filter(ws => !pinnedIds.includes(ws.id));
    $: recentWorkspaces = recentEntries
        .map(r => workspaces.find(ws => ws.id === r.id))
        .filter((ws): ws is Workspace => !!ws)
        .slice(0, 5);

    // Format date
    function formatCreatedAt(dateStr: string): string {
        try {
            const d = new Date(dateStr);
            if ($locale === 'th') {
                return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
            }
            return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: '2-digit' });
        } catch {
            return '';
        }
    }

    // Sort options for dropdown
    const sortOptions = [
        { value: 'newest', key: 'dashboard__sort_newest' },
        { value: 'oldest', key: 'dashboard__sort_oldest' },
        { value: 'name_asc', key: 'dashboard__sort_name_asc' },
        { value: 'name_desc', key: 'dashboard__sort_name_desc' },
        { value: 'recent', key: 'dashboard__sort_recent' },
    ] as const;
</script>

<div class="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8 rounded-2xl">
    <div class="w-full mx-auto space-y-6">

        <!-- Header Section -->
        <header class="pb-2 space-y-4">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 class="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">
                        {$_('dashboard__title')}
                    </h1>
                    <p class="text-slate-500 dark:text-slate-400 text-sm md:text-base">
                        {#if $user}
                            {$_('dashboard__welcome').replace('{email}', $user.email)}
                        {:else}
                            {$_('dashboard__loading_user')}
                        {/if}
                    </p>
                </div>

                <button
                    on:click={() => showCreateModal = true}
                    class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm ring-1 ring-indigo-500/50 active:scale-95"
                >
                    <Plus size={18} />
                    {$_('dashboard__btn_create')}
                </button>
            </div>
        </header>

        {#if loading || $authLoading}
            <div class="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 class="w-10 h-10 animate-spin mb-4" />
                <p>{$_('dashboard__loading_projects')}</p>
            </div>
        {:else if error}
            <div class="p-4 bg-red-50 text-red-600 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
                {error}
            </div>
        {:else if workspaces.length === 0}
            <div class="text-center py-16 px-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900/50">
                <FolderOpen class="w-12 h-12 mx-auto text-slate-400 dark:text-slate-600 mb-4" />
                <h3 class="text-lg font-semibold text-slate-800 dark:text-white mb-2">{$_('dashboard__empty_title')}</h3>
                <p class="text-sm text-slate-500 max-w-sm mx-auto mb-6">
                    {$_('dashboard__empty_desc')}
                </p>
                <button
                    on:click={() => showCreateModal = true}
                    class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20 text-sm font-semibold rounded-lg transition-colors border border-indigo-200 dark:border-indigo-800"
                >
                    <Plus size={16} />
                    {$_('dashboard__btn_new')}
                </button>
            </div>
        {:else}
            <!-- Overview Stats -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div class="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
                    <div class="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <Layers size={18} />
                    </div>
                    <div>
                        <p class="text-xs text-slate-500 dark:text-slate-400">{$_('dashboard__stats_total_workspaces')}</p>
                        <p class="text-lg font-bold text-slate-900 dark:text-white">{workspaces.length}</p>
                    </div>
                </div>
                <div class="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
                    <div class="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Star size={18} />
                    </div>
                    <div>
                        <p class="text-xs text-slate-500 dark:text-slate-400">{$_('dashboard__stats_pinned')}</p>
                        <p class="text-lg font-bold text-slate-900 dark:text-white">{pinnedIds.filter(id => workspaces.some(ws => ws.id === id)).length}</p>
                    </div>
                </div>
                <div class="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
                    <div class="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <Clock size={18} />
                    </div>
                    <div>
                        <p class="text-xs text-slate-500 dark:text-slate-400">{$_('dashboard__stats_recent')}</p>
                        <p class="text-lg font-bold text-slate-900 dark:text-white">{recentWorkspaces.length}</p>
                    </div>
                </div>
            </div>

            <!-- Search / Sort / View Toggle Toolbar -->
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:justify-end">
                <div class="relative sm:w-56">
                    <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        bind:value={searchQuery}
                        placeholder={$_('dashboard__search_placeholder')}
                        class="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-900 dark:text-white placeholder-slate-400"
                    />
                </div>

                <div class="relative">
                    <button
                        type="button"
                        on:click={() => showSortDropdown = !showSortDropdown}
                        class="inline-flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        <ArrowUpDown size={14} class="text-slate-400 shrink-0" />
                        <span>{$_(sortOptions.find(o => o.value === sortBy)?.key ?? 'dashboard__sort_newest')}</span>
                    </button>

                    {#if showSortDropdown}
                        <!-- svelte-ignore a11y-click-events-have-key-events -->
                        <!-- svelte-ignore a11y-no-static-element-interactions -->
                        <div class="fixed inset-0 z-10" on:click={() => showSortDropdown = false}></div>
                        <div class="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 z-20 animate-fade-in">
                            {#each sortOptions as opt}
                                <button
                                    type="button"
                                    class="w-full text-left px-3 py-2 text-sm transition-colors {sortBy === opt.value ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 font-medium' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}"
                                    on:click={() => { sortBy = opt.value; showSortDropdown = false; }}
                                >
                                    {$_(opt.key)}
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>

                <div class="flex border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                    <button
                        on:click={() => { viewMode = 'grid'; saveViewMode(); }}
                        class="p-2 transition-colors {viewMode === 'grid' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'bg-white dark:bg-slate-900 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}"
                        title={$_('dashboard__view_grid')}
                    >
                        <LayoutGrid size={18} />
                    </button>
                    <button
                        on:click={() => { viewMode = 'list'; saveViewMode(); }}
                        class="p-2 transition-colors border-l border-slate-200 dark:border-slate-800 {viewMode === 'list' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'bg-white dark:bg-slate-900 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}"
                        title={$_('dashboard__view_list')}
                    >
                        <List size={18} />
                    </button>
                </div>
            </div>

            <!-- Recently Opened (horizontal scroll) -->
            {#if recentWorkspaces.length > 0 && !searchQuery.trim()}
                <section>
                    <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5">
                        <Clock size={12} />
                        {$_('dashboard__recent_section')}
                    </h2>
                    <div class="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                        {#each recentWorkspaces as ws}
                            <button
                                on:click={() => enterWorkspace(ws)}
                                class="shrink-0 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 hover:shadow-md transition-shadow text-left group"
                            >
                                <div class="flex items-center gap-2.5 mb-2">
                                    <div class="w-7 h-7 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                        <LayoutTemplate size={14} />
                                    </div>
                                    <span class="text-sm font-semibold text-slate-900 dark:text-white truncate">{ws.name}</span>
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-[10px] text-slate-400">
                                        {formatCreatedAt(ws.created_at)}
                                    </span>
                                    <ArrowRight size={12} class="text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                                </div>
                            </button>
                        {/each}
                    </div>
                </section>
            {/if}

            <hr class="border-slate-200 dark:border-slate-800" />

            <!-- No results -->
            {#if filteredWorkspaces.length === 0}
                <div class="text-center py-12">
                    <Search class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                    <p class="text-sm text-slate-500 dark:text-slate-400">{$_('dashboard__no_results')}</p>
                </div>
            {:else}
                <!-- Pinned Section -->
                {#if pinnedWorkspaces.length > 0}
                    <section>
                        <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5">
                            <Star size={12} />
                            {$_('dashboard__pinned_section')}
                        </h2>
                        {#if viewMode === 'grid'}
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {#each pinnedWorkspaces as ws}
                                    {@const isPinned = true}
                                    {@const isOwner = $user && ws.owner_id === $user.id}
                                    {@const taskCount = workspaceTaskCounts[ws.id]}
                                    <div class="relative group">
                                        <button
                                            on:click={() => enterWorkspace(ws)}
                                            class="w-full text-left bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col h-full ring-2 ring-transparent focus:outline-none focus:ring-indigo-500"
                                        >
                                            <div class="mb-3">
                                                <div class="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                                    <LayoutTemplate size={20} />
                                                </div>
                                            </div>
                                            <h3 class="text-base font-semibold text-slate-900 dark:text-white mb-1 line-clamp-2">
                                                {ws.name}
                                            </h3>
                                            <div class="flex items-center gap-2 flex-wrap mb-3">
                                                <span class="text-[11px] text-slate-400">
                                                    {$_('dashboard__card_created').replace('{date}', formatCreatedAt(ws.created_at))}
                                                </span>
                                                {#if taskCount !== undefined && taskCount !== null}
                                                    <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                                        {$_('dashboard__card_tasks').replace('{count}', String(taskCount))}
                                                    </span>
                                                {/if}
                                                {#if isOwner}
                                                    <span class="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                                        {$_('dashboard__card_owner_badge')}
                                                    </span>
                                                {:else}
                                                    <span class="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                                        {$_('dashboard__card_member_badge')}
                                                    </span>
                                                {/if}
                                            </div>
                                            <div class="mt-auto pt-3 flex items-center justify-end text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/50">
                                                <span class="flex items-center gap-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 font-medium transition-colors">
                                                    {$_('dashboard__btn_open')} <ArrowRight size={14} class="group-hover:translate-x-1 transition-transform" />
                                                </span>
                                            </div>
                                        </button>

                                        <!-- Actions overlay -->
                                        <div class="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-lg p-0.5">
                                            <button
                                                on:click|stopPropagation={() => togglePin(ws.id)}
                                                class="p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/20 rounded-lg transition-colors"
                                                title={$_('dashboard__btn_unpin')}
                                            >
                                                <Star size={15} fill="currentColor" />
                                            </button>
                                            {#if isOwner}
                                                <button
                                                    on:click|stopPropagation={() => openEditModal(ws)}
                                                    class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 rounded-lg transition-colors"
                                                    title={$_('dashboard__btn_edit')}
                                                >
                                                    <Pencil size={15} />
                                                </button>
                                                <button
                                                    on:click|stopPropagation={() => openDeleteModal(ws)}
                                                    class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg transition-colors"
                                                    title={$_('dashboard__btn_delete')}
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            {/if}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <!-- List view for pinned -->
                            <div class="space-y-2">
                                {#each pinnedWorkspaces as ws}
                                    {@const isOwner = $user && ws.owner_id === $user.id}
                                    {@const taskCount = workspaceTaskCounts[ws.id]}
                                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                                    <div
                                        on:click={() => enterWorkspace(ws)}
                                        class="w-full text-left bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 rounded-xl px-4 py-3 hover:shadow-md transition-shadow flex items-center gap-4 group cursor-pointer"
                                    >
                                        <div class="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                            <LayoutTemplate size={18} />
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <h3 class="text-sm font-semibold text-slate-900 dark:text-white truncate">{ws.name}</h3>
                                            <p class="text-[11px] text-slate-400">{$_('dashboard__card_created').replace('{date}', formatCreatedAt(ws.created_at))}</p>
                                        </div>
                                        <div class="flex items-center gap-2 shrink-0">
                                            {#if taskCount !== undefined && taskCount !== null}
                                                <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                                    {$_('dashboard__card_tasks').replace('{count}', String(taskCount))}
                                                </span>
                                            {/if}
                                            {#if isOwner}
                                                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">{$_('dashboard__card_owner_badge')}</span>
                                            {:else}
                                                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">{$_('dashboard__card_member_badge')}</span>
                                            {/if}
                                            <button
                                                on:click|stopPropagation={() => togglePin(ws.id)}
                                                class="p-1 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/20 rounded-lg transition-colors"
                                                title={$_('dashboard__btn_unpin')}
                                            >
                                                <Star size={14} fill="currentColor" />
                                            </button>
                                            {#if isOwner}
                                                <button on:click|stopPropagation={() => openEditModal(ws)} class="p-1 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors" title={$_('dashboard__btn_edit')}>
                                                    <Pencil size={14} />
                                                </button>
                                                <button on:click|stopPropagation={() => openDeleteModal(ws)} class="p-1 text-slate-400 hover:text-red-600 rounded-lg transition-colors" title={$_('dashboard__btn_delete')}>
                                                    <Trash2 size={14} />
                                                </button>
                                            {/if}
                                            <ArrowRight size={14} class="text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </section>
                {/if}

                <!-- All Workspaces Section -->
                {#if unpinnedWorkspaces.length > 0}
                    <section>
                        {#if pinnedWorkspaces.length > 0}
                            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5">
                                <Layers size={12} />
                                {$_('dashboard__all_section')}
                            </h2>
                        {/if}

                        {#if viewMode === 'grid'}
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {#each unpinnedWorkspaces as ws}
                                    {@const isOwner = $user && ws.owner_id === $user.id}
                                    {@const taskCount = workspaceTaskCounts[ws.id]}
                                    <div class="relative group">
                                        <button
                                            on:click={() => enterWorkspace(ws)}
                                            class="w-full text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col h-full ring-2 ring-transparent focus:outline-none focus:ring-indigo-500"
                                        >
                                            <div class="mb-3">
                                                <div class="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                                    <LayoutTemplate size={20} />
                                                </div>
                                            </div>
                                            <h3 class="text-base font-semibold text-slate-900 dark:text-white mb-1 line-clamp-2">
                                                {ws.name}
                                            </h3>
                                            <div class="flex items-center gap-2 flex-wrap mb-3">
                                                <span class="text-[11px] text-slate-400">
                                                    {$_('dashboard__card_created').replace('{date}', formatCreatedAt(ws.created_at))}
                                                </span>
                                                {#if taskCount !== undefined && taskCount !== null}
                                                    <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                                        {$_('dashboard__card_tasks').replace('{count}', String(taskCount))}
                                                    </span>
                                                {/if}
                                                {#if isOwner}
                                                    <span class="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                                        {$_('dashboard__card_owner_badge')}
                                                    </span>
                                                {:else}
                                                    <span class="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                                        {$_('dashboard__card_member_badge')}
                                                    </span>
                                                {/if}
                                            </div>
                                            <div class="mt-auto pt-3 flex items-center justify-end text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/50">
                                                <span class="flex items-center gap-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 font-medium transition-colors">
                                                    {$_('dashboard__btn_open')} <ArrowRight size={14} class="group-hover:translate-x-1 transition-transform" />
                                                </span>
                                            </div>
                                        </button>

                                        <!-- Actions overlay -->
                                        <div class="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-lg p-0.5">
                                            <button
                                                on:click|stopPropagation={() => togglePin(ws.id)}
                                                class="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/20 rounded-lg transition-colors"
                                                title={$_('dashboard__btn_pin')}
                                            >
                                                <Star size={15} />
                                            </button>
                                            {#if isOwner}
                                                <button
                                                    on:click|stopPropagation={() => openEditModal(ws)}
                                                    class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 rounded-lg transition-colors"
                                                    title={$_('dashboard__btn_edit')}
                                                >
                                                    <Pencil size={15} />
                                                </button>
                                                <button
                                                    on:click|stopPropagation={() => openDeleteModal(ws)}
                                                    class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg transition-colors"
                                                    title={$_('dashboard__btn_delete')}
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            {/if}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <!-- List view -->
                            <div class="space-y-2">
                                {#each unpinnedWorkspaces as ws}
                                    {@const isOwner = $user && ws.owner_id === $user.id}
                                    {@const taskCount = workspaceTaskCounts[ws.id]}
                                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                                    <div
                                        on:click={() => enterWorkspace(ws)}
                                        class="w-full text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 hover:shadow-md transition-shadow flex items-center gap-4 group cursor-pointer"
                                    >
                                        <div class="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                            <LayoutTemplate size={18} />
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <h3 class="text-sm font-semibold text-slate-900 dark:text-white truncate">{ws.name}</h3>
                                            <p class="text-[11px] text-slate-400">{$_('dashboard__card_created').replace('{date}', formatCreatedAt(ws.created_at))}</p>
                                        </div>
                                        <div class="flex items-center gap-2 shrink-0">
                                            {#if taskCount !== undefined && taskCount !== null}
                                                <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                                    {$_('dashboard__card_tasks').replace('{count}', String(taskCount))}
                                                </span>
                                            {/if}
                                            {#if isOwner}
                                                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">{$_('dashboard__card_owner_badge')}</span>
                                            {:else}
                                                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">{$_('dashboard__card_member_badge')}</span>
                                            {/if}
                                            <button
                                                on:click|stopPropagation={() => togglePin(ws.id)}
                                                class="p-1 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/20 rounded-lg transition-colors"
                                                title={$_('dashboard__btn_pin')}
                                            >
                                                <Star size={14} />
                                            </button>
                                            {#if isOwner}
                                                <button on:click|stopPropagation={() => openEditModal(ws)} class="p-1 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors" title={$_('dashboard__btn_edit')}>
                                                    <Pencil size={14} />
                                                </button>
                                                <button on:click|stopPropagation={() => openDeleteModal(ws)} class="p-1 text-slate-400 hover:text-red-600 rounded-lg transition-colors" title={$_('dashboard__btn_delete')}>
                                                    <Trash2 size={14} />
                                                </button>
                                            {/if}
                                            <ArrowRight size={14} class="text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </section>
                {/if}
            {/if}
        {/if}
    </div>
</div>

<!-- Create Modal -->
{#if showCreateModal}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" on:click|self={() => showCreateModal = false}>
        <div class="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div class="px-6 py-6">
                <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-5">{$_('dashboard__modal_title')}</h2>

                <form on:submit|preventDefault={createWorkspace} class="space-y-4">
                    <div>
                        <label for="name" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{$_('dashboard__modal_name_label')}</label>
                        <input
                            id="name"
                            type="text"
                            bind:value={newWorkspaceName}
                            placeholder={$_('dashboard__modal_name_placeholder')}
                            class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            required
                            autofocus
                        />
                    </div>

                    <div class="flex gap-3 pt-4">
                        <button
                            type="button"
                            on:click={() => showCreateModal = false}
                            class="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 text-sm font-semibold rounded-lg transition-colors"
                        >
                            {$_('dashboard__modal_btn_cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={creating || !newWorkspaceName.trim()}
                            class="flex-1 inline-flex justify-center items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                        >
                            {#if creating}
                                <Loader2 class="w-4 h-4 animate-spin" />
                            {:else}
                                {$_('dashboard__modal_btn_create')}
                            {/if}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
{/if}

<!-- Edit Modal -->
{#if showEditModal}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" on:click|self={() => showEditModal = false}>
        <div class="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div class="px-6 py-6">
                <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-5">{$_('dashboard__modal_edit_title')}</h2>

                <form on:submit|preventDefault={updateWorkspace} class="space-y-4">
                    <div>
                        <label for="edit_name" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{$_('dashboard__modal_name_label')}</label>
                        <input
                            id="edit_name"
                            type="text"
                            bind:value={editWorkspaceName}
                            placeholder={$_('dashboard__modal_name_placeholder')}
                            class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            required
                            autofocus
                        />
                    </div>

                    <div class="flex gap-3 pt-4">
                        <button
                            type="button"
                            on:click={() => showEditModal = false}
                            class="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 text-sm font-semibold rounded-lg transition-colors"
                        >
                            {$_('dashboard__modal_btn_cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={updating || !editWorkspaceName.trim()}
                            class="flex-1 inline-flex justify-center items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                        >
                            {#if updating}
                                <Loader2 class="w-4 h-4 animate-spin" />
                            {:else}
                                {$_('dashboard__modal_btn_save')}
                            {/if}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" on:click|self={() => showDeleteModal = false}>
        <div class="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div class="px-6 py-6 text-center">
                <div class="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center mb-4">
                    <Trash2 size={24} />
                </div>

                <h2 class="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    {$_('dashboard__modal_delete_title')}
                </h2>

                <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    {$_('dashboard__modal_delete_warning')}
                </p>

                <div class="flex gap-3">
                    <button
                        type="button"
                        on:click={() => showDeleteModal = false}
                        class="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 text-sm font-semibold rounded-lg transition-colors"
                    >
                        {$_('dashboard__modal_btn_cancel')}
                    </button>
                    <button
                        type="button"
                        on:click={deleteWorkspace}
                        disabled={deleting}
                        class="flex-1 inline-flex justify-center items-center px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                    >
                        {#if deleting}
                            <Loader2 class="w-4 h-4 animate-spin" />
                        {:else}
                            {$_('dashboard__modal_btn_delete_confirm')}
                        {/if}
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}
