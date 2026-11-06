# Khun Phaen Tracker (ขุนแผน)

Task management for teams: tasks, sprints, projects, calendar, kanban, Gantt, test cases and real-time updates.

[อ่านภาษาไทยที่นี่ (Read Thai version here)](README.th.md)

> **Khun Phaen** (ขุนแผน) - Named after a legendary Thai literary figure known for being a master strategist who could manage complex situations effectively.

- App: <https://fakduai-logistics-and-digital-platform.github.io/khun-phaen-tracker/>
- API: `https://api.khun-phaen.workers.dev` (`/api`, realtime at `/ws`, health at `/health`)

## Features

- **Tasks** - Add, edit, delete, checklists, comments, attachments.
- **Team and projects** - Members, groups, projects, sprints, milestones.
- **Views** - List, calendar, kanban, table, Gantt and workload.
- **Test cases** - Suites, runs, public read-only view, CSV import/export.
- **Export/Import** - CSV, PDF, PNG, slides.
- **Real-time updates** - WebSocket rooms through Durable Objects.
- **Dark mode and palettes**, Thai and English UI.
- **Fast navigation** - Pages change immediately and show skeletons while data loads; recent reads are reused when you go back.

## Architecture

| Part | Stack | Folder |
| --- | --- | --- |
| Frontend | Next.js App Router on vinext, React 19, TypeScript, shadcn/ui, Tailwind CSS 4, statically exported to GitHub Pages | [web/](web/README.md) |
| API | Rust Cloudflare Worker with D1 and Durable Objects | [backend-worker/](backend-worker/README.md) |
| Attachments | S3-compatible RustFS | configured in `backend-worker/wrangler.jsonc` |
| Tooling | Worker setup, smoke tests, MongoDB → D1 import | `scripts/`, `tests/` |

The app is a static export, so ids travel in the query string (`?ws=<workspace>&id=<task>`). Sign-in uses a bearer session token; optional Cloudflare Turnstile protects the login form.

## Local development

```sh
# Frontend (http://localhost:3100)
cd web
npm install
npm run dev

# Backend worker (from the repo root)
npm install
npm run worker:setup
npm run worker:dev
```

The deployed API only allows CORS for the GitHub Pages origin, so `npm run dev` reaches it through the same-origin proxy configured in `web/next.config.ts`.

## Checks

```sh
cd web && npm run typecheck && npm run lint   # must be clean
npm test                                      # repo root: scripts/
npm run worker:check && npm run worker:test   # backend-worker
npm run worker:smoke                          # end-to-end API smoke test
```

## Configuration

| Name | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_WS_URL` | repository variables (Pages build) | Point the frontend at another API; defaults to `api.khun-phaen.workers.dev` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | repository variable (Pages build) | Shows the Turnstile widget on the login form |
| `TURNSTILE_SECRET_KEY` | Worker secret (`wrangler secret put`) | Verifies the Turnstile token on login; no secret means no check |
| `CLOUDFLARE_API_TOKEN` | repository secret | Used by `deploy-backend.yml` |

See [backend-worker/README.md](backend-worker/README.md) for the Turnstile test keys and the remaining Worker secrets.

## Deployment

- **Frontend:** pushing to `main` changes under `web/` runs `.github/workflows/deploy.yml`, which builds a static export (`npm run build:pages`) and publishes it to GitHub Pages. In the repository settings set **Pages → Source** to *GitHub Actions*.
- **Backend:** `.github/workflows/deploy-backend.yml` deploys the Worker (environment `production`).

## License

This project is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) - you are free to use, modify, and share this software for non-commercial purposes only.
