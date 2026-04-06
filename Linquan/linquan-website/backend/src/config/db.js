import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { DB_PATH, DATABASE_URL } from './env.js';
import createPostgresCompatDb from './postgresCompat.js';
import { normalizeUploadedOriginalName } from '../utils/uploadFilename.js';

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

function sqliteTableExists(db, table) {
  return Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)
  );
}

function ensureSqliteConcertApplicationsMultiEntry(db) {
  if (!sqliteTableExists(db, 'concert_applications')) {
    return;
  }

  const indexes = db.prepare('PRAGMA index_list(concert_applications)').all();
  const hasConcertUserUnique = indexes.some((indexRow) => {
    if (Number(indexRow.unique) !== 1) {
      return false;
    }
    const columns = db.prepare(`PRAGMA index_info(${indexRow.name})`).all();
    const columnNames = columns.map((item) => item.name);
    return columnNames.length === 2
      && columnNames[0] === 'concert_id'
      && columnNames[1] === 'user_id';
  });

  if (!hasConcertUserUnique) {
    return;
  }

  db.pragma('foreign_keys = OFF');
  try {
    const migrate = db.transaction(() => {
      db.exec('ALTER TABLE concert_applications RENAME TO concert_applications_old_multi');

      db.exec(`
        CREATE TABLE concert_applications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          concert_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          applicant_name TEXT,
          applicant_student_number TEXT,
          piece_zh TEXT,
          piece_en TEXT,
          duration_min INTEGER,
          contact_qq TEXT,
          piece_title TEXT NOT NULL,
          composer TEXT,
          score_file_path TEXT,
          note TEXT,
          status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'accepted', 'rejected', 'waitlist')),
          feedback TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      db.exec(`
        INSERT INTO concert_applications (
          id, concert_id, user_id, applicant_name, applicant_student_number,
          piece_zh, piece_en, duration_min, contact_qq, piece_title, composer,
          score_file_path, note, status, feedback, created_at, updated_at
        )
        SELECT
          id, concert_id, user_id, applicant_name, applicant_student_number,
          piece_zh, piece_en, duration_min, contact_qq, piece_title, composer,
          score_file_path, note, status, feedback, created_at, updated_at
        FROM concert_applications_old_multi
      `);

      db.exec('CREATE INDEX IF NOT EXISTS idx_concert_applications_concert ON concert_applications(concert_id)');
      db.exec(
        'CREATE INDEX IF NOT EXISTS idx_concert_applications_concert_user ON concert_applications(concert_id, user_id)'
      );

      db.exec('DROP TABLE concert_applications_old_multi');
    });

    migrate();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function dropLegacyReviewTablesSqlite(db) {
  // Preserve historical review/audition data on existing installations.
  // Current code no longer uses these tables, so they can remain in place.
}

function deriveAttachmentOriginalName(filePath) {
  const normalized = String(filePath || '').replaceAll('\\', '/');
  const fileName = normalized.split('/').pop() || 'attachment';
  return fileName;
}

function repairStoredAttachmentOriginalNames(db) {
  let rows = [];
  try {
    rows = db
      .prepare(
        `SELECT id, original_name AS originalName
         FROM content_attachments
         ORDER BY id ASC`
      )
      .all();
  } catch (err) {
    return;
  }
  if (!rows.length) {
    return;
  }

  const updateStmt = db.prepare(
    `UPDATE content_attachments
     SET original_name = ?
     WHERE id = ?`
  );

  const tx = db.transaction(() => {
    for (const row of rows) {
      const repairedName = normalizeUploadedOriginalName(row.originalName);
      if (repairedName && repairedName !== row.originalName) {
        updateStmt.run(repairedName, row.id);
      }
    }
  });

  tx();
}

function backfillLegacyAnnouncementAttachments(db) {
  if (!sqliteTableExists(db, 'announcements') || !sqliteTableExists(db, 'content_attachments')) {
    return;
  }

  const rows = db
    .prepare(
      `SELECT id, attachment_path AS attachmentPath
       FROM announcements
       WHERE attachment_path IS NOT NULL AND TRIM(attachment_path) != ''`
    )
    .all();

  const insertStmt = db.prepare(
    `INSERT INTO content_attachments (
       owner_type, owner_id, original_name, file_path, file_size, mime_type, created_by
     ) VALUES ('announcement', ?, ?, ?, 0, NULL, NULL)`
  );
  const existsStmt = db.prepare(
    `SELECT id
     FROM content_attachments
     WHERE owner_type = 'announcement' AND owner_id = ? AND file_path = ?`
  );

  const tx = db.transaction(() => {
    for (const row of rows) {
      if (existsStmt.get(row.id, row.attachmentPath)) {
        continue;
      }
      insertStmt.run(row.id, deriveAttachmentOriginalName(row.attachmentPath), row.attachmentPath);
    }
  });

  tx();
}

function backfillLegacyAnnouncementAttachmentsPostgres(db) {
  db.exec(`
    INSERT INTO content_attachments (
      owner_type, owner_id, original_name, file_path, file_size, mime_type, created_by
    )
    SELECT
      'announcement',
      a.id,
      REGEXP_REPLACE(a.attachment_path, '^.*/', ''),
      a.attachment_path,
      0,
      NULL,
      NULL
    FROM announcements a
    WHERE a.attachment_path IS NOT NULL
      AND BTRIM(a.attachment_path) <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM content_attachments ca
        WHERE ca.owner_type = 'announcement'
          AND ca.owner_id = a.id
          AND ca.file_path = a.attachment_path
      );
  `);
}

function ensureSqliteRuntimeSchema(db) {
  // Lightweight runtime migration for existing local databases.
  ensureColumn(db, 'users', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn(db, 'concerts', 'attachment_path', 'TEXT');
  ensureColumn(db, 'announcements', 'attachment_path', 'TEXT');
  ensureColumn(db, 'activities', 'published_at', 'TEXT');
  ensureColumn(db, 'announcements', 'published_at', 'TEXT');
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
    CREATE TABLE IF NOT EXISTS class_matching_terms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS class_matching_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term_id INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
      hour INTEGER NOT NULL CHECK (hour BETWEEN 8 AND 21),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (term_id) REFERENCES class_matching_terms(id) ON DELETE CASCADE,
      UNIQUE (term_id, day_of_week, hour)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS class_matching_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      participant_type TEXT NOT NULL CHECK (participant_type IN ('student', 'teacher')),
      matching_mode TEXT NOT NULL DEFAULT 'ranking' CHECK (matching_mode IN ('direct', 'ranking')),
      skill_level TEXT,
      learning_goals TEXT,
      budget_expectation TEXT,
      teaching_experience TEXT,
      skill_specialization TEXT,
      fee_expectation TEXT,
      capacity INTEGER,
      direct_target_user_id INTEGER,
      qualification_status TEXT NOT NULL DEFAULT 'pending' CHECK (qualification_status IN ('pending', 'approved', 'rejected')),
      qualification_feedback TEXT,
      reviewed_by INTEGER,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (term_id) REFERENCES class_matching_terms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (direct_target_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE (term_id, user_id)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS class_matching_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      slot_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (term_id) REFERENCES class_matching_terms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (slot_id) REFERENCES class_matching_slots(id) ON DELETE CASCADE,
      UNIQUE (term_id, user_id, slot_id)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS class_matching_rankings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      target_user_id INTEGER NOT NULL,
      rank_order INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (term_id) REFERENCES class_matching_terms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE (term_id, user_id, target_user_id),
      UNIQUE (term_id, user_id, rank_order)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS class_matching_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term_id INTEGER NOT NULL,
      version_number INTEGER NOT NULL,
      source_type TEXT NOT NULL CHECK (source_type IN ('algorithm', 'manual', 'incremental', 'restore')),
      change_summary TEXT,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      based_on_version_id INTEGER,
      is_current INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (term_id) REFERENCES class_matching_terms(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (based_on_version_id) REFERENCES class_matching_versions(id) ON DELETE SET NULL,
      UNIQUE (term_id, version_number)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS class_matching_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_id INTEGER NOT NULL,
      term_id INTEGER NOT NULL,
      student_user_id INTEGER NOT NULL,
      teacher_user_id INTEGER NOT NULL,
      match_type TEXT NOT NULL CHECK (match_type IN ('locked', 'algorithm', 'manual')),
      matching_score REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'matched',
      notes TEXT,
      admin_comment TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (version_id) REFERENCES class_matching_versions(id) ON DELETE CASCADE,
      FOREIGN KEY (term_id) REFERENCES class_matching_terms(id) ON DELETE CASCADE,
      FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE (version_id, student_user_id)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedule_user_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      semester_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      class_matching_priority INTEGER NOT NULL DEFAULT 0 CHECK (class_matching_priority IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE (semester_id, user_id)
    )
  `);
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
  db.exec(`
    CREATE TABLE IF NOT EXISTS content_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_type TEXT NOT NULL CHECK (owner_type IN ('activity', 'announcement')),
      owner_id INTEGER NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      mime_type TEXT,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_gallery_items_order ON gallery_items(display_order, id)');
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_content_attachments_owner ON content_attachments(owner_type, owner_id, created_at, id)'
  );
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_schedule_user_settings_semester_user ON schedule_user_settings(semester_id, user_id)'
  );
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_class_matching_profiles_term_type ON class_matching_profiles(term_id, participant_type, qualification_status)'
  );
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_class_matching_availability_term_user ON class_matching_availability(term_id, user_id, slot_id)'
  );
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_class_matching_rankings_term_user ON class_matching_rankings(term_id, user_id, rank_order)'
  );
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_class_matching_versions_term_current ON class_matching_versions(term_id, is_current, version_number DESC)'
  );
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_class_matching_matches_version_teacher ON class_matching_matches(version_id, teacher_user_id, student_user_id)'
  );
  if (sqliteTableExists(db, 'concert_applications')) {
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_concert_applications_concert_user ON concert_applications(concert_id, user_id)'
    );
  }
  ensureSqliteConcertApplicationsMultiEntry(db);
  backfillLegacyAnnouncementAttachments(db);
  repairStoredAttachmentOriginalNames(db);
}

function ensurePostgresRuntimeSchema(db) {
  db.exec(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE concerts ADD COLUMN IF NOT EXISTS attachment_path TEXT;
    ALTER TABLE announcements ADD COLUMN IF NOT EXISTS attachment_path TEXT;
    ALTER TABLE activities ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;
    ALTER TABLE announcements ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;
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
    ALTER TABLE concert_applications DROP CONSTRAINT IF EXISTS concert_applications_concert_id_user_id_key;
    DROP INDEX IF EXISTS idx_concert_applications_concert_user_unique;
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS class_matching_terms (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS class_matching_slots (
      id SERIAL PRIMARY KEY,
      term_id INTEGER NOT NULL REFERENCES class_matching_terms(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
      hour INTEGER NOT NULL CHECK (hour BETWEEN 8 AND 21),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (term_id, day_of_week, hour)
    );
    CREATE TABLE IF NOT EXISTS class_matching_profiles (
      id SERIAL PRIMARY KEY,
      term_id INTEGER NOT NULL REFERENCES class_matching_terms(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      participant_type TEXT NOT NULL CHECK (participant_type IN ('student', 'teacher')),
      matching_mode TEXT NOT NULL DEFAULT 'ranking' CHECK (matching_mode IN ('direct', 'ranking')),
      skill_level TEXT,
      learning_goals TEXT,
      budget_expectation TEXT,
      teaching_experience TEXT,
      skill_specialization TEXT,
      fee_expectation TEXT,
      capacity INTEGER,
      direct_target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      qualification_status TEXT NOT NULL DEFAULT 'pending' CHECK (qualification_status IN ('pending', 'approved', 'rejected')),
      qualification_feedback TEXT,
      reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (term_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS class_matching_availability (
      id SERIAL PRIMARY KEY,
      term_id INTEGER NOT NULL REFERENCES class_matching_terms(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      slot_id INTEGER NOT NULL REFERENCES class_matching_slots(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (term_id, user_id, slot_id)
    );
    CREATE TABLE IF NOT EXISTS class_matching_rankings (
      id SERIAL PRIMARY KEY,
      term_id INTEGER NOT NULL REFERENCES class_matching_terms(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rank_order INTEGER NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (term_id, user_id, target_user_id),
      UNIQUE (term_id, user_id, rank_order)
    );
    CREATE TABLE IF NOT EXISTS class_matching_versions (
      id SERIAL PRIMARY KEY,
      term_id INTEGER NOT NULL REFERENCES class_matching_terms(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      source_type TEXT NOT NULL CHECK (source_type IN ('algorithm', 'manual', 'incremental', 'restore')),
      change_summary TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      based_on_version_id INTEGER REFERENCES class_matching_versions(id) ON DELETE SET NULL,
      is_current INTEGER NOT NULL DEFAULT 0,
      UNIQUE (term_id, version_number)
    );
    CREATE TABLE IF NOT EXISTS class_matching_matches (
      id SERIAL PRIMARY KEY,
      version_id INTEGER NOT NULL REFERENCES class_matching_versions(id) ON DELETE CASCADE,
      term_id INTEGER NOT NULL REFERENCES class_matching_terms(id) ON DELETE CASCADE,
      student_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      teacher_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      match_type TEXT NOT NULL CHECK (match_type IN ('locked', 'algorithm', 'manual')),
      matching_score DOUBLE PRECISION NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'matched',
      notes TEXT,
      admin_comment TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (version_id, student_user_id)
    );
    CREATE TABLE IF NOT EXISTS schedule_user_settings (
      id SERIAL PRIMARY KEY,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      class_matching_priority INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (semester_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_schedule_user_settings_semester_user
      ON schedule_user_settings(semester_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_class_matching_profiles_term_type
      ON class_matching_profiles(term_id, participant_type, qualification_status);
    CREATE INDEX IF NOT EXISTS idx_class_matching_availability_term_user
      ON class_matching_availability(term_id, user_id, slot_id);
    CREATE INDEX IF NOT EXISTS idx_class_matching_rankings_term_user
      ON class_matching_rankings(term_id, user_id, rank_order);
    CREATE INDEX IF NOT EXISTS idx_class_matching_versions_term_current
      ON class_matching_versions(term_id, is_current, version_number DESC);
    CREATE INDEX IF NOT EXISTS idx_class_matching_matches_version_teacher
      ON class_matching_matches(version_id, teacher_user_id, student_user_id);
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
  db.exec(`
    CREATE TABLE IF NOT EXISTS content_attachments (
      id SERIAL PRIMARY KEY,
      owner_type TEXT NOT NULL,
      owner_id INTEGER NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      mime_type TEXT,
      created_by INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_content_attachments_owner
      ON content_attachments(owner_type, owner_id, created_at, id);
  `);
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_concert_applications_concert_user ON concert_applications(concert_id, user_id)'
  );
  backfillLegacyAnnouncementAttachmentsPostgres(db);
  repairStoredAttachmentOriginalNames(db);
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
