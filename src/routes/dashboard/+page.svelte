<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { base } from '$app/paths';
    import { user, authLoading } from '$lib/stores/auth';
    import { _ } from '$lib/i18n';
    import { api } from '$lib/apis';
    import { Plus, LayoutTemplate, ArrowRight, Loader2, FolderOpen, Pencil, Trash2 } from 'lucide-svelte';

    interface Workspace {
        _id?: { $oid: string };
        name: string;
        room_code: string;
        created_at: string;
    }

    let workspaces: Workspace[] = [];
    let loading = true;
    let creating = false;
    let newWorkspaceName = '';
    let showCreateModal = false;
    let error = '';

    // Edit properties
    let showEditModal = false;
    let editingWorkspace: Workspace | null = null;
    let editWorkspaceName = '';
    let updating = false;

    // Delete properties
    let showDeleteModal = false;
    let deletingWorkspace: Workspace | null = null;
    let deleting = false;

    onMount(() => {
        // Wait for auth to resolve
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
            } else {
                error = data.error || 'Failed to load workspaces';
            }
        } catch (e) {
            error = 'Network error fetching workspaces';
        } finally {
            loading = false;
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
        if (!editingWorkspace || !editingWorkspace._id || !editWorkspaceName.trim()) return;
        
        updating = true;
        error = '';
        try {
            const res = await api.workspaces.update(editingWorkspace._id.$oid, editWorkspaceName);
            if (res.ok) {
                // Update workspace in list
                workspaces = workspaces.map(ws => 
                    ws._id?.$oid === editingWorkspace!._id?.$oid 
                        ? { ...ws, name: editWorkspaceName } 
                        : ws
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
        if (!deletingWorkspace || !deletingWorkspace._id) return;
        
        deleting = true;
        error = '';
        try {
            const res = await api.workspaces.delete(deletingWorkspace._id.$oid);
            if (res.ok) {
                // Remove workspace from list
                workspaces = workspaces.filter(ws => ws._id?.$oid !== deletingWorkspace!._id?.$oid);
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
        localStorage.setItem('sync-room-code', workspace.room_code);
        localStorage.setItem('sync-server-url', 'http://127.0.0.1:3002');
        
        let targetUrl = `${base}/`;
        if (targetUrl === '/') targetUrl = '/?room=' + workspace.room_code;
        else targetUrl += '?room=' + workspace.room_code;
        
        // Use window.location to force a full reload and guarantee ServerSyncPanel mounts cleanly
        window.location.href = targetUrl;
    }
</script>

<div class="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8 rounded-2xl">
    <div class="w-full mx-auto space-y-8">
        
        <!-- Header Section -->
        <header class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 dark:border-slate-800 pb-8">
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
                class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-all shadow-sm ring-1 ring-indigo-500/50 active:scale-95"
            >
                <Plus size={18} />
                {$_('dashboard__btn_create')}
            </button>
        </header>

        <!-- Main Content (Workspaces) -->
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
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {#each workspaces as ws}
                    <div class="relative group">
                        <button 
                            on:click={() => enterWorkspace(ws)}
                            class="w-full text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col h-full ring-2 ring-transparent focus:outline-none focus:ring-indigo-500"
                        >
                            <div class="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 shrink-0 transition-transform">
                                <LayoutTemplate size={20} />
                            </div>
                            <h3 class="text-base font-semibold text-slate-900 dark:text-white mb-2 line-clamp-2 pr-12">
                                {ws.name}
                            </h3>
                            <div class="mt-auto pt-4 flex items-center justify-end text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/50">
                                <span class="flex items-center gap-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 font-medium transition-colors">
                                    {$_('dashboard__btn_open')} <ArrowRight size={14} class="group-hover:translate-x-1 transition-transform" />
                                </span>
                            </div>
                        </button>
                        
                        <!-- Actions -->
                        <div class="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <button 
                                on:click|stopPropagation={() => openEditModal(ws)}
                                class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                title={$_('dashboard__btn_edit')}
                            >
                                <Pencil size={16} />
                            </button>
                            <button 
                                on:click|stopPropagation={() => openDeleteModal(ws)}
                                class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                                title={$_('dashboard__btn_delete')}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<!-- Create Modal -->
{#if showCreateModal}
    <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
    <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
    <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
