<script lang="ts">
    import { onMount } from 'svelte';
    import { _ } from 'svelte-i18n';
    import { 
        Users, 
        UserPlus, 
        Shield, 
        User as UserIcon, 
        Mail, 
        Calendar, 
        CheckCircle2, 
        XCircle,
        Search,
        MoreVertical,
        ChevronRight
    } from 'lucide-svelte';
    import { base } from '$app/paths';
    import { api } from '$lib/apis';
    import { user } from '$lib/stores/auth';

    let users: any[] = [];
    let loading = true;
    let error = '';
    let searchQuery = '';

    async function fetchUsers() {
        loading = true;
        try {
            const res = await api.auth.listUsers();
            const data = await res.json();
            if (res.ok) {
                users = data.users;
            } else {
                error = data.error || 'Failed to fetch users';
            }
        } catch (e) {
            error = 'Failed to fetch users';
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        if ($user?.role !== 'admin') {
            window.location.href = `${base}/dashboard`;
            return;
        }
        fetchUsers();
    });

    $: filteredUsers = users.filter(u => 
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.profile?.first_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.profile?.nickname || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleDateString();
    }
</script>

<div class="space-y-6 animate-fade-in">
    <!-- Header Section -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users class="text-indigo-500" />
                User Management
            </h1>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Manage your team members and their roles.
            </p>
        </div>
        
        <a 
            href="{base}/create-account"
            class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20"
        >
            <UserPlus size={18} />
            Add New User
        </a>
    </div>

    <!-- Stats/Quick Info (Optional) -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Users</span>
            <div class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{users.length}</div>
        </div>
        <div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active</span>
            <div class="text-2xl font-bold text-green-500 mt-1">{users.filter(u => u.is_active).length}</div>
        </div>
        <div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pending</span>
            <div class="text-2xl font-bold text-amber-500 mt-1">{users.filter(u => !u.is_active).length}</div>
        </div>
    </div>

    <!-- Search & Filter -->
    <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Search size={18} />
        </div>
        <input 
            type="text" 
            bind:value={searchQuery}
            placeholder="Search users by email, name, or nickname..."
            class="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all dark:text-white"
        />
    </div>

    <!-- Users Table -->
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
                <thead class="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                        <th class="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                        <th class="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                        <th class="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                        <th class="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Joined</th>
                        <th class="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Action</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                    {#if loading}
                        {#each Array(3) as _}
                            <tr class="animate-pulse">
                                <td class="px-6 py-4"><div class="h-10 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
                                <td class="px-6 py-4"><div class="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
                                <td class="px-6 py-4"><div class="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
                                <td class="px-6 py-4"><div class="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
                                <td class="px-6 py-4"><div class="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded float-right"></div></td>
                            </tr>
                        {/each}
                    {:else if error}
                        <tr>
                            <td colspan="5" class="px-6 py-12 text-center text-red-500 font-medium">
                                {error}
                            </td>
                        </tr>
                    {:else if filteredUsers.length === 0}
                        <tr>
                            <td colspan="5" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                No users found matching your search.
                            </td>
                        </tr>
                    {:else}
                        {#each filteredUsers as u}
                            <tr class="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                                <td class="px-6 py-4">
                                    <div class="flex items-center gap-3">
                                        <div class="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-sm ring-1 ring-indigo-500/20">
                                            {u.profile?.first_name?.[0] || u.email[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <div class="text-sm font-semibold text-gray-900 dark:text-white">
                                                {u.profile?.first_name || 'Anonymous'} {u.profile?.last_name || ''}
                                                {#if u.profile?.nickname}
                                                    <span class="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">({u.profile.nickname})</span>
                                                {/if}
                                            </div>
                                            <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                                <Mail size={12} /> {u.email}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td class="px-6 py-4">
                                    {#if u.role === 'admin'}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px] font-bold uppercase tracking-wider border border-purple-200 dark:border-purple-800">
                                            <Shield size={10} /> Admin
                                        </span>
                                    {:else}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider border border-gray-200 dark:border-gray-600">
                                            <UserIcon size={10} /> User
                                        </span>
                                    {/if}
                                </td>
                                <td class="px-6 py-4">
                                    {#if u.is_active}
                                        <span class="inline-flex items-center gap-1 text-green-500 text-xs font-medium">
                                            <CheckCircle2 size={14} /> Active
                                        </span>
                                    {:else}
                                        <span class="inline-flex items-center gap-1 text-amber-500 text-xs font-medium">
                                            <Calendar size={14} /> Pending
                                        </span>
                                    {/if}
                                </td>
                                <td class="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">
                                    {formatDate(u.created_at)}
                                </td>
                                <td class="px-6 py-4 text-right">
                                    <button class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                                        <MoreVertical size={18} />
                                    </button>
                                </td>
                            </tr>
                        {/each}
                    {/if}
                </tbody>
            </table>
        </div>
    </div>
</div>

<style>
    .animate-fade-in {
        animation: fadeIn 0.4s ease-out;
    }

    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
</style>
