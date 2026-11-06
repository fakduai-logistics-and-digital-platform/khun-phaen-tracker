# Khun Phaen Tracker — Next.js frontend (web/)

Next.js (App Router) on Cloudflare Workers via vinext, with shadcn/ui, the [shadcn-admin](https://github.com/satnaing/shadcn-admin) layout (see THIRD_PARTY_NOTICES.md), and LINE Seed Sans TH.
This is the migration target for the SvelteKit app in `../src`; routes are ported in stages.

## Run

```sh
npm install --engine-strict=false   # `cf` wants Node >= 24.22
npm run dev                         # vite dev
npm run build && npm run start      # build + preview in the Workers runtime
npm run deploy                      # vinext-cloudflare deploy
```

Environment (public, build-time) in `web/.env.local` (git-ignored): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SERVER_URL`.
The API is `https://api.khun-phaen.workers.dev` (routes under `/api`, realtime at `/ws`, health at `/health`). It allows CORS only for the deployed GitHub Pages origin, so in dev
`.env.local` points `NEXT_PUBLIC_API_URL` at `/kp-api/api`, which the rewrite in `next.config.ts` forwards. For deploys set
the absolute URLs (shown in `.env.local`) and add the deployed origin to the API's CORS allow-list.

## Ported so far

- Foundation: theme (next-themes, key `khu-phaen-theme`), i18n (`lib/i18n`, same `en/th.json`), auth provider, API + IndexedDB read cache
- Layout: shadcn-admin sidebar (inset, collapsible, cookie-persisted), header, ⌘K command menu, theme switch; nav entries live in `components/layout/sidebar-data.ts`
- Routes: `/login`, `/dashboard` (workspace edit uses a name/color/icon dialog; the SvelteKit `WorkspaceSettings` member management is not ported)
- Not ported: `/workspace/*`, `/settings/*`, `/profile`, `/create-account`, `/setup-password`, `/public/*`, Storybook stories

## Font

`app/fonts/` holds LINE Seed Sans TH (OFL-1.1, https://seed.line.me/), loaded in `app/fonts.ts`.
