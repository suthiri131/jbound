<script setup>
import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, errorMessage } from "@/lib/api";
import { useTripsStore } from "@/stores/trips";
import { useTripRealtime } from "@/composables/useTripRealtime";
import SatchelBar from "@/components/planner/SatchelBar.vue";
import CrewBar from "@/components/planner/CrewBar.vue";
import BucketList from "@/components/planner/BucketList.vue";
import FeasibilityCard from "@/components/planner/FeasibilityCard.vue";
import RouteMap from "@/components/planner/RouteMap.vue";
import MemoryBox from "@/components/planner/MemoryBox.vue";
import ToastMessage from "@/components/common/ToastMessage.vue";

const route = useRoute();
const router = useRouter();
const trips = useTripsStore();

const tripId = computed(() => route.params.tripId || null);
const trip = ref(null);
const feas = ref(null);
const feasLoading = ref(false);
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
  feasLoading.value = true;
  try {
    const { data } = await api.get(`/trips/${tripId.value}/feasibility`);
    feas.value = data;
  } catch {
    feas.value = null;
  } finally {
    feasLoading.value = false;
  }
}

async function refresh() {
  await Promise.all([loadTrip(), loadFeas()]);
  mapVersion.value++;
}

// Debounced so a burst of Realtime events (e.g. a reorder) triggers one reload
let t;
function refreshSoon() {
  clearTimeout(t);
  t = setTimeout(refresh, 300);
}
useTripRealtime(tripId, ["itinerary_items"], refreshSoon);

/** Pick the trip to show, handle ?join= links, then load. */
watch(
  () => route.fullPath,
  async () => {
    await trips.fetch().catch(() => {});
    if (route.query.join) {
      try {
        const joined = await trips.join(String(route.query.join));
        return router.replace(`/planner/${joined.id}`);
      } catch (err) {
        notify(errorMessage(err));
      }
    }
    if (!tripId.value) {
      const def = trips.defaultTrip;
      if (def && !route.query.new) return router.replace(`/planner/${def.id}`);
      trip.value = null;
      return;
    }
    if (trip.value?.id !== tripId.value) {
      trip.value = null;
      feas.value = null;
    }
    await refresh();
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

async function applyFix({ itemId, time }) {
  try {
    await api.patch(`/trips/${tripId.value}/itinerary/${itemId}`, { time });
    await refresh();
  } catch (err) {
    notify(errorMessage(err));
  }
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
    <div class="row crumbs">
      <span class="eyebrow muted">Planner</span>
    </div>

    <SatchelBar
      :current-id="tripId || ''"
      :start-open="Boolean(route.query.new)"
    />

    <p v-if="loadError" class="error-text card-flat card-pad" role="alert">
      {{ loadError }}
    </p>

    <section
      v-if="!tripId && !trips.loading && !trips.trips.length"
      class="card card-pad empty"
    >
      <h1 class="display display-md">Your satchel is empty</h1>
      <p class="lead">
        Pack a new trip above, or paste an invite code from a friend to join
        their crew.
      </p>
    </section>

    <template v-if="trip">
      <div v-if="trip.phase === 'archived'" class="card-flat card-pad archived">
        <strong>This trip is in the Archives.</strong>
        <RouterLink to="/archives">Open its drawer in the attic →</RouterLink>
      </div>

      <CrewBar :trip="trip" @changed="loadTrip" />

      <div class="split">
        <BucketList
          :trip="trip"
          :legs="feas?.legs || {}"
          class="left"
          @changed="refresh"
          @error="notify"
        >
          <template #feasibility>
            <FeasibilityCard
              v-if="trip.phase === 'planning' || trip.phase === 'on_the_road'"
              :report="feas"
              :loading="feasLoading"
              @fix="applyFix"
            />
          </template>
        </BucketList>

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

    <ToastMessage v-bind="toast" @close="toast.message = ''" />
  </main>
</template>

<style scoped>
.planner {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 22px;
}
.crumbs {
  align-items: baseline;
  gap: 6px 14px;
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
