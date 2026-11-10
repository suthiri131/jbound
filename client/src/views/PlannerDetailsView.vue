<script setup>
import BackLabel from "@/components/common/BackLabel.vue";
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, errorMessage } from "@/lib/api";
import { useTripsStore } from "@/stores/trips";
import { useTripRealtime } from "@/composables/useTripRealtime";
import CrewBar from "@/components/planner/CrewBar.vue";
import BucketList from "@/components/planner/BucketList.vue";
import RouteMap from "@/components/planner/RouteMap.vue";
import MemoryBox from "@/components/planner/MemoryBox.vue";
import ToastMessage from "@/components/common/ToastMessage.vue";
import TripModal from "@/components/planner/TripModal.vue";
import DeleteTripModal from "@/components/planner/DeleteTripModal.vue";
import CampChat from "@/components/planner/CampChat.vue";
import { useCampSky } from "@/composables/useCampSky";
import WanderingEyes from '@/components/common/WanderingEyes.vue';

let isLive;
const route = useRoute();
const router = useRouter();
const trips = useTripsStore();

const tripId = computed(() => route.params.tripId || null);
const crewNotice = ref("");
const { isNight } = useCampSky({ weather: false });
const chatOpen = ref(false);
const chatLauncher = ref(null);
const chatPanel = ref(null);
async function toggleChat() {
  chatOpen.value = !chatOpen.value;
  await nextTick();
  if (chatOpen.value) chatPanel.value?.querySelector('input')?.focus();
  else chatLauncher.value?.focus();
}
watch(tripId, () => { chatOpen.value = false; });
function dismissChatOutside(event) {
  if (chatOpen.value && !chatPanel.value?.contains(event.target) && !chatLauncher.value?.contains(event.target)) {
    chatOpen.value = false;
  }
}
onMounted(() => document.addEventListener('pointerdown', dismissChatOutside));
onBeforeUnmount(() => document.removeEventListener('pointerdown', dismissChatOutside));
watch(tripId, () => { crewNotice.value = ""; });
const trip = ref(null);
const activeStopId = ref(null);
const loading = ref(true);
const editing = ref(false);
const deleting = ref(false);
const deleteTarget = ref(null);
const deleteError = ref("");

function requestDelete() {
  if (!trip.value || trip.value.myRole !== "owner") return;
  deleteError.value = "";
  deleteTarget.value = trip.value;
}

async function deleteTrip() {
  if (
    deleting.value ||
    !deleteTarget.value ||
    deleteTarget.value.myRole !== "owner"
  )
    return;
  const target = deleteTarget.value;
  deleteError.value = "";
  deleting.value = true;
  try {
    await trips.remove(target.id);
    deleteTarget.value = null;
    trip.value = null;
    feas.value = null;
    await router.replace("/planner");
    notify("Trip deleted");
  } catch (err) {
    deleteError.value = errorMessage(err, "Could not delete this trip");
  } finally {
    deleting.value = false;
  }
}

function closeEdit() {
  editing.value = false;
}

async function onTripSaved() {
  editing.value = false;
  await refresh();
  try {
    await trips.fetch(true);
    notify("Trip updated");
  } catch (err) {
    notify(`Trip saved. ${errorMessage(err, "Could not refresh your trips")}`);
  }
}
const feas = ref(null);
const loadError = ref("");
const mapVersion = ref(0);
const rightTab = ref("map"); // 'map' | 'memories'
const showPrompt = ref(false);
const toast = ref({ message: "", linkTo: "", linkLabel: "" });

const notify = (message, linkTo = "", linkLabel = "") =>
  (toast.value = { message, linkTo, linkLabel });
const promptKey = (id) => `jbound:welcome:${id}`;
const promptSeen = (id) => {
  try {
    return Boolean(sessionStorage.getItem(promptKey(id)));
  } catch {
    return false;
  }
};

async function loadTrip() {
  if (!tripId.value) return;
  try {
    const { data } = await api.get(`/trips/${tripId.value}`);
    const isNewTrip = trip.value?.id !== data.id;
    if (isNewTrip) {
      // Pick the right-hand panel before first render so the map doesn't flash
      rightTab.value = data.phase === "memory_box" ? "memories" : "map";
      showPrompt.value = data.phase === "memory_box" && !promptSeen(data.id);
    }
    trip.value = data;
    loadError.value = "";
  } catch (err) {
    loadError.value = errorMessage(err, "Could not open this trip");
    trip.value = null;
  }
}

async function loadFeas() {
  if (!tripId.value) return;
  try {
    const { data } = await api.get(`/trips/${tripId.value}/feasibility`);
    feas.value = data;
  } catch {
    feas.value = null;
  }
}

async function refresh() {
  await Promise.all([loadTrip(), loadFeas()]);
  mapVersion.value++;
}

// Debounced so a burst of Realtime events (e.g. a reorder) triggers one reload
let t;
onBeforeUnmount(() => clearTimeout(t));
function refreshSoon() {
  clearTimeout(t);
  t = setTimeout(refresh, 300);
} 
// Our own ticks come back as realtime events too: skip the full reload (route + timings) for those
const ownTicks = new Map(); // itemId -> ignore until (ms)
function ignoreOwnTick(id) {
  ownTicks.set(String(id), Date.now() + 4000);
}
({ isLive } = useTripRealtime(tripId, ["itinerary_items"], (_table, payload) => {
  const id = payload?.new?.id != null ? String(payload.new.id) : null;
  if (id && (ownTicks.get(id) || 0) > Date.now()) {
    ownTicks.delete(id);
    return;
  }
  refreshSoon();
}));
// Joins, invites, leaves and removals are posted as "...the crew" system messages. trip_members is not in
// the realtime publication, so listen for those messages to keep everyone's crew list live.
let crewTimer;
onBeforeUnmount(() => clearTimeout(crewTimer));
function reloadCrewSoon() {
  clearTimeout(crewTimer);
  crewTimer = setTimeout(loadTrip, 300);
}
useTripRealtime(tripId, ["messages"], (_table, payload) => {
  // no payload = the polling fallback, which just reloads
  // those four messages all end with "the crew"; anchoring avoids matching a stop or trip named "...Crew..."
  if (!payload || /\bthe crew$/i.test(payload.new?.text || "")) reloadCrewSoon();
});

watch(
  tripId,
  async () => {
    // "You joined …" / "… is packed!" from the trips list or a ?join= link
    const notice = window.history.state?.notice;
    if (notice) {
      notify(notice);
      window.history.replaceState({ ...window.history.state, notice: undefined }, "");
    }
    activeStopId.value = null;
    loading.value = true;
    trip.value = null;
    feas.value = null;
    loadError.value = "";
    try {
      await refresh();
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

function dismissPrompt() {
  try {
    sessionStorage.setItem(promptKey(trip.value.id), "1");
  } catch {
    /* private mode */
  }
  showPrompt.value = false;
}
function startMemories() {
  dismissPrompt();
  rightTab.value = "memories";
}

async function onArchived() {
  await trips.fetch(true);
  notify(
    `${trip.value.name} is now a drawer in the archive tent.`,
    "/archives",
    "Open the Archives",
  );
  router.replace("/planner");
}

async function onLeft() {
  const name = trip.value?.name;
  trip.value = null;
  feas.value = null;
  await trips.fetch(true);
  await router.replace("/planner");
  notify(name ? `You left ${name}` : "You left the trip");
}

const canMemories = computed(() =>
  ["on_the_road", "memory_box"].includes(trip.value?.phase),
);
</script>

<template>
  <main class="planner" :class="{ night: isNight }"> 
    <RouterLink to="/planner" class="camp-back back" aria-label="Back to Planner"><BackLabel /></RouterLink>
    <WanderingEyes v-if="loading" center :size="96" text="Opening your trip…" />
    <div v-else-if="loadError" class="card-flat card-pad" role="alert">
      <h1 class="display display-sm">This trip is unavailable</h1>
      <p class="error-text">{{ loadError }}</p>
      <button type="button" class="btn btn-dark btn-sm" @click="refresh">Try again</button>
    </div>

    <template v-if="trip">
      <div v-if="trip.phase === 'archived'" class="card-flat card-pad archived">
        <strong>This trip is in the Archives.</strong>
        <RouterLink to="/archives">Open its drawer in the tent →</RouterLink>
      </div>

      <CrewBar :trip="trip" :is-live="isLive" @changed="loadTrip" @left="onLeft" @joined="notify" @notify="notify" />

      <div class="split">
        <div class="map-column">
          <div class="paper-map">
            <i class="tape" aria-hidden="true" />
            <MemoryBox
              v-if="rightTab === 'memories' && canMemories"
              :trip="trip"
              @show-map="rightTab = 'map'"
              @archived="onArchived"
              @error="notify"
            />
            <RouteMap
              v-else
              :trip="trip"
              :version="mapVersion"
              :active-stop-id="activeStopId"
              @select-stop="activeStopId = $event"
            >
              <template #actions>
                <button
                  v-if="canMemories"
                  type="button"
                  class="btn btn-teal btn-sm"
                  @click="rightTab = 'memories'"
                >
                  {{
                    trip.phase === "memory_box"
                      ? "Back to memory box"
                      : "Memory box"
                  }}
                </button>
              </template>
            </RouteMap>
          </div>
        </div>

        <BucketList
          :trip="trip"
          :legs="feas?.legs || {}"
          :active-stop-id="activeStopId"
          class="left"
          @changed="refresh"
          @ticked="ignoreOwnTick"
          @error="notify"
          @select-stop="activeStopId = $event"          @edit="editing = true"
          @delete="requestDelete"
        />
      </div>
    </template>

    <TripModal
      v-if="editing && trip"
      :key="trip.id"
      :trip="trip"
      @close="closeEdit"
      @saved="onTripSaved"
    />
    <DeleteTripModal
      v-if="deleteTarget"
      :trip="deleteTarget"
      :busy="deleting"
      :error="deleteError"
      @close="deleteTarget = null"
      @confirm="deleteTrip"
    />
    <ToastMessage v-bind="toast" @close="toast.message = ''" />

    <aside v-if="trip" class="floating-chat" aria-label="Crew chat">
      <div v-show="chatOpen" id="camp-chat-panel" ref="chatPanel" class="chat-panel" @keydown.esc.stop="toggleChat">
        <button type="button" class="chat-close" aria-label="Close Camp chat" @click="toggleChat">×</button>
        <CampChat :key="trip.id" :trip-id="trip.id" />
      </div>
      <button v-show="!chatOpen" ref="chatLauncher" type="button" class="btn btn-mustard chat-launcher" :aria-expanded="chatOpen" aria-label="Open Camp chat" title="Chat with your crew" aria-controls="camp-chat-panel" @click="toggleChat">
        <span class="chat-launcher-inner">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-3 2 2-6a8.5 8.5 0 1 1 18-4.5Z" />
            <path d="M7 10h8M7 14h5" />
          </svg>
          <span class="chat-launcher-text">Chat</span>
        </span>
      </button>
    </aside>

  </main>
</template>

<style scoped>
/* A wooden expedition table. The components keep their logic; this page dresses them as paper. */
.planner {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px clamp(14px, 2.4vw, 34px) 34px;
  font-family: var(--font-round);
  /* by day a light oak table, by night (see .night below) the dark wood */
  background: repeating-linear-gradient(90deg, #f3e3bd 0 150px, #e3cc9a 150px 152px, #efdcb0 152px 300px, #e3cc9a 300px 302px);
  box-shadow: inset 0 0 80px rgba(120, 80, 30, 0.16);
}
.planner.night {
  background: repeating-linear-gradient(90deg, #7a4d2c 0 150px, #6c4326 150px 153px, #744829 153px 300px, #6c4326 300px 303px);
  box-shadow: inset 0 0 90px rgba(40, 20, 5, 0.55);
}.back {
  flex: none;
}
.planner > .muted,
.planner > .hand {
  color: #5a3a22;
}
.planner.night > .muted,
.planner.night > .hand {
  color: #fbf1dc;
}.archived {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  background: var(--paper-deep);
}

/* the crew: a sage-green luggage label, so the people stand out from the beige map and day plan */
.planner :deep(.crew) {
  border: 0;
  border-radius: 8px;
  background: #d5e1bd;
  box-shadow: 0 6px 12px rgba(40, 20, 5, 0.4);
}
.planner :deep(.crew h2),
.planner :deep(.bucket h1),
.planner :deep(.bucket h2),
.planner :deep(.map-card h2) {
  font-family: var(--font-story);
  font-weight: 800;
}

.planner :deep(.bucket h1) { font-size: clamp(26px, 2.2vw, 34px); line-height: 1.2; }

/* Map : day plan = 3 : 2 */
.split {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 22px;
}
.map-column {
  flex: 3 1 0;
  min-width: min(440px, 100%);
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.paper-map {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: #f1dfb6;
  box-shadow: 0 10px 22px rgba(40, 20, 5, 0.45), inset 0 0 50px rgba(120, 85, 40, 0.28);
  border-radius: 3px;
}
.paper-map > :not(.tape) {
  flex: 1;
}
.tape {
  position: absolute;
  z-index: 3;
  top: -11px;
  left: 50%;
  width: 110px;
  height: 26px;
  margin-left: -55px;
  rotate: -2deg;
  background: rgba(224, 182, 96, 0.8);
}
.paper-map :deep(.map-card) {
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  overflow: visible;
}
.paper-map :deep(.bar) {
  padding: 4px 4px 12px;
  background: transparent;
  border-bottom: 0;
}
.paper-map :deep(.map-wrap) {
  border: 2.5px solid #4a3a24;
  border-radius: 4px;
  overflow: hidden;
}
.paper-map :deep(.legend) {
  margin-top: 12px;
  background: transparent;
  border-top: 2px dashed #8a6a3a;
}
.paper-map :deep(.itinerary-stop.selected) {
  background: rgba(255, 253, 247, 0.6);
}
.paper-map :deep(.leg-badge),
.paper-map :deep(.timing-badge span) {
  background: #fff8e6;
}

/* the day plan: a page torn from a lined notebook, taped down */
.planner :deep(.bucket) {
  flex: 2 1 0;
  min-width: min(360px, 100%);
  border: 0;
  border-radius: 2px;
  background: repeating-linear-gradient(#fffdf7 0 33px, #d5e4ee 33px 34.5px);
  box-shadow: 0 10px 22px rgba(40, 20, 5, 0.45);
}
.planner :deep(.bucket::before) {
  content: '';
  position: absolute;
  z-index: 3;
  top: -12px;
  left: 44%;
  width: 96px;
  height: 26px;
  rotate: 2deg;
  background: rgba(224, 182, 96, 0.8);
}
.planner :deep(.bucket .progress) {
  background: #fffaf0;
  border-color: #c7ad78;
}
.planner :deep(.bucket .stop) {
  background: transparent;
  border-bottom-color: transparent;
}
.planner :deep(.bucket .stop.selected) {
  background: rgba(245, 191, 79, 0.28);
  box-shadow: inset 4px 0 #c2412d;
}
.planner :deep(.bucket .stop-title) {
  font-family: var(--font-hand);
  font-size: 25px;
  line-height: 1.05;
}
.planner :deep(.bucket .time) {
  border-style: dashed;
  background: #fffdf7;
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 13px;
}
.planner :deep(.bucket .tick) {
  background: #fffdf7;
}
.planner :deep(.bucket .day-head) {
  background: #fffdf7;
}
/* adding a stop: the kraft backpack pocket at the bottom of the page */
.planner :deep(.bucket .scribble) {
  background: #e7c48e;
  border-color: #4a2c1a;
  box-shadow: 0 5px 0 #4a2c1a;
}
.planner :deep(.bucket .location-field) {
  background: #fff8e6;
}

/* Chat stays accessible independently of the route and itinerary length. */
.floating-chat { position: fixed; right: 24px; bottom: 24px; z-index: 80; display: flex; flex-direction: column; align-items: flex-end; gap: 12px; max-width: calc(100vw - 32px); }
.chat-panel { position: relative; width: min(480px, calc(100vw - 32px)); }
.chat-launcher {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: auto;
  min-width: 112px;
  height: 52px;
  padding: 0 18px;
  border-radius: 999px;
}
.chat-launcher-inner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.chat-launcher svg {
  width: 22px;
  height: 22px;
  flex: none;
}
.chat-launcher-text {
  font-size: 0.96rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.chat-close { position: absolute; top: 10px; right: 12px; z-index: 1; width: 32px; height: 32px; border: 0; border-radius: 6px; background: transparent; color: var(--paper); font-size: 26px; cursor: pointer; }
.chat-panel :deep(.chat) { display: flex; flex-direction: column; max-height: min(560px, calc(100dvh - 120px)); }
.chat-panel :deep(.head) { flex: none; padding-right: 48px; flex-wrap: wrap; }
.chat-panel :deep(.hint) { flex-basis: 100%; margin-left: 0; }
.chat-panel :deep(.log) { flex: 1; min-height: 100px; max-height: 340px; overflow-wrap: anywhere; }
.chat-panel :deep(.compose) { flex: none; }
@media (max-width: 600px) {
  .floating-chat { right: 16px; bottom: 16px; }
  .chat-launcher {
    min-width: 98px;
    height: 48px;
    padding: 0 14px;
  }
  .chat-launcher-text {
    font-size: 0.9rem;
  }
}
/* camp chat: the leather notebook */
.planner :deep(.chat) {
  background: #3f2616;
  border-color: #2a1810;
  box-shadow: 0 8px 18px rgba(40, 20, 5, 0.45);
}

@media (max-width: 600px) {
  .tape {
    display: none;
  }
}
</style>
