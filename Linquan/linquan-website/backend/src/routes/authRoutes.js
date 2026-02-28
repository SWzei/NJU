import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import db from '../config/db.js';
import { JWT_SECRET } from '../config/env.js';
import HttpError from '../utils/httpError.js';

const router = express.Router();

const registerSchema = z.object({
  studentNumber: z.string().min(3).max(32),
  email: z
    .string()
    .email()
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : null)),
  password: z.string().min(6).max(128),
  displayName: z.string().trim().min(1).max(64)
});

const loginSchema = z.object({
  credential: z.string().min(3),
  password: z.string().min(6).max(128)
});

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      studentNumber: user.student_number
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

router.post('/register', (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);

    const existingByStudentNumber = db
      .prepare('SELECT id FROM users WHERE student_number = ?')
      .get(input.studentNumber);
    if (existingByStudentNumber) {
      throw new HttpError(409, 'Student number is already registered');
    }

    if (input.email) {
      const existingByEmail = db
        .prepare('SELECT id FROM users WHERE email = ?')
        .get(input.email);
      if (existingByEmail) {
        throw new HttpError(409, 'Email is already registered');
      }
    }

    const passwordHash = bcrypt.hashSync(input.password, 10);
    const tx = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO users (student_number, email, password_hash, role)
           VALUES (?, ?, ?, 'member')`
        )
        .run(input.studentNumber, input.email, passwordHash);

      const userId = Number(result.lastInsertRowid);
      db.prepare(
        `INSERT INTO profiles (user_id, display_name)
         VALUES (?, ?)`
      ).run(userId, input.displayName);

      return userId;
    });

    const userId = tx();
    const user = db
      .prepare(
        `SELECT id, student_number, email, role
         FROM users
         WHERE student_number = ?`
      )
      .get(input.studentNumber);
    if (!user) {
      throw new HttpError(500, 'Registered user cannot be loaded');
    }

    const token = signToken(user);
    res.status(201).json({
      token,
      user: {
        id: user.id,
        studentNumber: user.student_number,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid registration payload', details: err.issues });
    }
    return next(err);
  }
});

router.post('/login', (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);

    const user = db
      .prepare(
        `SELECT id, student_number, email, password_hash, role
         FROM users
         WHERE student_number = ? OR email = ?`
      )
      .get(input.credential, input.credential);

    if (!user) {
      throw new HttpError(401, 'Invalid student number/email or password');
    }

    const isValidPassword = bcrypt.compareSync(input.password, user.password_hash);
    if (!isValidPassword) {
      throw new HttpError(401, 'Invalid student number/email or password');
    }

    const token = signToken(user);
    return res.json({
      token,
      user: {
        id: user.id,
        studentNumber: user.student_number,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid login payload', details: err.issues });
    }
    return next(err);
  }
});

export default router;
