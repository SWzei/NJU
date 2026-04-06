# Alibaba ECS Deployment Assets

This directory provides production deployment files for Ubuntu 22.04 on Alibaba ECS:

- `01_init_server.sh`: initialize system, install Node.js 20 LTS, PM2, Nginx, UFW.
- `02_setup_postgres.sh`: install PostgreSQL and create app database/user.
- `03_deploy_app.sh`: clone/pull repo, install/build app, start PM2.
- `04_setup_nginx.sh`: apply reverse proxy config to `127.0.0.1:3000`.
- `05_enable_https.sh`: configure Let's Encrypt with Certbot.
- `06_update_app.sh`: pull latest code and reload PM2.
- `nginx-linquan.conf`: Nginx site template.
- `.env.backend.aliyun.example`: backend production env template.

Runtime layout on server:

- code: `/var/www/linquan/repo/<PROJECT_SUBDIR>`
- backend link: `/var/www/linquan/backend`
- frontend link: `/var/www/linquan/frontend`

Run scripts as `root`.
