import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { DB_PATH, DATABASE_URL } from './env.js';
import createPostgresCompatDb from './postgresCompat.js';

function resolveDbPath(rawPath) {
  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }
  return path.resolve(process.cwd(), rawPath);
}

const defaultGalleryItems = [
  {
    src: '/photos/club/room-324.jpg',
    fallback: 'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=1400&q=80',
    titleZh: '琴房日常 A',
    titleEn: 'Practice Room A',
    descriptionZh: '大活 324 琴房的练习时段记录。',
    descriptionEn: 'Daily practice snapshots from Room 324.',
    altZh: '324 琴房练习照片',
    altEn: 'Practice photo in Room 324'
  },
  {
    src: '/photos/club/room-325.jpg',
    fallback: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?auto=format&fit=crop&w=1400&q=80',
    titleZh: '琴房日常 B',
    titleEn: 'Practice Room B',
    descriptionZh: '大活 325 琴房的练习与交流。',
    descriptionEn: 'Practice and communication in Room 325.',
    altZh: '325 琴房练习照片',
    altEn: 'Practice photo in Room 325'
  },
  {
    src: '/photos/events/rehearsal.jpg',
    fallback: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1400&q=80',
    titleZh: '节目排练',
    titleEn: 'Concert Rehearsal',
    descriptionZh: '音乐会前的分段排练与联排。',
    descriptionEn: 'Section rehearsal and full run before performances.',
    altZh: '音乐会排练照片',
    altEn: 'Concert rehearsal photo'
  },
  {
    src: '/photos/events/workshop.jpg',
    fallback: 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?auto=format&fit=crop&w=1400&q=80',
    titleZh: '主题活动',
    titleEn: 'Club Workshop',
    descriptionZh: '讲座、分享会与社团教学活动。',
    descriptionEn: 'Lectures, sharing sessions, and training activities.',
    altZh: '钢琴社活动照片',
    altEn: 'Piano club workshop photo'
  },
  {
    src: '/photos/concerts/stage.jpg',
    fallback: 'https://images.unsplash.com/photo-1464375117522-1311d6a5b81f?auto=format&fit=crop&w=1400&q=80',
    titleZh: '舞台现场',
    titleEn: 'On Stage',
    descriptionZh: '正式演出时的舞台氛围与灯光。',
    descriptionEn: 'Stage atmosphere and performance lighting.',
    altZh: '钢琴演出舞台照片',
    altEn: 'Piano stage performance photo'
  },
  {
    src: '/photos/concerts/group-photo.jpg',
    fallback: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=1400&q=80',
    titleZh: '社员合影',
    titleEn: 'Group Photo',
    descriptionZh: '活动结束后的社员纪念合影。',
    descriptionEn: 'Member group photo after event completion.',
    altZh: '社员合影照片',
    altEn: 'Club member group photo'
  }
];

function ensureColumn(db, table, column, definition) {
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

function ensureSqliteRuntimeSchema(db) {
  // Lightweight runtime migration for existing local databases.
  ensureColumn(db, 'concerts', 'attachment_path', 'TEXT');
  ensureColumn(db, 'profiles', 'photo_url', 'TEXT');
  ensureColumn(db, 'profiles', 'academy', 'TEXT');
  ensureColumn(db, 'profiles', 'hobbies', 'TEXT');
  ensureColumn(db, 'profiles', 'piano_interests', 'TEXT');
  ensureColumn(db, 'profiles', 'wechat_account', 'TEXT');
  ensureColumn(db, 'concert_applications', 'applicant_name', 'TEXT');
  ensureColumn(db, 'concert_applications', 'applicant_student_number', 'TEXT');
  ensureColumn(db, 'concert_applications', 'piece_zh', 'TEXT');
  ensureColumn(db, 'concert_applications', 'piece_en', 'TEXT');
  ensureColumn(db, 'concert_applications', 'duration_min', 'INTEGER');
  ensureColumn(db, 'concert_applications', 'contact_qq', 'TEXT');

  db.exec(`
    CREATE TABLE IF NOT EXISTS schedule_operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      semester_id INTEGER,
      operation_type TEXT NOT NULL,
      payload_json TEXT,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES schedule_batches(id) ON DELETE SET NULL,
      FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_schedule_operation_logs_batch_time ON schedule_operation_logs(batch_id, created_at DESC, id DESC)'
  );

  db.exec(`
    CREATE TABLE IF NOT EXISTS gallery_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      src TEXT NOT NULL,
      fallback TEXT,
      title_zh TEXT NOT NULL,
      title_en TEXT NOT NULL,
      description_zh TEXT,
      description_en TEXT,
      alt_zh TEXT,
      alt_en TEXT,
      is_visible INTEGER NOT NULL DEFAULT 1 CHECK (is_visible IN (0, 1)),
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_gallery_items_order ON gallery_items(display_order, id)');
}

function ensurePostgresRuntimeSchema(db) {
  db.exec(`
    ALTER TABLE concerts ADD COLUMN IF NOT EXISTS attachment_path TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS academy TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hobbies TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS piano_interests TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wechat_account TEXT;
    ALTER TABLE concert_applications ADD COLUMN IF NOT EXISTS applicant_name TEXT;
    ALTER TABLE concert_applications ADD COLUMN IF NOT EXISTS applicant_student_number TEXT;
    ALTER TABLE concert_applications ADD COLUMN IF NOT EXISTS piece_zh TEXT;
    ALTER TABLE concert_applications ADD COLUMN IF NOT EXISTS piece_en TEXT;
    ALTER TABLE concert_applications ADD COLUMN IF NOT EXISTS duration_min INTEGER;
    ALTER TABLE concert_applications ADD COLUMN IF NOT EXISTS contact_qq TEXT;
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS schedule_operation_logs (
      id SERIAL PRIMARY KEY,
      batch_id INTEGER,
      semester_id INTEGER,
      operation_type TEXT NOT NULL,
      payload_json TEXT,
      created_by INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_schedule_operation_logs_batch_time
      ON schedule_operation_logs(batch_id, created_at DESC, id DESC);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS gallery_items (
      id SERIAL PRIMARY KEY,
      src TEXT NOT NULL,
      fallback TEXT,
      title_zh TEXT NOT NULL,
      title_en TEXT NOT NULL,
      description_zh TEXT,
      description_en TEXT,
      alt_zh TEXT,
      alt_en TEXT,
      is_visible INTEGER NOT NULL DEFAULT 1,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_gallery_items_order ON gallery_items(display_order, id);
  `);
}

function seedGalleryIfEmpty(db) {
  const galleryCount = db.prepare('SELECT COUNT(*) AS count FROM gallery_items').get()?.count || 0;
  if (Number(galleryCount) > 0) {
    return;
  }

  const insertGalleryItem = db.prepare(
    `INSERT INTO gallery_items (
      src, fallback, title_zh, title_en, description_zh, description_en, alt_zh, alt_en, is_visible, display_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  );

  const tx = db.transaction(() => {
    defaultGalleryItems.forEach((item, index) => {
      insertGalleryItem.run(
        item.src,
        item.fallback,
        item.titleZh,
        item.titleEn,
        item.descriptionZh,
        item.descriptionEn,
        item.altZh,
        item.altEn,
        index
      );
    });
  });

  tx();
}

function createSqliteDb() {
  const dbPath = resolveDbPath(DB_PATH);
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('journal_mode = WAL');

  ensureSqliteRuntimeSchema(sqlite);
  seedGalleryIfEmpty(sqlite);
  return sqlite;
}

function createDb() {
  if (DATABASE_URL) {
    const pgDb = createPostgresCompatDb(DATABASE_URL);
    // eslint-disable-next-line no-console
    console.log('Using Postgres database (DATABASE_URL detected).');

    try {
      ensurePostgresRuntimeSchema(pgDb);
      seedGalleryIfEmpty(pgDb);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Postgres runtime migration skipped:', err.message);
    }

    return pgDb;
  }

  return createSqliteDb();
}

const db = createDb();

export default db;
