import fs from 'fs';
import path from 'path';
import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import db from '../config/db.js';
import { UPLOAD_ROOT } from '../config/env.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import HttpError from '../utils/httpError.js';

const router = express.Router();

const uploadRoot = path.resolve(process.cwd(), UPLOAD_ROOT);
const uploadDir = path.join(uploadRoot, 'scores');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function sanitizeFileBase(rawName) {
  const originalName = String(rawName || '');
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
  const extFromName = path.extname(String(file?.originalname || '')).toLowerCase();
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
      const safeBase = sanitizeFileBase(file.originalname);
      const ext = resolveFileExtension(file);
      cb(null, `${safeBase}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

const applicationSchema = z.object({
  applicantName: z.string().min(1).max(80),
  applicantStudentNumber: z.string().min(3).max(32),
  pieceZh: z.string().min(1).max(240),
  pieceEn: z.string().min(1).max(320),
  durationMin: z.coerce.number().int().min(1).max(180),
  contactQq: z.string().min(4).max(32)
});

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
    .all();

  res.json({ items: rows });
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
      if (!['open', 'audition'].includes(concert.status)) {
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

      const input = applicationSchema.parse({
        applicantName: req.body.applicantName || currentUserInfo.displayName,
        applicantStudentNumber: req.body.applicantStudentNumber || currentUserInfo.studentNumber,
        pieceZh: req.body.pieceZh,
        pieceEn: req.body.pieceEn,
        durationMin: req.body.durationMin,
        contactQq: req.body.contactQq
      });
      if (input.applicantStudentNumber !== currentUserInfo.studentNumber) {
        throw new HttpError(400, 'Student number does not match current account');
      }
      const scorePath = req.file ? toStoredUploadPath(req.file.path) : null;

      const existing = db
        .prepare(
          'SELECT id FROM concert_applications WHERE concert_id = ? AND user_id = ?'
        )
        .get(concertId, req.user.id);

      if (existing) {
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
      } else {
        db.prepare(
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
           WHERE concert_id = ? AND user_id = ?`
        )
        .get(concertId, req.user.id);

      res.status(201).json({
        ...application,
        scoreFilePath: toPublicPath(application?.scoreFilePath)
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid application payload', details: err.issues });
      }
      return next(err);
    }
  }
);

router.get('/concerts/:concertId/my-application', authenticate, (req, res, next) => {
  try {
    const concertId = Number(req.params.concertId);
    if (!Number.isInteger(concertId) || concertId <= 0) {
      throw new HttpError(400, 'Invalid concertId');
    }

    const row = db
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
         WHERE concert_id = ? AND user_id = ?`
      )
      .get(concertId, req.user.id);

    if (!row) {
      return res.json({ item: null });
    }

    return res.json({
      item: {
        ...row,
        scoreFilePath: toPublicPath(row.scoreFilePath)
      }
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/concerts/:concertId/auditions', authenticate, (req, res, next) => {
  try {
    const concertId = Number(req.params.concertId);
    if (!Number.isInteger(concertId) || concertId <= 0) {
      throw new HttpError(400, 'Invalid concertId');
    }

    const rows = db
      .prepare(
        `SELECT
           aus.id,
           aus.start_time AS startTime,
           aus.end_time AS endTime,
           aus.location,
           ca.id AS applicationId,
           COALESCE(ca.piece_zh, ca.piece_title) AS pieceTitle,
            COALESCE(p.display_name, u.student_number) AS performerName
         FROM audition_slots aus
         LEFT JOIN concert_applications ca ON ca.id = aus.application_id
         LEFT JOIN users u ON u.id = ca.user_id
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE aus.concert_id = ?
         ORDER BY aus.start_time ASC`
      )
      .all(concertId);

    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/concerts/:concertId/results', authenticate, (req, res, next) => {
  try {
    const concertId = Number(req.params.concertId);
    if (!Number.isInteger(concertId) || concertId <= 0) {
      throw new HttpError(400, 'Invalid concertId');
    }

    if (req.user.role === 'admin') {
      const rows = db
        .prepare(
          `SELECT
             ca.id,
             ca.user_id AS userId,
             u.student_number AS studentNumber,
             COALESCE(p.display_name, u.student_number) AS displayName,
             ca.applicant_name AS applicantName,
             ca.applicant_student_number AS applicantStudentNumber,
             COALESCE(ca.piece_zh, ca.piece_title) AS pieceZh,
             COALESCE(ca.piece_en, ca.composer) AS pieceEn,
             ca.duration_min AS durationMin,
             ca.contact_qq AS contactQq,
             COALESCE(ca.piece_zh, ca.piece_title) AS pieceTitle,
             ca.status,
             ca.feedback,
             ca.updated_at AS updatedAt
           FROM concert_applications ca
           JOIN users u ON u.id = ca.user_id
           LEFT JOIN profiles p ON p.user_id = u.id
           WHERE ca.concert_id = ?
           ORDER BY ca.updated_at DESC`
        )
        .all(concertId);
      return res.json({ items: rows });
    }

    const row = db
      .prepare(
        `SELECT
           id,
           COALESCE(piece_zh, piece_title) AS pieceZh,
           COALESCE(piece_en, composer) AS pieceEn,
           duration_min AS durationMin,
           contact_qq AS contactQq,
           COALESCE(piece_zh, piece_title) AS pieceTitle,
           status,
           feedback,
           updated_at AS updatedAt
         FROM concert_applications
         WHERE concert_id = ? AND user_id = ?`
      )
      .get(concertId, req.user.id);

    return res.json({ item: row || null });
  } catch (err) {
    return next(err);
  }
});

export default router;
