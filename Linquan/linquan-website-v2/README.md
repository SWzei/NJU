# NJU林泉钢琴社 Website

Full-stack bilingual web system for NJU林泉钢琴社. Chinese is the default UI language, with an English switch available in the frontend.

Current system scope:

- Member registration/login with student number + password
- Public/member dashboard with activities, announcements, and downloadable attachments
- Member profile management, member directory, member detail pages, and public gallery
- Piano time preference submission, draft generation, admin adjustment, CSV export, and published assignment lookup
- Concert publishing, concert release, multi-entry concert application, score upload, and registration overview
- Class Matching（琴课匹配）with independent matching terms, teacher qualification review, automatic matching, manual adjustment, incremental updates, version history, and CSV export
- Admin publishing, gallery management, member account management, and optional email notifications

## 0. Chinese Role-Based Manuals

Chinese manuals are kept separately under `docs/`:

- Member manual: `docs/README（社员）.md`
- Admin manual: `docs/README（管理员）.md`
- Alibaba Cloud deployment guide: `docs/DEPLOY_ALIYUN_ZH.md`

This `README.md` is the up-to-date system overview, architecture reference, API summary, and deployment runbook.

## 1. Tech Stack

- Frontend: Vue 3 + Vue Router + Pinia + Axios + Vue CLI 5 (`@vue/cli` 5.0.9)
- Backend: Node.js + Express + Zod + JWT + Multer + Nodemailer
- Database:
  - SQLite by default (`better-sqlite3`)
  - PostgreSQL when `DATABASE_URL` is set (`pg` through a compatibility worker layer)
- Auth: `bcryptjs` password hashing + JWT bearer tokens
- File handling:
  - profile avatar/personal photo uploads
  - activity/announcement attachment uploads
  - concert attachment uploads
  - concert score uploads
  - gallery uploads
- Runtime:
  - backend serves `/api/*`
  - backend serves `/uploads/*` from `UPLOAD_ROOT`
  - backend can also serve `frontend/dist` directly when `SERVE_FRONTEND=true`
- Time handling:
  - timestamps are stored in UTC-compatible form on the backend
  - publish/event times are displayed as Beijing time (`Asia/Shanghai`) in the frontend
- Quality checks in repo:
  - frontend lint/build
  - backend build
  - backend regression smoke test (`npm run test:smoke`)

## 2. Roles and Permission Model

### 2.1 Member

A normal member can:

- Register with required `student number`, required `display name`, optional `email`, and password
- Log in using student number or email plus password
- View published activities and announcements
- Download published attachments
- Edit own profile, avatar, personal photo, and extended contact/interest fields
- View the member directory and member detail pages
- Submit piano time preferences for the active or selected semester
- Indicate whether they are participating in Class Matching for piano-time priority purposes
- View their published piano-time assignment
- View published concerts
- Submit, update, and delete their own concert applications
- Upload score files for concert applications
- Join Class Matching by term, fill matching-specific data, submit availability, submit rankings or direct-match choices, and view the current result/version

### 2.2 Admin

An admin account is not publicly registerable. Admins are seeded or created manually.

An admin can:

- Publish and manage activities
- Publish and manage announcements
- Upload, replace, and delete publish-module attachments
- Create and manage piano scheduling semesters
- Generate draft piano schedules, incrementally update them, manually adjust assignments, export CSV, and publish final assignments
- Create, edit, release, and delete concerts
- View concert registration overview and export concert applications as CSV
- Manage gallery items
- Search member accounts, inspect profile/account details, reset passwords, and deactivate accounts
- Manage Class Matching terms, review teacher qualification, generate automatic matches, manually adjust matches, run incremental matching, compare/restore versions, and export matching results as CSV

## 3. Project Structure (Detailed)

```text
linquan-website/
├── .vscode/
│   ├── extensions.json
│   └── settings.json
├── backend/
│   ├── package.json
│   ├── ecosystem.config.cjs         # PM2 production config
│   ├── requests.http                # REST Client examples
│   ├── scripts/
│   │   └── smokeTest.mjs            # backend regression smoke test
│   └── src/
│       ├── app.js                   # Express app and route mounting
│       ├── server.js                # HTTP server entry
│       ├── config/
│       │   ├── db.js                # SQLite/Postgres adapter + runtime compatibility updates
│       │   ├── env.js               # env loading and constants
│       │   ├── postgresCompat.js    # SQLite-like adapter over Postgres
│       │   └── postgresWorker.js    # worker-thread PG query runner
│       ├── middleware/
│       │   ├── auth.js
│       │   └── errorHandler.js
│       ├── routes/
│       │   ├── activityRoutes.js
│       │   ├── adminRoutes.js
│       │   ├── authRoutes.js
│       │   ├── classMatchingRoutes.js
│       │   ├── concertRoutes.js
│       │   ├── profileRoutes.js
│       │   └── schedulingRoutes.js
│       ├── services/
│       │   ├── emailService.js
│       │   ├── notificationService.js
│       │   ├── schedulerService.js
│       │   └── classMatching/
│       │       ├── algorithm.js
│       │       ├── common.js
│       │       ├── index.js
│       │       └── versions.js
│       ├── scripts/
│       │   ├── initDb.js            # SQLite schema init + default admin + default semester
│       │   └── seedTestMembers.js   # local bulk member seed helper
│       └── utils/
│           ├── classMatching.js
│           ├── contentAttachments.js
│           ├── dateTime.js
│           ├── httpError.js
│           ├── semester.js
│           └── uploadFilename.js
├── database/
│   └── schema.sql
├── deploy/
│   └── aliyun/
│       ├── 01_init_server.sh
│       ├── 02_setup_postgres.sh
│       ├── 03_deploy_app.sh
│       ├── 04_setup_nginx.sh
│       ├── 05_enable_https.sh
│       ├── 06_update_app.sh
│       ├── nginx-linquan.conf
│       └── .env.backend.aliyun.example
├── docs/
│   ├── DEPLOY_ALIYUN_ZH.md
│   ├── README（管理员）.md
│   └── README（社员）.md
├── frontend/
│   ├── package.json
│   ├── .eslintrc.cjs
│   ├── jsconfig.json
│   ├── vue.config.js
│   ├── scripts/
│   │   └── patch-deprecated-deps.cjs
│   ├── public/
│   │   ├── index.html
│   │   └── photos/
│   │       ├── club/
│   │       ├── concerts/
│   │       ├── events/
│   │       ├── hero/
│   │       └── README.md
│   └── src/
│       ├── App.vue
│       ├── main.js
│       ├── assets/base.css
│       ├── components/
│       │   ├── CenterToast.vue
│       │   ├── PhotoGallery.vue
│       │   └── admin/
│       │       └── ConcertEditorForm.vue
│       ├── composables/toast.js
│       ├── content/photoManifest.js
│       ├── i18n/index.js
│       ├── router/index.js
│       ├── services/api.js
│       ├── stores/auth.js
│       ├── utils/dateTime.js
│       └── views/
│           ├── DashboardView.vue
│           ├── LoginView.vue
│           ├── RegisterView.vue
│           ├── ProfileView.vue
│           ├── MemberDirectoryView.vue
│           ├── MemberDetailView.vue
│           ├── ScheduleView.vue
│           ├── ConcertsView.vue
│           ├── ClassMatchingView.vue
│           ├── AdminLayoutView.vue
│           ├── AdminPublishingView.vue
│           ├── AdminSchedulingView.vue
│           ├── AdminConcertsView.vue
│           ├── AdminGalleryView.vue
│           ├── AdminMembersView.vue
│           └── AdminClassMatchingView.vue
├── .editorconfig
├── .env.example
├── render.yaml
└── README.md
```
## 4. Data Model Summary

Core schema lives in `database/schema.sql`. Runtime compatibility and backfill logic live in `backend/src/config/db.js`.

### 4.1 Identity and Profile

- `users`
  - login identity, student number, email, password hash, role, and `is_active` soft-deactivation flag
- `profiles`
  - reusable base profile data for the whole site
  - includes display name, avatar/photo, bio, grade, major, academy, hobbies, piano interests, WeChat, phone

### 4.2 Publishing and Attachments

- `activities`
- `announcements`
- `content_attachments`
  - generic multi-file attachment table used by activities and announcements
  - stores original filename, saved file path, size, MIME type, creator, and timestamps
- `notifications`
  - in-app notification records; optional SMTP email sending is layered on top

### 4.3 Piano Scheduling

- `semesters`
- `room_slots`
- `slot_preferences`
- `schedule_user_settings`
  - currently stores the piano-time flag `class_matching_priority`
- `schedule_batches`
- `schedule_assignments`
- `schedule_operation_logs`

Scheduling facts implemented in code:

- 2 rooms
- 7 days per week
- 08:00-22:00, one hour per slot
- weekly capacity = `2 * 7 * 14 = 196` slots

### 4.4 Concerts

- `concerts`
  - title, description, announcement, deadline, status, optional attachment
- `concert_applications`
  - supports multiple applications by the same member for the same concert
  - stores applicant info snapshot, repertoire fields, QQ contact, score file path, status, feedback, timestamps

### 4.5 Gallery

- `gallery_items`
  - bilingual titles/descriptions, image path, visibility, ordering

### 4.6 Class Matching（琴课匹配）

The Class Matching module is additive and does not copy base profile data.

- `class_matching_terms`
  - independent from piano scheduling semesters
- `class_matching_slots`
  - weekly availability grid for each matching term
- `class_matching_profiles`
  - matching-specific extension data only
  - participant type, matching mode, skill/goal/budget/teaching/capacity/direct target/qualification
- `class_matching_availability`
- `class_matching_rankings`
- `class_matching_versions`
- `class_matching_matches`

Compatibility note:

- base identity/profile data still lives in `users` + `profiles`
- Class Matching reads from those tables and stores only matching-specific extensions in separate tables
- no matching-specific columns were added to core profile/user tables

## 5. Core Business Logic and Current Workflow

### 5.1 Publishing Workflow (Activities and Announcements)

Publishing behavior is the same across activities and announcements:

- admin can create a draft or create directly as published
- admin can edit title/content and upload multiple attachments
- admin can add new files, replace existing files, or delete files during editing
- attachment original filenames are preserved, including Chinese filenames
- files are available for view/download after publishing
- API returns attachment metadata and download links
- displayed times are rendered in Beijing time on the frontend

### 5.2 Piano Scheduling Workflow

Implemented in `backend/src/services/schedulerService.js` plus admin/member scheduling routes.

Member side:

- select the semester to view/edit
- see demand counts per slot
- submit unlimited slot preferences
- set whether they are participating in Class Matching for piano-time priority
- view published assignment

Admin side:

- create or switch active scheduling semester
- generate draft schedule
- run incremental draft update
- manually assign, move, or delete assignments
- export schedule CSV and preference CSV
- publish final schedule

Algorithm behavior:

- Phase 1: fairness first
  - try to maximize members receiving at least one slot
  - users with `class_matching_priority = true` are considered first in the first fairness round only
  - then members with fewer preferences are preferred
- Phase 2: efficiency / second slot
  - attempts to give a second slot without breaking fairness
  - prefers practical continuity and better slot utilization
- Manual admin edits happen on top of the draft and do not change the underlying algorithm rules

### 5.3 Concert Workflow

Current concert workflow is centered on concert publishing and application management.

Admin side:

- create/edit concerts through one unified form component
- set title, description, announcement, deadline, status, and optional attachment
- save draft changes
- release concert and notify members
- delete concert and all dependent applications/files
- view registration overview and export application CSV

Member side:

- view published concerts
- submit multiple applications to one concert
- update an existing application by sending its `applicationId`
- delete their own applications
- upload score files

Note:

- the old standalone review/audition management module is not part of the current system
- README sections referring to review/audition behavior from earlier iterations no longer apply

### 5.4 Class Matching（琴课匹配） Workflow

Class Matching is an independent term-based module implemented in `backend/src/services/classMatching/`.

Term model:

- matching terms are independent from piano scheduling semesters
- each term has its own availability grid, profile extensions, rankings, results, and versions

Member workflow:

- choose the active or desired matching term
- see base profile data pulled from `profiles`
- fill matching-specific fields:
  - student: skill level, learning goals, availability, budget/fee expectation
  - teacher: teaching experience, skill specialization, availability, fee expectation, capacity
- choose exactly one matching mode per term:
  - `direct`: point-to-point mutual agreement
  - `ranking`: ordered preference ranking
- submit availability and rankings/direct target
- view current matching result/version for that term

Admin workflow:

- create, edit, activate, or delete matching terms
- review teacher qualification with status + feedback (`pending`, `approved`, `rejected`)
- run automatic matching
- run incremental matching for newly added participants
- manually adjust pairings
- inspect version history, compare versions, and restore a version
- export matching results as CSV

Algorithm behavior:

- student-proposing Gale-Shapley stable matching
- locked direct mutual pairs are created first and excluded from algorithmic matching
- only approved teachers participate in algorithmic matching
- teacher capacity is enforced
- matching score is based on ranking signals plus availability overlap
- incremental runs keep existing matches stable unless admin manually changes them

### 5.5 Gallery and Member Visibility

- public/member gallery is driven by `gallery_items`
- member directory and member detail pages reuse base profile data
- admin can upload gallery images and control ordering/visibility without touching member profile records

## 6. Environment Setup

Prerequisites:

- Node.js LTS (`20.x`, `22.x`, or `24.x` work with this repo)
- npm
- Git
- VS Code
- SQLite for the simplest local start, or PostgreSQL for production-like deployments

Recommended VS Code extensions (already reflected in `.vscode/extensions.json`):

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

Recommended editor behavior is already checked in under `.vscode/settings.json`.

## 7. First-Time Start (From Scratch)

Recommended local development mode is SQLite.

From project root:

```powershell
cd D:\Code\NJU\Linquan\linquan-website
```

### 7.1 Create an env file

The backend checks `backend/.env` first and then falls back to the repo-root `.env`.

Simplest local option:

```powershell
Copy-Item .env.example backend/.env
```

### 7.2 Install dependencies

```powershell
cd backend
npm install
cd ..\frontend
npm install
```

### 7.3 Initialize the local SQLite database

```powershell
cd ..\backend
npm run db:init
```

This creates the SQLite schema, the default admin account, and the default active piano-time semester.

### 7.4 Start backend and frontend

Backend:

```powershell
cd D:\Code\NJU\Linquan\linquan-website\backend
npm run dev
```

Default backend URL:

- `http://localhost:4000`

Frontend in a new terminal:

```powershell
cd D:\Code\NJU\Linquan\linquan-website\frontend
npm run serve
```

Default frontend URL:

- `http://localhost:8080`

### 7.5 Default admin account

Created by `npm run db:init` when absent:

- student number: `A0000000`
- password: `Admin@123`
- email: `admin@example.com`

Optional seed envs before `db:init`:

- `ADMIN_STUDENT_NUMBER`
- `ADMIN_PASSWORD`
- `ADMIN_EMAIL`
## 8. Environment Variables

### 8.1 Backend env loading

Supported env file locations:

- `backend/.env` (preferred)
- project-root `.env`

### 8.2 Core backend variables

- `HOST`
  - default `0.0.0.0` locally
  - use `127.0.0.1` behind Nginx on ECS
- `PORT`
  - default `4000` locally
  - production ECS template uses `3000`
- `NODE_ENV`
  - typically `development` or `production`
- `JWT_SECRET`
  - required for real deployments
- `DATABASE_URL`
  - when set, backend uses PostgreSQL
- `DB_PATH`
  - SQLite file path used when `DATABASE_URL` is empty
- `UPLOAD_ROOT`
  - base upload directory for all user/admin uploaded files
- `SERVE_FRONTEND`
  - when `true`, backend serves `frontend/dist`
- `ALLOWED_ORIGINS`
  - comma-separated CORS allowlist
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
  - optional email delivery settings
- `PG_QUERY_TIMEOUT_MS`, `PG_POOL_MAX`, `PG_IDLE_TIMEOUT_MS`, `PG_CONNECT_TIMEOUT_MS`
  - optional Postgres worker tuning

### 8.3 Frontend env (optional)

Frontend development can also use:

- `VUE_APP_API_BASE_URL` (default `/api`)
- `VUE_APP_DEV_API_TARGET` (default `http://localhost:4000` via `vue.config.js`)

### 8.4 Production template

Alibaba ECS example env file:

- `deploy/aliyun/.env.backend.aliyun.example`

Important production defaults in that template:

- `HOST=127.0.0.1`
- `PORT=3000`
- `SERVE_FRONTEND=true`
- `DATABASE_URL=postgresql://...`
- `UPLOAD_ROOT=/var/www/linquan/uploads`

## 9. Development Commands

### 9.1 Backend (`backend/`)

- `npm run dev`
  - start backend with nodemon
- `npm run build`
  - install frontend dev deps and build `frontend/dist`
- `npm run start`
  - start backend without nodemon
- `npm run start:pm2`
  - start PM2 production process
- `npm run reload:pm2`
  - reload PM2 production process
- `npm run db:init`
  - initialize SQLite schema/admin/default semester
- `npm run seed:test-members`
  - add bulk test members for local scheduling tests
- `npm run test:smoke`
  - run automated API regression smoke test
- `npm run test:modules:light`
  - run a light representative Piano Time + Class Matching validation against the local runtime database
  - creates uniquely labeled users / semester / class-matching term, verifies end-to-end flows, saves CSV evidence under `test-artifacts/2026-04-05-light-module-validation/`, and removes only the exact runtime data it created when validation succeeds
- `npm run test:compat:backup`
  - run the restored-backup compatibility validator against a running backend that already points to a safe copy of the production PostgreSQL dump and copied `UPLOAD_ROOT`
  - drives real API flows for auth/profile, publishing + attachments, concerts + applications, scheduling, class matching, and member deactivation
  - saves request/state evidence to `test-artifacts/2026-04-06-db-compat-validation/api/compat-validation.state.json` and downloaded CSV/files to `test-artifacts/2026-04-06-db-compat-validation/exports/`

### 9.2 Frontend (`frontend/`)

- `npm run serve`
  - start Vue dev server
- `npm run build`
  - build production frontend
- `npm run lint`
  - lint frontend code

Note:

- frontend scripts run `scripts/patch-deprecated-deps.cjs` first to patch a deprecated upstream dependency warning during local development

### 9.3 Recommended local validation sequence

```powershell
cd D:\Code\NJU\Linquan\linquan-website\frontend
npm run lint
npm run build

cd ..\backend
npm run build
npm run test:smoke
```

## 10. Public Deployment (Long-Term)

The project supports a single-service runtime pattern:

- Nginx/public reverse proxy (optional but recommended)
- Node/Express backend
- backend serves `frontend/dist`
- database is SQLite or PostgreSQL
- uploads are served from `UPLOAD_ROOT`

### 10.1 Alibaba Cloud ECS (recommended self-hosting path)

Repository deployment assets are under `deploy/aliyun/`.

Verified deployment layout:

- repo clone root: `/var/www/linquan/repo`
- project root: `/var/www/linquan/repo/Linquan/linquan-website`
- symlink: `/var/www/linquan/backend`
- symlink: `/var/www/linquan/frontend`
- persistent uploads: `/var/www/linquan/uploads`

#### 10.1.1 Step-by-step scripted deployment

1. Bootstrap the repository on the server so the deploy scripts exist locally:

```bash
mkdir -p /var/www/linquan
git clone https://github.com/<your-user>/<your-repo>.git /var/www/linquan/repo
cd /var/www/linquan/repo/Linquan/linquan-website
```

2. Initialize server tools, Node.js, PM2, Nginx, firewall:

```bash
cd /var/www/linquan/repo/Linquan/linquan-website
bash deploy/aliyun/01_init_server.sh
```

3. Install PostgreSQL and create DB/user:

```bash
DB_NAME=linquan DB_USER=linquan_app DB_PASS='<strong-password>' bash deploy/aliyun/02_setup_postgres.sh
```

4. Build app and set up the runtime symlinks:

```bash
REPO_URL=https://github.com/<your-user>/<your-repo>.git BRANCH=main PROJECT_SUBDIR=Linquan/linquan-website bash deploy/aliyun/03_deploy_app.sh
```

5. Edit backend production env:

```bash
vim /var/www/linquan/repo/Linquan/linquan-website/backend/.env
```

Start from:

- `deploy/aliyun/.env.backend.aliyun.example`

Critical production values:

- `HOST=127.0.0.1`
- `PORT=3000`
- `NODE_ENV=production`
- `SERVE_FRONTEND=true`
- `JWT_SECRET=<strong-random-secret>`
- `ALLOWED_ORIGINS=https://linquanpiano.cn,https://www.linquanpiano.cn`
- `DATABASE_URL=postgresql://linquan_app:<password>@127.0.0.1:5432/linquan?sslmode=disable`
- `UPLOAD_ROOT=/var/www/linquan/uploads`

6. Restart PM2 after env changes:

```bash
cd /var/www/linquan/repo/Linquan/linquan-website/backend
pm2 restart ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs --env production --update-env
pm2 save
```

7. Configure Nginx:

```bash
SERVER_NAME=linquanpiano.cn NODE_PORT=3000 PROJECT_SUBDIR=Linquan/linquan-website bash deploy/aliyun/04_setup_nginx.sh
```

8. Enable HTTPS after domain/DNS/ICP are ready:

```bash
DOMAIN=linquanpiano.cn EMAIL=<your-email> bash deploy/aliyun/05_enable_https.sh
```

#### 10.1.2 Manual deployment verification

Health check:

```bash
curl -fsS http://127.0.0.1:3000/api/health
```

PM2 check:

```bash
pm2 status
pm2 logs linquan-backend --lines 120 --nostream
```

Nginx check:

```bash
nginx -t && systemctl reload nginx
curl http://127.0.0.1/api/health -H 'Host: linquanpiano.cn'
```

#### 10.1.3 Routine update on ECS

```bash
cd /var/www/linquan/repo/Linquan/linquan-website
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

### 10.2 Render deployment

`render.yaml` is included for a single Node web service.

Current blueprint behavior:

- service type: `web`
- root directory: `Linquan/linquan-website/backend`
- build: `npm install && npm run build`
- start: `npm start`
- health check: `/api/health`

Required envs on Render:

- `DATABASE_URL`
- `ALLOWED_ORIGINS`
- generated `JWT_SECRET`

Important limitation:

- current `render.yaml` uses `UPLOAD_ROOT=uploads`
- on Render free plan, local disk is ephemeral
- use external object storage if you need persistent uploads there

### 10.3 Manual VM deployment pattern

If you are not using the included scripts, the minimum runtime pattern is:

1. install Node.js, npm, PM2, Nginx, and PostgreSQL if needed
2. clone repo to a stable server path
3. create `backend/.env`
4. run:

```bash
cd /path/to/Linquan/linquan-website/backend
npm install
npm run build
pm2 start ecosystem.config.cjs --env production --update-env
pm2 save
```

5. proxy Nginx to `127.0.0.1:3000`
6. expose only `80/443` publicly when possible
## 11. API Overview

Detailed request examples live in `backend/requests.http`.

### 11.1 Public / Auth

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`

### 11.2 Activities, Announcements, Attachments, Gallery

- `GET /api/activities`
- `GET /api/announcements`
- `GET /api/gallery`
- `GET /api/attachments/:attachmentId/download`

### 11.3 Profile and Member Directory

Authenticated member:

- `GET /api/profiles/me`
- `PUT /api/profiles/me`
- `POST /api/profiles/me/avatar`
- `POST /api/profiles/me/photo`

Public/member directory:

- `GET /api/profiles`
- `GET /api/profiles/:userId`

### 11.4 Piano Scheduling

Member:

- `GET /api/scheduling/semesters`
- `GET /api/scheduling/slots`
- `POST /api/scheduling/preferences`
- `GET /api/scheduling/my-assignment`

Admin:

- `POST /api/admin/semesters`
- `GET /api/admin/semesters/current`
- `POST /api/admin/scheduling/run`
- `POST /api/admin/scheduling/update`
- `GET /api/admin/scheduling/proposed`
- `POST /api/admin/scheduling/assignments`
- `PATCH /api/admin/scheduling/assignments/:assignmentId`
- `DELETE /api/admin/scheduling/assignments/:assignmentId`
- `GET /api/admin/scheduling/preferences/export`
- `GET /api/admin/scheduling/export`
- `POST /api/admin/scheduling/publish`

### 11.5 Concerts

Member/public:

- `GET /api/concerts`
- `POST /api/concerts/:concertId/applications`
- `GET /api/concerts/:concertId/my-applications`
- `GET /api/concerts/:concertId/my-application` (legacy alias)
- `DELETE /api/concerts/:concertId/applications/:applicationId`

Admin:

- `GET /api/admin/concerts`
- `POST /api/admin/concerts`
- `PATCH /api/admin/concerts/:concertId`
- `PATCH /api/admin/concerts/:concertId/status`
- `POST /api/admin/concerts/:concertId/release`
- `DELETE /api/admin/concerts/:concertId`
- `GET /api/admin/concerts/:concertId/applications`
- `GET /api/admin/concerts/:concertId/applications/export`

### 11.6 Publishing Management

Activities:

- `GET /api/admin/activities`
- `POST /api/admin/activities`
- `PATCH /api/admin/activities/:activityId`
- `DELETE /api/admin/activities/:activityId`
- `POST /api/admin/activities/:activityId/attachments/:attachmentId/replace`
- `DELETE /api/admin/activities/:activityId/attachments/:attachmentId`

Announcements:

- `GET /api/admin/announcements`
- `POST /api/admin/announcements`
- `PATCH /api/admin/announcements/:announcementId`
- `DELETE /api/admin/announcements/:announcementId`
- `POST /api/admin/announcements/:announcementId/attachments/:attachmentId/replace`
- `DELETE /api/admin/announcements/:announcementId/attachments/:attachmentId`

### 11.7 Member Account and Gallery Management

Members:

- `GET /api/admin/members`
- `GET /api/admin/members/:userId`
- `POST /api/admin/members/:userId/reset-password`
- `DELETE /api/admin/members/:userId` (soft-deactivate the account; keep the row but exclude it from auth and member listings)

Gallery:

- `GET /api/admin/gallery`
- `POST /api/admin/gallery/upload`
- `POST /api/admin/gallery`
- `PATCH /api/admin/gallery/:itemId`
- `DELETE /api/admin/gallery/:itemId`

### 11.8 Class Matching（琴课匹配）

Member:

- `GET /api/class-matching/terms`
- `GET /api/class-matching/overview`
- `PUT /api/class-matching/profile`
- `POST /api/class-matching/availability`
- `POST /api/class-matching/rankings`

Admin:

- `GET /api/admin/class-matching/terms`
- `POST /api/admin/class-matching/terms`
- `PATCH /api/admin/class-matching/terms/:termId`
- `DELETE /api/admin/class-matching/terms/:termId`
- `GET /api/admin/class-matching/terms/:termId/overview`
- `PATCH /api/admin/class-matching/terms/:termId/teachers/:teacherUserId/qualification`
- `POST /api/admin/class-matching/terms/:termId/generate`
- `POST /api/admin/class-matching/terms/:termId/incremental`
- `POST /api/admin/class-matching/terms/:termId/manual`
- `GET /api/admin/class-matching/terms/:termId/versions`
- `GET /api/admin/class-matching/terms/:termId/versions/:versionId`
- `GET /api/admin/class-matching/terms/:termId/compare`
- `POST /api/admin/class-matching/terms/:termId/versions/:versionId/restore`
- `GET /api/admin/class-matching/terms/:termId/export`

Routing note:

- `backend/src/app.js` mounts `/api/class-matching/*` before `/api/admin/*`
- this is intentional and prevents member class-matching routes from being blocked by admin-only middleware

## 12. How to Update the Project

### 12.1 Monorepo-safe Git workflow

This repository is a monorepo. Always work from repository root (`D:\Code\NJU`), but stage only the paths you intentionally want to ship.

Rules:

- do not develop risky changes directly on `main`
- use a feature branch for each website change set
- do not use `git add .` from repo root for website work
- let repo-root `.gitignore` handle repo-wide local artifacts
- keep `Linquan/linquan-website/.gitignore` with the project so copied siblings such as `Linquan/linquan-website-v2` inherit the same upload-ignore behavior

Recommended start:

```powershell
cd D:\Code\NJU
git status --short
git switch main
git pull --ff-only origin main
git switch -c feat/linquan-v2-bootstrap
git status --ignored --short
```

Useful safety checks:

```powershell
git check-ignore -v Linquan/linquan-website/database/linquan.db
git check-ignore -v Linquan/linquan-website/backend/uploads/example.txt
```

### 12.2 Reinstall and rebuild after updates

Local:

```powershell
cd D:\Code\NJU\Linquan\linquan-website\backend
npm install
npm run build
npm run test:smoke

cd ..\frontend
npm run lint
npm run build
```

### 12.3 Update schema-dependent features

Current project is schema-first (`database/schema.sql`) plus runtime compatibility in `backend/src/config/db.js`.

Recommended rules:

- back up database before schema changes
- update `database/schema.sql`
- keep runtime compatibility code only for real backward-compatibility needs
- re-run local SQLite init only if you intentionally want a fresh DB

Local SQLite reset:

```powershell
cd D:\Code\NJU\Linquan\linquan-website
Remove-Item .\database\linquan.db -ErrorAction SilentlyContinue
cd .\backend
npm run db:init
```

### 12.4 Update frontend pages or APIs safely

Recommended order:

1. change backend route/service/schema
2. verify with `backend/requests.http` or smoke tests
3. update frontend views/API calls
4. run lint/build/tests again

### 12.5 Add `linquan-website-v2` safely

Goal:

- keep `Linquan/linquan-website` unchanged
- add a new sibling directory `Linquan/linquan-website-v2`
- avoid copying local databases, uploads, `node_modules`, builds, logs, and test artifacts

PowerShell copy example from repository root:

```powershell
cd D:\Code\NJU
robocopy .\Linquan\linquan-website .\Linquan\linquan-website-v2 /E /XD node_modules dist coverage uploads backend\uploads test-artifacts .tmp-ui-e2e .git /XF .env .env.local *.db *.db-shm *.db-wal *.sqlite *.sqlite3 *.log
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }
```

Review, stage, commit, and push only the intended paths:

```powershell
git status --short
git check-ignore -v Linquan/linquan-website-v2/backend/uploads/probe.txt
git add -- .gitignore Linquan/linquan-website/.gitignore Linquan/linquan-website/README.md Linquan/linquan-website-v2
git diff --cached --stat
git commit -m "Add linquan-website-v2 safely"
git push -u origin feat/linquan-v2-bootstrap
```

Then open a pull request from `feat/linquan-v2-bootstrap` into `main`. Do not force-push `main` for this migration.

If `.git/index.lock` exists unexpectedly on Windows:

```powershell
if (Test-Path .git\index.lock) { Remove-Item .git\index.lock -Force }
```

### 12.6 Safe Production Upgrade From Existing PostgreSQL + Uploads

This is the recommended zero-data-loss upgrade path for the current Aliyun layout:

- database: PostgreSQL via `DATABASE_URL`
- uploads: persistent directory via `UPLOAD_ROOT=/var/www/linquan/uploads`

Important rule:

- back up both the PostgreSQL database and the full `UPLOAD_ROOT` tree before upgrading
- a database dump alone is not enough to validate or restore historical uploaded files

Pre-upgrade backup checklist:

1. Mark the repository as safe for Git on the server.

This is the correct response to:

- `fatal: detected dubious ownership in repository at '/var/www/linquan/repo'`

Use the deployment account that will run `git pull`:

```bash
git config --global --add safe.directory /var/www/linquan/repo
git config --global --add safe.directory /var/www/linquan/repo/Linquan/linquan-website
```

Do not fix this by recursively changing production file ownership unless you explicitly intend to change the service account model.

2. Inspect the current runtime before touching code:

```bash
cd /var/www/linquan/repo/Linquan/linquan-website
git status --short
git rev-parse HEAD
pm2 status
curl -fsS http://127.0.0.1:3000/api/health
```

3. Back up PostgreSQL:

```bash
cd /var/www/linquan/repo/Linquan/linquan-website/backend
set -a
source .env
set +a
mkdir -p /var/backups/linquan_pg
pg_dump "$DATABASE_URL" > "/var/backups/linquan_pg/linquan_$(date +%F_%H%M%S).sql"
```

4. Back up uploads:

```bash
tar -czf /var/backups/linquan_uploads_$(date +%F_%H%M%S).tar.gz /var/www/linquan/uploads
```

5. Record the current release for rollback:

```bash
cd /var/www/linquan/repo/Linquan/linquan-website
git rev-parse HEAD
pm2 status
```

Offline compatibility rehearsal on a safe copy:

1. Copy the SQL dump and upload backup to a local validation workspace.
2. Restore the SQL dump into disposable PostgreSQL, for example with Docker:

```powershell
docker run -d --name linquan-pg-compat -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=linquan_compat -p 55432:5432 postgres:16
docker cp D:\safe-copy\linquan.sql linquan-pg-compat:/tmp/linquan.sql
docker exec linquan-pg-compat psql -U postgres -d linquan_compat -f /tmp/linquan.sql
```

3. Start the current backend against the restored copy and the copied uploads:

```powershell
$env:HOST='127.0.0.1'
$env:PORT='4310'
$env:JWT_SECRET='compat-validation-secret'
$env:DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/linquan_compat?sslmode=disable'
$env:UPLOAD_ROOT='D:\safe-copy\uploads'
$env:SERVE_FRONTEND='false'
cd D:\Code\NJU\Linquan\linquan-website\backend
node src/server.js
```

4. Run the restored-backup validation:

```powershell
cd D:\Code\NJU\Linquan\linquan-website\backend
$env:COMPAT_BASE_URL='http://127.0.0.1:4310/api'
$env:COMPAT_ARTIFACT_ROOT='D:\Code\NJU\Linquan\linquan-website\test-artifacts\2026-04-06-db-compat-validation'
npm run test:compat:backup
```

What the restored-backup validator checks:

- current backend boots successfully against the old production schema shape
- runtime compatibility upgrades create/add the required modern tables/columns
- legacy production data can still be read through current public/admin APIs
- new writes succeed on the upgraded schema for:
  - profile updates
  - publishing attachments
  - concert creation + application upload
  - semester scheduling
  - class matching
  - soft member deactivation

Current known caveat from the April 6, 2026 rehearsal:

- if the backup set does not include the actual persisted `UPLOAD_ROOT` files, historical DB file paths will still resolve to `404` locally even though the app route is correct
- this is a backup completeness issue, not an application schema issue

Production deployment steps:

1. Ensure the fresh database dump and upload archive exist and are readable.
2. Ensure Git safe-directory is configured on the server for the deployment account:

```bash
git config --global --add safe.directory /var/www/linquan/repo
git config --global --add safe.directory /var/www/linquan/repo/Linquan/linquan-website
```

3. Update code on the server:

```bash
cd /var/www/linquan/repo/Linquan/linquan-website
git status --short
git -c http.version=HTTP/1.1 pull --rebase origin main
```

4. Reinstall/build:

```bash
cd backend
npm install
npm run build

cd ../frontend
npm install
npm run lint
npm run build
```

5. Keep production env values pointing at the existing PostgreSQL database and persistent upload directory:

- `DATABASE_URL=postgresql://linquan_app:...@127.0.0.1:5432/linquan?sslmode=disable`
- `UPLOAD_ROOT=/var/www/linquan/uploads`

6. Restart PM2 with the current env:

```bash
cd /var/www/linquan/repo/Linquan/linquan-website/backend
pm2 restart ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs --env production --update-env
pm2 save
```

7. Allow the first boot to run the runtime compatibility updates in `backend/src/config/db.js`.
8. Run post-deploy validation immediately.

Post-deploy validation checklist:

```bash
curl -fsS http://127.0.0.1:3000/api/health
pm2 logs linquan-backend --lines 120 --nostream
```

Then verify at least:

- admin login works
- `GET /api/activities`, `GET /api/announcements`, and `GET /api/concerts` return `200`
- one historical uploaded file URL under `/uploads/*` still downloads
- one member can log in and open profile/schedule/class-matching pages
- admin publishing list loads without `500`
- admin concert list, semester list, and class-matching term list load without `500`

Rollback strategy:

1. Mark the repo safe again if the rollback shell is running as a different user:

```bash
git config --global --add safe.directory /var/www/linquan/repo
git config --global --add safe.directory /var/www/linquan/repo/Linquan/linquan-website
```

2. Return to the previous application commit if the issue is code-only:

```bash
cd /var/www/linquan/repo/Linquan/linquan-website
git reflog --date=iso -n 10
git checkout <previous-good-commit>
cd backend
pm2 restart ecosystem.config.cjs --update-env
pm2 save
```

3. If data was written after the failed upgrade and must be reverted, stop the app and restore both the PostgreSQL dump and the matching upload archive taken immediately before deployment:

```bash
cd /var/www/linquan/repo/Linquan/linquan-website/backend
pm2 stop ecosystem.config.cjs || pm2 stop linquan-backend

sudo -u postgres dropdb --if-exists linquan
sudo -u postgres createdb -O linquan_app linquan
sudo -u postgres psql -d linquan -f /var/backups/linquan_pg/linquan_<timestamp>.sql

sudo rm -rf /var/www/linquan/uploads
sudo tar -xzf /var/backups/linquan_uploads_<timestamp>.tar.gz -C /

pm2 start ecosystem.config.cjs --env production --update-env
pm2 save
```

4. Re-run the same health/API checks after rollback:

```bash
curl -fsS http://127.0.0.1:3000/api/health
pm2 logs linquan-backend --lines 120 --nostream
```

Do not restore only the database without restoring uploads when user-generated files are involved; that creates orphaned file references.

## 13. Backup, Reset, and Data Operations

### 13.1 SQLite local backup

```powershell
Copy-Item D:\Code\NJU\Linquan\linquan-website\database\linquan.db D:\backup_linquan_db\linquan.db
```

### 13.2 PostgreSQL backup on ECS

```bash
cd /var/www/linquan/repo/Linquan/linquan-website/backend
set -a
source .env
set +a
mkdir -p /var/backups/linquan_pg
pg_dump "$DATABASE_URL" > "/var/backups/linquan_pg/linquan_$(date +%F_%H%M%S).sql"
```

### 13.3 Upload backup on ECS

```bash
tar -czf /var/backups/linquan_uploads_$(date +%F_%H%M%S).tar.gz /var/www/linquan/uploads
```

### 13.4 Clean local restart

```powershell
# stop local backend/frontend first
cd D:\Code\NJU\Linquan\linquan-website
Remove-Item .\database\linquan.db -ErrorAction SilentlyContinue
Remove-Item .\backend\uploads -Recurse -Force -ErrorAction SilentlyContinue
cd .\backend
npm run db:init
```

## 14. Troubleshooting

### `EADDRINUSE` when starting backend locally

Port `4000` is already occupied.

Options:

- stop the existing process
- or run on another port:

```powershell
$env:PORT=4001
npm run dev
```

### Frontend cannot reach backend

- ensure backend is running on `http://localhost:4000`
- keep frontend dev proxy target aligned with `vue.config.js` / `VUE_APP_DEV_API_TARGET`

### CORS blocked after deployment

- set exact domain(s) in `ALLOWED_ORIGINS`
- restart PM2 after env change

### Site returns API but not UI

- run `cd backend && npm run build`
- ensure `SERVE_FRONTEND=true`
- ensure `frontend/dist` exists on the server image

### Uploads disappear after restart

- local/VM: set `UPLOAD_ROOT` to a persistent path
- Render free plan: local uploads are ephemeral; use external storage if persistence is required

### Old published attachment names still look garbled

- restart the backend once after deploying the current code
- runtime compatibility in `backend/src/config/db.js` backfills legacy attachment names in `content_attachments`

### Member cannot access Class Matching but admin can

- you are likely running an old backend build
- redeploy the current `backend/src/app.js` route order so `/api/class-matching/*` is mounted before `/api/admin/*`

### `Invalid ... payload` errors after frontend changes

- hard refresh the browser (`Ctrl+F5`)
- verify frontend build is current
- compare the current request body with the Zod validation in the corresponding route file
## 15. Testing and Quality Status

Current repository-level checks:

- `frontend`: `npm run lint`
- `frontend`: `npm run build`
- `backend`: `npm run build`
- `backend`: `npm run test:smoke`
- `backend`: `npm run test:modules:light`
- `backend`: `npm run test:compat:backup`

Current automated smoke coverage includes the main integrated flows for:

- authentication and registration
- profile update and uploads
- member directory
- gallery management
- activity and announcement publishing with attachments
- piano scheduling generation / export / publish
- concert create/edit/release/delete and application flows
- class matching create/generate/manual/incremental/version/export flows

### 15.1 Light representative module validation

Use `backend/scripts/lightModuleValidation.mjs` when you want a smaller but still end-to-end check of the two highest-risk teaching-allocation modules:

- Piano Time:
  - member preference submission
  - admin draft generation
  - admin incremental update
  - admin manual reassignment
  - CSV export
  - publish
  - member published-result visibility
- Class Matching:
  - term creation
  - member profile extension submission
  - availability submission
  - ranking submission
  - teacher qualification approval
  - automatic generation
  - admin manual reassignment
  - CSV export
  - member result visibility

How it is executed:

1. log in as the local admin (`A0000000` / `Admin@123`)
2. create one uniquely labeled scheduling semester, one uniquely labeled class-matching term, and three uniquely labeled member accounts
3. drive both modules entirely through the real API surface
4. save request/state evidence to `test-artifacts/2026-04-05-light-module-validation/light-module-validation.state.json`
5. save exported CSV outputs to `test-artifacts/2026-04-05-light-module-validation/exports/`
6. if and only if validation passes, remove the exact runtime rows created by the run and verify the relevant table counts return to baseline

Re-run command:

```powershell
cd D:\Code\NJU\Linquan\linquan-website\backend
npm run test:modules:light
```

Setup and assumptions:

- local SQLite database is `D:\Code\NJU\Linquan\linquan-website\database\linquan.db`
- the local default admin account exists and still uses `A0000000` / `Admin@123`
- the script runs against the current local runtime database, not a temporary throwaway DB
- cleanup is exact-ID based and only targets the users / semester / class-matching term created by that run
- testing infrastructure and retained artifacts are preserved; only runtime data created by a successful run is deleted

### 15.2 Restored-Backup PostgreSQL Compatibility Validation

Use `backend/scripts/validateBackupCompatibility.mjs` when you need to verify that the current code can safely upgrade an existing production PostgreSQL database plus persistent uploads.

What it covers:

- public/admin read compatibility on restored legacy production data
- runtime schema compatibility updates on first boot
- fresh write compatibility for:
  - member registration and profile update
  - publishing with attachments
  - concert creation and concert application score upload
  - semester scheduling generation and publish
  - class matching term/profile/availability/ranking/direct/generation/export
  - soft member deactivation

How it is executed:

1. restore a safe copy of the production SQL dump into disposable PostgreSQL
2. point the backend at that restored DB and a copied `UPLOAD_ROOT`
3. start the backend
4. run:

```powershell
cd D:\Code\NJU\Linquan\linquan-website\backend
$env:COMPAT_BASE_URL='http://127.0.0.1:4310/api'
$env:COMPAT_ARTIFACT_ROOT='D:\Code\NJU\Linquan\linquan-website\test-artifacts\2026-04-06-db-compat-validation'
npm run test:compat:backup
```

Artifacts:

- request/state snapshot:
  - `test-artifacts/2026-04-06-db-compat-validation/api/compat-validation.state.json`
- downloaded evidence / CSV exports:
  - `test-artifacts/2026-04-06-db-compat-validation/exports/`

Assumptions:

- the restored database copy is disposable; the script intentionally creates new validation rows and does not delete them
- the original production database is never touched directly by this script
- if the upload backup is incomplete, the script records a warning for missing historical files instead of masking it

Known non-blocking warnings:

- frontend build still reports oversized static image assets in `frontend/public/photos/*`
- this affects bundle/performance warnings, not functional correctness

Recommended acceptance check before production update:

1. `npm run test:smoke`
2. `npm run build` in backend
3. `npm run lint && npm run build` in frontend
4. verify `/api/health`
5. verify one publish flow, one schedule flow, one concert flow, and one class-matching flow in the target environment

## 16. Photo and Upload Structure

### 16.1 Web icon and shared visual assets

Current website icon / brand image:

- `frontend/public/photos/club/林泉社徽.jpg`

Referenced by:

- `frontend/public/index.html`
- `frontend/src/App.vue`

Homepage and gallery-managed public photo folders:

- `frontend/public/photos/hero`
- `frontend/public/photos/club`
- `frontend/public/photos/events`
- `frontend/public/photos/concerts`

Homepage hero and curated static gallery content are controlled in:

- `frontend/src/content/photoManifest.js`

### 16.2 Runtime upload folders

All runtime uploads are rooted at `UPLOAD_ROOT`.

Current subfolders used by the backend:

- `avatars/` - member avatars and personal photos
- `activities/` - activity attachments
- `announcements/` - announcement attachments
- `concerts/` - admin concert attachments
- `scores/` - member concert score files
- `gallery/` - gallery images

### 16.3 Attachment behavior

- original filenames are preserved in database metadata
- download links use the stored original filename
- Chinese and special-character filenames are supported
- activity/announcement attachments can be added, replaced, and deleted from admin publishing pages

## 17. Current System Snapshot (2026-04)

As of the current codebase, the website includes these major additions and corrections compared with earlier iterations:

- Class Matching（琴课匹配）is fully integrated as a separate term-based module
- Piano scheduling includes a minimal `classMatchingPriority` flag that only affects the first fairness round
- Admin concert create/edit is unified into one reusable form, with registration overview under Concert Management
- Activities and announcements support multi-file attachments with correct UTF-8 filename handling
- Publish times are rendered consistently in Beijing time
- Admin member management is live
- Gallery management is live
- The old standalone review/audition management flow is no longer part of the current product scope

If you are reading older notes, commit messages, or screenshots that mention review/audition pages, treat those as historical only. The current system documented above is the source of truth.
