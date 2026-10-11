import { useAuth } from '@clerk/vue';
import { watch } from 'vue';
import { safeRedirect } from '@/utils/safeRedirect';

/**
 * Signed-out users are sent to /sign-in (and brought back afterwards via ?next=).
 * Signed-in users are kept out of /sign-in and /sign-up.
 * This is only for a nicer UX. Your API must still check the user's token on every request.
 */
export function installAuthGuard(app, router) {
  const { isLoaded, isSignedIn } = app.runWithContext(() => useAuth());

  const clerkReady = () =>
    new Promise((resolve) => {
      if (isLoaded.value) return resolve();
      const stop = watch(isLoaded, (loaded) => {
        if (loaded) {
          stop();
          resolve();
        }
      });
    });

  router.beforeEach(async (to) => {
    await clerkReady();

    if (to.meta.requiresAuth && !isSignedIn.value) {
      return { name: 'sign-in', query: { next: to.fullPath } };
    }
    if (to.meta.guestOnly && isSignedIn.value) {
      return safeRedirect(to.query.next);
    }
    return true;
  });
}