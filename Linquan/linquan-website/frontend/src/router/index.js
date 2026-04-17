import { createRouter, createWebHistory } from 'vue-router';
import DashboardView from '@/views/DashboardView.vue';
import LoginView from '@/views/LoginView.vue';
import RegisterView from '@/views/RegisterView.vue';
import ScheduleView from '@/views/ScheduleView.vue';
import ClassMatchingView from '@/views/ClassMatchingView.vue';
import ConcertsView from '@/views/ConcertsView.vue';
import ProfileView from '@/views/ProfileView.vue';
import MemberDirectoryView from '@/views/MemberDirectoryView.vue';
import MemberDetailView from '@/views/MemberDetailView.vue';
import AdminLayoutView from '@/views/AdminLayoutView.vue';
import AdminPublishingView from '@/views/AdminPublishingView.vue';
import AdminSchedulingView from '@/views/AdminSchedulingView.vue';
import AdminClassMatchingView from '@/views/AdminClassMatchingView.vue';
import AdminConcertsView from '@/views/AdminConcertsView.vue';
import AdminGalleryView from '@/views/AdminGalleryView.vue';
import AdminMembersView from '@/views/AdminMembersView.vue';
import ImslpView from '@/views/ImslpView.vue';
import ImslpWorkDetailView from '@/views/ImslpWorkDetailView.vue';
import ImslpPersonDetailView from '@/views/ImslpPersonDetailView.vue';

const routes = [
  {
    path: '/',
    name: 'dashboard',
    component: DashboardView
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterView
  },
  {
    path: '/schedule',
    name: 'schedule',
    component: ScheduleView,
    meta: { requiresAuth: true }
  },
  {
    path: '/class-matching',
    name: 'classMatching',
    component: ClassMatchingView,
    meta: { requiresAuth: true }
  },
  {
    path: '/concerts',
    name: 'concerts',
    component: ConcertsView
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfileView,
    meta: { requiresAuth: true }
  },
  {
    path: '/members',
    name: 'members',
    component: MemberDirectoryView,
    meta: { requiresAuth: true }
  },
  {
    path: '/members/:memberId',
    name: 'memberDetail',
    component: MemberDetailView,
    meta: { requiresAuth: true }
  },
  {
    path: '/imslp',
    name: 'imslp',
    component: ImslpView
  },
  {
    path: '/imslp/works/:permlink',
    name: 'imslpWorkDetail',
    component: ImslpWorkDetailView
  },
  {
    path: '/imslp/people/:permlink',
    name: 'imslpPersonDetail',
    component: ImslpPersonDetailView
  },
  {
    path: '/admin',
    name: 'admin',
    component: AdminLayoutView,
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      {
        path: '',
        redirect: { name: 'adminPublishing' }
      },
      {
        path: 'publishing',
        name: 'adminPublishing',
        component: AdminPublishingView
      },
      {
        path: 'scheduling',
        name: 'adminScheduling',
        component: AdminSchedulingView
      },
      {
        path: 'class-matching',
        name: 'adminClassMatching',
        component: AdminClassMatchingView
      },
      {
        path: 'concerts',
        name: 'adminConcerts',
        component: AdminConcertsView
      },
      {
        path: 'gallery',
        name: 'adminGallery',
        component: AdminGalleryView
      },
      {
        path: 'members',
        name: 'adminMembers',
        component: AdminMembersView
      }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
});

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('linquan_token');
  let role = null;
  try {
    role = JSON.parse(localStorage.getItem('linquan_user') || '{}')?.role;
  } catch (err) {
    role = null;
  }

  if (to.meta.requiresAuth && !token) {
    return next({ name: 'login', query: { redirect: to.fullPath } });
  }
  if (to.meta.requiresAdmin && role !== 'admin') {
    return next({ name: 'dashboard' });
  }
  return next();
});

export default router;
