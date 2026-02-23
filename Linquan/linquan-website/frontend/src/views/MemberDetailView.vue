<template>
  <section class="card panel">
    <router-link class="back" to="/members">{{ t('profile.backToDirectory') }}</router-link>
    <h2 class="section-title">{{ t('profile.memberDetailTitle') }}</h2>

    <div v-if="member" class="detail-wrap">
      <img :src="member.avatarUrl || fallbackAvatar" alt="" class="avatar" />
      <div>
        <h3>{{ member.displayName || member.studentNumber }}</h3>
        <p class="subtle">{{ t('common.student') }}: {{ member.studentNumber }}</p>
        <p class="subtle">
          {{ member.academy || t('profile.academyUnset') }} · {{ member.major || t('profile.majorUnset') }} ·
          {{ member.grade || t('profile.gradeUnset') }}
        </p>
        <p class="subtle">{{ t('profile.phone') }}: {{ member.phone || '-' }}</p>
        <p class="subtle">{{ t('profile.wechatAccount') }}: {{ member.wechatAccount || '-' }}</p>
        <p>{{ member.bio || t('profile.noIntro') }}</p>
        <p><strong>{{ t('profile.hobbies') }}:</strong> {{ member.hobbies || t('profile.notProvided') }}</p>
        <p><strong>{{ t('profile.pianoInterests') }}:</strong> {{ member.pianoInterests || t('profile.notProvided') }}</p>
      </div>
      <div v-if="member.photoUrl" class="photo-block">
        <p class="subtle">{{ t('profile.personalPhoto') }}</p>
        <img :src="member.photoUrl" alt="" class="personal-photo" />
      </div>
    </div>

    <p v-if="!member && !error" class="subtle">{{ t('common.loading') }}</p>
    <p v-if="error" class="subtle">{{ error }}</p>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import api from '@/services/api';
import { useI18n } from '@/i18n';
import { useToast } from '@/composables/toast';

const fallbackAvatar =
  'https://images.unsplash.com/photo-1511367461989-f85a21fda167?auto=format&fit=crop&w=160&q=60';

const route = useRoute();
const { t } = useI18n();
const { showError } = useToast();
const member = ref(null);
const error = ref('');

onMounted(async () => {
  try {
    const memberId = Number(route.params.memberId);
    if (!Number.isInteger(memberId) || memberId <= 0) {
      error.value = t('profile.memberNotFound');
      showError(error.value);
      return;
    }
    const { data } = await api.get(`/profiles/${memberId}`);
    member.value = data;
  } catch (err) {
    error.value = err?.response?.data?.message || t('profile.memberNotFound');
    showError(error.value);
  }
});
</script>

<style scoped>
.panel {
  padding: 1rem;
}

.back {
  display: inline-flex;
  margin-bottom: 0.7rem;
  color: var(--accent);
  font-weight: 700;
}

.detail-wrap {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 0.9rem;
}

.avatar {
  width: 96px;
  height: 96px;
  border-radius: 12px;
  object-fit: cover;
  border: 1px solid var(--line);
}

.detail-wrap h3 {
  margin: 0;
}

.detail-wrap p {
  margin: 0.4rem 0 0;
}

.photo-block {
  grid-column: 1 / -1;
}

.personal-photo {
  max-width: 280px;
  border-radius: 12px;
  border: 1px solid var(--line);
}
</style>
