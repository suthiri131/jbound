import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', name: 'home', component: () => import('@/views/BasecampView.vue'), meta: { title: 'Home' } },

  // Clerk's <SignIn>/<SignUp> use path routing, so they need the catch-all (e.g. /sign-up/verify-email-address).
  { path: '/sign-in/:pathMatch(.*)*', name: 'sign-in', component: () => import('@/views/SignInView.vue'), meta: { guestOnly: true, title: 'Sign in' } },
  { path: '/sign-up/:pathMatch(.*)*', name: 'sign-up', component: () => import('@/views/SignUpView.vue'), meta: { guestOnly: true, title: 'Sign up' } },

  { path: '/trips', name: 'my-trips', component: () => import('@/views/trips/MyTripsView.vue'), meta: { requiresAuth: true, title: 'My Trips' } },
  { path: '/trips/new', name: 'create-trip', component: () => import('@/views/trips/CreateTripView.vue'), meta: { requiresAuth: true, title: 'Create Trip' } },
  { path: '/trips/:tripId/planner', name: 'trip-planner', component: () => import('@/views/trips/TripPlannerView.vue'), meta: { requiresAuth: true, title: 'Trip Planner' } },

  // Tales + Border routes
  {path: '/tales', name: 'tales', component: () => import('@/views/TalesView.vue'), meta: { requiresAuth: true, title: 'Tales' }}
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
