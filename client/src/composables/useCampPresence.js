import { onBeforeUnmount, reactive } from 'vue';
import { supabase } from '@/lib/supabase';

const MAX_CHANNELS = 5; // one per shared trip; a handful is plenty for a campsite

/**
 * Live crewmates at basecamp. Joins `camp-<tripId>` for each trip you share with someone, tracks who is here
 * (presence) and passes on where they walk (broadcast, so positions never touch the database).
 *
 * `online` maps userId -> { id, name, look, x, z, ry, at }. Call send({ x, z, ry }) as you move.
 */
export function useCampPresence() {
  const online = reactive({});
  let channels = [];
  let me = null;
  let lastSent = 0;
  let pending = null;
  let timer = null;

  async function stop() {
    await Promise.all(channels.map((ch) => supabase?.removeChannel(ch)));
    channels = [];
    clearTimeout(timer);
    timer = null;
    pending = null;
    for (const id of Object.keys(online)) delete online[id];
  }

  /** profile: { id, name, look }; tripIds: trips whose crews should see you */
  async function start(profile, tripIds) {
    await stop();
    me = profile;
    if (!supabase || !me?.id || !tripIds.length) return;

    for (const tripId of tripIds.slice(0, MAX_CHANNELS)) {
      const ch = supabase.channel(`camp-${tripId}`, {
        config: { presence: { key: me.id }, broadcast: { self: false } },
      });
      ch.on('presence', { event: 'sync' }, () => {
        const here = new Set();
        for (const channel of channels) {
          for (const [id, metas] of Object.entries(channel.presenceState())) {
            if (id === me.id || !metas[0]) continue;
            here.add(id);
            const { name, look, x = 0, z = 12 } = metas[0];
            online[id] = { ...(online[id] || { x, z, ry: Math.PI }), id, name, look };
          }
        }
        for (const id of Object.keys(online)) if (!here.has(id)) delete online[id];
      });
      ch.on('broadcast', { event: 'move' }, ({ payload }) => {
        const mate = online[payload?.id];
        if (!mate) return;
        Object.assign(mate, { x: payload.x, z: payload.z, ry: payload.ry, at: Date.now() });
      });
      ch.on('broadcast', { event: 'wave' }, ({ payload }) => {
        const mate = online[payload?.id];
        if (mate) mate.waveAt = Date.now();
      });
      ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await ch.track({ name: me.name, look: me.look, x: 0, z: 12 });
      });
      channels.push(ch);
    }
  }

  function flush() {
    if (!pending) return;
    const payload = { id: me.id, ...pending };
    channels.forEach((ch) => ch.send({ type: 'broadcast', event: 'move', payload }));
    pending = null;
    lastSent = Date.now();
  }

  /** Throttled to ~8 updates a second; the receiving side smooths between them. */
  function send(pos) {
    if (!channels.length) return;
    pending = { x: +pos.x.toFixed(2), z: +pos.z.toFixed(2), ry: +pos.ry.toFixed(2) };
    const wait = 120 - (Date.now() - lastSent);
    if (wait <= 0) flush();
    else if (!timer) timer = setTimeout(() => ((timer = null), flush()), wait);
  }

  function wave() {
    channels.forEach((ch) => ch.send({ type: 'broadcast', event: 'wave', payload: { id: me?.id } }));
  }

  onBeforeUnmount(stop);
  return { online, start, send, wave, stop };
}
