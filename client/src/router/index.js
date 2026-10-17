import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', name: 'home', component: () => import('@/views/HomeView.vue'), meta: { title: 'Home' } },
  { path: '/planner', name: 'planner', component: () => import('@/views/PlannerView.vue'), meta: { title: 'Planner' } },
  { path: '/ledger', name: 'ledger', component: () => import('@/views/LedgerView.vue'), meta: { title: 'Ledger' } },

  // Clerk's <SignIn>/<SignUp> use path routing, so they need the catch-all (e.g. /sign-up/verify-email-address).
  { path: '/sign-in/:pathMatch(.*)*', name: 'sign-in', component: () => import('@/views/SignInView.vue'), meta: { guestOnly: true, title: 'Sign in' } },
  { path: '/sign-up/:pathMatch(.*)*', name: 'sign-up', component: () => import('@/views/SignUpView.vue'), meta: { guestOnly: true, title: 'Sign up' } },

  // Pages that need a signed-in user get meta: { requiresAuth: true }. Example:
  // { path: '/planner', name: 'planner', component: () => import('@/views/PlannerView.vue'), meta: { requiresAuth: true, title: 'Planner' } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · JBound` : 'JBound';
});

export default router;