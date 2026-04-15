import fs from 'fs';
import path from 'path';
import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import db from '../config/db.js';
import { UPLOAD_ROOT } from '../config/env.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import HttpError from '../utils/httpError.js';
import { serializePublishingTimestamps } from '../utils/dateTime.js';
import { normalizeUploadedFileMeta, normalizeUploadedOriginalName } from '../utils/uploadFilename.js';

const router = express.Router();

const uploadRoot = path.resolve(process.cwd(), UPLOAD_ROOT);
const uploadDir = path.join(uploadRoot, 'scores');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function sanitizeFileBase(rawName) {
  const originalName = normalizeUploadedOriginalName(rawName);
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext).trim();
  const normalized = (base || 'score')
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '');
  const safe = normalized
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  return safe || 'score';
}

function resolveFileExtension(file) {
  const extFromName = path.extname(normalizeUploadedOriginalName(file?.originalname || '')).toLowerCase();
  if (extFromName) {
    return extFromName;
  }
  const mimeExtMap = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
  };
  return mimeExtMap[String(file?.mimetype || '').toLowerCase()] || '.bin';
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      normalizeUploadedFileMeta(file);
      const safeBase = sanitizeFileBase(file.originalname);
      const ext = resolveFileExtension(file);
      cb(null, `${safeBase}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

const trimmedString = (min, max) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.string().min(min).max(max)
  );

const applicationSchema = z.object({
  applicantName: trimmedString(1, 80).optional(),
  applicantStudentNumber: trimmedString(1, 32).optional(),
  pieceZh: trimmedString(1, 240).optional(),
  pieceEn: trimmedString(1, 320).optional(),
  durationMin: z.coerce.number().min(0).max(999).optional(),
  contactQq: trimmedString(1, 64).optional()
});

function firstValue(...values) {
  for (const item of values) {
    if (item === undefined || item === null) {
      continue;
    }
    const text = typeof item === 'string' ? item.trim() : item;
    if (text === '') {
      continue;
    }
    return text;
  }
  return undefined;
}

function normalizeDurationMin(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return Math.min(180, Math.max(1, Math.round(numeric)));
    }
  }
  return 5;
}

function normalizeContactQq(...values) {
  const selected = firstValue(...values);
  if (selected === undefined || selected === null) {
    return '0000';
  }
  const text = String(selected).trim();
  if (!text) {
    return '0000';
  }
  if (text.length >= 4) {
    return text.slice(0, 32);
  }
  return text.padEnd(4, '0');
}

function toPublicPath(rawPath) {
  if (!rawPath) {
    return null;
  }
  const normalized = String(rawPath).replaceAll('\\', '/').replace(/^\/+/, '');
  if (normalized.startsWith('uploads/')) {
    return `/${normalized}`;
  }
  if (normalized.startsWith('scores/')) {
    return `/uploads/${normalized}`;
  }
  return `/${normalized}`;
}

function toStoredUploadPath(filePath) {
  const relativePath = path.relative(uploadRoot, filePath).replaceAll('\\', '/').replace(/^\/+/, '');
  return `/uploads/${relativePath}`;
}

function resolveStoredUploadPath(rawPath) {
  if (!rawPath) {
    return null;
  }
  const normalized = String(rawPath).replaceAll('\\', '/');
  if (!normalized.startsWith('/uploads/')) {
    return null;
  }
  const relativePath = normalized.replace(/^\/+uploads\/+/, '');
  const absolutePath = path.resolve(uploadRoot, relativePath);
  const relativeToRoot = path.relative(uploadRoot, absolutePath);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    return null;
  }
  return absolutePath;
}

function removeStoredUploadFile(rawPath) {
  const filePath = resolveStoredUploadPath(rawPath);
  if (!filePath) {
    return;
  }
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function mapConcertApplication(item) {
  if (!item) {
    return null;
  }
  return serializePublishingTimestamps({
    ...item,
    scoreFilePath: toPublicPath(item.scoreFilePath)
  });
}

function loadUserConcertApplications(concertId, userId) {
  return db
    .prepare(
      `SELECT
         id,
         concert_id AS concertId,
         user_id AS userId,
         applicant_name AS applicantName,
         applicant_student_number AS applicantStudentNumber,
         COALESCE(piece_zh, piece_title) AS pieceZh,
         COALESCE(piece_en, composer) AS pieceEn,
         duration_min AS durationMin,
         contact_qq AS contactQq,
         COALESCE(piece_zh, piece_title) AS pieceTitle,
         COALESCE(piece_en, composer) AS composer,
         score_file_path AS scoreFilePath,
         note,
         status,
         feedback,
         audition_status AS auditionStatus,
         audition_feedback AS auditionFeedback,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM concert_applications
       WHERE concert_id = ? AND user_id = ?
       ORDER BY updated_at DESC, id DESC`
    )
    .all(concertId, userId)
    .map(mapConcertApplication);
}

router.get('/concerts', (req, res) => {
  const rows = db
    .prepare(
      `SELECT
         id,
         title,
         description,
         announcement,
         application_deadline AS applicationDeadline,
         status,
         attachment_path AS attachmentPath,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM concerts
       WHERE status != 'draft'
       ORDER BY created_at DESC, id DESC`
    )
    .all()
    .map((item) =>
      serializePublishingTimestamps({
        ...item,
        attachmentPath: toPublicPath(item.attachmentPath)
      })
    );

  res.json({ items: rows });
});

router.get('/concerts/:concertId/auditions', (req, res, next) => {
  try {
    const concertId = Number(req.params.concertId);
    if (!Number.isInteger(concertId) || concertId <= 0) {
      throw new HttpError(400, 'Invalid concertId');
    }

    const concert = db.prepare('SELECT id FROM concerts WHERE id = ?').get(concertId);
    if (!concert) {
      throw new HttpError(404, 'Concert not found');
    }

    const rows = db
      .prepare(
        `SELECT
           id,
           concert_id AS concertId,
           title,
           description,
           announcement,
           audition_time AS auditionTime,
           status,
           attachment_path AS attachmentPath,
           created_at AS createdAt,
           updated_at AS updatedAt
         FROM concert_auditions
         WHERE concert_id = ? AND status != 'draft'
         ORDER BY created_at DESC, id DESC`
      )
      .all(concertId)
      .map((item) =>
        serializePublishingTimestamps({
          ...item,
          attachmentPath: toPublicPath(item.attachmentPath)
        })
      );

    res.json({ items: rows });
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/concerts/:concertId/applications',
  authenticate,
  requireRole('member', 'admin'),
  upload.single('scoreFile'),
  (req, res, next) => {
    try {
      const concertId = Number(req.params.concertId);
      if (!Number.isInteger(concertId) || concertId <= 0) {
        throw new HttpError(400, 'Invalid concertId');
      }

      const concert = db.prepare('SELECT id, status FROM concerts WHERE id = ?').get(concertId);
      if (!concert) {
        throw new HttpError(404, 'Concert not found');
      }
      if (concert.status !== 'open') {
        throw new HttpError(400, 'Concert is not accepting applications');
      }

      const currentUserInfo = db
        .prepare(
          `SELECT
             u.student_number AS studentNumber,
             COALESCE(p.display_name, u.student_number) AS displayName
           FROM users u
           LEFT JOIN profiles p ON p.user_id = u.id
           WHERE u.id = ?`
        )
        .get(req.user.id);
      if (!currentUserInfo) {
        throw new HttpError(404, 'Current user not found');
      }

      const parsed = applicationSchema.parse({
        applicantName: firstValue(req.body.applicantName, req.body.displayName),
        applicantStudentNumber: firstValue(req.body.applicantStudentNumber, req.body.studentNumber),
        pieceZh: firstValue(req.body.pieceZh, req.body.pieceTitle),
        pieceEn: firstValue(req.body.pieceEn, req.body.composer),
        durationMin: firstValue(req.body.durationMin, req.body.duration, req.body.durationMinutes),
        contactQq: firstValue(req.body.contactQq, req.body.contact, req.body.qq)
      });
      const applicationIdRaw = firstValue(req.body.applicationId, req.body.id);
      const applicationId = applicationIdRaw === undefined ? null : Number(applicationIdRaw);
      if (applicationIdRaw !== undefined && (!Number.isInteger(applicationId) || applicationId <= 0)) {
        throw new HttpError(400, 'Invalid applicationId');
      }

      const input = {
        applicantName:
          firstValue(parsed.applicantName, currentUserInfo.displayName, currentUserInfo.studentNumber, 'member')
          || currentUserInfo.studentNumber,
        applicantStudentNumber:
          firstValue(parsed.applicantStudentNumber, currentUserInfo.studentNumber)
          || currentUserInfo.studentNumber,
        pieceZh:
          firstValue(parsed.pieceZh, parsed.pieceEn, req.body.pieceTitle, req.body.composer, '未命名曲目')
          || '未命名曲目',
        pieceEn:
          firstValue(parsed.pieceEn, parsed.pieceZh, req.body.composer, req.body.pieceTitle, 'N/A')
          || 'N/A',
        durationMin: normalizeDurationMin(
          parsed.durationMin,
          req.body.durationMin,
          req.body.duration,
          req.body.durationMinutes
        ),
        contactQq: normalizeContactQq(parsed.contactQq, req.body.contactQq, req.body.contact, req.body.qq)
      };

      if (input.applicantStudentNumber !== currentUserInfo.studentNumber) {
        throw new HttpError(400, 'Student number does not match current account');
      }

      const scorePath = req.file ? toStoredUploadPath(req.file.path) : null;
      let targetApplicationId = null;
      let previousScoreFilePath = null;

      if (applicationId) {
        const existing = db
          .prepare(
            `SELECT
               id,
               user_id AS userId,
               score_file_path AS scoreFilePath
             FROM concert_applications
             WHERE id = ? AND concert_id = ?`
          )
          .get(applicationId, concertId);
        if (!existing) {
          throw new HttpError(404, 'Concert application not found');
        }
        if (existing.userId !== req.user.id) {
          throw new HttpError(403, 'You can only update your own applications');
        }

        db.prepare(
          `UPDATE concert_applications
           SET
             applicant_name = ?,
             applicant_student_number = ?,
             piece_zh = ?,
             piece_en = ?,
             duration_min = ?,
             contact_qq = ?,
             piece_title = ?,
             composer = ?,
             score_file_path = COALESCE(?, score_file_path),
             note = NULL,
             status = 'submitted',
             feedback = NULL,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).run(
          input.applicantName,
          input.applicantStudentNumber,
          input.pieceZh,
          input.pieceEn,
          input.durationMin,
          input.contactQq,
          input.pieceZh,
          input.pieceEn,
          scorePath,
          existing.id
        );
        targetApplicationId = existing.id;
        previousScoreFilePath = existing.scoreFilePath;
      } else {
        const insertResult = db.prepare(
          `INSERT INTO concert_applications
             (
               concert_id, user_id, applicant_name, applicant_student_number, piece_zh, piece_en,
               duration_min, contact_qq, piece_title, composer, score_file_path, note, status
             )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'submitted')`
        ).run(
          concertId,
          req.user.id,
          input.applicantName,
          input.applicantStudentNumber,
          input.pieceZh,
          input.pieceEn,
          input.durationMin,
          input.contactQq,
          input.pieceZh,
          input.pieceEn,
          scorePath
        );
        targetApplicationId = Number(insertResult.lastInsertRowid);
      }

      if (scorePath && previousScoreFilePath && previousScoreFilePath !== scorePath) {
        try {
          removeStoredUploadFile(previousScoreFilePath);
        } catch (fileErr) {
          console.warn('Failed to delete replaced score file:', fileErr);
        }
      }

      const application = db
        .prepare(
          `SELECT
             id,
             concert_id AS concertId,
             user_id AS userId,
             applicant_name AS applicantName,
             applicant_student_number AS applicantStudentNumber,
             COALESCE(piece_zh, piece_title) AS pieceZh,
             COALESCE(piece_en, composer) AS pieceEn,
             duration_min AS durationMin,
             contact_qq AS contactQq,
             COALESCE(piece_zh, piece_title) AS pieceTitle,
             COALESCE(piece_en, composer) AS composer,
             score_file_path AS scoreFilePath,
             note,
             status,
             feedback,
             created_at AS createdAt,
             updated_at AS updatedAt
           FROM concert_applications
           WHERE id = ?`
        )
        .get(targetApplicationId);

      res.status(applicationId ? 200 : 201).json(mapConcertApplication(application));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid application payload', details: err.issues });
      }
      return next(err);
    }
  }
);

router.get('/concerts/:concertId/my-applications', authenticate, (req, res, next) => {
  try {
    const concertId = Number(req.params.concertId);
    if (!Number.isInteger(concertId) || concertId <= 0) {
      throw new HttpError(400, 'Invalid concertId');
    }

    const items = loadUserConcertApplications(concertId, req.user.id);
    return res.json({ items });
  } catch (err) {
    return next(err);
  }
});

router.get('/concerts/:concertId/my-application', authenticate, (req, res, next) => {
  try {
    const concertId = Number(req.params.concertId);
    if (!Number.isInteger(concertId) || concertId <= 0) {
      throw new HttpError(400, 'Invalid concertId');
    }

    const items = loadUserConcertApplications(concertId, req.user.id);
    return res.json({ item: items[0] || null });
  } catch (err) {
    return next(err);
  }
});

router.delete(
  '/concerts/:concertId/applications/:applicationId',
  authenticate,
  requireRole('member', 'admin'),
  (req, res, next) => {
    try {
      const concertId = Number(req.params.concertId);
      const applicationId = Number(req.params.applicationId);
      if (!Number.isInteger(concertId) || concertId <= 0) {
        throw new HttpError(400, 'Invalid concertId');
      }
      if (!Number.isInteger(applicationId) || applicationId <= 0) {
        throw new HttpError(400, 'Invalid applicationId');
      }

      const application = db
        .prepare(
          `SELECT
             id,
             user_id AS userId,
             score_file_path AS scoreFilePath
           FROM concert_applications
           WHERE id = ? AND concert_id = ?`
        )
        .get(applicationId, concertId);
      if (!application) {
        throw new HttpError(404, 'Concert application not found');
      }
      if (req.user.role !== 'admin' && application.userId !== req.user.id) {
        throw new HttpError(403, 'You can only delete your own applications');
      }

      db.prepare('DELETE FROM concert_applications WHERE id = ?').run(applicationId);

      try {
        removeStoredUploadFile(application.scoreFilePath);
      } catch (fileErr) {
        console.warn('Failed to delete application score file:', fileErr);
      }

      return res.json({
        message: 'Concert application deleted',
        concertId,
        applicationId
      });
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
