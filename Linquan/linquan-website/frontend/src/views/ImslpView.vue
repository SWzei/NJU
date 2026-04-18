<template>
  <section class="card panel">
    <h2 class="section-title">{{ t('imslp.title') }}</h2>

    <div class="tabs">
      <button
        class="tab"
        :class="{ active: activeTab === 'works' }"
        @click="activeTab = 'works'"
      >
        {{ t('imslp.tabWorks') }}
      </button>
      <button
        class="tab"
        :class="{ active: activeTab === 'people' }"
        @click="activeTab = 'people'"
      >
        {{ t('imslp.tabPeople') }}
      </button>
    </div>

    <div v-if="activeTab === 'works'" class="search-group">
      <div class="field search-field">
        <label>{{ t('imslp.workTitle') }}</label>
        <input v-model.trim="workTitle" :placeholder="t('imslp.workTitlePlaceholder')" />
      </div>
      <div class="field search-field">
        <label>{{ t('imslp.composer') }}</label>
        <input v-model.trim="composer" :placeholder="t('imslp.composerPlaceholder')" />
      </div>
      <button class="btn" :disabled="loading" @click="searchWorks">
        {{ loading ? t('common.loading') : t('imslp.search') }}
      </button>
    </div>

    <div v-else class="search-group">
      <div class="field search-field">
        <label>{{ t('imslp.personName') }}</label>
        <input v-model.trim="personName" :placeholder="t('imslp.personNamePlaceholder')" />
      </div>
      <button class="btn" :disabled="loading" @click="searchPeople">
        {{ loading ? t('common.loading') : t('imslp.search') }}
      </button>
    </div>

    <p v-if="error" class="subtle warn">{{ error }}</p>

    <ul v-if="results.length > 0" class="directory">
      <li v-for="item in results" :key="item.permlink">
        <router-link
          class="item-link"
          :to="{
            name: activeTab === 'works' ? 'imslpWorkDetail' : 'imslpPersonDetail',
            params: { permlink: item.permlink }
          }"
        >
          <div>
            <h3>{{ displayTitle(item) }}</h3>
            <p class="subtle">{{ displaySubtitle(item) }}</p>
          </div>
        </router-link>
      </li>
    </ul>
    <p v-else-if="!loading && searched" class="subtle">{{ t('imslp.noResults') }}</p>
  </section>
</template>

<script setup>
import { ref } from 'vue';
import api from '@/services/api';
import { useI18n } from '@/i18n';
import { useToast } from '@/composables/toast';

const { t } = useI18n();
const { showError } = useToast();

const activeTab = ref('works');
const workTitle = ref('');
const composer = ref('');
const personName = ref('');
const results = ref([]);
const loading = ref(false);
const searched = ref(false);
const error = ref('');

function displayTitle(item) {
  if (activeTab.value === 'works') {
    return item.intvals?.worktitle || item.permlink;
  }
  return item.id || item.permlink;
}

function displaySubtitle(item) {
  if (activeTab.value === 'works') {
    return item.intvals?.composer || '';
  }
  return item.permlink || '';
}

async function searchWorks() {
  loading.value = true;
  searched.value = true;
  error.value = '';
  results.value = [];
  try {
    const { data } = await api.get('/imslp/works', {
      params: {
        title: workTitle.value || undefined,
        composer: composer.value || undefined,
      }
    });
    results.value = data.items || [];
  } catch (err) {
    error.value = err?.response?.data?.message || t('imslp.searchFailed');
    showError(err, t('imslp.searchFailed'));
  } finally {
    loading.value = false;
  }
}

async function searchPeople() {
  loading.value = true;
  searched.value = true;
  error.value = '';
  results.value = [];
  try {
    const { data } = await api.get('/imslp/people', {
      params: { name: personName.value || undefined }
    });
    results.value = data.items || [];
  } catch (err) {
    error.value = err?.response?.data?.message || t('imslp.searchFailed');
    showError(err, t('imslp.searchFailed'));
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.panel {
  padding: 1rem;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.8rem;
}

.tab {
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--muted);
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.tab:hover {
  background: var(--panel-soft);
  color: var(--ink);
}

.tab.active {
  background: var(--panel-soft);
  color: var(--ink);
  border-color: var(--accent);
}

.search-group {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-bottom: 0.6rem;
}

.search-field {
  margin-bottom: 0;
}

.warn {
  color: var(--warn);
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

.item-link {
  display: block;
  padding: 0.7rem;
  text-decoration: none;
  color: inherit;
}

.directory h3 {
  margin: 0;
  font-size: 1rem;
}

.directory p {
  margin: 0.35rem 0 0;
}
</style>
