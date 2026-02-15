import {
  init,
  getLocaleFromNavigator,
  addMessages,
  locale,
  _,
} from "svelte-i18n";

// Import locale files
import en from "./locales/en.json";
import th from "./locales/th.json";

// Add messages
addMessages("en", en);
addMessages("th", th);

// Initialize i18n
init({
  fallbackLocale: "th",
  initialLocale:
    typeof window !== "undefined"
      ? localStorage.getItem("app-locale") || getLocaleFromNavigator() || "th"
      : "th",
});

// Function to change locale
export function changeLocale(newLocale: string) {
  locale.set(newLocale);
  if (typeof window !== "undefined") {
    localStorage.setItem("app-locale", newLocale);
  }
}

// Export for use
export { locale, _ };
