<template>
  <section class="grid-2">
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
          <p>{{ concert.announcement || concert.description || t('concerts.noDetails') }}</p>
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
      <p class="subtle">{{ t('concerts.applySubtitle') }}</p>
      <form class="form" @submit.prevent="submitApplication">
        <div class="field">
          <label>{{ t('concerts.selectedConcert') }}</label>
          <select v-model.number="selectedConcertId">
            <option :value="0">{{ t('common.choose') }}</option>
            <option v-for="item in concerts" :key="item.id" :value="item.id">{{ item.title }}</option>
          </select>
        </div>
        <div class="field">
          <label>{{ t('common.name') }}</label>
          <input v-model.trim="applicantName" required :placeholder="t('concerts.applicantNamePlaceholder')" />
        </div>
        <div class="field">
          <label>{{ t('common.student') }}</label>
          <input
            v-model.trim="applicantStudentNumber"
            required
            readonly
            :placeholder="t('concerts.applicantStudentNumberPlaceholder')"
          />
        </div>
        <div class="field">
          <label>{{ t('concerts.pieceZh') }}</label>
          <input v-model.trim="pieceZh" required :placeholder="t('concerts.pieceZhPlaceholder')" />
        </div>
        <div class="field">
          <label>{{ t('concerts.pieceEn') }}</label>
          <input v-model.trim="pieceEn" required :placeholder="t('concerts.pieceEnPlaceholder')" />
        </div>
        <div class="row">
          <div class="field field-half">
            <label>{{ t('concerts.durationMin') }}</label>
            <input type="number" min="1" max="180" v-model.number="durationMin" required />
          </div>
          <div class="field field-half">
            <label>{{ t('concerts.contactQq') }}</label>
            <input v-model.trim="contactQq" required :placeholder="t('concerts.contactQqPlaceholder')" />
          </div>
        </div>
        <div class="field">
          <label>{{ t('concerts.scoreFile') }}</label>
          <input type="file" @change="onFileChange" />
        </div>
        <button class="btn" :disabled="submitting || !selectedConcertId">
          {{ submitting ? t('concerts.submitting') : t('concerts.submit') }}
        </button>
      </form>

      <article class="current-application" v-if="myApplication">
        <h3>{{ t('concerts.currentApplicationTitle') }}</h3>
        <p class="subtle">{{ t('concerts.currentApplicationHint') }}</p>
        <p><strong>{{ t('common.name') }}:</strong> {{ myApplication.applicantName || '-' }}</p>
        <p><strong>{{ t('common.student') }}:</strong> {{ myApplication.applicantStudentNumber || '-' }}</p>
        <p><strong>{{ t('concerts.pieceZh') }}:</strong> {{ myApplication.pieceZh || myApplication.pieceTitle || '-' }}</p>
        <p><strong>{{ t('concerts.pieceEn') }}:</strong> {{ myApplication.pieceEn || '-' }}</p>
        <p><strong>{{ t('concerts.durationMin') }}:</strong> {{ myApplication.durationMin || '-' }}</p>
        <p><strong>{{ t('concerts.contactQq') }}:</strong> {{ myApplication.contactQq || '-' }}</p>
        <p>
          <strong>{{ t('concerts.scoreFile') }}:</strong>
          <a
            v-if="myApplication.scoreFilePath"
            :href="myApplication.scoreFilePath"
            target="_blank"
            rel="noopener"
          >
            {{ t('concerts.downloadScoreFile') }}
          </a>
          <span v-else>{{ t('concerts.noScoreFile') }}</span>
        </p>
      </article>
    </article>
  </section>

  <section class="grid-2 section-space">
    <article class="card panel">
      <h2 class="section-title">{{ t('concerts.auditionTitle') }}</h2>
      <table>
        <thead>
          <tr>
            <th>{{ t('common.time') }}</th>
            <th>{{ t('common.location') }}</th>
            <th>{{ t('concerts.performer') }}</th>
            <th>{{ t('concerts.piece') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="slot in auditions" :key="slot.id">
            <td>{{ formatDate(slot.startTime) }} - {{ toTime(slot.endTime) }}</td>
            <td>{{ slot.location || '-' }}</td>
            <td>{{ slot.performerName || '-' }}</td>
            <td>{{ slot.pieceTitle || '-' }}</td>
          </tr>
          <tr v-if="auditions.length === 0">
            <td colspan="4" class="subtle">{{ t('concerts.noAudition') }}</td>
          </tr>
        </tbody>
      </table>
    </article>

    <article class="card panel">
      <h2 class="section-title">{{ t('concerts.resultTitle') }}</h2>
      <div v-if="Array.isArray(results) && results.length > 0">
        <ul class="result-list">
          <li v-for="item in results" :key="item.id">
            <p>
              <strong>{{ item.displayName || item.pieceTitle || t('concerts.resultFallback') }}</strong>
              · {{ resultStatusLabel(item.status) }}
            </p>
            <p class="subtle">{{ item.feedback || t('concerts.noFeedback') }}</p>
          </li>
        </ul>
      </div>
      <div v-else-if="results && !Array.isArray(results)">
        <p><strong>{{ t('common.status') }}:</strong> {{ resultStatusLabel(results.status) || '-' }}</p>
        <p><strong>{{ t('concerts.piece') }}:</strong> {{ results.pieceTitle || '-' }}</p>
        <p><strong>{{ t('common.feedback') }}:</strong> {{ results.feedback || t('concerts.noFeedback') }}</p>
      </div>
      <p v-else class="subtle">{{ t('concerts.noResult') }}</p>
    </article>
  </section>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import api from '@/services/api';
import { useI18n } from '@/i18n';
import { useToast } from '@/composables/toast';
import { useAuthStore } from '@/stores/auth';

const concerts = ref([]);
const selectedConcertId = ref(0);
const auditions = ref([]);
const results = ref(null);
const myApplication = ref(null);

const applicantName = ref('');
const applicantStudentNumber = ref('');
const pieceZh = ref('');
const pieceEn = ref('');
const durationMin = ref(5);
const contactQq = ref('');
const scoreFile = ref(null);

const submitting = ref(false);
const { t, locale } = useI18n();
const { showSuccess, showError } = useToast();
const auth = useAuthStore();

function formatDate(value) {
  return value
    ? new Date(value).toLocaleString(locale.value === 'zh' ? 'zh-CN' : 'en-US')
    : '-';
}

function toTime(value) {
  const formatLocale = locale.value === 'zh' ? 'zh-CN' : 'en-US';
  return value
    ? new Date(value).toLocaleTimeString(formatLocale, { hour: '2-digit', minute: '2-digit' })
    : '-';
}

function statusLabel(status) {
  return t(`concertStatus.${status}`) || status;
}

function resultStatusLabel(status) {
  if (!status) {
    return '-';
  }
  return t(`auditionResult.${status}`) || status;
}

function onFileChange(event) {
  scoreFile.value = event.target.files?.[0] || null;
}

function selectConcert(concertId) {
  selectedConcertId.value = concertId;
}

async function loadConcerts() {
  const { data } = await api.get('/concerts');
  concerts.value = data.items || [];
  if (!selectedConcertId.value && concerts.value.length > 0) {
    selectedConcertId.value = concerts.value[0].id;
  }
}

async function loadIdentity() {
  try {
    const { data } = await api.get('/profiles/me');
    applicantName.value = data?.displayName || auth.user?.studentNumber || '';
    applicantStudentNumber.value = data?.studentNumber || auth.user?.studentNumber || '';
  } catch (err) {
    applicantName.value = auth.user?.studentNumber || '';
    applicantStudentNumber.value = auth.user?.studentNumber || '';
  }
}

async function loadAuditionsAndResults() {
  if (!selectedConcertId.value) {
    auditions.value = [];
    results.value = null;
    myApplication.value = null;
    return;
  }
  const [auditionsRes, resultsRes, myApplicationRes] = await Promise.all([
    api.get(`/concerts/${selectedConcertId.value}/auditions`),
    api.get(`/concerts/${selectedConcertId.value}/results`),
    api.get(`/concerts/${selectedConcertId.value}/my-application`)
  ]);
  auditions.value = auditionsRes.data.items || [];
  results.value = resultsRes.data.items || resultsRes.data.item || null;
  myApplication.value = myApplicationRes.data.item || null;

  if (myApplication.value) {
    applicantName.value = myApplication.value.applicantName || applicantName.value || '';
    applicantStudentNumber.value =
      myApplication.value.applicantStudentNumber || applicantStudentNumber.value || '';
    pieceZh.value = myApplication.value.pieceZh || myApplication.value.pieceTitle || '';
    pieceEn.value = myApplication.value.pieceEn || '';
    durationMin.value = Number(myApplication.value.durationMin || 5);
    contactQq.value = myApplication.value.contactQq || '';
    scoreFile.value = null;
  } else {
    pieceZh.value = '';
    pieceEn.value = '';
    durationMin.value = 5;
    contactQq.value = '';
    scoreFile.value = null;
  }
}

async function submitApplication() {
  if (!selectedConcertId.value) {
    showError(t('concerts.chooseConcert'));
    return;
  }
  if (!window.confirm(t('concerts.confirmSubmit'))) {
    return;
  }
  submitting.value = true;
  try {
    const formData = new FormData();
    formData.append('applicantName', applicantName.value);
    formData.append('applicantStudentNumber', applicantStudentNumber.value);
    formData.append('pieceZh', pieceZh.value);
    formData.append('pieceEn', pieceEn.value);
    formData.append('durationMin', String(durationMin.value || ''));
    formData.append('contactQq', contactQq.value);
    if (scoreFile.value) {
      formData.append('scoreFile', scoreFile.value);
    }

    await api.post(`/concerts/${selectedConcertId.value}/applications`, formData);
    showSuccess(t('concerts.submitSuccess'));
    await loadAuditionsAndResults();
  } catch (err) {
    showError(err, t('concerts.submitFailed'));
  } finally {
    submitting.value = false;
  }
}

watch(selectedConcertId, async () => {
  try {
    await loadAuditionsAndResults();
  } catch (err) {
    showError(err, t('concerts.loadDetailsFailed'));
  }
});

onMounted(async () => {
  try {
    await loadIdentity();
    await loadConcerts();
    await loadAuditionsAndResults();
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

.field-half {
  flex: 1;
}

.section-space {
  margin-top: 1rem;
}

.result-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.result-list li {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0.65rem;
  background: var(--panel-soft);
}

.current-application {
  margin-top: 0.85rem;
  border-top: 1px solid var(--line);
  padding-top: 0.75rem;
}

.current-application h3 {
  margin: 0;
}

.current-application p {
  margin: 0.35rem 0 0;
}

.current-application a {
  color: var(--accent);
  text-decoration: underline;
}
</style>
