import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes = [
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true, title: 'Sign in' } },
  { path: '/', name: 'basecamp', component: () => import('@/views/BasecampView.vue'), meta: { title: 'Basecamp' } }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.init();
  if (!to.meta.public && !auth.isLoggedIn) return { name: 'login', query: { next: to.fullPath } };
  if (to.name === 'login' && auth.isLoggedIn) return { name: 'basecamp' };
  return true;
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · JBound` : 'JBound';
});

export default router;
