<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { base } from '$app/paths';
    import { Lock, ArrowRight, Zap, CheckCircle2, ShieldCheck } from 'lucide-svelte';
    import { api } from '$lib/apis';

    let token = '';
    let password = '';
    let confirmPassword = '';
    let loading = false;
    let error = '';
    let success = false;

    let email = '';
    let initializing = true;

    onMount(async () => {
        token = $page.url.searchParams.get('token') || '';
        if (!token) {
            error = 'Invalid or missing invitation token.';
            initializing = false;
            return;
        }

        try {
            const res = await api.auth.getSetupInfo(token);
            const data = await res.json();
            if (res.ok) {
                email = data.email;
            } else {
                // If token invalid, maybe user is already active or token expired
                error = data.error || 'Invalid or expired token.';
                // Redirect after a short delay if it's an "expired" sense
                setTimeout(() => {
                    goto(`${base}/login`);
                }, 3000);
            }
        } catch (e) {
            error = 'Failed to verify token.';
        } finally {
            initializing = false;
        }
    });

    async function handleSetup() {
        if (!token) return;
        
        if (password.length < 8) {
            error = 'Password must be at least 8 characters long.';
            return;
        }

        if (password !== confirmPassword) {
            error = 'Passwords do not match.';
            return;
        }

        loading = true;
        error = '';

        try {
            const res = await api.auth.setupPassword(token, password);
            const data = await res.json();

            if (res.ok) {
                success = true;
                setTimeout(() => {
                    goto(`${base}/login`);
                }, 3000);
            } else {
                error = data.error || 'Failed to set up password.';
            }
        } catch (e) {
            error = 'An error occurred. Please try again.';
        } finally {
            loading = false;
        }
    }
</script>

<div class="h-screen w-full flex bg-[#030712] overflow-hidden font-sans">
    <div class="hidden lg:flex w-1/2 relative flex-col justify-between p-12 overflow-hidden bg-[#0A0F1C] border-r border-white/5">
        <div class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div class="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen opacity-50"></div>
            <div class="absolute bottom-[-10%] right-[-10%] w-[80%] h-[80%] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen opacity-50"></div>
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
                Secure your <br/>
                <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">new account.</span>
            </h2>
            <p class="text-lg text-slate-400/90 max-w-md leading-relaxed mb-10">
                You've been invited to join the workspace. Please set up your secure password to get started.
            </p>

            <div class="space-y-4">
                <div class="flex items-center gap-3 text-slate-300">
                    <CheckCircle2 class="w-5 h-5 text-indigo-400" />
                    <span class="font-medium text-sm">Secure hashed passwords</span>
                </div>
                <div class="flex items-center gap-3 text-slate-300">
                    <CheckCircle2 class="w-5 h-5 text-indigo-400" />
                    <span class="font-medium text-sm">Instant access after setup</span>
                </div>
            </div>
        </div>

        <div class="relative z-10 flex gap-6 text-sm font-medium text-slate-500">
            <span>Powered by Offline-first logic</span>
        </div>
    </div>

    <div class="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative bg-[#030712]">
        <div class="max-w-[420px] w-full relative z-10">
            {#if success}
                <div class="text-center animate-fade-in">
                    <div class="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ShieldCheck class="w-10 h-10 text-green-500" />
                    </div>
                    <h1 class="text-3xl font-bold text-white mb-4">Password Set!</h1>
                    <p class="text-slate-400 mb-8">Your account is now active. Redirecting you to login...</p>
                    <div class="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div class="h-full bg-green-500 animate-progress"></div>
                    </div>
                </div>
            {:else}
                <div class="text-center lg:text-left mb-10">
                    <h1 class="text-3xl font-bold text-white mb-3 tracking-tight">Setup Password</h1>
                    {#if initializing}
                        <p class="text-slate-400 text-sm animate-pulse text-indigo-400">Verifying your token...</p>
                    {:else if email}
                        <p class="text-slate-400 text-sm">
                            Setting up password for <span class="text-indigo-400 font-semibold">{email}</span>
                        </p>
                    {:else}
                         <p class="text-slate-400 text-sm">Finalize your account by choosing a strong password.</p>
                    {/if}
                </div>

                <form on:submit|preventDefault={handleSetup} class="space-y-5">
                    <div>
                        <label for="password" class="block text-sm font-medium text-slate-300 mb-2">New Password</label>
                        <div class="relative group">
                            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                <Lock size={18} />
                            </div>
                            <input
                                type="password"
                                id="password"
                                bind:value={password}
                                required
                                minlength="8"
                                placeholder="••••••••"
                                class="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all duration-300"
                            />
                        </div>
                    </div>

                    <div>
                        <label for="confirmPassword" class="block text-sm font-medium text-slate-300 mb-2">Confirm Password</label>
                        <div class="relative group">
                            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                <Lock size={18} />
                            </div>
                            <input
                                type="password"
                                id="confirmPassword"
                                bind:value={confirmPassword}
                                required
                                placeholder="••••••••"
                                class="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all duration-300"
                            />
                        </div>
                    </div>

                    {#if error}
                        <div class="bg-red-500/10 border border-red-500/20 text-red-500 text-sm py-3 px-4 rounded-xl flex items-center gap-2">
                            <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            {error}
                        </div>
                    {/if}

                    <button
                        type="submit"
                        disabled={loading || !token}
                        class="w-full py-3.5 px-4 mt-2 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all duration-300 flex items-center justify-center gap-2 group border border-transparent hover:border-white/20"
                    >
                        {#if loading}
                            <div class="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></div>
                        {:else}
                            Create Account
                            <ArrowRight size={18} class="group-hover:translate-x-1 transition-transform" />
                        {/if}
                    </button>
                </form>
            {/if}
        </div>
    </div>
</div>

<style>
    @keyframes progress {
        from { width: 0%; }
        to { width: 100%; }
    }
    .animate-progress {
        animation: progress 3s linear forwards;
    }
</style>
