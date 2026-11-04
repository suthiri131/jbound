<script setup>
/** The camp's post: trip invites arrive as airmail, and the reminders to add photos as taped-up notes. */
import { ref, onMounted } from 'vue';
import { api, errorMessage } from '@/lib/api';
import { showAlert } from '@/lib/dialog';
import { useNotificationsStore } from '@/stores/notifications';
import { useTripsStore } from '@/stores/trips';
import WanderingEyes from '@/components/common/WanderingEyes.vue';

defineProps({
  headingTag: { type: String, default: 'h2' },
});
const emit = defineEmits(['navigate']);
const notifications = useNotificationsStore();
const tripsStore = useTripsStore();
const loading = ref(true);
const loadError = ref('');
const invites = ref([]);
const reminders = ref([]);

function dateLabel(date) {
  const d = new Date(`${date}T00:00:00`);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function loadReminders() {
  const { data } = await api.get('/trips/memory-reminders');
  reminders.value = data;
  notifications.setReminders(data);
}

async function load() {
  loading.value = true;
  loadError.value = '';
  // separately, so a problem with one still leaves the other on show
  const [invited, reminded] = await Promise.allSettled([api.get('/trips/invites'), loadReminders()]);
  if (invited.status === 'fulfilled') {
    invites.value = invited.value.data;
    notifications.inviteCount = invited.value.data.length;
  }
  const failed = [invited, reminded].find((result) => result.status === 'rejected');
  if (failed) loadError.value = errorMessage(failed.reason);
  loading.value = false;
}

async function respond(tripId, action) {
  try {
    await tripsStore.respondToInvite(tripId, action);
    invites.value = invites.value.filter((t) => t.id !== tripId);
    notifications.inviteCount = invites.value.length;
    if (action === 'accept') await loadReminders(); // the trip may already have ended
  } catch (err) {
    showAlert(errorMessage(err));
  }
}

onMounted(load);
</script>

<template>
  <div class="post">
    <header class="post-head">
      <div>
        <p class="kicker">Notifications</p>
        <component :is="headingTag" class="post-title">Camp post</component>
      </div>
      <slot name="actions" />
    </header>

    <p v-if="loadError" class="error-text problem" role="alert">{{ loadError }}</p>
    <WanderingEyes v-if="loading" class="sorting" center text="Checking for news…" />

    <section v-if="invites.length" class="pile" aria-labelledby="post-invites">
      <h3 id="post-invites" class="pile-label">Invites</h3>
      <ul class="pile-list">
        <li v-for="t in invites" :key="t.id" class="envelope">
          <div class="letter">
            <span class="stamp" aria-hidden="true">
              <svg viewBox="0 0 40 44" width="40" height="44">
                <path d="M0 44V0h40v44z" fill="#cfe0d9" />
                <circle cx="29" cy="11" r="5" fill="#e0a43b" />
                <path d="M0 37c8-6 28-6 40 0v7H0z" fill="#6f9a52" />
                <path d="M20 13 7 36h26z" fill="#b4471f" stroke="#2a2117" stroke-width="1.6" stroke-linejoin="round" />
                <path d="M20 22l-5 14h10z" fill="#2a2117" />
              </svg>
            </span>
            <p class="invited">You're invited to</p>
            <p class="trip-name">{{ t.name }}</p>
            <div class="actions">
              <button type="button" class="btn btn-sm btn-primary" @click="respond(t.id, 'accept')">Accept</button>
              <button type="button" class="btn btn-sm btn-ghost" @click="respond(t.id, 'decline')">Decline</button>
            </div>
          </div>
        </li>
      </ul>
    </section>

    <section v-if="reminders.length" class="pile" aria-labelledby="post-reminders">
      <h3 id="post-reminders" class="pile-label">Photos for the archive</h3>
      <ul class="pile-list">
        <li
          v-for="r in reminders"
          :key="r.id"
          class="note"
          :class="{ urgent: r.daysLeft <= 2 }"
          data-cy="memory-reminder"
        >
          <i class="tape" aria-hidden="true" />
          <span v-if="r.daysLeft" class="postmark" aria-hidden="true">
            <b>{{ r.daysLeft }}</b>
            <small>{{ r.daysLeft === 1 ? 'day' : 'days' }} left</small>
          </span>
          <p class="note-text">{{ r.text }}</p>
          <p class="note-date">{{ dateLabel(r.date) }}</p>
          <RouterLink :to="`/planner/${r.tripId}`" class="btn btn-sm btn-mustard add" @click="emit('navigate')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            Add photos
          </RouterLink>
        </li>
      </ul>
    </section>

    <section v-if="!loading && !loadError && !invites.length && !reminders.length" class="empty">
      <svg viewBox="0 0 120 110" width="120" height="110" aria-hidden="true">
        <path d="M54 60h12v46H54z" fill="#7a4a29" stroke="#2a2117" stroke-width="3" />
        <path d="M22 62V38a18 18 0 0 1 36 0v24z" fill="#8a4a33" stroke="#2a2117" stroke-width="3" stroke-linejoin="round" />
        <path d="M40 20h44a18 18 0 0 1 18 18v24H58V38a18 18 0 0 0-18-18z" fill="#b4623f" stroke="#2a2117" stroke-width="3" stroke-linejoin="round" />
        <path d="M84 44V58" stroke="#2a2117" stroke-width="3" stroke-linecap="round" />
        <path d="M84 58h13v-8H84z" fill="#b4471f" stroke="#2a2117" stroke-width="2.4" stroke-linejoin="round" />
      </svg>
      <p class="hand empty-title">No post today</p>
      <p class="empty-text">Trip invites and photo reminders will land here.</p>
    </section>
  </div>
</template>

<style scoped>
.post-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 3px double rgba(42, 33, 23, 0.55);
}
.kicker {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
.post-title {
  margin: 0;
  font-family: var(--font-story);
  font-weight: 800;
  font-size: 34px;
  line-height: 1.1;
}
.sorting {
  margin-top: 20px;
}
.problem {
  margin: 16px 0 0;
  padding: 12px 14px;
  border: 2px solid var(--ink);
  border-radius: 4px;
  background: var(--card);
}

.pile {
  margin-top: 22px;
}
.pile-label {
  margin: 0 0 10px;
  font-family: var(--font-hand);
  font-weight: 700;
  font-size: 25px;
  line-height: 1.1;
}
.pile-list {
  display: grid;
  gap: 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* ---------- an invite: an airmail envelope ---------- */
.envelope {
  padding: 7px;
  overflow-wrap: anywhere;
  background: repeating-linear-gradient(-45deg, #b4471f 0 11px, #fbf6e9 11px 20px, #1f4e5a 20px 31px, #fbf6e9 31px 40px);
  border: 2px solid var(--ink);
  border-radius: 3px;
  box-shadow: 2px 4px 0 rgba(42, 33, 23, 0.55);
}
.envelope:nth-child(even) {
  rotate: 0.5deg;
}
.envelope:nth-child(odd) {
  rotate: -0.4deg;
}
.letter {
  display: flow-root;
  padding: 12px 14px 14px;
  background: var(--card);
}
.stamp {
  float: right;
  margin: 0 0 6px 12px;
  padding: 3px;
  background: var(--card);
  border: 3px dotted #d9bd8b;
  rotate: 4deg;
  line-height: 0;
}
.invited {
  margin: 0;
  font-family: var(--font-hand);
  font-size: 22px;
  line-height: 1.1;
}
.trip-name {
  margin: 2px 0 0;
  font-family: var(--font-story);
  font-weight: 800;
  font-size: 22px;
  line-height: 1.15;
}
.actions {
  clear: both;
  display: flex;
  gap: 8px;
  padding-top: 12px;
}

/* ---------- a reminder: a note taped up, postmarked with the days left ---------- */
.note {
  position: relative;
  overflow-wrap: anywhere;
  padding: 18px 16px 14px;
  background: #fffdf4;
  box-shadow: 2px 5px 8px rgba(60, 35, 10, 0.35);
}
.note:first-child {
  margin-top: 8px; /* room for the tape under the heading */
}
.note.urgent {
  background: #fbe9c6;
}
.tape {
  position: absolute;
  top: -9px;
  left: 50%;
  width: 76px;
  height: 20px;
  margin-left: -38px;
  background: rgba(224, 164, 59, 0.6);
  rotate: -2deg;
}
.postmark {
  float: right;
  display: grid;
  place-content: center;
  justify-items: center;
  width: 70px;
  height: 70px;
  margin: 0 0 6px 12px;
  border: 2px solid var(--teal);
  outline: 1px solid var(--teal);
  outline-offset: 2px;
  border-radius: 50%;
  color: var(--teal);
  rotate: -9deg;
}
.urgent .postmark {
  border-color: var(--ember);
  outline-color: var(--ember);
  color: var(--ember);
}
.postmark b {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 25px;
  line-height: 1;
}
.postmark small {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.02em;
  line-height: 1.3;
  text-transform: uppercase;
}
.note-text {
  margin: 0;
  font-size: 15px;
  line-height: 1.4;
}
.note-date {
  margin: 6px 0 0;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-mute);
}
.add {
  clear: both;
  margin-top: 12px;
}

/* ---------- nothing in the box ---------- */
.empty {
  display: grid;
  justify-items: center;
  margin-top: 40px;
  text-align: center;
}
.empty-title {
  margin: 6px 0 0;
  font-weight: 700;
  font-size: 30px;
}
.empty-text {
  margin: 2px 0 0;
  font-size: 14px;
  color: var(--ink-soft);
}
</style>
