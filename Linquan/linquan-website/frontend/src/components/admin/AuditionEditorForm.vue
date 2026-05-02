<template>
  <article class="card panel">
    <div class="section-head">
      <div>
        <h2 class="section-title">{{ titleText }}</h2>
        <p class="subtle">{{ modeHint }}</p>
      </div>
      <button
        v-if="isEditMode"
        class="btn secondary"
        type="button"
        :disabled="disabled"
        @click="emit('reset-mode')"
      >
        {{ t('admin.createNewConcertMode') }}
      </button>
    </div>

    <form class="form" @submit.prevent="emit('submit')">
      <div class="field">
        <label>{{ t('common.title') }}</label>
        <input v-model.trim="titleModel" :disabled="disabled" required />
      </div>

      <div class="field">
        <label>{{ t('admin.description') }}</label>
        <textarea v-model="descriptionModel" :disabled="disabled" rows="3" />
      </div>

      <div class="field">
        <label>{{ t('admin.announcement') }}</label>
        <textarea v-model="announcementModel" :disabled="disabled" rows="3" />
      </div>

      <div class="field">
        <label>{{ t('admin.auditionTime') }}</label>
        <input type="datetime-local" v-model="auditionTimeModel" :disabled="disabled" />
      </div>

      <div class="field">
        <label>{{ t('admin.auditionStatus') }}</label>
        <select v-model="statusModel" :disabled="disabled">
          <option value="draft">{{ t('concertStatus.draft') }}</option>
          <option value="open">{{ t('concertStatus.open') }}</option>
          <option value="closed">{{ t('concertStatus.closed') }}</option>
        </select>
      </div>

      <div class="field">
        <label>{{ t('admin.attachmentFile') }}</label>
        <input :key="fileInputKey" type="file" :accept="accept" :disabled="disabled" @change="handleFileChange" />
        <p v-if="selectedAttachmentName" class="subtle">
          {{ t('admin.selectedFileName', { name: selectedAttachmentName }) }}
        </p>
      </div>

      <div v-if="isEditMode" class="field">
        <label>{{ t('admin.currentAttachment') }}</label>
        <p v-if="currentAttachmentPath" class="subtle current-attachment">
          <a :href="currentAttachmentPath" target="_blank" rel="noopener">{{ t('admin.currentAttachment') }}</a>
        </p>
        <p v-else class="subtle">{{ t('admin.noAttachments') }}</p>

        <label v-if="currentAttachmentPath" class="toggle">
          <input
            type="checkbox"
            :checked="removeAttachment"
            :disabled="disabled || Boolean(selectedAttachmentName)"
            @change="emit('update:removeAttachment', $event.target.checked)"
          />
          {{ t('admin.removeAttachment') }}
        </label>
        <p v-if="currentAttachmentPath && selectedAttachmentName" class="subtle">
          {{ t('admin.attachmentWillBeReplaced') }}
        </p>
      </div>

      <div v-if="isEditMode" class="field">
        <label>{{ t('admin.auditionReleaseMessage') }}</label>
        <textarea
          :value="releaseMessage"
          :disabled="disabled || deleting"
          rows="2"
          @input="emit('update:releaseMessage', $event.target.value)"
        />
      </div>

      <div class="row action-row">
        <button class="btn" type="submit" :disabled="disabled || submitting || releasing || deleting || !titleModel.trim()">
          {{ primaryActionLabel }}
        </button>
        <button
          v-if="isEditMode"
          class="btn secondary"
          type="button"
          :disabled="disabled || submitting || releasing || deleting"
          @click="emit('release')"
        >
          {{ releasing ? t('common.loading') : t('admin.releaseAudition') }}
        </button>
        <button
          v-if="isEditMode"
          class="btn warn"
          type="button"
          :disabled="disabled || submitting || releasing || deleting"
          @click="emit('delete')"
        >
          {{ deleting ? t('common.loading') : t('admin.deleteAudition') }}
        </button>
      </div>
    </form>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/i18n';

const props = defineProps({
  mode: {
    type: String,
    default: 'create'
  },
  form: {
    type: Object,
    required: true
  },
  activeTitle: {
    type: String,
    default: ''
  },
  currentAttachmentPath: {
    type: String,
    default: ''
  },
  selectedAttachmentName: {
    type: String,
    default: ''
  },
  removeAttachment: {
    type: Boolean,
    default: false
  },
  releaseMessage: {
    type: String,
    default: ''
  },
  submitting: {
    type: Boolean,
    default: false
  },
  releasing: {
    type: Boolean,
    default: false
  },
  deleting: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  fileInputNonce: {
    type: Number,
    default: 0
  },
  accept: {
    type: String,
    default: ''
  }
});

const emit = defineEmits([
  'submit',
  'release',
  'delete',
  'reset-mode',
  'file-change',
  'update:form',
  'update:removeAttachment',
  'update:releaseMessage'
]);

const { t } = useI18n();

const isEditMode = computed(() => props.mode === 'edit');
const titleText = computed(() => {
  if (!isEditMode.value) {
    return t('admin.auditionTitle');
  }
  return props.activeTitle
    ? `${t('admin.auditionTitle')} - ${props.activeTitle}`
    : t('admin.auditionTitle');
});
const modeHint = computed(() => (
  isEditMode.value ? t('admin.editConcertHint') : t('admin.auditionSubtitle')
));
const primaryActionLabel = computed(() => {
  if (props.submitting) {
    return t('common.loading');
  }
  return isEditMode.value ? t('admin.saveAudition') : t('admin.saveAudition');
});
const fileInputKey = computed(() => `audition-file-${props.fileInputNonce}`);
const titleModel = computed({
  get: () => props.form.title || '',
  set: (value) => updateForm({ title: value })
});
const descriptionModel = computed({
  get: () => props.form.description || '',
  set: (value) => updateForm({ description: value })
});
const announcementModel = computed({
  get: () => props.form.announcement || '',
  set: (value) => updateForm({ announcement: value })
});
const auditionTimeModel = computed({
  get: () => props.form.auditionTime || '',
  set: (value) => updateForm({ auditionTime: value })
});
const statusModel = computed({
  get: () => props.form.status || 'draft',
  set: (value) => updateForm({ status: value })
});

function updateForm(patch) {
  emit('update:form', {
    ...props.form,
    ...patch
  });
}

function handleFileChange(event) {
  emit('file-change', event.target.files?.[0] || null);
}
</script>

<style scoped>
.panel {
  padding: 1rem;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 0.8rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.field-half {
  flex: 1;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.9rem;
  color: var(--muted);
}

.action-row {
  flex-wrap: wrap;
}

.current-attachment a {
  color: var(--accent);
  text-decoration: underline;
}

@media (max-width: 860px) {
  .section-head {
    flex-direction: column;
  }
}
</style>
