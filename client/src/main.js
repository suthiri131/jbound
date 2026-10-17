import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./views/App.vue";
import router from "./router";
import { installAuthGuard } from "./router/authGuard";
import "./styles/theme.css";

const app = createApp(App);
app.use(createPinia()); // before the router: the auth guard uses the auth store
installAuthGuard(router);
app.use(router);
app.mount("#app");
