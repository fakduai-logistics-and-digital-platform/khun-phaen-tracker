<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { base } from '$app/paths';
    import { Lock, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-svelte';
    import { _ } from 'svelte-i18n';
    import { api } from '$lib/apis';
    import favicon from '$lib/assets/favicon.svg';

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
            error = $_('setup__error_no_token');
            initializing = false;
            return;
        }

        try {
            const res = await api.auth.getSetupInfo(token);
            const data = await res.json();
            if (res.ok) {
                email = data.email;
            } else {
                error = data.error || $_('setup__error_invalid_token');
                setTimeout(() => {
                    goto(`${base}/login`);
                }, 3000);
            }
        } catch (e) {
            error = $_('setup__error_verify');
        } finally {
            initializing = false;
        }
    });

    async function handleSetup() {
        if (!token) return;
        
        if (password.length < 8) {
            error = $_('setup__error_min_length');
            return;
        }

        if (password !== confirmPassword) {
            error = $_('setup__error_mismatch');
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
                error = data.error || $_('setup__error_default');
            }
        } catch (e) {
            error = $_('setup__error_generic');
        } finally {
            loading = false;
        }
    }
</script>

<div class="h-screen w-full flex bg-[#030712] overflow-hidden font-sans">
    <div class="hidden lg:flex w-1/2 relative flex-col justify-between p-12 overflow-hidden bg-[#0A0F1C] border-r border-white/5">
        <div class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div class="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-primary/20 rounded-full blur-[120px] mix-blend-screen opacity-50"></div>
            <div class="absolute bottom-[-10%] right-[-10%] w-[80%] h-[80%] bg-primary/15 rounded-full blur-[120px] mix-blend-screen opacity-50"></div>
        </div>

        <div class="relative z-10">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-gradient-to-tr from-primary/20 to-primary-dark/10 rounded-xl flex items-center justify-center ring-1 ring-primary/20 shadow-lg shadow-primary/20">
                    <img src={favicon} alt="Khun Phaen Logo" class="w-6 h-6 object-contain" />
                </div>
                <span class="text-2xl font-bold text-white tracking-tight">{$_('setup__brand_name')}</span>
            </div>
        </div>

        <div class="relative z-10 mb-10 pl-4">
            <h2 class="text-5xl font-extrabold text-white mb-6 leading-[1.15] tracking-tight">
                {$_('setup__hero_title_1')} <br/>
                <span class="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-dark">{$_('setup__hero_title_2')}</span>
            </h2>
            <p class="text-lg text-slate-400/90 max-w-md leading-relaxed mb-10">
                {$_('setup__hero_desc')}
            </p>

            <div class="space-y-4">
                <div class="flex items-center gap-3 text-slate-300">
                    <CheckCircle2 class="w-5 h-5 text-primary" />
                    <span class="font-medium text-sm">{$_('setup__value_prop_1')}</span>
                </div>
                <div class="flex items-center gap-3 text-slate-300">
                    <CheckCircle2 class="w-5 h-5 text-primary" />
                    <span class="font-medium text-sm">{$_('setup__value_prop_2')}</span>
                </div>
            </div>
        </div>

        <div class="relative z-10 flex gap-6 text-sm font-medium text-slate-500">
            <span>{$_('setup__footer_text')}</span>
        </div>
    </div>

    <div class="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative bg-[#030712]">
        <div class="max-w-[420px] w-full relative z-10">

            <!-- Mobile Logo -->
            <div class="lg:hidden flex justify-center mb-8">
                <div class="w-12 h-12 bg-gradient-to-tr from-primary/20 to-primary-dark/10 rounded-2xl flex items-center justify-center ring-1 ring-primary/20 shadow-lg shadow-primary/20">
                    <img src={favicon} alt="Khun Phaen Logo" class="w-7 h-7 object-contain" />
                </div>
            </div>

            {#if success}
                <div class="text-center animate-fade-in">
                    <div class="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ShieldCheck class="w-10 h-10 text-green-500" />
                    </div>
                    <h1 class="text-3xl font-bold text-white mb-4">{$_('setup__success_title')}</h1>
                    <p class="text-slate-400 mb-8">{$_('setup__success_desc')}</p>
                    <div class="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div class="h-full bg-green-500 animate-progress"></div>
                    </div>
                </div>
            {:else}
                <div class="text-center lg:text-left mb-10">
                    <h1 class="text-3xl font-bold text-white mb-3 tracking-tight">{$_('setup__title')}</h1>
                    {#if initializing}
                        <p class="text-slate-400 text-sm animate-pulse text-primary">{$_('setup__verifying_token')}</p>
                    {:else if email}
                        <p class="text-slate-400 text-sm">
                            {$_('setup__setting_up_for')} <span class="text-primary font-semibold">{email}</span>
                        </p>
                    {:else}
                         <p class="text-slate-400 text-sm">{$_('setup__default_subtitle')}</p>
                    {/if}
                </div>

                <form on:submit|preventDefault={handleSetup} class="space-y-5">
                    <div>
                        <label for="password" class="block text-sm font-medium text-slate-300 mb-2">{$_('setup__new_password_label')}</label>
                        <div class="relative group">
                            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
                                <Lock size={18} />
                            </div>
                            <input
                                type="password"
                                id="password"
                                bind:value={password}
                                required
                                minlength="8"
                                placeholder="••••••••"
                                class="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:bg-slate-900 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all duration-300"
                            />
                        </div>
                    </div>

                    <div>
                        <label for="confirmPassword" class="block text-sm font-medium text-slate-300 mb-2">{$_('setup__confirm_password_label')}</label>
                        <div class="relative group">
                            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
                                <Lock size={18} />
                            </div>
                            <input
                                type="password"
                                id="confirmPassword"
                                bind:value={confirmPassword}
                                required
                                placeholder="••••••••"
                                class="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:bg-slate-900 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all duration-300"
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
                        class="w-full py-3.5 px-4 mt-2 bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all duration-300 flex items-center justify-center gap-2 group border border-transparent"
                    >
                        {#if loading}
                            <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        {:else}
                            {$_('setup__btn_submit')}
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
