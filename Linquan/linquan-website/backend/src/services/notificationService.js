import db from '../config/db.js';
import { sendEmail } from './emailService.js';

export async function notifyUsers({
  userIds,
  subject,
  content,
  relatedType = null,
  relatedId = null
}) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return { total: 0, sent: 0, failed: 0, queued: 0 };
  }

  const uniqueUserIds = [...new Set(userIds.map((id) => Number(id)).filter((id) => Number.isInteger(id)))];
  if (uniqueUserIds.length === 0) {
    return { total: 0, sent: 0, failed: 0, queued: 0 };
  }

  const placeholders = uniqueUserIds.map(() => '?').join(', ');
  const users = db
    .prepare(
      `SELECT id, email FROM users WHERE id IN (${placeholders})`
    )
    .all(...uniqueUserIds);

  const insertNotification = db.prepare(
    `INSERT INTO notifications (user_id, channel, subject, content, status, related_type, related_id)
     VALUES (?, 'email', ?, ?, ?, ?, ?)`
  );
  const updateStatus = db.prepare(
    'UPDATE notifications SET status = ?, sent_at = CURRENT_TIMESTAMP WHERE id = ?'
  );

  let sent = 0;
  let failed = 0;
  let queued = 0;

  for (const user of users) {
    const initialStatus = user.email ? 'queued' : 'failed';
    const result = insertNotification.run(
      user.id,
      subject,
      content,
      initialStatus,
      relatedType,
      relatedId
    );
    const notificationId = result.lastInsertRowid;

    if (!user.email) {
      failed += 1;
      continue;
    }

    try {
      const emailResult = await sendEmail({ to: user.email, subject, text: content });
      if (emailResult.sent) {
        updateStatus.run('sent', notificationId);
        sent += 1;
      } else {
        queued += 1;
      }
    } catch (err) {
      updateStatus.run('failed', notificationId);
      failed += 1;
    }
  }

  return { total: users.length, sent, failed, queued };
}
