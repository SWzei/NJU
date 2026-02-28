import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { z } from 'zod';
import db from '../config/db.js';
import { UPLOAD_ROOT } from '../config/env.js';
import { authenticate } from '../middleware/auth.js';
import HttpError from '../utils/httpError.js';

const router = express.Router();

const uploadRoot = path.resolve(process.cwd(), UPLOAD_ROOT);
const profileImageUploadDir = path.join(uploadRoot, 'avatars');
if (!fs.existsSync(profileImageUploadDir)) {
  fs.mkdirSync(profileImageUploadDir, { recursive: true });
}

function toPublicUploadPath(filePath) {
  const relativePath = path.relative(uploadRoot, filePath).replaceAll('\\', '/').replace(/^\/+/, '');
  return `/uploads/${relativePath}`;
}

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, profileImageUploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      cb(null, `profile-${req.user.id}-${Date.now()}${ext || '.bin'}`);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype?.startsWith('image/')) {
      return cb(null, true);
    }
    return cb(new HttpError(400, 'Profile image must be an image file'));
  }
});

function ensureProfileRow(userId) {
  const existing = db.prepare('SELECT user_id FROM profiles WHERE user_id = ?').get(userId);
  if (!existing) {
    db.prepare('INSERT INTO profiles (user_id) VALUES (?)').run(userId);
  }
}

const profileUpdateSchema = z.object({
  displayName: z.string().max(64).optional(),
  avatarUrl: z.string().max(512).optional().or(z.literal('')).transform((v) => (v === '' ? null : v)),
  photoUrl: z.string().max(512).optional().or(z.literal('')).transform((v) => (v === '' ? null : v)),
  bio: z.string().max(1000).optional(),
  grade: z.string().max(32).optional(),
  major: z.string().max(128).optional(),
  academy: z.string().max(128).optional(),
  hobbies: z.string().max(512).optional(),
  pianoInterests: z.string().max(512).optional(),
  wechatAccount: z.string().max(64).optional(),
  phone: z.string().max(32).optional()
});

router.get('/profiles', (req, res) => {
  const rows = db
    .prepare(
      `SELECT
         u.id,
         u.student_number AS "studentNumber",
         p.display_name AS "displayName",
         p.avatar_url AS "avatarUrl",
         p.photo_url AS "photoUrl",
         p.bio,
         p.grade,
         p.major,
         p.academy,
         p.hobbies,
         p.piano_interests AS "pianoInterests",
         p.wechat_account AS "wechatAccount"
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.role = 'member'
       ORDER BY u.id ASC`
    )
    .all();

  res.json({ items: rows });
});

router.get('/profiles/me', authenticate, (req, res) => {
  const row = db
    .prepare(
      `SELECT
         u.id,
         u.student_number AS "studentNumber",
         u.email,
         u.role,
         p.display_name AS "displayName",
         p.avatar_url AS "avatarUrl",
         p.photo_url AS "photoUrl",
         p.bio,
         p.grade,
         p.major,
         p.academy,
         p.hobbies,
         p.piano_interests AS "pianoInterests",
         p.wechat_account AS "wechatAccount",
         p.phone
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = ?`
    )
    .get(req.user.id);

  res.json(row || null);
});

router.get('/profiles/:userId(\\d+)', authenticate, (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new HttpError(400, 'Invalid userId');
    }

    const row = db
      .prepare(
        `SELECT
           u.id,
           u.student_number AS "studentNumber",
           p.display_name AS "displayName",
           p.avatar_url AS "avatarUrl",
           p.photo_url AS "photoUrl",
           p.bio,
           p.grade,
           p.major,
           p.academy,
           p.hobbies,
           p.piano_interests AS "pianoInterests",
           p.wechat_account AS "wechatAccount",
           p.phone,
           p.updated_at AS "updatedAt"
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE u.id = ? AND u.role = 'member'`
      )
      .get(userId);

    if (!row) {
      throw new HttpError(404, 'Member not found');
    }

    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.post('/profiles/me/avatar', authenticate, imageUpload.single('avatar'), (req, res, next) => {
  try {
    if (!req.file) {
      throw new HttpError(400, 'Avatar file is required');
    }

    ensureProfileRow(req.user.id);

    const avatarPath = toPublicUploadPath(req.file.path);
    db.prepare(
      `UPDATE profiles
       SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`
    ).run(avatarPath, req.user.id);

    res.status(201).json({ avatarUrl: avatarPath });
  } catch (err) {
    next(err);
  }
});

router.post('/profiles/me/photo', authenticate, imageUpload.single('photo'), (req, res, next) => {
  try {
    if (!req.file) {
      throw new HttpError(400, 'Photo file is required');
    }

    ensureProfileRow(req.user.id);

    const photoPath = toPublicUploadPath(req.file.path);
    db.prepare(
      `UPDATE profiles
       SET photo_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`
    ).run(photoPath, req.user.id);

    res.status(201).json({ photoUrl: photoPath });
  } catch (err) {
    next(err);
  }
});

router.put('/profiles/me', authenticate, (req, res, next) => {
  try {
    const input = profileUpdateSchema.parse(req.body);
    ensureProfileRow(req.user.id);

    const current = db
      .prepare(
        `SELECT
           display_name,
           avatar_url,
           photo_url,
           bio,
           grade,
           major,
           academy,
           hobbies,
           piano_interests,
           wechat_account,
           phone
         FROM profiles
         WHERE user_id = ?`
      )
      .get(req.user.id);

    const nextProfile = {
      displayName: Object.prototype.hasOwnProperty.call(input, 'displayName')
        ? input.displayName
        : current?.display_name || null,
      avatarUrl: Object.prototype.hasOwnProperty.call(input, 'avatarUrl')
        ? input.avatarUrl
        : current?.avatar_url || null,
      photoUrl: Object.prototype.hasOwnProperty.call(input, 'photoUrl')
        ? input.photoUrl
        : current?.photo_url || null,
      bio: Object.prototype.hasOwnProperty.call(input, 'bio')
        ? input.bio
        : current?.bio || null,
      grade: Object.prototype.hasOwnProperty.call(input, 'grade')
        ? input.grade
        : current?.grade || null,
      major: Object.prototype.hasOwnProperty.call(input, 'major')
        ? input.major
        : current?.major || null,
      academy: Object.prototype.hasOwnProperty.call(input, 'academy')
        ? input.academy
        : current?.academy || null,
      hobbies: Object.prototype.hasOwnProperty.call(input, 'hobbies')
        ? input.hobbies
        : current?.hobbies || null,
      pianoInterests: Object.prototype.hasOwnProperty.call(input, 'pianoInterests')
        ? input.pianoInterests
        : current?.piano_interests || null,
      wechatAccount: Object.prototype.hasOwnProperty.call(input, 'wechatAccount')
        ? input.wechatAccount
        : current?.wechat_account || null,
      phone: Object.prototype.hasOwnProperty.call(input, 'phone')
        ? input.phone
        : current?.phone || null
    };

    db.prepare(
      `UPDATE profiles
       SET
         display_name = ?,
         avatar_url = ?,
         photo_url = ?,
         bio = ?,
         grade = ?,
         major = ?,
         academy = ?,
         hobbies = ?,
         piano_interests = ?,
         wechat_account = ?,
         phone = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`
    ).run(
      nextProfile.displayName,
      nextProfile.avatarUrl,
      nextProfile.photoUrl,
      nextProfile.bio,
      nextProfile.grade,
      nextProfile.major,
      nextProfile.academy,
      nextProfile.hobbies,
      nextProfile.pianoInterests,
      nextProfile.wechatAccount,
      nextProfile.phone,
      req.user.id
    );

    const updated = db
      .prepare(
        `SELECT
           u.id,
           u.student_number AS "studentNumber",
           u.email,
           p.display_name AS "displayName",
           p.avatar_url AS "avatarUrl",
           p.photo_url AS "photoUrl",
           p.bio,
           p.grade,
           p.major,
           p.academy,
           p.hobbies,
           p.piano_interests AS "pianoInterests",
           p.wechat_account AS "wechatAccount",
           p.phone
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE u.id = ?`
      )
      .get(req.user.id);

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid profile payload', details: err.issues });
    }
    return next(err);
  }
});

export default router;
