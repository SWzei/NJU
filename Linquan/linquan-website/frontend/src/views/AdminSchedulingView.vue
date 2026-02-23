<template>
  <section class="grid-2">
    <article class="card panel">
      <h2 class="section-title">{{ t('admin.createSemester') }}</h2>
      <form class="form" @submit.prevent="createSemester">
        <div class="field">
          <label>{{ t('admin.semesterName') }}</label>
          <input v-model.trim="semester.name" required />
        </div>
        <div class="row">
          <div class="field field-half">
            <label>{{ t('admin.startDate') }}</label>
            <input type="date" v-model="semester.startDate" required />
          </div>
          <div class="field field-half">
            <label>{{ t('admin.endDate') }}</label>
            <input type="date" v-model="semester.endDate" required />
          </div>
        </div>
        <label class="toggle">
          <input type="checkbox" v-model="semester.activate" />
          {{ t('admin.setActive') }}
        </label>
        <button class="btn">{{ t('admin.createSemesterButton') }}</button>
      </form>
    </article>

    <article class="card panel">
      <h2 class="section-title">{{ t('admin.schedulingControl') }}</h2>
      <p class="subtle" v-if="currentSemester">
        {{
          t('admin.currentSemesterInfo', {
            name: currentSemester.name,
            start: currentSemester.startDate,
            end: currentSemester.endDate
          })
        }}
      </p>
      <p class="subtle" v-else>{{ t('admin.noCurrentSemester') }}</p>
      <div class="row controls">
        <button class="btn" @click="runSchedule">{{ t('admin.runSchedule') }}</button>
        <button class="btn warn" @click="publishSchedule">{{ t('admin.publishSchedule') }}</button>
        <button class="btn secondary" :disabled="exporting || !proposedBatch" @click="downloadCalendar">
          {{ exporting ? t('admin.downloading') : t('admin.downloadCalendar') }}
        </button>
      </div>
      <div class="field">
        <label>{{ t('admin.publishBatchId') }}</label>
        <input type="number" v-model.number="publishBatchId" />
      </div>
      <p class="subtle" v-if="proposedBatch">
        {{ t('admin.proposedBatch', { id: proposedBatch.id, semesterId: proposedBatch.semesterId }) }}
      </p>
      <p class="subtle" v-else>{{ t('admin.noProposedSchedule') }}</p>
      <p class="subtle">{{ t('admin.calendarGuide') }}</p>

      <div class="field search-field">
        <label>{{ t('admin.memberSearch') }}</label>
        <input v-model.trim="memberKeyword" :placeholder="t('admin.memberSearchPlaceholder')" />
      </div>
      <p class="subtle">{{ t('admin.pickMemberToAssign') }}</p>
      <ul class="member-list">
        <li v-for="member in filteredMembers" :key="member.userId">
          <button
            class="member-btn"
            :class="{ active: selectedMemberId === member.userId }"
            @click="selectMember(member.userId)"
          >
            <span>{{ member.displayName }} ({{ member.studentNumber }})</span>
            <span class="subtle">{{ t('admin.assignedHours', { count: member.assignedCount }) }}</span>
          </button>
        </li>
      </ul>
      <p class="subtle" v-if="filteredMembers.length === 0">{{ t('admin.noMemberMatch') }}</p>

      <p class="selected" v-if="selectedMember">
        {{ t('admin.selectedMember', { name: selectedMember.displayName }) }}
      </p>
      <p class="selected" v-if="selectedAssignment">
        {{
          t('admin.selectedAssignment', {
            name: selectedAssignment.displayName,
            day: dayMap[selectedAssignment.dayOfWeek],
            hour: selectedAssignment.hour,
            room: selectedAssignment.roomNo
          })
        }}
      </p>
      <div class="row action-row" v-if="selectedAssignment">
        <button class="btn warn" :disabled="moving" @click="deleteSelectedAssignment">
          {{ t('admin.deleteSelectedSlot') }}
        </button>
      </div>
    </article>
  </section>

  <section class="calendar-board" v-if="proposedBatch && slots.length">
    <article class="card day-card" v-for="day in dayOptions" :key="day.value">
      <h3>{{ day.label }}</h3>
      <table class="calendar-table">
        <thead>
          <tr>
            <th>{{ t('schedule.headerTime') }}</th>
            <th>{{ t('schedule.headerRoom1') }}</th>
            <th>{{ t('schedule.headerRoom2') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="hour in hours" :key="`${day.value}-${hour}`">
            <td class="time-col">{{ hour }}:00</td>
            <td v-for="roomNo in [1, 2]" :key="roomNo">
              <button
                v-if="getSlot(day.value, hour, roomNo)"
                class="slot-btn"
                :class="slotClass(getSlot(day.value, hour, roomNo))"
                :disabled="moving"
                @click="onSlotClick(getSlot(day.value, hour, roomNo))"
              >
                <span class="count">
                  {{ t('schedule.selectedCount', { count: getSlot(day.value, hour, roomNo).selectedCount }) }}
                </span>
                <span class="name">
                  {{ getAssignment(getSlot(day.value, hour, roomNo).id)?.displayName || t('admin.unassigned') }}
                </span>
                <span class="hint">
                  {{ getAssignment(getSlot(day.value, hour, roomNo).id)?.studentNumber || t('admin.clickToMove') }}
                </span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  </section>

  <section class="card panel preview-panel" v-if="proposedBatch && calendarPreviewRows.length">
    <h2 class="section-title">{{ t('admin.calendarPreviewTitle') }}</h2>
    <p class="subtle">{{ t('admin.calendarPreviewSubtitle') }}</p>
    <div class="preview-wrap">
      <table class="preview-table">
        <thead>
          <tr>
            <th>{{ t('schedule.headerTime') }}</th>
            <th v-for="item in previewHeaders" :key="`${item.day}-${item.roomNo}`">
              {{ item.label }} · {{ item.roomLabel }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in calendarPreviewRows" :key="row.hour">
            <td class="time-col">{{ row.time }}</td>
            <td v-for="cell in row.cells" :key="cell.key" :class="{ empty: !cell.member }">
              {{ cell.member || '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, reactive } from 'vue';
import api from '@/services/api';
import { useI18n } from '@/i18n';
import { useToast } from '@/composables/toast';

const { t } = useI18n();
const { showSuccess, showError } = useToast();

const semester = reactive({
  name: '',
  startDate: '',
  endDate: '',
  activate: true
});

const proposedBatch = ref(null);
const proposedAssignments = ref([]);
const members = ref([]);
const currentSemester = ref(null);
const publishBatchId = ref(0);
const selectedAssignmentId = ref(0);
const selectedMemberId = ref(0);
const memberKeyword = ref('');
const moving = ref(false);
const exporting = ref(false);
const slots = ref([]);

const hours = Array.from({ length: 14 }, (_, index) => 8 + index);

const dayMap = computed(() => ({
  0: t('day.sunShort'),
  1: t('day.monShort'),
  2: t('day.tueShort'),
  3: t('day.wedShort'),
  4: t('day.thuShort'),
  5: t('day.friShort'),
  6: t('day.satShort')
}));

const dayOptions = computed(() =>
  [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    value: day,
    label: dayMap.value[day]
  }))
);

const slotByKey = computed(() => {
  const map = new Map();
  for (const slot of slots.value) {
    map.set(`${slot.dayOfWeek}-${slot.hour}-${slot.roomNo}`, slot);
  }
  return map;
});

const assignmentBySlotId = computed(() => {
  const map = new Map();
  for (const assignment of proposedAssignments.value) {
    map.set(assignment.slotId, assignment);
  }
  return map;
});

const selectedAssignment = computed(() =>
  proposedAssignments.value.find((assignment) => assignment.id === selectedAssignmentId.value) || null
);

const selectedMember = computed(() =>
  members.value.find((member) => member.userId === selectedMemberId.value) || null
);

const filteredMembers = computed(() => {
  const keyword = memberKeyword.value.trim().toLowerCase();
  if (!keyword) {
    return members.value;
  }
  return members.value.filter((member) => {
    const fields = [member.displayName, member.studentNumber];
    return fields.some((field) => String(field || '').toLowerCase().includes(keyword));
  });
});

const previewDayLabelsZh = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const previewHeaders = computed(() => {
  const headers = [];
  for (let day = 0; day <= 6; day += 1) {
    headers.push({
      day,
      roomNo: 1,
      label: previewDayLabelsZh[day],
      roomLabel: '324琴房'
    });
    headers.push({
      day,
      roomNo: 2,
      label: previewDayLabelsZh[day],
      roomLabel: '325琴房'
    });
  }
  return headers;
});

const calendarPreviewRows = computed(() =>
  hours.map((hour) => ({
    hour,
    time: `${String(hour).padStart(2, '0')}:00`,
    cells: previewHeaders.value.map((header) => {
      const slot = getSlot(header.day, hour, header.roomNo);
      const assignment = slot ? getAssignment(slot.id) : null;
      return {
        key: `${header.day}-${header.roomNo}-${hour}`,
        member: assignment ? `${assignment.displayName} (${assignment.studentNumber})` : ''
      };
    })
  }))
);

function setMessage(text) {
  showSuccess(text);
}

function setError(err) {
  const text = typeof err === 'string' ? err : err?.response?.data?.message || t('admin.errorRequest');
  showError(text);
}

function getSlot(dayOfWeek, hour, roomNo) {
  return slotByKey.value.get(`${dayOfWeek}-${hour}-${roomNo}`) || null;
}

function getAssignment(slotId) {
  return assignmentBySlotId.value.get(slotId) || null;
}

function slotClass(slot) {
  const assignment = getAssignment(slot.id);
  const selected = selectedAssignment.value;
  return {
    occupied: Boolean(assignment),
    source: Boolean(selected && selected.slotId === slot.id),
    target: Boolean(selected && selected.slotId !== slot.id)
  };
}

async function loadSlots(semesterId) {
  if (!semesterId) {
    slots.value = [];
    return;
  }
  const { data } = await api.get('/scheduling/slots', { params: { semesterId } });
  slots.value = data.items || [];
}

async function loadProposed() {
  const { data } = await api.get('/admin/scheduling/proposed');
  currentSemester.value = data.semester || null;
  proposedBatch.value = data.batch;
  proposedAssignments.value = data.assignments || [];
  members.value = data.members || [];
  publishBatchId.value = data.batch?.id || 0;
  selectedAssignmentId.value = 0;
  if (!members.value.some((member) => member.userId === selectedMemberId.value)) {
    selectedMemberId.value = 0;
  }
  await loadSlots(data.semesterId);
}

async function loadCurrentSemester() {
  const { data } = await api.get('/admin/semesters/current');
  currentSemester.value = data.item || null;
}

function selectMember(userId) {
  selectedMemberId.value = selectedMemberId.value === userId ? 0 : userId;
  selectedAssignmentId.value = 0;
}

async function createSemester() {
  if (!window.confirm(t('admin.confirmCreateSemester'))) {
    return;
  }
  try {
    const payload = {
      name: semester.name,
      startDate: semester.startDate,
      endDate: semester.endDate,
      activate: semester.activate
    };
    const { data } = await api.post('/admin/semesters', payload);
    setMessage(t('admin.semesterCreated', { id: data.id }));
    await loadCurrentSemester();
    await loadSlots(data.id);
  } catch (err) {
    setError(err);
  }
}

async function runSchedule() {
  if (!window.confirm(t('admin.confirmRunSchedule'))) {
    return;
  }
  try {
    const { data } = await api.post('/admin/scheduling/run', {});
    publishBatchId.value = data.batchId;
    setMessage(t('admin.scheduleGenerated', { id: data.batchId }));
    await loadProposed();
  } catch (err) {
    setError(err);
  }
}

async function publishSchedule() {
  if (!publishBatchId.value) {
    setError(t('admin.batchRequired'));
    return;
  }
  if (!window.confirm(t('admin.confirmPublishSchedule'))) {
    return;
  }
  try {
    const { data } = await api.post('/admin/scheduling/publish', {
      batchId: publishBatchId.value
    });
    setMessage(t('admin.schedulePublished', { count: data.notification?.sent || 0 }));
    await loadProposed();
  } catch (err) {
    setError(err);
  }
}

async function deleteSelectedAssignment() {
  if (!selectedAssignment.value) {
    return;
  }
  if (!window.confirm(t('admin.confirmDeleteSelectedSlot'))) {
    return;
  }
  moving.value = true;
  try {
    await api.delete(`/admin/scheduling/assignments/${selectedAssignment.value.id}`);
    setMessage(t('admin.slotDeleted'));
    await loadProposed();
  } catch (err) {
    setError(err);
  } finally {
    moving.value = false;
  }
}

function parseFileName(contentDisposition, fallback) {
  if (!contentDisposition) {
    return fallback;
  }
  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }
  const plainMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1] || fallback;
}

async function downloadCalendar() {
  if (!proposedBatch.value) {
    setError(t('admin.noProposedSchedule'));
    return;
  }
  exporting.value = true;
  try {
    const response = await api.get('/admin/scheduling/export', {
      params: { batchId: proposedBatch.value.id },
      responseType: 'blob'
    });
    const fallbackName = `linquan_schedule_batch_${proposedBatch.value.id}.csv`;
    const fileName = parseFileName(response.headers['content-disposition'], fallbackName);
    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    setMessage(t('admin.calendarExported'));
  } catch (err) {
    setError(err?.response?.data?.message || t('admin.calendarExportFailed'));
  } finally {
    exporting.value = false;
  }
}

async function onSlotClick(slot) {
  if (!slot || moving.value) {
    return;
  }

  if (selectedMember.value) {
    const currentAssignmentForSlot = getAssignment(slot.id);
    if (currentAssignmentForSlot) {
      setError(t('admin.slotOccupiedChooseIdle'));
      return;
    }

    const shouldAssign = window.confirm(
      t('admin.confirmAssignMember', {
        name: selectedMember.value.displayName,
        day: dayMap.value[slot.dayOfWeek],
        hour: slot.hour,
        room: slot.roomNo
      })
    );
    if (!shouldAssign) {
      return;
    }

    moving.value = true;
    try {
      await api.post('/admin/scheduling/assignments', {
        batchId: proposedBatch.value?.id,
        userId: selectedMember.value.userId,
        slotId: slot.id
      });
      setMessage(t('admin.memberAssigned'));
      await loadProposed();
    } catch (err) {
      setError(err);
    } finally {
      moving.value = false;
    }
    return;
  }

  const currentAssignment = getAssignment(slot.id);
  if (!selectedAssignment.value) {
    if (currentAssignment) {
      selectedAssignmentId.value = currentAssignment.id;
    }
    return;
  }

  if (selectedAssignment.value.slotId === slot.id) {
    selectedAssignmentId.value = 0;
    return;
  }

  const selected = selectedAssignment.value;
  const shouldMove = window.confirm(
    t('admin.confirmMoveAssignment', {
      name: selected.displayName,
      day: dayMap.value[slot.dayOfWeek],
      hour: slot.hour,
      room: slot.roomNo
    })
  );
  if (!shouldMove) {
    return;
  }

  moving.value = true;
  try {
    await api.patch(`/admin/scheduling/assignments/${selected.id}`, {
      slotId: slot.id,
      swapIfOccupied: true
    });
    setMessage(currentAssignment ? t('admin.assignmentSwapped') : t('admin.assignmentMoved'));
    await loadProposed();
  } catch (err) {
    setError(err);
  } finally {
    moving.value = false;
  }
}

onMounted(async () => {
  try {
    await loadCurrentSemester();
    await loadProposed();
  } catch (err) {
    setError(err);
  }
});

</script>

<style scoped>
.panel {
  padding: 1rem;
}

.controls {
  margin-bottom: 0.65rem;
}

.action-row {
  margin-top: 0.55rem;
}

.search-field {
  margin-top: 0.8rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.field-half {
  flex: 1;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.92rem;
  color: var(--muted);
}

.calendar-board {
  margin-top: 1rem;
  display: grid;
  gap: 0.8rem;
}

.preview-panel {
  margin-top: 1rem;
}

.preview-wrap {
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 10px;
}

.preview-table {
  min-width: 1160px;
}

.preview-table th {
  white-space: nowrap;
  font-size: 0.8rem;
  color: var(--muted);
  background: #11151a;
}

.preview-table td {
  font-size: 0.83rem;
  vertical-align: middle;
}

.preview-table td.empty {
  color: var(--muted);
}

.day-card {
  padding: 0.75rem;
}

.day-card h3 {
  margin: 0 0 0.6rem;
}

.calendar-table th,
.calendar-table td {
  border-bottom: 1px solid var(--line);
  vertical-align: top;
}

.calendar-table th {
  font-size: 0.82rem;
  color: var(--muted);
}

.time-col {
  width: 84px;
  white-space: nowrap;
  color: var(--muted);
  font-size: 0.86rem;
}

.slot-btn {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel-soft);
  color: var(--ink);
  padding: 0.45rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  text-align: left;
  cursor: pointer;
}

.slot-btn.occupied {
  border-color: #62666b;
}

.slot-btn.source {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px rgba(240, 240, 240, 0.35);
}

.slot-btn.target {
  border-style: dashed;
}

.slot-btn:disabled {
  cursor: wait;
  opacity: 0.8;
}

.count {
  font-size: 0.76rem;
  color: var(--muted);
}

.name {
  font-size: 0.9rem;
  font-weight: 700;
}

.hint {
  font-size: 0.78rem;
  color: var(--muted);
}

.selected {
  margin-top: 0.7rem;
  color: var(--accent);
  font-weight: 700;
}

.member-list {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.42rem;
  max-height: 180px;
  overflow: auto;
}

.member-btn {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel-soft);
  color: var(--ink);
  padding: 0.45rem 0.55rem;
  text-align: left;
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
  cursor: pointer;
}

.member-btn.active {
  border-color: var(--accent);
  background: #23272c;
}
</style>
