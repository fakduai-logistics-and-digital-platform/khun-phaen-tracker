/** Sub-path the app is served under (GitHub Pages project site); empty on Cloudflare and in dev. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Prefix for URLs that bypass the Next router: `<img src>`, `fetch`, `window.open`, links copied to the clipboard. */
export function withBase(path: string) {
  return `${BASE_PATH}${path}`;
}
