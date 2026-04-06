#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root."
  exit 1
fi

DB_NAME="${DB_NAME:-linquan}"
DB_USER="${DB_USER:-linquan_app}"
DB_PASS="${DB_PASS:-ChangeThisStrongPassword!}"
ESCAPED_DB_PASS="${DB_PASS//\'/\'\'}"

export DEBIAN_FRONTEND=noninteractive

echo "[1/3] Installing PostgreSQL..."
apt update
apt install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

echo "[2/3] Creating database and user..."
ROLE_EXISTS="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")"
if [[ "${ROLE_EXISTS}" != "1" ]]; then
  sudo -u postgres psql -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${ESCAPED_DB_PASS}';"
else
  sudo -u postgres psql -c "ALTER ROLE ${DB_USER} WITH PASSWORD '${ESCAPED_DB_PASS}';"
fi

DB_EXISTS="$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")"
if [[ "${DB_EXISTS}" != "1" ]]; then
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
fi

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

echo "[3/3] PostgreSQL ready."
echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}?sslmode=disable"
