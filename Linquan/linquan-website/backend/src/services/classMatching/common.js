import db from '../../config/db.js';
import HttpError from '../../utils/httpError.js';
import { currentUtcIsoString } from '../../utils/dateTime.js';

export const DEFAULT_TEACHER_CAPACITY = 1;

function mapBoolean(value) {
  return Boolean(Number(value || 0));
}

function isSqliteUniqueConstraint(err, tableName = '', columnName = '') {
  const message = String(err?.message || '');
  if (!/SQLITE_CONSTRAINT_UNIQUE|UNIQUE constraint failed/i.test(message)) {
    return false;
  }
  if (!tableName) {
    return true;
  }
  const target = columnName ? `${tableName}.${columnName}` : tableName;
  return message.includes(target);
}

export function clampCapacity(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_TEACHER_CAPACITY;
  }
  return parsed;
}

export function listTerms() {
  return db
    .prepare(
      `SELECT
         id,
         name,
         start_date AS "startDate",
         end_date AS "endDate",
         is_active AS "isActive",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM class_matching_terms
       ORDER BY is_active DESC, start_date DESC, id DESC`
    )
    .all()
    .map((item) => ({
      ...item,
      isActive: mapBoolean(item.isActive)
    }));
}

export function getTerm(termId) {
  const row = db
    .prepare(
      `SELECT
         id,
         name,
         start_date AS "startDate",
         end_date AS "endDate",
         is_active AS "isActive",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM class_matching_terms
       WHERE id = ?`
    )
    .get(termId);
  if (!row) {
    throw new HttpError(404, 'Class matching term not found');
  }
  return {
    ...row,
    isActive: mapBoolean(row.isActive)
  };
}

export function createTerm({ name, startDate, endDate, activate }) {
  if (endDate < startDate) {
    throw new HttpError(400, 'End date must be on or after the start date');
  }
  const nowUtc = currentUtcIsoString();
  const tx = db.transaction(() => {
    if (activate) {
      db.prepare('UPDATE class_matching_terms SET is_active = 0, updated_at = ?').run(nowUtc);
    }
    const result = db
      .prepare(
        `INSERT INTO class_matching_terms (name, start_date, end_date, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(name, startDate, endDate, activate ? 1 : 0, nowUtc, nowUtc);
    const termId = Number(result.lastInsertRowid);
    const insertSlots = db.prepare(
      'INSERT OR IGNORE INTO class_matching_slots (term_id, day_of_week, hour) VALUES (?, ?, ?)'
    );
    for (let day = 0; day <= 6; day += 1) {
      for (let hour = 8; hour <= 21; hour += 1) {
        insertSlots.run(termId, day, hour);
      }
    }
    return termId;
  });
  try {
    return getTerm(tx());
  } catch (err) {
    if (isSqliteUniqueConstraint(err, 'class_matching_terms', 'name')) {
      throw new HttpError(409, 'A class matching term with this name already exists. Please choose a different name.');
    }
    throw err;
  }
}

export function updateTerm({ termId, name, startDate, endDate, activate }) {
  const current = getTerm(termId);
  if ((endDate || current.endDate) < (startDate || current.startDate)) {
    throw new HttpError(400, 'End date must be on or after the start date');
  }
  const nowUtc = currentUtcIsoString();
  const tx = db.transaction(() => {
    if (activate) {
      db.prepare('UPDATE class_matching_terms SET is_active = 0, updated_at = ?').run(nowUtc);
    }
    db.prepare(
      `UPDATE class_matching_terms
       SET name = ?, start_date = ?, end_date = ?, is_active = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      name ?? current.name,
      startDate ?? current.startDate,
      endDate ?? current.endDate,
      activate === undefined ? (current.isActive ? 1 : 0) : activate ? 1 : 0,
      nowUtc,
      termId
    );
  });
  try {
    tx();
    return getTerm(termId);
  } catch (err) {
    if (isSqliteUniqueConstraint(err, 'class_matching_terms', 'name')) {
      throw new HttpError(409, 'A class matching term with this name already exists. Please choose a different name.');
    }
    throw err;
  }
}

export function deleteTerm(termId) {
  getTerm(termId);
  db.prepare('DELETE FROM class_matching_terms WHERE id = ?').run(termId);
  return { termId };
}

export function loadBaseProfile(userId) {
  return (
    db
      .prepare(
        `SELECT
           u.id AS "userId",
           u.student_number AS "studentNumber",
           u.email,
           COALESCE(p.display_name, u.student_number) AS "displayName",
           p.avatar_url AS "avatarUrl",
           p.photo_url AS "photoUrl",
           p.bio,
           p.grade,
           p.major,
           p.academy,
           p.hobbies,
           p.piano_interests AS "pianoInterests",
           p.wechat_account AS "wechatAccount",
           p.phone,
           p.campus
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE u.id = ?`
      )
      .get(userId) || null
  );
}

export function loadParticipantProfiles(termId) {
  return db
    .prepare(
      `SELECT
         cmp.id,
         cmp.term_id AS "termId",
         cmp.user_id AS "userId",
         u.student_number AS "studentNumber",
         COALESCE(p.display_name, u.student_number) AS "displayName",
         p.avatar_url AS "avatarUrl",
         p.bio,
         p.grade,
         p.major,
         p.academy,
         COALESCE(p.campus, cmp.campus) AS "campus",
         cmp.participant_type AS "participantType",
         cmp.matching_mode AS "matchingMode",
         cmp.skill_level AS "skillLevel",
         cmp.learning_goals AS "learningGoals",
         cmp.budget_expectation AS "budgetExpectation",
         cmp.budget_min AS "budgetMin",
         cmp.budget_max AS "budgetMax",
         cmp.teaching_experience AS "teachingExperience",
         cmp.skill_specialization AS "skillSpecialization",
         cmp.fee_expectation AS "feeExpectation",
         cmp.fee_min AS "feeMin",
         cmp.fee_max AS "feeMax",
         cmp.capacity,
         cmp.direct_target_user_id AS "directTargetUserId",
         cmp.student_skill_level AS "studentSkillLevel",
         cmp.teacher_skill_min AS "teacherSkillMin",
         cmp.teacher_skill_max AS "teacherSkillMax",
         cmp.qualification_status AS "qualificationStatus",
         cmp.qualification_feedback AS "qualificationFeedback",
         cmp.reviewed_by AS "reviewedBy",
         cmp.reviewed_at AS "reviewedAt",
         cmp.created_at AS "createdAt",
         cmp.updated_at AS "updatedAt"
       FROM class_matching_profiles cmp
       JOIN users u ON u.id = cmp.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE cmp.term_id = ?
       ORDER BY cmp.participant_type ASC, u.student_number ASC`
    )
    .all(termId)
    .map((item) => ({
      ...item,
      capacity: item.participantType === 'teacher' ? clampCapacity(item.capacity) : null
    }));
}

export function loadParticipantProfile(termId, userId) {
  return (
    db
      .prepare(
        `SELECT
           id,
           term_id AS "termId",
           user_id AS "userId",
           participant_type AS "participantType",
           matching_mode AS "matchingMode",
           campus,
           skill_level AS "skillLevel",
           learning_goals AS "learningGoals",
           budget_expectation AS "budgetExpectation",
           budget_min AS "budgetMin",
           budget_max AS "budgetMax",
           teaching_experience AS "teachingExperience",
           skill_specialization AS "skillSpecialization",
           fee_expectation AS "feeExpectation",
           fee_min AS "feeMin",
           fee_max AS "feeMax",
           capacity,
           direct_target_user_id AS "directTargetUserId",
           student_skill_level AS "studentSkillLevel",
           teacher_skill_min AS "teacherSkillMin",
           teacher_skill_max AS "teacherSkillMax",
           qualification_status AS "qualificationStatus",
           qualification_feedback AS "qualificationFeedback",
           reviewed_by AS "reviewedBy",
           reviewed_at AS "reviewedAt",
           created_at AS "createdAt",
           updated_at AS "updatedAt"
         FROM class_matching_profiles
         WHERE term_id = ? AND user_id = ?`
      )
      .get(termId, userId) || null
  );
}

export function loadTermSlots(termId, userId = null) {
  return db
    .prepare(
      `SELECT
         slots.id,
         slots.day_of_week AS "dayOfWeek",
         slots.hour,
         COALESCE(counts.count, 0) AS "selectedCount",
         CASE WHEN mine.slot_id IS NULL THEN 0 ELSE 1 END AS "selectedByMe"
       FROM class_matching_slots slots
       LEFT JOIN (
         SELECT slot_id, COUNT(*) AS count
         FROM class_matching_availability
         WHERE term_id = ?
         GROUP BY slot_id
       ) counts ON counts.slot_id = slots.id
       LEFT JOIN class_matching_availability mine
         ON mine.term_id = ?
        AND mine.user_id = ?
        AND mine.slot_id = slots.id
       WHERE slots.term_id = ?
       ORDER BY slots.day_of_week ASC, slots.hour ASC`
    )
    .all(termId, termId, userId || -1, termId)
    .map((item) => ({
      ...item,
      selectedByMe: mapBoolean(item.selectedByMe)
    }));
}

export function loadAvailabilityIds(termId, userId) {
  return db
    .prepare(
      `SELECT slot_id AS "slotId"
       FROM class_matching_availability
       WHERE term_id = ? AND user_id = ?
       ORDER BY slot_id ASC`
    )
    .all(termId, userId)
    .map((row) => row.slotId);
}

export function loadRankingIds(termId, userId) {
  return db
    .prepare(
      `SELECT target_user_id AS "targetUserId"
       FROM class_matching_rankings
       WHERE term_id = ? AND user_id = ?
       ORDER BY rank_order ASC`
    )
    .all(termId, userId)
    .map((row) => row.targetUserId);
}

export function loadAvailabilityMap(termId) {
  const rows = db
    .prepare(
      `SELECT user_id AS "userId", slot_id AS "slotId"
       FROM class_matching_availability
       WHERE term_id = ?`
    )
    .all(termId);
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.userId)) {
      map.set(row.userId, new Set());
    }
    map.get(row.userId).add(row.slotId);
  }
  return map;
}

export function loadRankingsMap(termId) {
  const rows = db
    .prepare(
      `SELECT
         user_id AS "userId",
         target_user_id AS "targetUserId",
         rank_order AS "rankOrder"
       FROM class_matching_rankings
       WHERE term_id = ?
       ORDER BY user_id ASC, rank_order ASC`
    )
    .all(termId);
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.userId)) {
      map.set(row.userId, []);
    }
    map.get(row.userId).push({
      targetUserId: row.targetUserId,
      rankOrder: row.rankOrder
    });
  }
  return map;
}

export function buildCandidateLists(termId, currentUserId) {
  const profiles = loadParticipantProfiles(termId);
  const teacherCandidates = profiles
    .filter((item) => item.participantType === 'teacher' && item.userId !== currentUserId)
    .filter((item) => item.qualificationStatus === 'approved')
    .map((item) => ({
      userId: item.userId,
      studentNumber: item.studentNumber,
      displayName: item.displayName,
      campus: item.campus,
      matchingMode: item.matchingMode,
      capacity: item.capacity,
      skillSpecialization: item.skillSpecialization,
      feeExpectation: item.feeExpectation,
      feeMin: item.feeMin,
      feeMax: item.feeMax,
      teacherSkillMin: item.teacherSkillMin,
      teacherSkillMax: item.teacherSkillMax,
      qualificationStatus: item.qualificationStatus
    }));
  const studentCandidates = profiles
    .filter((item) => item.participantType === 'student' && item.userId !== currentUserId)
    .map((item) => ({
      userId: item.userId,
      studentNumber: item.studentNumber,
      displayName: item.displayName,
      campus: item.campus,
      matchingMode: item.matchingMode,
      skillLevel: item.skillLevel,
      learningGoals: item.learningGoals,
      budgetMin: item.budgetMin,
      budgetMax: item.budgetMax,
      studentSkillLevel: item.studentSkillLevel
    }));

  return { teacherCandidates, studentCandidates };
}

export function validateOppositeTarget(termId, currentUserId, participantType, targetUserId) {
  if (!targetUserId) {
    return null;
  }
  const target = loadParticipantProfile(termId, targetUserId);
  if (!target) {
    throw new HttpError(400, 'Direct target must already join this class matching term');
  }
  if (target.userId === currentUserId) {
    throw new HttpError(400, 'Direct target cannot be yourself');
  }
  const expectedType = participantType === 'student' ? 'teacher' : 'student';
  if (target.participantType !== expectedType) {
    throw new HttpError(400, 'Direct target must be the opposite participant type');
  }
  if (participantType === 'student' && target.qualificationStatus !== 'approved') {
    throw new HttpError(400, 'Direct target teacher must be approved by admin');
  }
  return target;
}

export function assertValidSlotIds(termId, slotIds) {
  const uniqueSlotIds = [...new Set(slotIds.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))];
  if (uniqueSlotIds.length === 0) {
    return [];
  }
  const placeholders = uniqueSlotIds.map(() => '?').join(', ');
  const rows = db
    .prepare(
      `SELECT id
       FROM class_matching_slots
       WHERE term_id = ? AND id IN (${placeholders})`
    )
    .all(termId, ...uniqueSlotIds);
  if (rows.length !== uniqueSlotIds.length) {
    throw new HttpError(400, 'One or more availability slotIds do not belong to the selected term');
  }
  return uniqueSlotIds;
}

export function assertValidRankingTargets(termId, userId, participantType, targetUserIds) {
  const expectedType = participantType === 'student' ? 'teacher' : 'student';
  const uniqueIds = [...new Set(targetUserIds.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))];
  if (uniqueIds.length === 0) {
    return [];
  }
  const placeholders = uniqueIds.map(() => '?').join(', ');
  const rows = db
    .prepare(
      `SELECT
         user_id AS "userId",
         participant_type AS "participantType",
         qualification_status AS "qualificationStatus"
       FROM class_matching_profiles
       WHERE term_id = ? AND user_id IN (${placeholders})`
    )
    .all(termId, ...uniqueIds);
  if (rows.length !== uniqueIds.length) {
    throw new HttpError(400, 'One or more ranking targets have not joined this term');
  }
  for (const row of rows) {
    if (row.userId === userId) {
      throw new HttpError(400, 'Ranking target cannot be yourself');
    }
    if (row.participantType !== expectedType) {
      throw new HttpError(400, 'Ranking targets must be the opposite participant type');
    }
    const targetProfile = loadParticipantProfile(termId, row.userId);
    if (targetProfile?.matchingMode !== 'ranking') {
      throw new HttpError(400, 'Ranking targets must also use ranking mode in this term');
    }
    if (participantType === 'student' && row.qualificationStatus !== 'approved') {
      throw new HttpError(400, 'Students can only rank approved teachers');
    }
  }
  return uniqueIds;
}

export function saveProfile({ termId, userId, input }) {
  getTerm(termId);
  const nowUtc = currentUtcIsoString();
  const current = loadParticipantProfile(termId, userId);
  const nextParticipantType = input.participantType ?? current?.participantType;
  if (!nextParticipantType || !['student', 'teacher'].includes(nextParticipantType)) {
    throw new HttpError(400, 'participantType must be student or teacher');
  }
  const nextMatchingMode = input.matchingMode ?? current?.matchingMode ?? 'ranking';
  if (!['direct', 'ranking'].includes(nextMatchingMode)) {
    throw new HttpError(400, 'matchingMode must be direct or ranking');
  }

  const campusValue = Object.prototype.hasOwnProperty.call(input, 'campus')
    ? input.campus
    : current?.campus || null;
  if (campusValue && !['仙林', '鼓楼', '苏州', '浦口', '其它'].includes(campusValue)) {
    throw new HttpError(400, 'Invalid campus value');
  }

  const budgetMin = Object.prototype.hasOwnProperty.call(input, 'budgetMin')
    ? input.budgetMin
    : current?.budgetMin ?? null;
  const budgetMax = Object.prototype.hasOwnProperty.call(input, 'budgetMax')
    ? input.budgetMax
    : current?.budgetMax ?? null;
  if (budgetMin != null && budgetMax != null && Number(budgetMin) > Number(budgetMax)) {
    throw new HttpError(400, 'budgetMin must not exceed budgetMax');
  }

  const feeMin = Object.prototype.hasOwnProperty.call(input, 'feeMin')
    ? input.feeMin
    : current?.feeMin ?? null;
  const feeMax = Object.prototype.hasOwnProperty.call(input, 'feeMax')
    ? input.feeMax
    : current?.feeMax ?? null;
  if (feeMin != null && feeMax != null && Number(feeMin) > Number(feeMax)) {
    throw new HttpError(400, 'feeMin must not exceed feeMax');
  }

  const studentSkillLevel = Object.prototype.hasOwnProperty.call(input, 'studentSkillLevel')
    ? input.studentSkillLevel
    : current?.studentSkillLevel ?? null;
  const teacherSkillMin = Object.prototype.hasOwnProperty.call(input, 'teacherSkillMin')
    ? input.teacherSkillMin
    : current?.teacherSkillMin ?? null;
  const teacherSkillMax = Object.prototype.hasOwnProperty.call(input, 'teacherSkillMax')
    ? input.teacherSkillMax
    : current?.teacherSkillMax ?? null;
  if (teacherSkillMin != null && teacherSkillMax != null && Number(teacherSkillMin) > Number(teacherSkillMax)) {
    throw new HttpError(400, 'teacherSkillMin must not exceed teacherSkillMax');
  }

  const directTargetUserId =
    Object.prototype.hasOwnProperty.call(input, 'directTargetUserId')
      ? (input.directTargetUserId ? Number(input.directTargetUserId) : null)
      : current?.directTargetUserId || null;
  validateOppositeTarget(termId, userId, nextParticipantType, directTargetUserId);

  const qualificationStatus = nextParticipantType === 'teacher' ? current?.qualificationStatus || 'pending' : 'pending';
  const values = {
    campus: campusValue,
    skillLevel: Object.prototype.hasOwnProperty.call(input, 'skillLevel') ? input.skillLevel : current?.skillLevel || null,
    learningGoals: Object.prototype.hasOwnProperty.call(input, 'learningGoals') ? input.learningGoals : current?.learningGoals || null,
    budgetExpectation: Object.prototype.hasOwnProperty.call(input, 'budgetExpectation')
      ? input.budgetExpectation
      : current?.budgetExpectation || null,
    budgetMin: budgetMin,
    budgetMax: budgetMax,
    teachingExperience: Object.prototype.hasOwnProperty.call(input, 'teachingExperience')
      ? input.teachingExperience
      : current?.teachingExperience || null,
    skillSpecialization: Object.prototype.hasOwnProperty.call(input, 'skillSpecialization')
      ? input.skillSpecialization
      : current?.skillSpecialization || null,
    feeExpectation: Object.prototype.hasOwnProperty.call(input, 'feeExpectation')
      ? input.feeExpectation
      : current?.feeExpectation || null,
    feeMin: feeMin,
    feeMax: feeMax,
    capacity: nextParticipantType === 'teacher'
      ? clampCapacity(Object.prototype.hasOwnProperty.call(input, 'capacity') ? input.capacity : current?.capacity)
      : null,
    studentSkillLevel: studentSkillLevel,
    teacherSkillMin: teacherSkillMin,
    teacherSkillMax: teacherSkillMax
  };
  const shouldClearRankings = nextMatchingMode === 'direct';

  const tx = db.transaction(() => {
    if (current) {
      db.prepare(
        `UPDATE class_matching_profiles
         SET participant_type = ?, matching_mode = ?, campus = ?, skill_level = ?, learning_goals = ?, budget_expectation = ?,
             budget_min = ?, budget_max = ?, teaching_experience = ?, skill_specialization = ?, fee_expectation = ?,
             fee_min = ?, fee_max = ?, capacity = ?, direct_target_user_id = ?, student_skill_level = ?, teacher_skill_min = ?,
             teacher_skill_max = ?, qualification_status = ?, updated_at = ?
         WHERE term_id = ? AND user_id = ?`
      ).run(
        nextParticipantType,
        nextMatchingMode,
        values.campus,
        values.skillLevel,
        values.learningGoals,
        values.budgetExpectation,
        values.budgetMin,
        values.budgetMax,
        values.teachingExperience,
        values.skillSpecialization,
        values.feeExpectation,
        values.feeMin,
        values.feeMax,
        values.capacity,
        nextMatchingMode === 'direct' ? directTargetUserId : null,
        values.studentSkillLevel,
        values.teacherSkillMin,
        values.teacherSkillMax,
        qualificationStatus,
        nowUtc,
        termId,
        userId
      );
      if (shouldClearRankings) {
        db.prepare('DELETE FROM class_matching_rankings WHERE term_id = ? AND user_id = ?').run(termId, userId);
      }
      return;
    }

    db.prepare(
      `INSERT INTO class_matching_profiles (
         term_id, user_id, participant_type, matching_mode, campus, skill_level, learning_goals, budget_expectation,
         budget_min, budget_max, teaching_experience, skill_specialization, fee_expectation, fee_min, fee_max,
         capacity, direct_target_user_id, student_skill_level, teacher_skill_min, teacher_skill_max,
         qualification_status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      termId,
      userId,
      nextParticipantType,
      nextMatchingMode,
      values.campus,
      values.skillLevel,
      values.learningGoals,
      values.budgetExpectation,
      values.budgetMin,
      values.budgetMax,
      values.teachingExperience,
      values.skillSpecialization,
      values.feeExpectation,
      values.feeMin,
      values.feeMax,
      values.capacity,
      nextMatchingMode === 'direct' ? directTargetUserId : null,
      values.studentSkillLevel,
      values.teacherSkillMin,
      values.teacherSkillMax,
      qualificationStatus,
      nowUtc,
      nowUtc
    );
    if (shouldClearRankings) {
      db.prepare('DELETE FROM class_matching_rankings WHERE term_id = ? AND user_id = ?').run(termId, userId);
    }
  });
  tx();

  return loadParticipantProfile(termId, userId);
}

export function saveAvailability({ termId, userId, slotIds }) {
  getTerm(termId);
  const profile = loadParticipantProfile(termId, userId);
  if (!profile) {
    throw new HttpError(400, 'Please complete class matching profile first');
  }
  const validSlotIds = assertValidSlotIds(termId, slotIds);
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM class_matching_availability WHERE term_id = ? AND user_id = ?').run(termId, userId);
    const insert = db.prepare(
      `INSERT INTO class_matching_availability (term_id, user_id, slot_id, created_at)
       VALUES (?, ?, ?, ?)`
    );
    const nowUtc = currentUtcIsoString();
    for (const slotId of validSlotIds) {
      insert.run(termId, userId, slotId, nowUtc);
    }
  });
  tx();

  return { termId, userId, slotIds: validSlotIds };
}

export function saveRankings({ termId, userId, targetUserIds }) {
  getTerm(termId);
  const profile = loadParticipantProfile(termId, userId);
  if (!profile) {
    throw new HttpError(400, 'Please complete class matching profile first');
  }
  if (profile.matchingMode !== 'ranking') {
    throw new HttpError(400, 'Ranking preferences are only available in ranking mode');
  }
  const validTargetIds = assertValidRankingTargets(termId, userId, profile.participantType, targetUserIds);
  const nowUtc = currentUtcIsoString();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM class_matching_rankings WHERE term_id = ? AND user_id = ?').run(termId, userId);
    const insert = db.prepare(
      `INSERT INTO class_matching_rankings (term_id, user_id, target_user_id, rank_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    validTargetIds.forEach((targetUserId, index) => {
      insert.run(termId, userId, targetUserId, index + 1, nowUtc, nowUtc);
    });
  });
  tx();

  return { termId, userId, targetUserIds: validTargetIds };
}
