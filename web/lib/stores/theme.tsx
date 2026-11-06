"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

type Bridge = { resolved: string | undefined; set: (theme: string) => void };
let bridge: Bridge | null = null;

/** Lets non-React code (keyboard shortcuts) flip the theme that next-themes owns. */
export const theme = {
  toggle() {
    if (!bridge) return;
    bridge.set(bridge.resolved === "dark" ? "light" : "dark");
  },
};

export function ThemeBridge() {
  const { resolvedTheme, setTheme } = useTheme();
  useEffect(() => {
    bridge = { resolved: resolvedTheme, set: setTheme };
    return () => {
      bridge = null;
    };
  }, [resolvedTheme, setTheme]);
  return null;
}
