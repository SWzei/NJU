<template>
  <section class="section-group">
    <h2 class="group-title">{{ t('admin.sectionPublish') }}</h2>
    <div class="grid-2">
      <article class="card panel">
        <h3 class="card-title">{{ t('admin.publishActivity') }}</h3>
        <form class="form" @submit.prevent="postActivity">
          <div class="field">
            <label>{{ t('admin.title') }}</label>
            <input v-model.trim="activity.title" required />
          </div>
          <div class="field">
            <label>{{ t('admin.content') }}</label>
            <textarea v-model.trim="activity.content" required />
          </div>
          <div class="row">
            <div class="field field-half">
              <label>{{ t('admin.eventTimeIso') }}</label>
              <input v-model.trim="activity.eventTime" placeholder="2026-03-01T19:00:00" />
            </div>
            <div class="field field-half">
              <label>{{ t('admin.location') }}</label>
              <input v-model.trim="activity.location" />
            </div>
          </div>
          <button class="btn">{{ t('admin.publishActivityButton') }}</button>
        </form>
      </article>

      <article class="card panel">
        <h3 class="card-title">{{ t('admin.publishAnnouncement') }}</h3>
        <form class="form" @submit.prevent="postAnnouncement">
          <div class="field">
            <label>{{ t('admin.title') }}</label>
            <input v-model.trim="announcement.title" required />
          </div>
          <div class="field">
            <label>{{ t('admin.content') }}</label>
            <textarea v-model.trim="announcement.content" required />
          </div>
          <button class="btn">{{ t('admin.publishAnnouncementButton') }}</button>
        </form>
      </article>
    </div>
  </section>

  <section class="section-group">
    <h2 class="group-title">{{ t('admin.sectionScheduling') }}</h2>
    <div class="grid-2">
      <article class="card panel">
        <h3 class="card-title">{{ t('admin.createSemester') }}</h3>
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
        <h3 class="card-title">{{ t('admin.schedulingControl') }}</h3>
        <div class="row action-row">
          <button class="btn" @click="runSchedule">{{ t('admin.runSchedule') }}</button>
          <button class="btn secondary" @click="loadProposed">{{ t('admin.refreshProposed') }}</button>
        </div>

        <div class="field">
          <label>{{ t('admin.publishBatchId') }}</label>
          <input type="number" v-model.number="publishBatchId" />
        </div>
        <button class="btn warn" @click="publishSchedule">{{ t('admin.publishSchedule') }}</button>

        <p class="subtle" v-if="proposedBatch">
          {{ t('admin.proposedBatch', { id: proposedBatch.id, semesterId: proposedBatch.semesterId }) }}
        </p>
        <div class="table-wrap" v-if="proposedAssignments.length">
          <table>
            <thead>
              <tr>
                <th>{{ t('admin.assignmentId') }}</th>
                <th>{{ t('common.student') }}</th>
                <th>{{ t('common.name') }}</th>
                <th>{{ t('admin.slot') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in proposedAssignments.slice(0, 50)" :key="item.id">
                <td>{{ item.id }}</td>
                <td>{{ item.studentNumber }}</td>
                <td>{{ item.displayName }}</td>
                <td>{{ dayMap[item.dayOfWeek] }} {{ item.hour }}:00 {{ t('common.room') }} {{ item.roomNo }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="proposedAssignments.length > 50" class="subtle">
          {{ t('admin.showingFirst50') }}
        </p>
      </article>
    </div>
  </section>

  <section class="section-group">
    <h2 class="group-title">{{ t('admin.sectionConcert') }}</h2>
    <article class="card panel">
      <h3 class="card-title">{{ t('admin.createConcert') }}</h3>
      <form class="form" @submit.prevent="createConcert">
        <div class="field">
          <label>{{ t('admin.title') }}</label>
          <input v-model.trim="concert.title" required />
        </div>
        <div class="field">
          <label>{{ t('admin.description') }}</label>
          <textarea v-model.trim="concert.description" />
        </div>
        <div class="field">
          <label>{{ t('admin.announcement') }}</label>
          <textarea v-model.trim="concert.announcement" />
        </div>
        <div class="row">
          <div class="field field-half">
            <label>{{ t('admin.applicationDeadline') }}</label>
            <input v-model.trim="concert.applicationDeadline" placeholder="2026-04-10T23:59:59" />
          </div>
          <div class="field field-half">
            <label>{{ t('common.status') }}</label>
            <select v-model="concert.status">
              <option value="draft">{{ t('concertStatus.draft') }}</option>
              <option value="open">{{ t('concertStatus.open') }}</option>
              <option value="audition">{{ t('concertStatus.audition') }}</option>
              <option value="result">{{ t('concertStatus.result') }}</option>
              <option value="closed">{{ t('concertStatus.closed') }}</option>
            </select>
          </div>
        </div>
        <button class="btn">{{ t('admin.createConcertButton') }}</button>
      </form>
    </article>
  </section>

  <section class="section-group">
    <h2 class="group-title">{{ t('admin.sectionReview') }}</h2>
    <div class="grid-2">
      <article class="card panel">
        <h3 class="card-title">{{ t('admin.reviewSlotTitle') }}</h3>
        <form class="form" @submit.prevent="createAudition">
          <div class="field">
            <label>{{ t('admin.concertId') }}</label>
            <input type="number" v-model.number="audition.concertId" required />
          </div>
          <div class="field">
            <label>{{ t('admin.applicationIdOptional') }}</label>
            <input type="number" v-model.number="audition.applicationId" />
          </div>
          <div class="row">
            <div class="field field-half">
              <label>{{ t('admin.start') }}</label>
              <input v-model.trim="audition.startTime" placeholder="2026-04-15T18:00:00" />
            </div>
            <div class="field field-half">
              <label>{{ t('admin.end') }}</label>
              <input v-model.trim="audition.endTime" placeholder="2026-04-15T18:10:00" />
            </div>
          </div>
          <div class="field">
            <label>{{ t('admin.location') }}</label>
            <input v-model.trim="audition.location" />
          </div>
          <button class="btn secondary">{{ t('admin.addAuditionSlot') }}</button>
        </form>
      </article>

      <article class="card panel">
        <h3 class="card-title">{{ t('admin.reviewResultTitle') }}</h3>
        <form class="form" @submit.prevent="publishResult">
          <div class="field">
            <label>{{ t('admin.concertId') }}</label>
            <input type="number" v-model.number="result.concertId" required />
          </div>
          <div class="field">
            <label>{{ t('admin.applicationId') }}</label>
            <input type="number" v-model.number="result.applicationId" required />
          </div>
          <div class="field">
            <label>{{ t('common.status') }}</label>
            <select v-model="result.status">
              <option value="accepted">{{ t('auditionResult.accepted') }}</option>
              <option value="rejected">{{ t('auditionResult.rejected') }}</option>
              <option value="waitlist">{{ t('auditionResult.waitlist') }}</option>
            </select>
          </div>
          <div class="field">
            <label>{{ t('common.feedback') }}</label>
            <textarea v-model.trim="result.feedback" />
          </div>
          <button class="btn warn">{{ t('admin.publishResultButton') }}</button>
        </form>
      </article>
    </div>
  </section>

</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import api from '@/services/api';
import { useI18n } from '@/i18n';
import { useToast } from '@/composables/toast';

const { t } = useI18n();
const { showSuccess, showError } = useToast();

const dayMap = computed(() => ({
  0: t('day.sunShort'),
  1: t('day.monShort'),
  2: t('day.tueShort'),
  3: t('day.wedShort'),
  4: t('day.thuShort'),
  5: t('day.friShort'),
  6: t('day.satShort')
}));

const activity = reactive({
  title: '',
  content: '',
  eventTime: '',
  location: ''
});

const announcement = reactive({
  title: '',
  content: ''
});

const semester = reactive({
  name: '',
  startDate: '',
  endDate: '',
  activate: true
});

const concert = reactive({
  title: '',
  description: '',
  announcement: '',
  applicationDeadline: '',
  status: 'open'
});

const audition = reactive({
  concertId: 0,
  applicationId: 0,
  startTime: '',
  endTime: '',
  location: ''
});

const result = reactive({
  concertId: 0,
  applicationId: 0,
  status: 'accepted',
  feedback: ''
});

const proposedBatch = ref(null);
const proposedAssignments = ref([]);
const publishBatchId = ref(0);

function setMessage(text) {
  showSuccess(text);
}

function setError(err) {
  showError(err, t('admin.errorRequest'));
}

async function postActivity() {
  if (!window.confirm(t('admin.confirmPublishActivity'))) {
    return;
  }
  try {
    await api.post('/admin/activities', activity);
    setMessage(t('admin.activityPublished'));
    activity.title = '';
    activity.content = '';
    activity.eventTime = '';
    activity.location = '';
  } catch (err) {
    setError(err);
  }
}

async function postAnnouncement() {
  if (!window.confirm(t('admin.confirmPublishAnnouncement'))) {
    return;
  }
  try {
    await api.post('/admin/announcements', announcement);
    setMessage(t('admin.announcementPublished'));
    announcement.title = '';
    announcement.content = '';
  } catch (err) {
    setError(err);
  }
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

async function loadProposed() {
  try {
    const { data } = await api.get('/admin/scheduling/proposed');
    proposedBatch.value = data.batch;
    proposedAssignments.value = data.assignments || [];
  } catch (err) {
    setError(err);
  }
}

async function publishSchedule() {
  if (!publishBatchId.value) {
    showError(t('admin.batchRequired'));
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

async function createConcert() {
  if (!window.confirm(t('admin.confirmCreateConcert'))) {
    return;
  }
  try {
    const { data } = await api.post('/admin/concerts', concert);
    setMessage(t('admin.concertCreated', { id: data.id }));
  } catch (err) {
    setError(err);
  }
}

async function createAudition() {
  if (!window.confirm(t('admin.confirmCreateReviewSlot'))) {
    return;
  }
  try {
    await api.post(`/admin/concerts/${audition.concertId}/auditions`, {
      applicationId: audition.applicationId || undefined,
      startTime: audition.startTime,
      endTime: audition.endTime,
      location: audition.location
    });
    setMessage(t('admin.auditionCreated'));
  } catch (err) {
    setError(err);
  }
}

async function publishResult() {
  if (!window.confirm(t('admin.confirmPublishReviewResult'))) {
    return;
  }
  try {
    await api.post(`/admin/concerts/${result.concertId}/results`, {
      applicationId: result.applicationId,
      status: result.status,
      feedback: result.feedback
    });
    setMessage(t('admin.resultPublished'));
  } catch (err) {
    setError(err);
  }
}
</script>

<style scoped>
.section-group {
  margin-bottom: 1.25rem;
}

.group-title {
  margin: 0 0 0.6rem;
  color: var(--muted);
  font-size: 1.06rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.card-title {
  margin: 0 0 0.7rem;
  font-size: 1.18rem;
}

.panel {
  padding: 1rem;
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

.action-row {
  margin-bottom: 0.65rem;
}

.table-wrap {
  margin-top: 0.8rem;
  max-height: 300px;
  overflow: auto;
}

</style>
