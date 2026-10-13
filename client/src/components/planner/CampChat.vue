<script setup>
/**
 * Camp chat. Primary: Supabase Realtime INSERTs on `messages`.
 * Fallback: poll GET /messages?after=<last created_at> every 4 s.
 */
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';
import { api, errorMessage } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/utils/format';

const props = defineProps({ tripId: { type: String, required: true } });

const messages = ref([]);
const draft = ref('');
const error = ref('');
const scroller = ref(null);
let channel = null;
let poll = null;

const lastTs = () => messages.value.at(-1)?.created_at;

async function scrollDown() {
  await nextTick();
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
}

function addMany(list) {
  const seen = new Set(messages.value.map((m) => m.id));
  const fresh = list.filter((m) => !seen.has(m.id));
  if (!fresh.length) return;
  messages.value = [...messages.value, ...fresh];
  scrollDown();
}

async function fetchNewer() {
  const after = lastTs();
  const { data } = await api.get(`/trips/${props.tripId}/messages`, { params: after ? { after } : {} });
  addMany(data);
}

function startPolling() {
  clearInterval(poll);
  poll = setInterval(() => fetchNewer().catch(() => {}), 4000);
}

function cleanup() {
  if (channel) supabase.removeChannel(channel);
  channel = null;
  clearInterval(poll);
}

async function open(id) {
  cleanup();
  messages.value = [];
  error.value = '';
  try {
    const { data } = await api.get(`/trips/${id}/messages`, { params: { limit: 50 } });
    messages.value = data;
    scrollDown();
  } catch (err) {
    error.value = errorMessage(err);
  }
  if (!supabase) return startPolling();
  channel = supabase
    .channel(`chat-${id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `trip_id=eq.${id}` }, () => {
      // The Realtime payload has no joined author, so fetch the newest rows through the API.
      fetchNewer().catch(() => {});
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') startPolling();
    });
}

watch(() => props.tripId, open, { immediate: true });
onBeforeUnmount(cleanup);

async function send() {
  const text = draft.value.trim();
  if (!text) return;
  draft.value = '';
  try {
    const { data } = await api.post(`/trips/${props.tripId}/messages`, { text });
    addMany([data]);
  } catch (err) {
    error.value = errorMessage(err);
    draft.value = text;
  }
}
</script>

<template>
  <section class="chat" aria-label="Camp chat">
    <div class="head">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--mustard)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c2 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-7Z" /><path d="M4 21l16-3M4 18l16 3" /></svg>
      <h2 class="display" style="font-size: 20px">Camp chat</h2>
      <span class="hint">Ticks, new stops, photos and expenses post here automatically</span>
    </div>
    <div ref="scroller" class="log" aria-live="polite">
      <template v-for="m in messages" :key="m.id">
        <p v-if="m.kind === 'system'" class="sys hand">✦ {{ m.text }}</p>
        <div v-else>
          <p class="who">{{ m.author?.name?.toUpperCase() }} <span class="ago">{{ timeAgo(m.created_at) }}</span></p>
          <p class="text">{{ m.text }}</p>
        </div>
      </template>
      <p v-if="!messages.length" class="muted" style="color: var(--line)">Quiet campfire. Say hi to the crew.</p>
    </div>
    <p v-if="error" class="error-text" style="margin: 0 20px; color: var(--clay)">{{ error }}</p>
    <form class="compose" @submit.prevent="send">
      <label style="flex: 1; min-width: 0">
        <span class="sr-only">Message your crew</span>
        <input v-model="draft" class="msg" maxlength="2000" placeholder="Message the crew…" data-cy="chat-input" />
      </label>
      <button type="submit" class="send" aria-label="Send message">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12 20 4l-6 16-3-7Z" /></svg>
      </button>
    </form>
  </section>
</template>

<style scoped>
.chat { border: 2px solid var(--ink); border-radius: var(--radius); background: var(--ink); color: var(--paper); overflow: hidden; }
.head { display: flex; align-items: center; gap: 10px; padding: 14px 20px; border-bottom: 2px solid var(--ink-soft); }
.hint { margin-left: auto; font-size: 13px; color: var(--line); }
.log { max-height: 280px; overflow-y: auto; padding: 14px 20px; display: flex; flex-direction: column; gap: 12px; }
.sys { margin: 0; font-size: 20px; color: var(--mustard); }
.who { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: 1px; color: var(--line); }
.ago { font-weight: 500; letter-spacing: 0; opacity: .7; }
.text { margin: 2px 0 0; font-size: 15px; }
.compose { display: flex; gap: 8px; padding: 12px 16px 16px; border-top: 2px solid var(--ink-soft); }
.msg { width: 100%; min-height: 46px; padding: 0 12px; border: 2px solid var(--ink-soft); border-radius: 8px; background: #3A2E20; color: var(--paper); font-family: var(--font-body); font-size: 15px; }
.send { flex: none; width: 46px; height: 46px; border: 0; border-radius: 8px; background: var(--mustard); cursor: pointer; display: flex; align-items: center; justify-content: center; }
</style>
