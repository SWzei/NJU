<template>
  <section class="card panel">
    <router-link class="back" to="/imslp">← {{ t('imslp.backToSearch') }}</router-link>

    <div v-if="loading" class="subtle">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="subtle warn">{{ error }}</div>
    <div v-else>
      <h2 class="section-title">{{ detail.title }}</h2>
      <p class="subtle">{{ detail.permlink }}</p>

      <div v-if="detail.metadata || detail.pageMetadata" class="metadata-panel">
        <div v-if="detail.metadata" class="meta-row">
          <span v-if="detail.metadata.type" class="meta-tag type" :style="tagStyle(detail.metadata.type)">{{ translateImslpLabel('types', detail.metadata.type) }}</span>
          <span v-if="detail.metadata.tone && detail.metadata.mode" class="meta-tag key">
            {{ translateImslpLabel('tones', detail.metadata.tone) }} {{ translateImslpLabel('modes', detail.metadata.mode) }}
          </span>
          <span
            v-for="instr in detail.metadata.instruments"
            :key="instr"
            class="meta-tag instrument"
            :style="tagStyle(instr)"
          >
            {{ translateImslpLabel('instruments', instr) }}
          </span>
        </div>

        <div v-if="detail.pageMetadata" class="work-info">
          <div v-if="detail.pageMetadata.composition_date" class="info-row">
            <span class="info-label">{{ t('imslp.compositionDate') }}:</span>
            <span class="info-value">{{ detail.pageMetadata.composition_date }}</span>
          </div>
          <div v-if="detail.pageMetadata.opus" class="info-row">
            <span class="info-label">{{ t('imslp.opus') }}:</span>
            <span class="info-value">{{ detail.pageMetadata.opus }}</span>
          </div>
          <div v-if="detail.pageMetadata.key" class="info-row">
            <span class="info-label">{{ t('imslp.key') }}:</span>
            <span class="info-value">{{ translatePageMetadata('key', detail.pageMetadata.key) }}</span>
          </div>
          <div v-if="detail.pageMetadata.piece_style" class="info-row">
            <span class="info-label">{{ t('imslp.pieceStyle') }}:</span>
            <span class="info-value">{{ translatePageMetadata('piece_style', detail.pageMetadata.piece_style) }}</span>
          </div>
          <div v-if="detail.pageMetadata.instrumentation" class="info-row">
            <span class="info-label">{{ t('imslp.instrumentation') }}:</span>
            <span class="info-value">{{ translatePageMetadata('instrumentation', detail.pageMetadata.instrumentation) }}</span>
          </div>
          <div v-if="detail.pageMetadata.movements" class="info-row">
            <span class="info-label">{{ t('imslp.movements') }}:</span>
            <span class="info-value">{{ translatePageMetadata('movements', detail.pageMetadata.movements) }}</span>
          </div>
          <div v-if="detail.pageMetadata.first_publication" class="info-row">
            <span class="info-label">{{ t('imslp.firstPublication') }}:</span>
            <span class="info-value">{{ detail.pageMetadata.first_publication }}</span>
          </div>
          <div v-if="detail.pageMetadata.first_performance" class="info-row">
            <span class="info-label">{{ t('imslp.firstPerformance') }}:</span>
            <span class="info-value">{{ detail.pageMetadata.first_performance }}</span>
          </div>
          <div v-if="detail.pageMetadata.dedication" class="info-row">
            <span class="info-label">{{ t('imslp.dedication') }}:</span>
            <span class="info-value">{{ detail.pageMetadata.dedication }}</span>
          </div>
          <div v-if="detail.pageMetadata.avg_duration" class="info-row">
            <span class="info-label">{{ t('imslp.avgDuration') }}:</span>
            <span class="info-value">{{ translatePageMetadata('avg_duration', detail.pageMetadata.avg_duration) }}</span>
          </div>
        </div>
      </div>

      <h3 class="subsection-title">{{ t('imslp.scoreFiles') }}</h3>
      <ul v-if="detail.images && detail.images.length > 0" class="score-list">
        <li v-for="img in detail.images" :key="img.id" class="score-card">
          <div class="score-info">
            <p class="score-title">{{ img.title }}
              <span
                v-for="instr in img.instruments"
                :key="instr"
                class="inline-tag instrument"
                :style="tagStyle(instr)"
              >{{ translateImslpLabel('instruments', instr) }}</span>
            </p>
            <div class="score-meta">
              <span v-if="img.page_count">{{ t('imslp.pageCount', { count: img.page_count }) }}</span>
              <span v-if="img.download_count != null">{{ t('imslp.downloadCount', { count: img.download_count }) }}</span>
              <span v-if="img.rating >= 0">{{ t('imslp.rating', { rating: Number(img.rating).toFixed(1), count: img.rating_count }) }}</span>
              <span v-if="img.size">{{ t('imslp.fileSize', { size: formatBytes(img.size) }) }}</span>
            </div>
          </div>
          <a
            class="btn secondary"
            :href="downloadUrl(img)"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t('common.download') }}
          </a>
        </li>
      </ul>
      <p v-else class="subtle">{{ t('imslp.noScores') }}</p>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import api from '@/services/api';
import { useI18n } from '@/i18n';
import { useToast } from '@/composables/toast';
import { tagStyle } from '@/utils/tagColors';
import { translateImslpLabel, translatePageMetadata } from '@/i18n';

const route = useRoute();
const { t } = useI18n();
const { showError } = useToast();

const permlink = route.params.permlink;
const detail = ref({});
const loading = ref(true);
const error = ref('');

function formatBytes(bytes) {
  if (bytes == null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadUrl(img) {
  const encodedUrl = encodeURIComponent(img.url);
  const encodedName = encodeURIComponent(img.title);
  return `/api/imslp/download?url=${encodedUrl}&filename=${encodedName}`;
}

onMounted(async () => {
  try {
    const { data } = await api.get(`/imslp/works/${encodeURIComponent(permlink)}`);
    detail.value = data;
  } catch (err) {
    error.value = err?.response?.data?.message || t('imslp.loadDetailFailed');
    showError(err, t('imslp.loadDetailFailed'));
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.panel {
  padding: 1rem;
}

.back {
  display: inline-block;
  margin-bottom: 0.8rem;
  color: var(--muted);
  text-decoration: none;
}

.back:hover {
  color: var(--ink);
}

.subsection-title {
  margin: 1.2rem 0 0.6rem;
  font-size: 1.05rem;
  font-weight: 700;
}

.score-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.score-card {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel-soft);
  padding: 0.8rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.score-info {
  min-width: 0;
}

.score-title {
  margin: 0;
  font-weight: 700;
  word-break: break-word;
}

.score-meta {
  margin-top: 0.35rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  color: var(--muted);
  font-size: 0.85rem;
}

.warn {
  color: var(--warn);
}

.metadata-panel {
  margin: 0.6rem 0 1rem;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.meta-tag {
  display: inline-block;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  font-size: 0.8rem;
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

.work-info {
  margin-top: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.info-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.3rem 0.5rem;
}

.info-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
  min-width: 5.5rem;
  flex-shrink: 0;
}

.info-value {
  font-size: 0.9rem;
  color: var(--ink);
}

.inline-tag {
  display: inline-block;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  margin-left: 0.35rem;
  vertical-align: middle;
  white-space: nowrap;
  line-height: 1.2;
}

.inline-tag.instrument {
  background: rgba(var(--success-rgb), 0.08);
  border: 1px solid rgba(var(--success-rgb), 0.2);
  color: var(--success);
}
</style>
