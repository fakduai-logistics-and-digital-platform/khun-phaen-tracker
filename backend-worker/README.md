# Rust Workers migration

The new backend uses Rust Workers, D1, the existing RustFS S3 service, and SQLite-backed Durable Objects. IndexedDB is a read cache; it never accepts writes or merges records. New application IDs are UUIDs.

**Status: deployed at `https://api.khun-phaen.workers.dev` with the MongoDB data imported into D1. The legacy Axum backend (`backend-server/`) has been removed from the repository; it remains in git history.**

## Local development

Requirements: Node 22+, Rust with `wasm32-unknown-unknown`, and `worker-build` 0.8.7.

```sh
npm ci
rustup target add wasm32-unknown-unknown
cargo install worker-build --version 0.8.7 --locked
npm run worker:setup
npm run worker:migrate:local
npm run worker:dev
```

`worker:setup` reads server configuration from the root `.env`, preserves existing values in `backend-worker/.dev.vars`, and generates a local initial setup token if missing. It prints no credentials. Configure these server-only values in `.env`, then run `worker:setup`:

```dotenv
STORAGE_URL=http://127.0.0.1:9000
STORAGE_BUCKET=khunphaen-assets
STORAGE_REGION=us-east-1
RUSTFS_ACCESS_KEY=...
RUSTFS_SECRET_KEY=...
ALLOWED_ORIGIN=http://127.0.0.1:5174
```

`STORAGE_URL` must be the path-style S3 API origin, not a management console or bucket URL. The existing remote server responds to `/health` on port 9000. The supplied management URL is saved separately as `RUSTFS_CONSOLE_URL` in the local root `.env`. Neither file is tracked. For production, expose the same service through HTTPS so private files are encrypted in transit. Existing `.dev.vars` values must be edited explicitly to change them; setup never overwrites them.

Local Worker URL: `http://127.0.0.1:8787`. Wrangler uses a local D1 database and local Durable Objects; `--local` never touches the remote database. `wrangler.jsonc` holds production values (remote D1 id, GitHub Pages origin, HTTPS RustFS, secure cookies); `.dev.vars` overrides `ALLOWED_ORIGIN`, `COOKIE_SECURE` and `STORAGE_URL` for local development. Production: `https://api.khun-phaen.workers.dev`. No Cloudflare account or paid service is needed for these tests.

To try the new API from the frontend, set these **only when testing the migrated slice**:

```dotenv
VITE_SERVER_URL=http://127.0.0.1:8787
VITE_API_URL=http://127.0.0.1:8787/api
VITE_WS_URL=ws://127.0.0.1:8787/ws
```

Restart Vite after changing frontend variables. Match `ALLOWED_ORIGIN` to the actual frontend origin. Create the first admin using `POST /api/auth/invite` with `X-Setup-Token` from local `.dev.vars`, an email, and a password of 12–72 UTF-8 bytes; passwords use bcrypt cost 12. Further invitations require an authenticated admin. Existing MongoDB users and data are not automatically imported.

## Implemented and verified

- Local Worker/Wasm build, two versioned D1 migrations, prepared SQL parameters, nullable/numeric Rust-to-JavaScript bindings.
- Invite/bootstrap, password activation, bcrypt login, server-side revocable sessions, `me`, logout and admin user listing. Password work runs in an Auth Durable Object; login/setup attempts are limited before hashing.
- Workspace list/create/update/delete, access checks and dashboard workspace task counts. Owner or linked assignee access is enforced by the backend.
- Workspace-scoped task CRUD and numbering; projects, assignees, assignee groups, sprints, milestones, and checklist template CRUD foundation. Complex subresource behavior still needs parity checks below.
- Durable Object per workspace, hibernating WebSockets, short-lived single-use connection tickets, session and membership revalidation before delivery, backend-only publish after D1 writes. No peer mutation, CRDT, WebRTC, or offline write queue.
- RustFS task upload/delete/download adapter using SigV4 HTTP requests. Each read/write is authorized against the owning workspace/task. Uploads are capped at 10 MiB per request to bound Worker memory. File parsing/hashing runs in a storage Durable Object to avoid the ordinary Worker CPU limit. Live RustFS integration still needs credentials and end-to-end validation.
- Network-first JSON read cache in IndexedDB, separated by authenticated session, complete URL and workspace. Fallback is limited to 15-minute-old reads on network errors; authorization/admin responses and offline writes never fall back. Successful writes, realtime events and HTTP 401/403 invalidate the cache. An IndexedDB revision prevents old in-flight reads from repopulating an invalidated cache, including across tabs.

```sh
npm run worker:check
npm run worker:test
npm run worker:smoke
npm test -- --project unit src/lib/api-fetch.test.ts src/lib/task-pagination.test.ts src/lib/stores/notifications.test.ts src/lib/stores/realtime.test.ts src/lib/stores/workspaceActions.test.ts src/lib/stores/taskActions.test.ts src/lib/stores/auth.test.ts
```

`worker:smoke` creates a temporary local D1/DO state directory, starts a temporary Worker on port 8798, tests real HTTP/WebSocket behavior, and stops it and deletes its test state. It refuses a production URL. It tests bootstrap, login, UUIDs, unauthorized workspace access, CRUD persistence, immutable identity fields, explicit null updates, backend-only events and session revocation. It then runs `tests/parity.mjs` against fake S3/AI/webhook services (`scripts/worker-test-services.mjs`): profile/admin, metadata and My Tasks filters/paging/archive/numbering/concurrency, personal notifications, QA suites/cases/runs and public pages, multipart attachments and comments with SigV4 verification and failed-upload compensation, AI settings, and scheduled webhook/report jobs with cascades. It does not upload to the remote RustFS service.

## Importing MongoDB data

`scripts/mongo-to-d1.mjs` turns a MongoDB export into SQL for an **empty** D1 database with migrations 0001-0004 applied. It reads files only and never connects to MongoDB. Input is one file per collection: `<collection>.json` (EJSON array or NDJSON) or a DBX `<collection>.csv` export.

```sh
npm run worker:import-mongo -- backend-worker/db_mongo backend-worker/.migration/out
cd backend-worker
../node_modules/.bin/wrangler d1 migrations apply khun-phaen --local --persist-to .migration/d1
../node_modules/.bin/wrangler d1 execute khun-phaen --local --persist-to .migration/d1 --file .migration/out/import.sql
../node_modules/.bin/wrangler dev --persist-to .migration/d1   # try the imported data
```

- ObjectIds become deterministic UUIDv5 values, so a re-run produces identical IDs; existing UUIDs are kept. User IDs reuse the legacy `users.user_id` UUID.
- bcrypt password hashes are kept, so users sign in with their existing passwords. Pending invite tokens are stored hashed and keep working. Sessions are not imported.
- Comment image `file_key`s are kept unchanged and registered in `stored_objects`. No RustFS object is renamed or deleted.
- References to records that no longer exist are cleaned rather than imported broken (the Worker rejects edits that reference missing assignees). Every skip and cleanup is counted in `report.json`; files referenced only by skipped comments are listed under `unreferencedFiles`.
- AI/storage settings are not imported because the Worker encrypts them with `CONFIG_ENCRYPTION_KEY`; re-enter them in Settings. LINE Notify tokens are cleared and workspace MCP config is dropped.
- `db_mongo/` and `.migration/` contain password hashes and personal data and are gitignored. Delete them once the production import is verified.

## Free-tier design

- Keep the Cloudflare account on Workers Free. There is no R2, Queues or other paid binding in this configuration.
- All Durable Object classes use `new_sqlite_classes`, which is supported on Free. Workspace connections use `accept_web_socket`, without intervals that prevent hibernation.
- Use SQL indexes, bounded responses, and event-triggered refresh rather than frequent polling. D1 stores task metadata; file contents remain on RustFS.
- Free limits include 100,000 Worker requests/day, 10 ms CPU per ordinary HTTP request; D1 5 million rows read/day, 100,000 rows written/day, **500 MB per database** and 5 GB/account. Durable Objects have separate compute quotas. Exceeding Free quotas causes operations to fail, rather than silently provisioning a paid plan. Deployment/load testing must measure actual CPU and row counts; local success is not proof of cloud quota headroom.
- KV (`CACHE`) holds only the unauthenticated `/api/public/workspaces/...` responses, for 300 seconds, so public QA pages may be up to 5 minutes stale. KV Free allows 1,000 writes/day; a failed KV read or write falls back to D1. Sessions, access checks and settings are never cached because revocation and config changes must apply immediately. The Cache API is not used because it does nothing on `*.workers.dev`.
- Task lists page ids before resolving assignees, and `0005_query_indexes.sql` indexes archive state + `updated_at`. `0006_task_assignees.sql` adds a reverse index of `assignee_ids` maintained by SQLite triggers, so every write path (handlers, cascades, import) keeps it in sync; edits that leave `assignee_ids` unchanged write nothing extra. Measured on production data: task page 641 → 120 rows read, My Tasks count 1,704 → 90, assignee stats 9,376 → 476.
- RustFS continues using its existing server, disk and bandwidth. Those costs are separate from Cloudflare.

Official references: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Durable Object pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).

## Required before production cutover

- [x] Routes for profile/admin users, My Tasks, statistics, comments/images/reactions, QA suites/cases/runs, public test pages, AI configuration, storage administration and notification settings/schedules are implemented and covered by the local parity harness.
- [x] Per-user notification delivery uses a Durable Object; the backend owns recipients and the legacy SSE route returns 410.
- [x] Every legacy Axum route is routed (`tests/contract.mjs`). Handler-level permissions were compared with legacy; the Worker is deliberately stricter where legacy had holes (milestones, test runs, linking users to workspaces).
- [ ] Compare remaining response shapes, methods and status codes route-by-route against every frontend caller (the parity harness covers the main paths, not every caller).
- [ ] Export MongoDB and create a stable ObjectId-to-UUID mapping for every user, workspace, task, assignee and reference. Retain bcrypt hashes. Preserve RustFS object keys through attachment metadata mapping; do not rename or delete existing files as a side effect of database migration.
- [ ] Test RustFS with real credentials: HTTPS connectivity, bucket, content types, concurrent uploads, failed-upload compensation, download authorization, and old attachment keys.
- [ ] Test cold start/hibernation, reconnect after missed events, multi-user permissions, logout/revocation, and deployed CPU/row usage on Workers Free.
- [x] Remote D1 created, migrations applied, secrets and origin configured, Worker deployed and checked against the imported data. Switching the frontend to the new API is still pending.

Retired peer-sync/SSE routes return HTTP 410; unknown resources return HTTP 404. A successful health check does not imply API parity.

## Validation recorded for this slice

Last run: 6 November 2026.

- `npm run worker:check`: passed for `wasm32-unknown-unknown` with no warnings.
- `npm run worker:test`: 6 Rust tests passed.
- `npm run worker:smoke`: smoke, all 8 parity groups and `tests/contract.mjs` (78 legacy Axum routes routed with real IDs) passed on local D1/DO, including the failed multi-file upload returning 502 with compensation. Temporary service and data were cleaned up.
- Focused frontend tests: `task-pagination.test.ts` (5) and `notifications.test.ts` (7) passed.
- `npm run check`: 0 errors, 0 warnings. `npm run build`: passed.
- Full unit project: 91 passed, 24 failed. The failures are in `src/lib/db.unit.test.ts` and `tests/today-filter.test.ts` (still written against the removed local database, now failing with `No workspace selected`) and in `TableView.test.ts`/`TaskForm.test.ts` (layout assertions in files this migration did not change). They need rewriting against the API-backed `db.ts`; the complete unit suite is not claimed to pass.
- Live RustFS requests with credentials, remote deployment, and cloud Free-tier load/CPU measurements remain unverified.


## Cloudflare Access sign-in

An optional "Sign in with Cloudflare" button on the login page. Password login keeps working. Access only proves who the visitor is: the Worker verifies the signed JWT, then signs in the **existing active user with the same email** (it never creates users) and issues the normal session token.

Flow: login page → `GET /api/auth/access/login?return=<frontend>/login/` (protected by an Access application) → Access login with your identity provider → the Worker verifies `Cf-Access-Jwt-Assertion` (RS256, issuer, audience, expiry) → redirect back to `<frontend>/login/#access_token=…` → the page exchanges it for the user and signs in.

The feature is off until both `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are set; `GET /api/auth/access/config` reports `{"enabled": bool}` and the button only shows when it is true.

Setup in the Cloudflare dashboard:

1. **Custom domain for the Worker.** Access can only protect hostnames in a zone on your account, not `*.workers.dev`. Add a custom domain to the Worker (Workers → api → Settings → Domains & Routes), e.g. `auth.example.com`. Do not enable "Cloudflare Access" on workers.dev: it would protect the whole API.
2. **Identity provider.** Zero Trust → Settings → Authentication → add one (One-time PIN works with no setup, or Google/GitHub/...).
3. **Access application.** Zero Trust → Access → Applications → Add → Self-hosted. Domain `auth.example.com`, path `api/auth/access/login` (only that path). Add an Allow policy for the people who may sign in. Copy the **Application Audience (AUD) tag**.
4. **Worker variables** (`wrangler.jsonc` → `vars`, then deploy):
   - `ACCESS_TEAM_DOMAIN` = your team domain, e.g. `acme.cloudflareaccess.com`
   - `ACCESS_AUD` = the AUD tag from step 3
   - `ACCESS_RETURN_ORIGINS` = comma-separated frontend origins the Worker may redirect to (default: the GitHub Pages site). Any other `return` URL is rejected.
5. **Frontend variable.** Set the repository variable `NEXT_PUBLIC_ACCESS_URL` to `https://auth.example.com` (the Access-protected origin) so the button navigates there. If the API itself is served from that custom domain, leave it unset.

Tokens travel in the URL fragment, which browsers never send to servers. Emails are matched case-insensitively against active users only; an unknown email returns to the login page with `?access_error=not_registered`.
