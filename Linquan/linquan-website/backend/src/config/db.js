import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { DB_PATH } from './env.js';

function resolveDbPath(rawPath) {
  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }
  return path.resolve(process.cwd(), rawPath);
}

const dbPath = resolveDbPath(DB_PATH);
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

function ensureColumn(table, column, definition) {
  const tableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table);
  if (!tableExists) {
    return;
  }
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const hasColumn = columns.some((item) => item.name === column);
  if (!hasColumn) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// Lightweight runtime migration for existing local databases.
ensureColumn('concerts', 'attachment_path', 'TEXT');
ensureColumn('profiles', 'photo_url', 'TEXT');
ensureColumn('profiles', 'academy', 'TEXT');
ensureColumn('profiles', 'hobbies', 'TEXT');
ensureColumn('profiles', 'piano_interests', 'TEXT');
ensureColumn('profiles', 'wechat_account', 'TEXT');

export default db;
