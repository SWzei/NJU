#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root."
  exit 1
fi

APP_ROOT="${APP_ROOT:-/var/www/linquan}"
REPO_DIR="${APP_ROOT}/repo"
PROJECT_SUBDIR="${PROJECT_SUBDIR:-Linquan/linquan-website}"
PROJECT_DIR="${REPO_DIR}/${PROJECT_SUBDIR}"
BRANCH="${BRANCH:-main}"

if [[ ! -d "${REPO_DIR}/.git" ]]; then
  echo "Repository not found: ${REPO_DIR}"
  exit 1
fi

echo "[1/5] Pulling latest code..."
git -C "${REPO_DIR}" fetch --all --prune
git -C "${REPO_DIR}" checkout "${BRANCH}"
git -C "${REPO_DIR}" pull --ff-only origin "${BRANCH}"

echo "[2/5] Installing backend dependencies..."
cd "${PROJECT_DIR}/backend"
npm install

echo "[3/5] Building frontend..."
npm run build

echo "[4/5] Reloading PM2..."
pm2 reload ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs --env production --update-env
pm2 save

echo "[5/5] Done."
curl -fsS http://127.0.0.1:3000/api/health && echo
