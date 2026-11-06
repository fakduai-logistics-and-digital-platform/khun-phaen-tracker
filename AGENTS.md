# Repository Instructions

Use super ultra thinking for engineering work. Solve issues completely, with enough context gathering, validation, and clear tradeoff handling for the actual risk of the change.

This repository is Khun Phaen Tracker: a task tracker whose frontend (`web/`, Next.js + shadcn/ui) is hosted on GitHub Pages and talks to a Rust API (`backend-worker/` on Cloudflare Workers, D1 + Durable Objects) with real-time updates, plus RustFS/S3-compatible attachments.

## Operating Principles

- On session start, remove stale `.claude/worktrees/*` entries if safe; if removal fails because a worktree may be active or locked, leave it alone.
- If you create or use a Claude worktree during a task, clean it up before finishing when it is no longer needed.
- Read the surrounding code before editing and follow existing conventions unless they are clearly harmful.
- Prefer the smallest behavior-preserving change that solves the issue.
- Keep state local unless shared state is genuinely needed.
- Derive values instead of manually synchronizing duplicate state.
- Avoid broad rewrites, speculative abstractions, unrelated formatting churn, and metadata-only noise.
- Protect user changes in the worktree. Do not revert files unless explicitly asked.
- Keep files focused. If a frontend or backend file approaches 500 lines, extract a real component, helper, service, or module instead of continuing to grow it whenever practical.
- Reuse and recycle existing components, helpers, stores, and design tokens before creating new code. Avoid duplicating near-identical UI or logic.
- For substantial frontend/backend implementation work, keep a compact checklist while working. If a temporary `TODO_<task>.md` is useful, update it as tasks complete and remove it before final delivery.
- If you start a backend or support service for validation, stop it before finishing unless the user explicitly asks to keep it running. If you start the frontend dev server for UI validation, report the URL and whether it is still running.

## Project-Installed Skill Triggers

Use project-installed skills only when their trigger matches, to avoid loading extra context.

- `a11y-standards` (`.claude/skills/a11y-standards`): use for modals, dialogs, overlays, drag-and-drop, dropdowns, command palettes, forms, keyboard interaction, focus management, ARIA, color contrast, or dark-mode accessibility.
- `i18n-theme-token` (`.claude/skills/i18n-theme-token`): use for UI components/pages, user-facing strings, translation keys, Tailwind theme tokens, dark mode, or Thai typography.
- `sync-protocol-validator` (`.claude/skills/sync-protocol-validator`): use for task/project/member/workspace schema changes, new collections, IndexedDB migrations, WebSocket message shapes, serialization, or full-stack model consistency.
- `debug-mantra`: use when debugging starts: bug report, failing test, regression, stack trace, or broken behavior.
- `diagnose`: use for hard bugs or performance regressions that need reproduce → minimise → hypothesise → instrument → fix → regression-test.
- `scrutinize`: use for review, audit, sanity-check, PR/diff/plan/design second opinion.
- `tdd`: use when user asks for TDD, red-green-refactor, test-first work, or integration-test-first fix/feature.
- `post-mortem`: use after a validated bug fix when user asks for RCA, postmortem, root-cause writeup, or fix documentation.
- `karpathy-guidelines`: use for AI/ML model, training, evaluation, dataset, prompt/model behavior, or Karpathy-style engineering guidance.
- `search-first`: use before non-trivial feature work, refactors, bug fixes with unclear ownership, or UI changes where existing components/patterns may already exist. Do not use for tiny one-file edits or when exact file/function is already known.
- `verification-loop`: use after implementation when behavior must be proven: UI changes, data/sync changes, bug fixes, build/test failures, or anything user asks to verify. Keep validation narrow first, then broaden only when risk requires.
- `security-scan`: use for auth, cookies, JWT, invite/setup flows, permissions, file uploads/downloads, WebSocket messages, storage credentials, MCP/hooks/settings, or before release/security review. Do not run broad scans for ordinary UI-only edits unless sensitive paths changed.

## Project Map

- `web/`: Next.js (vinext) frontend, see `web/README.md` and `web/PORTING.md`.
- `web/app/`: routes (static, ids in the query string) and `globals.css` (theme tokens, palettes, typography).
- `web/components/`: shadcn/ui (`ui/`) and feature components (`workspace/`, `test-cases/`, `task-detail/`, `devtools/`, ...).
- `web/lib/`: stores, API client (`lib/api/`), routes, i18n (`lib/i18n/locales/en.json` and `th.json`), IndexedDB read cache.
- `backend-worker/`: Rust Cloudflare Worker API (D1 + Durable Objects), see `backend-worker/README.md`.
- `backend-worker/src/`: HTTP routing, auth, domain handlers and Durable Objects.
- `backend-worker/migrations/`: D1 schema migrations.
- `backend-worker/tests/`: smoke, parity and legacy-route contract tests run by `npm run worker:smoke`.
- `.github/workflows/deploy.yml`: builds `web/` and publishes it to GitHub Pages.

## Frontend Rules

The frontend is `web/` (Next.js App Router on vinext, React 19, shadcn/ui, Tailwind CSS 4). Run its commands from `web/`.

- Before UI, layout, color, theme, or visual component work, read DESIGN.md and follow the design tokens in `web/app/globals.css`; visual output should not drift from the shadcn-admin look. For non-UI work, do not read DESIGN.md unless needed.
- Use shadcn/ui components from `web/components/ui/` (Button, Card, Badge, Select, Table, Tabs, Dialog, DropdownMenu, Progress, Checkbox, ...). Do not hand-write CSS for something shadcn already provides. If a component is missing, add the standard shadcn version rather than a custom one.
- Reuse existing components, helpers, stores, and design tokens before creating new ones. Recycle patterns rather than duplicating near-identical UI.
- Keep each file under 500 lines whenever practical; if a file exceeds that, extract focused child components, hooks, or helpers.
- Keep components focused on one rendering responsibility. Keep local UI state local; use shared stores only when state is genuinely shared.
- Derive values instead of manually syncing duplicate state.
- Prefer semantic HTML first; add ARIA only when semantics are insufficient. Name handlers by user intent.
- Type scale follows shadcn-admin: `text-sm` body, `font-medium`/`font-semibold`, `text-xs` only for dense data. No uppercase tracked labels, no gradients or glows.
- Avoid hardcoded user-facing strings. Add keys to both `web/lib/i18n/locales/en.json` and `th.json` and use `useI18n()` / `translate()`.
- Use theme tokens (`primary`, `success`, `warning`, `destructive`, `muted-foreground`, ...). Avoid arbitrary hex/RGB colors in UI code unless there is a clear local precedent. Preserve dark mode and the palette system.
- Routes are static: the app is exported to GitHub Pages, so ids travel in the query string (`?ws=<workspace>&id=<task>`). Build links with `web/lib/routes.ts`, prefix URLs that bypass the router (`<img src>`, `fetch`, `window.open`, copied links) with `withBase()` from `web/lib/base-path.ts`, and do not add server-only features (cookies(), headers(), server actions, route handlers, redirects in `next.config.ts`).
- Do not put secrets, trusted auth logic, or authorization decisions in client-only code.

## Backend Rules

- Keep request handlers thin: parse/validate the request, call services, and shape the response.
- Keep business decisions in services and persistence concerns in repositories.
- Keep Rust errors explicit and contextual. Use `Result` for recoverable errors.
- Avoid `unwrap`/`expect` in production paths unless an invariant is obvious and documented by context.
- Do not hold locks or long borrows across `.await` unless deliberately designed.
- Treat auth, cookies, request parsing, file uploads, storage credentials, and workspace permissions as high-risk trust boundaries.
- For new application IDs, use UUIDs only. Do not introduce integer IDs as application-level identifiers.
- When adding fields to existing records, keep serde handling backward compatible (`Option<T>` or defaults) and add a D1 migration under `backend-worker/migrations/`.

## Sync And Data Contracts

When a task changes a shared model, update every affected layer together:

- TypeScript interfaces in `web/lib/types.ts` or `web/lib/types/`.
- IndexedDB schema, defaults, and migrations in `web/lib/db.ts`.
- Realtime payloads in `web/lib/stores/realtime.ts` and related stores.
- D1 migrations, handlers, and Durable Object / WebSocket message handling under `backend-worker/`.
- Tests that cover old data, new data, and sync round-trips where practical.

New collections, indexes, serialized fields, or sync message shapes are contract changes. Keep old clients/data in mind and avoid silent data loss.

## Review Default

When the user asks for a review, audit from a correctness and maintainability stance:

- Report findings first, ordered by severity.
- Cite concrete file and line references.
- Explain why each issue matters and what fix is appropriate.
- Avoid generic advice that is not grounded in the code.
- Mention residual test or validation gaps.

## Implementation Default

When the user asks for a fix or feature:

- Read surrounding code before editing.
- Keep state local unless shared state is needed.
- Derive values instead of manually synchronizing duplicate state.
- Keep Rust errors explicit and contextual.
- Avoid broad rewrites, speculative abstractions, and unrelated formatting churn.
- Add or update focused tests when behavior, shared helpers, contracts, persistence, sync, or error handling changes.
- For UI work, build from shadcn/ui components and verify the page in the browser.

## Validation Default

Use the narrowest useful validation first, then broaden only when risk requires it.

- Frontend (in `web/`): `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run build:pages` when routes, links, or assets change.
- Repository scripts: `npm test` at the repo root.
- Design.md lint: `npm run lint:design` when DESIGN.md or design-token guidance changes.
- Backend compile check: `npm run worker:check`.
- Backend tests: `npm run worker:test` and `npm run worker:smoke`.

If validation cannot run, state exactly why and what remains unverified.

## Security And Trust Boundaries

- Do not put secrets or trusted authorization logic in client-only code.
- Treat auth, cookies, localStorage, API response parsing, file upload/download paths, WebSocket messages, and server/client boundaries as high-risk areas.
- Prefer backend-owned secure cookies for auth tokens when possible.
- Validate user input before it crosses trust boundaries.
- Ensure workspace/member permissions are enforced on the backend, not only hidden in the UI.
- Avoid logging secrets, tokens, passwords, invite/setup links, storage credentials, or private user data.
