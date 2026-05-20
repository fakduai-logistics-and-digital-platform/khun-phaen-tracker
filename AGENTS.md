# Repository Instructions

Use super ultra thinking for engineering work. Solve issues completely, with enough context gathering, validation, and clear tradeoff handling for the actual risk of the change.

This repository is Khun Phaen Tracker: a local-first SvelteKit task tracker with IndexedDB storage, optional real-time sync through a Rust/Axum backend, MongoDB persistence, RustFS/S3-compatible attachments, and Rust WebAssembly crates for CRDT, compression, and search.

## Operating Principles

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

## Project Map

- `src/`: SvelteKit frontend.
- `src/lib/components/`: Svelte UI components and component tests.
- `src/lib/stores/`: shared frontend state, sync, auth, workspace, notifications, search, timers, and actions.
- `src/lib/db.ts`: IndexedDB persistence and migrations.
- `src/lib/types.ts` and `src/lib/types/`: frontend domain contracts.
- `src/lib/i18n/locales/en.json` and `src/lib/i18n/locales/th.json`: required translation files.
- `src/app.css`: Tailwind v4 theme tokens, global dark mode, and typography.
- `src/routes/`: SvelteKit routes.
- `backend-server/`: Rust Axum API/WebSocket sync server.
- `backend-server/src/models/`: MongoDB/API data models.
- `backend-server/src/handlers/`: HTTP and WebSocket request boundaries.
- `backend-server/src/services/`: business logic.
- `backend-server/src/repositories/`: MongoDB persistence.
- `wasm-crdt/`, `wasm-compress/`, `wasm-search/`: Rust WASM crates.
- `static/wasm*` and `src/lib/wasm-crdt-pkg/`: generated or copied WASM/browser artifacts.

## Frontend Rules

- For every UI addition or modification, add or update the related Storybook story. If an adequate story already exists, reference it and keep it aligned with the changed UI.
- Before UI, layout, color, theme, visual component, or Storybook work, read DESIGN.md and follow its design tokens from src/app.css; visual output should not drift significantly from the existing design system. For non-UI work, do not read DESIGN.md unless needed.
- Reuse existing components and patterns before creating new ones. If UI code grows, split it into focused child components under src/lib/components/ or nearby route-local components.
- Keep each file under 500 lines whenever practical; if a file exceeds that, extract focused child components, helpers, stores, or modules.
- Keep Svelte components focused on one rendering responsibility.
- Use stores only for shared app state. Keep local UI state in the component.
- Keep Svelte reactive statements short and side-effect-light.
- Prefer explicit props and events over module-level mutable state.
- Move reusable behavior into plain TypeScript helpers, stores, or actions when it clarifies the component.
- Avoid hardcoded user-facing strings in Svelte templates. Add keys to both `en.json` and `th.json`.
- Use the existing `svelte-i18n` style already present in nearby files.
- Use theme tokens from `src/app.css` such as `primary`, `success`, `warning`, `danger`, and `gray-*`. Avoid arbitrary hex/RGB colors in UI code unless there is a clear local precedent.
- Preserve dark mode. New UI must work with `dark:` variants and the existing app surfaces.
- Preserve Thai typography by inheriting the global font stack.
- Use semantic HTML first. Add ARIA only when semantics are insufficient.
- For interactive components, verify keyboard access, visible focus, labels, disabled states, and screen-reader behavior.
- Use `lucide-svelte` icons when the app already has an equivalent icon.
- Do not introduce trusted authorization logic, secret handling, or token validation into client-only code.

## Backend Rules

- Keep Axum handlers thin: parse/validate the request, call services, and shape the response.
- Keep business decisions in services and persistence concerns in repositories.
- Keep Rust errors explicit and contextual. Use `Result` for recoverable errors.
- Avoid `unwrap`/`expect` in production paths unless an invariant is obvious and documented by context.
- Do not hold locks or long borrows across `.await` unless deliberately designed.
- Treat auth, cookies, request parsing, file uploads, storage credentials, and workspace permissions as high-risk trust boundaries.
- For new application IDs, use UUIDs only. Do not introduce MongoDB ObjectId or integer IDs as application-level identifiers.
- When adding fields to existing MongoDB documents, use backward-compatible serde handling such as `Option<T>` or defaults where appropriate.

## Sync And Data Contracts

When a task changes a shared model, update every affected layer together:

- TypeScript interfaces in `src/lib/types.ts` or `src/lib/types/`.
- IndexedDB schema, defaults, migrations, and tests in `src/lib/db.ts` / `src/lib/db.unit.test.ts`.
- Frontend sync payloads in `src/lib/stores/sync.ts`, `src/lib/stores/crdt-sync.ts`, or related stores.
- Rust structs under `backend-server/src/models/`.
- Repository queries, service logic, handlers, and WebSocket message handling.
- Tests that cover old data, new data, and sync round-trips where practical.

New collections, indexes, serialized fields, or sync message shapes are contract changes. Keep old clients/data in mind and avoid silent data loss.

## WASM Rules

- Edit Rust source in the relevant WASM crate first; do not patch generated JS/WASM artifacts as the source of truth.
- After WASM changes, update TypeScript bindings and copied static artifacts through the project workflow or documented build command.
- Validate both the Rust crate and the frontend integration path that imports the generated package.
- Keep browser-facing APIs small and typed. Document any serialization format shared between Rust and TypeScript.

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
- Keep Svelte reactive statements short and side-effect-light.
- Keep Rust errors explicit and contextual.
- Avoid broad rewrites, speculative abstractions, and unrelated formatting churn.
- Add or update focused tests when behavior, shared helpers, contracts, persistence, sync, or error handling changes.
- For UI work, add/update Storybook stories or explicitly reference the existing story that covers the changed component.

## Validation Default

Use the narrowest useful validation first, then broaden only when risk requires it.

- Frontend type/template check: `npm run check`.
- Frontend unit tests: `npm test`.
- Frontend production build: `npm run build`.
- Storybook build: `npm run build-storybook` when component stories, component visuals, or Storybook config change.
- Design.md lint: `npm run lint:design` when DESIGN.md or design-token guidance changes.
- Backend compile check: `cd backend-server && cargo check`.
- Backend tests: `cd backend-server && cargo test`.
- WASM crate checks/tests: run `cargo check` or `cargo test` inside the affected `wasm-*` crate.

If validation cannot run, state exactly why and what remains unverified.

## Security And Trust Boundaries

- Do not put secrets or trusted authorization logic in client-only code.
- Treat auth, cookies, localStorage, API response parsing, file upload/download paths, WebSocket messages, and server/client boundaries as high-risk areas.
- Prefer backend-owned secure cookies for auth tokens when possible.
- Validate user input before it crosses trust boundaries.
- Ensure workspace/member permissions are enforced on the backend, not only hidden in the UI.
- Avoid logging secrets, tokens, passwords, invite/setup links, storage credentials, or private user data.
