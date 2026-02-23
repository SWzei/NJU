<template>
  <section class="hero card">
    <img class="hero-image" :src="heroImageSrc" :alt="t('dashboard.heroPhotoAlt')" @error="onHeroImageError" />
    <div class="hero-overlay"></div>
    <div class="hero-content">
      <h2 class="section-title">{{ t('dashboard.sloganTitle') }}</h2>
      <p>
        {{ t('dashboard.sloganBody') }}
      </p>
    </div>
  </section>

  <section class="grid-2 board">
    <article class="card panel">
      <h3>{{ t('dashboard.activityTitle') }}</h3>
      <p class="subtle">{{ t('dashboard.activitySubtitle') }}</p>
      <ul class="list">
        <li v-for="item in activities" :key="item.id">
          <h4>{{ item.title }}</h4>
          <p class="subtle">
            {{ formatDate(item.eventTime || item.createdAt) }} · {{ item.location || t('dashboard.tbd') }}
          </p>
          <p>{{ item.content }}</p>
        </li>
        <li v-if="activities.length === 0" class="subtle">{{ t('dashboard.noActivities') }}</li>
      </ul>
    </article>

    <article class="card panel">
      <h3>{{ t('dashboard.announcementTitle') }}</h3>
      <p class="subtle">{{ t('dashboard.announcementSubtitle') }}</p>
      <ul class="list">
        <li v-for="item in announcements" :key="item.id">
          <h4>{{ item.title }}</h4>
          <p class="subtle">{{ formatDate(item.createdAt) }}</p>
          <p>{{ item.content }}</p>
        </li>
        <li v-if="announcements.length === 0" class="subtle">{{ t('dashboard.noAnnouncements') }}</li>
      </ul>
    </article>
  </section>

  <section v-if="auth.isAdmin" class="card panel admin-panel">
    <h3>{{ t('dashboard.adminTitle') }}</h3>
    <p class="subtle">{{ t('dashboard.adminSubtitle') }}</p>
    <ul class="admin-list">
      <li>{{ t('dashboard.adminItemConcert') }}</li>
      <li>{{ t('dashboard.adminItemSchedule') }}</li>
      <li>{{ t('dashboard.adminItemNotice') }}</li>
    </ul>
    <router-link to="/admin" class="btn">{{ t('dashboard.goAdmin') }}</router-link>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import api from '@/services/api';
import { useI18n } from '@/i18n';
import { useAuthStore } from '@/stores/auth';
import { dashboardHeroPhoto } from '@/content/photoManifest';

const activities = ref([]);
const announcements = ref([]);
const heroImageSrc = ref(dashboardHeroPhoto.src);
const { t, locale } = useI18n();
const auth = useAuthStore();

function formatDate(value) {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString(locale.value === 'zh' ? 'zh-CN' : 'en-US');
}

function onHeroImageError() {
  if (heroImageSrc.value !== dashboardHeroPhoto.fallback) {
    heroImageSrc.value = dashboardHeroPhoto.fallback;
  }
}

async function loadData() {
  const [activityRes, announcementRes] = await Promise.all([
    api.get('/activities'),
    api.get('/announcements')
  ]);
  activities.value = activityRes.data.items || [];
  announcements.value = announcementRes.data.items || [];
}

onMounted(async () => {
  try {
    await loadData();
  } catch (err) {
    // ignore transient errors in dashboard summary
  }
});
</script>

<style scoped>
.hero {
  position: relative;
  overflow: hidden;
  min-height: 260px;
  padding: 1.2rem;
  display: flex;
  align-items: flex-end;
}

.hero-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(125deg, rgba(8, 10, 13, 0.9), rgba(17, 20, 24, 0.58)),
    radial-gradient(circle at 20% 10%, rgba(255, 255, 255, 0.18), transparent 35%);
}

.hero-content {
  position: relative;
  z-index: 1;
}

.hero-content p {
  margin: 0;
  max-width: 680px;
}

.board {
  margin-top: 1rem;
}

.panel {
  padding: 1rem;
}

.panel h3 {
  margin: 0;
  font-size: 1.15rem;
}

.list {
  margin: 0.9rem 0 0;
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.list li {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0.75rem;
  background: var(--panel-soft);
}

.list h4 {
  margin: 0;
}

.list p {
  margin: 0.45rem 0 0;
}

.admin-panel {
  margin-top: 1rem;
}

.admin-list {
  margin: 0.8rem 0 1rem;
  padding-left: 1.15rem;
  color: var(--ink);
}

.admin-list li {
  margin: 0.35rem 0;
}
</style>
