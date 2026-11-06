# Porting guide: SvelteKit (../src) -> Next.js/vinext (web/)

Read this fully before porting. Several agents port different files in parallel against these conventions.

## Ground rules
- Source of truth is the Svelte file in `../src`. Keep behavior, markup structure, user-facing text keys and keyboard shortcuts. Do not redesign.
- **Only create/edit the files you own** (your brief lists them). Never edit: `package.json`, `package-lock.json`, `app/globals.css`, `lib/**` (shared layer), `components/ui/**`, `components/layout/**`, `lib/i18n/locales/*.json`, `next.config.ts`, `vite.config.ts`. If you need a change there, do not make it: list it in your final report under "Needs from integrator".
- **Do not run** `npm install`, `npm run build`, `npm run dev`, or open a browser. Allowed validation: `cd web && npx tsc --noEmit --incremental false 2>&1 | grep -v '^ '` and **only look at errors in your own files** (other agents' files may be mid-edit).
- Libraries already installed: react 19, next-themes, lucide-react, sonner, @radix-ui/*, cmdk, class-variance-authority, clsx, tailwind-merge, @dnd-kit/{core,sortable,utilities}, @tiptap/{react,core,pm,starter-kit,extension-*,markdown}, @fullcalendar/{react,core,daygrid,interaction}, react-day-picker, date-fns, recharts, @excalidraw/excalidraw, idb, marked, xlsx, jspdf, pptxgenjs, qrcode, html-to-image, hls.js, lz4js, @floating-ui/dom. Need another package? Report it; work around it meanwhile.
- Files under ~500 lines. Split large Svelte files into focused child components and hooks (`use-*.ts`) in the same directory you own.
- Every file that uses hooks, state, events, or browser APIs starts with `"use client";`.
- Named exports only (no default exports) except Next.js `page.tsx` / `layout.tsx` / `error.tsx` which must `export default`.

## File naming and where things go
- React component for `Foo.svelte` is `components/<group>/foo.tsx` (kebab-case file, `export function Foo`). The `<group>` is given in your brief. Routes: `app/<same path as src/routes>/page.tsx` (Svelte `+page.svelte` -> `page.tsx`, `+layout.svelte` -> `layout.tsx`, `+error.svelte` -> `error.tsx`).
- Cross-agent imports: when you use a component owned by another agent, import it from its planned path `@/components/<group>/<kebab-name>` using the **deterministic prop contract** below. Read the Svelte source of that component to get props/events. Do not wait for it to exist.

### Group map (who owns what)
| group dir | components |
|---|---|
| `components/shared/` | ConfirmModal, GlobalConfirmModal, SearchableSelect, SearchableSprintSelect, CustomDatePicker, PriorityBadge, PrioritySelector, Tooltip, Pagination, PaginationFooter, AssigneeSelector, AccessDenied, WorkspaceLoading, StatusToast, LinkPreview, MarkdownEditor |
| `components/editor/` | RichTextEditor, TitleEditor, BubbleMenu |
| `components/workspace/` | WorkspaceViews, TaskViewPlaceholder, TableView, TaskList, KanbanBoard, CalendarView, GanttView, WorkloadView, FilterPanel, SearchAndActions, StatsPanel, ViewSelector, ColumnSettingsDropdown, TabSettings, ExportProgress, MilestoneCountdown, DailyReflect, CommandPalette |
| `components/workspace-modals/` | WorkspaceModals, TaskForm, BranchDialog, ChecklistManager, ChecklistTemplateModal, PageSizeModal, QRExportModal, MonthlySummaryModal, MonthlySummaryCharts, RechartsSummary, SprintManager, WorkerManager, ProjectManager, MilestoneManager, WorkspaceSettings, ExportImport, ProfileModal |
| `components/test-cases/` | TestCaseStepList + pieces of the test-case pages |
| `components/devtools/` | DevTimer, TimerDashboard, QuickNotes, BookmarkManager, WhiteboardModal, HtmlPreview, RegexTester, JsonYamlConverter, ApiTester, DiffChecker, CsvJsonViewer, EncoderDecoder, NotificationCenter, SidebarUtilityTools |
| already done | `components/language-picker.tsx`, `components/palette-switch.tsx`, `components/theme-switch.tsx`, `components/layout/*`, `components/ui/*` |

## Svelte -> React conversion table
| Svelte | React |
|---|---|
| `export let foo` | prop `foo` |
| `export let foo = x` | destructured default |
| `createEventDispatcher()`; `dispatch("save", d)` | prop `onSave?: (d) => void`; call `onSave?.(d)` (event name -> `on` + PascalCase) |
| `on:click={h}` | `onClick={h}`; modifiers: `\|preventDefault` -> call `e.preventDefault()`, `\|stopPropagation` -> `e.stopPropagation()`, `\|self` -> check `e.target === e.currentTarget` |
| `bind:value={x}` (child component) | props `value` + `onValueChange` (generally `<prop>` + `on<Prop>Change`) |
| `bind:value` on `<input>` | controlled `value` + `onChange` |
| `bind:this={el}` | `useRef` |
| `let x = ...` reactive state | `useState` |
| `$: y = f(x)` | `useMemo` (or plain derived const if cheap) |
| `$: { sideEffect }` | `useEffect` with explicit deps |
| `onMount(fn)` / return cleanup | `useEffect(() => { ...; return cleanup }, [])` |
| `onDestroy(fn)` | cleanup of the matching effect |
| `{#if}`/`{:else}` | ternary / `&&` |
| `{#each xs as x (key)}` | `xs.map(x => <X key=...>)` |
| `{#await}` | state + effect |
| `{@html s}` | `dangerouslySetInnerHTML` (only for already-sanitised/trusted HTML; keep whatever sanitising the Svelte code did) |
| `<slot/>`, named slots | `children`, or explicit `ReactNode` props |
| `<svelte:component this={C}>` | `const C = ...; <C />` |
| `<svelte:head><title>` | `useEffect(() => { document.title = ... })` |
| `<svelte:window on:keydown>` | `useEffect` + `window.addEventListener` |
| `transition:fade/scale/slide`, `animate:flip` | Tailwind (`animate-in fade-in zoom-in-95`, `transition-*`) from tw-animate-css, or CSS. Dialogs use shadcn `Dialog`. |
| `use:action` | `useEffect` with a ref, or a small hook |
| `class:foo={cond}` | `cn("base", cond && "foo")` from `@/lib/utils` |
| `style:--x={v}` | `style={{ "--x": v } as React.CSSProperties}` |
| scoped `<style>` | Tailwind utilities; if CSS is unavoidable, a colocated `*.css` file imported by the component |
| `lucide-svelte` | `lucide-react` (same icon names; `size={16}` prop works) |
| `svelte-dnd-action` | `@dnd-kit` (`DndContext`, `SortableContext`, `useSortable`) |
| `@friendofsvelte/tipex` / tiptap in Svelte | `@tiptap/react` (`useEditor`, `EditorContent`) |
| `date-picker-svelte` | `react-day-picker` (see `components/ui/calendar` if present, else use it directly) |
| `$app/navigation` `goto(url)` | `useRouter().push(url)` from `next/navigation` (`replaceState` -> `router.replace`) |
| `$app/stores` `$page.params.x` | `useParams<{ x: string }>()` ; `$page.url.searchParams` -> `useSearchParams()` ; `$page.url.pathname` -> `usePathname()` |
| `$app/paths` `base` | none. Paths start at `/` (`/workspace/${id}`) |
| `$app/environment` `browser` | `import { browser } from "@/lib/env"` (non-component code) or guard with `typeof window` |
| `import.meta.env.VITE_X` | `process.env.NEXT_PUBLIC_X` |
| `import x from "$lib/assets/foo.svg"` | file in `public/`, use `<img src="/foo.svg">` (`/favicon.svg` exists) |
| `+page.ts` `load` | do the work in the component with effects |
| `export const ssr = false` | the page file is a client component (`"use client"`) |

## Stores (Svelte-compatible, already ported in `lib/stores/*`)
`@/lib/store` provides `writable`, `readable`, `derived`, `get`, and the React hook `useStore(store)` (the equivalent of `$store`).
- Read a store in a component: `const tasks = useStore(tasksStore);`
- Write: call the store/action functions exactly as the Svelte code did (`store.set`, `store.update`, action modules in `lib/stores/*Actions.ts`).
- Outside components: `get(store)`.
- Import paths: `$lib/stores/foo` -> `@/lib/stores/foo`, `$lib/db` -> `@/lib/db`, `$lib/types` -> `@/lib/types`, `$lib/utils/*` -> `@/lib/utils/*` (note: `@/lib/utils` is the `cn()` helper file, `@/lib/utils/foo` are the ported helpers).
- Auth: the React hook is `useAuth()` from `@/lib/auth/auth-provider` (`{ user, loading, signIn, signOut }`). The store `@/lib/stores/auth` (`user`, `authLoading`) is a read-only mirror for non-React code; never `set` it.
- Workspace selection store/helpers: `@/lib/stores/workspace` (same API as Svelte). `@/lib/workspace` is the older small module (type `Workspace`, `MY_TASKS_WORKSPACE_ID`, `setWorkspaceId`); prefer `@/lib/stores/workspace`.
- Theme: `useTheme()` from `next-themes` (`resolvedTheme === "dark"`); `@/lib/stores/theme` exposes only `theme.toggle()` for non-React code.
- Page store: `@/lib/page-store` `page` (`params`, `url`) for non-React code only.

## API, i18n
- API client: `import { api } from "@/lib/api/apis"` (identical surface to `$lib/apis`). Every response: `await res.json()` is `any`.
- i18n: `const { t, locale } = useI18n()` from `@/lib/i18n`. `$_("key", { values: { n } })` (svelte-i18n) -> `t("key", { n })` (interpolates `{n}`). Keys are the existing ones in `lib/i18n/locales/*.json`; **do not add keys** (report any missing key). Arrays in the JSON (e.g. month names) are not available via `t` (flattened strings only): read them from the JSON import directly if needed. Non-React code: `translate(key, vars)` from `@/lib/i18n`.

## UI / design rules (from the repo's CLAUDE.md)
- Use shadcn components from `@/components/ui/*` (`button`, `input`, `label`, `card`, `dialog`, `dropdown-menu`, `select`, `badge`, `skeleton`, `sidebar`, `sheet`, `tooltip`, `command`, `scroll-area`, `separator`, `avatar`, `collapsible`, `sonner`). Modals -> `Dialog`. Toasts -> `toast` from `sonner` if the Svelte code used a toast.
- Semantic color tokens, not hard-coded palettes: `bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary text-primary-foreground`, `text-destructive`, `text-success`, `text-warning`, `bg-brand-500` (follows the selected palette). Fixed status colors in data (priority/status badges: red/amber/emerald etc.) may stay as Tailwind colors. Dark mode is class based (`dark:`).
- Font is LINE Seed everywhere (inherited from `html`); never set `font-family`.
- Accessibility: semantic elements (`button`, `label htmlFor`, headings), `aria-label` on icon-only buttons, Radix handles focus/Escape for dialogs/menus; keep keyboard shortcuts working.
- Reuse existing components before creating new ones; keep local UI state local.
- No comments unless they explain a non-obvious constraint. No dead code.
- No Storybook/tests in `web/` for now.

## Route notes
- All pages are client-rendered (original had `ssr = false`). Auth gating: wrap authenticated pages with `AuthenticatedLayout` from `@/components/layout/authenticated-layout` and render a `Header` (`@/components/layout/header`) with `Search`, `LanguagePicker`, `PaletteSwitch`, `ThemeSwitch` plus `Main` (`@/components/layout/main`), exactly like `app/dashboard/page.tsx`. Public/auth pages (login, create-account, setup-password, public test cases) do not use it. Mirror `app/login/page.tsx` for the dark glass auth look.
- Dynamic segments: `app/workspace/[workspace_id]/page.tsx`; read with `useParams`.
- Navigation links use `next/link` `<Link href="/...">`.
- Trailing slash: none.

## Final report (keep it short)
1. Files created (paths + line counts), 2. what is intentionally not ported or simplified and why, 3. "Needs from integrator" (shared files/keys/packages/contract mismatches), 4. remaining `tsc` errors in your files (should be none).
