# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Start development server**: `node start.js` (runs on port 3000)
- **Start with auto-reload**: `npm run watch` (uses nodemon)
- **Install dependencies**: `npm install`

## Environment Configuration

Copy `.env.example` to `.env` and configure the following variables:

```bash
cp .env.example .env
```

### Required Environment Variables

- `GOOGLE_CLIENT_ID`: Your Google OAuth client ID from Google Cloud Console
- `GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret
- `GOOGLE_CALLBACK_URL`: OAuth callback URL (default: http://localhost:3000/auth/google/callback)
- `SESSION_SECRET`: Secret key for session management (generate a strong random string)

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google+ API
4. Go to "Credentials" > "Create Credentials" > "OAuth client ID"
5. Choose "Web application"
6. Add authorized redirect URIs: `http://localhost:3000/auth/google/callback`
7. Copy the Client ID and Client Secret to your `.env` file

## Docker Commands

- **Build image**: `docker build -t meeting-timeline .`
- **Run with Docker Compose**: `docker-compose up` (starts both Node.js app and Redis)

## Architecture Overview

Node.js/Express meeting timeline app ("AgendaClock") that renders live meeting
agendas in six switchable visualization modes, shareable via public links and
usable as an OBS video overlay.

### Core Components

- **Entry point**: `start.js` — Express server. NOTE: `helmet()` is applied AFTER
  routes register, so rendered pages get no CSP (CDN + inline scripts depend on
  this — do not reorder).
- **App configuration**: `app.js` — session, passport, routes
- **Routes**:
  - `routes/index.js` — homepage (login redirect), SEO landing pages, `/obs-setup` guide
  - `routes/meeting.js` — meeting CRUD + view rendering
  - `routes/auth.js` — Google OAuth (/auth/login, /auth/logout, /auth/google/*)

### View Modes (`GET /meeting/:id?view=...`)

Six modes, whitelisted in `VIEW_MODES` (routes/meeting.js): `overlay` (PixiJS
horizontal timeline for OBS, chroma blue #0047BB), `liftoff` (SpaceX-style
mission timeline, PixiJS), `rail` (vertical subway map, DOM), `table` (live
dashboard table, DOM), `focus` (giant countdown, DOM), `ring` (donut clock,
PixiJS). Each mode = `views/meeting_views/<mode>.ejs` + `public/js/views/<mode>.js`.

Query params on the view route:
- `?view=` — explicit mode; falls back to stored `default_view`, then `overlay`
- `?chrome=0/1` — show/hide on-page UI (view switcher, help). Overlay defaults
  to chrome OFF (it's an OBS surface); other views default ON
- `?transparent=1` — overlay renders with real alpha (`backgroundAlpha: 0`), so
  OBS Browser Sources need no chroma key filter
- `?preview=1` — editor preview iframe: chrome off + analytics muted

Shared client pieces (in `views/meeting_views/`): `_head.ejs`, `_data_bridge.ejs`
(emits `window.MEETING`, an XSS-escaped JSON payload with ISO 8601 times),
`_switcher.ejs` (auto-hiding view switcher pill). All views compute "where are
we now" through `public/js/meeting-time-engine.js` (`MeetingTimeEngine.create(MEETING)`
→ `getState()/onTick()/onFrame()` + `formatCountdown/formatMMSS/formatWallClock`).
Never duplicate time math in a view — use the engine.

### Data Storage

- **Redis**: flat JSON per meeting. Private key `meeting_{owner_email}_{id}`;
  public copy `public_meeting_{id}` mirrored when `is_public` is on.
- **Access rules**: public meetings render WITHOUT login; private links redirect
  logged-out visitors to login (returnTo preserved). `POST /meeting/:id` refuses
  to overwrite a `public_meeting_*` owned by someone else (403) and
  whitelists/validates all fields in `validateMeetingPayload()` (never spread
  `req.body` into Redis).
- Meeting fields include `default_view` (share-link mode) and `preset` (editor
  UI hint) alongside the ~25 flat config fields consumed by
  `getDataFromRedis()`.

### Editor (`/meeting/edit/:id`)

Two-pane single-page editor (`views/edit_meeting.ejs` + `public/js/edit_meeting.js`
+ `public/css/edit_meeting.css`): left = Basics / Agenda (drag handles via
SortableJS, live totals) / Appearance presets / Advanced (raw config fields,
backward-compat `name=` attrs); right = Share panel (view pills bound to
`default_view`, copy link, Copy OBS URL, QR via qrcodejs) + live preview iframe
(1920×1080 scaled, reloads after each autosave). Autosave: debounced AJAX POST
to the existing endpoint; server branches on `req.xhr` and returns JSON.
Unchecked default-true toggles are posted explicitly as `field=off`
(`boolFlag()` on the server understands 'on'/'off'/absent).

Create flow: `GET /meeting/` renders the slim create form (title/time/timezone/
public) → POST seeds a starter agenda row → redirects into the editor.

### Template System

- **EJS 1.0.0** (old `<% include path %>` syntax, NOT `<%- include('path') %>`);
  includes resolve relative to the including file's directory
- `meeting_header.ejs`/`meeting_footer.ejs` wrap the editor/create/list pages
  (Bootstrap 4.6.2, jQuery 3.7.1, pinned SortableJS 1.15.6 — keep CDN versions
  pinned and matching)
- `views/partials/analytics.ejs` — GA snippet for public/SEO pages
- SEO pages: `login.ejs`, `effective-meetings.ejs`, `obs_setup.ejs`,
  `timed-agenda.ejs`, etc. (`public/sitemap.xml` lists them). All landing pages
  cross-link each other (incl. `/obs-setup` and `/timed-agenda`) in a
  `footer-nav` block — add new pages to every footer + sitemap. Titles are
  tuned to GSC query data; keep ≤60 chars. `/auth/*` responses send
  `X-Robots-Tag: noindex` (robots.txt intentionally does NOT block /auth/ so
  crawlers can see the header; `/meeting/` stays disallowed).

### OBS Integration

`/obs-setup` (public page, screenshots in `public/images/obs/`) documents both
paths: Browser Source with `?view=overlay&chrome=0&transparent=1` (recommended,
no filter needed) or Window Capture + Chroma Key on #0047BB. The editor's Share
panel has a one-click "Copy OBS URL".

### Dependencies

- **Backend**: Express, EJS, Redis clients (redis + ioredis), moment-timezone, crypto-js, helmet, compression
- **Frontend**: PixiJS 8.4.1 (CDN), moment.js (overlay display formatting only; DOM views use native Date + Intl)
- **Development**: nodemon for auto-reload during development
