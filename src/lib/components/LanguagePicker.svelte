<script lang="ts">
	import { locale } from 'svelte-i18n';
	import { changeLocale } from '$lib/i18n';
	import { Languages, Check } from 'lucide-svelte';
	import { onMount } from 'svelte';

	export let isDark = true;

	let showDropdown = false;
	const languages = [
		{ code: 'th', label: 'ไทย', flag: '🇹🇭' },
		{ code: 'en', label: 'English', flag: '🇺🇸' }
	];

	function handleToggle() {
		showDropdown = !showDropdown;
	}

	function selectLanguage(code: string) {
		changeLocale(code);
		showDropdown = false;
	}

	// Close on click outside
	let container: HTMLDivElement;
	function handleClickOutside(event: MouseEvent) {
		if (container && !container.contains(event.target as Node)) {
			showDropdown = false;
		}
	}

	onMount(() => {
		window.addEventListener('click', handleClickOutside);
		return () => window.removeEventListener('click', handleClickOutside);
	});
</script>

<div class="relative inline-block" bind:this={container}>
	<button
		type="button"
		on:click={handleToggle}
		class="flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 border {isDark
			? 'bg-slate-900/50 border-slate-700/50 text-slate-300 hover:bg-slate-800'
			: 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}"
	>
		<Languages size={18} class="text-primary" />
		<span class="text-sm font-medium uppercase">{$locale}</span>
	</button>

	{#if showDropdown}
		<div
			class="absolute right-0 mt-2 w-40 rounded-xl shadow-2xl overflow-hidden z-50 border animate-fade-in {isDark
				? 'bg-[#0A0F1C] border-white/5'
				: 'bg-white border-slate-200'}"
		>
			<div class="py-1">
				{#each languages as lang}
					<button
						type="button"
						on:click={() => selectLanguage(lang.code)}
						class="w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors {isDark
							? $locale === lang.code
								? 'bg-primary/10 text-primary'
								: 'text-slate-300 hover:bg-white/5'
							: $locale === lang.code
								? 'bg-primary/5 text-primary'
								: 'text-slate-600 hover:bg-slate-50'}"
					>
						<div class="flex items-center gap-2">
							<span>{lang.flag}</span>
							<span>{lang.label}</span>
						</div>
						{#if $locale === lang.code}
							<Check size={14} />
						{/if}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.animate-fade-in {
		animation: fadeIn 0.2s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
