# NJU林泉钢琴社网站阿里云部署手册（Ubuntu 22.04）

本文对应以下基线：

- 云厂商：阿里云 ECS
- 系统：Ubuntu 22.04 LTS
- 规格：2 vCPU / 2 GB / 40GB ESSD
- 架构：`Nginx(80/443) -> Node.js(3000) -> PostgreSQL`

## 1. 服务器初始化

登录服务器：

```bash
ssh root@139.196.227.208
```

进入项目目录后执行：

```bash
cd /opt
git clone <YOUR_REPO_URL> linquan-deploy
cd /opt/linquan-deploy/Linquan/linquan-website
bash deploy/aliyun/01_init_server.sh
```

该脚本会完成：

- 系统更新
- 安装 Node.js 20 / npm / PM2
- 安装并启动 Nginx
- 配置 UFW（22/80/443/3000）
- 2GB swap（防止内存不足）

## 2. PostgreSQL 初始化

建议使用本机 PostgreSQL（稳定优先）：

```bash
cd /opt/linquan-deploy/Linquan/linquan-website
DB_NAME=linquan DB_USER=linquan_app DB_PASS='<STRONG_PASSWORD>' bash deploy/aliyun/02_setup_postgres.sh
```

执行完成后会输出 `DATABASE_URL`，用于后续 `.env`。

## 3. 应用部署

### 3.1 首次部署

```bash
cd /opt/linquan-deploy/Linquan/linquan-website
REPO_URL=<YOUR_REPO_URL> BRANCH=main PROJECT_SUBDIR=Linquan/linquan-website bash deploy/aliyun/03_deploy_app.sh
```

首次执行会自动创建 `backend/.env`（来自模板），然后提示你编辑。
脚本会自动把当前项目映射到你期望的目录结构：

- `/var/www/linquan/backend -> /var/www/linquan/repo/Linquan/linquan-website/backend`
- `/var/www/linquan/frontend -> /var/www/linquan/repo/Linquan/linquan-website/frontend`

### 3.2 编辑生产环境变量

编辑文件：

```bash
vim /var/www/linquan/repo/Linquan/linquan-website/backend/.env
```

最少要改这些键：

- `JWT_SECRET`
- `DATABASE_URL`（填 PostgreSQL URL）
- `ALLOWED_ORIGINS`（如 `https://linquanpiano.cn,https://www.linquanpiano.cn`）
- SMTP 相关（如你要发邮件）

推荐保持：

- `HOST=127.0.0.1`
- `PORT=3000`
- `SERVE_FRONTEND=true`
- `UPLOAD_ROOT=/var/www/linquan/uploads`

保存后再次部署：

```bash
cd /var/www/linquan/repo/Linquan/linquan-website
REPO_URL=<YOUR_REPO_URL> BRANCH=main PROJECT_SUBDIR=Linquan/linquan-website bash deploy/aliyun/03_deploy_app.sh
```

## 4. Nginx 反向代理

先按 IP 配置：

```bash
cd /opt/linquan-deploy/Linquan/linquan-website
SERVER_NAME=139.196.227.208 NODE_PORT=3000 PROJECT_SUBDIR=Linquan/linquan-website bash deploy/aliyun/04_setup_nginx.sh
```

检查：

```bash
nginx -t
systemctl status nginx --no-pager
curl http://127.0.0.1:3000/api/health
curl http://139.196.227.208/api/health
```

## 5. HTTPS（绑定域名后）

域名 A 记录指向 ECS 公网 IP，备案完成后执行：

```bash
cd /opt/linquan-deploy/Linquan/linquan-website
DOMAIN=linquanpiano.cn EMAIL=admin@linquanpiano.cn bash deploy/aliyun/05_enable_https.sh
```

## 6. 后续更新发布

```bash
cd /opt/linquan-deploy/Linquan/linquan-website
BRANCH=main PROJECT_SUBDIR=Linquan/linquan-website bash deploy/aliyun/06_update_app.sh
```

## 7. 运维常用命令

PM2：

```bash
pm2 status
pm2 logs linquan-backend
pm2 restart linquan-backend
pm2 save
```

Nginx：

```bash
nginx -t
systemctl reload nginx
systemctl status nginx --no-pager
```

PostgreSQL：

```bash
sudo -u postgres psql -c "\l"
sudo -u postgres psql -d linquan -c "\dt"
```

## 8. 安全建议

- 强制更换所有默认密码（系统/数据库/JWT）
- 禁止 root 密码远程登录，改为密钥登录
- 只开放 22/80/443（3000 建议内网或仅运维临时开放）
- 定期开启系统更新和磁盘快照
