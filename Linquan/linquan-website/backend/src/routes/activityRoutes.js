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

export default router;
