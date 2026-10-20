import { onBeforeUnmount, watch, ref} from 'vue';
import { supabase } from '@/lib/supabase';

/**
 * Subscribe to Postgres changes for one trip on the given tables.
 * Calls onChange(table, payload) for every insert/update/delete.
 * Falls back to polling every `pollMs` when Supabase isn't configured or the channel fails.
 *
 * Tables must be in the `supabase_realtime` publication (see server/db/schema.sql).
 *
 * @param {import('vue').Ref<string|null>} tripIdRef
 * @param {string[]} tables e.g. ['itinerary_items', 'memories']
 * @param {(table: string, payload?: object) => void} onChange
 * @param {{ pollMs?: number }} [opts]
 * @returns {{isLive: import('vue').Ref<boolean>}}
 */

export function useTripRealtime(tripIdRef, tables, onChange, { pollMs = 15000 } = {}) {
  let channel = null;
  let poll = null;
  const isLive= ref(false);

  function stop() {
    if (channel) supabase.removeChannel(channel);
    channel = null;
    clearInterval(poll);
    poll = null;
    isLive.value = false;
  }

  function startPolling() {
    isLive.value = false;
    clearInterval(poll);
    poll = setInterval(() => tables.forEach((t) => onChange(t)), pollMs);
  }

  function start(tripId) {
    stop();
    if (!tripId) return;
    if (!supabase) return startPolling();

    channel = supabase.channel(`trip-${tripId}-${tables.join('-')}`);
    tables.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `trip_id=eq.${tripId}` }, (payload) =>
        onChange(table, payload),
      );
    });
    channel.subscribe((status) => {
      isLive.value = status === 'SUBSCRIBED' ;
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') startPolling();
    });
  }

  watch(tripIdRef, start, { immediate: true });
  onBeforeUnmount(stop);

  return {isLive};
}
