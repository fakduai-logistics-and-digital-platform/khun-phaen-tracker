<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
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
        ChevronRight,
        X,
        Tag,
        Briefcase,
        ArrowRight,
        Trash2,
        RefreshCcw,
        KeyRound,
        Link as LinkIcon,
        Edit2
    } from 'lucide-svelte';
    import { base } from '$app/paths';
    import { api } from '$lib/apis';
    import { user } from '$lib/stores/auth';

    let users: any[] = [];
    let loading = true;
    let error = '';
    let searchQuery = '';

    // Modal state
    let showAddModal = false;
    let addLoading = false;
    let addError = '';
    let setupLink = '';
    let registrationMode: 'invite' | 'password' = 'invite';
    let formData = {
        email: '',
        password: '',
        role: 'user',
        first_name: '',
        last_name: '',
        nickname: '',
        position: '',
        discord_id: ''
    };

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

    async function handleInvite() {
        addLoading = true;
        addError = '';
        setupLink = '';

        try {
            const payload = { ...formData };
            if (registrationMode === 'invite') {
                delete (payload as any).password;
            } else if (!payload.password && !editingUser) {
                addError = 'Password is required';
                addLoading = false;
                return;
            }
            
            if (editingUser && !payload.password) {
                delete (payload as any).password;
            }

            const res = editingUser 
                ? await api.auth.updateUser(editingUser.id, payload)
                : await api.auth.invite(payload);
            const data = await res.json();

            if (res.ok) {
                if (data.setup_link) {
                    setupLink = window.location.origin + base + data.setup_link;
                } else {
                    resetForm();
                }
                fetchUsers(); // Refresh list to show pending
            } else {
                addError = data.error || 'User operation failed';
            }
        } catch (e) {
            addError = 'User operation failed';
        } finally {
            addLoading = false;
        }
    }

    function resetForm() {
        formData = {
            email: '',
            password: '',
            role: 'user',
            first_name: '',
            last_name: '',
            nickname: '',
            position: '',
            discord_id: ''
        };
        registrationMode = 'invite';
        addError = '';
        setupLink = '';
        showAddModal = false;
        editingUser = null;
    }

    let openMenuId: string | null = null;
    let showDeleteConfirm = false;
    let userToDelete: any = null;
    let deleteLoading = false;
    let editingUser: any = null;
    let openMenuUser: any = null;
    let menuPos = { top: 0, left: 0 };
    let showToast = false;
    let toastMessage = '';

    function toggleMenu(u: any, e: MouseEvent) {
        e.stopPropagation();
        if (openMenuId === u.id) {
            openMenuId = null;
            openMenuUser = null;
        } else {
            openMenuId = u.id;
            openMenuUser = u;
            // Calculate position
            const target = e.currentTarget as HTMLElement;
            const rect = target.getBoundingClientRect();
            menuPos = {
                top: rect.bottom + window.scrollY,
                left: rect.right + window.scrollX - 160 // Align right to button
            };
        }
    }

    function handleCopyInvite(token: string) {
        const link = `${window.location.origin}${base}/setup-password?token=${token}`;
        navigator.clipboard.writeText(link);
        
        toastMessage = $_('users__copy_success');
        showToast = true;
        setTimeout(() => showToast = false, 3000);

        openMenuId = null;
    }

    async function confirmDelete(u: any) {
        userToDelete = u;
        showDeleteConfirm = true;
        openMenuId = null;
    }

    async function handleDelete() {
        if (!userToDelete) return;
        deleteLoading = true;
        try {
            const res = await api.auth.deleteUser(userToDelete.id);
            if (res.ok) {
                fetchUsers();
                showDeleteConfirm = false;
                userToDelete = null;
            } else {
                const data = await res.json();
                error = data.error || 'Failed to delete user';
            }
        } catch (e) {
            error = 'Failed to delete user';
        } finally {
            deleteLoading = false;
        }
    }

    function handleEdit(u: any) {
        editingUser = u;
        formData = {
            email: u.email,
            password: '',
            role: u.role,
            first_name: u.profile?.first_name || '',
            last_name: u.profile?.last_name || '',
            nickname: u.profile?.nickname || '',
            position: u.profile?.position || '',
            discord_id: u.discord_id || ''
        };
        registrationMode = 'invite'; // Or handle edit mode
        showAddModal = true;
        openMenuId = null;
    }

    onMount(() => {
        if ($user?.role !== 'admin') {
            window.location.href = `${base}/dashboard`;
            return;
        }
        fetchUsers();

        const handleClickOutside = () => openMenuId = null;
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    });

    $: filteredUsers = users.filter(u => 
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.profile?.first_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.profile?.nickname || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleDateString();
    }

    $: if (browser) {
        if (showAddModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
    }
</script>

<div class="space-y-6 animate-fade-in">
    <!-- Header Section -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users class="text-indigo-500" />
                {$_('users__title')}
            </h1>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {$_('users__subtitle')}
            </p>
        </div>
        
        <button
            on:click={() => showAddModal = true}
            class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20"
        >
            <UserPlus size={18} />
            {$_('users__btn_add')}
        </button>
    </div>

    <!-- Stats/Quick Info (Optional) -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{$_('users__total_users')}</span>
            <div class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{users.length}</div>
        </div>
        <div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{$_('users__active')}</span>
            <div class="text-2xl font-bold text-green-500 mt-1">{users.filter(u => u.is_active).length}</div>
        </div>
        <div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{$_('users__pending')}</span>
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
            placeholder={$_('users__search_placeholder')}
            class="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all dark:text-white"
        />
    </div>

    <!-- Users Table -->
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
                <thead class="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                        <th class="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{$_('users__table_user')}</th>
                        <th class="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{$_('users__table_role')}</th>
                        <th class="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{$_('users__table_status')}</th>
                        <th class="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{$_('users__table_joined')}</th>
                        <th class="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">{$_('users__table_action')}</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                    {#if loading}
                        {#each Array(3) as i}
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
                                        <div class="relative">
                                            <div class="w-9 h-9 rounded-full border-2 border-indigo-500 bg-white dark:bg-gray-800 flex items-center justify-center overflow-hidden transition-colors">
                                                <span class="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter">
                                                    {(u.profile?.nickname || u.email.split('@')[0])[0]}
                                                </span>
                                            </div>

                                            <!-- Live Status Dot -->
                                            <div class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center">
                                                <div class="w-2 h-2 rounded-full {u.is_active ? 'bg-green-500' : 'bg-amber-400'}"></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div class="text-sm font-semibold text-gray-900 dark:text-white">
                                                {u.profile?.first_name || u.profile?.last_name ? `${u.profile.first_name || ''} ${u.profile.last_name || ''}`.trim() : $_('users__anonymous')}
                                                {#if u.profile?.nickname}
                                                    <span class="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">({u.profile.nickname})</span>
                                                {/if}
                                            </div>
                                            <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                                <Mail size={12} /> {u.email}
                                            </div>
                                            {#if u.discord_id}
                                                <div class="text-[10px] text-indigo-500 font-medium flex items-center gap-1">
                                                     <div class="w-2.5 h-2.5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[6px] font-bold text-indigo-500">D</div>
                                                     {u.discord_id}
                                                </div>
                                            {/if}
                                        </div>
                                    </div>
                                </td>
                                <td class="px-6 py-4">
                                    {#if u.role === 'admin'}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px] font-bold uppercase tracking-wider border border-purple-200 dark:border-purple-800">
                                            <Shield size={10} /> {$_('users__role_admin')}
                                        </span>
                                    {:else}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider border border-gray-200 dark:border-gray-600">
                                            <UserIcon size={10} /> {$_('users__role_user')}
                                        </span>
                                    {/if}
                                </td>
                                <td class="px-6 py-4">
                                    {#if u.is_active}
                                        <span class="inline-flex items-center gap-1 text-green-500 text-xs font-medium">
                                            <CheckCircle2 size={14} /> {$_('users__status_active')}
                                        </span>
                                    {:else}
                                        <span class="inline-flex items-center gap-1 text-amber-500 text-xs font-medium">
                                            <Calendar size={14} /> {$_('users__status_pending')}
                                        </span>
                                    {/if}
                                </td>
                                <td class="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">
                                    {formatDate(u.created_at)}
                                </td>
                                <td class="px-6 py-4 text-right">
                                    <button 
                                        on:click={(e) => toggleMenu(u, e)}
                                        class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                                    >
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

    <!-- Dropdown Portal (Fixed Position) -->
    {#if openMenuId && openMenuUser}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div 
            class="fixed flex flex-col min-w-[160px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-[2000] py-1 animate-zoom-in"
            style="top: {menuPos.top}px; left: {menuPos.left}px;"
            on:click|stopPropagation
        >
            {#if !openMenuUser.is_active}
                <button 
                    on:click={() => handleCopyInvite(openMenuUser.setup_token)}
                    class="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                    <KeyRound size={14} class="text-indigo-500" />
                    {$_('users__action_copy_setup')}
                </button>
            {/if}
            <button 
                on:click={() => handleEdit(openMenuUser)}
                class="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
                <Edit2 size={14} class="text-blue-500" />
                {$_('users__action_edit')}
            </button>
            <div class="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
            <button 
                on:click={() => confirmDelete(openMenuUser)}
                class="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
                <Trash2 size={14} />
                {$_('users__action_delete')}
            </button>
        </div>
    {/if}

    <!-- Delete Confirmation Modal -->
    {#if showDeleteConfirm}
        <div class="fixed inset-0 z-[1100] flex items-center justify-center p-4">
            <button 
                class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm w-full h-full border-none cursor-default" 
                on:click={() => showDeleteConfirm = false}
                aria-label="Close modal"
                type="button"
            ></button>
            <div class="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 animate-zoom-in">
                <div class="flex flex-col items-center text-center">
                    <div class="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500 mb-4 ring-8 ring-red-50 dark:ring-red-900/10">
                        <Trash2 size={32} />
                    </div>
                    <h3 class="text-lg font-bold text-gray-900 dark:text-white">{$_('users__delete_title')}</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        {$_('users__delete_confirm_text', { values: { email: userToDelete?.email } })}
                    </p>
                </div>
                <div class="grid grid-cols-2 gap-3 mt-8">
                    <button 
                        on:click={() => showDeleteConfirm = false}
                        class="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    >
                        {$_('users__btn_cancel')}
                    </button>
                    <button 
                        on:click={handleDelete}
                        disabled={deleteLoading}
                        class="px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2"
                    >
                        {#if deleteLoading}
                            <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        {:else}
                            {$_('users__btn_confirm_delete')}
                        {/if}
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- Add User Modal -->
    {#if showAddModal}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="fixed inset-0 z-1000 flex items-center justify-center p-4 sm:p-6" on:click|self={resetForm}>
            <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-fade-in-quick"></div>
            
            <div class="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-zoom-in">
                <!-- Modal Header -->
                <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <div>
                        <h2 class="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            {#if editingUser}
                                <Edit2 class="text-indigo-500" size={24} />
                                Update User
                            {:else}
                                <UserPlus class="text-indigo-500" size={24} />
                                {$_('users__modal_title')}
                            {/if}
                        </h2>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{editingUser ? 'Edit user profile information' : $_('users__modal_subtitle')}</p>
                    </div>
                    <button on:click={resetForm} class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <!-- Modal Body -->
                <div class="p-6 max-h-[70vh] overflow-y-auto">
                    <form on:submit|preventDefault={handleInvite} class="space-y-4">
                        <!-- Role Selection -->
                        <div class="grid grid-cols-2 gap-3 mb-2">
                            <button
                                type="button"
                                on:click={() => formData.role = 'user'}
                                class="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border transition-all {formData.role === 'user' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-500 font-bold' : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'}"
                            >
                                <UserIcon size={14} />
                                <span class="text-xs">{$_('users__role_user')}</span>
                            </button>
                            <button
                                type="button"
                                on:click={() => formData.role = 'admin'}
                                class="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border transition-all {formData.role === 'admin' ? 'bg-purple-500/10 border-purple-500 text-purple-500 font-bold' : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'}"
                            >
                                <Shield size={14} />
                                <span class="text-xs">{$_('users__role_admin')}</span>
                            </button>
                        </div>

                        <!-- Registration Mode (Only for New Users) -->
                        {#if !editingUser}
                        <div class="flex p-1 bg-gray-100 dark:bg-gray-950 rounded-xl mb-4">
                            <button
                                type="button"
                                on:click={() => registrationMode = 'invite'}
                                class="flex-1 py-2 text-xs font-bold rounded-lg transition-all {registrationMode === 'invite' ? 'bg-white dark:bg-gray-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500'}"
                            >
                                <span class="flex items-center justify-center gap-2">
                                    <Mail size={14} /> {$_('users__mode_invite')}
                                </span>
                            </button>
                            <button
                                type="button"
                                on:click={() => registrationMode = 'password'}
                                class="flex-1 py-2 text-xs font-bold rounded-lg transition-all {registrationMode === 'password' ? 'bg-white dark:bg-gray-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500'}"
                            >
                                <span class="flex items-center justify-center gap-2">
                                    <KeyRound size={14} /> {$_('users__mode_password')}
                                </span>
                            </button>
                        </div>
                        {/if}

                        <!-- Email -->
                        <div>
                            <label for="email" class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{$_('users__form_email')}</label>
                            <div class="relative">
                                <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                                    <Mail size={16} />
                                </div>
                                <input
                                    type="email"
                                    id="email"
                                    bind:value={formData.email}
                                    required
                                    readonly={!!editingUser}
                                    placeholder="colleague@example.com"
                                    class="w-full pl-11 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all {editingUser ? 'opacity-60 cursor-not-allowed' : ''}"
                                />
                            </div>
                        </div>

                        <!-- Password (if set password mode or editing existing) -->
                        {#if registrationMode === 'password' || editingUser}
                            <div class="animate-fade-in">
                                <label for="password" class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                                    {editingUser ? 'Reset Password (optional)' : $_('users__form_password')}
                                </label>
                                <div class="relative">
                                    <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                                        <KeyRound size={16} />
                                    </div>
                                    <input
                                        type="password"
                                        id="password"
                                        bind:value={formData.password}
                                        required={!editingUser}
                                        placeholder={editingUser ? "Leave blank to keep current" : "••••••••"}
                                        class="w-full pl-11 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        {/if}

                        <!-- Personal Info -->
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label for="first_name" class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{$_('users__form_first_name')}</label>
                                <div class="relative">
                                    <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                                        <UserIcon size={16} />
                                    </div>
                                    <input
                                        id="first_name"
                                        bind:value={formData.first_name}
                                        placeholder="John"
                                        class="w-full pl-11 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div>
                                <label for="last_name" class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{$_('users__form_last_name')}</label>
                                <input
                                    id="last_name"
                                    bind:value={formData.last_name}
                                    placeholder="Doe"
                                    class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label for="nickname" class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{$_('users__form_nickname')}</label>
                                <div class="relative">
                                    <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                                        <Tag size={16} />
                                    </div>
                                    <input
                                        id="nickname"
                                        bind:value={formData.nickname}
                                        placeholder="Johnny"
                                        class="w-full pl-11 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div>
                                <label for="position" class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{$_('users__form_position')}</label>
                                <div class="relative">
                                    <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                                        <Briefcase size={16} />
                                    </div>
                                    <input
                                        id="position"
                                        bind:value={formData.position}
                                        placeholder="Developer"
                                        class="w-full pl-11 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- Discord ID -->
                        <div>
                            <label for="discord_id" class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{$_('users__form_discord_id')}</label>
                            <div class="relative">
                                <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                                    <div class="w-4 h-4 rounded-full bg-indigo-500/20 flex items-center justify-center text-[8px] font-bold text-indigo-500">D</div>
                                </div>
                                <input
                                    id="discord_id"
                                    bind:value={formData.discord_id}
                                    placeholder="123456789012345678"
                                    class="w-full pl-11 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {#if addError}
                            <div class="bg-red-500/10 border border-red-500/20 text-red-500 text-sm py-3 px-4 rounded-xl flex items-center gap-2 animate-fade-in">
                                <XCircle size={16} />
                                {addError}
                            </div>
                        {/if}

                        {#if setupLink}
                            <div class="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl animate-fade-in space-y-3">
                                <div class="flex items-center gap-2 text-indigo-500 dark:text-indigo-400 text-sm font-bold border-b border-indigo-500/20 pb-2">
                                     <CheckCircle2 size={16} /> {$_('users__invite_link_generated')}
                                </div>
                                <p class="text-xs text-gray-500 dark:text-gray-400">{$_('users__copy_link_hint')}</p>
                                <div class="flex gap-2">
                                    <input readonly value={setupLink} class="flex-1 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg py-1.5 px-3 text-xs text-indigo-600 dark:text-indigo-300 outline-none font-mono" />
                                    <button type="button" on:click={() => { navigator.clipboard.writeText(setupLink); }} class="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">{$_('users__btn_copy')}</button>
                                </div>
                            </div>
                        {/if}

                        <div class="flex gap-3 pt-2">
                            <button
                                type="button"
                                on:click={resetForm}
                                class="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                            >
                                {$_('users__btn_cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={addLoading}
                                class="flex-[2] py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 group"
                            >
                                {#if addLoading}
                                    <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                {:else}
                                    {#if editingUser}
                                        Update Profile
                                    {:else}
                                        {registrationMode === 'invite' ? $_('users__btn_create_invite') : $_('users__btn_create_user')}
                                    {/if}
                                    <ArrowRight size={18} class="group-hover:translate-x-1 transition-transform" />
                                {/if}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    {/if}

    <!-- Toast Notification -->
    {#if showToast}
        <div class="fixed bottom-8 right-8 z-[2000] animate-zoom-in">
            <div class="bg-success text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-3 ring-1 ring-black/5 dark:ring-white/5">
                <div class="flex items-center justify-center bg-white/20 rounded-full w-8 h-8 backdrop-blur-md">
                    <CheckCircle2 size={18} />
                </div>
                <span class="text-sm font-bold tracking-wide">{toastMessage}</span>
            </div>
        </div>
    {/if}
</div>

<style>
    .animate-fade-in {
        animation: fadeIn 0.4s ease-out;
    }

    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }

    .animate-fade-in-quick {
        animation: fadeInQuick 0.2s ease-out;
    }

    @keyframes fadeInQuick {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    .animate-zoom-in {
        animation: zoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes zoomIn {
        from { opacity: 0; transform: scale(0.95) translateY(10px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
    }
</style>
