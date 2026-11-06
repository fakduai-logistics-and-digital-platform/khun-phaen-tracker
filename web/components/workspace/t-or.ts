type Translate = (key: string, vars?: Record<string, string | number>) => string;

/** svelte-i18n's `{ default }` option: use the fallback when the key has no translation. */
export function tOr(t: Translate, key: string, fallback: string, vars?: Record<string, string | number>) {
  const value = t(key, vars);
  return value === key ? fallback : value;
}
