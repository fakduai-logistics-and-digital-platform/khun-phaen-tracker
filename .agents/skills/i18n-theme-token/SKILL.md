---
name: i18n-theme-token
description: Enforce strict localization (i18n) checks and design token usage. Use this skill when modifying, creating, or refactoring UI components, pages, or user-facing strings.
---

# Localization and Design Tokens Rule Enforcement

This skill ensures that all user interface changes match the project's standards for localization and custom theme design tokens.

## 1. Localization (i18n) Guidelines
The repository requires: **"check i18n ด้วยนะให้ครบทุกเคส"** (Check i18n for all cases).

* **Locales Files:** All translated strings are stored in:
  - English: [en.json](file:///Users/watchakorn.b/FILE_CODE/OTHER/task-tracker-offline/src/lib/i18n/locales/en.json)
  - Thai: [th.json](file:///Users/watchakorn.b/FILE_CODE/OTHER/task-tracker-offline/src/lib/i18n/locales/th.json)
* **Rules:**
  1. **No Hardcoded User-Facing Strings:** Never insert raw English or Thai strings directly into Svelte templates. Always use the `$t` translator store (e.g., `{$t('tasks.title')}`).
  2. **Duo-Language Completeness:** When adding a new key, you **must** add it to both `en.json` and `th.json`.
  3. **Consistent Nested Structure:** Ensure the key path matches in both files (e.g., if `tasks.status.todo` is defined, it must exist in both locales with the same nesting structure).

---

## 2. Theme & Design Tokens Guidelines
The repository requires: **"ในการทำ UI ให้ใช้ design token ตามธีมที่ทำไว้ด้วยหล่ะ"** (Use design tokens according to the theme we created).

* **Theme Definitions:** Configured in Tailwind v4.x inside [src/app.css](file:///Users/watchakorn.b/FILE_CODE/OTHER/task-tracker-offline/src/app.css).
* **Core Palette:**
  - **Primary:** `bg-primary`, `text-primary`, `border-primary` (Blue `#3b82f6` / `#2563eb`)
  - **Success:** `bg-success`, `text-success` (Green `#10b981`)
  - **Warning:** `bg-warning`, `text-warning` (Amber `#f59e0b`)
  - **Danger:** `bg-danger`, `text-danger` (Red `#ef4444`)
  - **Grays:** `gray-50` to `gray-900` for text, borders, and backgrounds.
* **Rules:**
  1. **Strict Token Adherence:** Avoid using arbitrary hexadecimal or RGB colors in Svelte inline styles or class properties. Use the predefined utility classes.
  2. **Dark Mode Compliance:** Ensure every element renders beautifully in both light and dark modes. Use classes like `bg-white dark:bg-gray-800` or `text-gray-900 dark:text-gray-100`.
  3. **Thai Typography:** Prioritize Thai text rendering. The project body font stacks `Inter` alongside `Noto Sans Thai`. Ensure you don't override or break font inheritance (`font-family: inherit`).

---

## Verification Checklist
Before finishing UI edits, check:
- [ ] Did I add translation keys to **both** `en.json` and `th.json`?
- [ ] Are there any raw strings left in the `.svelte` file?
- [ ] Did I run `npm run check` to verify there are no TypeScript/Svelte template errors or warnings?
- [ ] Does the UI render and align correctly in Dark Mode?
