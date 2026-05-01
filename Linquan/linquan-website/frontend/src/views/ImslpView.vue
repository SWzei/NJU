<template>
  <section class="card panel">
    <h2 class="section-title">{{ t('imslp.title') }}</h2>

    <div class="tabs">
      <button
        class="tab"
        :class="{ active: activeTab === 'works' }"
        @click="switchTab('works')"
      >
        {{ t('imslp.tabWorks') }}
      </button>
      <button
        class="tab"
        :class="{ active: activeTab === 'people' }"
        @click="switchTab('people')"
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
      <div class="filters-row">
        <div class="field filter-field">
          <label>{{ t('imslp.filterPeriod') }}</label>
          <select v-model="filterPeriod">
            <option value="">{{ t('imslp.all') }}</option>
            <option v-for="p in filterOptions.periods" :key="p.value" :value="p.value">{{ periodLabel(p.label) }}</option>
          </select>
        </div>
        <div class="field filter-field">
          <label>{{ t('imslp.filterInstrument') }}</label>
          <select v-model="filterInstrument">
            <option value="">{{ t('imslp.all') }}</option>
            <option v-for="i in filterOptions.instruments" :key="i" :value="i">{{ translateImslpLabel('instruments', i) }}</option>
          </select>
        </div>
        <div class="field filter-field">
          <label>{{ t('imslp.filterType') }}</label>
          <select v-model="filterType">
            <option value="">{{ t('imslp.all') }}</option>
            <option v-for="tp in filterOptions.types" :key="tp" :value="tp">{{ translateImslpLabel('types', tp) }}</option>
          </select>
        </div>
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
      <div class="filters-row">
        <div class="field filter-field">
          <label>{{ t('imslp.filterPeriod') }}</label>
          <select v-model="filterPeriod">
            <option value="">{{ t('imslp.all') }}</option>
            <option v-for="p in filterOptions.periods" :key="p.value" :value="p.value">{{ periodLabel(p.label) }}</option>
          </select>
        </div>
        <div class="field filter-field">
          <label>{{ t('imslp.filterInstrument') }}</label>
          <select v-model="filterInstrument">
            <option value="">{{ t('imslp.all') }}</option>
            <option v-for="i in filterOptions.instruments" :key="i" :value="i">{{ translateImslpLabel('instruments', i) }}</option>
          </select>
        </div>
        <div class="field filter-field">
          <label>{{ t('imslp.filterType') }}</label>
          <select v-model="filterType">
            <option value="">{{ t('imslp.all') }}</option>
            <option v-for="tp in filterOptions.types" :key="tp" :value="tp">{{ translateImslpLabel('types', tp) }}</option>
          </select>
        </div>
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
            <div v-if="activeTab === 'works' && item.metadata" class="meta-tags">
              <span v-if="item.metadata.type" class="meta-tag type" :style="tagStyle(item.metadata.type)">{{ translateImslpLabel('types', item.metadata.type) }}</span>
              <span v-if="item.metadata.tone && item.metadata.mode" class="meta-tag key">
                {{ translateImslpLabel('tones', item.metadata.tone) }} {{ translateImslpLabel('modes', item.metadata.mode) }}
              </span>
              <span
                v-for="instr in item.metadata.instruments"
                :key="instr"
                class="meta-tag instrument"
                :style="tagStyle(instr)"
              >
                {{ translateImslpLabel('instruments', instr) }}
              </span>
            </div>
            <div v-if="activeTab === 'people' && item.metadata" class="meta-tags">
              <span v-if="item.metadata.period" class="meta-tag period">{{ periodLabel(item.metadata.period) }}</span>
              <span v-if="item.metadata.totalWorks != null" class="meta-tag count">
                {{ t('imslp.totalWorks') }}: {{ item.metadata.totalWorks }}
              </span>
            </div>
          </div>
        </router-link>
      </li>
    </ul>
    <p v-else-if="!loading && searched" class="subtle">{{ t('imslp.noResults') }}</p>
  </section>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import api from '@/services/api';
import { useI18n } from '@/i18n';
import { useToast } from '@/composables/toast';
import { tagStyle } from '@/utils/tagColors';
import { translateImslpLabel } from '@/i18n';

const { t } = useI18n();
const { showError } = useToast();

const activeTab = ref('works');
const workTitle = ref('');
const composer = ref('');
const personName = ref('');
const filterPeriod = ref('');
const filterInstrument = ref('');
const filterType = ref('');
const results = ref([]);
const loading = ref(false);
const searched = ref(false);
const error = ref('');
const filterOptions = ref({ periods: [], instruments: [], types: [] });

let searchController = new AbortController();

function cancelPendingSearch() {
  searchController.abort();
  searchController = new AbortController();
}

function isCanceled(err) {
  return err.code === 'ERR_CANCELED' || err.name === 'CanceledError';
}

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

function periodLabel(period) {
  const map = {
    Baroque: t('imslp.periodBaroque'),
    Classical: t('imslp.periodClassical'),
    Romantic: t('imslp.periodRomantic'),
    Modern: t('imslp.periodModern'),
  };
  return map[period] || period;
}

function switchTab(tab) {
  activeTab.value = tab;
  searched.value = false;
  results.value = [];
  cancelPendingSearch();
  if (tab === 'works') {
    searchWorks();
  } else {
    searchPeople();
  }
}

async function loadFilters() {
  try {
    const { data } = await api.get('/imslp/filters');
    filterOptions.value = data || { periods: [], instruments: [], types: [] };
  } catch {
    // silently ignore filter load errors
  }
}

async function searchWorks() {
  cancelPendingSearch();
  loading.value = true;
  searched.value = true;
  error.value = '';
  results.value = [];
  try {
    const { data } = await api.get('/imslp/works', {
      signal: searchController.signal,
      params: {
        title: workTitle.value || undefined,
        composer: composer.value || undefined,
        period: filterPeriod.value || undefined,
        instrument: filterInstrument.value || undefined,
        type: filterType.value || undefined,
      }
    });
    results.value = data.items || [];
  } catch (err) {
    if (isCanceled(err)) return;
    error.value = err?.response?.data?.message || t('imslp.searchFailed');
    showError(err, t('imslp.searchFailed'));
  } finally {
    loading.value = false;
  }
}

async function searchPeople() {
  cancelPendingSearch();
  loading.value = true;
  searched.value = true;
  error.value = '';
  results.value = [];
  try {
    const { data } = await api.get('/imslp/people', {
      signal: searchController.signal,
      params: {
        name: personName.value || undefined,
        period: filterPeriod.value || undefined,
        instrument: filterInstrument.value || undefined,
        type: filterType.value || undefined,
      }
    });
    results.value = data.items || [];
  } catch (err) {
    if (isCanceled(err)) return;
    error.value = err?.response?.data?.message || t('imslp.searchFailed');
    showError(err, t('imslp.searchFailed'));
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadFilters();
  searchWorks();
});

onBeforeUnmount(() => {
  cancelPendingSearch();
});
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

.filters-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.filter-field {
  margin-bottom: 0;
}

.filter-field select {
  width: 100%;
  padding: 0.4rem 0.5rem;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--ink);
  font-size: 0.9rem;
}

.meta-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.45rem;
}

.meta-tag {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--panel-soft);
  border: 1px solid var(--line);
  color: var(--ink);
}

.meta-tag.type {
  background: rgba(var(--accent-rgb), 0.1);
  border-color: rgba(var(--accent-rgb), 0.3);
  color: var(--accent);
}

.meta-tag.key {
  background: rgba(var(--warn-rgb), 0.08);
  border-color: rgba(var(--warn-rgb), 0.25);
  color: var(--warn);
}

.meta-tag.instrument {
  background: rgba(var(--success-rgb), 0.08);
  border-color: rgba(var(--success-rgb), 0.25);
  color: var(--success);
}

.meta-tag.period {
  background: rgba(var(--accent-rgb), 0.1);
  border-color: rgba(var(--accent-rgb), 0.3);
  color: var(--accent);
}

.meta-tag.count {
  background: rgba(174, 179, 185, 0.12);
  border-color: rgba(174, 179, 185, 0.25);
  color: var(--muted);
}

@media (max-width: 640px) {
  .filters-row {
    grid-template-columns: 1fr;
  }
}
</style>
