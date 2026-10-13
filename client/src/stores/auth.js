import { defineStore } from 'pinia';
import { api } from '@/lib/api';
import { supabase, hasSupabase } from '@/lib/supabase';

export const useAuthStore = defineStore('auth', {
  state: () => ({ user: null, profile: null, ready: false }),
  getters: {
    isLoggedIn: (s) => Boolean(s.user),
    firstName: (s) => s.profile?.name?.split(' ')[0] ?? '',
  },
  actions: {
    /** Restore an existing Supabase session on page load. */
    async init() {
      if (this.ready) return;
      try {
        if (hasSupabase) {
          const { data } = await supabase.auth.getSession();
          if (data.session) await this.loadMe();
          supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') { this.user = null; this.profile = null; }
          });
        }
      } catch {
        this.user = null;
      } finally {
        this.ready = true;
      }
    },
    async loadMe() {
      const { data } = await api.get('/auth/me');
      this.user = data.user;
      this.profile = data.profile;
    },
    async applySession(payload) {
      // Hand the tokens from our API to the Supabase client so it can refresh them + power Realtime.
      if (hasSupabase) {
        await supabase.auth.setSession({ access_token: payload.session.access_token, refresh_token: payload.session.refresh_token });
      }
      this.user = payload.user;
      this.profile = payload.profile;
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
      if (hasSupabase) await supabase.auth.signOut();
      this.user = null;
      this.profile = null;
    },
  },
});
