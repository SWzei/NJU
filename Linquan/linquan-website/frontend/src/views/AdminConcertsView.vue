<template>
  <section class="grid-2">
    <article class="card panel">
      <h2 class="section-title">{{ t('admin.createConcert') }}</h2>
      <form class="form" @submit.prevent="createConcert">
        <div class="field">
          <label>{{ t('admin.title') }}</label>
          <input v-model.trim="createForm.title" required />
        </div>
        <div class="field">
          <label>{{ t('admin.description') }}</label>
          <textarea v-model.trim="createForm.description" />
        </div>
        <div class="field">
          <label>{{ t('admin.announcement') }}</label>
          <textarea v-model.trim="createForm.announcement" />
        </div>
        <div class="row">
          <div class="field field-half">
            <label>{{ t('admin.applicationDeadline') }}</label>
            <input type="datetime-local" v-model="createForm.applicationDeadline" />
            <p class="subtle">{{ t('admin.dateTimeGuide') }}</p>
          </div>
          <div class="field field-half">
            <label>{{ t('common.status') }}</label>
            <select v-model="createForm.status">
              <option value="draft">{{ t('concertStatus.draft') }}</option>
              <option value="open">{{ t('concertStatus.open') }}</option>
              <option value="audition">{{ t('concertStatus.audition') }}</option>
              <option value="result">{{ t('concertStatus.result') }}</option>
              <option value="closed">{{ t('concertStatus.closed') }}</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label>{{ t('admin.attachmentFile') }}</label>
          <input type="file" @change="onCreateFileChange" />
        </div>
        <button class="btn">{{ t('admin.createConcertButton') }}</button>
      </form>
    </article>

    <article class="card panel">
      <h2 class="section-title">{{ t('admin.manageConcerts') }}</h2>
      <ul class="concert-list">
        <li
          v-for="item in concerts"
          :key="item.id"
          :class="{ active: item.id === selectedConcertId }"
          @click="selectConcert(item.id)"
        >
          <h3>{{ item.title }}</h3>
          <p class="subtle">{{ t('common.status') }}: {{ t(`concertStatus.${item.status}`) }}</p>
        </li>
      </ul>
      <p v-if="concerts.length === 0" class="subtle">{{ t('admin.noConcertsAdmin') }}</p>
    </article>
  </section>

  <section class="card panel section-space" v-if="selectedConcert">
    <h2 class="section-title">{{ t('admin.editConcert') }} - {{ selectedConcert.title }}</h2>
    <form class="form" @submit.prevent="saveConcert">
      <div class="field">
        <label>{{ t('admin.title') }}</label>
        <input v-model.trim="editForm.title" required />
      </div>
      <div class="field">
        <label>{{ t('admin.description') }}</label>
        <textarea v-model.trim="editForm.description" />
      </div>
      <div class="field">
        <label>{{ t('admin.announcement') }}</label>
        <textarea v-model.trim="editForm.announcement" />
      </div>
      <div class="row">
        <div class="field field-half">
          <label>{{ t('admin.applicationDeadline') }}</label>
          <input type="datetime-local" v-model="editForm.applicationDeadline" />
          <p class="subtle">{{ t('admin.dateTimeGuide') }}</p>
        </div>
        <div class="field field-half">
          <label>{{ t('common.status') }}</label>
          <select v-model="editForm.status">
            <option value="draft">{{ t('concertStatus.draft') }}</option>
            <option value="open">{{ t('concertStatus.open') }}</option>
            <option value="audition">{{ t('concertStatus.audition') }}</option>
            <option value="result">{{ t('concertStatus.result') }}</option>
            <option value="closed">{{ t('concertStatus.closed') }}</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label>{{ t('admin.attachmentFile') }}</label>
        <input type="file" @change="onEditFileChange" />
      </div>
      <p class="subtle" v-if="selectedConcert.attachmentPath">
        <a :href="selectedConcert.attachmentPath" target="_blank" rel="noopener">
          {{ t('admin.currentAttachment') }}
        </a>
      </p>
      <label class="toggle">
        <input type="checkbox" v-model="removeAttachment" />
        {{ t('admin.removeAttachment') }}
      </label>
      <div class="row">
        <button class="btn" type="submit">{{ t('admin.saveConcert') }}</button>
        <button class="btn warn" type="button" @click="releaseConcert">{{ t('admin.releaseConcert') }}</button>
      </div>
      <div class="field">
        <label>{{ t('admin.releaseMessage') }}</label>
        <textarea v-model.trim="releaseMessage" />
      </div>
    </form>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import api from '@/services/api';
import { useI18n } from '@/i18n';
import { useToast } from '@/composables/toast';

const { t } = useI18n();

const createForm = reactive({
  title: '',
  description: '',
  announcement: '',
  applicationDeadline: '',
  status: 'draft'
});

const editForm = reactive({
  title: '',
  description: '',
  announcement: '',
  applicationDeadline: '',
  status: 'draft'
});

const concerts = ref([]);
const selectedConcertId = ref(0);
const createAttachmentFile = ref(null);
const editAttachmentFile = ref(null);
const removeAttachment = ref(false);
const releaseMessage = ref('');
const { showSuccess, showError } = useToast();

const selectedConcert = computed(
  () => concerts.value.find((item) => item.id === selectedConcertId.value) || null
);

function toStorageDateTime(value) {
  if (!value) {
    return '';
  }
  return `${value}:00`;
}

function toInputDateTime(value) {
  if (!value) {
    return '';
  }
  const raw = String(value);
  const direct = raw.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  if (direct) {
    return direct[1];
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function setMessage(text) {
  showSuccess(text);
}

function setError(err) {
  showError(err, t('admin.errorRequest'));
}

function applySelectedConcert(concert) {
  if (!concert) {
    editForm.title = '';
    editForm.description = '';
    editForm.announcement = '';
    editForm.applicationDeadline = '';
    editForm.status = 'draft';
    return;
  }
  editForm.title = concert.title || '';
  editForm.description = concert.description || '';
  editForm.announcement = concert.announcement || '';
  editForm.applicationDeadline = toInputDateTime(concert.applicationDeadline);
  editForm.status = concert.status || 'draft';
  editAttachmentFile.value = null;
  removeAttachment.value = false;
}

function onCreateFileChange(event) {
  createAttachmentFile.value = event.target.files?.[0] || null;
}

function onEditFileChange(event) {
  editAttachmentFile.value = event.target.files?.[0] || null;
}

function buildFormData(form, attachmentFile, removeCurrentAttachment = false) {
  const payload = new FormData();
  payload.append('title', form.title);
  payload.append('description', form.description || '');
  payload.append('announcement', form.announcement || '');
  payload.append('applicationDeadline', toStorageDateTime(form.applicationDeadline));
  payload.append('status', form.status);
  if (attachmentFile) {
    payload.append('attachmentFile', attachmentFile);
  }
  if (removeCurrentAttachment) {
    payload.append('removeAttachment', 'true');
  }
  return payload;
}

async function loadConcerts() {
  const { data } = await api.get('/admin/concerts');
  concerts.value = data.items || [];
  if (!concerts.value.length) {
    selectedConcertId.value = 0;
    applySelectedConcert(null);
    return;
  }
  if (!concerts.value.find((item) => item.id === selectedConcertId.value)) {
    selectedConcertId.value = concerts.value[0].id;
  }
  applySelectedConcert(selectedConcert.value);
}

function selectConcert(concertId) {
  selectedConcertId.value = concertId;
  applySelectedConcert(selectedConcert.value);
}

async function createConcert() {
  if (!window.confirm(t('admin.confirmCreateConcert'))) {
    return;
  }
  try {
    const payload = buildFormData(createForm, createAttachmentFile.value, false);
    const { data } = await api.post('/admin/concerts', payload, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    setMessage(t('admin.concertCreated', { id: data.id }));
    createForm.title = '';
    createForm.description = '';
    createForm.announcement = '';
    createForm.applicationDeadline = '';
    createForm.status = 'draft';
    createAttachmentFile.value = null;
    await loadConcerts();
    selectedConcertId.value = data.id;
    applySelectedConcert(selectedConcert.value);
  } catch (err) {
    setError(err);
  }
}

async function saveConcert() {
  if (!selectedConcert.value) {
    return;
  }
  if (!window.confirm(t('admin.confirmUpdateConcert'))) {
    return;
  }
  try {
    const payload = buildFormData(editForm, editAttachmentFile.value, removeAttachment.value);
    await api.patch(`/admin/concerts/${selectedConcert.value.id}`, payload, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    setMessage(t('admin.concertUpdated'));
    await loadConcerts();
  } catch (err) {
    setError(err);
  }
}

async function releaseConcert() {
  if (!selectedConcert.value) {
    return;
  }
  if (!window.confirm(t('admin.confirmReleaseConcert'))) {
    return;
  }
  try {
    const { data } = await api.post(`/admin/concerts/${selectedConcert.value.id}/release`, {
      message: releaseMessage.value || undefined
    });
    setMessage(t('admin.concertReleased', { count: data.notification?.sent || 0 }));
    await loadConcerts();
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

.section-space {
  margin-top: 1rem;
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
  font-size: 0.9rem;
  color: var(--muted);
}

.concert-list {
  list-style: none;
  margin: 0.7rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.concert-list li {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel-soft);
  padding: 0.62rem 0.7rem;
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
  margin: 0.35rem 0 0;
}

</style>
