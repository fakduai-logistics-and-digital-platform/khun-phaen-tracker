# CLAUDE.md

Project instructions for Claude Code in this repository.

## Project Overview

Khun Phaen Tracker is a local-first task management app with optional real-time sync.

- Frontend: `web/` — Next.js App Router on vinext, React 19, TypeScript, shadcn/ui, Tailwind CSS 4, statically exported to GitHub Pages
- Local data: browser IndexedDB via `idb` (API read cache)
- Backend: Rust Cloudflare Worker (D1 + Durable Objects) in `backend-worker/`
- Storage: S3-compatible RustFS for attachments
- Checks: `npm run typecheck` and `npm run lint` (oxlint, zero warnings) in `web/`; Vitest at the repo root for scripts; `cargo test` for Rust

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

## Working Style

- On session start, remove stale `.claude/worktrees/*` entries if safe; if removal fails because a worktree may be active or locked, leave it alone.
- If you create or use a Claude worktree during a task, clean it up before finishing when it is no longer needed.
- Read surrounding code before editing.
- Prefer direct, boring solutions over new abstractions.
- Do not rewrite broad areas unless user explicitly asks.
- Keep behavior unchanged unless task asks for behavior change.
- Avoid unrelated formatting churn.
- Prefer editing existing files over creating new files.
- Do not add comments unless they explain a non-obvious invariant or constraint.
- Delete truly unused code instead of leaving compatibility shims or dead exports.

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

## Backend / Rust Rules

- Keep errors explicit and contextual.
- Avoid `unwrap`/`expect` in production code unless invariant is obvious from surrounding context.
- Do not hold locks or borrows across `.await` unless deliberately designed.
- Keep async boundaries visible.
- Validate data at API, WebSocket, storage, and auth boundaries.
- Treat auth, cookies, tokens, invite/setup flows, and file upload/download URLs as high-risk.

## Sync / Data Model Rules

When changing task, project, member, auth, attachment, or sync fields:

- Check all affected layers: TypeScript types, IndexedDB persistence, UI forms/views, import/export, WebSocket messages, Rust API models, D1 persistence, and tests.
- Use the `sync-protocol-validator` skill when changing schemas, collections, or sync protocol messages.
- Keep client/server contract changes explicit and tested.
- Preserve local-first behavior: offline data must remain usable, and reconnect/sync paths must not corrupt local state.

## Commands

Use narrow validation first.

Frontend (run inside `web/`):

```sh
npm run typecheck
npm run lint
npm run build          # Cloudflare Workers build
npm run build:pages    # static export for GitHub Pages
```

Repository root:

```sh
npm test               # Vitest for scripts/
```

Backend validation:

```sh
npm run worker:check
npm run worker:test
npm run worker:smoke
```

Local development:

```sh
cd web && npm run dev   # http://localhost:3100 via .claude/launch.json
npm run worker:dev      # from the repo root
```

## Validation Expectations

- For TypeScript/React changes in `web/`, run `npm run typecheck` and `npm run lint` (both must be clean).
- For behavior changes, run targeted Vitest tests when available.
- For UI changes, start app and verify in browser before saying complete.
- For route, link, or asset changes, also run `npm run build:pages` and check that all routes are exported.
- Run `npm run lint:design` when editing DESIGN.md or design-token guidance.
- For Rust changes, run targeted `cargo test` or backend command-level validation.
- If validation cannot run, state exact command skipped, reason, and remaining risk.

## Review Expectations

When asked to review or audit:

- Findings first, ordered by severity.
- Cite concrete file and line links.
- Explain why issue matters and what fix fits.
- Avoid generic advice not grounded in actual code path.
- Mention residual validation gaps.

## Security Boundaries

- Never commit secrets from `.env` or credentials.
- Treat `.env`, auth tokens, setup tokens, invite links, S3/RustFS credentials, and JWT config as sensitive.
- Validate user input before it crosses frontend/backend/storage boundaries.
- Prefer backend-owned secure cookies for auth tokens when possible.
- Avoid exposing private file URLs or authorization decisions in browser-only code.
