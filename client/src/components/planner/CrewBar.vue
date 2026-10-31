<script setup>
import { ref, computed } from 'vue';
import { api, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { initials } from '@/utils/format';

const props = defineProps({ trip: { type: Object, required: true } });
const emit = defineEmits(['changed']);
const auth = useAuthStore();

const AVATAR_TINTS = ['#E0A43B', '#DCE5CF', '#F2CDB8', '#CFE0D9', '#F6E2B3'];
const msg = ref('');
const isError = ref(false);
const copied = ref(''); // '' | 'code' | 'link'

const inviteLink = computed(() => `${window.location.origin}/planner?join=${props.trip.invite_code}`);
const isOwner = computed(() => props.trip.myRole === 'owner');

async function copy(kind) {
  const text = kind === 'code' ? props.trip.invite_code : inviteLink.value;
  try {
    await navigator.clipboard.writeText(text);
    copied.value = kind;
    setTimeout(() => (copied.value = ''), 2000);
  } catch {
    window.prompt(kind === 'code' ? 'Copy this code' : 'Copy this link', text); // TODO(team): replace with a nicer fallback
  }
}

async function newCode() {
  if (!window.confirm('Make a new invite code? The old code and link will stop working.')) return;
  msg.value = '';
  try {
    await api.post(`/trips/${props.trip.id}/invite-code`);
    msg.value = 'New invite code ready. The old one no longer works.';
    isError.value = false;
    emit('changed');
  } catch (err) {
    msg.value = errorMessage(err, 'Could not make a new code');
    isError.value = true;
  }
}
</script>

<template>
  <section class="crew" aria-label="Crew">
    <div class="row" style="gap: 10px; align-items: baseline">
      <h2 class="display display-sm">The crew</h2>
      <span class="hand muted">{{ trip.members.length }} explorer{{ trip.members.length === 1 ? '' : 's' }}</span>
    </div>
    <ul class="members">
      <li v-for="(m, i) in trip.members" :key="m.id">
        <span class="avatar" :style="{ background: AVATAR_TINTS[i % AVATAR_TINTS.length] }" aria-hidden="true">{{ initials(m.name) }}</span>
        <span class="name">{{ m.name }}<template v-if="m.id === auth.user?.id"> (you)</template></span>
      </li>
    </ul>

    <div class="tools">
      <div class="row" style="gap: 8px">
        <span class="label">Invite code</span>
        <code class="code" data-cy="invite-code">{{ trip.invite_code }}</code>
        <button type="button" class="btn btn-sm" @click="copy('code')">{{ copied === 'code' ? 'Copied!' : 'Copy code' }}</button>
        <button type="button" class="btn btn-sm" @click="copy('link')">{{ copied === 'link' ? 'Copied!' : 'Copy link' }}</button>
        <button v-if="isOwner" type="button" class="btn btn-sm btn-ghost" title="Make a new code (old one stops working)" @click="newCode">↻</button>
      </div>
      <p v-if="msg" :class="isError ? 'error-text' : 'hand'" role="status" style="margin: 0">{{ msg }}</p>
    </div>
  </section>
</template>

<style scoped>
.crew { display: flex; flex-wrap: wrap; align-items: center; gap: 14px 28px; padding: 14px 20px; border: 2px solid var(--ink); border-radius: var(--radius); background: var(--card); }
.members { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 10px 18px; }
.members li { display: flex; align-items: center; gap: 8px; }
.avatar { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 2px solid var(--ink); border-radius: 50%; font-size: 13px; font-weight: 800; }
.name { font-weight: 600; font-size: 15px; }
.tools { margin-left: auto; display: flex; flex-wrap: wrap; align-items: center; gap: 12px 18px; }
.label { font-size: 13px; font-weight: 700; }
.code { padding: 6px 12px; border: 2px dashed var(--ink); border-radius: 6px; font-family: 'Courier New', monospace; font-weight: 700; font-size: 17px; letter-spacing: 2px; }
</style>
