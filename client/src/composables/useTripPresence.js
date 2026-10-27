import { ref, onBeforeUnmount, watch } from 'vue';
import { supabase } from '@/lib/supabase';

export function useTripPresence(tripIdRef, meRef) {
  const viewerIds = ref([]);
  let channel = null;

  function stop() {
    if (channel) supabase.removeChannel(channel);
    channel = null;
    viewerIds.value =  [];
  }

  function start(tripId) {
    stop();
    const me = meRef.value;
    if (!tripId || !supabase || !me?.id) return;

    channel = supabase.channel(`trip-${tripId}-presence`, {
      config: { presence: { key: me.id } },
    });

    channel.on('presence', { event: 'sync' }, () => {
      console.log('presence sync fired, state:', channel.presenceState());
      viewerIds.value = Object.keys(channel.presenceState());
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await channel.track({ userId: me.id });
    });
  }

  watch(tripIdRef, start, { immediate: true });
  onBeforeUnmount(stop);

  return { viewerIds };
}