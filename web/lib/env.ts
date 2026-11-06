/** Replacements for SvelteKit's $app/environment and $app/paths. */
export const browser = typeof window !== "undefined";
export const dev = process.env.NODE_ENV !== "production";
export const base = "";
