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
│           ├── AdminReviewsView.vue
│           ├── AdminGalleryView.vue
│           └── AdminMembersView.vue
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
- `npm run test:smoke` - run backend + core API smoke test

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

### 10.1.1 Alibaba ECS Full Production Runbook (ZH, current online practice)

This section records the full workflow that has been verified in your real deployment.

Server baseline (current online):

- Cloud: Alibaba Cloud ECS
- Public IP: `139.196.227.208`
- OS: Ubuntu LTS (current machine shows Ubuntu 24.04; this workflow is also compatible with 22.04)
- Runtime: Nginx + PM2 + Node.js + PostgreSQL (local, `127.0.0.1`)

Step A. Connect and initialize server:

1. SSH login:
   - `ssh root@139.196.227.208`
2. Base packages:
   - `apt update && apt upgrade -y`
   - `apt install -y curl git unzip build-essential ufw nginx`
3. Node.js + PM2:
   - `curl -fsSL https://deb.nodesource.com/setup_20.x | bash -`
   - `apt install -y nodejs`
   - `npm install -g pm2`

Step B. Security groups / firewall:

Open these ports both in Alibaba Cloud console and local firewall:

- `22` (SSH)
- `80` (HTTP)
- `443` (HTTPS)
- `3000` (Node, usually internal/proxy only)

UFW commands:

- `ufw allow 22`
- `ufw allow 80`
- `ufw allow 443`
- `ufw allow 3000`
- `ufw enable`

Step C. Deploy code to server:

1. Prepare directory and clone:
   - `mkdir -p /var/www/linquan/repo`
   - `cd /var/www/linquan/repo`
   - `git clone https://github.com/SWzei/NJU.git`
2. Enter project:
   - `cd /var/www/linquan/repo/NJU/Linquan/linquan-website`

Step D. Configure PostgreSQL:

1. Install and start:
   - `apt install -y postgresql`
   - `systemctl enable postgresql && systemctl start postgresql`
2. Create DB/user (example):
   - `sudo -u postgres psql`
   - `CREATE DATABASE linquan;`
   - `CREATE USER linquan_app WITH PASSWORD 'your_password';`
   - `GRANT ALL PRIVILEGES ON DATABASE linquan TO linquan_app;`
   - `\q`
3. Verify connection:
   - `PGPASSWORD='your_password' psql -h 127.0.0.1 -U linquan_app -d linquan -c "select now();"`

Step E. Configure backend `.env`:

File location:

- `/var/www/linquan/repo/NJU/Linquan/linquan-website/backend/.env`

Recommended production core fields:

- `HOST=127.0.0.1`
- `PORT=3000`
- `NODE_ENV=production`
- `SERVE_FRONTEND=true`
- `JWT_SECRET=<strong-random-secret>`
- `ALLOWED_ORIGINS=https://linquanpiano.cn,https://www.linquanpiano.cn`
- `DATABASE_URL=postgresql://linquan_app:<password>@127.0.0.1:5432/linquan?sslmode=disable`
- `UPLOAD_ROOT=/var/www/linquan/uploads`

Quick check:

- `grep -E '^(HOST|PORT|NODE_ENV|SERVE_FRONTEND|JWT_SECRET|ALLOWED_ORIGINS|DATABASE_URL|UPLOAD_ROOT)=' .env`

Step F. Build and start service:

1. Install and build:
   - `cd /var/www/linquan/repo/NJU/Linquan/linquan-website/backend`
   - `npm install`
   - `npm run build`
2. Start/restart with PM2:
   - `pm2 start ecosystem.config.cjs --env production --update-env || pm2 restart linquan-backend --update-env`
   - `pm2 save`
3. Health check:
   - `curl -fsS http://127.0.0.1:3000/api/health`
4. Process/log check:
   - `pm2 status`
   - `pm2 logs linquan-backend --lines 120 --nostream`

Step G. Configure Nginx reverse proxy:

1. Create site file:
   - `/etc/nginx/sites-available/linquan`
2. Minimal config:

```nginx
server {
  listen 80;
  server_name 139.196.227.208 linquanpiano.cn www.linquanpiano.cn;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

3. Enable and reload:
   - `rm -f /etc/nginx/sites-enabled/default`
   - `ln -sfn /etc/nginx/sites-available/linquan /etc/nginx/sites-enabled/linquan`
   - `nginx -t && systemctl reload nginx`
4. Verify:
   - `curl -H 'Host: 139.196.227.208' http://127.0.0.1/api/health`
   - `curl http://139.196.227.208/api/health`

Step H. Public access and runtime behavior:

- Public URL (IP mode): `http://139.196.227.208`
- Domain mode (recommended): bind DNS to server IP and use `https://linquanpiano.cn`
- Exiting SSH will not stop website. PM2 + systemd-managed services keep running.

Step I. Frequent real-world issues and fixes:

1. `curl: (7) Failed to connect ...:3000` immediately after PM2 restart:
   - usually startup race condition; retry after 1-3 seconds
   - use loop health check:
   - `for i in $(seq 1 45); do curl -fsS http://127.0.0.1:3000/api/health && break; sleep 1; done`
2. Nginx `/api/health` returns 404:
   - default site not removed or custom site not enabled
   - run:
   - `rm -f /etc/nginx/sites-enabled/default`
   - `ln -sfn /etc/nginx/sites-available/linquan /etc/nginx/sites-enabled/linquan`
   - `nginx -t && systemctl reload nginx`
3. `git pull --rebase` blocked by local changes:
   - `git stash push -u -m "temp-before-sync-$(date +%F-%H%M%S)"`
   - `git -c http.version=HTTP/1.1 pull --rebase origin main`
4. `GnuTLS recv error (-110)` while pulling:
   - retry with HTTP/1.1:
   - `git -c http.version=HTTP/1.1 pull --rebase origin main`

Step J. Recommended post-deploy acceptance:

1. `curl http://127.0.0.1:3000/api/health`
2. `curl http://139.196.227.208/api/health`
3. Register a member account and login
4. Submit concert application
5. Open admin scheduling page and ensure no 500 error
6. Verify uploads can be accessed under `/uploads/...`

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
- `GET /api/concerts/:concertId/my-application`
- `GET /api/concerts/:concertId/auditions`
- `GET /api/concerts/:concertId/results`
- `GET /api/gallery`

Admin:

- `POST /api/admin/activities`
- `GET /api/admin/activities`
- `PATCH /api/admin/activities/:activityId`
- `DELETE /api/admin/activities/:activityId`
- `POST /api/admin/announcements`
- `GET /api/admin/announcements`
- `PATCH /api/admin/announcements/:announcementId`
- `DELETE /api/admin/announcements/:announcementId`
- `POST /api/admin/semesters`
- `POST /api/admin/scheduling/run`
- `POST /api/admin/scheduling/update`
- `GET /api/admin/scheduling/proposed`
- `POST /api/admin/scheduling/assignments`
- `PATCH /api/admin/scheduling/assignments/:assignmentId`
- `DELETE /api/admin/scheduling/assignments/:assignmentId`
- `GET /api/admin/scheduling/export`
- `GET /api/admin/scheduling/preferences/export`
- `POST /api/admin/scheduling/publish`
- `POST /api/admin/concerts`
- `GET /api/admin/concerts`
- `PATCH /api/admin/concerts/:concertId`
- `PATCH /api/admin/concerts/:concertId/status`
- `GET /api/admin/concerts/:concertId/applications`
- `GET /api/admin/concerts/:concertId/applications/export`
- `POST /api/admin/concerts/:concertId/auditions`
- `POST /api/admin/concerts/:concertId/results`
- `GET /api/admin/gallery`
- `POST /api/admin/gallery/upload`
- `POST /api/admin/gallery`
- `PATCH /api/admin/gallery/:itemId`
- `DELETE /api/admin/gallery/:itemId`
- `GET /api/admin/members`
- `GET /api/admin/members/:userId`
- `POST /api/admin/members/:userId/reset-password`
- `DELETE /api/admin/members/:userId`

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

### 12.6 ECS Production Update Commands (Recommended)

For your current Alibaba ECS deployment, use this command sequence:

```bash
cd /var/www/linquan/repo/NJU/Linquan/linquan-website
git -c http.version=HTTP/1.1 pull --rebase origin main

cd backend
npm install
npm run build

pm2 restart linquan-backend --update-env
pm2 save

for i in $(seq 1 45); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null; then
    echo "health ok"
    break
  fi
  sleep 1
done

curl -fsS http://127.0.0.1:3000/api/health
nginx -t && systemctl reload nginx
```

If `git pull --rebase` is blocked by local changes:

```bash
git stash push -u -m "temp-before-sync-$(date +%F-%H%M%S)"
git -c http.version=HTTP/1.1 pull --rebase origin main
```

If you want to inspect current backend status quickly:

```bash
pm2 status
pm2 logs linquan-backend --lines 120 --nostream
ss -ltnp | grep :3000
```

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

## 17. Recent Updates (2026-02)

This section summarizes the latest functional and deployment updates that were completed recently.

### 17.1 Admin: Member Account Management (new)

Added a dedicated admin page for member account operations:

- Frontend page: `frontend/src/views/AdminMembersView.vue`
- Admin route: `/admin/members`
- Admin navigation entry added in `AdminLayoutView`

Supported operations:

- Search/view member basic info
- View account identifier and stored password hash
- Reset member password (manual input or auto-generated temporary password)
- Delete/deactivate member account

Backend APIs added:

- `GET /api/admin/members`
- `GET /api/admin/members/:userId`
- `POST /api/admin/members/:userId/reset-password`
- `DELETE /api/admin/members/:userId`

### 17.2 Concert Application Robustness Fix

The recurring error `Invalid application payload` was fixed in `backend/src/routes/concertRoutes.js`.

Main improvements:

- More tolerant payload parsing and fallback mapping
- Better compatibility for legacy field names
- Numeric normalization for duration (e.g. decimal or missing values)
- QQ/contact normalization to avoid hard-fail on short/empty inputs
- Keeps strict account binding on student number match for security

Verification status:

- `npm run test:smoke` passed
- Additional focused concert-application compatibility smoke test passed

### 17.3 Scheduling Stability Improvements (Postgres mode)

Admin scheduling interfaces were hardened to avoid UI blocking when operation logs are temporarily unavailable.

Updates include:

- safer read path for schedule operation logs
- fail-open behavior for non-critical operation-log insert/read errors
- admin scheduling proposed endpoint no longer crashes due logging-table edge cases

### 17.4 Alibaba ECS Deployment Stabilization

Production deployment on Alibaba ECS was stabilized with:

- PM2 process persistence (`pm2 save`)
- Nginx reverse proxy correction (remove default site, enable custom `linquan` site)
- startup race handling in health checks (retry loop after PM2 restart)
- production update workflow standardized in this README (Section 12.6)

### 17.5 Homepage Hero Image Switch

Homepage hero image source was updated in:

- `frontend/src/content/photoManifest.js`

Current behavior:

- Primary: original piano-themed hero image URL
- Fallback: local file `frontend/public/photos/hero/home-hero.jpg`

### 17.6 Current Known Non-Blocking Warnings

Frontend build shows webpack asset size warnings because several photo assets are large.
This does not block deployment or runtime, but image compression is recommended for faster first load.
