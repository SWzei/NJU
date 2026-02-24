import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { z } from 'zod';
import db from '../config/db.js';
import { UPLOAD_ROOT } from '../config/env.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import HttpError from '../utils/httpError.js';
import { createStandardSlots, resolveSemesterId } from '../utils/semester.js';
import {
  generateProposedSchedule,
  publishScheduleBatch
} from '../services/schedulerService.js';
import { notifyUsers } from '../services/notificationService.js';

const router = express.Router();

const uploadRoot = path.resolve(process.cwd(), UPLOAD_ROOT);
const concertUploadDir = path.join(uploadRoot, 'concerts');
if (!fs.existsSync(concertUploadDir)) {
  fs.mkdirSync(concertUploadDir, { recursive: true });
}
const galleryUploadDir = path.join(uploadRoot, 'gallery');
if (!fs.existsSync(galleryUploadDir)) {
  fs.mkdirSync(galleryUploadDir, { recursive: true });
}

const concertUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, concertUploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      cb(null, `concert-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext || '.bin'}`);
    }
  }),
  limits: {
    fileSize: 20 * 1024 * 1024
  }
});

const galleryUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, galleryUploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      cb(null, `gallery-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext || '.bin'}`);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype?.startsWith('image/')) {
      return cb(null, true);
    }
    return cb(new HttpError(400, 'Gallery file must be an image'));
  }
});

function optionalString(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  const text = String(value).trim();
  return text.length ? text : null;
}

function optionalBoolean(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const text = String(value).toLowerCase().trim();
  if (text === 'true' || text === '1') {
    return true;
  }
  if (text === 'false' || text === '0') {
    return false;
  }
  return undefined;
}

function toPublicPath(rawPath) {
  if (!rawPath) {
    return null;
  }
  const normalized = String(rawPath).replaceAll('\\', '/').replace(/^\/+/, '');
  if (normalized.startsWith('uploads/')) {
    return `/${normalized}`;
  }
  if (normalized.startsWith('concerts/')) {
    return `/uploads/${normalized}`;
  }
  return `/${normalized}`;
}

function toStoredUploadPath(filePath) {
  const relativePath = path.relative(uploadRoot, filePath).replaceAll('\\', '/').replace(/^\/+/, '');
  return `/uploads/${relativePath}`;
}

function mapGalleryRow(item) {
  return {
    ...item,
    isVisible: Boolean(item.isVisible)
  };
}

const semesterSchema = z.object({
  name: z.string().min(2).max(80),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activate: z.boolean().default(true)
});

const publishContentSchema = z.object({
  title: z.string().min(2).max(150),
  content: z.string().min(2).max(5000),
  eventTime: z.string().optional(),
  location: z.string().max(256).optional()
});

const updateActivitySchema = z.object({
  title: z.string().min(2).max(150).optional(),
  content: z.string().min(2).max(5000).optional(),
  eventTime: z.string().nullable().optional(),
  location: z.string().max(256).nullable().optional(),
  isPublished: z.boolean().optional()
});

const updateAnnouncementSchema = z.object({
  title: z.string().min(2).max(150).optional(),
  content: z.string().min(2).max(5000).optional(),
  isPublished: z.boolean().optional()
});

const runScheduleSchema = z.object({
  semesterId: z.number().int().positive().optional()
});

const updateAssignmentSchema = z.object({
  slotId: z.number().int().positive(),
  swapIfOccupied: z.boolean().default(true)
});

const createManualAssignmentSchema = z.object({
  batchId: z.number().int().positive().optional(),
  userId: z.number().int().positive(),
  slotId: z.number().int().positive()
});

const publishScheduleSchema = z.object({
  batchId: z.number().int().positive()
});

const exportScheduleSchema = z.object({
  batchId: z.number().int().positive().optional()
});

const createConcertSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(5000).nullable().optional(),
  announcement: z.string().max(5000).nullable().optional(),
  applicationDeadline: z.string().nullable().optional(),
  status: z.enum(['draft', 'open', 'audition', 'result', 'closed']).default('draft')
});

const updateConcertSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  announcement: z.string().max(5000).nullable().optional(),
  applicationDeadline: z.string().nullable().optional(),
  status: z.enum(['draft', 'open', 'audition', 'result', 'closed']).optional(),
  removeAttachment: z.boolean().optional()
});

const releaseConcertSchema = z.object({
  message: z.string().max(5000).nullable().optional()
});

const createAuditionSchema = z.object({
  applicationId: z.number().int().positive().optional(),
  startTime: z.string().min(10),
  endTime: z.string().min(10),
  location: z.string().max(256).optional()
});

const publishResultSchema = z.object({
  applicationId: z.number().int().positive(),
  status: z.enum(['accepted', 'rejected', 'waitlist']),
  feedback: z.string().max(2000).optional()
});

const createGalleryItemSchema = z.object({
  src: z.string().min(1).max(512),
  fallback: z.string().max(512).nullable().optional(),
  titleZh: z.string().min(1).max(120),
  titleEn: z.string().min(1).max(120),
  descriptionZh: z.string().max(600).nullable().optional(),
  descriptionEn: z.string().max(600).nullable().optional(),
  altZh: z.string().max(200).nullable().optional(),
  altEn: z.string().max(200).nullable().optional(),
  isVisible: z.boolean().default(true),
  displayOrder: z.number().int().min(0).optional()
});

const updateGalleryItemSchema = z.object({
  src: z.string().min(1).max(512).optional(),
  fallback: z.string().max(512).nullable().optional(),
  titleZh: z.string().min(1).max(120).optional(),
  titleEn: z.string().min(1).max(120).optional(),
  descriptionZh: z.string().max(600).nullable().optional(),
  descriptionEn: z.string().max(600).nullable().optional(),
  altZh: z.string().max(200).nullable().optional(),
  altEn: z.string().max(200).nullable().optional(),
  isVisible: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional()
});

router.use(authenticate, requireRole('admin'));

router.get('/admin/gallery', (req, res, next) => {
  try {
    const rows = db
      .prepare(
        `SELECT
           id,
           src,
           fallback,
           title_zh AS titleZh,
           title_en AS titleEn,
           description_zh AS descriptionZh,
           description_en AS descriptionEn,
           alt_zh AS altZh,
           alt_en AS altEn,
           is_visible AS isVisible,
           display_order AS displayOrder,
           created_at AS createdAt,
           updated_at AS updatedAt
         FROM gallery_items
         ORDER BY display_order ASC, id ASC`
      )
      .all()
      .map(mapGalleryRow);

    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/gallery/upload', galleryUpload.single('imageFile'), (req, res, next) => {
  try {
    if (!req.file) {
      throw new HttpError(400, 'Image file is required');
    }
    const src = toStoredUploadPath(req.file.path);
    res.status(201).json({ src });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/gallery', (req, res, next) => {
  try {
    const input = createGalleryItemSchema.parse({
      src: optionalString(req.body.src) || '',
      fallback: optionalString(req.body.fallback) || null,
      titleZh: optionalString(req.body.titleZh) || '',
      titleEn: optionalString(req.body.titleEn) || '',
      descriptionZh: optionalString(req.body.descriptionZh) || null,
      descriptionEn: optionalString(req.body.descriptionEn) || null,
      altZh: optionalString(req.body.altZh) || null,
      altEn: optionalString(req.body.altEn) || null,
      isVisible: optionalBoolean(req.body.isVisible),
      displayOrder:
        req.body.displayOrder === undefined || req.body.displayOrder === null || req.body.displayOrder === ''
          ? undefined
          : Number(req.body.displayOrder)
    });

    const nextOrder = Number(
      db.prepare('SELECT COALESCE(MAX(display_order), -1) + 1 AS nextOrder FROM gallery_items').get()?.nextOrder || 0
    );
    const displayOrder = input.displayOrder ?? nextOrder;

    const result = db
      .prepare(
        `INSERT INTO gallery_items (
           src, fallback, title_zh, title_en, description_zh, description_en, alt_zh, alt_en, is_visible, display_order
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.src,
        input.fallback,
        input.titleZh,
        input.titleEn,
        input.descriptionZh,
        input.descriptionEn,
        input.altZh,
        input.altEn,
        input.isVisible ? 1 : 0,
        displayOrder
      );

    const created = db
      .prepare(
        `SELECT
           id,
           src,
           fallback,
           title_zh AS titleZh,
           title_en AS titleEn,
           description_zh AS descriptionZh,
           description_en AS descriptionEn,
           alt_zh AS altZh,
           alt_en AS altEn,
           is_visible AS isVisible,
           display_order AS displayOrder,
           created_at AS createdAt,
           updated_at AS updatedAt
         FROM gallery_items
         WHERE id = ?`
      )
      .get(Number(result.lastInsertRowid));

    res.status(201).json(mapGalleryRow(created));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid gallery item payload', details: err.issues });
    }
    return next(err);
  }
});

router.patch('/admin/gallery/:itemId', (req, res, next) => {
  try {
    const itemId = Number(req.params.itemId);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw new HttpError(400, 'Invalid itemId');
    }

    const input = updateGalleryItemSchema.parse({
      src: req.body.src === undefined ? undefined : optionalString(req.body.src) || '',
      fallback: req.body.fallback === undefined ? undefined : optionalString(req.body.fallback),
      titleZh: req.body.titleZh === undefined ? undefined : optionalString(req.body.titleZh) || '',
      titleEn: req.body.titleEn === undefined ? undefined : optionalString(req.body.titleEn) || '',
      descriptionZh:
        req.body.descriptionZh === undefined ? undefined : optionalString(req.body.descriptionZh),
      descriptionEn:
        req.body.descriptionEn === undefined ? undefined : optionalString(req.body.descriptionEn),
      altZh: req.body.altZh === undefined ? undefined : optionalString(req.body.altZh),
      altEn: req.body.altEn === undefined ? undefined : optionalString(req.body.altEn),
      isVisible: optionalBoolean(req.body.isVisible),
      displayOrder:
        req.body.displayOrder === undefined || req.body.displayOrder === null || req.body.displayOrder === ''
          ? undefined
          : Number(req.body.displayOrder)
    });

    const current = db
      .prepare(
        `SELECT
           id,
           src,
           fallback,
           title_zh AS titleZh,
           title_en AS titleEn,
           description_zh AS descriptionZh,
           description_en AS descriptionEn,
           alt_zh AS altZh,
           alt_en AS altEn,
           is_visible AS isVisible,
           display_order AS displayOrder
         FROM gallery_items
         WHERE id = ?`
      )
      .get(itemId);
    if (!current) {
      throw new HttpError(404, 'Gallery item not found');
    }

    db.prepare(
      `UPDATE gallery_items
       SET
         src = ?,
         fallback = ?,
         title_zh = ?,
         title_en = ?,
         description_zh = ?,
         description_en = ?,
         alt_zh = ?,
         alt_en = ?,
         is_visible = ?,
         display_order = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(
      input.src ?? current.src,
      input.fallback === undefined ? current.fallback : input.fallback,
      input.titleZh ?? current.titleZh,
      input.titleEn ?? current.titleEn,
      input.descriptionZh === undefined ? current.descriptionZh : input.descriptionZh,
      input.descriptionEn === undefined ? current.descriptionEn : input.descriptionEn,
      input.altZh === undefined ? current.altZh : input.altZh,
      input.altEn === undefined ? current.altEn : input.altEn,
      input.isVisible === undefined ? current.isVisible : (input.isVisible ? 1 : 0),
      input.displayOrder ?? current.displayOrder,
      itemId
    );

    const updated = db
      .prepare(
        `SELECT
           id,
           src,
           fallback,
           title_zh AS titleZh,
           title_en AS titleEn,
           description_zh AS descriptionZh,
           description_en AS descriptionEn,
           alt_zh AS altZh,
           alt_en AS altEn,
           is_visible AS isVisible,
           display_order AS displayOrder,
           created_at AS createdAt,
           updated_at AS updatedAt
         FROM gallery_items
         WHERE id = ?`
      )
      .get(itemId);

    res.json(mapGalleryRow(updated));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid gallery item update payload', details: err.issues });
    }
    return next(err);
  }
});

router.delete('/admin/gallery/:itemId', (req, res, next) => {
  try {
    const itemId = Number(req.params.itemId);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw new HttpError(400, 'Invalid itemId');
    }

    const result = db.prepare('DELETE FROM gallery_items WHERE id = ?').run(itemId);
    if (result.changes === 0) {
      throw new HttpError(404, 'Gallery item not found');
    }
    res.json({ message: 'Gallery item deleted', itemId });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/activities', (req, res, next) => {
  try {
    const input = publishContentSchema.parse(req.body);

    const result = db
      .prepare(
        `INSERT INTO activities (title, content, event_time, location, created_by, is_published)
         VALUES (?, ?, ?, ?, ?, 1)`
      )
      .run(input.title, input.content, input.eventTime || null, input.location || null, req.user.id);

    res.status(201).json({ id: Number(result.lastInsertRowid) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid activity payload', details: err.issues });
    }
    return next(err);
  }
});

router.get('/admin/activities', (req, res, next) => {
  try {
    const rows = db
      .prepare(
        `SELECT
           a.id,
           a.title,
           a.content,
           a.event_time AS eventTime,
           a.location,
           a.is_published AS isPublished,
           a.created_at AS createdAt,
           a.updated_at AS updatedAt,
           u.student_number AS createdByStudentNumber,
           COALESCE(p.display_name, u.student_number) AS createdByName
         FROM activities a
         LEFT JOIN users u ON u.id = a.created_by
         LEFT JOIN profiles p ON p.user_id = u.id
         ORDER BY COALESCE(a.event_time, a.created_at) DESC, a.id DESC`
      )
      .all()
      .map((item) => ({
        ...item,
        isPublished: Boolean(item.isPublished)
      }));

    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.patch('/admin/activities/:activityId', (req, res, next) => {
  try {
    const activityId = Number(req.params.activityId);
    if (!Number.isInteger(activityId) || activityId <= 0) {
      throw new HttpError(400, 'Invalid activityId');
    }

    const input = updateActivitySchema.parse({
      title: req.body.title,
      content: req.body.content,
      eventTime: req.body.eventTime === null ? null : optionalString(req.body.eventTime),
      location: optionalString(req.body.location),
      isPublished: optionalBoolean(req.body.isPublished)
    });

    const current = db
      .prepare(
        `SELECT
           id,
           title,
           content,
           event_time AS eventTime,
           location,
           is_published AS isPublished
         FROM activities
         WHERE id = ?`
      )
      .get(activityId);
    if (!current) {
      throw new HttpError(404, 'Activity not found');
    }

    db.prepare(
      `UPDATE activities
       SET
         title = ?,
         content = ?,
         event_time = ?,
         location = ?,
         is_published = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(
      input.title ?? current.title,
      input.content ?? current.content,
      input.eventTime === undefined ? current.eventTime : input.eventTime,
      input.location === undefined ? current.location : input.location,
      input.isPublished === undefined ? current.isPublished : (input.isPublished ? 1 : 0),
      activityId
    );

    const updated = db
      .prepare(
        `SELECT
           id,
           title,
           content,
           event_time AS eventTime,
           location,
           is_published AS isPublished,
           created_at AS createdAt,
           updated_at AS updatedAt
         FROM activities
         WHERE id = ?`
      )
      .get(activityId);

    res.json({
      ...updated,
      isPublished: Boolean(updated.isPublished)
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid activity update payload', details: err.issues });
    }
    return next(err);
  }
});

router.delete('/admin/activities/:activityId', (req, res, next) => {
  try {
    const activityId = Number(req.params.activityId);
    if (!Number.isInteger(activityId) || activityId <= 0) {
      throw new HttpError(400, 'Invalid activityId');
    }

    const result = db.prepare('DELETE FROM activities WHERE id = ?').run(activityId);
    if (result.changes === 0) {
      throw new HttpError(404, 'Activity not found');
    }
    res.json({ message: 'Activity deleted', activityId });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/announcements', async (req, res, next) => {
  try {
    const input = z
      .object({
        title: z.string().min(2).max(150),
        content: z.string().min(2).max(5000)
      })
      .parse(req.body);

    const result = db
      .prepare(
        `INSERT INTO announcements (title, content, created_by, is_published)
         VALUES (?, ?, ?, 1)`
      )
      .run(input.title, input.content, req.user.id);

    const memberIds = db
      .prepare("SELECT id FROM users WHERE role = 'member'")
      .all()
      .map((row) => row.id);
    const notifyResult = await notifyUsers({
      userIds: memberIds,
      subject: `[NJU林泉钢琴社公告] ${input.title}`,
      content: input.content,
      relatedType: 'announcement',
      relatedId: Number(result.lastInsertRowid)
    });

    res.status(201).json({ id: Number(result.lastInsertRowid), notification: notifyResult });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid announcement payload', details: err.issues });
    }
    return next(err);
  }
});

router.get('/admin/announcements', (req, res, next) => {
  try {
    const rows = db
      .prepare(
        `SELECT
           a.id,
           a.title,
           a.content,
           a.is_published AS isPublished,
           a.created_at AS createdAt,
           a.updated_at AS updatedAt,
           u.student_number AS createdByStudentNumber,
           COALESCE(p.display_name, u.student_number) AS createdByName
         FROM announcements a
         LEFT JOIN users u ON u.id = a.created_by
         LEFT JOIN profiles p ON p.user_id = u.id
         ORDER BY a.created_at DESC, a.id DESC`
      )
      .all()
      .map((item) => ({
        ...item,
        isPublished: Boolean(item.isPublished)
      }));

    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.patch('/admin/announcements/:announcementId', (req, res, next) => {
  try {
    const announcementId = Number(req.params.announcementId);
    if (!Number.isInteger(announcementId) || announcementId <= 0) {
      throw new HttpError(400, 'Invalid announcementId');
    }

    const input = updateAnnouncementSchema.parse({
      title: req.body.title,
      content: req.body.content,
      isPublished: optionalBoolean(req.body.isPublished)
    });

    const current = db
      .prepare(
        `SELECT
           id,
           title,
           content,
           is_published AS isPublished
         FROM announcements
         WHERE id = ?`
      )
      .get(announcementId);
    if (!current) {
      throw new HttpError(404, 'Announcement not found');
    }

    db.prepare(
      `UPDATE announcements
       SET
         title = ?,
         content = ?,
         is_published = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(
      input.title ?? current.title,
      input.content ?? current.content,
      input.isPublished === undefined ? current.isPublished : (input.isPublished ? 1 : 0),
      announcementId
    );

    const updated = db
      .prepare(
        `SELECT
           id,
           title,
           content,
           is_published AS isPublished,
           created_at AS createdAt,
           updated_at AS updatedAt
         FROM announcements
         WHERE id = ?`
      )
      .get(announcementId);

    res.json({
      ...updated,
      isPublished: Boolean(updated.isPublished)
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid announcement update payload', details: err.issues });
    }
    return next(err);
  }
});

router.delete('/admin/announcements/:announcementId', (req, res, next) => {
  try {
    const announcementId = Number(req.params.announcementId);
    if (!Number.isInteger(announcementId) || announcementId <= 0) {
      throw new HttpError(400, 'Invalid announcementId');
    }

    const result = db.prepare('DELETE FROM announcements WHERE id = ?').run(announcementId);
    if (result.changes === 0) {
      throw new HttpError(404, 'Announcement not found');
    }
    res.json({ message: 'Announcement deleted', announcementId });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/semesters', (req, res, next) => {
  try {
    const input = semesterSchema.parse(req.body);
    if (input.endDate < input.startDate) {
      throw new HttpError(400, 'endDate must be after startDate');
    }

    const tx = db.transaction(() => {
      if (input.activate) {
        db.prepare('UPDATE semesters SET is_active = 0').run();
      }

      const result = db
        .prepare(
          `INSERT INTO semesters (name, start_date, end_date, is_active)
           VALUES (?, ?, ?, ?)`
        )
        .run(input.name, input.startDate, input.endDate, input.activate ? 1 : 0);

      const semesterId = Number(result.lastInsertRowid);
      createStandardSlots(db, semesterId);
      return semesterId;
    });

    const semesterId = tx();
    res.status(201).json({
      id: semesterId,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      active: input.activate,
      slotCount: 2 * 7 * 14
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid semester payload', details: err.issues });
    }
    return next(err);
  }
});

router.get('/admin/semesters/current', (req, res, next) => {
  try {
    const row = db
      .prepare(
        `SELECT
           id,
           name,
           start_date AS startDate,
           end_date AS endDate,
           is_active AS isActive
         FROM semesters
         WHERE is_active = 1
         ORDER BY id DESC
         LIMIT 1`
      )
      .get();

    if (!row) {
      return res.json({ item: null });
    }
    return res.json({
      item: {
        ...row,
        isActive: Boolean(row.isActive)
      }
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/admin/scheduling/run', (req, res, next) => {
  try {
    const input = runScheduleSchema.parse({
      semesterId: req.body.semesterId ? Number(req.body.semesterId) : undefined
    });
    const semesterId = resolveSemesterId(db, input.semesterId);
    const result = generateProposedSchedule({
      semesterId,
      adminId: req.user.id
    });

    res.status(201).json({
      message: 'Schedule generated as proposed batch',
      semesterId,
      ...result
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid schedule request payload', details: err.issues });
    }
    return next(err);
  }
});

router.get('/admin/scheduling/proposed', (req, res, next) => {
  try {
    const semesterId = resolveSemesterId(db, req.query.semesterId);
    const semester = db
      .prepare(
        `SELECT
           id,
           name,
           start_date AS startDate,
           end_date AS endDate,
           is_active AS isActive
         FROM semesters
         WHERE id = ?`
      )
      .get(semesterId);
    const batch = db
      .prepare(
        `SELECT id, semester_id AS semesterId, created_at AS createdAt
         FROM schedule_batches
         WHERE semester_id = ? AND status = 'proposed'
         ORDER BY created_at DESC, id DESC
         LIMIT 1`
      )
      .get(semesterId);

    const members = db
      .prepare(
        `SELECT
           u.id AS userId,
           u.student_number AS studentNumber,
           COALESCE(p.display_name, u.student_number) AS displayName,
           COUNT(DISTINCT sa.id) AS assignedCount,
           COUNT(DISTINCT sp.id) AS preferenceCount
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         LEFT JOIN slot_preferences sp
           ON sp.semester_id = ?
          AND sp.user_id = u.id
         LEFT JOIN schedule_assignments sa
           ON sa.batch_id = ?
          AND sa.user_id = u.id
         WHERE u.role = 'member'
         GROUP BY u.id, u.student_number, p.display_name
         HAVING COUNT(DISTINCT sp.id) > 0 OR COUNT(DISTINCT sa.id) > 0
         ORDER BY u.student_number ASC`
      )
      .all(semesterId, batch?.id || -1);

    if (!batch) {
      return res.json({
        semesterId,
        semester: semester
          ? { ...semester, isActive: Boolean(semester.isActive) }
          : null,
        batch: null,
        assignments: [],
        members
      });
    }

    const assignments = db
      .prepare(
        `SELECT
           sa.id,
           sa.user_id AS userId,
           u.student_number AS studentNumber,
           COALESCE(p.display_name, u.student_number) AS displayName,
           sa.slot_id AS slotId,
           rs.room_no AS roomNo,
           rs.day_of_week AS dayOfWeek,
           rs.hour
         FROM schedule_assignments sa
         JOIN users u ON u.id = sa.user_id
         LEFT JOIN profiles p ON p.user_id = u.id
         JOIN room_slots rs ON rs.id = sa.slot_id
         WHERE sa.batch_id = ?
         ORDER BY u.student_number ASC, rs.day_of_week, rs.hour, rs.room_no`
      )
      .all(batch.id);

    return res.json({
      semesterId,
      semester: semester
        ? { ...semester, isActive: Boolean(semester.isActive) }
        : null,
      batch,
      assignments,
      members
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/admin/scheduling/assignments', (req, res, next) => {
  try {
    const input = createManualAssignmentSchema.parse({
      batchId: req.body.batchId ? Number(req.body.batchId) : undefined,
      userId: Number(req.body.userId),
      slotId: Number(req.body.slotId)
    });

    const slot = db
      .prepare(
        `SELECT id, semester_id AS semesterId
         FROM room_slots
         WHERE id = ?`
      )
      .get(input.slotId);
    if (!slot) {
      throw new HttpError(400, 'Target slot not found');
    }

    const batch = input.batchId
      ? db
        .prepare(
          `SELECT id, semester_id AS semesterId
           FROM schedule_batches
           WHERE id = ? AND status = 'proposed'`
        )
        .get(input.batchId)
      : db
        .prepare(
          `SELECT id, semester_id AS semesterId
           FROM schedule_batches
           WHERE semester_id = ? AND status = 'proposed'
           ORDER BY created_at DESC, id DESC
           LIMIT 1`
        )
        .get(slot.semesterId);

    if (!batch) {
      throw new HttpError(404, 'No proposed schedule batch found');
    }
    if (batch.semesterId !== slot.semesterId) {
      throw new HttpError(400, 'Batch and slot are from different semesters');
    }

    const member = db
      .prepare(
        `SELECT id
         FROM users
         WHERE id = ? AND role = 'member'`
      )
      .get(input.userId);
    if (!member) {
      throw new HttpError(404, 'Member not found');
    }

    const occupied = db
      .prepare(
        `SELECT id
         FROM schedule_assignments
         WHERE batch_id = ? AND slot_id = ?`
      )
      .get(batch.id, input.slotId);
    if (occupied) {
      throw new HttpError(409, 'Target slot is already occupied');
    }

    const existing = db
      .prepare(
        `SELECT id
         FROM schedule_assignments
         WHERE batch_id = ? AND user_id = ? AND slot_id = ?`
      )
      .get(batch.id, input.userId, input.slotId);
    if (existing) {
      return res.json({
        id: existing.id,
        batchId: batch.id,
        semesterId: batch.semesterId,
        userId: input.userId,
        slotId: input.slotId
      });
    }

    const result = db
      .prepare(
        `INSERT INTO schedule_assignments (batch_id, semester_id, user_id, slot_id, status)
         VALUES (?, ?, ?, ?, 'proposed')`
      )
      .run(batch.id, batch.semesterId, input.userId, input.slotId);

    return res.status(201).json({
      id: Number(result.lastInsertRowid),
      batchId: batch.id,
      semesterId: batch.semesterId,
      userId: input.userId,
      slotId: input.slotId
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid manual assignment payload', details: err.issues });
    }
    return next(err);
  }
});

router.patch('/admin/scheduling/assignments/:assignmentId', (req, res, next) => {
  try {
    const assignmentId = Number(req.params.assignmentId);
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
      throw new HttpError(400, 'Invalid assignmentId');
    }

    const input = updateAssignmentSchema.parse({
      slotId: Number(req.body.slotId),
      swapIfOccupied: optionalBoolean(req.body.swapIfOccupied) ?? true
    });

    const assignment = db
      .prepare(
        `SELECT
           sa.id,
           sa.user_id AS userId,
           sa.slot_id AS currentSlotId,
           sa.batch_id AS batchId,
           sa.semester_id AS semesterId
         FROM schedule_assignments sa
         JOIN schedule_batches sb ON sb.id = sa.batch_id
         WHERE sa.id = ? AND sb.status = 'proposed'`
      )
      .get(assignmentId);
    if (!assignment) {
      throw new HttpError(404, 'Proposed assignment not found');
    }

    const validSlot = db
      .prepare(
        'SELECT id FROM room_slots WHERE id = ? AND semester_id = ?'
      )
      .get(input.slotId, assignment.semesterId);
    if (!validSlot) {
      throw new HttpError(400, 'Target slot is not in this semester');
    }

    const occupied = db
      .prepare(
        `SELECT id, user_id AS userId FROM schedule_assignments
         WHERE batch_id = ? AND slot_id = ? AND id != ?`
      )
      .get(assignment.batchId, input.slotId, assignmentId);
    if (occupied && !input.swapIfOccupied) {
      throw new HttpError(409, 'Target slot is already occupied in this proposed batch');
    }

    if (!occupied) {
      db.prepare(
        `UPDATE schedule_assignments
         SET slot_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(input.slotId, assignmentId);

      return res.json({
        message: 'Assignment updated',
        assignmentId,
        slotId: input.slotId
      });
    }

    const conflictForOccupiedUser = db
      .prepare(
        `SELECT id FROM schedule_assignments
         WHERE batch_id = ? AND user_id = ? AND slot_id = ? AND id != ?`
      )
      .get(assignment.batchId, occupied.userId, assignment.currentSlotId, occupied.id);
    if (conflictForOccupiedUser) {
      throw new HttpError(409, 'Swap would create duplicate slot assignment for target user');
    }

    const conflictForCurrentUser = db
      .prepare(
        `SELECT id FROM schedule_assignments
         WHERE batch_id = ? AND user_id = ? AND slot_id = ? AND id != ?`
      )
      .get(assignment.batchId, assignment.userId, input.slotId, assignment.id);
    if (conflictForCurrentUser) {
      throw new HttpError(409, 'Swap would create duplicate slot assignment for source user');
    }

    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE schedule_assignments
         SET slot_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(assignment.currentSlotId, occupied.id);

      db.prepare(
        `UPDATE schedule_assignments
         SET slot_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(input.slotId, assignment.id);
    });
    tx();

    return res.json({
      message: 'Assignment swapped',
      assignmentId,
      slotId: input.slotId,
      swappedWithAssignmentId: occupied.id
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid assignment payload', details: err.issues });
    }
    return next(err);
  }
});

router.delete('/admin/scheduling/assignments/:assignmentId', (req, res, next) => {
  try {
    const assignmentId = Number(req.params.assignmentId);
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
      throw new HttpError(400, 'Invalid assignmentId');
    }

    const assignment = db
      .prepare(
        `SELECT sa.id
         FROM schedule_assignments sa
         JOIN schedule_batches sb ON sb.id = sa.batch_id
         WHERE sa.id = ? AND sb.status = 'proposed'`
      )
      .get(assignmentId);
    if (!assignment) {
      throw new HttpError(404, 'Proposed assignment not found');
    }

    db.prepare('DELETE FROM schedule_assignments WHERE id = ?').run(assignmentId);
    return res.json({ message: 'Assignment deleted', assignmentId });
  } catch (err) {
    return next(err);
  }
});

router.get('/admin/scheduling/export', (req, res, next) => {
  try {
    const input = exportScheduleSchema.parse({
      batchId: req.query.batchId ? Number(req.query.batchId) : undefined
    });

    const batch = input.batchId
      ? db
        .prepare(
          `SELECT
             id,
             semester_id AS semesterId,
             status,
             created_at AS createdAt,
             published_at AS publishedAt
           FROM schedule_batches
           WHERE id = ?`
        )
        .get(input.batchId)
      : db
        .prepare(
          `SELECT
             id,
             semester_id AS semesterId,
             status,
             created_at AS createdAt,
             published_at AS publishedAt
           FROM schedule_batches
           WHERE semester_id = ? AND status IN ('proposed', 'published')
           ORDER BY
             CASE WHEN status = 'proposed' THEN 0 ELSE 1 END,
             COALESCE(published_at, created_at) DESC,
             id DESC
           LIMIT 1`
        )
        .get(resolveSemesterId(db, req.query.semesterId));

    if (!batch) {
      throw new HttpError(404, 'No schedule batch available for export');
    }

    const semester = db
      .prepare(
        `SELECT
           id,
           name,
           start_date AS startDate,
           end_date AS endDate
         FROM semesters
         WHERE id = ?`
      )
      .get(batch.semesterId);
    if (!semester) {
      throw new HttpError(404, 'Semester not found');
    }

    const rows = db
      .prepare(
        `SELECT
           rs.day_of_week AS dayOfWeek,
           rs.hour,
           rs.room_no AS roomNo,
           COALESCE(p.display_name, u.student_number) AS displayName,
           u.student_number AS studentNumber
         FROM room_slots rs
         LEFT JOIN schedule_assignments sa
           ON sa.slot_id = rs.id
          AND sa.batch_id = ?
         LEFT JOIN users u ON u.id = sa.user_id
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE rs.semester_id = ?
         ORDER BY rs.day_of_week, rs.hour, rs.room_no`
      )
      .all(batch.id, batch.semesterId);

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const headers = ['Time'];
    for (const day of dayLabels) {
      headers.push(`${day}-Room1`);
      headers.push(`${day}-Room2`);
    }

    const slotMap = new Map();
    for (const item of rows) {
      const key = `${item.dayOfWeek}-${item.hour}-${item.roomNo}`;
      const member = item.displayName
        ? `${item.displayName} (${item.studentNumber})`
        : '';
      slotMap.set(key, member);
    }

    function escapeCsv(value) {
      const text = String(value ?? '');
      if (text.includes('"') || text.includes(',') || text.includes('\n')) {
        return `"${text.replaceAll('"', '""')}"`;
      }
      return text;
    }

    const lines = [];
    lines.push([
      `Semester: ${semester.name}`,
      `Date: ${semester.startDate} to ${semester.endDate}`,
      `Batch: ${batch.id}`,
      `Status: ${batch.status}`
    ].map(escapeCsv).join(','));
    lines.push(headers.map(escapeCsv).join(','));

    for (let hour = 8; hour <= 21; hour += 1) {
      const row = [`${String(hour).padStart(2, '0')}:00`];
      for (let day = 0; day <= 6; day += 1) {
        row.push(slotMap.get(`${day}-${hour}-1`) || '');
        row.push(slotMap.get(`${day}-${hour}-2`) || '');
      }
      lines.push(row.map(escapeCsv).join(','));
    }

    const csv = `\uFEFF${lines.join('\n')}`;
    const safeSemesterName = semester.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `linquan_schedule_${safeSemesterName}_batch_${batch.id}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid export payload', details: err.issues });
    }
    return next(err);
  }
});

router.post('/admin/scheduling/publish', async (req, res, next) => {
  try {
    const input = publishScheduleSchema.parse({
      batchId: Number(req.body.batchId)
    });
    const publishResult = publishScheduleBatch({
      batchId: input.batchId,
      adminId: req.user.id
    });

    const notifyResult = await notifyUsers({
      userIds: publishResult.userIds,
      subject: 'NJU林泉钢琴社琴房排班已发布',
      content:
        '本学期琴房排班已发布，请登录系统查看你的固定时段。',
      relatedType: 'schedule_batch',
      relatedId: input.batchId
    });

    res.json({
      message: 'Schedule batch published',
      semesterId: publishResult.semesterId,
      notification: notifyResult
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid publish payload', details: err.issues });
    }
    return next(err);
  }
});

router.get('/admin/concerts', (req, res, next) => {
  try {
    const rows = db
      .prepare(
        `SELECT
           c.id,
           c.title,
           c.description,
           c.announcement,
           c.application_deadline AS applicationDeadline,
           c.status,
           c.attachment_path AS attachmentPath,
           c.created_at AS createdAt,
           c.updated_at AS updatedAt,
           u.student_number AS createdByStudentNumber,
           COALESCE(p.display_name, u.student_number) AS createdByName
         FROM concerts c
         LEFT JOIN users u ON u.id = c.created_by
         LEFT JOIN profiles p ON p.user_id = u.id
         ORDER BY c.created_at DESC, c.id DESC`
      )
      .all();

    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/concerts', concertUpload.single('attachmentFile'), (req, res, next) => {
  try {
    const input = createConcertSchema.parse({
      title: req.body.title,
      description: optionalString(req.body.description),
      announcement: optionalString(req.body.announcement),
      applicationDeadline: optionalString(req.body.applicationDeadline),
      status: req.body.status || 'draft'
    });

    const attachmentPath = req.file
      ? toStoredUploadPath(req.file.path)
      : null;

    const result = db
      .prepare(
        `INSERT INTO concerts (
           title, description, announcement, application_deadline, status, attachment_path, created_by
         )
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.title,
        input.description ?? null,
        input.announcement ?? null,
        input.applicationDeadline ?? null,
        input.status,
        attachmentPath,
        req.user.id
      );

    const concertId = Number(result.lastInsertRowid);
    const created = db
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
         WHERE id = ?`
      )
      .get(concertId);

    res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid concert payload', details: err.issues });
    }
    return next(err);
  }
});

router.patch('/admin/concerts/:concertId', concertUpload.single('attachmentFile'), (req, res, next) => {
  try {
    const concertId = Number(req.params.concertId);
    if (!Number.isInteger(concertId) || concertId <= 0) {
      throw new HttpError(400, 'Invalid concertId');
    }

    const input = updateConcertSchema.parse({
      title: req.body.title,
      description: optionalString(req.body.description),
      announcement: optionalString(req.body.announcement),
      applicationDeadline: optionalString(req.body.applicationDeadline),
      status: req.body.status,
      removeAttachment: optionalBoolean(req.body.removeAttachment)
    });

    const existing = db
      .prepare(
        `SELECT
           id,
           title,
           description,
           announcement,
           application_deadline AS applicationDeadline,
           status,
           attachment_path AS attachmentPath
         FROM concerts
         WHERE id = ?`
      )
      .get(concertId);
    if (!existing) {
      throw new HttpError(404, 'Concert not found');
    }

    const nextAttachmentPath = req.file
      ? toStoredUploadPath(req.file.path)
      : input.removeAttachment
        ? null
        : existing.attachmentPath;

    const result = db
      .prepare(
        `UPDATE concerts
         SET
           title = ?,
           description = ?,
           announcement = ?,
           application_deadline = ?,
           status = ?,
           attachment_path = ?,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(
        input.title ?? existing.title,
        input.description === undefined ? existing.description : input.description,
        input.announcement === undefined ? existing.announcement : input.announcement,
        input.applicationDeadline === undefined ? existing.applicationDeadline : input.applicationDeadline,
        input.status ?? existing.status,
        nextAttachmentPath,
        concertId
      );
    if (result.changes === 0) {
      throw new HttpError(404, 'Concert not found');
    }

    const updated = db
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
         WHERE id = ?`
      )
      .get(concertId);

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid concert update payload', details: err.issues });
    }
    return next(err);
  }
});

router.patch('/admin/concerts/:concertId/status', (req, res, next) => {
  try {
    const concertId = Number(req.params.concertId);
    if (!Number.isInteger(concertId) || concertId <= 0) {
      throw new HttpError(400, 'Invalid concertId');
    }
    const status = z.enum(['draft', 'open', 'audition', 'result', 'closed']).parse(req.body.status);

    const result = db
      .prepare(
        `UPDATE concerts
         SET status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(status, concertId);
    if (result.changes === 0) {
      throw new HttpError(404, 'Concert not found');
    }

    res.json({ message: 'Concert status updated', concertId, status });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid status payload', details: err.issues });
    }
    return next(err);
  }
});

router.get('/admin/concerts/:concertId/applications', (req, res, next) => {
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
           ca.id,
           ca.concert_id AS concertId,
           ca.user_id AS userId,
           u.student_number AS studentNumber,
           COALESCE(p.display_name, u.student_number) AS displayName,
           ca.piece_title AS pieceTitle,
           ca.composer,
           ca.note,
           ca.score_file_path AS scoreFilePath,
           ca.status,
           ca.feedback,
           ca.created_at AS createdAt,
           ca.updated_at AS updatedAt
         FROM concert_applications ca
         JOIN users u ON u.id = ca.user_id
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE ca.concert_id = ?
         ORDER BY ca.created_at DESC, ca.id DESC`
      )
      .all(concertId)
      .map((item) => ({
        ...item,
        scoreFilePath: toPublicPath(item.scoreFilePath)
      }));

    return res.json({ items: rows });
  } catch (err) {
    return next(err);
  }
});

router.post('/admin/concerts/:concertId/release', async (req, res, next) => {
  try {
    const concertId = Number(req.params.concertId);
    if (!Number.isInteger(concertId) || concertId <= 0) {
      throw new HttpError(400, 'Invalid concertId');
    }
    const input = releaseConcertSchema.parse({
      message: optionalString(req.body.message)
    });

    const concert = db
      .prepare(
        `SELECT id, title, description, announcement
         FROM concerts
         WHERE id = ?`
      )
      .get(concertId);
    if (!concert) {
      throw new HttpError(404, 'Concert not found');
    }

    db.prepare(
      `UPDATE concerts
       SET status = 'open', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(concertId);

    const memberIds = db
      .prepare("SELECT id FROM users WHERE role = 'member'")
      .all()
      .map((row) => row.id);

    const notifyResult = await notifyUsers({
      userIds: memberIds,
      subject: `[NJU林泉钢琴社音乐会发布] ${concert.title}`,
      content:
        input.message
        || concert.announcement
        || concert.description
        || '新的音乐会周期已发布，请登录查看详情并报名。',
      relatedType: 'concert',
      relatedId: concertId
    });

    res.json({
      message: 'Concert released',
      concertId,
      status: 'open',
      notification: notifyResult
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid release payload', details: err.issues });
    }
    return next(err);
  }
});

router.post('/admin/concerts/:concertId/auditions', (req, res, next) => {
  try {
    const concertId = Number(req.params.concertId);
    if (!Number.isInteger(concertId) || concertId <= 0) {
      throw new HttpError(400, 'Invalid concertId');
    }

    const input = createAuditionSchema.parse({
      applicationId: req.body.applicationId ? Number(req.body.applicationId) : undefined,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      location: req.body.location
    });

    const concert = db.prepare('SELECT id FROM concerts WHERE id = ?').get(concertId);
    if (!concert) {
      throw new HttpError(404, 'Concert not found');
    }

    if (input.applicationId) {
      const application = db
        .prepare(
          'SELECT id FROM concert_applications WHERE id = ? AND concert_id = ?'
        )
        .get(input.applicationId, concertId);
      if (!application) {
        throw new HttpError(400, 'Application does not belong to this concert');
      }
    }

    const result = db
      .prepare(
        `INSERT INTO audition_slots (concert_id, application_id, start_time, end_time, location, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        concertId,
        input.applicationId || null,
        input.startTime,
        input.endTime,
        input.location || null,
        req.user.id
      );

    res.status(201).json({ id: Number(result.lastInsertRowid) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid audition payload', details: err.issues });
    }
    return next(err);
  }
});

router.post('/admin/concerts/:concertId/results', async (req, res, next) => {
  try {
    const concertId = Number(req.params.concertId);
    if (!Number.isInteger(concertId) || concertId <= 0) {
      throw new HttpError(400, 'Invalid concertId');
    }

    const input = publishResultSchema.parse({
      applicationId: Number(req.body.applicationId),
      status: req.body.status,
      feedback: req.body.feedback
    });

    const application = db
      .prepare(
        `SELECT id, user_id AS userId
         FROM concert_applications
         WHERE id = ? AND concert_id = ?`
      )
      .get(input.applicationId, concertId);
    if (!application) {
      throw new HttpError(404, 'Concert application not found');
    }

    db.prepare(
      `UPDATE concert_applications
       SET status = ?, feedback = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(input.status, input.feedback || null, input.applicationId);

    const notifyResult = await notifyUsers({
      userIds: [application.userId],
      subject: 'NJU林泉钢琴社审核结果已更新',
      content: `你的音乐会申请结果已更新为 "${input.status}"，请登录查看详细反馈。`,
      relatedType: 'concert_application',
      relatedId: input.applicationId
    });

    res.json({
      message: 'Concert result published',
      applicationId: input.applicationId,
      status: input.status,
      notification: notifyResult
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid result payload', details: err.issues });
    }
    return next(err);
  }
});

export default router;
