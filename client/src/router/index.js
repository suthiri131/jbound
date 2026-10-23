import { createRouter, createWebHistory } from "vue-router";
import WatcherView from '../views/WatcherView.vue';
import PlaceTalesView from '../views/PlaceTalesView.vue';

const routes = [
  {
    path: "/",
    name: "home",
    component: () => import("@/views/BasecampView.vue"),
    meta: { title: "Home" },
  },

  {
    path: "/sign-in",
    name: "sign-in",
    component: () => import("@/views/SignInView.vue"),
    meta: { guestOnly: true, title: "Sign in" },
  },
  {
    path: "/sign-up",
    name: "sign-up",
    component: () => import("@/views/SignUpView.vue"),
    meta: { guestOnly: true, title: "Sign up" },
  },

  // AppNav sends people to /login after signing out
  { path: "/login", redirect: { name: "sign-in" } },

  // Tales + Border routes
  {
    path: "/tales",
    name: "tales",
    component: () => import("@/views/TalesView.vue"),
    meta: { requiresAuth: true, title: "Tales" },
  },

  {
    path: "/planner",
    name: "planner",
    component: () => import("@/views/PlannerView.vue"),
    meta: { requiresAuth: true, title: "Trips" },
  },
  {
    path: "/planner/:tripId",
    name: "trip-details",
    component: () => import("@/views/PlannerDetailsView.vue"),
    meta: { requiresAuth: true, title: "Trip details" },
  },
  {
    path: "/ledger",
    name: "ledger",
    component: () => import("@/views/LedgerView.vue"),
    meta: { requiresAuth: true, title: "Ledger" },
  },
  {
    path: "/explorer",
    name: "explorer",
    component: () => import("@/views/ExplorerView.vue"),
    meta: { title: "Explorer" },
  },

  {
    path: "/watcher",
    name: "watcher",
    component: WatcherView,
    meta: { title: "Watcher" },
  },

  {
  path: '/tales/place/:placeId',
  name: 'place-tales',
  component: PlaceTalesView,
  },

  {
    path: '/tales/custom/:name',
    name: 'custom-place-tales',
    component: PlaceTalesView
  },

  {
  path: "/archives/:tripId?",
  name: "archives",
  component: () => import("@/views/ArchivesView.vue"),
  meta: { requiresAuth: true, title: "Archives" },
  },

  {
    path: "/notifications",
    name: "notifications",
    component: () => import("@/views/NotificationsView.vue"),
    meta: { requiresAuth: true, title: "Notifications"},
  }

];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · JBound` : "JBound";
});

export default router;
