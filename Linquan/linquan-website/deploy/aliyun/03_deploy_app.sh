#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root."
  exit 1
fi

REPO_URL="${REPO_URL:-}"
BRANCH="${BRANCH:-main}"
APP_ROOT="${APP_ROOT:-/var/www/linquan}"
REPO_DIR="${APP_ROOT}/repo"
PROJECT_SUBDIR="${PROJECT_SUBDIR:-Linquan/linquan-website}"
PROJECT_DIR="${REPO_DIR}/${PROJECT_SUBDIR}"

if [[ -z "${REPO_URL}" ]]; then
  echo "REPO_URL is required. Example:"
  echo "REPO_URL=https://github.com/<your-user>/NJU.git bash deploy/aliyun/03_deploy_app.sh"
  exit 1
fi

mkdir -p "${APP_ROOT}"

if [[ ! -d "${REPO_DIR}/.git" ]]; then
  echo "[1/7] Cloning repository..."
  git clone "${REPO_URL}" "${REPO_DIR}"
else
  echo "[1/7] Updating repository..."
  git -C "${REPO_DIR}" fetch --all --prune
fi

echo "[2/7] Checkout target branch..."
git -C "${REPO_DIR}" checkout "${BRANCH}"
git -C "${REPO_DIR}" pull --ff-only origin "${BRANCH}"

if [[ ! -d "${PROJECT_DIR}/backend" ]]; then
  echo "Backend directory not found: ${PROJECT_DIR}/backend"
  echo "Please check PROJECT_SUBDIR."
  exit 1
fi

mkdir -p "${APP_ROOT}"
ln -sfn "${PROJECT_DIR}/backend" "${APP_ROOT}/backend"
ln -sfn "${PROJECT_DIR}/frontend" "${APP_ROOT}/frontend"

echo "[3/7] Installing backend dependencies..."
cd "${PROJECT_DIR}/backend"
npm install

echo "[4/7] Building frontend (through backend build script)..."
npm run build

if [[ ! -f "${PROJECT_DIR}/backend/.env" ]]; then
  echo "[5/7] Creating backend .env from aliyun template..."
  cp "${PROJECT_DIR}/deploy/aliyun/.env.backend.aliyun.example" "${PROJECT_DIR}/backend/.env"
  echo "Please edit ${PROJECT_DIR}/backend/.env and rerun this script."
  exit 1
fi

if grep -Eq 'replace-with|ChangeThis|<your-|example.com' "${PROJECT_DIR}/backend/.env"; then
  echo "Found placeholder values in backend/.env. Please edit before deploy."
  exit 1
fi

echo "[6/7] Starting app with PM2..."
cd "${PROJECT_DIR}/backend"
pm2 start ecosystem.config.cjs --env production --update-env
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null || true

echo "[7/7] Deployment complete."
pm2 status
echo "Health check: curl http://127.0.0.1:3000/api/health"
