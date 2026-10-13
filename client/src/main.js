import { createApp } from "vue";
import { clerkPlugin } from "@clerk/vue";
import { createPinia } from "pinia";
import App from "./views/App.vue";
import router from "./router";
import { installAuthGuard } from "./router/authGuard";
import "./styles/theme.css";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!publishableKey) {
  throw new Error(
    "Missing VITE_CLERK_PUBLISHABLE_KEY. Add it to client/.env.local and restart pnpm dev.",
  );
}

const app = createApp(App);
app.use(createPinia());
app.use(createPinia());
app.use(clerkPlugin, {
  publishableKey,
  signInUrl: "/sign-in",
  signUpUrl: "/sign-up",
  afterSignOutUrl: "/",
});
app.use(router);
installAuthGuard(app, router); // must come after app.use(clerkPlugin) and app.use(router)
app.mount("#app");
