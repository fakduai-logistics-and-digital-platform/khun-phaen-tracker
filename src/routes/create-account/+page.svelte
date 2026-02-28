<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { base } from '$app/paths';
    import { _ } from 'svelte-i18n';
    import { user, authLoading } from '$lib/stores/auth';
    import { api } from '$lib/apis';
    import { Mail, ArrowRight, Zap, CheckCircle2, User, Briefcase, Tag, Shield } from 'lucide-svelte';

    onMount(() => {
        if (!$authLoading && (!$user || $user.role !== 'admin')) {
            goto(`${base}/dashboard`);
        }
    });

    let formData = {
        email: '',
        role: 'user',
        first_name: '',
        last_name: '',
        nickname: '',
        position: ''
    };
    let loading = false;
    let error = '';
    let setupLink = '';

    async function handleInvite() {
        loading = true;
        error = '';
        setupLink = '';

        try {
            const res = await api.auth.invite(formData);
            const data = await res.json();

            if (res.ok) {
                setupLink = window.location.origin + base + data.setup_link;
            } else {
                error = data.error || 'Invitation failed';
            }
        } catch (e) {
            error = 'Invitation failed';
        } finally {
            loading = false;
        }
    }

    const valueProps = [
        "Local-first task synchronization",
        "Peer-to-peer real-time updates",
        "Encrypted & secure by default"
    ];
</script>

<div class="h-screen w-full flex bg-[#030712] overflow-hidden font-sans">
    
    <!-- Left Pattern/Branding Section - Hidden on mobile -->
    <div class="hidden lg:flex w-1/2 relative flex-col justify-between p-12 overflow-hidden bg-[#0A0F1C] border-r border-white/5">
        <!-- Animated Background Blur Effects -->
        <div class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div class="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen opacity-50"></div>
            <div class="absolute bottom-[-10%] right-[-10%] w-[80%] h-[80%] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen opacity-50"></div>
        </div>

        <div class="relative z-10">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center transform -rotate-3 shadow-lg shadow-indigo-500/20">
                    <Zap class="w-5 h-5 text-white fill-white/20" />
                </div>
                <span class="text-2xl font-bold text-white tracking-tight">Khun Phaen</span>
            </div>
        </div>

        <div class="relative z-10 mb-10 pl-4">
            <h2 class="text-5xl font-extrabold text-white mb-6 leading-[1.15] tracking-tight">
                Start building <br/>
                <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">better workflows.</span>
            </h2>
            <p class="text-lg text-slate-400/90 max-w-md leading-relaxed mb-10">
                Join our platform to organize tasks effectively using localized logic and seamless peer-to-peer synchronization.
            </p>

            <div class="space-y-4">
                {#each valueProps as prop}
                    <div class="flex items-center gap-3 text-slate-300">
                        <CheckCircle2 class="w-5 h-5 text-indigo-400" />
                        <span class="font-medium text-sm">{prop}</span>
                    </div>
                {/each}
            </div>
        </div>

        <div class="relative z-10 flex gap-6 text-sm font-medium text-slate-500">
            <a href="#!" class="hover:text-white transition-colors">Privacy</a>
            <a href="#!" class="hover:text-white transition-colors">Terms</a>
        </div>
    </div>

    <!-- Right Register Section -->
    <div class="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative bg-[#030712]">
        
        <!-- Mobile subtle background glow -->
        <div class="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none lg:hidden">
            <div class="absolute top-1/4 left-1/2 -translate-x-1/2 w-full h-1/2 bg-indigo-600/10 rounded-full blur-[100px] mix-blend-screen opacity-50"></div>
        </div>

        <div class="max-w-[420px] w-full relative z-10">
            
            <!-- Mobile Logo -->
            <div class="lg:hidden flex justify-center mb-8">
                <div class="w-12 h-12 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center transform -rotate-3 shadow-lg shadow-indigo-500/20">
                    <Zap class="w-6 h-6 text-white fill-white/20" />
                </div>
            </div>

            <div class="text-center lg:text-left mb-8">
                <h1 class="text-3xl font-bold text-white mb-2 tracking-tight">Create Account</h1>
                <p class="text-slate-400 text-sm">Create a new user and assign permissions.</p>
            </div>

            <form on:submit|preventDefault={handleInvite} class="space-y-4">
                <div class="grid grid-cols-2 gap-3 mb-2">
                    <button
                        type="button"
                        on:click={() => formData.role = 'user'}
                        class="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border transition-all {formData.role === 'user' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400 font-bold' : 'bg-slate-900/50 border-slate-700/50 text-slate-500 hover:border-slate-600'}"
                    >
                        <User size={14} />
                        <span class="text-xs">Regular User</span>
                    </button>
                    <button
                        type="button"
                        on:click={() => formData.role = 'admin'}
                        class="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border transition-all {formData.role === 'admin' ? 'bg-purple-500/20 border-purple-500 text-purple-400 font-bold' : 'bg-slate-900/50 border-slate-700/50 text-slate-500 hover:border-slate-600'}"
                    >
                        <Shield size={14} />
                        <span class="text-xs">Admin Access</span>
                    </button>
                </div>
                <div>
                    <label for="email" class="block text-sm font-medium text-slate-300 mb-1.5">Email *</label>
                    <div class="relative group">
                        <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                            <Mail size={16} />
                        </div>
                        <input
                            type="email"
                            id="email"
                            bind:value={formData.email}
                            required
                            placeholder="colleague@example.com"
                            class="w-full pl-11 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all duration-300"
                        />
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label for="first_name" class="block text-sm font-medium text-slate-300 mb-1.5">First Name</label>
                        <div class="relative group">
                            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                <User size={16} />
                            </div>
                            <input
                                id="first_name"
                                bind:value={formData.first_name}
                                placeholder="John"
                                class="w-full pl-11 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>
                    </div>
                    <div>
                        <label for="last_name" class="block text-sm font-medium text-slate-300 mb-1.5">Last Name</label>
                        <div class="relative group">
                            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                <User size={16} />
                            </div>
                            <input
                                id="last_name"
                                bind:value={formData.last_name}
                                placeholder="Doe"
                                class="w-full pl-11 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label for="nickname" class="block text-sm font-medium text-slate-300 mb-1.5">Nickname</label>
                        <div class="relative group">
                            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                <Tag size={16} />
                            </div>
                            <input
                                id="nickname"
                                bind:value={formData.nickname}
                                placeholder="Johnny"
                                class="w-full pl-11 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>
                    </div>
                    <div>
                        <label for="position" class="block text-sm font-medium text-slate-300 mb-1.5">Position</label>
                        <div class="relative group">
                            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                <Briefcase size={16} />
                            </div>
                            <input
                                id="position"
                                bind:value={formData.position}
                                placeholder="Developer"
                                class="w-full pl-11 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>

                {#if error}
                    <div class="bg-red-500/10 border border-red-500/20 text-red-500 text-sm py-3 px-4 rounded-xl flex items-center gap-2 animate-fade-in">
                        <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        {error}
                    </div>
                {/if}

                {#if setupLink}
                    <div class="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl animate-fade-in space-y-3">
                        <div class="flex items-center gap-2 text-indigo-400 text-sm font-medium border-b border-indigo-500/20 pb-2">
                             <CheckCircle2 size={16} /> Invitation link generated
                        </div>
                        <p class="text-xs text-slate-400">Copy this link and send it to the user:</p>
                        <div class="flex gap-2">
                            <input readonly value={setupLink} class="flex-1 bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-indigo-300 outline-none" />
                            <button type="button" on:click={() => { navigator.clipboard.writeText(setupLink); }} class="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">Copy</button>
                        </div>
                    </div>
                {/if}

                <button
                    type="submit"
                    disabled={loading}
                    class="w-full py-3.5 px-4 mt-2 bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all duration-300 flex items-center justify-center gap-2 group border border-transparent"
                >
                    {#if loading}
                        <div class="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></div>
                    {:else}
                        Create Invitation
                        <ArrowRight size={18} class="group-hover:translate-x-1 transition-transform" />
                    {/if}
                </button>
            </form>


            <div class="mt-8 text-center text-sm">
                <span class="text-slate-500">Already have an account?</span>
                <a href="{base}/login" class="text-indigo-400 hover:text-indigo-300 font-medium ml-1.5 hover:underline underline-offset-4 transition-colors">
                    Log in
                </a>
            </div>
        </div>
    </div>
</div>

<style>
    /* CSS Fix for WebKit Autofill replacing backgrounds */
    input:-webkit-autofill,
    input:-webkit-autofill:hover,
    input:-webkit-autofill:focus,
    input:-webkit-autofill:active {
        -webkit-box-shadow: 0 0 0 30px #0f172a inset !important;
        -webkit-text-fill-color: white !important;
        caret-color: white !important;
        transition: background-color 5000s ease-in-out 0s;
    }
</style>
