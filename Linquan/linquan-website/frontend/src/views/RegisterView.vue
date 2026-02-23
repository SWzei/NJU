<template>
  <section class="card auth-wrap">
    <h2 class="section-title">{{ t('register.title') }}</h2>
    <p class="subtle">{{ t('register.subtitle') }}</p>

    <form class="form" @submit.prevent="handleRegister">
      <div class="field">
        <label>{{ t('register.studentNumber') }}</label>
        <input v-model.trim="studentNumber" required :placeholder="t('register.studentNumberPlaceholder')" />
      </div>
      <div class="field">
        <label>{{ t('register.emailOptional') }}</label>
        <input v-model.trim="email" type="email" :placeholder="t('register.emailPlaceholder')" />
      </div>
      <div class="field">
        <label>{{ t('register.displayName') }}</label>
        <input v-model.trim="displayName" :placeholder="t('register.displayNamePlaceholder')" />
      </div>
      <div class="field">
        <label>{{ t('register.password') }}</label>
        <div class="password-wrap">
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            required
            minlength="6"
            :placeholder="t('register.passwordPlaceholder')"
          />
          <button class="toggle-btn" type="button" @click="showPassword = !showPassword">
            {{ showPassword ? t('common.hide') : t('common.show') }}
          </button>
        </div>
      </div>
      <button class="btn" :disabled="loading">{{ loading ? t('register.creating') : t('register.register') }}</button>
      <p class="subtle">
        {{ t('register.hasAccount') }}
        <router-link to="/login" class="link">{{ t('register.login') }}</router-link>
      </p>
    </form>
  </section>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useI18n } from '@/i18n';
import { useToast } from '@/composables/toast';

const studentNumber = ref('');
const email = ref('');
const displayName = ref('');
const password = ref('');
const showPassword = ref(false);
const loading = ref(false);

const auth = useAuthStore();
const router = useRouter();
const { t } = useI18n();
const { showError } = useToast();

async function handleRegister() {
  loading.value = true;
  try {
    await auth.register({
      studentNumber: studentNumber.value,
      email: email.value,
      password: password.value,
      displayName: displayName.value
    });
    router.push('/');
  } catch (err) {
    showError(err, t('register.failed'));
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.auth-wrap {
  width: min(500px, 100%);
  margin: 0 auto;
  padding: 1.2rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.link {
  color: var(--accent);
  font-weight: 700;
}

.password-wrap {
  display: flex;
  gap: 0.45rem;
}

.password-wrap input {
  flex: 1;
}

.toggle-btn {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel-soft);
  color: var(--ink);
  padding: 0.55rem 0.7rem;
  cursor: pointer;
  font-weight: 700;
}
</style>
