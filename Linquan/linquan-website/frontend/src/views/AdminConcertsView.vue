<template>
  <section class="grid-2">
    <ConcertEditorForm
      :mode="formMode"
      :form="editorForm"
      :active-title="selectedConcert?.title || ''"
      :current-attachment-path="selectedConcert?.attachmentPath || ''"
      :selected-attachment-name="selectedAttachmentFile?.name || ''"
      :remove-attachment="removeAttachment"
      :release-message="releaseMessage"
      :submitting="savingConcert"
      :releasing="releasingConcert"
      :deleting="deletingConcert"
      :disabled="editorBusy"
      :file-input-nonce="attachmentInputNonce"
      :accept="concertAttachmentAccept"
      @submit="submitConcertForm"
      @release="releaseConcert"
      @delete="deleteConcert"
      @reset-mode="beginCreateMode"
      @file-change="handleAttachmentFileChange"
      @update:form="updateEditorForm"
      @update:remove-attachment="removeAttachment = $event"
      @update:release-message="releaseMessage = $event"
    />

    <article class="card panel">
      <div class="section-head">
        <div>
          <h2 class="section-title">{{ t('admin.manageConcerts') }}</h2>
          <p class="subtle">
            {{ selectedConcert ? t('admin.currentConcertEditing', { title: selectedConcert.title }) : t('admin.currentConcertCreating') }}
          </p>
        </div>
        <button class="btn secondary" type="button" :disabled="concertsLoading || editorBusy" @click="refreshConcerts">
          {{ concertsLoading ? t('common.loading') : t('admin.refreshConcerts') }}
        </button>
      </div>

      <ul v-if="concerts.length" class="concert-list">
        <li
          v-for="item in concerts"
          :key="item.id"
          :class="{ active: item.id === selectedConcertId }"
          @click="selectConcert(item.id)"
        >
          <div class="concert-item-head">
            <h3>{{ item.title }}</h3>
            <span class="status-pill">{{ t(`concertStatus.${item.status}`) }}</span>
          </div>
          <p class="subtle" v-if="item.applicationDeadline">
            {{ t('admin.applicationDeadline') }}: {{ formatDate(item.applicationDeadline) }}
          </p>
          <p class="subtle multiline-text">{{ item.announcement || item.description || t('concerts.noDetails') }}</p>
        </li>
      </ul>
      <p v-else-if="concertsLoading" class="subtle">{{ t('common.loading') }}</p>
      <p v-else class="subtle">{{ t('admin.noConcertsAdmin') }}</p>
    </article>
  </section>

  <section class="grid-2 section-space">
    <AuditionEditorForm
      v-if="selectedConcert"
      :mode="selectedAudition ? 'edit' : 'create'"
      :form="auditionForm"
      :active-title="selectedAudition?.title || ''"
      :current-attachment-path="selectedAudition?.attachmentPath || ''"
      :selected-attachment-name="selectedAuditionAttachmentFile?.name || ''"
      :remove-attachment="removeAuditionAttachment"
      :release-message="auditionReleaseMessage"
      :submitting="savingAudition"
      :releasing="releasingAudition"
      :deleting="deletingAudition"
      :disabled="auditionEditorBusy"
      :file-input-nonce="auditionAttachmentInputNonce"
      :accept="concertAttachmentAccept"
      @submit="submitAuditionForm"
      @release="releaseAudition"
      @delete="deleteAudition"
      @reset-mode="beginCreateAuditionMode"
      @file-change="onAuditionFileChange"
      @update:form="updateAuditionForm"
      @update:remove-attachment="removeAuditionAttachment = $event"
      @update:release-message="auditionReleaseMessage = $event"
    />
    <article v-else class="card panel">
      <div class="section-head">
        <div>
          <h2 class="section-title">{{ t('admin.auditionTitle') }}</h2>
          <p class="subtle">{{ t('admin.auditionSubtitle') }}</p>
        </div>
      </div>
      <p class="subtle">{{ t('admin.concertRequired') }}</p>
    </article>

    <article class="card panel">
      <div class="section-head">
        <div>
          <h2 class="section-title">{{ t('admin.auditionListTitle') }}</h2>
          <p class="subtle">
            {{ selectedConcert ? t('admin.currentConcertEditing', { title: selectedConcert.title }) : t('admin.concertRequired') }}
          </p>
        </div>
        <button
          class="btn secondary"
          type="button"
          :disabled="!selectedConcertId || loadingAuditions || editorBusy"
          @click="loadAuditions({ force: true })"
        >
          {{ loadingAuditions ? t('common.loading') : t('admin.refreshConcerts') }}
        </button>
      </div>

      <p v-if="!selectedConcert" class="subtle">{{ t('admin.concertRequired') }}</p>
      <p v-else-if="loadingAuditions && auditions.length === 0" class="subtle">{{ t('common.loading') }}</p>
      <p v-else-if="auditions.length === 0" class="subtle">{{ t('admin.noAuditions') }}</p>

      <ul v-else class="concert-list">
        <li
          v-for="item in auditions"
          :key="item.id"
          :class="{ active: item.id === selectedAuditionId }"
          @click="selectAudition(item.id)"
        >
          <div class="concert-item-head">
            <h3>{{ item.title }}</h3>
            <span class="status-pill">{{ t(`concertStatus.${item.status}`) }}</span>
          </div>
          <p class="subtle" v-if="item.auditionTime">
            {{ t('admin.auditionTime') }}: {{ formatDate(item.auditionTime) }}
          </p>
          <p class="subtle multiline-text">{{ item.announcement || item.description || t('concerts.noDetails') }}</p>
        </li>
      </ul>
    </article>
  </section>

  <section class="grid-2 section-space">
    <article class="card panel">
      <div class="section-head">
        <div>
          <h2 class="section-title">{{ t('admin.registrationListTitle') }}</h2>
          <p class="subtle">
            {{ selectedConcert ? t('admin.registrationCount', { count: registrations.length }) : t('admin.registrationRequiresConcert') }}
          </p>
          <p v-if="selectedConcert && loadingRegistrations && registrations.length" class="subtle inline-loading">
            {{ t('common.loading') }}
          </p>
        </div>
        <div class="row action-row">
          <button
            class="btn secondary"
            type="button"
            :disabled="!selectedConcertId || loadingRegistrations"
            @click="loadRegistrations({ force: true, preserveExisting: true })"
          >
            {{ loadingRegistrations ? t('common.loading') : t('admin.loadRegistrations') }}
          </button>
          <button
            class="btn secondary"
            type="button"
            :disabled="!selectedConcertId || downloadingRegistrationsCsv"
            @click="downloadRegistrationsCsv"
          >
            {{ downloadingRegistrationsCsv ? t('common.loading') : t('admin.downloadRegistrationsCsv') }}
          </button>
        </div>
      </div>

      <p v-if="!selectedConcert" class="subtle">{{ t('admin.registrationRequiresConcert') }}</p>
      <p v-else-if="loadingRegistrations && registrations.length === 0" class="subtle">{{ t('common.loading') }}</p>
      <p v-else-if="registrations.length === 0" class="subtle">{{ t('admin.noRegistrations') }}</p>

      <div v-else class="registration-list">
        <button
          v-for="item in registrations"
          :key="item.id"
          type="button"
          class="registration-item"
          :class="{ active: item.id === selectedRegistrationId }"
          @click="selectRegistration(item.id)"
        >
          <h3>{{ item.applicantName || item.displayName }}</h3>
          <p class="subtle">{{ item.applicantStudentNumber || item.studentNumber }}</p>
          <p class="subtle multiline-text">{{ item.pieceZh || item.pieceTitle || '-' }}</p>
        </button>
      </div>
    </article>

    <article class="card panel registration-detail">
      <h2 class="section-title">{{ t('admin.registrationDetailTitle') }}</h2>
      <p v-if="!selectedConcert" class="subtle">{{ t('admin.registrationRequiresConcert') }}</p>
      <p v-else-if="loadingRegistrations && registrations.length === 0" class="subtle">{{ t('common.loading') }}</p>
      <p v-else-if="!selectedRegistration" class="subtle">{{ t('admin.registrationDetailEmpty') }}</p>

      <template v-else>
        <div class="detail-grid">
          <div>
            <span class="label">{{ t('common.name') }}</span>
            <strong>{{ selectedRegistration.applicantName || selectedRegistration.displayName || '-' }}</strong>
          </div>
          <div>
            <span class="label">{{ t('common.student') }}</span>
            <strong>{{ selectedRegistration.applicantStudentNumber || selectedRegistration.studentNumber || '-' }}</strong>
          </div>
          <div>
            <span class="label">{{ t('common.status') }}</span>
            <strong>{{ t(`applicationStatus.${selectedRegistration.status}`) || selectedRegistration.status || '-' }}</strong>
          </div>
          <div>
            <span class="label">{{ t('concerts.durationMin') }}</span>
            <strong>{{ selectedRegistration.durationMin ?? '-' }}</strong>
          </div>
          <div>
            <span class="label">{{ t('concerts.contactQq') }}</span>
            <strong>{{ selectedRegistration.contactQq || '-' }}</strong>
          </div>
          <div>
            <span class="label">{{ t('admin.submittedAt') }}</span>
            <strong>{{ formatDate(selectedRegistration.createdAt) }}</strong>
          </div>
          <div>
            <span class="label">{{ t('admin.updatedAt') }}</span>
            <strong>{{ formatDate(selectedRegistration.updatedAt) }}</strong>
          </div>
          <div>
            <span class="label">{{ t('admin.viewScoreFile') }}</span>
            <strong v-if="selectedRegistration.scoreFilePath">
              <a :href="selectedRegistration.scoreFilePath" target="_blank" rel="noopener">
                {{ t('admin.viewScoreFile') }}
              </a>
            </strong>
            <strong v-else>{{ t('concerts.noScoreFile') }}</strong>
          </div>
        </div>

        <div class="field section-space">
          <label>{{ t('concerts.pieceZh') }}</label>
          <textarea :value="selectedRegistration.pieceZh || selectedRegistration.pieceTitle || ''" rows="3" readonly />
        </div>
        <div class="field">
          <label>{{ t('concerts.pieceEn') }}</label>
          <textarea :value="selectedRegistration.pieceEn || selectedRegistration.composer || ''" rows="3" readonly />
        </div>
        <div class="field" v-if="selectedRegistration.feedback">
          <label>{{ t('common.feedback') }}</label>
          <textarea :value="selectedRegistration.feedback" rows="4" readonly />
        </div>

        <div class="audition-result section-space">
          <h3 class="section-title" style="font-size: 1.15rem; margin-bottom: 0.5rem">{{ t('admin.auditionResultTitle') }}</h3>
          <div class="field">
            <label>{{ t('admin.auditionStatus') }}</label>
            <select v-model="auditionResultForm.auditionStatus" :disabled="savingAuditionResult">
              <option value="pending">{{ t('admin.auditionStatusPending') }}</option>
              <option value="passed">{{ t('admin.auditionStatusPassed') }}</option>
              <option value="failed">{{ t('admin.auditionStatusFailed') }}</option>
            </select>
          </div>
          <div class="field">
            <label>{{ t('admin.auditionFeedback') }}</label>
            <textarea v-model="auditionResultForm.auditionFeedback" rows="3" :disabled="savingAuditionResult" />
            <p v-if="auditionResultInvalid" class="subtle" style="color: var(--warn)">
              {{ t('admin.auditionFeedbackRequired') }}
            </p>
          </div>
          <button
            class="btn"
            type="button"
            :disabled="savingAuditionResult || auditionResultInvalid"
            @click="saveAuditionResult"
          >
            {{ savingAuditionResult ? t('common.loading') : t('admin.saveAuditionResult') }}
          </button>
        </div>
      </template>
    </article>
  </section>

  <section v-if="selectedConcertId" class="card panel section-space">
    <div class="section-head">
      <h2 class="section-title">{{ t('admin.programArrangementTitle') }}</h2>
      <div class="row action-row">
        <button
          class="btn secondary"
          type="button"
          :disabled="loadingProgramArrangement"
          @click="loadProgramArrangement"
        >
          {{ loadingProgramArrangement ? t('common.loading') : t('common.open') }}
        </button>
      </div>
    </div>

    <p v-if="loadingProgramArrangement && !programArrangement.segments.length && !programArrangement.availablePrograms.length" class="subtle">
      {{ t('common.loading') }}
    </p>

    <div v-else class="grid-2 arrangement-grid">
      <article class="card panel">
        <h3 class="section-title" style="font-size: 1.1rem">{{ t('admin.availableProgramsTitle') }}</h3>
        <p v-if="programArrangement.availablePrograms.length === 0" class="subtle">{{ t('admin.noAvailablePrograms') }}</p>
        <div v-else class="program-pool">
          <div v-for="program in programArrangement.availablePrograms" :key="program.id" class="program-card">
            <div class="program-info">
              <strong>{{ program.applicantName }}</strong>
              <span class="subtle">{{ program.pieceZh }}</span>
              <span class="subtle">{{ program.durationMin }} min</span>
            </div>
            <div class="row" style="gap: 0.4rem; flex-wrap: nowrap">
              <select v-model="programSegmentSelections[program.id]" class="segment-select">
                <option v-for="seg in programArrangement.segments" :key="seg.id" :value="seg.id">
                  {{ seg.name || `${t('admin.segmentName')} ${seg.displayOrder + 1}` }}
                </option>
              </select>
              <button
                class="btn secondary"
                type="button"
                @click="addProgramToSegment(program.id, programSegmentSelections[program.id])"
              >
                {{ t('admin.addToSegment') }}
              </button>
            </div>
          </div>
        </div>
      </article>

      <article class="card panel">
        <div class="section-head">
          <h3 class="section-title" style="font-size: 1.1rem">{{ t('admin.segmentsTitle') }}</h3>
          <div class="row action-row">
            <button class="btn secondary" type="button" @click="addSegment">{{ t('admin.addSegment') }}</button>
            <button
              class="btn"
              type="button"
              :disabled="savingProgramArrangement"
              @click="saveProgramArrangement"
            >
              {{ savingProgramArrangement ? t('common.loading') : t('admin.saveProgramArrangement') }}
            </button>
          </div>
        </div>

        <p v-if="programArrangement.segments.length === 0" class="subtle">{{ t('admin.noSegments') }}</p>

        <div v-else class="segments-list">
          <div v-for="segment in programArrangement.segments" :key="segment.id" class="segment-box">
            <div class="segment-header">
              <div class="field" style="flex: 1">
                <label>{{ t('admin.segmentName') }}</label>
                <input v-model="segment.name" @input="markSegmentNameEdited(segment.id)" />
              </div>
              <div class="field" style="width: 120px">
                <label>{{ t('admin.restAfterMin') }}</label>
                <input type="number" min="0" max="999" v-model.number="segment.restAfterMin" />
              </div>
              <button class="btn ghost" type="button" @click="removeSegment(segment.id)">
                {{ t('admin.removeSegment') }}
              </button>
            </div>

            <div v-if="segment.items.length === 0" class="subtle">{{ t('admin.noItemsInSegment') }}</div>
            <div v-else class="segment-items">
              <div v-for="(item, itemIndex) in segment.items" :key="item.id || item._localId" class="program-card">
                <div class="field" style="width: 80px" v-if="itemIndex > 0">
                  <label>{{ t('admin.intervalBeforeMin') }}</label>
                  <input type="number" min="0" max="999" v-model.number="item.intervalBeforeMin" />
                </div>
                <div class="program-info" style="flex: 1">
                  <strong>{{ item.applicantName }}</strong>
                  <span class="subtle">{{ item.pieceZh }}</span>
                  <span class="subtle">{{ item.durationMin }} min</span>
                </div>
                <div class="row" style="gap: 0.4rem">
                  <button
                    class="btn ghost"
                    type="button"
                    :disabled="itemIndex === 0"
                    @click="moveItem(item.id || item._localId, -1)"
                  >
                    {{ t('admin.moveUp') }}
                  </button>
                  <button
                    class="btn ghost"
                    type="button"
                    :disabled="itemIndex === segment.items.length - 1"
                    @click="moveItem(item.id || item._localId, 1)"
                  >
                    {{ t('admin.moveDown') }}
                  </button>
                  <button class="btn ghost" type="button" @click="removeProgramItem(item.id || item._localId)">
                    {{ t('admin.removeFromSegment') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="arrangement-stats">
          <span>{{ t('admin.totalProgramCount') }}: {{ arrangementStats.totalProgramCount }}</span>
          <span>{{ t('admin.totalProgramDuration') }}: {{ arrangementStats.totalProgramDurationMin }} min</span>
          <span>{{ t('admin.totalActualDuration') }}: {{ arrangementStats.totalActualDurationMin }} min</span>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import api from '@/services/api';
import { useI18n } from '@/i18n';
import { useToast } from '@/composables/toast';
import ConcertEditorForm from '@/components/admin/ConcertEditorForm.vue';
import AuditionEditorForm from '@/components/admin/AuditionEditorForm.vue';
import { formatDateTimeInBeijing, utcIsoToBeijingInput } from '@/utils/dateTime';

const { t, locale } = useI18n();
const { showSuccess, showError } = useToast();

const concertAttachmentAccept = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif,.txt,.md,.csv,.xlsx,.xls,.ppt,.pptx';

function createEmptyConcertForm() {
  return {
    title: '',
    description: '',
    announcement: '',
    applicationDeadline: '',
    status: 'draft'
  };
}

const editorForm = reactive(createEmptyConcertForm());
const concerts = ref([]);
const selectedConcertId = ref(0);
const selectedAttachmentFile = ref(null);
const attachmentInputNonce = ref(0);
const removeAttachment = ref(false);
const releaseMessage = ref('');
const registrations = ref([]);
const selectedRegistrationId = ref(0);
const loadingRegistrations = ref(false);
const registrationsConcertId = ref(0);
const editorBaseline = ref(createEmptyConcertForm());
const concertsLoading = ref(false);
const savingConcert = ref(false);
const releasingConcert = ref(false);
const deletingConcert = ref(false);
const downloadingRegistrationsCsv = ref(false);

let concertsRequestToken = 0;
let registrationsRequestToken = 0;

const editableConcertStatuses = new Set(['draft', 'open', 'closed']);

const selectedConcert = computed(
  () => concerts.value.find((item) => item.id === selectedConcertId.value) || null
);
const selectedRegistration = computed(
  () => registrations.value.find((item) => item.id === selectedRegistrationId.value) || null
);
const formMode = computed(() => (selectedConcert.value ? 'edit' : 'create'));
const editorBusy = computed(
  () => concertsLoading.value || savingConcert.value || releasingConcert.value || deletingConcert.value
);
const hasDirtyConcertForm = computed(() => {
  const baseline = editorBaseline.value;
  return (
    editorForm.title.trim() !== baseline.title ||
    editorForm.description.trim() !== baseline.description ||
    editorForm.announcement.trim() !== baseline.announcement ||
    editorForm.applicationDeadline !== baseline.applicationDeadline ||
    editorForm.status !== baseline.status ||
    Boolean(selectedAttachmentFile.value) ||
    removeAttachment.value
  );
});

function createEmptyAuditionForm() {
  return {
    title: '',
    description: '',
    announcement: '',
    auditionTime: '',
    status: 'draft'
  };
}

const auditionForm = reactive(createEmptyAuditionForm());
const auditions = ref([]);
const selectedAuditionId = ref(0);
const selectedAuditionAttachmentFile = ref(null);
const auditionAttachmentInputNonce = ref(0);
const removeAuditionAttachment = ref(false);
const auditionReleaseMessage = ref('');
const loadingAuditions = ref(false);
const auditionsConcertId = ref(0);
const auditionEditorBaseline = ref(createEmptyAuditionForm());
const savingAudition = ref(false);
const releasingAudition = ref(false);
const deletingAudition = ref(false);

const auditionResultForm = reactive({
  auditionStatus: 'pending',
  auditionFeedback: ''
});
const savingAuditionResult = ref(false);

const programArrangement = reactive({
  segments: [],
  availablePrograms: [],
  stats: { totalProgramCount: 0, totalProgramDurationMin: 0, totalActualDurationMin: 0 }
});
const programSegmentSelections = reactive({});
const loadingProgramArrangement = ref(false);
const savingProgramArrangement = ref(false);
const segmentNameManuallyEdited = ref(new Set());
let programArrangementRequestToken = 0;
let programArrangementLocalId = 0;

let auditionsRequestToken = 0;

const selectedAudition = computed(
  () => auditions.value.find((item) => item.id === selectedAuditionId.value) || null
);
const auditionEditorBusy = computed(
  () => savingAudition.value || releasingAudition.value || deletingAudition.value
);
const hasDirtyAuditionForm = computed(() => {
  const baseline = auditionEditorBaseline.value;
  return (
    auditionForm.title.trim() !== baseline.title ||
    auditionForm.description.trim() !== baseline.description ||
    auditionForm.announcement.trim() !== baseline.announcement ||
    auditionForm.auditionTime !== baseline.auditionTime ||
    auditionForm.status !== baseline.status ||
    Boolean(selectedAuditionAttachmentFile.value) ||
    removeAuditionAttachment.value
  );
});
const auditionResultInvalid = computed(() => {
  return (
    auditionResultForm.auditionStatus === 'failed' &&
    !String(auditionResultForm.auditionFeedback || '').trim()
  );
});

const arrangementStats = computed(() => {
  const items = programArrangement.segments.flatMap((seg) => seg.items || []);
  const totalProgramCount = items.length;
  const totalProgramDurationMin = items.reduce((sum, item) => sum + (Number(item.durationMin) || 0), 0);
  const totalIntervalMin = items.reduce((sum, item) => sum + (Number(item.intervalBeforeMin) || 0), 0);
  const totalRestMin = programArrangement.segments.reduce((sum, seg) => sum + (Number(seg.restAfterMin) || 0), 0);
  const totalActualDurationMin = totalProgramDurationMin + totalIntervalMin + totalRestMin;
  return {
    totalProgramCount,
    totalProgramDurationMin,
    totalActualDurationMin
  };
});

function formatDate(value) {
  return formatDateTimeInBeijing(value, locale.value);
}

function setError(err, fallbackKey = 'admin.errorRequest') {
  const details = err?.response?.data?.details;
  const detailText = Array.isArray(details) && details.length > 0
    ? details[0]?.message
    : '';
  showError(detailText || err, t(fallbackKey));
}

function toStorageDateTime(value) {
  if (!value) {
    return '';
  }
  return `${value}:00`;
}

function toInputDateTime(value) {
  return utcIsoToBeijingInput(value);
}

function normalizeConcertForm(form) {
  form.title = String(form.title || '').trim();
  form.description = String(form.description || '').trim();
  form.announcement = String(form.announcement || '').trim();
}

function snapshotConcertFormFromItem(item) {
  return {
    title: String(item?.title || '').trim(),
    description: String(item?.description || '').trim(),
    announcement: String(item?.announcement || '').trim(),
    applicationDeadline: toInputDateTime(item?.applicationDeadline),
    status: editableConcertStatuses.has(item?.status) ? item.status : 'draft'
  };
}

function validateConcertForm(form) {
  normalizeConcertForm(form);
  if (form.title.length < 2) {
    showError(t('admin.publishTitleInvalid'));
    return false;
  }
  return true;
}

function buildConcertFormData(form, attachmentFile, removeCurrentAttachment = false) {
  const payload = new FormData();
  payload.append('title', form.title || '');
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

function normalizeConcertItem(item) {
  return {
    ...item,
    description: item?.description || '',
    announcement: item?.announcement || '',
    attachmentPath: item?.attachmentPath || null,
    status: editableConcertStatuses.has(item?.status) ? item.status : 'draft'
  };
}

function resetEditorState() {
  const empty = createEmptyConcertForm();
  Object.assign(editorForm, empty);
  editorBaseline.value = { ...empty };
  selectedAttachmentFile.value = null;
  removeAttachment.value = false;
  releaseMessage.value = '';
  attachmentInputNonce.value += 1;
}

function syncEditorStateFromConcert(concert, { preserveReleaseMessage = false } = {}) {
  if (!concert) {
    resetEditorState();
    return;
  }

  const snapshot = snapshotConcertFormFromItem(concert);
  Object.assign(editorForm, snapshot);
  editorBaseline.value = { ...snapshot };
  selectedAttachmentFile.value = null;
  removeAttachment.value = false;
  if (!preserveReleaseMessage) {
    releaseMessage.value = '';
  }
  attachmentInputNonce.value += 1;
}

function clearRegistrationState({ cancelRequests = true } = {}) {
  if (cancelRequests) {
    registrationsRequestToken += 1;
  }
  loadingRegistrations.value = false;
  registrationsConcertId.value = 0;
  registrations.value = [];
  selectedRegistrationId.value = 0;
}

function beginCreateMode({ skipConfirm = false } = {}) {
  if (!skipConfirm && hasDirtyConcertForm.value && !window.confirm(t('admin.confirmDiscardConcertChanges'))) {
    return false;
  }
  selectedConcertId.value = 0;
  resetEditorState();
  clearRegistrationState();
  clearAuditionState();
  return true;
}

async function refreshConcerts() {
  const requestId = ++concertsRequestToken;
  concertsLoading.value = true;
  try {
    const { data } = await api.get('/admin/concerts');
    if (requestId !== concertsRequestToken) {
      return;
    }

    const items = (data.items || []).map(normalizeConcertItem);
    concerts.value = items;

    if (selectedConcertId.value && !items.some((item) => item.id === selectedConcertId.value)) {
      beginCreateMode({ skipConfirm: true });
      return;
    }

    if (selectedConcert.value && !hasDirtyConcertForm.value) {
      syncEditorStateFromConcert(selectedConcert.value, { preserveReleaseMessage: true });
    }
  } catch (err) {
    setError(err, 'admin.concertsLoadFailed');
  } finally {
    if (requestId === concertsRequestToken) {
      concertsLoading.value = false;
    }
  }
}

function upsertConcert(item) {
  const normalized = normalizeConcertItem(item);
  const index = concerts.value.findIndex((entry) => entry.id === normalized.id);
  if (index === -1) {
    concerts.value = [normalized, ...concerts.value];
    return;
  }
  const nextItems = [...concerts.value];
  nextItems[index] = {
    ...nextItems[index],
    ...normalized
  };
  concerts.value = nextItems;
}

function selectConcert(concertId) {
  if (editorBusy.value || selectedConcertId.value === concertId) {
    return;
  }
  if (hasDirtyConcertForm.value && !window.confirm(t('admin.confirmDiscardConcertChanges'))) {
    return;
  }
  selectedConcertId.value = concertId;
  syncEditorStateFromConcert(selectedConcert.value);
  clearRegistrationState();
  clearAuditionState();
  loadRegistrations({ force: true });
  loadAuditions({ force: true });
  loadProgramArrangement();
}

function selectRegistration(registrationId) {
  selectedRegistrationId.value = registrationId;
  syncAuditionResultFormFromRegistration();
}

function syncAuditionResultFormFromRegistration() {
  const reg = selectedRegistration.value;
  if (!reg) {
    auditionResultForm.auditionStatus = 'pending';
    auditionResultForm.auditionFeedback = '';
    return;
  }
  auditionResultForm.auditionStatus = reg.auditionStatus || 'pending';
  auditionResultForm.auditionFeedback = reg.auditionFeedback || '';
}

function handleAttachmentFileChange(file) {
  selectedAttachmentFile.value = file;
  if (file) {
    removeAttachment.value = false;
  }
}

function updateEditorForm(nextForm) {
  Object.assign(editorForm, nextForm);
}

function updateAuditionForm(nextForm) {
  Object.assign(auditionForm, nextForm);
}

function onAuditionFileChange(event) {
  const file = event.target.files?.[0] || null;
  selectedAuditionAttachmentFile.value = file;
  if (file) {
    removeAuditionAttachment.value = false;
  }
}

function toAuditionStorageDateTime(value) {
  if (!value) {
    return '';
  }
  return `${value}:00`;
}

function normalizeAuditionForm(form) {
  form.title = String(form.title || '').trim();
  form.description = String(form.description || '').trim();
  form.announcement = String(form.announcement || '').trim();
}

function snapshotAuditionFormFromItem(item) {
  return {
    title: String(item?.title || '').trim(),
    description: String(item?.description || '').trim(),
    announcement: String(item?.announcement || '').trim(),
    auditionTime: toInputDateTime(item?.auditionTime),
    status: editableConcertStatuses.has(item?.status) ? item.status : 'draft'
  };
}

function validateAuditionForm(form) {
  normalizeAuditionForm(form);
  if (form.title.length < 2) {
    showError(t('admin.publishTitleInvalid'));
    return false;
  }
  return true;
}

function buildAuditionFormData(form, attachmentFile, removeCurrentAttachment = false) {
  const payload = new FormData();
  payload.append('title', form.title || '');
  payload.append('description', form.description || '');
  payload.append('announcement', form.announcement || '');
  payload.append('auditionTime', toAuditionStorageDateTime(form.auditionTime));
  payload.append('status', form.status);
  if (attachmentFile) {
    payload.append('attachmentFile', attachmentFile);
  }
  if (removeCurrentAttachment) {
    payload.append('removeAttachment', 'true');
  }
  return payload;
}

function normalizeAuditionItem(item) {
  return {
    ...item,
    description: item?.description || '',
    announcement: item?.announcement || '',
    attachmentPath: item?.attachmentPath || null,
    status: editableConcertStatuses.has(item?.status) ? item.status : 'draft'
  };
}

function resetAuditionEditorState() {
  const empty = createEmptyAuditionForm();
  Object.assign(auditionForm, empty);
  auditionEditorBaseline.value = { ...empty };
  selectedAuditionId.value = 0;
  selectedAuditionAttachmentFile.value = null;
  removeAuditionAttachment.value = false;
  auditionReleaseMessage.value = '';
  auditionAttachmentInputNonce.value += 1;
}

function syncAuditionEditorStateFromAudition(audition, { preserveReleaseMessage = false } = {}) {
  if (!audition) {
    resetAuditionEditorState();
    return;
  }
  const snapshot = snapshotAuditionFormFromItem(audition);
  Object.assign(auditionForm, snapshot);
  auditionEditorBaseline.value = { ...snapshot };
  selectedAuditionAttachmentFile.value = null;
  removeAuditionAttachment.value = false;
  if (!preserveReleaseMessage) {
    auditionReleaseMessage.value = '';
  }
  auditionAttachmentInputNonce.value += 1;
}

function clearAuditionState({ cancelRequests = true } = {}) {
  if (cancelRequests) {
    auditionsRequestToken += 1;
  }
  loadingAuditions.value = false;
  auditionsConcertId.value = 0;
  auditions.value = [];
  resetAuditionEditorState();
}

function beginCreateAuditionMode() {
  resetAuditionEditorState();
}

function selectAudition(auditionId) {
  if (auditionEditorBusy.value || selectedAuditionId.value === auditionId) {
    return;
  }
  if (hasDirtyAuditionForm.value && !window.confirm(t('admin.confirmDiscardConcertChanges'))) {
    return;
  }
  selectedAuditionId.value = auditionId;
  syncAuditionEditorStateFromAudition(selectedAudition.value);
}

async function loadAuditions({ force = false } = {}) {
  const concertId = selectedConcertId.value;
  if (!concertId) {
    clearAuditionState();
    return;
  }
  if (!force && auditionsConcertId.value === concertId) {
    return;
  }

  const requestId = ++auditionsRequestToken;
  auditions.value = [];
  resetAuditionEditorState();
  loadingAuditions.value = true;

  try {
    const { data } = await api.get(`/admin/concerts/${concertId}/auditions`);
    if (requestId !== auditionsRequestToken || concertId !== selectedConcertId.value) {
      return;
    }

    auditions.value = (data.items || []).map(normalizeAuditionItem);
    auditionsConcertId.value = concertId;
  } catch (err) {
    if (requestId !== auditionsRequestToken) {
      return;
    }
    auditions.value = [];
    auditionsConcertId.value = 0;
    setError(err, 'admin.errorRequest');
  } finally {
    if (requestId === auditionsRequestToken) {
      loadingAuditions.value = false;
    }
  }
}

function upsertAudition(item) {
  const normalized = normalizeAuditionItem(item);
  const index = auditions.value.findIndex((entry) => entry.id === normalized.id);
  if (index === -1) {
    auditions.value = [normalized, ...auditions.value];
    return;
  }
  const nextItems = [...auditions.value];
  nextItems[index] = {
    ...nextItems[index],
    ...normalized
  };
  auditions.value = nextItems;
}

async function submitAuditionForm() {
  if (!validateAuditionForm(auditionForm)) {
    return;
  }
  if (!selectedConcert.value) {
    showError(t('admin.concertRequired'));
    return;
  }

  if (!selectedAudition.value) {
    savingAudition.value = true;
    try {
      const payload = buildAuditionFormData(auditionForm, selectedAuditionAttachmentFile.value, false);
      const { data } = await api.post(`/admin/concerts/${selectedConcert.value.id}/auditions`, payload);
      upsertAudition(data);
      showSuccess(t('admin.auditionCreated', { id: data.id }));
      beginCreateAuditionMode();
    } catch (err) {
      setError(err);
    } finally {
      savingAudition.value = false;
    }
    return;
  }

  savingAudition.value = true;
  try {
    const payload = buildAuditionFormData(
      auditionForm,
      selectedAuditionAttachmentFile.value,
      removeAuditionAttachment.value
    );
    const { data } = await api.patch(
      `/admin/concerts/${selectedConcert.value.id}/auditions/${selectedAudition.value.id}`,
      payload
    );
    upsertAudition(data);
    syncAuditionEditorStateFromAudition(normalizeAuditionItem(data), { preserveReleaseMessage: true });
    showSuccess(t('admin.auditionUpdated'));
  } catch (err) {
    setError(err);
  } finally {
    savingAudition.value = false;
  }
}

async function releaseAudition() {
  if (!selectedAudition.value || auditionEditorBusy.value) {
    return;
  }
  if (hasDirtyAuditionForm.value) {
    showError(t('admin.concertUnsavedBeforeRelease'));
    return;
  }
  if (!window.confirm(t('admin.confirmReleaseAudition'))) {
    return;
  }
  releasingAudition.value = true;
  try {
    const { data } = await api.post(
      `/admin/concerts/${selectedConcert.value.id}/auditions/${selectedAudition.value.id}/release`,
      {
        message: auditionReleaseMessage.value || undefined
      }
    );
    upsertAudition({ ...selectedAudition.value, status: 'open' });
    syncAuditionEditorStateFromAudition({ ...selectedAudition.value, status: 'open' }, { preserveReleaseMessage: true });
    showSuccess(t('admin.auditionReleased', { count: data.notification?.sent || 0 }));
  } catch (err) {
    setError(err);
  } finally {
    releasingAudition.value = false;
  }
}

async function deleteAudition() {
  if (!selectedAudition.value || auditionEditorBusy.value) {
    return;
  }
  if (!window.confirm(t('admin.confirmDeleteConcert'))) {
    return;
  }
  deletingAudition.value = true;
  try {
    const concertId = selectedConcert.value.id;
    const auditionId = selectedAudition.value.id;
    await api.delete(`/admin/concerts/${concertId}/auditions/${auditionId}`);
    auditions.value = auditions.value.filter((item) => item.id !== auditionId);
    showSuccess(t('admin.auditionDeleted'));
    beginCreateAuditionMode();
  } catch (err) {
    setError(err);
  } finally {
    deletingAudition.value = false;
  }
}

async function saveAuditionResult() {
  if (!selectedConcert.value || !selectedRegistration.value) {
    return;
  }
  savingAuditionResult.value = true;
  try {
    const { data } = await api.patch(
      `/admin/concerts/${selectedConcert.value.id}/applications/${selectedRegistration.value.id}/audition`,
      {
        auditionStatus: auditionResultForm.auditionStatus,
        auditionFeedback: auditionResultForm.auditionFeedback || undefined
      }
    );
    const index = registrations.value.findIndex((r) => r.id === data.id);
    if (index !== -1) {
      registrations.value[index] = data;
    }
    showSuccess(t('admin.auditionResultSaved'));
  } catch (err) {
    setError(err);
  } finally {
    savingAuditionResult.value = false;
  }
}

async function loadRegistrations({ force = false, preserveExisting = false } = {}) {
  const concertId = selectedConcertId.value;
  if (!concertId) {
    clearRegistrationState();
    return;
  }
  if (!force && registrationsConcertId.value === concertId) {
    return;
  }

  const requestId = ++registrationsRequestToken;
  if (!preserveExisting || registrationsConcertId.value !== concertId) {
    registrations.value = [];
    selectedRegistrationId.value = 0;
  }
  loadingRegistrations.value = true;

  try {
    const { data } = await api.get(`/admin/concerts/${concertId}/applications`);
    if (requestId !== registrationsRequestToken || concertId !== selectedConcertId.value) {
      return;
    }

    registrations.value = data.items || [];
    registrationsConcertId.value = concertId;
    if (!registrations.value.length) {
      selectedRegistrationId.value = 0;
      return;
    }
    if (!registrations.value.some((item) => item.id === selectedRegistrationId.value)) {
      selectedRegistrationId.value = registrations.value[0].id;
    }
    syncAuditionResultFormFromRegistration();
  } catch (err) {
    if (requestId !== registrationsRequestToken) {
      return;
    }
    registrations.value = [];
    selectedRegistrationId.value = 0;
    registrationsConcertId.value = 0;
    setError(err, 'admin.registrationLoadFailed');
  } finally {
    if (requestId === registrationsRequestToken) {
      loadingRegistrations.value = false;
    }
  }
}

async function submitConcertForm() {
  if (!validateConcertForm(editorForm)) {
    return;
  }

  if (!selectedConcert.value) {
    if (!window.confirm(t('admin.confirmCreateConcert'))) {
      return;
    }
    savingConcert.value = true;
    try {
      const payload = buildConcertFormData(editorForm, selectedAttachmentFile.value, false);
      const { data } = await api.post('/admin/concerts', payload);
      upsertConcert(data);
      showSuccess(t('admin.concertCreated', { id: data.id }));
      beginCreateMode({ skipConfirm: true });
    } catch (err) {
      setError(err);
    } finally {
      savingConcert.value = false;
    }
    return;
  }

  if (!window.confirm(t('admin.confirmUpdateConcert'))) {
    return;
  }
  savingConcert.value = true;
  try {
    const payload = buildConcertFormData(editorForm, selectedAttachmentFile.value, removeAttachment.value);
    const { data } = await api.patch(`/admin/concerts/${selectedConcert.value.id}`, payload);
    upsertConcert(data);
    syncEditorStateFromConcert(normalizeConcertItem(data), { preserveReleaseMessage: true });
    showSuccess(t('admin.concertUpdated'));
  } catch (err) {
    setError(err);
  } finally {
    savingConcert.value = false;
  }
}

async function releaseConcert() {
  if (!selectedConcert.value || editorBusy.value) {
    return;
  }
  if (hasDirtyConcertForm.value) {
    showError(t('admin.concertUnsavedBeforeRelease'));
    return;
  }
  if (!window.confirm(t('admin.confirmReleaseConcert'))) {
    return;
  }
  releasingConcert.value = true;
  try {
    const { data } = await api.post(`/admin/concerts/${selectedConcert.value.id}/release`, {
      message: releaseMessage.value || undefined
    });
    upsertConcert({ ...selectedConcert.value, status: 'open' });
    syncEditorStateFromConcert({ ...selectedConcert.value, status: 'open' }, { preserveReleaseMessage: true });
    showSuccess(t('admin.concertReleased', { count: data.notification?.sent || 0 }));
  } catch (err) {
    setError(err);
  } finally {
    releasingConcert.value = false;
  }
}

async function deleteConcert() {
  if (!selectedConcert.value || editorBusy.value) {
    return;
  }
  if (!window.confirm(t('admin.confirmDeleteConcert'))) {
    return;
  }
  deletingConcert.value = true;
  try {
    const concertId = selectedConcert.value.id;
    await api.delete(`/admin/concerts/${concertId}`);
    concerts.value = concerts.value.filter((item) => item.id !== concertId);
    showSuccess(t('admin.concertDeleted'));
    beginCreateMode({ skipConfirm: true });
  } catch (err) {
    setError(err);
  } finally {
    deletingConcert.value = false;
  }
}

async function downloadRegistrationsCsv() {
  if (!selectedConcertId.value || downloadingRegistrationsCsv.value) {
    return;
  }
  downloadingRegistrationsCsv.value = true;
  try {
    const response = await api.get(`/admin/concerts/${selectedConcertId.value}/applications/export`, {
      responseType: 'blob'
    });
    const fileNameMatch = String(response.headers['content-disposition'] || '').match(/filename="?([^"]+)"?/i);
    const fileName = fileNameMatch?.[1] || `linquan_concert_applications_${selectedConcertId.value}.csv`;
    const blobUrl = window.URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
    showSuccess(t('admin.registrationCsvExported'));
  } catch (err) {
    setError(err, 'admin.registrationCsvExportFailed');
  } finally {
    downloadingRegistrationsCsv.value = false;
  }
}

function generateSegmentName(count, index) {
  if (count === 2) {
    return index === 0 ? '上半场' : '下半场';
  }
  if (count === 3) {
    return ['上场', '中场', '下场'][index] || `第${index + 1}场`;
  }
  return `第${index + 1}场`;
}

function generateSegmentNameEn(count, index) {
  if (count === 2) {
    return index === 0 ? 'First Half' : 'Second Half';
  }
  if (count === 3) {
    return ['First Half', 'Intermission', 'Second Half'][index] || `Part ${index + 1}`;
  }
  return `Part ${index + 1}`;
}

function resolveDefaultSegmentName(count, index) {
  return locale.value === 'en' ? generateSegmentNameEn(count, index) : generateSegmentName(count, index);
}

function recalcSegmentNames() {
  const count = programArrangement.segments.length;
  programArrangement.segments.forEach((seg, index) => {
    if (!segmentNameManuallyEdited.value.has(seg.id)) {
      seg.name = resolveDefaultSegmentName(count, index);
    }
  });
}

function markSegmentNameEdited(segmentId) {
  segmentNameManuallyEdited.value.add(segmentId);
}

function resetProgramArrangement() {
  programArrangement.segments = [];
  programArrangement.availablePrograms = [];
  programArrangement.stats = { totalProgramCount: 0, totalProgramDurationMin: 0, totalActualDurationMin: 0 };
  segmentNameManuallyEdited.value.clear();
  Object.keys(programSegmentSelections).forEach((key) => delete programSegmentSelections[key]);
}

async function loadProgramArrangement() {
  if (!selectedConcertId.value) {
    resetProgramArrangement();
    return;
  }
  const concertId = selectedConcertId.value;
  const requestId = ++programArrangementRequestToken;
  loadingProgramArrangement.value = true;
  try {
    const { data } = await api.get(`/admin/concerts/${concertId}/program-arrangement`);
    if (requestId !== programArrangementRequestToken || concertId !== selectedConcertId.value) {
      return;
    }
    programArrangement.segments = (data.segments || []).map((seg) => ({
      ...seg,
      items: (seg.items || []).map((item) => ({
        ...item,
        _localId: `local-item-${Date.now()}-${++programArrangementLocalId}`,
        _originalProgram: {
          id: item.applicationId,
          applicantName: item.applicantName,
          pieceZh: item.pieceZh,
          pieceEn: item.pieceEn,
          durationMin: item.durationMin
        }
      }))
    }));
    programArrangement.availablePrograms = data.availablePrograms || [];
    programArrangement.stats = data.stats || { totalProgramCount: 0, totalProgramDurationMin: 0, totalActualDurationMin: 0 };
    // Initialize default segment selection for each available program to the last segment
    const lastSegmentId = programArrangement.segments.length > 0
      ? programArrangement.segments[programArrangement.segments.length - 1].id
      : null;
    programArrangement.availablePrograms.forEach((program) => {
      if (!(program.id in programSegmentSelections)) {
        programSegmentSelections[program.id] = lastSegmentId;
      }
    });
    segmentNameManuallyEdited.value.clear();
    programArrangement.segments.forEach((seg) => {
      if (seg.name && seg.name !== resolveDefaultSegmentName(programArrangement.segments.length, seg.displayOrder || 0)) {
        segmentNameManuallyEdited.value.add(seg.id);
      }
    });
  } catch (err) {
    if (requestId !== programArrangementRequestToken) {
      return;
    }
    resetProgramArrangement();
    setError(err, 'admin.programArrangementLoadFailed');
  } finally {
    if (requestId === programArrangementRequestToken) {
      loadingProgramArrangement.value = false;
    }
  }
}

function addSegment() {
  const newId = -(Date.now() + (++programArrangementLocalId));
  const displayOrder = programArrangement.segments.length;
  const newSegment = {
    id: newId,
    name: resolveDefaultSegmentName(displayOrder + 1, displayOrder),
    displayOrder,
    restAfterMin: 0,
    items: []
  };
  programArrangement.segments.push(newSegment);
  recalcSegmentNames();
}

function removeSegment(segmentId) {
  const index = programArrangement.segments.findIndex((s) => s.id === segmentId);
  if (index === -1) {
    return;
  }
  const segment = programArrangement.segments[index];
  const removedItems = segment.items || [];
  programArrangement.segments.splice(index, 1);
  removedItems.forEach((item) => {
    const program = item._originalProgram;
    if (program) {
      programArrangement.availablePrograms.push(program);
    }
  });
  programArrangement.segments.forEach((seg, idx) => {
    seg.displayOrder = idx;
  });
  recalcSegmentNames();
}

function ensureAtLeastOneSegment() {
  if (programArrangement.segments.length === 0) {
    addSegment();
  }
}

function addProgramToSegment(applicationId, segmentId) {
  ensureAtLeastOneSegment();
  const programIndex = programArrangement.availablePrograms.findIndex((p) => p.id === applicationId);
  if (programIndex === -1) {
    return;
  }
  let targetSegment = programArrangement.segments.find((s) => s.id === segmentId);
  if (!targetSegment) {
    targetSegment = programArrangement.segments[programArrangement.segments.length - 1];
  }
  const program = programArrangement.availablePrograms[programIndex];
  programArrangement.availablePrograms.splice(programIndex, 1);
  const newItem = {
    _localId: `local-item-${Date.now()}-${++programArrangementLocalId}`,
    id: null,
    segmentId: targetSegment.id,
    applicationId: program.id,
    displayOrder: targetSegment.items.length,
    intervalBeforeMin: 0,
    applicantName: program.applicantName,
    pieceZh: program.pieceZh,
    pieceEn: program.pieceEn,
    durationMin: program.durationMin,
    _originalProgram: program
  };
  targetSegment.items.push(newItem);
}

function removeProgramItem(localId) {
  for (const segment of programArrangement.segments) {
    const index = segment.items.findIndex((item) => (item.id || item._localId) === localId);
    if (index !== -1) {
      const item = segment.items[index];
      const program = item._originalProgram;
      if (program) {
        programArrangement.availablePrograms.push(program);
      }
      segment.items.splice(index, 1);
      segment.items.forEach((it, idx) => {
        it.displayOrder = idx;
      });
      break;
    }
  }
}

function moveItem(localId, direction) {
  for (const segment of programArrangement.segments) {
    const index = segment.items.findIndex((item) => (item.id || item._localId) === localId);
    if (index === -1) {
      continue;
    }
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= segment.items.length) {
      return;
    }
    const temp = segment.items[index];
    segment.items[index] = segment.items[newIndex];
    segment.items[newIndex] = temp;
    segment.items.forEach((it, idx) => {
      it.displayOrder = idx;
    });
    break;
  }
}

function buildProgramArrangementPayload() {
  const payloadSegments = programArrangement.segments.map((seg, index) => ({
    id: seg.id,
    name: seg.name,
    displayOrder: index,
    restAfterMin: Number(seg.restAfterMin) || 0
  }));

  const payloadItems = [];
  for (const segment of programArrangement.segments) {
    for (const item of segment.items) {
      const isLocalItem = !item.id || Number(item.id) < 0;
      payloadItems.push({
        id: isLocalItem ? undefined : item.id,
        segmentId: segment.id,
        applicationId: item.applicationId,
        displayOrder: item.displayOrder,
        intervalBeforeMin: Number(item.intervalBeforeMin) || 0
      });
    }
  }

  return { segments: payloadSegments, items: payloadItems };
}

async function saveProgramArrangement() {
  if (!selectedConcertId.value) {
    return;
  }
  savingProgramArrangement.value = true;
  try {
    const payload = buildProgramArrangementPayload();
    await api.put(`/admin/concerts/${selectedConcertId.value}/program-arrangement`, payload);
    showSuccess(t('admin.programArrangementSaved'));
    await loadProgramArrangement();
  } catch (err) {
    setError(err, 'admin.programArrangementSaveFailed');
  } finally {
    savingProgramArrangement.value = false;
  }
}

onMounted(async () => {
  await refreshConcerts();
});
</script>

<style scoped>
.panel {
  padding: 1rem;
}

.section-space {
  margin-top: 1rem;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 0.8rem;
}

.concert-list,
.registration-list {
  list-style: none;
  margin: 0.7rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-height: 26rem;
  overflow: auto;
}

.concert-list li,
.registration-item {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel-soft);
  padding: 0.65rem 0.75rem;
  cursor: pointer;
  color: var(--ink);
  text-align: left;
}

.concert-list li:hover,
.registration-item:hover {
  background: #242a31;
}

.concert-list li.active,
.registration-item.active {
  border-color: var(--accent);
  background: #262d35;
}

.concert-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.concert-list h3,
.registration-item h3 {
  margin: 0;
}

.concert-list p,
.registration-item p {
  margin: 0.35rem 0 0;
}

.multiline-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.04);
  color: var(--muted);
  font-size: 0.82rem;
  flex-shrink: 0;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

.label {
  display: block;
  font-size: 0.85rem;
  color: var(--muted);
  margin-bottom: 0.15rem;
}

.action-row {
  justify-content: flex-end;
  flex-wrap: wrap;
}

.inline-loading {
  margin-top: 0.35rem;
}

.inline-check {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: 0.6rem;
  cursor: pointer;
  font-size: 0.85rem;
}

.registration-detail .field {
  margin-bottom: 0.75rem;
}

.audition-result {
  border-top: 1px solid var(--line);
  padding-top: 0.75rem;
  margin-top: 0.75rem;
}

.arrangement-grid {
  margin-top: 0.75rem;
}

.program-pool {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 0.6rem;
}

.program-card {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0.65rem;
  background: var(--panel-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.program-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.program-info strong {
  font-weight: 600;
}

.segments-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  margin-top: 0.6rem;
}

.segment-box {
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 0.75rem;
  background: var(--panel-soft);
}

.segment-header {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  margin-bottom: 0.6rem;
  flex-wrap: wrap;
}

.segment-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.segment-select {
  min-width: 120px;
  padding: 0.35rem 0.5rem;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--panel-soft);
  color: var(--ink);
  font-size: 0.9rem;
}

.arrangement-stats {
  margin-top: 0.85rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--line);
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  font-size: 0.95rem;
}

@media (max-width: 860px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .section-head,
  .concert-item-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .action-row {
    justify-content: flex-start;
  }
}
</style>
