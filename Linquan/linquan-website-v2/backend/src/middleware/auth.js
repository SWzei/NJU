import jwt from 'jsonwebtoken';
import db from '../config/db.js';
import { JWT_SECRET } from '../config/env.js';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Missing or invalid authorization token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db
      .prepare(
        `SELECT
           id,
           role,
           student_number AS studentNumber,
           is_active AS isActive
         FROM users
         WHERE id = ?`
      )
      .get(payload.id);
    if (!user || !Boolean(user.isActive)) {
      return res.status(401).json({ message: 'Account is inactive' });
    }
    req.user = {
      ...payload,
      role: user.role,
      studentNumber: user.studentNumber
    };
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Token is invalid or expired' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permission' });
    }

    return next();
  };
}
