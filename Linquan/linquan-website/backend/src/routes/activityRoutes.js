import express from 'express';
import db from '../config/db.js';

const router = express.Router();

router.get('/activities', (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, title, content, event_time AS eventTime, location, created_at AS createdAt
       FROM activities
       WHERE is_published = 1
       ORDER BY COALESCE(event_time, created_at) DESC, id DESC`
    )
    .all();

  res.json({ items: rows });
});

router.get('/announcements', (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, title, content, created_at AS createdAt
       FROM announcements
       WHERE is_published = 1
       ORDER BY created_at DESC, id DESC`
    )
    .all();

  res.json({ items: rows });
});

router.get('/gallery', (req, res) => {
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
         display_order AS displayOrder
       FROM gallery_items
       WHERE is_visible = 1
       ORDER BY display_order ASC, id ASC`
    )
    .all();

  res.json({ items: rows });
});

export default router;
