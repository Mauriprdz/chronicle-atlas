# Chronicle Atlas — Thematic Investigation Platform (U3 A1–A5)

Research website for **20 civilizations and states** whose whole interface (palette, typography, background motifs) changes to match the topic being explored. Single deployment: frontend + API + auth + RBAC + themes in one repo and one URL.

**Team:** Mauricio Alejandro Prieto Rodríguez · _Teammate 2_ · _Teammate 3_
**Group:** IDGSBIS81N · UTCH BIS
**Live URL:** _https://your-site.netlify.app_

## Demo accounts (one per role)

| Role | Email |
|---|---|
| Standard User | `user@atlas.demo` |
| Investigator | `investigator@atlas.demo` |
| Admin | `admin@atlas.demo` |

Passwords are **not** published: they are set with the `ADMIN_PASSWORD`, `INVESTIGATOR_PASSWORD` and `USER_PASSWORD` environment variables and shared privately with the teacher.

## Tech stack

- **Frontend:** vanilla JS single-page app (hash router), CSS custom properties, no build step (`public/`)
- **Backend:** Node.js + Express 5 as a Netlify Function (`netlify/functions/api.mjs` → `server/app.js`). Also deployable on Vercel (`api/index.js`, `vercel.json`).
- **Database:** PostgreSQL (Neon). Locally, an embedded Postgres (PGlite) is used automatically.
- **Security:** `jsonwebtoken` (HS256, 2 h expiry, issuer/audience checks), `bcryptjs` (cost 11), SHA-256 hashed reset tokens
- **Monitoring (extra points):** Sentry on the server (`@sentry/node`) and the browser (Sentry CDN bundle)

## Rubric map

### A1 · Authentication & user interaction
| Criterion | Where |
|---|---|
| Registration + bcrypt hashing | `POST /api/auth/register` – `server/app.js`; new users are always `user` role |
| JWT on login (userId, role, sid, exp) | `POST /api/auth/login` – `signToken()` in `server/auth.js` |
| Frontend sends `Authorization: Bearer <token>` | `api()` in `public/js/app.js` |
| Favorites & bookmarks per user ID | `/api/me/favorites`, `/api/me/bookmarks` (tables `favorites`, `bookmarks`) |
| Discussions & comments, guests blocked | `/api/topics/:slug/discussions`, `/api/discussions/:id/comments` (401 without token) |

### A2 · Sessions & devices
| Criterion | Where |
|---|---|
| Device identification | Login stores a session with User-Agent label ("Chrome on Windows (desktop)"), IP and a per-browser `deviceId` |
| Active session tracking per userId | Table `sessions`; the JWT carries the session id (`sid`) |
| Max 2 concurrent devices | Checked on every login (`MAX_DEVICES = 2`) |
| Over-limit handling | Default **FIFO** (oldest session revoked, user is told). Admin can switch to **reject** in Platform settings |
| Terminate sessions | "My research → Devices & sessions": log out, end a specific session, sign out all others. Admin can revoke any session |
| Continuous validation | `authenticate()` checks signature **and** that the session is still active on every protected request |

### A3 · Password management & recovery
- Change password requires the **current password** + strong rules (8+, upper, lower, number, symbol) on both client and server; other devices are signed out.
- `POST /api/auth/forgot` returns the **same neutral message** (and similar timing) whether or not the email exists → no account enumeration. Rate limited.
- Token: `crypto.randomBytes(32)` (256-bit), stored only as a **SHA-256 hash**, **expires in 20 minutes**, previous tokens invalidated.
- Reset marks the token used **before** changing the password → **single use**; all sessions revoked.
- Email: sent with Resend if `RESEND_API_KEY` is set; otherwise stored in **Admin → Email outbox** for the class demo.

### A4 · Protected routes
- Frontend route guards check token presence **and expiry** before rendering; unauthenticated users go to `/login?next=<intended page>` and return there after login.
- Discussions API and media API return **401** without a valid Bearer token.
- Restricted images are generated server-side and served **only** from `GET /api/media/:slug/:n` with a Bearer token (no public static file). The browser fetches them with the header and shows them as blob URLs.
- Expired, tampered or revoked tokens → 401 → the client clears local session state and redirects to login. An auto-logout timer fires at token expiry; logout in one tab syncs to other tabs.

### A5 · RBAC
| Capability | Guest | Standard | Investigator | Admin |
|---|---|---|---|---|
| Browse topic overviews | ✔ | ✔ | ✔ | ✔ |
| Protected media, discussions, favorites, bookmarks | ✘ (401) | ✔ | ✔ | ✔ |
| Create / edit / delete topics & themes (Studio) | ✘ | ✘ (403) | ✔ | ✔ |
| Manage users, roles, sessions, platform settings | ✘ | ✘ (403) | ✘ (403) | ✔ |

Roles live in the `users` table and the JWT. The server enforces them with `requireRole()` (returns **403 Forbidden**), not just UI hiding. If an admin changes someone's role, their old token stops working.

### Requirements.pdf extras
- 20 topics, each with its own `data-theme` (CSS variables in `public/css/themes.css`, generated from `server/themes.js`). All themes pass WCAG AA contrast (4.5:1).
- Investigators can pick a theme preset + custom accent color with a **live preview**.
- **Floating brain button** fixed bottom-left on every view → "Research companion" with facts and a random-topic jump.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000  (embedded database, zero setup)
npm test           # 60 automated checks covering A1–A5
```

## Deploy to Netlify

1. Push this folder to a GitHub repository.
2. Create a free Postgres database at **neon.tech** and copy its connection string (`postgresql://...`).
3. Netlify → **Add new site → Import an existing project → GitHub** → pick the repo. `netlify.toml` already sets publish dir `public`, functions dir and the `/api/*` redirect, so leave the build settings as they are.
4. **Site configuration → Environment variables**: add `DATABASE_URL` (Neon string), `JWT_SECRET` (random string, 32+ characters) and `ADMIN_PASSWORD`, `INVESTIGATOR_PASSWORD`, `USER_PASSWORD` (strong passwords for the demo accounts; they are only used the first time the database is filled). Optional: `SENTRY_DSN`, `RESEND_API_KEY`.
5. **Deploys → Trigger deploy → Deploy site**. Tables, the 20 topics and demo accounts are created on the first request.
6. Check `https://your-site.netlify.app/api/health` → `{"ok":true,"db":"postgres"}`.

### Sentry (extra points)
Create a free project at sentry.io (platform: Node.js / Express), put the DSN in `SENTRY_DSN`, redeploy, then use **Admin → Overview → Trigger server error / Trigger browser error**.

## API summary

```
POST /api/auth/register | /login | /logout | /forgot | /reset | /reset/validate
GET  /api/auth/me                 PUT /api/auth/password
GET  /api/sessions                DELETE /api/sessions/:id | /api/sessions
GET  /api/topics | /api/topics/:slug           (public)
POST /api/topics   PUT|DELETE /api/topics/:slug (investigator, admin)
GET  /api/topics/:slug/media      GET /api/media/:slug/:n   (auth)
GET|POST /api/me/favorites/:slug  GET|POST|DELETE /api/me/bookmarks
GET|POST /api/topics/:slug/discussions  GET /api/discussions/:id  POST /api/discussions/:id/comments
/api/admin/stats | users | users/:id/role | users/:id/status | sessions | settings | outbox  (admin)
```
