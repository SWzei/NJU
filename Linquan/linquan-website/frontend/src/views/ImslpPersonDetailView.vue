<template>
  <section class="card panel">
    <router-link class="back" to="/imslp">← {{ t('imslp.backToSearch') }}</router-link>

    <div v-if="loading" class="subtle">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="subtle warn">{{ error }}</div>
    <div v-else>
      <h2 class="section-title">
        {{ detail.name }}
        <span v-if="detail.metadata?.period" class="period-badge">
          {{ periodLabel(detail.metadata.period) }}
        </span>
      </h2>
      <p class="subtle">{{ detail.permlink }}</p>

      <div v-if="detail.metadata" class="metadata-panel">
        <div class="meta-row">
          <span class="meta-label">{{ t('imslp.totalWorks') }}:</span>
          <span class="meta-value">{{ detail.metadata.totalWorks }}</span>
        </div>
        <div v-if="detail.metadata.typeDistribution.length" class="meta-row">
          <span class="meta-label">{{ t('imslp.typeDistribution') }}:</span>
          <span
            v-for="item in detail.metadata.typeDistribution.slice(0, 8)"
            :key="item.type"
            class="meta-tag"
          >
            {{ item.type }} ({{ item.count }})
          </span>
        </div>
        <div v-if="detail.metadata.instrumentDistribution.length" class="meta-row">
          <span class="meta-label">{{ t('imslp.instrumentDistribution') }}:</span>
          <span
            v-for="item in detail.metadata.instrumentDistribution.slice(0, 8)"
            :key="item.instrument"
            class="meta-tag instrument"
          >
            {{ item.instrument }} ({{ item.count }})
          </span>
        </div>
      </div>

      <div v-for="(rows, subcategory) in detail.categoryTables" :key="subcategory" class="category-block">
        <h3 class="subsection-title">{{ subcategory }}</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th v-for="(header, idx) in tableHeaders(rows)" :key="idx">{{ header }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, ridx) in rows" :key="ridx">
                <td v-for="(header, hidx) in tableHeaders(rows)" :key="hidx">
                  <router-link
                    v-if="getLink(row, header)"
                    :to="{ name: 'imslpWorkDetail', params: { permlink: getLink(row, header) } }"
                    class="work-link"
                  >
                    {{ row[header] || '' }}
                  </router-link>
                  <span v-else>{{ row[header] || '' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p v-if="Object.keys(detail.categoryTables || {}).length === 0" class="subtle">
        {{ t('imslp.noCategoryTables') }}
      </p>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import api from '@/services/api';
import { useI18n } from '@/i18n';
import { useToast } from '@/composables/toast';

const route = useRoute();
const { t } = useI18n();
const { showError } = useToast();

const permlink = route.params.permlink;
const detail = ref({ categoryTables: {} });
const loading = ref(true);
const error = ref('');

function tableHeaders(rows) {
  if (!rows || rows.length === 0) return [];
  return Object.keys(rows[0]).filter((h) => !h.startsWith('__link_'));
}

function getLink(row, header) {
  return row[`__link_${header}`];
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

onMounted(async () => {
  try {
    const { data } = await api.get(`/imslp/people/${encodeURIComponent(permlink)}`);
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

.category-block {
  margin-top: 1.2rem;
}

.subsection-title {
  margin: 0 0 0.4rem;
  font-size: 1.05rem;
  font-weight: 700;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 10px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

th, td {
  padding: 0.5rem 0.7rem;
  border-bottom: 1px solid var(--line);
  text-align: left;
  white-space: nowrap;
}

th {
  background: var(--panel-soft);
  font-weight: 700;
}

tr:last-child td {
  border-bottom: none;
}

.warn {
  color: var(--warn);
}

.work-link {
  color: var(--accent);
  text-decoration: none;
}

.work-link:hover {
  text-decoration: underline;
}

.period-badge {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  background: rgba(var(--accent-rgb), 0.1);
  border: 1px solid rgba(var(--accent-rgb), 0.3);
  color: var(--accent);
  vertical-align: middle;
}

.metadata-panel {
  margin: 0.6rem 0 1.2rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel-soft);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.meta-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
  margin-right: 0.2rem;
}

.meta-value {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--ink);
}

.meta-tag {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  background: rgba(var(--accent-rgb), 0.08);
  border: 1px solid rgba(var(--accent-rgb), 0.2);
  color: var(--accent);
}

.meta-tag.instrument {
  background: rgba(var(--success-rgb), 0.08);
  border-color: rgba(var(--success-rgb), 0.2);
  color: var(--success);
}
</style>
