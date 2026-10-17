import { watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { safeRedirect } from '@/utils/safeRedirect';

/**
 * Signed-out users are sent to /sign-in (and brought back afterwards via ?next=).
 * Signed-in users are kept out of /sign-in and /sign-up.
 * This is only for a nicer UX. The API re-checks the token on every request.
 */
export function installAuthGuard(router) {
  let watching = false;

  router.beforeEach(async (to) => {
    const auth = useAuthStore();
    await auth.init();

    // signing out while on a protected page -> back to sign-in
    if (!watching) {
      watching = true;
      watch(
        () => auth.isLoggedIn,
        (loggedIn) => {
          const current = router.currentRoute.value;
          if (!loggedIn && current.meta.requiresAuth) {
            router.replace({ name: 'sign-in', query: { next: current.fullPath } });
          }
        },
      );
    }

    if (to.meta.requiresAuth && !auth.isLoggedIn) {
      return { name: 'sign-in', query: { next: to.fullPath } };
    }
    if (to.meta.guestOnly && auth.isLoggedIn) {
      return safeRedirect(to.query.next);
    }
    return true;
  });
}
