import { defineStore } from 'pinia';
import { api } from '@/lib/api';
import { supabase, hasSupabase } from '@/lib/supabase';
import { useTripsStore } from '@/stores/trips';

/** An Error whose message is safe to show as-is (errorMessage() in lib/api.js prefers userMessage). */
const sessionError = (message) => Object.assign(new Error(message), { userMessage: message });

export const useAuthStore = defineStore('auth', {
  state: () => ({ user: null, profile: null, ready: false }),
  getters: {
    isLoggedIn: (s) => Boolean(s.user),
    // first_name comes from sign-up (so "Su Thiri" stays whole); older accounts fall back to the first word of name
    firstName: (s) => s.profile?.first_name || s.profile?.name?.split(' ')[0] || '',
  },
  actions: {
    setUser(user, profile = null) {
      if (this.user?.id !== user?.id) useTripsStore().clear();
      this.user = user;
      this.profile = profile;
    },
    /** Restore an existing Supabase session on page load. */
    async init() {
      if (this.ready) return;
      try {
        if (hasSupabase) {
          const { data } = await supabase.auth.getSession();
          // Listen before calling the API so a SIGNED_OUT (expired/rejected session, or another tab)
          // is never missed, even if loading the profile below fails.
          supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'INITIAL_SESSION') return; // init() already handles the restored session
            const user = session?.user || null;
            this.setUser(user, user?.id === this.user?.id ? this.profile : null);
          });
          if (data.session) await this.loadMe();
        }
      } catch {
        this.setUser(null);
      } finally {
        this.ready = true;
      }
    },
    async loadMe() {
      const { data } = await api.get('/auth/me');
      this.setUser(data.user, data.profile);
    },
    async applySession(payload) {
      // Hand the tokens from our API to the Supabase client so it can refresh them + power Realtime.
      // Only show the person as logged in once the session was actually stored; otherwise every
      // later API call would fail with a 401 while the UI still claims they are signed in.
      if (!hasSupabase) {
        throw sessionError('Sign-in is not set up on this site (missing Supabase settings). Please tell the team.');
      }
      const { error } = await supabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token,
      });
      if (error) throw sessionError('We could not start your session. Please try signing in again.');
      this.setUser(payload.user, payload.profile);
    },
    async login(email, password) {
      const { data } = await api.post('/auth/login', { email, password });
      await this.applySession(data);
    },
    async signup(form) {
      const { data } = await api.post('/auth/signup', form);
      await this.applySession(data);
    },
    /**
     * Permanently deletes the signed-in account (the API re-checks the password and throws if it cannot).
     * `beforeSignOut` lets the page move to a public screen first; otherwise the auth guard would bounce the
     * person to /sign-in the moment they are signed out of a protected page.
     */
    async deleteAccount(password, beforeSignOut) {
      await api.post('/auth/delete-account', { password });
      await beforeSignOut?.();
      await this.logout(); // the account is gone, so wipe the stored session and cached trips
    },
    async logout() {
      this.setUser(null); // also clears the trips store (setUser sees the account change)
      if (!hasSupabase) return;
      // If revoking the session on the server fails (offline, token already dead), still wipe the
      // locally stored session so a reload can't bring the old account back.
      try {
        const { error } = await supabase.auth.signOut();
        if (error) await supabase.auth.signOut({ scope: 'local' });
      } catch {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      }
    },
  },
});
