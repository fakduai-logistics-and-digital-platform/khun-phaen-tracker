import { writable } from 'svelte/store';

export interface Bookmark {
	id: string;
	title: string;
	url: string;
	createdAt: number;
}

const STORAGE_KEY = 'khu-phaen-bookmarks-v1';
const MAX_BOOKMARKS = 10;

function createBookmarksStore() {
	const loadFromStorage = (): Bookmark[] => {
		if (typeof window === 'undefined') return [];
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				const parsed = JSON.parse(saved);
				if (Array.isArray(parsed)) {
					return parsed.slice(0, MAX_BOOKMARKS);
				}
			}
		} catch (e) {
			console.error('Failed to load bookmarks:', e);
		}
		return [];
	};

	const { subscribe, set, update } = writable<Bookmark[]>(loadFromStorage());

	const saveToStorage = (bookmarks: Bookmark[]) => {
		if (typeof window !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks.slice(0, MAX_BOOKMARKS)));
		}
	};

	return {
		subscribe,
		add: (title: string, url: string) => {
			update(bookmarks => {
				if (bookmarks.length >= MAX_BOOKMARKS) {
					return bookmarks;
				}
				const newBookmark: Bookmark = {
					id: crypto.randomUUID(),
					title: title.trim(),
					url: url.trim(),
					createdAt: Date.now()
				};
				const updated = [...bookmarks, newBookmark];
				saveToStorage(updated);
				return updated;
			});
		},
		update: (id: string, title: string, url: string) => {
			update(bookmarks => {
				const updated = bookmarks.map(b => 
					b.id === id 
						? { ...b, title: title.trim(), url: url.trim() }
						: b
				);
				saveToStorage(updated);
				return updated;
			});
		},
		remove: (id: string) => {
			update(bookmarks => {
				const updated = bookmarks.filter(b => b.id !== id);
				saveToStorage(updated);
				return updated;
			});
		},
		reorder: (oldIndex: number, newIndex: number) => {
			update(bookmarks => {
				const items = [...bookmarks];
				const [moved] = items.splice(oldIndex, 1);
				items.splice(newIndex, 0, moved);
				saveToStorage(items);
				return items;
			});
		}
	};
}

export const bookmarks = createBookmarksStore();
export { MAX_BOOKMARKS };
