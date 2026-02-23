import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const candidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env')
];

const envFile = candidates.find((file) => fs.existsSync(file));
dotenv.config(envFile ? { path: envFile } : undefined);

export const PORT = Number(process.env.PORT || 4000);
export const HOST = process.env.HOST || '0.0.0.0';
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this';
export const DB_PATH = process.env.DB_PATH || '../database/linquan.db';
export const UPLOAD_ROOT = process.env.UPLOAD_ROOT || 'uploads';
export const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '';
export const SERVE_FRONTEND = String(process.env.SERVE_FRONTEND || 'true').toLowerCase() === 'true';

export const SMTP_HOST = process.env.SMTP_HOST || '';
export const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
export const SMTP_USER = process.env.SMTP_USER || '';
export const SMTP_PASS = process.env.SMTP_PASS || '';
export const SMTP_FROM = process.env.SMTP_FROM || 'NJU林泉钢琴社 <no-reply@example.com>';
