"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import en from "./locales/en.json";
import th from "./locales/th.json";

export type Locale = "th" | "en";

type Tree = { [key: string]: string | string[] | Tree };

/** svelte-i18n allowed nested catalogs addressed as "group.key"; flatten them once. */
function flatten(tree: Tree, prefix = "", out: Record<string, string> = {}) {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else if (!Array.isArray(value)) flatten(value, path, out);
  }
  return out;
}

const MESSAGES: Record<Locale, Record<string, string>> = {
  th: flatten(th as unknown as Tree),
  en: flatten(en as unknown as Tree),
};
const STORAGE_KEY = "app-locale";
const FALLBACK: Locale = "th";

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "th", label: "ไทย", flag: "🇹🇭" },
  { code: "en", label: "English", flag: "🇺🇸" },
];

type Vars = Record<string, string | number>;

function format(message: string, vars?: Vars) {
  if (!vars) return message;
  return message.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

function detectLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "th" || stored === "en") return stored;
  const nav = navigator.language?.slice(0, 2);
  return nav === "en" ? "en" : FALLBACK;
}

let activeLocale: Locale = FALLBACK;

/** Non-hook translator for stores and other code outside React (reads the current locale). */
export function translate(key: string, vars?: Vars) {
  return format(MESSAGES[activeLocale][key] ?? MESSAGES[FALLBACK][key] ?? key, vars);
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Vars) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Start with the fallback so server and first client render match, then adopt the saved locale.
  const [locale, setLocaleState] = useState<Locale>(FALLBACK);

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  useEffect(() => {
    activeLocale = locale;
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Vars) => format(MESSAGES[locale][key] ?? MESSAGES[FALLBACK][key] ?? key, vars),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
