<script setup>
import { ref, computed, reactive } from 'vue';
import { api, assetUrl, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { initials } from '@/utils/format';
import { useTripPresence } from '../../composables/useTripPresence';
import { askConfirm } from '@/lib/dialog';

const props = defineProps({ trip: { type: Object, required: true },isLive: { type: Boolean, default: true }});
const emit = defineEmits(['changed', 'joined']);
const auth = useAuthStore();

const AVATAR_TINTS = ['#E0A43B', '#DCE5CF', '#F2CDB8', '#CFE0D9', '#F6E2B3'];

// Profile photos. Your own comes from the auth store so a new photo shows straight away;
// a photo that fails to load falls back to the initials.
const brokenAvatars = reactive({});
const avatarUrl = (person) => (person?.id === auth.user?.id && auth.profile ? auth.profile.avatar_url : person?.avatar_url);
const avatarSrc = (person) => {
  const url = avatarUrl(person);
  return url && !brokenAvatars[url] ? assetUrl(url) : '';
};
const username = ref('');
const msg = ref('');
const isError = ref(false);
const copied = ref(''); // '' | 'code' | 'link'

const inviteLink = computed(() => `${window.location.origin}/planner?join=${props.trip.invite_code}`);
const isOwner = computed(() => props.trip.myRole === 'owner');
const copyFailed = ref(''); // '' | 'code' | 'link'
const fallbackInput = ref(null);
const tripIdRef = computed(()=> props.trip.id);
const refMe= computed(() => auth.user);
const {viewerIds } = useTripPresence(tripIdRef,refMe)

async function invite() {
  const u = username.value.replace(/^@/, '').trim().toLowerCase();
  if (!u) return;
  msg.value = '';
  try {
    const { data } = await api.post(`/trips/${props.trip.id}/members`, { username: u });
    emit('joined', `${data.name} joined the crew`);
    isError.value = false;
    username.value = '';
    emit('changed');
  } catch (err) {
    msg.value = errorMessage(err);
    isError.value = true;
  }
}

async function copy(kind) {
  const text = kind === 'code' ? props.trip.invite_code : inviteLink.value;
  copyFailed.value = '';
  try {
    await navigator.clipboard.writeText(text);
    copied.value = kind;
    setTimeout(() => (copied.value = ''), 2000);
  } catch {
    copyFailed.value = kind;
    setTimeout(() => fallbackInput.value?.select(), 0);
  }
}

async function newCode() {
  const yes = await askConfirm({
    title: 'Make a new invite code?',
    message: 'The old code and link will stop working.',
    confirmLabel: 'Make new code',
  });
  if (!yes) return;
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

async function removeMember(m) {
  const isSelf = m.id === auth.user?.id;
  const question = isSelf
    ? { title: 'Leave this crew?', message: 'You can be invited back later.', confirmLabel: 'Leave crew' }
    : m.status === 'pending'
      ? { title: `Cancel the invite to ${m.name}?`, confirmLabel: 'Cancel invite', cancelLabel: 'Keep invite' }
      : { title: `Remove ${m.name} from the crew?`, confirmLabel: 'Remove' };
  if (!(await askConfirm({ ...question, danger: true }))) return;
  msg.value = '';
  try {
    await api.delete(`/trips/${props.trip.id}/members/${m.id}`);
    isError.value = false;
    emit('changed');
  } catch (err) {
    msg.value = errorMessage(err);
    isError.value = true;
  }
}
</script>

<template>
  <section class="crew" aria-label="Crew">
    <div class="row" style="gap: 10px; align-items: baseline; justify-content: space-between; width:100%;">
      <div class="row" style="gap: 10px; align-items: baseline">
      <h2 class="display display-sm">The crew</h2>
      <span class="hand muted">{{ trip.members.length }} explorer{{ trip.members.length === 1 ? '' : 's' }}</span>
      </div>
      <p class="row" style="gap: 6px; font-size: 12px; margin: 0" :class="isLive ? 'muted' : 'error-text'">
    <span :style="{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: isLive ? 'var(--jungle)' : 'var(--brick)' }" aria-hidden="true"></span>
    {{ isLive ? 'Live' : 'Offline — syncing every 15s' }}
      </p>
    </div>
    
    <ul class="members">
      <li v-for="(m, i) in trip.members" :key="m.id">
        <span class="avatar" :style="{ background: AVATAR_TINTS[i % AVATAR_TINTS.length] }"  :class="{ online: viewerIds.includes(m.id) }" aria-hidden="true"><img v-if="avatarSrc(m)" :src="avatarSrc(m)" alt="" @error="brokenAvatars[avatarUrl(m)] = true" /><template v-else>{{ initials(m.name) }}</template></span>
        <span class="name">{{ m.name }}<template v-if="m.id === auth.user?.id"> (you)</template><template v-if="m.status === 'pending'"> Pending</template></span>
        <button v-if="m.id === auth.user?.id ? !isOwner : isOwner" type="button" class="btn btn-sm btn-ghost" :aria-label="m.id === auth.user?.id ? 'Leave crew' : `Remove ${m.name}`" @click="removeMember(m)">{{ m.id === auth.user?.id ? 'Leave' : (m.status === 'pending' ? 'Cancel' : 'Remove') }}</button>
      </li>
    </ul>

    <div class="tools">
      <div class="row" style="gap: 8px; flex-wrap: wrap ">
        <span class="label">Invite code</span>
        <code class="code" data-cy="invite-code">{{ trip.invite_code }}</code>
        <button type="button" class="btn btn-sm" @click="copy('code')">{{ copied === 'code' ? 'Copied!' : 'Copy code' }}</button>
        <button type="button" class="btn btn-sm" @click="copy('link')">{{ copied === 'link' ? 'Copied!' : 'Copy link' }}</button>
        <button v-if="isOwner" type="button" class="btn btn-sm btn-ghost" title="Make a new code (old one stops working)" @click="newCode">↻</button>
        <template v-if="copyFailed">
          <input ref="fallbackInput" class="input" style="width: 220px" readonly :value="copyFailed === 'code' ? trip.invite_code : inviteLink" @click="$event.target.select()" :aria-label="`Invite ${copyFailed} — select and copy`" />
          <span class="hand muted" style="font-size: 13px">Couldn't copy automatically. Select and copy it here.</span>
        </template>
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
.crew { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; padding: 14px 20px; border: 2px solid var(--ink); border-radius: var(--radius); background: var(--card); }
.members { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 10px 18px; }
.members li { display: flex; align-items: center; gap: 8px; }
.avatar { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 2px solid var(--ink); border-radius: 50%; font-size: 13px; font-weight: 800; overflow: hidden; }
.avatar img { display: block; width: 100%; height: 100%; object-fit: cover; }
.avatar.online { box-shadow: 0 0 0 3px var(--jungle), 0 0 0 5px var(--sage); }
.name { font-weight: 600; font-size: 15px; }
.tools {display: flex; flex-wrap: wrap; align-items: center; gap: 12px 18px; }
.label { font-size: 13px; font-weight: 700; }
.code { padding: 6px 12px; border: 2px dashed var(--ink); border-radius: 6px; font-family: 'Courier New', monospace; font-weight: 700; font-size: 17px; letter-spacing: 2px; }
</style>
