<template>
  <section class="card panel">
    <router-link class="back" to="/imslp">← {{ t('imslp.backToSearch') }}</router-link>

    <div v-if="loadingMeta" class="subtle">{{ t('common.loading') }}</div>
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

      <div v-if="typeChartData" class="chart-section">
        <h3 class="subsection-title">{{ t('imslp.typeDistributionChart') }}</h3>
        <div class="chart-wrapper">
          <svg viewBox="-1.1 -1.1 2.2 2.2" class="pie-chart">
            <path
              v-for="(slice, idx) in typeChartData.slices"
              :key="idx"
              :d="slice.path"
              :fill="slice.color"
              stroke="var(--panel-soft)"
              stroke-width="0.02"
            />
          </svg>
          <ul class="chart-legend">
            <li v-for="(slice, idx) in typeChartData.slices" :key="idx">
              <span class="legend-dot" :style="{ background: slice.color }"></span>
              <span class="legend-label">{{ slice.label }}</span>
              <span class="legend-value">{{ slice.value }} ({{ slice.percentage }}%)</span>
            </li>
          </ul>
        </div>
      </div>

      <div v-if="instrumentChartData" class="chart-section">
        <h3 class="subsection-title">{{ t('imslp.instrumentDistributionChart') }}</h3>
        <div class="chart-wrapper">
          <svg viewBox="-1.1 -1.1 2.2 2.2" class="pie-chart">
            <path
              v-for="(slice, idx) in instrumentChartData.slices"
              :key="idx"
              :d="slice.path"
              :fill="slice.color"
              stroke="var(--panel-soft)"
              stroke-width="0.02"
            />
          </svg>
          <ul class="chart-legend">
            <li v-for="(slice, idx) in instrumentChartData.slices" :key="idx">
              <span class="legend-dot" :style="{ background: slice.color }"></span>
              <span class="legend-label">{{ slice.label }}</span>
              <span class="legend-value">{{ slice.value }} ({{ slice.percentage }}%)</span>
            </li>
          </ul>
        </div>
      </div>

      <div v-if="loadingWorks" class="subtle">{{ t('imslp.loadingWorks') }}</div>
      <div v-else>
        <div v-for="(rows, subcategory) in categoryTables" :key="subcategory" class="category-block">
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

        <p v-if="Object.keys(categoryTables || {}).length === 0" class="subtle">
          {{ t('imslp.noCategoryTables') }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import api from '@/services/api';
import { useI18n } from '@/i18n';
import { useToast } from '@/composables/toast';

const route = useRoute();
const { t } = useI18n();
const { showError } = useToast();

const permlink = route.params.permlink;
const detail = ref({});
const categoryTables = ref({});
const loadingMeta = ref(true);
const loadingWorks = ref(true);
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

function buildPieChart(chart) {
  if (!chart || !chart.values?.length) return null;
  const total = chart.values.reduce((a, b) => a + b, 0);
  let currentAngle = -Math.PI / 2;
  const slices = chart.labels.map((label, i) => {
    const value = chart.values[i];
    const angle = (value / total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    const x1 = Math.cos(startAngle);
    const y1 = Math.sin(startAngle);
    const x2 = Math.cos(endAngle);
    const y2 = Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const path = `M 0 0 L ${x1} ${y1} A 1 1 0 ${largeArc} 1 ${x2} ${y2} Z`;
    currentAngle = endAngle;
    return {
      label,
      value,
      color: chart.colors[i],
      percentage: ((value / total) * 100).toFixed(1),
      path,
    };
  });
  return { slices, total };
}

const typeChartData = computed(() =>
  buildPieChart(detail.value.metadata?.typeDistributionChartData)
);

const instrumentChartData = computed(() =>
  buildPieChart(detail.value.metadata?.instrumentDistributionChartData)
);

onMounted(async () => {
  // 1. Load metadata immediately (from local DB)
  const metaPromise = api.get(`/imslp/people/${encodeURIComponent(permlink)}`).then(
    ({ data }) => {
      detail.value = data;
    },
    (err) => {
      error.value = err?.response?.data?.message || t('imslp.loadDetailFailed');
      showError(err, t('imslp.loadDetailFailed'));
    }
  ).finally(() => {
    loadingMeta.value = false;
  });

  // 2. Load works list from IMSLP (slower)
  const worksPromise = api.get(`/imslp/people/${encodeURIComponent(permlink)}/works`).then(
    ({ data }) => {
      categoryTables.value = data.categoryTables || {};
    },
    () => {
      // Works load failure is non-fatal; just show empty tables
      categoryTables.value = {};
    }
  ).finally(() => {
    loadingWorks.value = false;
  });

  await Promise.all([metaPromise, worksPromise]);
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

.chart-section {
  margin: 1.2rem 0;
}

.chart-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 1.2rem;
  align-items: flex-start;
}

.pie-chart {
  width: 200px;
  height: 200px;
  flex-shrink: 0;
}

.chart-legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex: 1;
  min-width: 160px;
}

.chart-legend li {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  break-inside: avoid;
}

@media (min-width: 641px) {
  .chart-legend {
    flex-direction: row;
    flex-wrap: wrap;
    column-count: 2;
    display: block;
  }

  .chart-legend li {
    width: 100%;
    margin-bottom: 0.4rem;
  }
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}

.legend-label {
  color: var(--ink);
  font-weight: 600;
}

.legend-value {
  color: var(--muted);
  margin-left: auto;
}

@media (max-width: 640px) {
  .chart-wrapper {
    flex-direction: column;
    align-items: center;
  }

  .chart-legend {
    width: 100%;
  }
}
</style>
