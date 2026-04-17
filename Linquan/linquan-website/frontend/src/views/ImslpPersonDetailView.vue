<template>
  <section class="card panel">
    <router-link class="back" to="/imslp">← {{ t('imslp.backToSearch') }}</router-link>

    <div v-if="loading" class="subtle">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="subtle warn">{{ error }}</div>
    <div v-else>
      <h2 class="section-title">{{ detail.name }}</h2>
      <p class="subtle">{{ detail.permlink }}</p>

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
                <td v-for="(header, hidx) in tableHeaders(rows)" :key="hidx">{{ row[header] || '' }}</td>
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
  return Object.keys(rows[0]);
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
</style>
