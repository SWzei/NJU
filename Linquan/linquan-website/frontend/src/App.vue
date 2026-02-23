<template>
  <div>
    <header class="topbar">
      <div class="topbar-inner">
        <router-link class="brand" to="/">
          <img class="brand-mark" src="/photos/club/林泉社徽.jpg" :alt="t('app.clubName')" />
          <div>
            <h1>{{ t('app.clubName') }}</h1>
            <p>{{ t('app.subtitle') }}</p>
          </div>
        </router-link>

        <nav class="nav">
          <router-link to="/">{{ t('app.navHome') }}</router-link>
          <router-link v-if="auth.isAuthenticated" to="/schedule">{{ t('app.navSchedule') }}</router-link>
          <router-link v-if="auth.isAuthenticated" to="/concerts">{{ t('app.navConcerts') }}</router-link>
          <router-link v-if="auth.isAuthenticated" to="/members">{{ t('app.navMembers') }}</router-link>
          <router-link v-if="auth.isAuthenticated" to="/profile">{{ t('app.navProfile') }}</router-link>
          <router-link v-if="auth.isAdmin" to="/admin">{{ t('app.navAdmin') }}</router-link>
          <router-link v-if="!auth.isAuthenticated" to="/login">{{ t('app.navLogin') }}</router-link>
          <router-link v-if="!auth.isAuthenticated" to="/register">{{ t('app.navRegister') }}</router-link>
          <button v-if="auth.isAuthenticated" class="btn secondary" @click="logout">
            {{ t('app.navLogout') }}
          </button>
          <div class="lang-switch">
            <button class="lang-btn" :class="{ active: locale === 'zh' }" @click="setLocale('zh')">
              {{ t('app.langZh') }}
            </button>
            <button class="lang-btn" :class="{ active: locale === 'en' }" @click="setLocale('en')">
              {{ t('app.langEn') }}
            </button>
          </div>
        </nav>
      </div>
    </header>

    <main class="page">
      <router-view />
    </main>
    <CenterToast />
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useI18n } from '@/i18n';
import CenterToast from '@/components/CenterToast.vue';

const router = useRouter();
const auth = useAuthStore();
const { t, locale, setLocale } = useI18n();

function logout() {
  if (!window.confirm(t('app.confirmLogout'))) {
    return;
  }
  auth.logout();
  router.push('/login');
}
</script>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 5;
  backdrop-filter: blur(8px);
  background: rgba(14, 17, 24, 0.9);
  border-bottom: 1px solid var(--line);
}

.topbar-inner {
  width: min(1200px, calc(100% - 1.6rem));
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.8rem 0;
  gap: 1rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.brand h1 {
  margin: 0;
  font-size: 1.06rem;
  letter-spacing: 0.02em;
}

.brand p {
  margin: 0.1rem 0 0;
  color: var(--muted);
  font-size: 0.8rem;
}

.brand-mark {
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 10px;
  object-fit: cover;
  border: 1px solid var(--line);
  background: #0f1114;
}

.nav {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.lang-switch {
  display: inline-flex;
  border: 1px solid var(--line);
  border-radius: 9px;
  overflow: hidden;
  margin-left: 0.25rem;
}

.lang-btn {
  border: 0;
  background: #13161b;
  padding: 0.24rem 0.48rem;
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--muted);
  cursor: pointer;
}

.lang-btn.active {
  background: #1f2328;
  color: var(--ink);
}

.nav a,
.nav .btn {
  padding: 0.68rem 1.02rem;
  border-radius: 10px;
  color: var(--ink);
  font-weight: 700;
  font-size: 1.1rem;
  line-height: 1;
}

.nav a.router-link-active {
  background: #1b1f24;
}

.nav .btn.secondary {
  background: #1b1f24;
}

@media (max-width: 920px) {
  .topbar-inner {
    flex-direction: column;
    align-items: stretch;
  }
  .nav {
    justify-content: flex-start;
  }
}
</style>
