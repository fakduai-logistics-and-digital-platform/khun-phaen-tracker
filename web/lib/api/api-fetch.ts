import { freshReads, readCache } from "./api-read-cache-db";

const MAX_AGE = 15 * 60 * 1000;
const MAX_BODY_LENGTH = 256 * 1024;

/** Network-first reads. The server alone accepts writes; there is no offline queue or merge. */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const path = new URL(url, typeof location === "undefined" ? "http://localhost" : location.origin).pathname;
  // Authorization, permissions, admin configuration and download responses never fall back to cache.
  const eligible =
    method === "GET" &&
    /^(\/kp-api)?\/api\/(workspaces\/[^/]+\/(tasks|projects|assignees|assignee-groups|sprints|milestones|checklist-templates)(\/[^/]+)?|my\/tasks)$/.test(
      path,
    );
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  const cookieToken =
    typeof document === "undefined"
      ? ""
      : (document.cookie
          .split(";")
          .map((v) => v.trim())
          .find((v) => v.startsWith("_khun_ph_token="))
          ?.slice("_khun_ph_token=".length) ?? "");
  const token = headers.get("Authorization") || cookieToken;
  let key = "";
  let revision = 0;
  if (eligible && token && typeof indexedDB !== "undefined") {
    try {
      const partition = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))),
      )
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("");
      key = `${partition}:${url}`;
      revision = await readCache.revision();
    } catch {
      /* Cache availability must never prevent an API request. */
    }
  }
  const seenEpoch = freshReads.epoch();
  if (key) {
    const hit = freshReads.get(key);
    if (hit)
      return new Response(hit.body, { headers: { "Content-Type": hit.contentType, "X-Khun-Phaen-Cache": "fresh" } });
  }
  let response: Response;
  try {
    response = await globalThis.fetch(input, init);
  } catch (error) {
    // An explicit abort must remain an abort. HTTP errors (especially 401/403) never reach this branch.
    if (key && !(error instanceof DOMException && error.name === "AbortError")) {
      try {
        if ((await readCache.revision()) === revision) {
          const cached = await readCache.get(key);
          if (cached && Date.now() - cached.savedAt <= MAX_AGE) {
            return new Response(cached.body, {
              headers: {
                "Content-Type": cached.contentType,
                "X-Khun-Phaen-Cache": "stale",
                "Cache-Control": "no-store",
              },
            });
          }
        }
      } catch {
        /* Preserve the original network error. */
      }
    }
    throw error;
  }
  if ((method !== "GET" && response.ok) || response.status === 401 || response.status === 403) {
    try {
      await readCache.clear();
    } catch {
      /* Cache is optional. */
    }
  } else if (key && response.ok && response.headers.get("Content-Type")?.includes("application/json")) {
    try {
      const body = await response.clone().text();
      if (body.length <= MAX_BODY_LENGTH) {
        freshReads.put(key, body, "application/json", seenEpoch);
        await readCache.put({ key, body, savedAt: Date.now(), contentType: "application/json" }, revision);
      }
    } catch {
      /* A confirmed server response takes priority over cache failures. */
    }
  }
  return response;
}
