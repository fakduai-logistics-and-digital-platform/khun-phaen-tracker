# Khun Phaen Tracker (ขุนแผน)

Task management for teams: tasks, sprints, projects, calendar, kanban, Gantt, test cases and real-time updates.

[อ่านภาษาไทยที่นี่ (Read Thai version here)](README.th.md)

> **Khun Phaen** (ขุนแผน) - Named after a legendary Thai literary figure known for being a master strategist who could manage complex situations effectively.

## ✨ Features

- ✅ **Tasks** - Add, edit, delete, checklists, comments, attachments.
- 👥 **Team and projects** - Members, groups, projects, sprints, milestones.
- 📅 **Views** - List, calendar, kanban, table, Gantt and workload.
- 🧪 **Test cases** - Suites, runs, public read-only view, CSV import/export.
- 📤 **Export/Import** - CSV, PDF, PNG, slides.
- 🔄 **Real-time updates** - WebSocket rooms through Durable Objects.
- 🌙 **Dark mode and palettes**, Thai and English UI.

## 🏗️ Project structure

```
.
├── web/             # Frontend: Next.js (vinext) + shadcn/ui, statically exported to GitHub Pages
├── backend-worker/  # API: Rust Cloudflare Worker (D1 + Durable Objects), RustFS/S3 attachments
├── scripts/         # Worker setup, smoke tests, MongoDB → D1 import
└── tests/           # Vitest tests for scripts/
```

- Frontend details: [web/README.md](web/README.md)
- Backend setup, validation and cutover notes: [backend-worker/README.md](backend-worker/README.md)
- Deployed API: `https://api.khun-phaen.workers.dev` (`/api`, realtime at `/ws`, health at `/health`)

## 🛠️ Local development

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

## ✅ Checks

```sh
cd web && npm run typecheck && npm run lint   # must be clean
npm test                                      # repo root: scripts/
npm run worker:check && npm run worker:test   # backend-worker
```

## 🚀 Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds `web/` as a static export (`npm run build:pages`) and publishes it to GitHub Pages. In the repository settings set **Pages → Source** to *GitHub Actions*. Optional repository variables: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_WS_URL`.

## 📄 License

This project is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) - you are free to use, modify, and share this software for non-commercial purposes only.
