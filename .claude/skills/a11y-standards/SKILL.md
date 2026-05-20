---
name: a11y-standards
description: Accessibility standards for Svelte UI components — keyboard navigation, focus management, ARIA attributes, color contrast, and screen reader support. Use when building interactive components like modals, drag-and-drop, dropdowns, or forms.
---

# Accessibility (a11y) Standards

This project includes interactive UI patterns (Kanban drag-and-drop, calendar views, modals, dropdowns, command palettes) that require careful accessibility implementation. This skill ensures components are usable by keyboard-only users, screen readers, and users with visual impairments.

## When to Use

Trigger this skill when:
- Creating or modifying modals, dialogs, or overlays
- Building drag-and-drop interactions (Kanban board, task reordering)
- Creating dropdown menus, command palettes, or autocomplete selectors
- Adding form controls or interactive buttons
- Working on color, contrast, or dark mode styling

## Core Rules

### 1. Keyboard Navigation
* **All interactive elements must be reachable via Tab key.** Ensure `tabindex` is set correctly. Never set `tabindex` > 0.
* **Actionable elements need keyboard handlers.** If an element has `on:click`, it must also handle `on:keydown` for Enter and Space (or use a `<button>` which handles this natively).
* **Drag-and-drop must have keyboard alternatives.** The Kanban board (`KanbanBoard.svelte`) uses `svelte-dnd-action`. Ensure tasks can be moved between columns using arrow keys or a dedicated "Move to" action.

### 2. Focus Management
* **Modals must trap focus.** When a modal opens, focus moves to the first focusable element inside it. Tab cycling must stay within the modal until it closes. When the modal closes, focus returns to the trigger element.
* **Auto-focus on open.** Dialogs (`ConfirmModal.svelte`, `ProfileModal.svelte`, `WorkspaceSettings.svelte`) should auto-focus the primary action or the first input field.
* **Escape key closes modals.** Every modal and dropdown must close on `Escape` keypress.

### 3. ARIA Attributes
* **Use semantic HTML first.** Prefer `<button>`, `<dialog>`, `<nav>`, `<main>`, `<aside>`, `<header>` over generic `<div>` with ARIA roles.
* **Label interactive elements.** Every button and input without visible text needs `aria-label` or `aria-labelledby`.
* **Announce state changes.** Use `aria-live="polite"` for toast notifications (`StatusToast.svelte`) and sync status updates.
* **Mark decorative icons.** Icons from `lucide-svelte` that are purely decorative should have `aria-hidden="true"`. Icons that convey meaning need `aria-label`.

### 4. Color and Contrast
* **Minimum contrast ratio:** 4.5:1 for normal text, 3:1 for large text (WCAG AA).
* **Never convey information by color alone.** Task priority badges (`PriorityBadge.svelte`) must include text or an icon alongside the color indicator.
* **Dark mode parity.** Every component must be tested in both light and dark modes. Use the project's design tokens (`text-gray-900 dark:text-gray-100`, etc.) to ensure consistent contrast.

### 5. Forms and Inputs
* **Every input needs a label.** Use `<label for="id">` or `aria-label`. Placeholder text alone is not sufficient.
* **Error messages must be linked.** Use `aria-describedby` to connect error messages to their input fields.
* **Required fields must be marked.** Use `aria-required="true"` and a visual indicator.

## Verification Checklist
- [ ] Can I navigate the entire component using only the keyboard (Tab, Shift+Tab, Enter, Escape, Arrow keys)?
- [ ] Does focus trap work correctly in modals and dialogs?
- [ ] Do all interactive elements have descriptive `aria-label` or visible text?
- [ ] Are state changes announced to screen readers via `aria-live`?
- [ ] Does the component pass WCAG AA contrast requirements in both light and dark mode?
- [ ] Is drag-and-drop functionality accessible without a mouse?
