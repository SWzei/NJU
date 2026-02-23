<template>
  <section class="grid-2">
    <article class="card panel">
      <h2 class="section-title">{{ t('admin.publishActivity') }}</h2>
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
            <label>{{ t('admin.eventTime') }}</label>
            <input type="datetime-local" v-model="activity.eventTime" />
            <p class="subtle">{{ t('admin.dateTimeGuide') }}</p>
          </div>
          <div class="field field-half">
            <label>{{ t('admin.location') }}</label>
            <input v-model.trim="activity.location" :placeholder="t('admin.locationPlaceholder')" />
          </div>
        </div>
        <button class="btn">{{ t('admin.publishActivityButton') }}</button>
      </form>
    </article>

    <article class="card panel">
      <h2 class="section-title">{{ t('admin.publishAnnouncement') }}</h2>
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
  </section>

  <section class="grid-2 section-space">
    <article class="card panel">
      <h2 class="section-title">{{ t('admin.manageActivities') }}</h2>
      <ul class="item-list">
        <li
          v-for="item in activities"
          :key="item.id"
          :class="{ active: item.id === selectedActivityId }"
          @click="selectActivity(item)"
        >
          <h3>{{ item.title }}</h3>
          <p class="subtle">
            {{ item.isPublished ? t('admin.statePublished') : t('admin.stateUnpublished') }}
            <span v-if="item.eventTime"> · {{ item.eventTime }}</span>
          </p>
        </li>
      </ul>
      <p v-if="activities.length === 0" class="subtle">{{ t('admin.noActivitiesAdmin') }}</p>

      <form v-if="selectedActivityId" class="form edit-form" @submit.prevent="saveActivity">
        <h3>{{ t('admin.editActivity') }}</h3>
        <div class="field">
          <label>{{ t('admin.title') }}</label>
          <input v-model.trim="editActivity.title" required />
        </div>
        <div class="field">
          <label>{{ t('admin.content') }}</label>
          <textarea v-model.trim="editActivity.content" required />
        </div>
        <div class="row">
          <div class="field field-half">
            <label>{{ t('admin.eventTime') }}</label>
            <input type="datetime-local" v-model="editActivity.eventTime" />
          </div>
          <div class="field field-half">
            <label>{{ t('admin.location') }}</label>
            <input v-model.trim="editActivity.location" :placeholder="t('admin.locationPlaceholder')" />
          </div>
        </div>
        <label class="toggle">
          <input type="checkbox" v-model="editActivity.isPublished" />
          {{ editActivity.isPublished ? t('admin.statePublished') : t('admin.stateUnpublished') }}
        </label>
        <div class="row">
          <button class="btn" type="submit">{{ t('admin.saveActivity') }}</button>
          <button class="btn warn" type="button" @click="deleteActivity">{{ t('admin.deleteActivity') }}</button>
        </div>
      </form>
    </article>

    <article class="card panel">
      <h2 class="section-title">{{ t('admin.manageAnnouncements') }}</h2>
      <ul class="item-list">
        <li
          v-for="item in announcements"
          :key="item.id"
          :class="{ active: item.id === selectedAnnouncementId }"
          @click="selectAnnouncement(item)"
        >
          <h3>{{ item.title }}</h3>
          <p class="subtle">{{ item.isPublished ? t('admin.statePublished') : t('admin.stateUnpublished') }}</p>
        </li>
      </ul>
      <p v-if="announcements.length === 0" class="subtle">{{ t('admin.noAnnouncementsAdmin') }}</p>

      <form v-if="selectedAnnouncementId" class="form edit-form" @submit.prevent="saveAnnouncement">
        <h3>{{ t('admin.editAnnouncement') }}</h3>
        <div class="field">
          <label>{{ t('admin.title') }}</label>
          <input v-model.trim="editAnnouncement.title" required />
        </div>
        <div class="field">
          <label>{{ t('admin.content') }}</label>
          <textarea v-model.trim="editAnnouncement.content" required />
        </div>
        <label class="toggle">
          <input type="checkbox" v-model="editAnnouncement.isPublished" />
          {{ editAnnouncement.isPublished ? t('admin.statePublished') : t('admin.stateUnpublished') }}
        </label>
        <div class="row">
          <button class="btn" type="submit">{{ t('admin.saveAnnouncement') }}</button>
          <button class="btn warn" type="button" @click="deleteAnnouncement">{{ t('admin.deleteAnnouncement') }}</button>
        </div>
      </form>
    </article>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import api from '@/services/api';
import { useI18n } from '@/i18n';
import { useToast } from '@/composables/toast';

const { t } = useI18n();

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

const activities = ref([]);
const selectedActivityId = ref(0);
const editActivity = reactive({
  title: '',
  content: '',
  eventTime: '',
  location: '',
  isPublished: true
});

const announcements = ref([]);
const selectedAnnouncementId = ref(0);
const editAnnouncement = reactive({
  title: '',
  content: '',
  isPublished: true
});

const { showSuccess, showError } = useToast();

function toStorageDateTime(value) {
  if (!value) {
    return undefined;
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

async function loadActivities() {
  const { data } = await api.get('/admin/activities');
  activities.value = data.items || [];
  if (!activities.value.some((item) => item.id === selectedActivityId.value)) {
    selectedActivityId.value = 0;
  }
}

async function loadAnnouncements() {
  const { data } = await api.get('/admin/announcements');
  announcements.value = data.items || [];
  if (!announcements.value.some((item) => item.id === selectedAnnouncementId.value)) {
    selectedAnnouncementId.value = 0;
  }
}

function selectActivity(item) {
  selectedActivityId.value = item.id;
  editActivity.title = item.title || '';
  editActivity.content = item.content || '';
  editActivity.eventTime = toInputDateTime(item.eventTime);
  editActivity.location = item.location || '';
  editActivity.isPublished = Boolean(item.isPublished);
}

function selectAnnouncement(item) {
  selectedAnnouncementId.value = item.id;
  editAnnouncement.title = item.title || '';
  editAnnouncement.content = item.content || '';
  editAnnouncement.isPublished = Boolean(item.isPublished);
}

async function postActivity() {
  if (!window.confirm(t('admin.confirmPublishActivity'))) {
    return;
  }
  try {
    await api.post('/admin/activities', {
      title: activity.title,
      content: activity.content,
      eventTime: toStorageDateTime(activity.eventTime),
      location: activity.location
    });
    setMessage(t('admin.activityPublished'));
    activity.title = '';
    activity.content = '';
    activity.eventTime = '';
    activity.location = '';
    await loadActivities();
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
    await loadAnnouncements();
  } catch (err) {
    setError(err);
  }
}

async function saveActivity() {
  if (!selectedActivityId.value) {
    return;
  }
  if (!window.confirm(t('admin.confirmSaveActivity'))) {
    return;
  }
  try {
    await api.patch(`/admin/activities/${selectedActivityId.value}`, {
      title: editActivity.title,
      content: editActivity.content,
      eventTime: editActivity.eventTime ? toStorageDateTime(editActivity.eventTime) : null,
      location: editActivity.location,
      isPublished: editActivity.isPublished
    });
    setMessage(t('admin.activityUpdated'));
    await loadActivities();
  } catch (err) {
    setError(err);
  }
}

async function deleteActivity() {
  if (!selectedActivityId.value) {
    return;
  }
  if (!window.confirm(t('admin.confirmDeleteActivity'))) {
    return;
  }
  try {
    await api.delete(`/admin/activities/${selectedActivityId.value}`);
    setMessage(t('admin.activityDeleted'));
    selectedActivityId.value = 0;
    await loadActivities();
  } catch (err) {
    setError(err);
  }
}

async function saveAnnouncement() {
  if (!selectedAnnouncementId.value) {
    return;
  }
  if (!window.confirm(t('admin.confirmSaveAnnouncement'))) {
    return;
  }
  try {
    await api.patch(`/admin/announcements/${selectedAnnouncementId.value}`, {
      title: editAnnouncement.title,
      content: editAnnouncement.content,
      isPublished: editAnnouncement.isPublished
    });
    setMessage(t('admin.announcementUpdated'));
    await loadAnnouncements();
  } catch (err) {
    setError(err);
  }
}

async function deleteAnnouncement() {
  if (!selectedAnnouncementId.value) {
    return;
  }
  if (!window.confirm(t('admin.confirmDeleteAnnouncement'))) {
    return;
  }
  try {
    await api.delete(`/admin/announcements/${selectedAnnouncementId.value}`);
    setMessage(t('admin.announcementDeleted'));
    selectedAnnouncementId.value = 0;
    await loadAnnouncements();
  } catch (err) {
    setError(err);
  }
}

onMounted(async () => {
  try {
    await Promise.all([loadActivities(), loadAnnouncements()]);
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

.item-list {
  list-style: none;
  margin: 0.6rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  max-height: 220px;
  overflow: auto;
}

.item-list li {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel-soft);
  padding: 0.6rem;
  cursor: pointer;
}

.item-list li.active {
  border-color: var(--accent);
  background: #23272c;
}

.item-list h3 {
  margin: 0;
}

.item-list p {
  margin: 0.35rem 0 0;
}

.edit-form {
  margin-top: 0.9rem;
  border-top: 1px solid var(--line);
  padding-top: 0.8rem;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.92rem;
  color: var(--muted);
}

</style>
