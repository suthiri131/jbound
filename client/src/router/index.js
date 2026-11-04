import { createRouter, createWebHistory } from "vue-router";
import WatcherView from '../views/WatcherView.vue';
import PlaceTalesView from '../views/PlaceTalesView.vue';

const routes = [
  {
    path: "/",
    name: "home",
    component: () => import("@/views/BasecampView.vue"),
    meta: { title: "Home", fullBleed: true , peekNav: true}, // the 3D camp fills the window: no footer, no page scroll
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
    meta: { requiresAuth: true, title: "Tales", fullBleed: true },
  },

  {
    path: "/watcher",
    name: "watcher",
    component: WatcherView,
    meta: { title: "Watcher", fullBleed: true },
  },

  // A place's tales live on the notice board, whichever page you came from. These keep old links working.
  {
    path: "/tales/place/:placeId",
    redirect: (to) => ({ name: "explorer-place-tales", params: to.params }),
  },
  {
    path: "/tales/custom/:name",
    redirect: (to) => ({ name: "explorer-custom-tales", params: to.params }),
  },
  
  {
    path: "/planner",
    name: "planner",
    component: () => import("@/views/PlannerView.vue"),
    meta: { requiresAuth: true, title: "Trips", fullBleed: true },
  },
  {
    path: "/planner/:tripId", 
    name: "trip-details",
    component: () => import("@/views/PlannerDetailsView.vue"),
    meta: { requiresAuth: true, title: "Trip details", fullBleed: true },
  },
  {
    path: "/ledger",
    name: "ledger",
    component: () => import("@/views/LedgerView.vue"),
    meta: { requiresAuth: true, title: "Ledger", fullBleed: true },
  },
  {
    path: "/explorer",
    name: "explorer",
    component: () => import("@/views/ExplorerView.vue"),
    meta: { title: "Explorer", fullBleed: true },
    // these take over the notice board; the Explorer stays mounted underneath, so its results and filters survive
    children: [
      {
        path: "place/:googlePlaceId",
        name: "place",
        component: () => import("@/views/PlaceView.vue"),
        meta: { title: "Place", onBoard: true },
      },
      {
        path: "tales/place/:placeId",
        name: "explorer-place-tales",
        component: PlaceTalesView,
        meta: { title: "Tales", onBoard: true },
      },
      {
        path: "tales/custom/:name",
        name: "explorer-custom-tales",
        component: PlaceTalesView,
        meta: { title: "Tales", onBoard: true },
      },
    ],
  },
  {
    path: "/archives/:tripId?",
    name: "archives",
    component: () => import("@/views/ArchivesView.vue"),
    meta: { requiresAuth: true, title: "Archives", fullBleed: true },
  },
  {
    path: "/notifications",
    name: "notifications",
    component: () => import("@/views/NotificationsView.vue"),
    meta: { requiresAuth: true, title: "Notifications" },
  },

  {
    path: "/profile",
    name: "profile",
    component: () => import("@/views/ProfileView.vue"),
    meta: { requiresAuth: true, title: "Profile" },
  },
  // public on purpose: this is where people land right after their account is gone
  {
    path: "/account-deleted",
    name: "account-deleted",
    component: () => import("@/views/AccountDeletedView.vue"),
    meta: { title: "Account deleted" },
  },
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
