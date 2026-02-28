<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { base } from '$app/paths';
    import { user, authLoading } from '$lib/stores/auth';
    import { api } from '$lib/apis';
    import { Plus, LayoutTemplate, ArrowRight, Loader2, FolderOpen } from 'lucide-svelte';

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

<div class="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8">
    <div class="w-full mx-auto space-y-8">
        
        <!-- Header Section -->
        <header class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 dark:border-slate-800 pb-8">
            <div>
                <h1 class="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">
                    Dashboard
                </h1>
                <p class="text-slate-500 dark:text-slate-400 text-base md:text-lg">
                    {#if $user}
                        Welcome back, <span class="font-medium text-blue-600 dark:text-blue-400">{$user.email}</span>
                    {:else}
                        Loading user profile...
                    {/if}
                </p>
            </div>
            
            <button 
                on:click={() => showCreateModal = true}
                class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-blue-500/25 active:scale-95"
            >
                <Plus size={20} />
                Create Project
            </button>
        </header>

        <!-- Main Content (Workspaces) -->
        {#if loading || $authLoading}
            <div class="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 class="w-10 h-10 animate-spin mb-4" />
                <p>Loading your projects...</p>
            </div>
        {:else if error}
            <div class="p-4 bg-red-50 text-red-600 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
                {error}
            </div>
        {:else if workspaces.length === 0}
            <div class="text-center py-20 px-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900/50">
                <FolderOpen class="w-16 h-16 mx-auto text-slate-300 dark:text-slate-700 mb-6" />
                <h3 class="text-2xl font-bold text-slate-800 dark:text-white mb-2">No projects yet</h3>
                <p class="text-slate-500 max-w-sm mx-auto mb-8">
                    Create your first workspace to start syncing tasks, creating boards, and collaborating with others securely.
                </p>
                <button 
                    on:click={() => showCreateModal = true}
                    class="inline-flex items-center gap-2 px-6 py-3 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 font-semibold rounded-xl transition-colors"
                >
                    <Plus size={18} />
                    New Project
                </button>
            </div>
        {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {#each workspaces as ws}
                    <button 
                        on:click={() => enterWorkspace(ws)}
                        class="text-left group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full ring-2 ring-transparent focus:outline-none focus:ring-blue-500"
                    >
                        <div class="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-6 shrink-0 group-hover:scale-110 transition-transform">
                            <LayoutTemplate size={24} />
                        </div>
                        <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-2">
                            {ws.name}
                        </h3>
                        <div class="mt-auto pt-6 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/50">
                            <span class="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs">#{ws.room_code}</span>
                            <span class="flex items-center gap-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 font-medium transition-colors">
                                Open <ArrowRight size={16} class="group-hover:translate-x-1 transition-transform" />
                            </span>
                        </div>
                    </button>
                {/each}
            </div>
        {/if}
    </div>
</div>

<!-- Create Modal -->
{#if showCreateModal}
    <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
            <div class="px-6 py-8">
                <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-6">Create New Project</h2>
                
                <form on:submit|preventDefault={createWorkspace} class="space-y-6">
                    <div>
                        <label for="name" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Project Name</label>
                        <input 
                            id="name"
                            type="text" 
                            bind:value={newWorkspaceName} 
                            placeholder="e.g. Website Redesign Q3" 
                            class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-medium"
                            required
                            autofocus
                        />
                    </div>
                    
                    <div class="flex gap-3 pt-2">
                        <button 
                            type="button" 
                            on:click={() => showCreateModal = false}
                            class="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={creating || !newWorkspaceName.trim()}
                            class="flex-1 inline-flex justify-center items-center px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
                        >
                            {#if creating}
                                <Loader2 class="w-5 h-5 animate-spin" />
                            {:else}
                                Create
                            {/if}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
{/if}
