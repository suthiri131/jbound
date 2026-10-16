import { defineStore } from 'pinia';
import { api } from '@/lib/api';
import { supabase, hasSupabase } from '@/lib/supabase';
import { useTripsStore } from '@/stores/trips';

export const useAuthStore = defineStore('auth', {
  state: () => ({ user: null, profile: null, ready: false }),
  getters: {
    isLoggedIn: (s) => Boolean(s.user),
    firstName: (s) => s.profile?.name?.split(' ')[0] ?? '',
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
          if (data.session) await this.loadMe();
          supabase.auth.onAuthStateChange((_event, session) => {
            const user = session?.user || null;
            this.setUser(user, user?.id === this.user?.id ? this.profile : null);
          });
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
      if (hasSupabase) {
        await supabase.auth.setSession({ access_token: payload.session.access_token, refresh_token: payload.session.refresh_token });
      }
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
    async logout() {
      this.setUser(null);
      if (hasSupabase) await supabase.auth.signOut();
    },
  },
});
