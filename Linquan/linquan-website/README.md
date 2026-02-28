# NJU林泉钢琴社 Website

Full-stack web system for NJU林泉钢琴社.

## 0. Chinese Role-Based Manuals

- Member guide (ZH): `docs/README_MEMBER_ZH.md`
- Admin guide (ZH): `docs/README_ADMIN_ZH.md`
- Alibaba ECS deployment guide (ZH): `docs/DEPLOY_ALIYUN_ZH.md`

It supports:

- Member registration/login (student number required, email optional)
- Member profile management and directory view
- Activity and announcement publishing
- Piano room preference submission and weekly scheduling
- Concert lifecycle (announcement, application, audition, results/feedback)
- Email notification integration (with SMTP config)

## 1. Tech Stack

- Frontend: Vue 3 + Vue Router + Pinia + Axios (`@vue/cli` 5.0.9)
- Backend: Node.js + Express + Zod + JWT
- Database: SQLite (`better-sqlite3`, default) / PostgreSQL (`pg`, Neon via `DATABASE_URL`)
- Auth: password hash (`bcryptjs`) + JWT token
- File upload: `multer` (concert score files)

## 2. Roles and Permission Model

- `member`
  - Can register/login
  - Can submit room preferences
  - Can apply for concerts
  - Can update own profile
  - Can view published activities/announcements and member directory
- `admin`
  - Not publicly registerable (seeded by developer)
  - Can publish activities/announcements
  - Can create semesters and run scheduling
  - Can review/edit proposed assignments and publish final schedule
  - Can create concerts, audition slots, and audition results

## 3. Project Structure (Detailed)

```text
linquan-website/
├── .vscode/
│   ├── extensions.json            # Recommended VS Code extensions
│   └── settings.json              # Formatting/lint/editor defaults
├── backend/
│   ├── package.json
│   ├── ecosystem.config.cjs        # PM2 production config for ECS
│   ├── requests.http              # REST Client examples
│   └── src/
│       ├── app.js                 # Express app and route mounting
│       ├── server.js              # HTTP server entry
│       ├── config/
│       │   ├── db.js              # DB adapter (SQLite default / Postgres when DATABASE_URL exists)
│       │   └── env.js             # env loading and constants
│       ├── middleware/
│       │   ├── auth.js            # JWT auth + role guard
│       │   └── errorHandler.js    # Global error handling
│       ├── routes/
│       │   ├── authRoutes.js
│       │   ├── activityRoutes.js
│       │   ├── profileRoutes.js
│       │   ├── schedulingRoutes.js
│       │   ├── concertRoutes.js
│       │   └── adminRoutes.js
│       ├── services/
│       │   ├── schedulerService.js
│       │   ├── notificationService.js
│       │   └── emailService.js
│       ├── scripts/
│       │   └── initDb.js          # Schema init + admin seed + default semester
│       └── utils/
│           ├── semester.js
│           └── httpError.js
├── database/
│   └── schema.sql                 # Table/index definitions
├── deploy/
│   └── aliyun/
│       ├── 01_init_server.sh      # Ubuntu initialization script
│       ├── 02_setup_postgres.sh   # PostgreSQL setup script
│       ├── 03_deploy_app.sh       # First deployment script
│       ├── 04_setup_nginx.sh      # Nginx reverse proxy setup
│       ├── 05_enable_https.sh     # Let's Encrypt setup
│       ├── 06_update_app.sh       # Rolling update script
│       ├── nginx-linquan.conf     # Nginx site template
│       └── .env.backend.aliyun.example
├── frontend/
│   ├── package.json
│   ├── .eslintrc.cjs
│   ├── vue.config.js              # Dev proxy to backend
│   ├── public/
│   │   ├── index.html
│   │   ├── favicon.ico            # Browser tab icon (recommended)
│   │   ├── apple-touch-icon.png   # iOS home-screen icon (optional)
│   │   └── photos/
│   │       ├── hero/             # Homepage hero photos
│   │       ├── club/             # Practice/daily club photos
│   │       ├── events/           # Activity photos
│   │       ├── concerts/         # Concert photos
│   │       └── README.md         # Naming and replacement guide
│   └── src/
│       ├── main.js
│       ├── App.vue
│       ├── assets/base.css
│       ├── components/
│       │   ├── CenterToast.vue
│       │   └── PhotoGallery.vue
│       ├── composables/
│       │   └── toast.js
│       ├── content/
│       │   └── photoManifest.js  # Central photo manifest
│       ├── router/index.js
│       ├── stores/auth.js
│       ├── services/api.js
│       └── views/
│           ├── DashboardView.vue
│           ├── LoginView.vue
│           ├── RegisterView.vue
│           ├── ScheduleView.vue
│           ├── ConcertsView.vue
│           ├── ProfileView.vue
│           ├── MemberDirectoryView.vue
│           ├── MemberDetailView.vue
│           ├── AdminLayoutView.vue
│           ├── AdminPublishingView.vue
│           ├── AdminSchedulingView.vue
│           ├── AdminConcertsView.vue
│           └── AdminReviewsView.vue
├── .editorconfig
├── render.yaml                    # Render blueprint (public deployment)
├── .env.example                   # Backend env template
├── .gitignore
└── README.md
```

## 4. Data Model Summary

Core tables in `database/schema.sql`:

- `users`, `profiles`
- `activities`, `announcements`
- `semesters`, `room_slots`
- `slot_preferences`, `schedule_batches`, `schedule_assignments`
- `concerts`, `concert_applications`, `audition_slots`
- `notifications`

Scheduling domain facts:

- 2 rooms
- 7 days/week
- 08:00-22:00 (14 one-hour slots/day)
- Total weekly capacity: `2 * 7 * 14 = 196` slots

## 5. Scheduling Algorithm

Implemented in `backend/src/services/schedulerService.js`.

Phase 1 (fairness first):

- Prioritize members with fewer preferences
- Try to assign each member at least 1 preferred slot
- Prefer low-demand slots first

Phase 2 (efficiency):

- Assign a second slot (max 2 total/member) if capacity remains
- Prefer slots improving demand utilization and practical continuity

Output behavior:

- Generated as a `proposed` batch
- Admin may manually modify assignments
- Admin publishes batch to make it visible to members

## 6. Environment Setup

Prerequisites:

- Node.js LTS (Node 20/22/24 are acceptable for this repo)
- npm
- Git
- VS Code

Recommended VS Code extensions:

- `dbaeumer.vscode-eslint`
- `esbenp.prettier-vscode`
- `editorconfig.editorconfig`
- `ecmel.vscode-html-css`
- `pranaygp.vscode-css-peek`
- `ritwickdey.LiveServer`
- `humao.rest-client`
- `mikestead.dotenv`
- `qwtel.sqlite-viewer`
- `eamodio.gitlens`
- `Vue.volar`

## 7. First-Time Start (From Scratch)

From project root `linquan-website/`:

1. Create backend env file:
   - copy `.env.example` to `.env`
2. Install dependencies:
   - `cd backend && npm install`
   - `cd ../frontend && npm install`
3. Initialize database:
   - `cd ../backend && npm run db:init`
4. Start backend:
   - `npm run dev`
   - default URL: `http://localhost:4000`
5. Start frontend in another terminal:
   - `cd ../frontend && npm run serve`
   - default URL: `http://localhost:8080`
   - LAN URL (same network): `http://<your-local-ip>:8080`

Default admin account (created by `db:init` if absent):

- student number: `A0000000`
- password: `Admin@123`
- email: `admin@example.com`

Optional admin seed envs before `db:init`:

- `ADMIN_STUDENT_NUMBER`
- `ADMIN_PASSWORD`
- `ADMIN_EMAIL`

## 8. Environment Variables

Backend `.env` (root-level):

- `HOST` (default `0.0.0.0`)
- `PORT` (default `4000`)
- `JWT_SECRET`
- `DATABASE_URL` (Neon/Postgres connection string; when set, backend uses Postgres)
- `DB_PATH` (default `../database/linquan.db` from backend dir)
- `UPLOAD_ROOT` (default `uploads`; set persistent absolute path in production)
- `SERVE_FRONTEND` (`true` by default; backend serves `frontend/dist`)
- `ALLOWED_ORIGINS` (comma-separated CORS whitelist; empty means allow all)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

Frontend `.env` (`frontend/.env` optional):

- `VUE_APP_API_BASE_URL` (default `/api`)
- `VUE_APP_DEV_API_TARGET` (optional dev proxy target, default `http://localhost:4000`)

## 9. Development Commands

Backend (`backend/`):

- `npm run dev` - start backend with nodemon
- `npm run build` - install frontend deps and build `frontend/dist`
- `npm run start` - start backend without nodemon
- `npm run db:init` - apply schema and seed default admin/semester

Frontend (`frontend/`):

- `npm run serve` - start dev server
- `npm run build` - production build to `frontend/dist`
- `npm run lint` - lint frontend

## 10. Public Deployment (Long-Term)

The project now supports single-service deployment:

- Backend listens on configurable `HOST`/`PORT`
- Backend can serve `frontend/dist` directly (`SERVE_FRONTEND=true`)
- CORS can be restricted with `ALLOWED_ORIGINS`

This means one public URL can host both frontend pages and backend APIs.

### 10.1 Alibaba Cloud ECS (Ubuntu 22.04, Recommended for Self-Hosting)

This repository now includes deployment assets under `deploy/aliyun/`:

1. Initialize server (system, Node.js 20, PM2, Nginx, UFW):
   - `bash deploy/aliyun/01_init_server.sh`
2. Setup PostgreSQL:
   - `DB_NAME=linquan DB_USER=linquan_app DB_PASS='<strong-password>' bash deploy/aliyun/02_setup_postgres.sh`
3. Deploy app:
   - `REPO_URL=<repo-url> BRANCH=main PROJECT_SUBDIR=Linquan/linquan-website bash deploy/aliyun/03_deploy_app.sh`
4. Configure Nginx reverse proxy:
   - `SERVER_NAME=<ip-or-domain> NODE_PORT=3000 PROJECT_SUBDIR=Linquan/linquan-website bash deploy/aliyun/04_setup_nginx.sh`
5. Enable HTTPS after domain DNS + ICP are ready:
   - `DOMAIN=linquanpiano.cn EMAIL=<your-email> bash deploy/aliyun/05_enable_https.sh`
6. Update later:
   - `BRANCH=main PROJECT_SUBDIR=Linquan/linquan-website bash deploy/aliyun/06_update_app.sh`

Production env template:

- `deploy/aliyun/.env.backend.aliyun.example`

Deployment directory mapping:

- `/var/www/linquan/backend` -> project backend
- `/var/www/linquan/frontend` -> project frontend

Reference manual (Chinese):

- `docs/DEPLOY_ALIYUN_ZH.md`

### 10.2 Render Deployment

This repo includes `render.yaml`.

1. Push project to GitHub.
2. In Render, create a new Blueprint and connect your repo.
3. Render will use:
   - build: `npm install && npm run build` (in `backend/`)
   - start: `npm start`
4. Set `ALLOWED_ORIGINS` to your Render domain:
   - example: `https://linquan-website.onrender.com`
5. Set `DATABASE_URL` in Render service env to your Neon connection string.
6. After first deploy, open:
   - `https://<your-service>.onrender.com`

`render.yaml` is configured for Render `free` plan (no disk). Keep in mind:

- `DATABASE_URL` must be provided (Neon).
- `UPLOAD_ROOT=uploads` is ephemeral on free instances. Use object storage (S3/Cloudinary/B2) for persistent uploads.

### 10.3 Other Platforms (Railway/Fly.io/VM)

Use the same runtime pattern:

1. Build frontend: `cd backend && npm run build`
2. Start backend:
   - SQLite mode: `npm run db:init && npm start`
   - Neon mode (`DATABASE_URL` set): `npm start`
3. Ensure env vars:
   - `HOST=0.0.0.0`
   - `SERVE_FRONTEND=true`
   - `JWT_SECRET=<strong secret>`
   - `DATABASE_URL=<postgres connection string>` (Neon mode)
   - `DB_PATH=<persistent disk path>` (SQLite mode)
   - `UPLOAD_ROOT=<persistent upload path>`
   - `ALLOWED_ORIGINS=https://<your-domain>`
4. Expose one HTTP port from backend service.

For long-term production with heavier traffic, consider migrating DB from SQLite to PostgreSQL.

### 10.4 SQLite -> Neon Migration Notes

Recommended migration path:

1. Keep local SQLite as source DB.
2. Create Neon database and get `DATABASE_URL`.
3. Import data with `pgloader` (preferred) or your own migration script.
4. Verify row counts in Neon before switching Render `DATABASE_URL`.
5. Redeploy and check `/api/health`.

Important:

- If a migration script creates every column as `TEXT`, schema constraints/types are lost. Recreate schema correctly, then re-import data.

## 11. API Overview

Public/member:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/activities`
- `GET /api/announcements`
- `GET /api/profiles`
- `GET /api/profiles/me`
- `POST /api/profiles/me/avatar`
- `POST /api/profiles/me/photo`
- `PUT /api/profiles/me`
- `GET /api/scheduling/slots`
- `POST /api/scheduling/preferences`
- `GET /api/scheduling/my-assignment`
- `GET /api/concerts`
- `POST /api/concerts/:concertId/applications`
- `GET /api/concerts/:concertId/auditions`
- `GET /api/concerts/:concertId/results`

Admin:

- `POST /api/admin/activities`
- `POST /api/admin/announcements`
- `POST /api/admin/semesters`
- `POST /api/admin/scheduling/run`
- `GET /api/admin/scheduling/proposed`
- `PATCH /api/admin/scheduling/assignments/:assignmentId`
- `POST /api/admin/scheduling/publish`
- `POST /api/admin/concerts`
- `PATCH /api/admin/concerts/:concertId/status`
- `POST /api/admin/concerts/:concertId/auditions`
- `POST /api/admin/concerts/:concertId/results`

Health check:

- `GET /api/health`

## 12. How to Update the Project

### 12.1 Update Code From Git

1. `git pull`
2. Reinstall dependencies in both packages:
   - `cd backend && npm install`
   - `cd ../frontend && npm install`
3. Re-run checks:
   - `cd ../frontend && npm run lint && npm run build`
4. Restart backend/frontend dev servers

### 12.2 Update Dependencies

Backend:

1. `cd backend`
2. `npm outdated`
3. update selected packages in `package.json`
4. `npm install`
5. smoke-test: auth, scheduling, concert endpoints

Frontend:

1. `cd frontend`
2. `npm outdated`
3. update selected packages
4. `npm install`
5. `npm run lint && npm run build`

### 12.3 Update Database Schema

Current project uses schema-first setup (`database/schema.sql`) without formal migration tooling.

For early-stage development:

1. backup existing DB file (`database/linquan.db`)
2. update `database/schema.sql`
3. if change is destructive or incompatible, delete old DB and re-run:
   - `cd backend && npm run db:init`
4. verify core flows: login, profile, scheduling, concerts

For production or persistent data:

- add explicit migration scripts before altering existing tables with data

### 12.4 Update Frontend Pages or APIs

Recommended sequence:

1. update backend route/service first
2. test route with `backend/requests.http`
3. update frontend API call (`frontend/src/services/api.js` or views)
4. run `npm run lint` and `npm run build`

### 12.5 Git Operations (Quick Reference)

From repository root (`D:\\Code\\NJU`):

1. Check current changes:
   - `git status`
2. If Git lock error appears:
   - `if (Test-Path .git\\index.lock) { Remove-Item .git\\index.lock -Force }`
3. Stage website files:
   - `git add Linquan/linquan-website`
4. Create commit:
   - `git commit -m "your message"`
5. Push to GitHub:
   - `git push origin main`

First-time remote setup (if needed):

1. `git remote add origin https://github.com/<your-user>/<your-repo>.git`
2. `git push -u origin main`

For deployed Render service:

1. `git push` updates deployment source branch.
2. If Auto-Deploy is enabled, Render redeploys automatically.
3. If Auto-Deploy is disabled, use Render manual deploy after push.

## 13. How to Restart Cleanly

If you want a clean local reset:

1. stop backend/frontend processes
2. delete `database/linquan.db`
3. run `cd backend && npm run db:init`
4. restart backend/frontend

## 14. Troubleshooting

`node` or `npm` not recognized:

- ensure Node.js is installed
- add `C:\\Program Files\\nodejs` to PATH
- restart terminal

Backend cannot start (`EADDRINUSE`):

- port `4000` already used
- stop existing process or change `PORT` in `.env`

Frontend cannot reach backend:

- ensure backend is running on `http://localhost:4000`
- keep frontend proxy default (`vue.config.js`)

CORS blocked in browser after deployment:

- set exact production domain in `ALLOWED_ORIGINS`
- if frontend and backend share one domain, set `ALLOWED_ORIGINS=https://<your-domain>`
- redeploy after env update

Deployed site shows API JSON but not UI:

- ensure build step ran successfully (`npm run build` in `backend/`)
- ensure `SERVE_FRONTEND=true`
- ensure `frontend/dist` is generated in deployment image

Uploaded avatar/score/attachment disappears after restart:

- set `UPLOAD_ROOT` to a persistent disk path (example: `/var/data/uploads`)
- for Render, keep the persistent disk in `render.yaml`

No email sent:

- SMTP config missing in `.env`
- notifications are still recorded in DB with queued/failed status

## 15. Notes

- This project is a practical starter and can be extended with:
  - migration tooling
  - stronger audit logs
  - test suites (unit/integration/e2e)
  - production deployment config

## 16. Photo Structure and Update Workflow

### 16.1 Web Icon (Favicon)

The current website icon and top-left brand mark both use:

- `frontend/public/photos/club/林泉社徽.jpg`

Configured in:

- `frontend/public/index.html`
- `frontend/src/App.vue`

Current icon links in `index.html`:

- `<link rel="icon" type="image/jpeg" href="<%= BASE_URL %>photos/club/%E6%9E%97%E6%B3%89%E7%A4%BE%E5%BE%BD.jpg" />`
- `<link rel="apple-touch-icon" sizes="180x180" href="<%= BASE_URL %>photos/club/%E6%9E%97%E6%B3%89%E7%A4%BE%E5%BE%BD.jpg" />`

### 16.2 Member Pages and Gallery

- `My Profile`: `frontend/src/views/ProfileView.vue` (`/profile`)
- `Member Directory + Linquan Gallery`: `frontend/src/views/MemberDirectoryView.vue` (`/members`)
- `Member Detail`: `frontend/src/views/MemberDetailView.vue` (`/members/:memberId`)

Photo assets are managed under:

- `frontend/public/photos/hero`
- `frontend/public/photos/club`
- `frontend/public/photos/events`
- `frontend/public/photos/concerts`

The homepage gallery and hero image are controlled by:

- `frontend/src/content/photoManifest.js`

User-uploaded files are stored by backend under:

- `backend/uploads/avatars` (profile avatar and personal photo uploads)
- `backend/uploads/scores` (member concert score files)
- `backend/uploads/concerts` (admin concert attachments)

In production, this base path should be overridden by `UPLOAD_ROOT` (for example `/var/data/uploads`).

How to update photos:

1. Put your real photos into the folders above.
2. Reuse the recommended file names in `frontend/public/photos/README.md` to avoid code changes.
3. If you need new cards or captions, edit `frontend/src/content/photoManifest.js`.
4. Update bilingual captions in `frontend/src/i18n/index.js` under `dashboard.*`.
