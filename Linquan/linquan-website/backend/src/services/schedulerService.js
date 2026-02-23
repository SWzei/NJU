import db from '../config/db.js';
import HttpError from '../utils/httpError.js';

function buildMemberPreferenceMap(members, preferences, validSlotIds) {
  const map = new Map();
  for (const member of members) {
    map.set(member.user_id, new Set());
  }

  for (const pref of preferences) {
    if (map.has(pref.user_id) && validSlotIds.has(pref.slot_id)) {
      map.get(pref.user_id).add(pref.slot_id);
    }
  }

  return map;
}

function chooseLowestDemandSlot(candidates, slotDemand) {
  return [...candidates].sort((a, b) => {
    const demandDiff = (slotDemand.get(a) || 0) - (slotDemand.get(b) || 0);
    if (demandDiff !== 0) {
      return demandDiff;
    }
    return a - b;
  })[0];
}

function chooseSecondSlot(candidates, slotDemand, slotMeta, existingAssignments) {
  return [...candidates].sort((a, b) => {
    const scoreA = scoreSecondAssignment(a, slotDemand, slotMeta, existingAssignments);
    const scoreB = scoreSecondAssignment(b, slotDemand, slotMeta, existingAssignments);
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }
    return a - b;
  })[0];
}

function scoreSecondAssignment(slotId, slotDemand, slotMeta, existingAssignments) {
  const demandWeight = (slotDemand.get(slotId) || 0) * 10;
  const slot = slotMeta.get(slotId);
  if (!slot || existingAssignments.length === 0) {
    return demandWeight;
  }

  // Encourage hour continuity for a member to keep weekly plans practical.
  let adjacencyBonus = 0;
  for (const assignedSlotId of existingAssignments) {
    const assigned = slotMeta.get(assignedSlotId);
    if (!assigned) {
      continue;
    }
    if (assigned.day_of_week === slot.day_of_week) {
      const hourDistance = Math.abs(assigned.hour - slot.hour);
      if (hourDistance === 1) {
        adjacencyBonus = Math.max(adjacencyBonus, 6);
      } else if (hourDistance === 2) {
        adjacencyBonus = Math.max(adjacencyBonus, 2);
      }
    }
  }

  return demandWeight + adjacencyBonus;
}

export function generateProposedSchedule({ semesterId, adminId }) {
  const slotRows = db
    .prepare(
      'SELECT id, room_no, day_of_week, hour FROM room_slots WHERE semester_id = ? ORDER BY day_of_week, hour, room_no'
    )
    .all(semesterId);
  if (slotRows.length === 0) {
    throw new HttpError(400, 'No room slots configured for this semester');
  }

  const members = db
    .prepare(
      `SELECT DISTINCT u.id AS user_id
       FROM users u
       JOIN slot_preferences sp ON sp.user_id = u.id
       WHERE sp.semester_id = ? AND u.role = 'member'
       ORDER BY u.id`
    )
    .all(semesterId);
  if (members.length === 0) {
    throw new HttpError(400, 'No member preferences found for this semester');
  }

  const preferences = db
    .prepare('SELECT user_id, slot_id FROM slot_preferences WHERE semester_id = ?')
    .all(semesterId);

  const validSlotIds = new Set(slotRows.map((slot) => slot.id));
  const slotMeta = new Map(slotRows.map((slot) => [slot.id, slot]));
  const slotDemand = new Map();
  for (const pref of preferences) {
    if (validSlotIds.has(pref.slot_id)) {
      slotDemand.set(pref.slot_id, (slotDemand.get(pref.slot_id) || 0) + 1);
    }
  }

  const memberPrefs = buildMemberPreferenceMap(members, preferences, validSlotIds);
  const availableSlots = new Set(slotRows.map((slot) => slot.id));
  const assignmentsByUser = new Map(members.map((member) => [member.user_id, []]));

  // Phase 1: fairness-first, maximize users who get at least one slot.
  const phase1Members = [...members].sort((a, b) => {
    const prefDiff =
      memberPrefs.get(a.user_id).size - memberPrefs.get(b.user_id).size;
    if (prefDiff !== 0) {
      return prefDiff;
    }
    return a.user_id - b.user_id;
  });

  for (const member of phase1Members) {
    const preferred = memberPrefs.get(member.user_id);
    const candidates = [...preferred].filter((slotId) => availableSlots.has(slotId));
    if (candidates.length === 0) {
      continue;
    }
    const chosenSlotId = chooseLowestDemandSlot(candidates, slotDemand);
    assignmentsByUser.get(member.user_id).push(chosenSlotId);
    availableSlots.delete(chosenSlotId);
  }

  // Phase 2: assign a second slot where possible to improve utilization.
  const phase2Members = [...members].sort((a, b) => {
    const remainingA = [...memberPrefs.get(a.user_id)].filter((slotId) => availableSlots.has(slotId)).length;
    const remainingB = [...memberPrefs.get(b.user_id)].filter((slotId) => availableSlots.has(slotId)).length;
    if (remainingA !== remainingB) {
      return remainingA - remainingB;
    }
    return a.user_id - b.user_id;
  });

  for (const member of phase2Members) {
    const assigned = assignmentsByUser.get(member.user_id);
    if (assigned.length === 0 || assigned.length >= 2) {
      continue;
    }

    const preferred = memberPrefs.get(member.user_id);
    const candidates = [...preferred].filter(
      (slotId) => availableSlots.has(slotId) && !assigned.includes(slotId)
    );
    if (candidates.length === 0) {
      continue;
    }

    const chosenSlotId = chooseSecondSlot(candidates, slotDemand, slotMeta, assigned);
    assigned.push(chosenSlotId);
    availableSlots.delete(chosenSlotId);
  }

  const flatAssignments = [];
  for (const [userId, slots] of assignmentsByUser.entries()) {
    for (const slotId of slots) {
      flatAssignments.push({ userId, slotId });
    }
  }

  const membersWithAtLeastOne = [...assignmentsByUser.values()].filter((slots) => slots.length >= 1).length;
  const membersWithTwo = [...assignmentsByUser.values()].filter((slots) => slots.length >= 2).length;

  const tx = db.transaction(() => {
    const oldProposedBatches = db
      .prepare('SELECT id FROM schedule_batches WHERE semester_id = ? AND status = ?')
      .all(semesterId, 'proposed');

    for (const batch of oldProposedBatches) {
      db.prepare('DELETE FROM schedule_assignments WHERE batch_id = ?').run(batch.id);
      db.prepare('DELETE FROM schedule_batches WHERE id = ?').run(batch.id);
    }

    const batchResult = db
      .prepare(
        `INSERT INTO schedule_batches (semester_id, status, created_by, note)
         VALUES (?, 'proposed', ?, ?)`
      )
      .run(
        semesterId,
        adminId || null,
        'Auto-generated by fairness-first scheduler'
      );
    const batchId = Number(batchResult.lastInsertRowid);

    const insertAssignment = db.prepare(
      `INSERT INTO schedule_assignments (batch_id, semester_id, user_id, slot_id, status)
       VALUES (?, ?, ?, ?, 'proposed')`
    );
    for (const assignment of flatAssignments) {
      insertAssignment.run(batchId, semesterId, assignment.userId, assignment.slotId);
    }

    return batchId;
  });

  const batchId = tx();

  return {
    batchId,
    stats: {
      totalMembers: members.length,
      membersWithAtLeastOne,
      membersWithTwo,
      unassignedMembers: members.length - membersWithAtLeastOne,
      totalAssignments: flatAssignments.length
    }
  };
}

export function publishScheduleBatch({ batchId, adminId }) {
  const batch = db
    .prepare(
      'SELECT id, semester_id, status FROM schedule_batches WHERE id = ?'
    )
    .get(batchId);
  if (!batch) {
    throw new HttpError(404, 'Schedule batch not found');
  }
  if (batch.status !== 'proposed') {
    throw new HttpError(400, 'Only proposed batches can be published');
  }

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE schedule_batches
       SET status = 'published', published_by = ?, published_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(adminId || null, batchId);

    db.prepare(
      `UPDATE schedule_assignments
       SET status = 'published', updated_at = CURRENT_TIMESTAMP
       WHERE batch_id = ?`
    ).run(batchId);
  });
  tx();

  const assignmentUsers = db
    .prepare('SELECT DISTINCT user_id FROM schedule_assignments WHERE batch_id = ?')
    .all(batchId)
    .map((row) => row.user_id);

  return {
    semesterId: batch.semester_id,
    userIds: assignmentUsers
  };
}
