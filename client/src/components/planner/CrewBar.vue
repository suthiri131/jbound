<script setup>
import { ref, computed } from 'vue';
import { api, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { initials } from '@/utils/format';

const props = defineProps({ trip: { type: Object, required: true } });
const emit = defineEmits(['changed']);
const auth = useAuthStore();

const AVATAR_TINTS = ['#E0A43B', '#DCE5CF', '#F2CDB8', '#CFE0D9', '#F6E2B3'];
const username = ref('');
const msg = ref('');
const isError = ref(false);
const copied = ref(false);

const inviteLink = computed(() => `${window.location.origin}/planner?join=${props.trip.invite_code}`);
const isOwner = computed(() => props.trip.myRole === 'owner');
const copyFailed = ref(false);

const fallbackInput = ref(null);

async function invite() {
  const u = username.value.replace(/^@/, '').trim().toLowerCase();
  if (!u) return;
  msg.value = '';
  try {
    const { data } = await api.post(`/trips/${props.trip.id}/members`, { username: u });
    msg.value = `${data.name} joined the crew`;
    isError.value = false;
    username.value = '';
    emit('changed');
  } catch (err) {
    msg.value = errorMessage(err);
    isError.value = true;
  }
}

async function copyLink() {
  copyFailed.value=false;

  try {
    // throw new Error('test') // use to throw error to test validation 
    await navigator.clipboard.writeText(inviteLink.value);
    copied.value = true;
    setTimeout(()=> (copied.value = false), 3000)
   
  } catch {
    copyFailed.value= true;
   setTimeout(() => fallbackInput.value?.select(),0)
  }
}

async function newCode() {
  await api.post(`/trips/${props.trip.id}/invite-code`);
  emit('changed');
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
      <div class="row" style="gap: 8px; flex-wrap: wrap ">
        <span class="label">Invite code</span>
        <code class="code">{{ trip.invite_code }}</code>
        <button type="button" class="btn btn-sm" @click="copyLink">{{ copied ? 'Copied!' : 'Copy link' }}</button>
        <button v-if="isOwner" type="button" class="btn btn-sm btn-ghost"  @click="newCode">↻</button>
        <input v-if="copyFailed" ref="fallbackInput" class="input" style="width: 220px" readonly :value="inviteLink" @click="$event.target.select()" aria-label="Invite link — select and copy"/>
      <span v-if="copyFailed" class="hand muted" style="font-size: 13px">Error copying </span>
      
      </div>
      <form class="row" style="gap: 8px" @submit.prevent="invite">
        <label class="label" for="invite-user">Invite</label>
        <input id="invite-user" v-model="username" class="input" style="width: 150px" placeholder="@username" />
        <button type="submit" class="btn btn-dark btn-sm">Send</button>
      </form>
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
