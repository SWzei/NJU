#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root."
  exit 1
fi

SERVER_NAME="${SERVER_NAME:-139.196.227.208}"
NODE_PORT="${NODE_PORT:-3000}"
PROJECT_SUBDIR="${PROJECT_SUBDIR:-Linquan/linquan-website}"
APP_ROOT="${APP_ROOT:-/var/www/linquan}"
REPO_DIR="${APP_ROOT}/repo"
PROJECT_DIR="${REPO_DIR}/${PROJECT_SUBDIR}"

TEMPLATE="${PROJECT_DIR}/deploy/aliyun/nginx-linquan.conf"
TARGET="/etc/nginx/sites-available/linquan"

if [[ ! -f "${TEMPLATE}" ]]; then
  echo "Nginx template not found: ${TEMPLATE}"
  exit 1
fi

sed \
  -e "s#__SERVER_NAME__#${SERVER_NAME}#g" \
  -e "s#__NODE_PORT__#${NODE_PORT}#g" \
  "${TEMPLATE}" > "${TARGET}"

ln -sfn /etc/nginx/sites-available/linquan /etc/nginx/sites-enabled/linquan
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

echo "Nginx configured."
echo "URL: http://${SERVER_NAME}"
