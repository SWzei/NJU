import { defineStore } from 'pinia';
import api from '@/services/api';

function readStoredUser() {
  const raw = localStorage.getItem('linquan_user');
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('linquan_token') || '',
    user: readStoredUser()
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.token),
    isAdmin: (state) => state.user?.role === 'admin'
  },
  actions: {
    setAuth({ token, user }) {
      this.token = token;
      this.user = user;
      localStorage.setItem('linquan_token', token);
      localStorage.setItem('linquan_user', JSON.stringify(user));
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('linquan_token');
      localStorage.removeItem('linquan_user');
    },
    async login({ credential, password }) {
      const { data } = await api.post('/auth/login', { credential, password });
      this.setAuth(data);
      return data;
    },
    async register({ studentNumber, email, password, displayName }) {
      const { data } = await api.post('/auth/register', {
        studentNumber,
        email,
        password,
        displayName
      });
      this.setAuth(data);
      return data;
    }
  }
});
