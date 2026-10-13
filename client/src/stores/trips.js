import { defineStore } from 'pinia';
import { api } from '@/lib/api';

/** The satchel: every trip the user is on that hasn't been archived yet. */
export const useTripsStore = defineStore('trips', {
  state: () => ({ trips: [], loaded: false, loading: false }),
  getters: {
    onTheRoad: (s) => s.trips.find((t) => t.phase === 'on_the_road') || null,
    memoryBoxTrips: (s) => s.trips.filter((t) => t.phase === 'memory_box'),
    /** Trips you can still add stops to */
    plannable: (s) => s.trips.filter((t) => t.phase === 'planning' || t.phase === 'on_the_road'),
    /** Best trip to open by default: on the road → memory box → next planned → anything */
    defaultTrip: (s) =>
      s.trips.find((t) => t.phase === 'on_the_road') ||
      s.trips.find((t) => t.phase === 'memory_box') ||
      s.trips.find((t) => t.phase === 'planning') ||
      s.trips[0] ||
      null,
  },
  actions: {
    async fetch(force = false) {
      if (this.loaded && !force) return this.trips;
      this.loading = true;
      try {
        const { data } = await api.get('/trips');
        this.trips = data;
        this.loaded = true;
        return data;
      } finally {
        this.loading = false;
      }
    },
    async create(payload) {
      const { data } = await api.post('/trips', payload);
      await this.fetch(true);
      return data;
    },
    async join(inviteCode) {
      const { data } = await api.post('/trips/join', { inviteCode });
      await this.fetch(true);
      return data;
    },
    async archive(tripId) {
      await api.post(`/trips/${tripId}/archive`);
      await this.fetch(true);
    },
  },
});
