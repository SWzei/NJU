PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_number TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  photo_url TEXT,
  bio TEXT,
  grade TEXT,
  major TEXT,
  academy TEXT,
  hobbies TEXT,
  piano_interests TEXT,
  wechat_account TEXT,
  phone TEXT,
  campus TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  event_time TEXT,
  location TEXT,
  created_by INTEGER,
  is_published INTEGER NOT NULL DEFAULT 1,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  attachment_path TEXT,
  created_by INTEGER,
  is_published INTEGER NOT NULL DEFAULT 1,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS semesters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS class_matching_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS class_matching_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term_id INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour INTEGER NOT NULL CHECK (hour BETWEEN 8 AND 21),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (term_id) REFERENCES class_matching_terms(id) ON DELETE CASCADE,
  UNIQUE (term_id, day_of_week, hour)
);

CREATE TABLE IF NOT EXISTS class_matching_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  participant_type TEXT NOT NULL CHECK (participant_type IN ('student', 'teacher')),
  matching_mode TEXT NOT NULL DEFAULT 'ranking' CHECK (matching_mode IN ('direct', 'ranking')),
  campus TEXT,
  skill_level TEXT,
  learning_goals TEXT,
  budget_expectation TEXT,
  budget_min INTEGER,
  budget_max INTEGER,
  teaching_experience TEXT,
  skill_specialization TEXT,
  fee_expectation TEXT,
  fee_min INTEGER,
  fee_max INTEGER,
  capacity INTEGER,
  direct_target_user_id INTEGER,
  student_skill_level INTEGER,
  teacher_skill_min INTEGER,
  teacher_skill_max INTEGER,
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
);

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
);

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
);

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
);

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
);

CREATE TABLE IF NOT EXISTS room_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  semester_id INTEGER NOT NULL,
  room_no INTEGER NOT NULL CHECK (room_no IN (1, 2)),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour INTEGER NOT NULL CHECK (hour BETWEEN 8 AND 21),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE,
  UNIQUE (semester_id, room_no, day_of_week, hour)
);

CREATE TABLE IF NOT EXISTS slot_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  semester_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  slot_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (slot_id) REFERENCES room_slots(id) ON DELETE CASCADE,
  UNIQUE (semester_id, user_id, slot_id)
);

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
);

CREATE TABLE IF NOT EXISTS schedule_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  semester_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'published')),
  created_by INTEGER,
  published_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT,
  note TEXT,
  FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (published_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS schedule_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  semester_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  slot_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'published')),
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES schedule_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (slot_id) REFERENCES room_slots(id) ON DELETE CASCADE,
  UNIQUE (batch_id, user_id, slot_id)
);

CREATE TABLE IF NOT EXISTS concerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  announcement TEXT,
  application_deadline TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
  attachment_path TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS concert_applications (
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
  audition_status TEXT CHECK (audition_status IN ('pending', 'passed', 'failed')),
  audition_feedback TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS concert_auditions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  concert_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  announcement TEXT,
  audition_time TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
  attachment_path TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (concert_id) REFERENCES concerts(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_concert_auditions_concert ON concert_auditions(concert_id, status, created_at DESC);

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
);

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

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'system')),
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  related_type TEXT,
  related_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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
);

CREATE INDEX IF NOT EXISTS idx_slot_preferences_semester_slot ON slot_preferences(semester_id, slot_id);
CREATE INDEX IF NOT EXISTS idx_slot_preferences_semester_user ON slot_preferences(semester_id, user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_user_settings_semester_user ON schedule_user_settings(semester_id, user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_semester_user ON schedule_assignments(semester_id, user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_semester_slot ON schedule_assignments(semester_id, slot_id);
CREATE INDEX IF NOT EXISTS idx_class_matching_profiles_term_type ON class_matching_profiles(term_id, participant_type, qualification_status);
CREATE INDEX IF NOT EXISTS idx_class_matching_availability_term_user ON class_matching_availability(term_id, user_id, slot_id);
CREATE INDEX IF NOT EXISTS idx_class_matching_rankings_term_user ON class_matching_rankings(term_id, user_id, rank_order);
CREATE INDEX IF NOT EXISTS idx_class_matching_versions_term_current ON class_matching_versions(term_id, is_current, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_class_matching_matches_version_teacher ON class_matching_matches(version_id, teacher_user_id, student_user_id);
CREATE INDEX IF NOT EXISTS idx_concert_applications_concert ON concert_applications(concert_id);
CREATE INDEX IF NOT EXISTS idx_concert_applications_concert_user ON concert_applications(concert_id, user_id);
CREATE INDEX IF NOT EXISTS idx_content_attachments_owner ON content_attachments(owner_type, owner_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_schedule_operation_logs_batch_time ON schedule_operation_logs(batch_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_items_order ON gallery_items(display_order, id);
