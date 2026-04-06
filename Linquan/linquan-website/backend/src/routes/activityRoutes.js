import express from 'express';
import fs from 'fs';
import path from 'path';
import db from '../config/db.js';
import { UPLOAD_ROOT } from '../config/env.js';
import { attachContentAttachments } from '../utils/contentAttachments.js';
import HttpError from '../utils/httpError.js';
import { normalizeUploadedOriginalName } from '../utils/uploadFilename.js';
import { serializePublishingTimestamps } from '../utils/dateTime.js';
import { coalescedTimestampOrder } from '../utils/sqlTimeCompat.js';

const router = express.Router();
const uploadRoot = path.resolve(process.cwd(), UPLOAD_ROOT);
const activityOrderExpr = coalescedTimestampOrder('event_time', 'published_at', 'created_at');
const announcementOrderExpr = coalescedTimestampOrder('published_at', 'created_at');

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

function escapeHeaderFilename(value) {
  return encodeURIComponent(String(value || 'download'))
    .replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function asciiFallbackFilename(value) {
  const normalized = String(value || 'download')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_')
    .replace(/[<>:|?*]/g, '_')
    .trim();
  return normalized || 'download';
}

function setAttachmentDownloadHeaders(res, originalName, mimeType, size) {
  const fileName = normalizeUploadedOriginalName(originalName || 'download');
  const fallbackName = asciiFallbackFilename(fileName);
  res.setHeader('Content-Type', mimeType || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${fallbackName}"; filename*=UTF-8''${escapeHeaderFilename(fileName)}`
  );
  if (Number.isFinite(size) && size >= 0) {
    res.setHeader('Content-Length', String(size));
  }
}

router.get('/activities', (req, res) => {
  const rows = attachContentAttachments(
    db,
    'activity',
    db
    .prepare(
      `SELECT
         id,
         title,
         content,
         event_time AS "eventTime",
         location,
         published_at AS "publishedAt",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM activities
       WHERE is_published = 1
       ORDER BY ${activityOrderExpr} DESC, id DESC`
    )
    .all(),
    { primaryField: 'attachmentPath' }
  );

  res.json({ items: rows.map((item) => serializePublishingTimestamps(item)) });
});

router.get('/announcements', (req, res) => {
  const rows = attachContentAttachments(
    db,
    'announcement',
    db
    .prepare(
      `SELECT
         id,
         title,
         content,
         attachment_path AS "attachmentPath",
         published_at AS "publishedAt",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM announcements
       WHERE is_published = 1
       ORDER BY ${announcementOrderExpr} DESC, id DESC`
    )
    .all(),
    { primaryField: 'attachmentPath' }
  );

  res.json({ items: rows.map((item) => serializePublishingTimestamps(item)) });
});

router.get('/attachments/:attachmentId/download', (req, res, next) => {
  try {
    const attachmentId = Number(req.params.attachmentId);
    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      throw new HttpError(400, 'Invalid attachmentId');
    }

    const row = db
      .prepare(
        `SELECT
           id,
           owner_type AS ownerType,
           owner_id AS ownerId,
           original_name AS originalName,
           file_path AS filePath,
           file_size AS fileSize,
           mime_type AS mimeType
         FROM content_attachments
         WHERE id = ?`
      )
      .get(attachmentId);
    if (!row) {
      throw new HttpError(404, 'Attachment not found');
    }

    if (row.ownerType === 'activity') {
      const owner = db.prepare('SELECT id FROM activities WHERE id = ? AND is_published = 1').get(row.ownerId);
      if (!owner) {
        throw new HttpError(404, 'Attachment not found');
      }
    } else if (row.ownerType === 'announcement') {
      const owner = db.prepare('SELECT id FROM announcements WHERE id = ? AND is_published = 1').get(row.ownerId);
      if (!owner) {
        throw new HttpError(404, 'Attachment not found');
      }
    } else {
      throw new HttpError(404, 'Attachment not found');
    }

    const absolutePath = resolveStoredUploadPath(row.filePath);
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      throw new HttpError(404, 'Attachment file not found');
    }

    setAttachmentDownloadHeaders(res, row.originalName, row.mimeType, Number(row.fileSize || 0));
    return res.sendFile(absolutePath);
  } catch (err) {
    return next(err);
  }
});

router.get('/gallery', (req, res) => {
  const rows = db
    .prepare(
      `SELECT
         id,
         src,
         fallback,
         title_zh AS "titleZh",
         title_en AS "titleEn",
         description_zh AS "descriptionZh",
         description_en AS "descriptionEn",
         alt_zh AS "altZh",
         alt_en AS "altEn",
         display_order AS "displayOrder"
       FROM gallery_items
       WHERE is_visible = 1
       ORDER BY display_order ASC, id ASC`
    )
    .all();

  res.json({ items: rows });
});

export default router;
