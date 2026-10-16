import { defineStore } from 'pinia';
import { api } from '@/lib/api';

/** The satchel: every trip the user is on that hasn't been archived yet. */
export const useTripsStore = defineStore('trips', {
  state: () => ({ trips: [], loaded: false, loading: false, sessionVersion: 0 }),
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
    clear() {
      this.sessionVersion++;
      this.trips = [];
      this.loaded = false;
      this.loading = false;
    },
    assertSession(version) {
      if (version !== this.sessionVersion) throw new Error('Account changed during trip request');
    },
    async fetch(force = false) {
      if (this.loaded && !force) return this.trips;
      const version = this.sessionVersion;
      this.loading = true;
      try {
        const { data } = await api.get('/trips');
        this.assertSession(version);
        this.trips = data;
        this.loaded = true;
        return data;
      } finally {
        if (version === this.sessionVersion) this.loading = false;
      }
    },
    async create(payload) {
      const version = this.sessionVersion;
      const { data } = await api.post('/trips', payload);
      this.assertSession(version);
      await this.fetch(true);
      this.assertSession(version);
      return data;
    },
    async remove(tripId) {
      const version = this.sessionVersion;
      await api.delete(`/trips/${tripId}`);
      this.assertSession(version);
      this.trips = this.trips.filter((trip) => trip.id !== tripId);
      this.loaded = false;
    },
    async update(tripId, payload) {
      const version = this.sessionVersion;
      const { data } = await api.patch(`/trips/${tripId}`, payload);
      this.assertSession(version);
      this.loaded = false;
      return data;
    },
    async join(inviteCode) {
      const version = this.sessionVersion;
      const { data } = await api.post('/trips/join', { inviteCode });
      this.assertSession(version);
      await this.fetch(true);
      this.assertSession(version);
      return data;
    },
    async archive(tripId) {
      const version = this.sessionVersion;
      await api.post(`/trips/${tripId}/archive`);
      this.assertSession(version);
      await this.fetch(true);
    },
  },
});
