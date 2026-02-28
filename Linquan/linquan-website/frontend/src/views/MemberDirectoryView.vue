<template>
  <section class="card panel">
    <h2 class="section-title">{{ t('profile.directoryTitle') }}</h2>
    <div class="field search-field">
      <label>{{ t('profile.searchMember') }}</label>
      <input v-model.trim="memberKeyword" :placeholder="t('profile.searchMemberPlaceholder')" />
    </div>

    <ul class="directory">
      <li v-for="item in filteredMembers" :key="item.id">
        <router-link class="member-link" :to="{ name: 'memberDetail', params: { memberId: item.id } }">
          <img :src="item.avatarUrl || fallbackAvatar" alt="" />
          <div>
            <h3>{{ item.displayName || item.studentNumber }}</h3>
            <p class="subtle">
              {{ item.academy || t('profile.academyUnset') }} · {{ item.major || t('profile.majorUnset') }} ·
              {{ item.grade || t('profile.gradeUnset') }}
            </p>
            <p>{{ item.bio || t('profile.noIntro') }}</p>
          </div>
        </router-link>
      </li>
    </ul>
    <p v-if="filteredMembers.length === 0" class="subtle">{{ t('profile.noProfiles') }}</p>
  </section>

  <PhotoGallery
    :title="t('dashboard.galleryTitle')"
    :subtitle="t('dashboard.gallerySubtitle')"
    :hint="t('dashboard.galleryHint')"
    :items="galleryItems"
  />
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import api from '@/services/api';
import { useI18n } from '@/i18n';
import { linquanGalleryCards } from '@/content/photoManifest';
import PhotoGallery from '@/components/PhotoGallery.vue';
import { useToast } from '@/composables/toast';

const fallbackAvatar =
  'https://images.unsplash.com/photo-1511367461989-f85a21fda167?auto=format&fit=crop&w=160&q=60';

const members = ref([]);
const memberKeyword = ref('');
const remoteGalleryItems = ref([]);
const remoteGalleryLoaded = ref(false);

const { t, locale } = useI18n();
const { showError } = useToast();

function buildLocalGalleryItems() {
  return linquanGalleryCards.map((item) => ({
    id: item.id,
    src: item.src,
    fallback: item.fallback,
    title: t(item.titleKey),
    description: t(item.descriptionKey),
    alt: t(item.altKey)
  }));
}

const galleryItems = computed(() => {
  if (!remoteGalleryLoaded.value) {
    return buildLocalGalleryItems();
  }

  const useZh = locale.value === 'zh';
  return remoteGalleryItems.value.map((item) => ({
    id: item.id,
    src: item.src,
    fallback: item.fallback || '',
    title: useZh
      ? (item.titleZh || item.titlezh || item.titleEn || item.titleen || '')
      : (item.titleEn || item.titleen || item.titleZh || item.titlezh || ''),
    description: useZh
      ? (item.descriptionZh || item.descriptionzh || item.descriptionEn || item.descriptionen || '')
      : (item.descriptionEn || item.descriptionen || item.descriptionZh || item.descriptionzh || ''),
    alt: useZh
      ? (item.altZh || item.altzh || item.altEn || item.alten || '')
      : (item.altEn || item.alten || item.altZh || item.altzh || '')
  }));
});

const filteredMembers = computed(() => {
  const keyword = memberKeyword.value.trim().toLowerCase();
  if (!keyword) {
    return members.value;
  }
  return members.value.filter((item) => {
    const fields = [
      item.displayName,
      item.studentNumber,
      item.academy,
      item.major,
      item.grade,
      item.bio,
      item.hobbies,
      item.pianoInterests,
      item.wechatAccount
    ];
    return fields.some((value) => String(value || '').toLowerCase().includes(keyword));
  });
});

onMounted(async () => {
  try {
    const { data } = await api.get('/profiles');
    members.value = data.items || [];
  } catch (err) {
    showError(err, t('profile.loadFailed'));
  }

  try {
    const { data } = await api.get('/gallery');
    const rows = data.items || [];
    if (rows.length > 0) {
      remoteGalleryItems.value = rows;
      remoteGalleryLoaded.value = true;
    } else {
      remoteGalleryItems.value = [];
      remoteGalleryLoaded.value = false;
    }
  } catch (err) {
    remoteGalleryLoaded.value = false;
  }
});
</script>

<style scoped>
.panel {
  padding: 1rem;
}

.directory {
  list-style: none;
  margin: 0.9rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.directory li {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel-soft);
}

.member-link {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 0.7rem;
  padding: 0.7rem;
}

.directory img {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  object-fit: cover;
}

.directory h3 {
  margin: 0;
}

.directory p {
  margin: 0.35rem 0 0;
}

.search-field {
  margin-bottom: 0.6rem;
}
</style>
