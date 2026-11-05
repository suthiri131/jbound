import { defineStore } from 'pinia';
import { api } from '@/lib/api';

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({ inviteCount: 0, tripsNeedingPhotos: 0 }),
  getters: {
    /** The bell's badge: things still waiting on the user. */
    badgeCount: (s) => s.inviteCount + s.tripsNeedingPhotos,
  },
  actions: {
    setReminders(reminders) {
      this.tripsNeedingPhotos = new Set(reminders.filter((r) => r.needsPhotos).map((r) => r.tripId)).size;
    },
    async fetchBadgeCount() {
      const [invites, reminders] = await Promise.allSettled([api.get('/trips/invites'), api.get('/trips/memory-reminders')]);
      this.inviteCount = invites.status === 'fulfilled' ? invites.value.data.length : 0;
      this.setReminders(reminders.status === 'fulfilled' ? reminders.value.data : []);
    },
  },
});
