---
title: Khun Phaen Tracker Design System
description: Design system tokens and UI guidance for Khun Phaen Tracker.
version: 1.0.0
framework: SvelteKit
styling: Tailwind CSS v4
---

# DESIGN.md — Khun Phaen Tracker

Design system guide for AI agents and contributors working on Khun Phaen Tracker, a local-first task, workspace, calendar, Kanban, and developer utility app.

Use this file when adding or changing UI so generated screens feel consistent with the existing SvelteKit + Tailwind app.


## Design Tokens

Primary design tokens live in [src/app.css](src/app.css) under Tailwind v4 `@theme` and CSS custom properties.

Use Tailwind token utilities when possible:

| Purpose | Utility / token |
| --- | --- |
| App canvas | `surface-canvas` or `bg-surface-canvas` |
| Card surface | `surface-card` or `bg-surface-card` |
| Muted surface | `surface-muted` or `bg-surface-muted` |
| Subtle border | `border-subtle` or `border-border-subtle` |
| Strong border | `border-strong` or `border-border-strong` |
| Primary text | `text-app-primary` or `text-text-primary` |
| Secondary text | `text-app-secondary` or `text-text-secondary` |
| Muted text | `text-app-muted` or `text-text-muted` |
| Touch target | `touch-target` |
| Card shadow | `shadow-card` |
| Hover card shadow | `shadow-card-hover` |
| Floating shadow | `shadow-floating` |

Use raw CSS variables inside component styles only when utilities are not enough:

```css
background: var(--surface-card);
border-color: var(--border-subtle);
color: var(--text-primary);
box-shadow: var(--shadow-card);
```

Dark mode overrides semantic CSS variables through `.dark`, so semantic utilities adapt automatically.

## 1. Visual Theme & Atmosphere

Khun Phaen Tracker should feel like a focused productivity cockpit: calm, structured, dense enough for project work, but not cramped.

- Mood: strategic, reliable, local-first, developer-friendly.
- Style: modern SaaS dashboard with subtle Thai language support and practical utility tools.
- Density: medium-high for workspaces, Kanban, tables, modals, and developer utilities.
- Surfaces: clean white/light gray in light mode; deep gray surfaces in dark mode.
- Decoration: restrained gradients, light grid texture, soft borders, small motion.
- Interaction feel: fast, direct, stable; use hover/active transitions without visual noise.

## 2. Color Palette & Roles

Use Tailwind classes backed by tokens from [src/app.css](src/app.css).

| Role | Token / Class | Hex | Use |
| --- | --- | --- | --- |
| Primary | `primary`, `bg-primary`, `text-primary` | `#3b82f6` | Main actions, focused states, selected controls |
| Primary dark | `primary-dark`, `hover:bg-primary-dark` | `#2563eb` | Primary hover/active states |
| Success | `success`, `bg-success` | `#10b981` | Completed states, positive toasts, success badges |
| Warning | `warning`, `bg-warning` | `#f59e0b` | Due-soon, caution, warning labels |
| Danger | `danger`, `bg-danger` | `#ef4444` | Delete, destructive action, errors |
| Page bg light | `bg-gray-50` | `#f9fafb` | App background |
| Card bg light | `bg-white` | `#ffffff` | Cards, panels, modals |
| Border light | `border-gray-200` | `#e5e7eb` | Card borders, dividers |
| Muted text | `text-gray-500` | `#6b7280` | Metadata, helper text |
| Body text light | `text-gray-900` | `#111827` | Primary text |
| Page bg dark | `dark:bg-gray-900` | `#111827` | Dark app background |
| Card bg dark | `dark:bg-gray-800` | `#1f2937` | Dark cards, panels, modals |
| Border dark | `dark:border-gray-700` | `#374151` | Dark borders, dividers |
| Body text dark | `dark:text-gray-100` | `#f3f4f6` | Primary dark text |

Color rules:

- Prefer semantic tokens: primary/success/warning/danger/gray.
- Keep status colors consistent across task cards, badges, buttons, and toasts.
- Use blue for navigation/action, green for completion, amber for caution, red for destructive/error.
- Dark mode must always include paired `dark:` classes for backgrounds, borders, and text.
- Avoid saturated full-page backgrounds; keep strong color for actions and compact highlights.

## 3. Typography Rules

Global font stack from [src/app.css](src/app.css):

```css
'Inter', 'Noto Sans Thai', 'Thai Fallback', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif
```

Typography must support Thai and English equally.

| Element | Tailwind pattern | Notes |
| --- | --- | --- |
| App title / brand | `text-lg font-black tracking-tight leading-none` | Compact brand mark in navbar |
| Page heading | `text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white` | Main screen title |
| Section heading | `text-lg font-semibold text-gray-800 dark:text-gray-100` | Cards, panels, calendar toolbar |
| Card title | `text-sm font-semibold text-gray-900 dark:text-gray-100` | Dense task/project cards |
| Body | `text-sm text-gray-700 dark:text-gray-300` | Default readable content |
| Helper text | `text-xs text-gray-500 dark:text-gray-400` | Captions, timestamps, hints |
| Metadata / badges | `text-[10px] text-gray-500 dark:text-gray-400 font-medium` | Dense pills, navbar subtitle |
| Time / code-like values | `font-mono text-[11px] tabular-nums` | Clock, counters, technical values |

Typography rules:

- Use `font-medium`, `font-semibold`, or `font-bold` for hierarchy; avoid oversized text.
- Keep UI labels short, especially in bilingual surfaces.
- For Thai content, avoid tight line heights that clip glyphs.
- Prefer `leading-tight` for compact labels and `leading-relaxed` for long descriptions.

## 4. Component Stylings

### Buttons

Primary button:

```html
<button class="px-4 py-2 bg-primary text-text-inverse rounded-control hover:bg-primary-dark transition-colors">
  Save
</button>
```

Secondary button:

```html
<button class="px-4 py-2 border border-subtle surface-card text-app-secondary rounded-control hover:surface-muted transition-colors">
  Cancel
</button>
```

Icon button:

```html
<button class="touch-target p-2 rounded-control text-app-muted hover:surface-muted transition-colors">
  <!-- icon -->
</button>
```

Rules:

- Rounded corners: use `rounded-lg` for controls, `rounded-xl` for brand/icon containers.
- Primary actions: blue background, white text.
- Destructive actions: red/danger only when action destroys or removes data.
- Active press states may use `active:scale-95` for icon/brand controls.

### Cards and Panels

Task/Kanban card baseline from [src/app.css](src/app.css):

```html
<div class="surface-card p-3 rounded-card shadow-card border border-subtle hover:shadow-card-hover transition-shadow">
  ...
</div>
```

Rules:

- Use `shadow-sm` by default; reserve `shadow-lg` for overlays, dropdowns, modals, and toasts.
- Use borders in both themes to preserve shape in dark mode.
- Workspace/card content should be scannable: title, metadata, status, owner, due date.

### Inputs, Selects, Textareas

Default pattern:

```html
<input class="w-full px-3 py-2 border border-strong surface-card text-app-primary rounded-control focus:border-primary focus:ring-primary/20" />
```

Rules:

- Inputs in `.app-surface` get dark mode styling from [src/app.css](src/app.css).
- Always include visible focus state via `border-primary` and `ring-primary/20`.
- Placeholder text should be muted: `placeholder:text-gray-400 dark:placeholder:text-gray-500`.

### Navigation

Navbar pattern:

- Fixed top header where used: `fixed top-0 left-0 right-0 z-999`.
- Surface: `surface-card border-b border-subtle`.
- Height: `h-16`.
- Brand icon: subtle indigo/purple gradient, `rounded-xl`, `ring-1`, `shadow-sm`.
- Pills: rounded-full or rounded-md, subtle background, small text.

### Modals and Overlays

- Overlay: translucent dark or backdrop blur when needed.
- Modal surface: `bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700`.
- Close buttons: icon button pattern.
- Toasts: fixed top/right, `rounded-lg shadow-lg text-sm font-medium`, status background.

### Badges and Pills

- Use compact labels: `px-2 py-0.5 rounded-md text-xs font-medium`.
- Use semantic color with low-opacity backgrounds: `bg-primary/10 text-primary`, `bg-success/10 text-success`, etc.
- Avoid large saturated badges inside dense task lists.

## 5. Layout Principles

App shell:

- Main app surface: `min-h-screen surface-canvas transition-colors flex flex-col relative overflow-hidden`.
- Standard container: `max-w-7xl px-4 sm:px-6 lg:px-8 mx-auto`.
- Dashboard/workspace container: `w-full max-w-full px-4 sm:px-8`.
- Header height: `h-16`; account for fixed headers when relevant.

Spacing scale:

| Use | Tailwind |
| --- | --- |
| Dense inline gap | `gap-1`, `gap-1.5`, `gap-2` |
| Normal control gap | `gap-3`, `gap-4` |
| Card padding | `p-3`, `p-4` |
| Panel padding | `p-4`, `p-6` |
| Page section spacing | `space-y-4`, `space-y-6`, `gap-6` |
| Kanban column padding | `p-2` |

Layout rules:

- Prefer flexible dashboard layouts over fixed pixel widths.
- Use responsive containers and let workspace pages use full width.
- Keep Kanban columns visually light with cards carrying most depth.
- Use dividers for dense nav/tool areas: `h-6 w-[1px] bg-gray-200 dark:bg-gray-700`.
- Keep background grid extremely subtle: opacity near `0.02` light and `0.01` dark.

## 6. Depth & Elevation

Depth system:

| Level | Tailwind | Use |
| --- | --- | --- |
| Flat | `border border-subtle` | Tables, input groups, simple panels |
| Raised | `shadow-card border border-subtle` | Cards, Kanban tasks |
| Hover raised | `hover:shadow-card-hover transition-shadow` | Draggable or clickable cards |
| Floating | `shadow-floating border border-subtle` | Dropdowns, toasts, modals |
| Emphasis | `ring-1 ring-indigo-500/20 shadow-sm` | Brand mark, selected highlights |

Rules:

- Pair shadows with borders so dark mode remains legible.
- Do not use heavy shadows on every card; reserve for active/floating surfaces.
- Use `transition-shadow` and `transition-colors` for calm motion.
- Animation duration should usually be `0.2s` to `0.3s`.

## 7. Do's and Don'ts

Do:

- Use Tailwind utility classes already common in the app.
- Include `dark:` variants for every new visible surface.
- Preserve Thai/English readability.
- Keep task and workspace screens dense, clear, and scannable.
- Use semantic colors consistently.
- Use `lucide-svelte` icons for UI actions.
- Use rounded corners and subtle borders as default shape language.
- Keep motion small: fade, slight translate, hover scale for icon controls only.

Don't:

- Do not introduce a second design language or CSS framework.
- Do not use raw random colors when existing tokens fit.
- Do not make dashboards sparse or marketing-page-like.
- Do not use decorative gradients as main content backgrounds.
- Do not rely on color alone for status; pair with labels/icons where useful.
- Do not skip dark mode.
- Do not add large custom CSS blocks when Tailwind utilities are enough.
- Do not use emoji as primary icons unless existing UX specifically uses them.

## 8. Responsive Behavior

Breakpoints follow Tailwind defaults.

| Breakpoint | Behavior |
| --- | --- |
| Mobile `<640px` | Hide dense navbar labels, keep icon actions, full-width panels |
| `sm` `>=640px` | Show brand text, date/time pills, richer nav labels |
| `md` `>=768px` | Multi-column forms/cards where useful |
| `lg` `>=1024px` | Full dashboard layouts, wider containers |
| `xl` `>=1280px` | Max-width standard pages, full-width workspaces |

Responsive rules:

- Touch targets should be at least 40px tall/wide for icon buttons.
- Use `hidden sm:flex` or `hidden sm:block` for non-essential navbar details.
- Workspaces and dashboards should remain usable on mobile, even if horizontally dense features need scroll.
- Avoid fixed widths that break Thai text or long task names.
- Modals should fit mobile width: `w-full max-w-* p-4` with safe viewport margins.

## 9. Agent Prompt Guide

When asking AI agents to create UI for this app, include:

```text
Use DESIGN.md. Build SvelteKit + Tailwind UI matching Khun Phaen Tracker: local-first productivity dashboard, light/dark mode, Inter/Noto Sans Thai font stack, blue primary #3b82f6, gray surfaces, rounded-lg controls, bordered cards, shadow-sm cards, lucide-svelte icons, dense scannable workspace layout.
```

Quick color reference:

```text
primary #3b82f6
primary-dark #2563eb
success #10b981
warning #f59e0b
danger #ef4444
light bg #f9fafb
light card #ffffff
light border #e5e7eb
dark bg #111827
dark card #1f2937
dark border #374151
```

Ready prompts:

```text
Create a Svelte component for a task card using DESIGN.md. Use bg-white/dark:bg-gray-800, rounded-lg, border gray-200/dark:gray-700, shadow-sm, hover:shadow-md, compact metadata, and semantic status badges.
```

```text
Create a dashboard panel using DESIGN.md. Use max-w-7xl standard layout unless it is a workspace view, include dark mode classes, section heading, muted helper text, and primary action button.
```

```text
Create a modal form using DESIGN.md. Use rounded-xl, shadow-lg, bordered white/dark gray surface, accessible labels, primary/secondary buttons, and focus states with primary ring.
```

Companion previews recommended by DESIGN.md convention:

- `preview.html`: visual catalog for light mode colors, type, buttons, cards, inputs.
- `preview-dark.html`: same catalog on dark surfaces.

This project does not require preview files unless design catalog validation is needed.
