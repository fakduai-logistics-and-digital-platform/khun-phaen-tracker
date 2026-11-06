"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getCookie, setCookie } from "@/lib/cookies";

export type Collapsible = "offcanvas" | "icon" | "none";
type Variant = "inset" | "sidebar" | "floating";

const COLLAPSIBLE_COOKIE = "layout_collapsible";
const VARIANT_COOKIE = "layout_variant";
const MAX_AGE = 60 * 60 * 24 * 7;
const DEFAULT_VARIANT: Variant = "inset";
const DEFAULT_COLLAPSIBLE: Collapsible = "icon";

type LayoutContextType = {
  resetLayout: () => void;
  defaultCollapsible: Collapsible;
  collapsible: Collapsible;
  setCollapsible: (value: Collapsible) => void;
  defaultVariant: Variant;
  variant: Variant;
  setVariant: (value: Variant) => void;
};

const LayoutContext = createContext<LayoutContextType | null>(null);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  // Defaults first so server and client markup match; saved cookies apply after mount.
  const [collapsible, setCollapsibleState] = useState<Collapsible>(DEFAULT_COLLAPSIBLE);
  const [variant, setVariantState] = useState<Variant>(DEFAULT_VARIANT);

  useEffect(() => {
    const savedCollapsible = getCookie(COLLAPSIBLE_COOKIE) as Collapsible | undefined;
    const savedVariant = getCookie(VARIANT_COOKIE) as Variant | undefined;
    if (savedCollapsible) setCollapsibleState(savedCollapsible);
    if (savedVariant) setVariantState(savedVariant);
  }, []);

  const setCollapsible = (value: Collapsible) => {
    setCollapsibleState(value);
    setCookie(COLLAPSIBLE_COOKIE, value, MAX_AGE);
  };
  const setVariant = (value: Variant) => {
    setVariantState(value);
    setCookie(VARIANT_COOKIE, value, MAX_AGE);
  };
  const resetLayout = () => {
    setCollapsible(DEFAULT_COLLAPSIBLE);
    setVariant(DEFAULT_VARIANT);
  };

  return (
    <LayoutContext
      value={{
        resetLayout,
        defaultCollapsible: DEFAULT_COLLAPSIBLE,
        collapsible,
        setCollapsible,
        defaultVariant: DEFAULT_VARIANT,
        variant,
        setVariant,
      }}
    >
      {children}
    </LayoutContext>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) throw new Error("useLayout must be used within a LayoutProvider");
  return context;
}
