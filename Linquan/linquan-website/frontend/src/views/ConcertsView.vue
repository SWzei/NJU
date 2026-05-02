<template>
  <section v-if="selectedConcertId && !isConcertClosed && auditionSectionReady && (hasActiveAuditions || hasSubmittedApplications)" class="card panel">
    <h2 class="section-title">{{ t('concerts.auditionInfoTitle') }}</h2>

    <div v-if="!hasActiveAuditions" class="subtle">{{ t('concerts.noAuditionInfo') }}</div>

    <div v-for="audition in activeAuditions" :key="audition.id" class="audition-info">
      <h3>{{ audition.title }}</h3>
      <p v-if="audition.auditionTime" class="subtle">
        <strong>{{ t('concerts.auditionTimeLabel') }}:</strong>
        {{ formatDate(audition.auditionTime) }}
      </p>
      <p v-if="audition.announcement" class="subtle multiline-text">{{ audition.announcement }}</p>
      <p v-else-if="audition.description" class="subtle multiline-text">{{ audition.description }}</p>
      <p v-if="audition.attachmentPath" class="subtle">
        <a :href="audition.attachmentPath" target="_blank" rel="noopener">
          {{ t('concerts.downloadAttachment') }}
        </a>
      </p>
    </div>

    <div v-if="hasSubmittedApplications" class="audition-results">
      <div v-for="app in submittedApplications" :key="app.id" class="audition-result">
        <p class="subtle">
          <strong>{{ t('concerts.pieceZh') }}:</strong> {{ app.pieceZh || '-' }}
        </p>
        <p class="subtle">
          <strong>{{ t('concerts.auditionResultLabel') }}:</strong>
          <span :class="auditionStatusClass(app.auditionStatus)">
            {{ auditionStatusText(app.auditionStatus) }}
          </span>
        </p>
        <p v-if="app.auditionFeedback" class="subtle multiline-text">
          <strong>
            {{ app.auditionStatus === 'failed' ? t('concerts.auditionReasonLabel') : t('concerts.auditionFeedbackLabel') }}:
          </strong>
          {{ app.auditionFeedback }}
        </p>
      </div>
    </div>
  </section>

  <section class="grid-2 section-space">
    <article class="card panel">
      <h2 class="section-title">{{ t('concerts.cycleTitle') }}</h2>
      <p class="subtle">{{ t('concerts.cycleSubtitle') }}</p>

      <ul class="concert-list">
        <li
          v-for="concert in concerts"
          :key="concert.id"
          :class="{ active: concert.id === selectedConcertId }"
          @click="selectConcert(concert.id)"
        >
          <h3>{{ concert.title }}</h3>
          <p class="subtle">
            {{ t('concerts.statusLabel') }}: {{ statusLabel(concert.status) }}
            <span v-if="concert.applicationDeadline">
              · {{ t('concerts.deadline') }}: {{ formatDate(concert.applicationDeadline) }}
            </span>
          </p>
          <p class="multiline-text">{{ concert.announcement || concert.description || t('concerts.noDetails') }}</p>
          <p v-if="concert.attachmentPath" class="subtle attachment">
            <a :href="concert.attachmentPath" target="_blank" rel="noopener" @click.stop>
              {{ t('concerts.downloadAttachment') }}
            </a>
          </p>
        </li>
      </ul>
      <p v-if="concerts.length === 0" class="subtle">{{ t('concerts.noConcerts') }}</p>
    </article>

    <article class="card panel">
      <h2 class="section-title">{{ t('concerts.applyTitle') }}</h2>
      <p class="subtle">{{ auth.isAuthenticated ? t('concerts.applySubtitle') : t('concerts.loginRequired') }}</p>
      <form v-if="auth.isAuthenticated" class="form" @submit.prevent="submitApplications">
        <div class="field">
          <label>{{ t('concerts.selectedConcert') }}</label>
          <select v-model.number="selectedConcertId">
            <option :value="0">{{ t('common.choose') }}</option>
            <option v-for="item in concerts" :key="item.id" :value="item.id">{{ item.title }}</option>
          </select>
        </div>

        <div class="application-items">
          <article v-for="(item, index) in applicationForms" :key="item.localId" class="application-card">
            <div class="application-header">
              <div>
                <h3>{{ t('concerts.applicationItemTitle', { index: index + 1 }) }}</h3>
                <p v-if="item.id" class="subtle">
                  {{ t('common.status') }}: {{ applicationStatusLabel(item.status) }}
                  <span v-if="item.updatedAt"> · {{ formatDate(item.updatedAt) }}</span>
                </p>
              </div>
              <button
                class="btn ghost"
                type="button"
                @click="removeApplicationItem(index)"
                :disabled="removingItemIndex === index"
              >
                {{ removingItemIndex === index ? t('common.loading') : t('concerts.removeApplicationItem') }}
              </button>
            </div>

            <div class="field">
              <label>{{ t('common.name') }}</label>
              <input v-model.trim="item.applicantName" required :placeholder="t('concerts.applicantNamePlaceholder')" />
            </div>
            <div class="field">
              <label>{{ t('common.student') }}</label>
              <input
                v-model.trim="item.applicantStudentNumber"
                required
                readonly
                :placeholder="t('concerts.applicantStudentNumberPlaceholder')"
              />
            </div>
            <div class="field">
              <label>{{ t('concerts.pieceZh') }}</label>
              <textarea v-model="item.pieceZh" rows="2" required :placeholder="t('concerts.pieceZhPlaceholder')" />
            </div>
            <div class="field">
              <label>{{ t('concerts.pieceEn') }}</label>
              <textarea v-model="item.pieceEn" rows="2" required :placeholder="t('concerts.pieceEnPlaceholder')" />
            </div>
            <div class="row">
              <div class="field field-half">
                <label>{{ t('concerts.durationMin') }}</label>
                <input type="number" min="1" max="180" v-model.number="item.durationMin" required />
              </div>
              <div class="field field-half">
                <label>{{ t('concerts.contactQq') }}</label>
                <input v-model.trim="item.contactQq" required :placeholder="t('concerts.contactQqPlaceholder')" />
              </div>
            </div>
            <div class="field">
              <label>{{ t('concerts.scoreFile') }}</label>
              <input type="file" @change="onFileChange(index, $event)" />
              <p v-if="item.scoreFilePath" class="subtle attachment">
                <a :href="item.scoreFilePath" target="_blank" rel="noopener">
                  {{ t('concerts.downloadScoreFile') }}
                </a>
              </p>
            </div>
            <div v-if="item.feedback" class="feedback-box">
              <strong>{{ t('common.feedback') }}:</strong>
              <pre>{{ item.feedback }}</pre>
            </div>
          </article>
        </div>

        <div class="row action-row">
          <button class="btn secondary" type="button" @click="addApplicationItem">
            {{ t('concerts.addApplicationItem') }}
          </button>
          <button class="btn" :disabled="submitting || !selectedConcertId">
            {{ submitting ? t('concerts.submitting') : t('concerts.submit') }}
          </button>
        </div>
      </form>
      <div v-else class="guest-apply-box">
        <router-link class="btn secondary" to="/login?redirect=/concerts">
          {{ t('app.navLogin') }}
        </router-link>
      </div>
    </article>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import api from '@/services/api';
import { useI18n } from '@/i18n';
import { useToast } from '@/composables/toast';
import { useAuthStore } from '@/stores/auth';
import { formatDateTimeInBeijing } from '@/utils/dateTime';

const concerts = ref([]);
const selectedConcertId = ref(0);
const applicationForms = ref([]);
const submitting = ref(false);
const removingItemIndex = ref(-1);
const auditions = ref([]);
const loadingAuditions = ref(false);
const loadingApplications = ref(false);

const { t, locale } = useI18n();
const { showSuccess, showError } = useToast();
const auth = useAuthStore();

const selectedConcert = computed(() => concerts.value.find((c) => c.id === selectedConcertId.value) || null);
const isConcertClosed = computed(() => selectedConcert.value?.status === 'closed');
const activeAuditions = computed(() => auditions.value.filter((a) => a.status !== 'closed'));
const hasActiveAuditions = computed(() => activeAuditions.value.length > 0);
const submittedApplications = computed(() => applicationForms.value.filter((f) => f.id));
const hasSubmittedApplications = computed(() => submittedApplications.value.length > 0);
const auditionSectionReady = computed(() => !loadingAuditions.value && !loadingApplications.value);

const defaultApplicantName = ref('');
const defaultStudentNumber = ref('');
let localFormCounter = 0;

function createBlankApplicationForm(seed = {}) {
  return {
    localId: seed.localId || `application-${Date.now()}-${++localFormCounter}`,
    id: seed.id || null,
    applicantName: seed.applicantName || defaultApplicantName.value || auth.user?.studentNumber || '',
    applicantStudentNumber:
      seed.applicantStudentNumber || defaultStudentNumber.value || auth.user?.studentNumber || '',
    pieceZh: seed.pieceZh || seed.pieceTitle || '',
    pieceEn: seed.pieceEn || seed.composer || '',
    durationMin: Number(seed.durationMin || 5),
    contactQq: seed.contactQq || '',
    scoreFile: null,
    scoreFilePath: seed.scoreFilePath || null,
    status: seed.status || 'submitted',
    feedback: seed.feedback || '',
    updatedAt: seed.updatedAt || null,
    auditionStatus: seed.auditionStatus || '',
    auditionFeedback: seed.auditionFeedback || ''
  };
}

function resetApplicationForms(items = []) {
  if (items.length > 0) {
    applicationForms.value = items.map((item) => createBlankApplicationForm(item));
    return;
  }
  applicationForms.value = [createBlankApplicationForm()];
}

function formatDate(value) {
  return formatDateTimeInBeijing(value, locale.value);
}

function statusLabel(status) {
  return t(`concertStatus.${status}`) || status;
}

function applicationStatusLabel(status) {
  return t(`applicationStatus.${status}`) || status;
}

function auditionStatusText(status) {
  if (status === 'passed') return t('concerts.auditionResultPassed');
  if (status === 'failed') return t('concerts.auditionResultFailed');
  return t('concerts.auditionResultPending');
}

function auditionStatusClass(status) {
  return `audition-status-${status || 'pending'}`;
}

function onFileChange(index, event) {
  const file = event.target.files?.[0] || null;
  if (!applicationForms.value[index]) {
    return;
  }
  applicationForms.value[index].scoreFile = file;
}

function selectConcert(concertId) {
  selectedConcertId.value = concertId;
}

function addApplicationItem() {
  applicationForms.value = [...applicationForms.value, createBlankApplicationForm()];
}

function isMeaningfulApplication(item) {
  return Boolean(item.id || item.pieceZh?.trim() || item.pieceEn?.trim() || item.contactQq?.trim() || item.scoreFile);
}

async function removeApplicationItem(index) {
  const item = applicationForms.value[index];
  if (!item) {
    return;
  }

  removingItemIndex.value = index;
  try {
    if (item.id) {
      if (!window.confirm(t('concerts.confirmDeleteApplication'))) {
        return;
      }
      await api.delete(`/concerts/${selectedConcertId.value}/applications/${item.id}`);
      showSuccess(t('concerts.deleteApplicationSuccess'));
    }

    if (applicationForms.value.length === 1) {
      applicationForms.value = [createBlankApplicationForm()];
    } else {
      applicationForms.value = applicationForms.value.filter((_, itemIndex) => itemIndex !== index);
    }

    if (item.id) {
      await loadConcertDetails();
    }
  } catch (err) {
    showError(err, t('concerts.deleteApplicationFailed'));
  } finally {
    removingItemIndex.value = -1;
  }
}

async function loadConcerts() {
  const { data } = await api.get('/concerts');
  concerts.value = data.items || [];
  if (!selectedConcertId.value && concerts.value.length > 0) {
    selectedConcertId.value = concerts.value[0].id;
  }
}

async function loadIdentity() {
  if (!auth.isAuthenticated) {
    defaultApplicantName.value = '';
    defaultStudentNumber.value = '';
    return;
  }
  try {
    const { data } = await api.get('/profiles/me');
    defaultApplicantName.value = data?.displayName || auth.user?.studentNumber || '';
    defaultStudentNumber.value = data?.studentNumber || auth.user?.studentNumber || '';
  } catch (err) {
    defaultApplicantName.value = auth.user?.studentNumber || '';
    defaultStudentNumber.value = auth.user?.studentNumber || '';
  }
}

async function loadConcertDetails() {
  if (!auth.isAuthenticated) {
    resetApplicationForms();
    loadingApplications.value = false;
    return;
  }
  if (!selectedConcertId.value) {
    resetApplicationForms();
    loadingApplications.value = false;
    return;
  }
  loadingApplications.value = true;
  resetApplicationForms();
  try {
    const myApplicationsRes = await api.get(`/concerts/${selectedConcertId.value}/my-applications`);
    const items = myApplicationsRes.data.items || [];
    resetApplicationForms(items);
  } catch (err) {
    resetApplicationForms();
    showError(err, t('concerts.loadDetailsFailed'));
  } finally {
    loadingApplications.value = false;
  }
}

async function loadAuditions() {
  if (!selectedConcertId.value) {
    auditions.value = [];
    loadingAuditions.value = false;
    return;
  }
  loadingAuditions.value = true;
  auditions.value = [];
  try {
    const { data } = await api.get(`/concerts/${selectedConcertId.value}/auditions`);
    auditions.value = data.items || [];
  } catch (err) {
    auditions.value = [];
    showError(err, t('concerts.loadFailed'));
  } finally {
    loadingAuditions.value = false;
  }
}

async function submitApplications() {
  if (!selectedConcertId.value) {
    showError(t('concerts.chooseConcert'));
    return;
  }

  const meaningfulForms = applicationForms.value.filter(isMeaningfulApplication);
  if (meaningfulForms.length === 0) {
    showError(t('concerts.noApplicationEntries'));
    return;
  }

  if (!window.confirm(t('concerts.confirmSubmit'))) {
    return;
  }

  submitting.value = true;
  try {
    for (const item of meaningfulForms) {
      const safeStudentNumber = item.applicantStudentNumber || defaultStudentNumber.value || auth.user?.studentNumber || '';
      const safePieceZh = item.pieceZh?.trim() || '';
      const safePieceEn = item.pieceEn?.trim() || safePieceZh || 'N/A';
      const safeDurationMin = Number(item.durationMin) > 0 ? Number(item.durationMin) : 5;
      const safeContactQq = item.contactQq?.trim() || '0000';

      if (!safePieceZh) {
        throw new Error(t('concerts.applicationPieceRequired'));
      }

      const formData = new FormData();
      if (item.id) {
        formData.append('applicationId', String(item.id));
      }
      formData.append('applicantName', item.applicantName || defaultApplicantName.value || auth.user?.studentNumber || 'member');
      formData.append('applicantStudentNumber', safeStudentNumber);
      formData.append('pieceZh', safePieceZh);
      formData.append('pieceEn', safePieceEn);
      formData.append('durationMin', String(safeDurationMin));
      formData.append('contactQq', safeContactQq);
      if (item.scoreFile) {
        formData.append('scoreFile', item.scoreFile);
      }

      await api.post(`/concerts/${selectedConcertId.value}/applications`, formData);
    }

    showSuccess(t('concerts.submitSuccess'));
    await loadConcertDetails();
  } catch (err) {
    showError(err, t('concerts.submitFailed'));
  } finally {
    submitting.value = false;
  }
}

watch(selectedConcertId, async () => {
  if (!auth.isAuthenticated) {
    await loadAuditions();
    return;
  }
  try {
    await Promise.all([loadConcertDetails(), loadAuditions()]);
  } catch (err) {
    showError(err, t('concerts.loadDetailsFailed'));
  }
}, { immediate: true });

onMounted(async () => {
  try {
    resetApplicationForms();
    await loadIdentity();
    await loadConcerts();
  } catch (err) {
    showError(err, t('concerts.loadFailed'));
  }
});
</script>

<style scoped>
.panel {
  padding: 1rem;
}

.concert-list {
  list-style: none;
  padding: 0;
  margin: 0.85rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.concert-list li {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0.72rem;
  background: var(--panel-soft);
  cursor: pointer;
}

.concert-list li.active {
  border-color: var(--accent);
  background: #23272c;
}

.concert-list h3 {
  margin: 0;
}

.concert-list p {
  margin: 0.45rem 0 0;
}

.attachment a {
  color: var(--accent);
  text-decoration: underline;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.application-items {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.application-card {
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 0.85rem;
  background: var(--panel-soft);
}

.application-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 0.7rem;
}

.application-header h3 {
  margin: 0;
}

.field-half {
  flex: 1;
}

.action-row {
  justify-content: space-between;
}

.multiline-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.feedback-box {
  margin-top: 0.65rem;
}

.feedback-box pre {
  margin: 0.35rem 0 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.ghost {
  background: transparent;
  border: 1px solid var(--line);
}

.guest-apply-box {
  margin-top: 0.9rem;
}

.section-space {
  margin-top: 1.25rem;
}

.audition-info {
  margin-top: 0.6rem;
}

.audition-info h3 {
  margin: 0 0 0.4rem;
}

.audition-results {
  margin-top: 0.75rem;
}

.audition-result {
  padding-top: 0.6rem;
  border-top: 1px solid var(--line);
}

.audition-result + .audition-result {
  margin-top: 0.6rem;
}

.audition-result p {
  margin: 0.35rem 0 0;
}

.audition-status-pending {
  color: var(--muted);
}

.audition-status-passed {
  color: #4caf50;
}

.audition-status-failed {
  color: var(--warn);
}
</style>
