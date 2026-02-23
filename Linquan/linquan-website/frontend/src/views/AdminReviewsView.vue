<template>
  <section class="grid-2">
    <article class="card panel">
      <h2 class="section-title">{{ t('admin.reviewSlotTitle') }}</h2>
      <form class="form" @submit.prevent="createAudition">
        <div class="field">
          <label>{{ t('admin.concertSelect') }}</label>
          <select v-model.number="audition.concertId" @change="syncConcert(audition.concertId)">
            <option :value="0">{{ t('common.choose') }}</option>
            <option v-for="item in concerts" :key="item.id" :value="item.id">{{ item.title }}</option>
          </select>
        </div>
        <div class="field">
          <label>{{ t('admin.applicationSelectOptional') }}</label>
          <select v-model.number="audition.applicationId">
            <option :value="0">{{ t('admin.noSpecificApplication') }}</option>
            <option v-for="item in applications" :key="item.id" :value="item.id">
              {{ item.displayName }} - {{ item.pieceTitle }}
            </option>
          </select>
        </div>
        <div class="row">
          <div class="field field-half">
            <label>{{ t('admin.start') }}</label>
            <input type="datetime-local" v-model="audition.startTime" />
          </div>
          <div class="field field-half">
            <label>{{ t('admin.end') }}</label>
            <input type="datetime-local" v-model="audition.endTime" />
          </div>
        </div>
        <p class="subtle">{{ t('admin.dateTimeGuide') }}</p>
        <div class="field">
          <label>{{ t('admin.location') }}</label>
          <input v-model.trim="audition.location" :placeholder="t('admin.locationPlaceholder')" />
        </div>
        <button class="btn secondary">{{ t('admin.addAuditionSlot') }}</button>
      </form>
    </article>

    <article class="card panel">
      <h2 class="section-title">{{ t('admin.reviewResultTitle') }}</h2>
      <form class="form" @submit.prevent="publishResult">
        <div class="field">
          <label>{{ t('admin.concertSelect') }}</label>
          <select v-model.number="result.concertId" @change="syncConcert(result.concertId)">
            <option :value="0">{{ t('common.choose') }}</option>
            <option v-for="item in concerts" :key="item.id" :value="item.id">{{ item.title }}</option>
          </select>
        </div>
        <div class="field">
          <label>{{ t('admin.applicationSelect') }}</label>
          <select v-model.number="result.applicationId">
            <option :value="0">{{ t('common.choose') }}</option>
            <option v-for="item in applications" :key="item.id" :value="item.id">
              {{ item.displayName }} - {{ item.pieceTitle }}
            </option>
          </select>
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
          <textarea v-model.trim="result.feedback" :placeholder="t('admin.feedbackPlaceholder')" />
        </div>
        <button class="btn warn">{{ t('admin.publishResultButton') }}</button>
      </form>
    </article>
  </section>

  <section class="card panel section-space">
    <h2 class="section-title">{{ t('admin.registrationListTitle') }}</h2>
    <div class="row filter-row">
      <div class="field field-wide">
        <label>{{ t('admin.concertSelect') }}</label>
        <select v-model.number="selectedConcertId" @change="onSelectConcert">
          <option :value="0">{{ t('common.choose') }}</option>
          <option v-for="item in concerts" :key="item.id" :value="item.id">{{ item.title }}</option>
        </select>
      </div>
      <div class="field">
        <label>&nbsp;</label>
        <button class="btn secondary" @click="loadApplications">{{ t('admin.loadRegistrations') }}</button>
      </div>
    </div>

    <table class="app-table">
      <thead>
        <tr>
          <th>{{ t('common.name') }}</th>
          <th>{{ t('concerts.piece') }}</th>
          <th>{{ t('common.status') }}</th>
          <th>{{ t('common.time') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in applications"
          :key="item.id"
          :class="{ active: selectedApplicationId === item.id }"
          @click="pickApplication(item)"
        >
          <td>{{ item.displayName }}</td>
          <td>{{ item.pieceTitle }}</td>
          <td>{{ t(`auditionResult.${item.status}`) || item.status }}</td>
          <td>{{ item.updatedAt || '-' }}</td>
        </tr>
        <tr v-if="applications.length === 0 && !loadingApplications">
          <td colspan="4" class="subtle">{{ t('admin.noRegistrations') }}</td>
        </tr>
        <tr v-if="loadingApplications">
          <td colspan="4" class="subtle">{{ t('common.loading') }}</td>
        </tr>
      </tbody>
    </table>

    <article class="detail-box" v-if="selectedApplication">
      <h3>{{ t('admin.registrationDetailTitle') }}</h3>
      <p><strong>{{ t('common.student') }}:</strong> {{ selectedApplication.studentNumber }}</p>
      <p><strong>{{ t('common.name') }}:</strong> {{ selectedApplication.displayName }}</p>
      <p><strong>{{ t('concerts.piece') }}:</strong> {{ selectedApplication.pieceTitle }}</p>
      <p><strong>{{ t('concerts.composer') }}:</strong> {{ selectedApplication.composer || '-' }}</p>
      <p><strong>{{ t('common.status') }}:</strong> {{ t(`auditionResult.${selectedApplication.status}`) || selectedApplication.status }}</p>
      <p>
        <strong>{{ t('concerts.scoreFile') }}:</strong>
        <a v-if="selectedApplication.scoreFilePath" :href="selectedApplication.scoreFilePath" target="_blank" rel="noopener">
          {{ t('admin.viewScoreFile') }}
        </a>
        <span v-else>{{ t('concerts.noScoreFile') }}</span>
      </p>
      <div class="detail-field">
        <strong>{{ t('concerts.note') }}:</strong>
        <pre>{{ selectedApplication.note || '-' }}</pre>
      </div>
      <div class="detail-field">
        <strong>{{ t('common.feedback') }}:</strong>
        <pre>{{ selectedApplication.feedback || '-' }}</pre>
      </div>
    </article>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import api from '@/services/api';
import { useI18n } from '@/i18n';
import { useToast } from '@/composables/toast';

const { t } = useI18n();

const concerts = ref([]);
const selectedConcertId = ref(0);
const selectedApplicationId = ref(0);
const applications = ref([]);
const loadingApplications = ref(false);

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

const { showSuccess, showError } = useToast();

const selectedApplication = computed(
  () => applications.value.find((item) => item.id === selectedApplicationId.value) || null
);

function toStorageDateTime(value) {
  if (!value) {
    return '';
  }
  return `${value}:00`;
}

function setMessage(text) {
  showSuccess(text);
}

function setError(err) {
  showError(err, t('admin.errorRequest'));
}

async function loadConcerts() {
  const { data } = await api.get('/admin/concerts');
  concerts.value = data.items || [];
  if (!selectedConcertId.value && concerts.value.length > 0) {
    selectedConcertId.value = concerts.value[0].id;
  }
  onSelectConcert();
}

async function loadApplications() {
  if (!selectedConcertId.value) {
    applications.value = [];
    selectedApplicationId.value = 0;
    return;
  }
  loadingApplications.value = true;
  try {
    const { data } = await api.get(`/admin/concerts/${selectedConcertId.value}/applications`);
    applications.value = data.items || [];
    if (!applications.value.some((item) => item.id === selectedApplicationId.value)) {
      selectedApplicationId.value = 0;
    }
  } catch (err) {
    setError(err);
  } finally {
    loadingApplications.value = false;
  }
}

function onSelectConcert() {
  audition.concertId = selectedConcertId.value || 0;
  result.concertId = selectedConcertId.value || 0;
  audition.applicationId = 0;
  result.applicationId = 0;
  selectedApplicationId.value = 0;
  loadApplications();
}

function syncConcert(concertId) {
  selectedConcertId.value = concertId || 0;
  onSelectConcert();
}

function pickApplication(item) {
  selectedApplicationId.value = item.id;
  audition.applicationId = item.id;
  result.applicationId = item.id;
}

async function createAudition() {
  if (!audition.concertId) {
    showError(t('admin.concertRequired'));
    return;
  }
  if (!window.confirm(t('admin.confirmCreateReviewSlot'))) {
    return;
  }
  try {
    await api.post(`/admin/concerts/${audition.concertId}/auditions`, {
      applicationId: audition.applicationId || undefined,
      startTime: toStorageDateTime(audition.startTime),
      endTime: toStorageDateTime(audition.endTime),
      location: audition.location
    });
    setMessage(t('admin.auditionCreated'));
    await loadApplications();
  } catch (err) {
    setError(err);
  }
}

async function publishResult() {
  if (!result.concertId) {
    showError(t('admin.concertRequired'));
    return;
  }
  if (!result.applicationId) {
    showError(t('admin.applicationRequired'));
    return;
  }
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
    await loadApplications();
  } catch (err) {
    setError(err);
  }
}

onMounted(async () => {
  try {
    await loadConcerts();
  } catch (err) {
    setError(err);
  }
});
</script>

<style scoped>
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

.section-space {
  margin-top: 1rem;
}

.filter-row {
  align-items: flex-end;
}

.field-wide {
  flex: 1;
}

.app-table tr {
  cursor: pointer;
}

.app-table tr.active {
  background: #20252a;
}

.app-table a {
  color: var(--accent);
  text-decoration: underline;
}

.detail-box {
  margin-top: 0.9rem;
  border-top: 1px solid var(--line);
  padding-top: 0.8rem;
}

.detail-box h3 {
  margin: 0;
}

.detail-box p {
  margin: 0.4rem 0 0;
}

.detail-field {
  margin-top: 0.5rem;
}

.detail-field pre {
  margin: 0.28rem 0 0;
  white-space: pre-wrap;
  word-break: break-word;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0.52rem;
  background: var(--panel-soft);
}

</style>
