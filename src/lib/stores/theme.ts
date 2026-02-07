import { writable } from 'svelte/store';

const STORAGE_KEY = 'khu-phaen-theme';

type Theme = 'light' | 'dark' | 'system';

function createThemeStore() {
	// Get initial value from localStorage or default to 'system'
	const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
	const initial: Theme = (stored as Theme) || 'system';

	const { subscribe, set } = writable<Theme>(initial);

	function applyTheme(theme: Theme) {
		if (typeof window === 'undefined') return;

		const root = document.documentElement;
		const isDark =
			theme === 'dark' ||
			(theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

		if (isDark) {
			root.classList.add('dark');
		} else {
			root.classList.remove('dark');
		}

		localStorage.setItem(STORAGE_KEY, theme);
	}

	// Apply initial theme
	if (typeof window !== 'undefined') {
		applyTheme(initial);

		// Listen for system theme changes
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
			const current = localStorage.getItem(STORAGE_KEY) as Theme || 'system';
			if (current === 'system') {
				applyTheme('system');
			}
		});
	}

	// Keep track of current value for toggle
	let currentTheme: Theme = initial;

	subscribe((value) => {
		currentTheme = value;
	});

	return {
		subscribe,
		set: (theme: Theme) => {
			set(theme);
			applyTheme(theme);
		},
		toggle: () => {
			// Determine if currently dark (either 'dark' or 'system' with dark preference)
			const isCurrentlyDark =
				currentTheme === 'dark' ||
				(currentTheme === 'system' && typeof window !== 'undefined' &&
					window.matchMedia('(prefers-color-scheme: dark)').matches);

			// Toggle to the opposite
			const next: Theme = isCurrentlyDark ? 'light' : 'dark';
			set(next);
			applyTheme(next);
		}
	};
}

export const theme = createThemeStore();
