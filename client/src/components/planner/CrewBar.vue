<script setup>
import { ref, computed, reactive, nextTick, onBeforeUnmount } from 'vue';
import { api, assetUrl, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { initials } from '@/utils/format';
import { useTripPresence } from '../../composables/useTripPresence';

const props = defineProps({ trip: { type: Object, required: true }, isLive: { type: Boolean, default: true } });
// `notify` shows a little toast on the trip page (copied, invite sent, or what went wrong)
const emit = defineEmits(['changed', 'joined', 'notify']);
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

const inviteLink = computed(() => `${window.location.origin}/planner?join=${props.trip.invite_code}`);
const isOwner = computed(() => props.trip.myRole === 'owner');
const tripIdRef = computed(() => props.trip.id);
const refMe = computed(() => auth.user);
const { viewerIds } = useTripPresence(tripIdRef, refMe);

// ---------- the Invite pop-up ----------
const inviteOpen = ref(false);
const showFriendForm = ref(false);
const username = ref('');
const sending = ref(false);
const copyFailed = ref(''); // '' | 'code' | 'link': the clipboard was blocked, so show the text to copy by hand
const popover = ref(null);
const inviteButton = ref(null);
const usernameInput = ref(null);
const fallbackInput = ref(null);

function onOutsideClick(e) {
  if (!popover.value?.contains(e.target) && !inviteButton.value?.contains(e.target)) closeInvite(false);
}
function onKey(e) {
  if (e.key === 'Escape') closeInvite();
}
async function openInvite() {
  inviteOpen.value = true;
  document.addEventListener('pointerdown', onOutsideClick);
  document.addEventListener('keydown', onKey);
  await nextTick();
  popover.value?.querySelector('button')?.focus();
}
function closeInvite(returnFocus = true) {
  if (!inviteOpen.value) return;
  inviteOpen.value = false;
  showFriendForm.value = false;
  copyFailed.value = '';
  document.removeEventListener('pointerdown', onOutsideClick);
  document.removeEventListener('keydown', onKey);
  if (returnFocus) inviteButton.value?.focus();
}
const toggleInvite = () => (inviteOpen.value ? closeInvite() : openInvite());
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutsideClick);
  document.removeEventListener('keydown', onKey);
});

async function showFriend() {
  showFriendForm.value = true;
  await nextTick();
  usernameInput.value?.focus();
}

async function copy(kind) {
  const text = kind === 'code' ? props.trip.invite_code : inviteLink.value;
  copyFailed.value = '';
  try {
    await navigator.clipboard.writeText(text);
    emit('notify', kind === 'code' ? `Invite code ${text} copied` : 'Invite link copied. Send it to your crew!');
  } catch {
    copyFailed.value = kind;
    emit('notify', `Couldn't copy the ${kind} automatically. Select it in the box and copy it.`);
    await nextTick();
    fallbackInput.value?.select();
  }
}

async function invite() {
  const u = username.value.replace(/^@/, '').trim().toLowerCase();
  if (!u || sending.value) return;
  sending.value = true;
  try {
    const { data } = await api.post(`/trips/${props.trip.id}/members`, { username: u });
    emit('notify', `Invite sent to ${data.name || '@' + u}`);
    username.value = '';
    emit('changed');
  } catch (err) {
    emit('notify', `Couldn't invite @${u}: ${errorMessage(err)}`);
  } finally {
    sending.value = false;
  }
}

async function newCode() {
  if (!window.confirm('Make a new invite code? The old code and link will stop working.')) return;
  try {
    await api.post(`/trips/${props.trip.id}/invite-code`);
    emit('notify', 'New invite code ready. The old one no longer works.');
    emit('changed');
  } catch (err) {
    emit('notify', errorMessage(err, 'Could not make a new code'));
  }
}

async function removeMember(m) {
  const isSelf = m.id === auth.user?.id;
  const confirmText = isSelf
    ? 'Leave this crew? You can be invited back later.'
    : m.status === 'pending'
      ? `Cancel the invite to ${m.name}?`
      : `Remove ${m.name} from the crew?`;
  if (!window.confirm(confirmText)) return;
  try {
    await api.delete(`/trips/${props.trip.id}/members/${m.id}`);
    emit('changed');
  } catch (err) {
    emit('notify', errorMessage(err));
  }
}
</script>

<template>
  <section class="crew" aria-label="Crew">
    <div class="crew-head">
      <div class="title">
        <h2 class="display display-sm">The crew</h2>
        <span class="hand count">{{ trip.members.length }} explorer{{ trip.members.length === 1 ? '' : 's' }}</span>
        <span class="live" :class="{ off: !isLive }" role="status">
          <span class="dot" aria-hidden="true" />{{ isLive ? 'Live' : 'Offline, syncing every 15s' }}
        </span>
      </div>

      <div class="invite-wrap">
        <button
          ref="inviteButton"
          type="button"
          class="invite-btn"
          :aria-expanded="inviteOpen"
          aria-controls="crew-invite"
          data-cy="invite-open"
          @click="toggleInvite"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="4" /><path d="M2 21c0-4 3-7 7-7s7 3 7 7" /><path d="M19 8v6M16 11h6" /></svg>
          Invite
        </button>

        <div v-if="inviteOpen" id="crew-invite" ref="popover" class="pop" role="dialog" aria-label="Invite to the crew">
          <p class="pop-label">Invite code</p>
          <div class="code-row">
            <code class="code" data-cy="invite-code">{{ trip.invite_code }}</code>
            <button v-if="isOwner" type="button" class="icon-btn" aria-label="Make a new invite code (the old one stops working)" title="New code" @click="newCode">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></svg>
            </button>
          </div>

          <div class="pop-actions">
            <button type="button" class="pill" @click="copy('code')">Copy code</button>
            <button type="button" class="pill" @click="copy('link')">Copy link</button>
            <button type="button" class="pill accent" :aria-expanded="showFriendForm" @click="showFriend">Invite a friend</button>
          </div>

          <input
            v-if="copyFailed"
            ref="fallbackInput"
            class="input fallback"
            readonly
            :value="copyFailed === 'code' ? trip.invite_code : inviteLink"
            :aria-label="`Invite ${copyFailed}: select and copy`"
            @click="$event.target.select()"
          />

          <form v-if="showFriendForm" class="friend" @submit.prevent="invite">
            <label class="sr-only" for="invite-user">Friend's username</label>
            <input id="invite-user" ref="usernameInput" v-model="username" class="input" placeholder="@username" autocomplete="off" autocapitalize="none" spellcheck="false" :disabled="sending" />
            <button type="submit" class="btn btn-dark btn-sm" :disabled="sending || !username.trim()">{{ sending ? 'Sending…' : 'Send' }}</button>
          </form>
        </div>
      </div>
    </div>

    <ul class="members">
      <li v-for="(m, i) in trip.members" :key="m.id" :class="{ pending: m.status === 'pending' }">
        <span class="avatar" :style="{ background: AVATAR_TINTS[i % AVATAR_TINTS.length] }" :class="{ online: viewerIds.includes(m.id) }" aria-hidden="true"><img v-if="avatarSrc(m)" :src="avatarSrc(m)" alt="" @error="brokenAvatars[avatarUrl(m)] = true" /><template v-else>{{ initials(m.name) }}</template></span>
        <span class="name">{{ m.name }}<template v-if="m.id === auth.user?.id"> (you)</template><template v-if="m.status === 'pending'"> · invited</template></span>
        <button v-if="m.id === auth.user?.id ? !isOwner : isOwner" type="button" class="btn btn-sm btn-ghost" :aria-label="m.id === auth.user?.id ? 'Leave crew' : `Remove ${m.name}`" @click="removeMember(m)">{{ m.id === auth.user?.id ? 'Leave' : (m.status === 'pending' ? 'Cancel' : 'Remove') }}</button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.crew { display: flex; flex-direction: column; gap: 12px; padding: 14px 20px 16px; border: 2px solid var(--ink); border-radius: var(--radius); background: var(--card); }

/* header: title · count · live on the left, Invite on the right */
.crew-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.title { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 12px; }
.title h2 { margin: 0; }
.count { font-size: 20px; color: #3e4a2a; }
.live { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #2e5a3c; }
.live .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--jungle); box-shadow: 0 0 0 3px rgba(46, 90, 60, 0.18); }
.live.off { color: var(--brick); }
.live.off .dot { background: var(--brick); box-shadow: none; }

/* the members, each on a little name tag so they stand out on the green */
.members { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 10px; }
.members li { display: flex; align-items: center; gap: 8px; padding: 4px 12px 4px 4px; border: 2px solid var(--ink); border-radius: 999px; background: #fbf6e9; box-shadow: 0 2px 0 rgba(42, 33, 23, 0.25); }
.members li.pending { border-style: dashed; background: rgba(251, 246, 233, 0.7); }
.members .btn { min-height: 30px; padding: 0 10px; }
.avatar { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 2px solid var(--ink); border-radius: 50%; font-size: 13px; font-weight: 800; overflow: hidden; }
.avatar img { display: block; width: 100%; height: 100%; object-fit: cover; }
.avatar.online { box-shadow: 0 0 0 3px var(--jungle), 0 0 0 5px var(--sage); }
.name { font-weight: 600; font-size: 15px; }

/* Invite button + pop-up */
.invite-wrap { position: relative; }
.invite-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 18px;
  border: 2px solid var(--ink);
  border-radius: 999px;
  background: var(--mustard);
  color: var(--ink);
  font: inherit;
  font-family: var(--font-round);
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
  box-shadow: 0 3px 0 var(--ink);
}
.invite-btn[aria-expanded='true'] { translate: 0 2px; box-shadow: 0 1px 0 var(--ink); }
.pop {
  position: absolute;
  z-index: 30;
  top: calc(100% + 10px);
  right: 0;
  width: min(340px, calc(100vw - 40px));
  padding: 14px;
  border: 2px solid var(--ink);
  border-radius: 14px;
  background: var(--card);
  box-shadow: var(--shadow);
  animation: pop-in 0.16s ease-out;
}
.pop::before {
  /* the little point up to the Invite button */
  content: '';
  position: absolute;
  top: -9px;
  right: 34px;
  width: 14px;
  height: 14px;
  background: var(--card);
  border-left: 2px solid var(--ink);
  border-top: 2px solid var(--ink);
  rotate: 45deg;
}
@keyframes pop-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: none; }
}
.pop-label { margin: 0 0 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft); }
.code-row { display: flex; align-items: center; gap: 8px; }
.code { flex: 1; padding: 8px 12px; border: 2px dashed var(--ink); border-radius: 8px; background: #fffdf6; font-family: 'Courier New', monospace; font-weight: 700; font-size: 20px; letter-spacing: 3px; text-align: center; }
.icon-btn { display: inline-grid; place-items: center; width: 40px; height: 40px; border: 2px solid var(--ink); border-radius: 50%; background: var(--card); color: var(--ink); cursor: pointer; }
.pop-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.pill {
  flex: 1 1 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 0 12px;
  border: 2px solid var(--ink);
  border-radius: 999px;
  background: #fbf6e9;
  color: var(--ink);
  font: inherit;
  font-family: var(--font-round);
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 2px 0 var(--ink);
}
.pill.accent { background: #4f6b34; color: #fbf6e9; }
.pill[aria-expanded='true'] { translate: 0 1px; box-shadow: 0 1px 0 var(--ink); }
.fallback { width: 100%; margin-top: 10px; }
.friend { display: flex; gap: 8px; margin-top: 10px; animation: pop-in 0.16s ease-out; }
.friend .input { flex: 1; min-width: 0; }
.invite-btn:focus-visible,
.pill:focus-visible,
.icon-btn:focus-visible { outline: 3px solid var(--ember); outline-offset: 2px; }

@media (max-width: 560px) {
  .pop { right: auto; left: 0; width: min(340px, calc(100vw - 72px)); }
  .pop::before { right: auto; left: 30px; }
}
@media (prefers-reduced-motion: reduce) {
  .pop, .friend { animation: none; }
}
</style>