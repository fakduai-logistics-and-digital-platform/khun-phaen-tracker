<script lang="ts">
    import { goto } from '$app/navigation';
    import { base } from '$app/paths';
    import { _ } from 'svelte-i18n';
    import { Mail, Lock, ArrowRight, Zap, CheckCircle2 } from 'lucide-svelte';

    import { user } from '$lib/stores/auth';
    import { api } from '$lib/apis';

    let email = '';
    let password = '';
    let loading = false;
    let error = '';

    async function handleLogin() {
        loading = true;
        error = '';

        try {
            const res = await api.auth.login(email, password);

            const data = await res.json();

            if (res.ok) {
                // Set cookie on client side
                document.cookie = `_khun_ph_token=${data.token}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=Lax`;
                
                const userEmail = data.email || email;
                const userId = data.id || "";
                localStorage.setItem("user_email", userEmail);
                if (userId) localStorage.setItem("user_id", userId);
                user.set({ id: userId, email: userEmail });
                goto(`${base}/dashboard`);
            } else {
                error = data.error || 'Login failed';
            }
        } catch (e) {
            error = 'Login failed';
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
                Welcome back to <br/>
                <span class="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">your workspace.</span>
            </h2>
            <p class="text-lg text-slate-400/90 max-w-md leading-relaxed mb-10">
                Sign in to continue managing your tasks securely with our blazing fast, offline-first application.
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

    <!-- Right Login Section -->
    <div class="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative bg-[#030712]">
        
        <!-- Mobile subtle background glow -->
        <div class="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none lg:hidden">
            <div class="absolute top-1/4 left-1/2 -translate-x-1/2 w-full h-1/2 bg-purple-600/10 rounded-full blur-[100px] mix-blend-screen opacity-50"></div>
        </div>

        <div class="max-w-[420px] w-full relative z-10">
            
            <!-- Mobile Logo -->
            <div class="lg:hidden flex justify-center mb-8">
                <div class="w-12 h-12 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center transform -rotate-3 shadow-lg shadow-indigo-500/20">
                    <Zap class="w-6 h-6 text-white fill-white/20" />
                </div>
            </div>

            <div class="text-center lg:text-left mb-10">
                <h1 class="text-3xl font-bold text-white mb-3 tracking-tight">Log in</h1>
                <p class="text-slate-400 text-sm">Welcome back! Please enter your details.</p>
            </div>

            <form on:submit|preventDefault={handleLogin} class="space-y-5">
                <div>
                    <label for="email" class="block text-sm font-medium text-slate-300 mb-2">Email</label>
                    <div class="relative group">
                        <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                            <Mail size={18} />
                        </div>
                        <input
                            type="email"
                            id="email"
                            bind:value={email}
                            required
                            placeholder="you@example.com"
                            class="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all duration-300"
                        />
                    </div>
                </div>

                <div>
                    <div class="flex justify-between items-center mb-2">
                        <label for="password" class="block text-sm font-medium text-slate-300">Password</label>
                        <a href="#!" class="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors">Forgot password?</a>
                    </div>
                    <div class="relative group">
                        <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                            <Lock size={18} />
                        </div>
                        <input
                            type="password"
                            id="password"
                            bind:value={password}
                            required
                            placeholder="••••••••"
                            class="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all duration-300"
                        />
                    </div>
                </div>

                {#if error}
                    <div class="bg-red-500/10 border border-red-500/20 text-red-500 text-sm py-3 px-4 rounded-xl flex items-center gap-2 animate-fade-in">
                        <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        {error}
                    </div>
                {/if}

                <button
                    type="submit"
                    disabled={loading}
                    class="w-full py-3.5 px-4 mt-2 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all duration-300 flex items-center justify-center gap-2 group border border-transparent hover:border-white/20"
                >
                    {#if loading}
                        <div class="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></div>
                    {:else}
                        Log in
                        <ArrowRight size={18} class="group-hover:translate-x-1 transition-transform" />
                    {/if}
                </button>
            </form>

            <div class="mt-8 text-center text-sm">
                <span class="text-slate-500">Don't have an account?</span>
                <a href="{base}/register" class="text-indigo-400 hover:text-indigo-300 font-medium ml-1.5 hover:underline underline-offset-4 transition-colors">
                    Sign up
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
