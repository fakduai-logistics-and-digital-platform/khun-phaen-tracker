"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Mirrors Svelte's `bind:` semantics: the prop is the source of truth whenever the parent
 * changes it, but a local write is visible immediately even if the parent ignores onChange.
 */
export function useBindable<T>(prop: T, onChange?: (next: T) => void) {
  const [inner, setInner] = useState(prop);
  const lastProp = useRef(prop);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  if (!Object.is(lastProp.current, prop)) {
    lastProp.current = prop;
    setInner(prop);
  }

  const set = useCallback((next: T) => {
    setInner(next);
    onChangeRef.current?.(next);
  }, []);

  return [inner, set] as const;
}
