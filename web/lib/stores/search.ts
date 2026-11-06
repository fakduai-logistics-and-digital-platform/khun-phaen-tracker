import { writable } from "@/lib/store";
import type { Task } from "@/lib/types";

interface SearchDocument {
  id: string | number;
  title: string;
  project: string;
  category: string;
  notes: string;
  status: string;
  assignee: string;
}

// Search index (pure JS, no WASM)
let searchIndex: SearchDocument[] = [];

// Loading state
export const wasmLoading = writable(false);
export const wasmReady = writable(true); // Always ready (JS mode)
export const wasmError = writable<string | null>(null);

// Search state
export const searchQuery = writable("");
export const searchResults = writable<Task[]>([]);
export const searchSuggestions = writable<string[]>([]);
export const isSearching = writable(false);

// Initialize search (JS only, no WASM)
export async function initWasmSearch() {
  console.log("🔍 Search using JavaScript (WASM disabled for memory)");
  wasmReady.set(true);
}

// Simple fuzzy matching function
function fuzzyMatch(text: string, query: string): number {
  if (!query) return 1;
  text = text.toLowerCase();
  query = query.toLowerCase();

  // Exact match gets highest score
  if (text === query) return 100;

  // Starts with query
  if (text.startsWith(query)) return 80;

  // Contains query
  if (text.includes(query)) return 60;

  // Check if all characters in query appear in text in order (fuzzy)
  let queryIdx = 0;
  for (let i = 0; i < text.length && queryIdx < query.length; i++) {
    if (text[i] === query[queryIdx]) {
      queryIdx++;
    }
  }
  if (queryIdx === query.length) {
    // Fuzzy match - calculate score based on length ratio
    return Math.max(10, 40 * (query.length / text.length));
  }

  return 0;
}

// Index tasks for searching
export function indexTasks(tasks: Task[]) {
  searchIndex = tasks.map((task) => ({
    id: task.id || 0,
    title: task.title,
    project: task.project || "",
    category: task.category,
    notes: task.notes || "",
    status: task.status,
    assignee: task.assignee?.name || "",
  }));
  console.log(`Indexed ${searchIndex.length} tasks (JS mode)`);
}

// Perform search
export function performSearch(query: string, allTasks: Task[]) {
  if (!query.trim()) {
    searchResults.set(allTasks);
    return allTasks;
  }

  isSearching.set(true);

  const queryStr = query.toLowerCase().trim();

  // Score and filter tasks
  const scored = allTasks.map((task) => {
    const doc = searchIndex.find((d) => d.id === task.id);
    if (!doc) return { task, score: 0 };

    let score = 0;
    score = Math.max(score, fuzzyMatch(doc.title, queryStr) * 2); // Title weighted more
    score = Math.max(score, fuzzyMatch(doc.project, queryStr));
    score = Math.max(score, fuzzyMatch(doc.category, queryStr));
    score = Math.max(score, fuzzyMatch(doc.notes, queryStr));
    score = Math.max(score, fuzzyMatch(doc.assignee, queryStr));

    return { task, score };
  });

  // Filter and sort by score
  const results = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.task);

  searchResults.set(results);

  // Generate suggestions from matching titles
  const suggestions = searchIndex
    .filter((d) => fuzzyMatch(d.title, queryStr) > 50)
    .map((d) => d.title)
    .slice(0, 5);
  searchSuggestions.set(suggestions);

  isSearching.set(false);
  return results;
}

// Clear search
export function clearSearch(allTasks: Task[]) {
  searchQuery.set("");
  searchResults.set(allTasks);
  searchSuggestions.set([]);
  return allTasks;
}

// Get search suggestions (for autocomplete)
export function getSearchSuggestions(query: string): string[] {
  if (!query.trim()) return [];

  const queryStr = query.toLowerCase().trim();

  return searchIndex
    .filter((d) => fuzzyMatch(d.title, queryStr) > 40)
    .map((d) => d.title)
    .slice(0, 5);
}

export type SearchActionDeps = {
  getFilters: () => any;
  setFilters: (filters: any) => void;
  clearSearchIndex?: () => void;
};

export function createSearchActions(deps: SearchActionDeps) {
  return {
    handleSearchInput: (event: Event) => {
      const target = event.target as HTMLInputElement;
      const value = target.value;
      searchQuery.set(value);
      const filters = deps.getFilters();
      deps.setFilters({ ...filters, search: value });
      return value;
    },
    handleClearSearch: () => {
      searchQuery.set("");
      clearSearch([]);
      const filters = deps.getFilters();
      deps.setFilters({ ...filters, search: "" });
      return "";
    },
  };
}
