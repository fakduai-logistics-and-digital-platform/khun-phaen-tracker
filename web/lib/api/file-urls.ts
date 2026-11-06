"use client";

import { useEffect, useState } from "react";
import { api, API_BASE_URL } from "./apis";

/**
 * `<img src>` cannot send the bearer token, so file links are signed by the API after its access
 * check (POST /files/sign). Links last 1–2 hours; they are cached here and refreshed before expiry.
 * Keys requested in the same tick share one request.
 */
const API_ORIGIN = API_BASE_URL.replace(/\/api$/, "");
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const cache = new Map<string, { url: string; expires: number }>();
let pending: { keys: Set<string>; done: Promise<void> } | null = null;

function cached(key: string): string | undefined {
  const hit = cache.get(key);
  return hit && hit.expires - REFRESH_MARGIN_MS > Date.now() ? hit.url : undefined;
}

async function signBatch(keys: string[]): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/files/sign`, {
    method: "POST",
    headers: api.data._headers(true),
    body: JSON.stringify({ keys }),
  });
  if (!response.ok) return;
  const { urls } = (await response.json()) as { urls?: Record<string, string> };
  for (const [key, path] of Object.entries(urls ?? {})) {
    const expires = Number(new URLSearchParams(path.split("?")[1]).get("exp")) * 1000;
    cache.set(key, { url: `${API_ORIGIN}${path}`, expires });
  }
}

/** Resolves to a signed URL, or undefined when the caller may not read the file. */
export async function signedFileUrl(key: string, thumb = false): Promise<string | undefined> {
  let url = cached(key);
  if (!url) {
    if (!pending) {
      const keys = new Set<string>();
      const done = Promise.resolve().then(() => {
        pending = null;
        return signBatch([...keys]).catch(() => undefined);
      });
      pending = { keys, done };
    }
    pending.keys.add(key);
    await pending.done;
    url = cached(key);
  }
  return url && thumb ? `${url}&w=320` : url;
}

export function useSignedFileUrl(key: string | undefined, thumb = false): string | undefined {
  const [state, setState] = useState<{ key: string; url?: string }>();
  useEffect(() => {
    if (!key) return;
    let active = true;
    void signedFileUrl(key, thumb).then((url) => {
      if (active) setState({ key: `${key}:${thumb}`, url });
    });
    return () => {
      active = false;
    };
  }, [key, thumb]);
  return state?.key === `${key}:${thumb}` ? state.url : undefined;
}
