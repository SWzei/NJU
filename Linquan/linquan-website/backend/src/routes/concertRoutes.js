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

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

const applicationSchema = z.object({
  pieceTitle: z.string().min(1).max(200),
  composer: z.string().max(200).optional().or(z.literal('')).transform((v) => v || null),
  note: z.string().max(1000).optional().or(z.literal('')).transform((v) => v || null)
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

      const input = applicationSchema.parse({
        pieceTitle: req.body.pieceTitle,
        composer: req.body.composer,
        note: req.body.note
      });
      const scorePath = req.file ? toStoredUploadPath(req.file.path) : null;

      const existing = db
        .prepare(
          'SELECT id FROM concert_applications WHERE concert_id = ? AND user_id = ?'
        )
        .get(concertId, req.user.id);

      if (existing) {
        db.prepare(
          `UPDATE concert_applications
           SET piece_title = ?, composer = ?, score_file_path = COALESCE(?, score_file_path),
               note = ?, status = 'submitted', feedback = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).run(input.pieceTitle, input.composer, scorePath, input.note, existing.id);
      } else {
        db.prepare(
          `INSERT INTO concert_applications
             (concert_id, user_id, piece_title, composer, score_file_path, note, status)
           VALUES (?, ?, ?, ?, ?, ?, 'submitted')`
        ).run(concertId, req.user.id, input.pieceTitle, input.composer, scorePath, input.note);
      }

      const application = db
        .prepare(
          `SELECT
             id,
             concert_id AS concertId,
             user_id AS userId,
             piece_title AS pieceTitle,
             composer,
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
           piece_title AS pieceTitle,
           composer,
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
           ca.piece_title AS pieceTitle,
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
             ca.piece_title AS pieceTitle,
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
           piece_title AS pieceTitle,
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
