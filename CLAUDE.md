# CLAUDE.md

Project instructions for Claude Code in this repository.

## Project Overview

Khun Phaen Tracker is a local-first task management app with optional real-time sync.

- Frontend: SvelteKit 2, Svelte 5, TypeScript, Vite, Tailwind CSS 4
- Local data: browser IndexedDB via `idb`
- Backend: Rust WebSocket/API sync server in `backend-server/`
- Storage: S3-compatible RustFS for attachments
- Extra native modules: `wasm-compress/`, `wasm-crdt/`, `wasm-search/`
- Tests: Vitest, Testing Library, Playwright browser integration, Storybook

## Project-Installed Skill Triggers

Use project-installed skills only when their trigger matches, to avoid loading extra context.

- `svelte-rust-clean-code` (`plugins/svelte-rust-clean-code/...`): always-on only for Svelte, SvelteKit, TypeScript frontend, Rust backend, shared contracts, sync, review, refactor, maintainability, correctness, or bug-fix work.
- `a11y-standards` (`.claude/skills/a11y-standards`): use for modals, dialogs, overlays, drag-and-drop, dropdowns, command palettes, forms, keyboard interaction, focus management, ARIA, color contrast, or dark-mode accessibility.
- `i18n-theme-token` (`.claude/skills/i18n-theme-token`): use for UI components/pages, user-facing strings, translation keys, Tailwind theme tokens, dark mode, or Thai typography.
- `local-first-crdt` (`.claude/skills/local-first-crdt`): use for IndexedDB, offline-first flows, sync queues, WebSocket reconnect/conflict handling, CRDT behavior, or local-first WASM interactions.
- `storybook-component-guide` (`.claude/skills/storybook-component-guide`): use for new reusable Svelte components, component prop/visual refactors, visual docs, regression stories, or Storybook changes.
- `sync-protocol-validator` (`.claude/skills/sync-protocol-validator`): use for task/project/member/workspace schema changes, new collections, IndexedDB migrations, WebSocket message shapes, serialization, or full-stack model consistency.
- `wasm-bridge-builder` (`.claude/skills/wasm-bridge-builder`): use for `wasm-crdt`, `wasm-compress`, `wasm-search`, wasm-pack builds, generated TypeScript bindings, copied WASM artifacts, or WASM integration bugs.
- `debug-mantra`: use when debugging starts: bug report, failing test, regression, stack trace, or broken behavior.
- `diagnose`: use for hard bugs or performance regressions that need reproduce → minimise → hypothesise → instrument → fix → regression-test.
- `scrutinize`: use for review, audit, sanity-check, PR/diff/plan/design second opinion.
- `tdd`: use when user asks for TDD, red-green-refactor, test-first work, or integration-test-first fix/feature.
- `post-mortem`: use after a validated bug fix when user asks for RCA, postmortem, root-cause writeup, or fix documentation.
- `karpathy-guidelines`: use for AI/ML model, training, evaluation, dataset, prompt/model behavior, or Karpathy-style engineering guidance.
- `search-first`: use before non-trivial feature work, refactors, bug fixes with unclear ownership, or UI changes where existing components/patterns may already exist. Do not use for tiny one-file edits or when exact file/function is already known.
- `verification-loop`: use after implementation when behavior must be proven: UI changes, Storybook changes, data/sync changes, bug fixes, build/test failures, or anything user asks to verify. Keep validation narrow first, then broaden only when risk requires.
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

- For every UI addition or modification, add or update the related Storybook story. If an adequate story already exists, reference it and keep it aligned with the changed UI.
- Before UI, layout, color, theme, visual component, or Storybook work, read DESIGN.md and follow its design tokens from src/app.css; visual output should not drift significantly from the existing design system. For non-UI work, do not read DESIGN.md unless needed.
- Reuse existing components, helpers, stores, and design tokens before creating new ones. Recycle patterns rather than duplicating near-identical UI.
- Split large UI into smaller components when code grows. Keep each file under 500 lines whenever practical; if a file exceeds that, extract focused child components or helpers.
- Keep Svelte components focused on one rendering responsibility.
- Keep local UI state local; use shared stores only when state is genuinely shared.
- Derive values instead of manually syncing duplicate state.
- Keep reactive statements short and side-effect-light.
- Prefer semantic HTML first; add ARIA only when semantics are insufficient.
- Name handlers by user intent.
- Avoid imperative DOM manipulation unless necessary for integration with third-party libraries.
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

- Check all affected layers: TypeScript types, IndexedDB persistence, UI forms/views, import/export, WebSocket messages, Rust API models, MongoDB persistence, and tests.
- Use the `sync-protocol-validator` skill when changing schemas, collections, or sync protocol messages.
- Keep client/server contract changes explicit and tested.
- Preserve local-first behavior: offline data must remain usable, and reconnect/sync paths must not corrupt local state.

## Commands

Use narrow validation first.

```sh
npm run check
npm run test
npm run build
npm run storybook
npm run build-storybook
```

Backend validation:

```sh
cd backend-server && cargo test
cd backend-server && cargo run --release
```

Local development:

```sh
npm run dev
cd backend-server && cargo run --release
```

Full stack with containers:

```sh
podman-compose up -d --build
podman-compose down
```

## Validation Expectations

- For TypeScript/Svelte changes, run `npm run check` or the narrowest relevant test.
- For behavior changes, run targeted Vitest tests when available.
- For UI changes, start app and verify in browser before saying complete.
- For UI changes, update or confirm relevant Storybook stories and run `npm run build-storybook` when stories or component visuals change.
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
