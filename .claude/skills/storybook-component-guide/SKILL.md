---
name: storybook-component-guide
description: Guides Svelte UI component development with Storybook. Use when creating new components, refactoring existing ones, or when a component needs visual regression testing via stories.
---

# Storybook Component Guide

This project uses **Storybook v10** with `@storybook/sveltekit` and `@storybook/addon-svelte-csf` for component development, visual testing, and documentation.

## When to Use

Trigger this skill when:
- Creating a new reusable Svelte component
- Refactoring an existing component's props or visual appearance
- A component needs visual documentation or regression testing
- The user asks to "add a story" or "test the component visually"

## Project Storybook Setup

* **Config:** `.storybook/main.ts`, `.storybook/preview.ts`
* **Stories location:** Colocated with components in `src/lib/components/` as `*.stories.svelte`
* **Run Storybook:** `npm run storybook` (port 6006)
* **Build Storybook:** `npm run build-storybook`

## Existing Stories (Reference)

These existing stories serve as templates for new ones:
- `CustomDatePicker.stories.svelte`
- `Pagination.stories.svelte`
- `SearchableSelect.stories.svelte`
- `SearchableSprintSelect.stories.svelte`

## Writing a Story

Use the **Svelte CSF** format (`.stories.svelte`). Example:

```svelte
<script module>
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import MyComponent from "./MyComponent.svelte";

  const { Story } = defineMeta({
    title: "Components/MyComponent",
    component: MyComponent,
    tags: ["autodocs"],
  });
</script>

<Story name="Default">
  <MyComponent prop1="value" />
</Story>

<Story name="Dark Mode">
  <div class="dark bg-gray-900 p-4">
    <MyComponent prop1="value" />
  </div>
</Story>
```

## Rules

1. **Every new reusable component should have a story.** If the component is used in more than one place, it deserves a `.stories.svelte` file.
2. **Include Dark Mode variants.** Wrap stories in `<div class="dark bg-gray-900 p-4">` to verify dark mode rendering.
3. **Use design tokens.** Stories must use the project's Tailwind theme tokens (see `i18n-theme-token` skill), not arbitrary colors.
4. **Test responsive states.** If the component behaves differently on mobile vs desktop, add viewport-specific stories.
5. **Use `tags: ["autodocs"]`** to auto-generate documentation from the component's props.

## Verification Checklist
- [ ] Created `ComponentName.stories.svelte` alongside the component
- [ ] Story includes at least a Default and Dark Mode variant
- [ ] Ran `npm run build-storybook` — builds without errors
- [ ] Component uses design tokens from the theme (no hardcoded colors)
