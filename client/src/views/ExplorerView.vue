<script setup>
// CHANGES FOR EXPLORER: this page was reworked (vibe board intro, search + filters at the top right,
// multi-vibe category chips, pages). The pin modal and the place cards are the same as before.
/**
 * Explorer
 * 1. Opens on the vibe board (components/explorer/VibeBoard.vue): pick flyers → "Let's Explore!"
 * 2. Then the feed: "JBound's recommendations for you" for the picked vibes.
 *
 * GET /api/places/google/search?vibes=eating,cozy&q=&checkpoint=&maxDistanceKm=&maxPrice=&hiddenGem=
 *
 * The URL keeps the feed state (?vibes=eating,cozy or ?q=laksa), so Back from a place page returns
 * straight to the feed instead of the board.
 * ?pinTo=<tripId> preselects the trip in the pin modal (from Planner "+ Add from Explorer").
 * ?pin=<googlePlaceId> opens the pin modal for that place (from the place page).
 */
import { ref, reactive, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, errorMessage, assetUrl } from "@/lib/api";
import { useTripsStore } from "@/stores/trips";
import { useAuthStore } from "@/stores/auth";
import { VIBES, VIBE_LABEL, VIBE_TINT } from "@/utils/constants";
import { dayLabel } from "@/utils/format";
import VibeIcon from "@/components/common/VibeIcon.vue";
import ToastMessage from "@/components/common/ToastMessage.vue";
import Pagination from "@/components/common/Pagination.vue";
import VibeBoard from "@/components/explorer/VibeBoard.vue";
import FilterMenu from "@/components/explorer/FilterMenu.vue";

const route = useRoute();
const router = useRouter();
const trips = useTripsStore();
const auth = useAuthStore();

const VIBE_IDS = VIBES.map((v) => v.id);
const PAGE_SIZE = 12;
const DEFAULT_FILTERS = {
  checkpoint: "woodlands",
  maxDistanceKm: 40,
  maxPrice: "",
  hiddenGem: false,
};

// ---------- state ----------
const vibesFromUrl = () =>
  String(route.query.vibes || "")
    .split(",")
    .filter((v) => VIBE_IDS.includes(v));

/** 'board' = vibe board intro, 'feed' = results */
const stage = ref(
  route.query.vibes !== undefined || route.query.q ? "feed" : "board",
);
const boardVisits = ref(0); // the doors only play on the first visit
const vibes = ref(vibesFromUrl());
const q = ref(String(route.query.q || ""));
const filters = ref({ ...DEFAULT_FILTERS });

const places = ref([]);
const loading = ref(false);
const error = ref("");
const page = ref(1);
const poofIn = ref(false); // feed cards "poof up" right after the board
const toast = ref({ message: "", linkTo: "", linkLabel: "" });

const totalPages = computed(() =>
  Math.max(1, Math.ceil(places.value.length / PAGE_SIZE)),
);
const pagePlaces = computed(() =>
  places.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE),
);
const vibeSummary = computed(() =>
  vibes.value.map((v) => VIBE_LABEL[v]).join(", "),
);

// ---------- search ----------
let requestId = 0;
async function search() {
  const id = ++requestId;
  loading.value = true;
  error.value = "";
  try {
    const f = filters.value;
    const { data } = await api.get("/places/google/search", {
      params: {
        q: q.value.trim() || undefined,
        vibes: vibes.value.join(",") || undefined,
        checkpoint: f.checkpoint,
        maxDistanceKm: f.maxDistanceKm < 60 ? f.maxDistanceKm : undefined,
        maxPrice: f.maxPrice || undefined,
        hiddenGem: f.hiddenGem || undefined,
      },
    });
    if (id !== requestId) return; // a newer search already started
    places.value = data;
    page.value = 1;
  } catch (err) {
    if (id === requestId) error.value = errorMessage(err);
  } finally {
    if (id === requestId) loading.value = false;
  }
}

/** keep ?vibes / ?q in the URL so Back from a place page lands on the same feed */
function syncUrl() {
  const query = {
    ...route.query,
    vibes: vibes.value.join(","),
    q: q.value.trim() || undefined,
  };
  router.replace({ query });
}

// Google is billed per request, so wait a little while people type or drag the slider.
let debounce;
function searchSoon() {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    syncUrl();
    search();
  }, 600);
}
let skipWatch = false; // onExplore already searched; don't search again for the same change
watch(
  [vibes, filters],
  () => {
    if (skipWatch) return (skipWatch = false);
    if (stage.value === "feed") searchSoon();
  },
  { deep: true },
);
// the search box's own ✕ (or deleting the text) empties it → go back to the vibe results
function onSearchInput() {
  if (!q.value.trim() && route.query.q && stage.value === "feed")
    submitSearch();
}

function submitSearch() {
  clearTimeout(debounce);
  if (stage.value === "board") stage.value = "feed";
  syncUrl();
  search();
}
function clearSearch() {
  q.value = "";
  submitSearch();
}

// ---------- vibe board ----------
function onExplore(picked) {
  skipWatch = true;
  vibes.value = picked;
  q.value = "";
  stage.value = "feed";
  poofIn.value = true;
  setTimeout(() => (poofIn.value = false), 1200);
  syncUrl();
  search();
}
function changeVibe() {
  boardVisits.value++;
  stage.value = "board";
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function toggleVibe(id) {
  if (q.value) q.value = ""; // picking a category leaves the typed search
  const i = vibes.value.indexOf(id);
  i === -1 ? vibes.value.push(id) : vibes.value.splice(i, 1);
}

function goToPage(n) {
  page.value = n;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

onMounted(async () => {
  if (stage.value === "feed") search();
  await trips.fetch().catch(() => {});
  // "+ Pin to trip" on a place page sends people here with ?pin=<googlePlaceId>
  if (route.query.pin) {
    try {
      const { data } = await api.get(
        `/places/google/details/${encodeURIComponent(route.query.pin)}`,
      );
      openPin({
        id: data.id,
        googlePlaceId: data.googlePlaceId,
        name: data.name,
      });
    } catch (err) {
      toast.value = { message: errorMessage(err) };
    }
  }
});

/** Place page link. Google results have googlePlaceId; our own rows keep it in google_place_id. */
const placeLink = (p) => {
  const id = p.googlePlaceId || p.google_place_id;
  return id ? `/explorer/place/${encodeURIComponent(id)}` : null;
};

// ---------- pin modal (unchanged) ----------
const pinning = ref(null); // place being pinned
const pinTrip = ref("");
const pinDay = ref("");
const pinTime = ref("");
const pinBusy = ref(false);

const pinTripObj = computed(() =>
  trips.plannable.find((t) => t.id === pinTrip.value),
);
const pinDates = computed(() => {
  const t = pinTripObj.value;
  if (!t?.start_date) return [];
  const out = [];
  const d = new Date(t.start_date + "T00:00:00");
  const end = new Date((t.end_date || t.start_date) + "T00:00:00");
  while (d <= end && out.length < 7) {
    out.push(d.toLocaleDateString("en-CA"));
    d.setDate(d.getDate() + 1);
  }
  return out;
});

function openPin(place) {
  pinning.value = place;
  pinTrip.value = trips.plannable.some((t) => t.id === route.query.pinTo)
    ? route.query.pinTo
    : trips.plannable[0]?.id || "";
  pinDay.value = "";
  pinTime.value = "";
}
watch(pinDates, (d) => {
  pinDay.value = d[0] || "";
});

async function pin() {
  pinBusy.value = true;
  try {
    // Google results aren't in our database yet: import first so the stop can reference the place.
    if (!pinning.value.id && pinning.value.googlePlaceId) {
      const { data } = await api.post("/places/google/import", {
        googlePlaceId: pinning.value.googlePlaceId,
      });
      pinning.value.id = data.id;
    }
    await api.post(`/trips/${pinTrip.value}/itinerary`, {
      placeId: pinning.value.id,
      day: pinDay.value || undefined,
      time: pinTime.value || undefined,
    });
    toast.value = {
      message: `Pinned ${pinning.value.name} to ${pinTripObj.value.name}`,
      linkTo: `/planner/${pinTrip.value}`,
      linkLabel: "Open trip",
    };
    trips.fetch(true);
    pinning.value = null;
  } catch (err) {
    toast.value = { message: errorMessage(err) };
  } finally {
    pinBusy.value = false;
  }
}

const price = (n) => (n ? "$".repeat(n) : "");
</script>

<template>
  <main class="container page">
    <!-- top bar: page stamp on the left, search + filters on the right -->
    <div class="topbar">
      <span class="tag-stamp">Explorer</span>
      <div class="tools">
        <form class="search" role="search" @submit.prevent="submitSearch">
          <svg
            class="search-ico"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <input
            v-model="q"
            class="input search-input"
            type="search"
            placeholder="Search bak kut teh, murals, durian…"
            aria-label="Search places in JB"
            data-cy="explorer-search"
            @input="onSearchInput"
          />
        </form>
        <FilterMenu v-model="filters" :defaults="DEFAULT_FILTERS" />
      </div>
    </div>

    <!-- 1. vibe board -->
    <VibeBoard
      v-if="stage === 'board'"
      :key="boardVisits"
      class="vibe-board"
      :name="auth.firstName"
      :initial="vibes"
      :skip-doors="boardVisits > 0"
      @explore="onExplore"
    />

    <!-- 2. feed -->
    <template v-else>
      <h1 class="display display-lg" style="margin-top: 22px">
        JBound's recommendations for you
      </h1>
      <p v-if="q.trim()" class="muted sub">
        Results for “{{ q.trim() }}”
        <button type="button" class="btn btn-sm btn-ghost" @click="clearSearch">
          ✕ Clear search
        </button>
      </p>
      <p v-else class="muted sub">
        {{
          vibes.length
            ? `Because you're feeling ${vibeSummary}.`
            : "A bit of everything around JB."
        }}
      </p>

      <!-- category filters, right under the heading -->
      <div class="row cats" role="group" aria-label="Categories">
        <button
          v-for="v in VIBES"
          :key="v.id"
          type="button"
          class="chip"
          :aria-pressed="!q.trim() && vibes.includes(v.id)"
          :data-cy="`vibe-${v.id}`"
          @click="toggleVibe(v.id)"
        >
          <VibeIcon :vibe="v.id" :size="18" /> {{ v.label }}
        </button>
        <button
          type="button"
          class="btn btn-sm btn-ghost"
          data-cy="change-vibe"
          @click="changeVibe"
        >
          ↺ Change my vibe
        </button>
      </div>

      <p class="hand muted count" aria-live="polite">
        {{
          loading
            ? "Scouting…"
            : `${places.length} place${places.length === 1 ? "" : "s"} found`
        }}
      </p>
      <!-- Google requires attribution when showing Places data outside a Google map.
           TODO(team): also show each photo's authorAttributions (see Places API photo policies). -->
      <p v-if="places.length" class="attribution">Places data © Google</p>
      <p v-if="error" class="error-text" role="alert">{{ error }}</p>

      <ul class="grid" :class="{ 'poof-in': poofIn }">
        <li
          v-for="(p, i) in pagePlaces"
          :key="p.id || p.googlePlaceId"
          class="card place"
          :style="{ '--i': i }"
          data-cy="place-card"
        >
          <img
            v-if="p.photos?.[0]"
            :src="assetUrl(p.photos[0])"
            :alt="p.name"
            class="photo"
            loading="lazy"
          />
          <div
            v-else
            class="placeholder-photo photo"
            :style="{ background: VIBE_TINT[p.vibes[0]] }"
          >
            <VibeIcon :vibe="p.vibes[0]" :size="40" :stroke-width="1.6" />
          </div>
          <div class="body">
            <div class="row" style="gap: 6px">
              <span
                v-for="v in p.vibes"
                :key="v"
                class="pill"
                :style="{ background: VIBE_TINT[v] }"
                >{{ VIBE_LABEL[v] }}</span
              >
              <span
                v-if="p.isHiddenGem"
                class="pill"
                style="background: var(--mustard)"
                >✦ Hidden gem</span
              >
            </div>
            <h2 class="display display-sm" style="margin-top: 8px">
              <RouterLink
                v-if="placeLink(p)"
                :to="placeLink(p)"
                class="place-link"
                data-cy="place-link"
                >{{ p.name }}</RouterLink
              >
              <template v-else>{{ p.name }}</template>
            </h2>
            <p v-if="p.rating" class="meta">
              <strong>★ {{ p.rating }}</strong>
              <span class="muted"
                >({{ p.ratingCount ?? p.rating_count }} Google reviews)</span
              >
            </p>
            <p class="meta muted">
              {{ p.distanceKm }} km from
              {{ filters.checkpoint === "tuas" ? "Tuas" : "Woodlands"
              }}<template v-if="p.price_level">
                · {{ price(p.price_level) }}</template
              >
              · {{ p.postCount }} tale{{ p.postCount === 1 ? "" : "s" }}
            </p>
            <p v-if="p.description" class="desc">{{ p.description }}</p>
            <div class="spacer" />
            <div class="row" style="gap: 8px; margin-top: 12px">
              <RouterLink
                v-if="placeLink(p)"
                :to="placeLink(p)"
                class="btn btn-sm btn-ghost"
                >View place</RouterLink
              >
              <button
                type="button"
                class="btn btn-primary btn-sm"
                data-cy="pin"
                @click="openPin(p)"
              >
                + Pin to trip
              </button>
              <RouterLink
                v-if="p.id"
                :to="`/tales/place/${p.id}`"
                class="btn btn-sm btn-ghost"
                >Read tales</RouterLink
              >
            </div>
          </div>
        </li>
      </ul>

      <p v-if="!loading && !error && !places.length" class="empty hand">
        Nothing here. Try a wider distance in Filters, or another vibe.
      </p>

      <Pagination
        class="pager"
        :page="page"
        :total-pages="totalPages"
        :disabled="loading"
        label="Explorer result pages"
        @page-change="goToPage"
      />
    </template>

    <!-- pin modal (unchanged) -->
    <template v-if="pinning">
      <div class="scrim" @click="pinning = null" />
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-title"
        @keydown.esc="pinning = null"
      >
        <h2 id="pin-title" class="display display-md">
          Pin {{ pinning.name }}
        </h2>
        <p v-if="!trips.plannable.length" class="lead">
          No trips to pin to yet.
          <RouterLink to="/planner?new=1">Create a new trip</RouterLink> first.
        </p>
        <form
          v-else
          class="stack"
          style="gap: 14px; margin-top: 16px"
          @submit.prevent="pin"
        >
          <label class="field"
            >Trip
            <select v-model="pinTrip" class="select" data-cy="pin-trip">
              <option v-for="t in trips.plannable" :key="t.id" :value="t.id">
                {{ t.name }}
              </option>
            </select>
          </label>
          <div class="row" style="gap: 12px">
            <label class="field" style="flex: 1"
              >Day
              <select v-model="pinDay" class="select">
                <option value="">Unscheduled</option>
                <option v-for="d in pinDates" :key="d" :value="d">
                  {{ dayLabel(pinTripObj?.start_date, d) }} · {{ d }}
                </option>
              </select>
            </label>
            <label class="field" style="flex: 1"
              >Time (optional)<input
                v-model="pinTime"
                type="time"
                class="input"
            /></label>
          </div>
          <div class="row" style="justify-content: flex-end">
            <button type="button" class="btn btn-ghost" @click="pinning = null">
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="pinBusy || !pinTrip"
              data-cy="pin-confirm"
            >
              Pin it
            </button>
          </div>
        </form>
      </div>
    </template>

    <ToastMessage v-bind="toast" @close="toast.message = ''" />
  </main>
</template>

<style scoped>
/* top bar */
.topbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.tools {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 1 520px;
}
.search {
  position: relative;
  flex: 1;
}
.search-ico {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--ink-mute);
  pointer-events: none;
}
.search-input {
  width: 100%;
  padding-left: 42px;
  border-radius: 999px;
}

.vibe-board {
  margin-top: 22px;
}

/* feed */
.sub {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 8px 0 0;
}
.cats {
  margin-top: 18px;
  gap: 10px;
}
.count {
  margin: 20px 0 0;
}
.grid {
  list-style: none;
  margin: 18px 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 22px;
}
.place {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.photo {
  width: 100%;
  height: 170px;
  object-fit: cover;
  border-bottom: 2px solid var(--ink);
}
.body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px 18px 18px;
}
.meta {
  margin: 4px 0 0;
  font-size: 13px;
}
.desc {
  margin: 8px 0 0;
  font-size: 14px;
}
.attribution {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--ink-mute);
}
.place-link {
  color: inherit;
  text-decoration: none;
}
.place-link:hover {
  text-decoration: underline;
}
.empty {
  margin-top: 24px;
  text-align: center;
}
.pager {
  margin-top: 28px;
}

/* cards "poof up" after Let's Explore */
.poof-in .place {
  animation: poof-up 0.45s cubic-bezier(0.3, 1.4, 0.5, 1) both;
  animation-delay: calc(var(--i) * 45ms);
}
@keyframes poof-up {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.92);
  }
}

@media (max-width: 640px) {
  .tools {
    flex-basis: 100%;
  }
  /* one swipeable row of category chips */
  .cats {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 6px;
  }
  .cats > * {
    flex: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .poof-in .place {
    animation: none;
  }
}
</style>
