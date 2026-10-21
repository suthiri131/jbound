<script setup>
import { ref, computed, watch, onBeforeUnmount } from "vue";
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

let isLive;
const route = useRoute();
const router = useRouter();
const trips = useTripsStore();

const tripId = computed(() => route.params.tripId || null);
const trip = ref(null);
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
({isLive} =useTripRealtime(tripId, ["itinerary_items"], refreshSoon));

watch(
  tripId,
  async () => {
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
    `${trip.value.name} is now a drawer in the attic.`,
    "/archives",
    "Open the Archives",
  );
  router.replace("/planner");
}

const canMemories = computed(() =>
  ["on_the_road", "memory_box"].includes(trip.value?.phase),
);
</script>

<template>
  <main class="container page planner">
    <p v-if="loading" class="muted" role="status">Opening your trip…</p>
    <div v-else-if="loadError" class="card-flat card-pad" role="alert">
      <h1 class="display display-sm">This trip is unavailable</h1>
      <p class="error-text">{{ loadError }}</p>
      <button type="button" class="btn btn-dark btn-sm" @click="refresh">Try again</button>
    </div>

    <template v-if="trip">
      <div v-if="trip.phase === 'archived'" class="card-flat card-pad archived">
        <strong>This trip is in the Archives.</strong>
        <RouterLink to="/archives">Open its drawer in the attic →</RouterLink>
      </div>
      <p class="row" style="gap: 6px; font-size: 12px" :class="isLive ? 'muted' : 'error-text'">
  <span :style="{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: isLive ? 'var(--jungle)' : 'var(--brick)' }" aria-hidden="true"></span>
  {{ isLive ? 'Live' : 'Offline — syncing every 15s' }}
</p>

      <CrewBar :trip="trip" @changed="loadTrip" />

      <div class="split">
        <BucketList
          :trip="trip"
          :legs="feas?.legs || {}"
          class="left"
          @changed="refresh"
          @error="notify"
          @edit="editing = true"
          @delete="requestDelete"
        />

        <div class="right">
          <MemoryBox
            v-if="rightTab === 'memories' && canMemories"
            :trip="trip"
            @show-map="rightTab = 'map'"
            @archived="onArchived"
            @error="notify"
          />
          <RouteMap v-else :trip="trip" :version="mapVersion">
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

    <CampChat v-if="trip" :key="trip.id" :trip-id="trip.id" />
  </main>
</template>

<style scoped>
.planner {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 22px;
}

.empty {
  text-align: center;
}
.empty .lead {
  margin-left: auto;
  margin-right: auto;
}
.archived {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  background: var(--paper-deep);
}
/* Itinerary : map = 2 : 3, equal heights */
.split {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 24px;
}
.left {
  flex: 2 1 0;
  min-width: min(360px, 100%);
}
.right {
  flex: 3 1 0;
  min-width: min(440px, 100%);
  display: flex;
  flex-direction: column;
}
.right > * {
  flex: 1;
}
</style>
