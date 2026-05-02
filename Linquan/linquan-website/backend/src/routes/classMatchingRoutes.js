import express from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.js';
import { resolveClassMatchingTermId } from '../utils/classMatching.js';
import db from '../config/db.js';
import {
  compareClassMatchingVersions,
  createClassMatchingTerm,
  deleteClassMatchingTerm,
  exportClassMatchingCsv,
  generateClassMatchingVersion,
  getAdminClassMatchingOverview,
  getClassMatchingVersionDetail,
  getUserClassMatchingOverview,
  incrementalClassMatching,
  listClassMatchingTerms,
  manualAdjustClassMatching,
  restoreClassMatchingVersion,
  saveUserClassMatchingAvailability,
  saveUserClassMatchingProfile,
  saveUserClassMatchingRankings,
  updateClassMatchingTerm,
  updateTeacherQualification
} from '../services/classMatching/index.js';
import HttpError from '../utils/httpError.js';

const router = express.Router();

const termSchema = z.object({
  name: z.string().trim().min(2).max(120),
  startDate: z.string().trim().min(8).max(32),
  endDate: z.string().trim().min(8).max(32),
  activate: z.boolean().optional()
});

const termUpdateSchema = termSchema.partial();

const profileSchema = z.object({
  termId: z.number().int().positive().optional(),
  participantType: z.enum(['student', 'teacher']).optional(),
  matchingMode: z.enum(['direct', 'ranking']).optional(),
  campus: z.enum(['仙林', '鼓楼', '苏州', '浦口', '其它']).optional().nullable(),
  skillLevel: z.string().trim().max(1000).optional().nullable(),
  learningGoals: z.string().trim().max(1000).optional().nullable(),
  budgetExpectation: z.string().trim().max(128).optional().nullable(),
  budgetMin: z.number().int().min(0).optional().nullable(),
  budgetMax: z.number().int().min(0).optional().nullable(),
  teachingExperience: z.string().trim().max(1000).optional().nullable(),
  skillSpecialization: z.string().trim().max(1000).optional().nullable(),
  feeExpectation: z.string().trim().max(128).optional().nullable(),
  feeMin: z.number().int().min(0).optional().nullable(),
  feeMax: z.number().int().min(0).optional().nullable(),
  capacity: z.number().int().positive().max(100).optional().nullable(),
  directTargetUserId: z.number().int().positive().optional().nullable(),
  studentSkillLevel: z.number().int().min(0).max(19).optional().nullable(),
  teacherSkillMin: z.number().int().min(0).max(19).optional().nullable(),
  teacherSkillMax: z.number().int().min(0).max(19).optional().nullable()
});

const availabilitySchema = z.object({
  termId: z.number().int().positive().optional(),
  slotIds: z.array(z.number().int().positive()).max(200)
});

const rankingSchema = z.object({
  termId: z.number().int().positive().optional(),
  targetUserIds: z.array(z.number().int().positive()).max(200)
});

const qualificationSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
  feedback: z.string().trim().max(1000).optional().nullable()
});

const generateSchema = z.object({
  changeSummary: z.string().trim().max(300).optional(),
  termId: z.number().int().positive().optional()
});

const manualSchema = z.object({
  studentUserId: z.number().int().positive(),
  teacherUserId: z.number().int().positive().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  changeSummary: z.string().trim().max(300).optional()
});

function optionalNumber(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return Number(value);
}

function sendCsv(res, fileName, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.status(200).send(csv);
}

router.use(authenticate);

router.get('/class-matching/terms', (req, res, next) => {
  try {
    res.json(listClassMatchingTerms());
  } catch (err) {
    next(err);
  }
});

router.get('/class-matching/overview', (req, res, next) => {
  try {
    const termId = resolveClassMatchingTermId(db, req.query.termId);
    res.json(getUserClassMatchingOverview({ termId, userId: req.user.id }));
  } catch (err) {
    next(err);
  }
});

router.put('/class-matching/profile', (req, res, next) => {
  try {
    const parsed = profileSchema.parse({
      termId: optionalNumber(req.body.termId),
      participantType: req.body.participantType,
      matchingMode: req.body.matchingMode,
      campus: req.body.campus ?? undefined,
      skillLevel: req.body.skillLevel ?? undefined,
      learningGoals: req.body.learningGoals ?? undefined,
      budgetExpectation: req.body.budgetExpectation ?? undefined,
      budgetMin: optionalNumber(req.body.budgetMin),
      budgetMax: optionalNumber(req.body.budgetMax),
      teachingExperience: req.body.teachingExperience ?? undefined,
      skillSpecialization: req.body.skillSpecialization ?? undefined,
      feeExpectation: req.body.feeExpectation ?? undefined,
      feeMin: optionalNumber(req.body.feeMin),
      feeMax: optionalNumber(req.body.feeMax),
      capacity: optionalNumber(req.body.capacity),
      directTargetUserId: optionalNumber(req.body.directTargetUserId),
      studentSkillLevel: optionalNumber(req.body.studentSkillLevel),
      teacherSkillMin: optionalNumber(req.body.teacherSkillMin),
      teacherSkillMax: optionalNumber(req.body.teacherSkillMax)
    });
    const termId = resolveClassMatchingTermId(db, parsed.termId);
    const profile = saveUserClassMatchingProfile({ termId, userId: req.user.id, input: parsed });
    res.json({ termId, profile });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid class matching profile payload', details: err.issues });
    }
    next(err);
  }
});

router.post('/class-matching/availability', (req, res, next) => {
  try {
    const parsed = availabilitySchema.parse({
      termId: optionalNumber(req.body.termId),
      slotIds: Array.isArray(req.body.slotIds) ? req.body.slotIds.map((item) => Number(item)) : []
    });
    const termId = resolveClassMatchingTermId(db, parsed.termId);
    res.json(saveUserClassMatchingAvailability({ termId, userId: req.user.id, slotIds: parsed.slotIds }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid class matching availability payload', details: err.issues });
    }
    next(err);
  }
});

router.post('/class-matching/rankings', (req, res, next) => {
  try {
    const parsed = rankingSchema.parse({
      termId: optionalNumber(req.body.termId),
      targetUserIds: Array.isArray(req.body.targetUserIds) ? req.body.targetUserIds.map((item) => Number(item)) : []
    });
    const termId = resolveClassMatchingTermId(db, parsed.termId);
    res.json(saveUserClassMatchingRankings({ termId, userId: req.user.id, targetUserIds: parsed.targetUserIds }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid class matching ranking payload', details: err.issues });
    }
    next(err);
  }
});

router.use(requireRole('admin'));

router.get('/admin/class-matching/terms', (req, res, next) => {
  try {
    res.json(listClassMatchingTerms());
  } catch (err) {
    next(err);
  }
});

router.post('/admin/class-matching/terms', (req, res, next) => {
  try {
    const parsed = termSchema.parse({ ...req.body, activate: req.body.activate === undefined ? true : Boolean(req.body.activate) });
    res.status(201).json(createClassMatchingTerm(parsed));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid class matching term payload', details: err.issues });
    }
    next(err);
  }
});

router.patch('/admin/class-matching/terms/:termId(\\d+)', (req, res, next) => {
  try {
    const parsed = termUpdateSchema.parse({
      name: req.body.name,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      activate: req.body.activate === undefined ? undefined : Boolean(req.body.activate)
    });
    res.json(updateClassMatchingTerm({ termId: Number(req.params.termId), ...parsed }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid class matching term update payload', details: err.issues });
    }
    next(err);
  }
});

router.delete('/admin/class-matching/terms/:termId(\\d+)', (req, res, next) => {
  try {
    res.json(deleteClassMatchingTerm(Number(req.params.termId)));
  } catch (err) {
    next(err);
  }
});

router.get('/admin/class-matching/terms/:termId(\\d+)/overview', (req, res, next) => {
  try {
    res.json(getAdminClassMatchingOverview(Number(req.params.termId)));
  } catch (err) {
    next(err);
  }
});

router.patch('/admin/class-matching/terms/:termId(\\d+)/teachers/:teacherUserId(\\d+)/qualification', (req, res, next) => {
  try {
    const parsed = qualificationSchema.parse({
      status: req.body.status,
      feedback: req.body.feedback ?? undefined
    });
    res.json(
      updateTeacherQualification({
        termId: Number(req.params.termId),
        teacherUserId: Number(req.params.teacherUserId),
        status: parsed.status,
        feedback: parsed.feedback,
        adminId: req.user.id
      })
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid teacher qualification payload', details: err.issues });
    }
    next(err);
  }
});

router.post('/admin/class-matching/terms/:termId(\\d+)/generate', (req, res, next) => {
  try {
    const parsed = generateSchema.parse({
      termId: Number(req.params.termId),
      changeSummary: req.body.changeSummary
    });
    res.status(201).json(generateClassMatchingVersion({ termId: parsed.termId, adminId: req.user.id, changeSummary: parsed.changeSummary }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid class matching generate payload', details: err.issues });
    }
    next(err);
  }
});

router.post('/admin/class-matching/terms/:termId(\\d+)/incremental', (req, res, next) => {
  try {
    const parsed = generateSchema.parse({
      termId: Number(req.params.termId),
      changeSummary: req.body.changeSummary
    });
    res.status(201).json(incrementalClassMatching({ termId: parsed.termId, adminId: req.user.id, changeSummary: parsed.changeSummary }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid class matching incremental payload', details: err.issues });
    }
    next(err);
  }
});

router.post('/admin/class-matching/terms/:termId(\\d+)/manual', (req, res, next) => {
  try {
    const parsed = manualSchema.parse({
      studentUserId: Number(req.body.studentUserId),
      teacherUserId: optionalNumber(req.body.teacherUserId),
      notes: req.body.notes ?? undefined,
      changeSummary: req.body.changeSummary
    });
    res.status(201).json(manualAdjustClassMatching({ termId: Number(req.params.termId), adminId: req.user.id, ...parsed }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid class matching manual adjustment payload', details: err.issues });
    }
    next(err);
  }
});

router.get('/admin/class-matching/terms/:termId(\\d+)/versions', (req, res, next) => {
  try {
    res.json({
      items: getAdminClassMatchingOverview(Number(req.params.termId)).versions
    });
  } catch (err) {
    next(err);
  }
});

router.get('/admin/class-matching/terms/:termId(\\d+)/versions/:versionId(\\d+)', (req, res, next) => {
  try {
    res.json(getClassMatchingVersionDetail({ termId: Number(req.params.termId), versionId: Number(req.params.versionId) }));
  } catch (err) {
    next(err);
  }
});

router.get('/admin/class-matching/terms/:termId(\\d+)/compare', (req, res, next) => {
  try {
    const fromVersionId = Number(req.query.fromVersionId);
    const toVersionId = Number(req.query.toVersionId);
    if (!Number.isInteger(fromVersionId) || !Number.isInteger(toVersionId)) {
      throw new HttpError(400, 'fromVersionId and toVersionId are required');
    }
    res.json(compareClassMatchingVersions({ termId: Number(req.params.termId), fromVersionId, toVersionId }));
  } catch (err) {
    next(err);
  }
});

router.post('/admin/class-matching/terms/:termId(\\d+)/versions/:versionId(\\d+)/restore', (req, res, next) => {
  try {
    res.status(201).json(
      restoreClassMatchingVersion({
        termId: Number(req.params.termId),
        versionId: Number(req.params.versionId),
        adminId: req.user.id,
        changeSummary: req.body.changeSummary
      })
    );
  } catch (err) {
    next(err);
  }
});

router.get('/admin/class-matching/terms/:termId(\\d+)/export', (req, res, next) => {
  try {
    const versionId = req.query.versionId ? Number(req.query.versionId) : null;
    const { fileName, csv } = exportClassMatchingCsv({ termId: Number(req.params.termId), versionId });
    sendCsv(res, fileName, csv);
  } catch (err) {
    next(err);
  }
});

export default router;
