import { createRouter, createWebHistory } from "vue-router";

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
    path: "/planner/:tripId?",
    name: "planner",
    component: () => import("@/views/PlannerView.vue"),
    meta: { requiresAuth: true, title: "Planner" },
  },

  {
    path: "/explorer",
    name: "explorer",
    component: () => import("@/views/ExplorerView.vue"),
    meta: { title: "Explorer" },
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
