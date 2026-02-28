<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { X, User, Lock, Mail, Save, Fingerprint, AtSign } from 'lucide-svelte';
	import { _ } from 'svelte-i18n';
	import { api } from '$lib/apis';
	import { user } from '$lib/stores/auth';

	const dispatch = createEventDispatcher<{
		close: void;
		notify: { message: string; type: 'success' | 'error' };
	}>();

	export let open = false;

	let loading = false;
	let error = '';
    
	// Form data
	let firstName = $user?.profile?.first_name || '';
	let lastName = $user?.profile?.last_name || '';
	let nickname = $user?.profile?.nickname || '';
	let position = $user?.profile?.position || '';
	let discordId = $user?.discord_id || '';
	let password = '';
	let confirmPassword = '';

	async function handleSubmit() {
		if (password && password !== confirmPassword) {
			error = $_('profileModal__password_mismatch');
			return;
		}

		loading = true;
		error = '';

		try {
			const payload: Record<string, any> = {
				first_name: firstName,
				last_name: lastName,
				nickname: nickname,
				position: position,
				discord_id: discordId
			};

			if (password) {
				payload.password = password;
			}

			const res = await api.auth.updateMe(payload);
			const data = await res.json();

			if (data.success) {
				dispatch('notify', { message: $_('profileModal__save_success'), type: 'success' });
				
				// Update local user store
				if ($user) {
					user.update(u => {
						if (!u) return u;
						return {
							...u,
							discord_id: discordId,
							profile: {
								...(u.profile || { profile_id: '', user_id: u.user_id }),
								first_name: firstName,
								last_name: lastName,
								nickname: nickname,
								position: position
							}
						};
					});
				}
				
				dispatch('close');
			} else {
				error = data.error || $_('profileModal__save_error');
			}
		} catch (e) {
			console.error('Update profile failed:', e);
			error = $_('profileModal__save_error');
		} finally {
			loading = false;
		}
	}
</script>

{#if open}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 transition-all duration-300"
		on:click|self={() => dispatch('close')}
	>
		<div
			class="bg-white dark:bg-gray-900 w-full max-w-xl rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col"
		>
			<div class="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
				<div>
					<h3 class="text-lg font-bold text-gray-900 dark:text-white">{$_('profileModal__title')}</h3>
					<p class="text-xs text-gray-500 dark:text-gray-400">{$_('profileModal__subtitle')}</p>
				</div>
				<button
					on:click={() => dispatch('close')}
					class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
				>
					<X size={20} />
				</button>
			</div>

			<div class="flex-1 overflow-y-auto p-6">
				<form on:submit|preventDefault={handleSubmit} class="space-y-6">
					{#if error}
						<div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium">
							{error}
						</div>
					{/if}

					<div class="space-y-4">
						<!-- Email (Read-only) -->
						<div>
							<label for="email" class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
								<Mail size={12} />
								{$_('profileModal__email_readonly')}
							</label>
							<div class="relative">
								<input
									type="email"
									id="email"
									value={$user?.email}
									disabled
									class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-500 text-sm cursor-not-allowed"
								/>
                                <div class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    <Lock size={14} />
                                </div>
							</div>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<!-- First Name -->
							<div>
								<label for="firstName" class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
									{$_('users__form_first_name')}
								</label>
                                <div class="relative group">
                                    <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                        <User size={16} />
                                    </div>
                                    <input
                                        type="text"
                                        id="firstName"
                                        bind:value={firstName}
                                        class="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                        placeholder="John"
                                    />
                                </div>
							</div>

							<!-- Last Name -->
							<div>
								<label for="lastName" class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
									{$_('users__form_last_name')}
								</label>
                                <div class="relative group">
                                    <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                        <User size={16} />
                                    </div>
                                    <input
                                        type="text"
                                        id="lastName"
                                        bind:value={lastName}
                                        class="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                        placeholder="Doe"
                                    />
                                </div>
							</div>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<!-- Nickname -->
							<div>
								<label for="nickname" class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
									{$_('users__form_nickname')}
								</label>
                                <div class="relative group">
                                    <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                        <AtSign size={16} />
                                    </div>
                                    <input
                                        type="text"
                                        id="nickname"
                                        bind:value={nickname}
                                        class="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                        placeholder="Johnny"
                                    />
                                </div>
							</div>

							<!-- Position -->
							<div>
								<label for="position" class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
									{$_('users__form_position')}
								</label>
                                <div class="relative group">
                                    <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                        <Fingerprint size={16} />
                                    </div>
                                    <input
                                        type="text"
                                        id="position"
                                        bind:value={position}
                                        class="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                        placeholder="Developer"
                                    />
                                </div>
							</div>
						</div>

						<!-- Discord ID -->
						<div>
							<label for="discordId" class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
								{$_('users__form_discord_id')}
							</label>
                            <div class="relative group">
                                <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                    <!-- Discord Icon (simple SVG) -->
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.196.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z"/>
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    id="discordId"
                                    bind:value={discordId}
                                    class="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                    placeholder="user#1234"
                                />
                            </div>
						</div>

						<hr class="border-gray-100 dark:border-gray-800 my-4" />

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<!-- Password -->
							<div>
								<label for="password" class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
									{$_('profileModal__new_password')}
								</label>
                                <div class="relative group">
                                    <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                        <Lock size={16} />
                                    </div>
                                    <input
                                        type="password"
                                        id="password"
                                        bind:value={password}
                                        class="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                        placeholder="••••••••"
                                    />
                                </div>
							</div>

							<!-- Confirm Password -->
							<div>
								<label for="confirmPassword" class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
									{$_('profileModal__confirm_password')}
								</label>
                                <div class="relative group">
                                    <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                        <Lock size={16} />
                                    </div>
                                    <input
                                        type="password"
                                        id="confirmPassword"
                                        bind:value={confirmPassword}
                                        class="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                        placeholder="••••••••"
                                    />
                                </div>
							</div>
						</div>
					</div>

					<div class="pt-4">
						<button
							type="submit"
							disabled={loading}
							class="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-400 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
						>
							{#if loading}
								<div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
							{:else}
								<Save size={18} />
							{/if}
							{$_('profileModal__btn_save')}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}
