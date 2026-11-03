import { defineStore } from 'pinia';
import { api } from '@/lib/api';

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({ inviteCount: 0 }),
  actions: {
    async fetchInviteCount() {
      try {
        const { data } = await api.get('/trips/invites');
        this.inviteCount = data.length;
      } catch {
        this.inviteCount = 0;
      }
    },
  },
}); 