<script setup>
import BackLabel from "@/components/common/BackLabel.vue";

import { ref, computed, watch, onMounted, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, errorMessage, assetUrl } from "@/lib/api";
import { useTripsStore } from "@/stores/trips";
import { useAuthStore } from "@/stores/auth";
import { VIBES, VIBE_LABEL, VIBE_TINT } from "@/utils/constants";
import { dayLabel } from "@/utils/format";
import VibeIcon from "@/components/common/VibeIcon.vue";
import ToastMessage from "@/components/common/ToastMessage.vue";
import SkyBackdrop from "@/components/scene/SkyBackdrop.vue";
import FilterMenu from "@/components/explorer/FilterMenu.vue";
import SearchBar from "@/components/common/SearchBar.vue";
import SoftPaint from "@/components/scene/SoftPaint.vue";
import VibeBoard from "@/components/explorer/VibeBoard.vue";

const route = useRoute();
const router = useRouter();
const trips = useTripsStore();
const auth = useAuthStore();

const VIBE_IDS = VIBES.map((v) => v.id);
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

/** 'board' = asking for your vibe, 'feed' = the places pinned up. Coming Back from a place page lands on the feed. */
const stage = ref(
  route.query.vibes !== undefined || route.query.q ? "feed" : "board",
);
const boardVisits = ref(0);
const vibes = ref(vibesFromUrl());
const q = ref(String(route.query.q || ""));
const filters = ref({ ...DEFAULT_FILTERS });

const places = ref([]);
const loading = ref(false);
const error = ref("");
const dealing = ref(false); // places get pinned up one by one right after the vibe screen
const toast = ref({ message: "", linkTo: "", linkLabel: "" });

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
    skipped.value = [];
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
  if (!q.value.trim() && route.query.q) submitSearch();
}

function submitSearch() {
  clearTimeout(debounce);
  syncUrl();
  search();
}
function toggleVibe(id) {
  if (q.value) q.value = ""; // picking a category leaves the typed search
  const i = vibes.value.indexOf(id);
  i === -1 ? vibes.value.push(id) : vibes.value.splice(i, 1);
}

// ---------- vibe screen <-> feed ----------
function onExplore(picked) {
  clearTimeout(debounce);
  skipWatch = true;
  vibes.value = picked;
  q.value = "";
  stage.value = "feed";
  dealing.value = true;
  syncUrl();
  search().finally(() => setTimeout(() => (dealing.value = false), 1600));
}
// what's narrowing the board right now, shown under the search bar
const activeVibes = computed(() => (q.value.trim() ? [] : vibes.value)); // a typed search leaves the categories
const activeFilters = computed(() => {
  const f = filters.value;
  const on = (key) => f[key] !== DEFAULT_FILTERS[key];
  return [
    on("checkpoint") && { key: "checkpoint", label: `Crossing at ${f.checkpoint === "tuas" ? "Tuas" : "Woodlands"}` },
    on("maxDistanceKm") && { key: "maxDistanceKm", label: f.maxDistanceKm >= 60 ? "Any distance" : `Within ${f.maxDistanceKm} km` },
    on("maxPrice") && { key: "maxPrice", label: `Up to ${price(f.maxPrice)}` },
    on("hiddenGem") && { key: "hiddenGem", label: "✦ Hidden gems" },
  ].filter(Boolean);
});
function clearFilter(key) {
  filters.value = { ...filters.value, [key]: DEFAULT_FILTERS[key] };
}
function changeVibe() {
  clearTimeout(debounce);
  boardVisits.value++;
  stage.value = "board";
}

// "+ Pin to trip" on a place page asks for the pin dialog with ?pin=<googlePlaceId>
async function openPinFromUrl() {
  const pinId = route.query.pin;
  if (!pinId) return;
  try {
    await trips.fetch().catch(() => {});
    const { data } = await api.get(
      `/places/google/details/${encodeURIComponent(pinId)}`,
    );
    openPin({
      id: data.id,
      googlePlaceId: data.googlePlaceId,
      name: data.name,
    });
  } catch (err) {
    toast.value = { message: errorMessage(err) };
  }
  const { pin: _used, ...rest } = route.query; // so the same place can be pinned again
  router.replace({ query: rest });
}
watch(() => route.query.pin, openPinFromUrl);

onMounted(async () => {
  if (stage.value === "feed") search();
  await trips.fetch().catch(() => {});
  openPinFromUrl();
});

// ---------- a place page or its tales, taking over the board ----------
const onPlacePage = computed(() => Boolean(route.meta.onBoard));

// Detail pages share the outer Back control; keep board filters when returning.
function previousBoardPage() {
  const previous = router.options.history.state?.back;
  if (typeof previous !== 'string') return null;
  const fromExplorer = /^\/explorer(?:[/?]|$)/.test(previous);
  const fromTales = /^\/tales(?:[/?]|$)/.test(previous);
  return fromExplorer || fromTales ? previous : null;
}
const backDestination = computed(() => {
  // History state changes alongside the route, so recompute on every navigation.
  void route.fullPath;
  return onPlacePage.value ? previousBoardPage() || '/explorer' : '/';
});
const backLabel = computed(() => {
  if (!onPlacePage.value) return 'Back to Basecamp';
  if (backDestination.value.startsWith('/tales')) return 'Back to Tales';
  return 'Back to the notice board';
});
function goBack() {
  if (onPlacePage.value && previousBoardPage()) router.back();
  else router.push(backDestination.value);
}

const placePage = ref(null);
watch(
  () => route.path,
  async () => {
    if (!onPlacePage.value) return;
    await nextTick();
    placePage.value?.focus({ preventScroll: true }); // keyboard and screen reader users start on the new content
  },
  { immediate: true }, // arriving straight from Tales
);
/** Keeps ?vibes and ?q in the URL, so the way back lands on the same board. */
const keepQuery = (path) => ({ path, query: route.query });

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

// ---------- the flyers + backpack ----------
// Swipe a flyer right (or ♥) to drop a place in your Backpack to plan with later; left (or ✕) to take it off the board.
const BACKPACK_KEY = "jbound:backpack";
const readBackpack = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(BACKPACK_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};
const backpack = ref(readBackpack());
watch(backpack, (list) => {
  try {
    localStorage.setItem(BACKPACK_KEY, JSON.stringify(list));
  } catch {
    /* private mode: backpack lasts for this visit only */
  }
}, { deep: true });

const keyOf = (p) => p.googlePlaceId || p.google_place_id || p.id;
const inBackpack = (p) => backpack.value.some((b) => b.key === keyOf(p));
const skipped = ref([]); // keys taken off the board; a new search pins them back up
const board = computed(() =>
  places.value.filter((p) => !inBackpack(p) && !skipped.value.includes(keyOf(p))),
);
const lastAction = ref(null); // { kind: 'keep' | 'skip', place } for undo

function keep(place) {
  backpack.value.unshift({ key: keyOf(place), id: place.id || null, googlePlaceId: place.googlePlaceId || place.google_place_id || null, name: place.name, photo: place.photos?.[0] || null, vibes: place.vibes || [] });
  lastAction.value = { kind: "keep", place };
}
function skip(place) {
  skipped.value.push(keyOf(place));
  lastAction.value = { kind: "skip", place };
}
function undo() {
  const last = lastAction.value;
  if (!last) return;
  if (last.kind === "keep") backpack.value = backpack.value.filter((b) => b.key !== keyOf(last.place));
  else skipped.value = skipped.value.filter((k) => k !== keyOf(last.place));
  lastAction.value = null;
}
function dropFromBackpack(item) {
  backpack.value = backpack.value.filter((b) => b.key !== item.key);
}

// drag a flyer to swipe it
const drag = ref({ key: null, startX: 0, dx: 0 });
const leaving = ref(null); // { key, dir: 'left' | 'right' } while a card flies off
function onDown(e, p) {
  if (leaving.value || e.target.closest("a, button")) return; // its links and buttons still just click
  drag.value = { key: keyOf(p), startX: e.clientX, dx: 0 };
  e.currentTarget.setPointerCapture?.(e.pointerId);
}
function onMove(e) {
  if (drag.value.key) drag.value.dx = e.clientX - drag.value.startX;
}
function onUp(p) {
  if (drag.value.key !== keyOf(p)) return;
  const { dx } = drag.value;
  drag.value = { key: null, startX: 0, dx: 0 };
  if (dx > 110) fling("right", p);
  else if (dx < -110) fling("left", p);
}
function fling(dir, p) {
  if (leaving.value) return;
  leaving.value = { key: keyOf(p), dir };
  setTimeout(() => {
    dir === "right" ? keep(p) : skip(p);
    leaving.value = null;
  }, 260);
}
function onCardKey(e, p) {
  if (e.target !== e.currentTarget) return; // focus is on one of the card's buttons
  if (e.key === "ArrowRight") fling("right", p);
  else if (e.key === "ArrowLeft") fling("left", p);
  else return;
  e.preventDefault();
}
function cardStyle(p, i) {
  const base = { "--i": Math.min(i, 11), "--tilt": `${TILTS[i % TILTS.length]}deg` };
  const key = keyOf(p);
  if (leaving.value?.key === key) {
    const right = leaving.value.dir === "right";
    return { ...base, transform: `translateX(${right ? 140 : -140}%) rotate(${right ? 24 : -24}deg)`, opacity: 0, transition: "transform .26s ease-in, opacity .26s", zIndex: 3 };
  }
  if (drag.value.key === key) return { ...base, transform: `translateX(${drag.value.dx}px) rotate(${drag.value.dx / 18}deg)`, transition: "none", zIndex: 3 };
  return base;
}
const hint = (p) => {
  if (drag.value.key !== keyOf(p)) return "";
  return drag.value.dx > 50 ? "keep" : drag.value.dx < -50 ? "skip" : "";
};
// a slightly different tilt per card so the board looks hand-pinned
const TILTS = [-1.2, 0.8, -0.6, 1.1, -0.9, 0.6];
const TACKS = ["red", "yellow-pin", "green"];

/** Open the pin-to-trip dialog for a backpack item. */
function pinFromBackpack(item) {
  openPin({ id: item.id, googlePlaceId: item.googlePlaceId, name: item.name });
}
</script>

<template>
  <main class="notice-page">
    <SkyBackdrop />
    <button type="button" class="camp-back back" :aria-label="backLabel" @click="goBack"><BackLabel /></button>

    <div class="board-wrap">
      <!-- only this layer is painted, so the page on top stays crisp -->
      <SoftPaint />
      <div class="paint" aria-hidden="true">
        <i class="p-ground" />
        <i class="p-post left" />
        <i class="p-post right" />
        <i class="p-frame" />
        <i class="p-rim" />
        <i class="p-cork" />
        <i class="p-roof" />
        <i class="p-lip" />
        <i class="p-hinge left" />
        <i class="p-hinge right" />
        <i class="p-plate" />
      </div>

      <header class="roof">
        <h1 class="roof-title">Notice Board</h1>
      </header>

      <div class="frame">
        <div class="cork">
          <div v-if="onPlacePage" :key="route.path" ref="placePage" class="cork-scroll" tabindex="-1">
            <article class="sheet">
              <i class="pin red" aria-hidden="true" />
              <RouterView />
            </article>
          </div>

          <!-- hidden rather than removed, so coming back keeps the results and your place in them -->
          <div v-show="!onPlacePage" :key="stage" class="cork-scroll" :class="{ 'feed-scroll': stage !== 'board' }">
            <!-- 1. what's the vibe? -->
            <VibeBoard
              v-if="stage === 'board'"
              :key="boardVisits"
              :name="auth.firstName"
              :initial="vibes"
              @explore="onExplore"
            />

            <!-- 2. every place, pinned up -->
            <div v-else class="feed" :class="{ dealing }">
              <section class="note white head" style="--tilt: -0.3deg" aria-label="Search and filter">
                <i class="pin red" aria-hidden="true" />
                <div class="head-top">
                  <form class="search" role="search" @submit.prevent="submitSearch">
                    <SearchBar v-model="q" placeholder="Search a place" data-cy="explorer-search" @update:model-value="onSearchInput" />
                  </form>
                  <FilterMenu
                    v-model="filters"
                    :defaults="DEFAULT_FILTERS"
                    :vibes="activeVibes"
                    class="filters"
                    @toggle-vibe="toggleVibe"
                    @clear-vibes="vibes = []"
                    @change-vibe="changeVibe"
                  />
                </div>

                <div v-if="activeVibes.length || activeFilters.length" class="chosen" role="group" aria-label="Selected filters">
                  <button
                    v-for="v in activeVibes"
                    :key="v"
                    type="button"
                    class="vibe"
                    :aria-label="`Remove ${VIBE_LABEL[v]} filter`"
                    :data-cy="`chosen-${v}`"
                    @click="toggleVibe(v)"
                  >
                    <VibeIcon :vibe="v" :size="15" /> {{ VIBE_LABEL[v] }} <span aria-hidden="true">✕</span>
                  </button>
                  <button
                    v-for="f in activeFilters"
                    :key="f.key"
                    type="button"
                    class="vibe"
                    :aria-label="`Remove ${f.label} filter`"
                    @click="clearFilter(f.key)"
                  >
                    {{ f.label }} <span aria-hidden="true">✕</span>
                  </button>
                </div>

                <p class="status" aria-live="polite">
                  <strong class="found">{{ loading ? 'Scouting…' : `${board.length} place${board.length === 1 ? '' : 's'} on the board` }}</strong>
                  <span>Swipe a flyer ← to pass, → to pack it</span>
                  <button v-if="lastAction" type="button" class="link" @click="undo">Undo</button>
                  <!-- Google requires attribution when showing Places data outside a Google map. -->
                  <span v-if="places.length" class="attribution">Places data © Google</span>
                </p>
              </section>

              <div class="feed-body">
                <div class="results">
                  <p v-if="loading && !board.length" class="deck-empty" role="status">Pinning up fresh flyers…</p>
                  <p v-else-if="error" class="deck-empty error-text" role="alert">{{ error }}</p>
                  <p v-else-if="!board.length" class="deck-empty">
                    {{ places.length ? 'That’s every flyer on the board. Try another vibe.' : 'No flyers for that. Try another vibe or search.' }}
                  </p>

                  <ul v-else class="grid">
                    <li
                      v-for="(p, i) in board"
                      :key="keyOf(p)"
                      class="flyer"
                      :class="hint(p)"
                      :style="cardStyle(p, i)"
                      tabindex="0"
                      :aria-label="`${p.name} flyer. Left arrow passes, right arrow packs it.`"
                      data-cy="place-card"
                      @pointerdown="onDown($event, p)"
                      @pointermove="onMove"
                      @pointerup="onUp(p)"
                      @pointercancel="onUp(p)"
                      @keydown="onCardKey($event, p)"
                    >
                      <i class="pin" :class="TACKS[i % TACKS.length]" aria-hidden="true" />
                      <div class="f-quick">
                        <button type="button" class="quick" title="Skip" :aria-label="`Skip ${p.name}`" @click="fling('left', p)">✕</button>
                        <button type="button" class="quick pack" title="Pack it" :aria-label="`Put ${p.name} in your backpack`" @click="fling('right', p)">♥</button>
                      </div>
                      <img v-if="p.photos?.[0]" :src="assetUrl(p.photos[0])" :alt="p.name" class="f-photo" draggable="false" loading="lazy" />
                      <div v-else class="f-photo f-blank" :style="{ background: VIBE_TINT[p.vibes?.[0]] || '#f6d58e' }">
                        <VibeIcon :vibe="p.vibes?.[0] || 'eating'" :size="40" :stroke-width="1.6" />
                      </div>
                      <div class="f-body">
                        <p class="f-pills">
                          <span v-for="v in p.vibes || []" :key="v" class="pill" :style="{ background: VIBE_TINT[v] }">{{ VIBE_LABEL[v] }}</span>
                          <span v-if="p.isHiddenGem" class="pill" style="background: var(--mustard)">✦ Hidden gem</span>
                        </p>
                        <h3 class="f-name">
                          <RouterLink v-if="placeLink(p)" :to="keepQuery(placeLink(p))" class="place-link" data-cy="place-link">{{ p.name }}</RouterLink>
                          <template v-else>{{ p.name }}</template>
                        </h3>
                        <p v-if="p.rating" class="f-meta">
                          <strong>★ {{ p.rating }}</strong>
                          <span class="dim"><template v-if="p.ratingCount ?? p.rating_count"> ({{ p.ratingCount ?? p.rating_count }} Google reviews)</template></span>
                        </p>
                        <p class="f-meta dim">
                          <template v-if="p.distanceKm != null">{{ p.distanceKm.toFixed(1) }} km from {{ filters.checkpoint === 'tuas' ? 'Tuas' : 'Woodlands' }} · </template>
                          <template v-if="p.price_level">{{ price(p.price_level) }} · </template>
                          {{ p.postCount || 0 }} tale{{ p.postCount === 1 ? '' : 's' }}
                        </p>
                        <p v-if="p.description" class="f-desc">{{ p.description }}</p>
                        <span class="spacer" />
                        <div class="f-actions">
                          <RouterLink v-if="placeLink(p)" :to="keepQuery(placeLink(p))" class="btn btn-sm btn-ghost">View place</RouterLink>
                          <button type="button" class="btn btn-primary btn-sm" data-cy="pin" @click="openPin(p)">+ Pin to trip</button>
                        </div>
                      </div>
                      <span class="stamp keep-stamp" aria-hidden="true">PACK IT</span>
                      <span class="stamp skip-stamp" aria-hidden="true">NAH</span>
                    </li>
                  </ul>
                </div>

                <aside class="backpack" aria-labelledby="bp-title">
                  <h2 id="bp-title" class="note-title">Backpack <small>{{ backpack.length }}</small></h2>
                  <p v-if="!backpack.length" class="bp-empty">Places you pack land here, ready to pin to a trip.</p>
                  <ul v-else class="bp-list">
                    <li v-for="item in backpack" :key="item.key">
                      <span class="bp-name">{{ item.name }}</span>
                      <button type="button" class="mini" @click="pinFromBackpack(item)">Pin</button>
                      <button type="button" class="mini ghost" :aria-label="`Take ${item.name} out of the backpack`" @click="dropFromBackpack(item)">✕</button>
                    </li>
                  </ul>
                </aside>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <ToastMessage v-bind="toast" @close="toast.message = ''" />

    <!-- pin to trip -->
    <template v-if="pinning">
      <div class="scrim" @click="pinning = null" />
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="pin-title" @keydown.esc="pinning = null">
        <h2 id="pin-title" class="display display-md">Pin {{ pinning.name }}</h2>
        <p v-if="!trips.plannable.length" class="lead">
          No trips to pin to yet.
          <RouterLink to="/planner?new=1">Create a new trip</RouterLink> first.
        </p>
        <form v-else class="stack" style="gap: 14px; margin-top: 16px" @submit.prevent="pin">
          <label class="field">Trip
            <select v-model="pinTrip" class="select" data-cy="pin-trip">
              <option v-for="t in trips.plannable" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </label>
          <div class="row" style="gap: 12px">
            <label class="field" style="flex: 1">Day
              <select v-model="pinDay" class="select">
                <option value="">Unscheduled</option>
                <option v-for="d in pinDates" :key="d" :value="d">{{ dayLabel(pinTripObj?.start_date, d) }} · {{ d }}</option>
              </select>
            </label>
            <label class="field" style="flex: 1">Time (optional)<input v-model="pinTime" type="time" class="input" /></label>
          </div>
          <div class="row" style="justify-content: flex-end">
            <button type="button" class="btn btn-ghost" @click="pinning = null">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="pinBusy || !pinTrip" data-cy="pin-confirm">Pin it</button>
          </div>
        </form>
      </div>
    </template>
  </main>
</template>

<style scoped>
.notice-page {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 20px 34px; /* room for the posts below the board */
  font-family: var(--font-round);
  color: #1f2a24;
  overflow: hidden !important; /* the sky stays put, everything scrolls on the cork */
}
.back {
  position: absolute;
  z-index: 6;
  top: 16px;
  left: 18px;
}

/* ---------- the board itself ---------- */
.board-wrap {
  --roof-h: 84px;
  --lip-h: 20px;
  --frame-inset: 14px; /* how far the roof overhangs the frame */
  --frame-pad: 24px;
  --frame-foot: 30px;
  --green-light: #a9c192;
  --green: #8ba674;
  --green-shade: #6f8a5c;
  --green-deep: #566e47;
  position: relative;
  flex: 1;
  min-height: 0;
  width: min(100%, 1400px);
  display: flex;
  flex-direction: column;
}
/* ---------- the painted board: every piece goes through one watercolour filter ---------- */
.paint {
  position: absolute;
  z-index: 0;
  inset: 0 0 -28px;
  filter: url(#soft-paint);
  pointer-events: none;
}
.paint i {
  position: absolute;
  display: block;
  box-sizing: border-box;
  border: 2.6px solid var(--ink);
}
/* the shadow it throws on the ground */
.paint .p-ground {
  left: 3%;
  right: 3%;
  bottom: 0;
  height: 22px;
  border: 0;
  background: radial-gradient(closest-side, rgba(20, 25, 15, 0.5), transparent);
}
/* legs: lit from the left, turning away on the right */
.p-post {
  top: var(--roof-h);
  bottom: 4px;
  width: 38px;
  background: linear-gradient(90deg, var(--green-light) 0 18%, var(--green) 18% 68%, var(--green-deep) 68%);
}
.p-post.left {
  left: 6%;
}
.p-post.right {
  right: 6%;
}
/* the frame: light catches the top and left edges, the bottom and right fall into shade */
.p-frame {
  top: calc(var(--roof-h) - 8px);
  left: var(--frame-inset);
  right: var(--frame-inset);
  bottom: 28px;
  border-radius: 4px;
  background: var(--green);
  box-shadow:
    inset 5px 0 0 var(--green-light),
    inset -6px 0 0 var(--green-shade),
    inset 0 -8px 0 var(--green-deep),
    0 7px 8px rgba(30, 35, 20, 0.4);
}
/* the inner rim: its edges face the other way, so the cork looks set back into the frame */
.paint .p-rim {
  border-width: 1.6px;
  top: calc(var(--roof-h) + var(--frame-pad) - 8px);
  left: calc(var(--frame-inset) + var(--frame-pad) - 8px);
  right: calc(var(--frame-inset) + var(--frame-pad) - 8px);
  bottom: calc(28px + var(--frame-foot) - 8px);
  background: var(--green-shade);
  box-shadow:
    inset 3px 3px 0 var(--green-deep),
    inset -3px -3px 0 var(--green-light);
}
.p-cork {
  top: calc(var(--roof-h) + var(--frame-pad));
  left: calc(var(--frame-inset) + var(--frame-pad));
  right: calc(var(--frame-inset) + var(--frame-pad));
  bottom: calc(28px + var(--frame-foot));
  background: radial-gradient(rgba(100, 62, 28, 0.3) 1.2px, transparent 1.6px) 0 0 / 9px 9px, #dcb077;
}
/* the roof: a slope narrowing away from you, sat on a front lip */
.paint .p-roof {
  top: 2px;
  left: 0;
  right: 0;
  height: calc(var(--roof-h) - var(--lip-h));
  border: 0;
  background: var(--ink);
  clip-path: polygon(3.5% 0, 96.5% 0, 100% 100%, 0 100%);
}
.p-roof::before {
  content: "";
  position: absolute;
  inset: 3px 3px 0;
  background:
    linear-gradient(90deg, transparent 33%, rgba(42, 33, 23, 0.35) 33% 33.2%, transparent 33.2% 66.8%, rgba(42, 33, 23, 0.35) 66.8% 67%, transparent 67%),
    linear-gradient(var(--green-light), var(--green));
  clip-path: polygon(3.5% 0, 96.5% 0, 100% 100%, 0 100%);
}
.p-lip {
  top: calc(var(--roof-h) - var(--lip-h));
  left: 0;
  right: 0;
  height: var(--lip-h);
  border-radius: 2px 2px 5px 5px;
  background: linear-gradient(var(--green-shade), var(--green-deep));
  box-shadow: 0 9px 9px rgba(30, 35, 20, 0.45);
}
/* brushed metal, with the hinge pin running across the middle */
.p-hinge,
.p-plate {
  background: linear-gradient(#f4f2e6, #bdb9a6);
  box-shadow: 0 3px 3px rgba(30, 35, 20, 0.45);
}
.p-hinge {
  top: calc(var(--roof-h) - 14px);
  width: 38px;
  height: 30px;
  border-radius: 3px;
  background:
    linear-gradient(transparent 42%, var(--ink) 42% 46%, #8d8a78 46% 54%, var(--ink) 54% 58%, transparent 58%),
    linear-gradient(#f4f2e6, #bdb9a6);
}
.p-hinge.left {
  left: 22%;
}
.p-hinge.right {
  right: 22%;
}
.p-plate {
  bottom: 33px;
  left: 50%;
  width: 84px;
  height: 18px;
  margin-left: -42px;
  border-radius: 3px;
}
.roof {
  position: relative;
  z-index: 2;
  flex: none;
  display: grid;
  place-items: center;
  height: var(--roof-h);
}
.roof-title {
  margin: 0 0 calc(var(--lip-h) - 2px);
  color: #fffdf6;
  font-family: var(--font-story);
  font-weight: 800;
  font-size: 28px;
  text-shadow: 0 2px 0 rgba(42, 33, 23, 0.55);
}
.frame {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  display: flex;
  padding: var(--frame-pad) calc(var(--frame-inset) + var(--frame-pad)) var(--frame-foot);
}
.cork {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
}
/* the frame's shadow falls across the cork and whatever's pinned to it; flyers slide under the frame as they scroll */
.cork::after {
  content: "";
  position: absolute;
  z-index: 6;
  inset: 0;
  pointer-events: none;
  box-shadow:
    inset 0 12px 12px -6px rgba(50, 28, 8, 0.55),
    inset 10px 0 10px -6px rgba(50, 28, 8, 0.4),
    inset -3px -3px 6px -3px rgba(50, 28, 8, 0.25);
}
.cork-scroll {
  flex: 1;
  min-width: 0;
  overflow: hidden auto;
  display: flex;
  flex-direction: column;
  padding: 20px 22px 26px;
}
/* a slim thumb with no track or arrows, so nothing sits on the board's frame */
.cork-scroll::-webkit-scrollbar {
  width: 8px;
}
.cork-scroll::-webkit-scrollbar-button {
  display: none;
}
.cork-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.cork-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(60, 30, 10, 0.45);
}
@supports not selector(::-webkit-scrollbar) {
  .cork-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(60, 30, 10, 0.45) transparent;
  }
}
/* the feed drops the bottom padding so the backpack can reach the frame */
.cork-scroll.feed-scroll {
  padding-bottom: 0;
}
/* a place page: one big sheet pinned over the whole board */
.cork-scroll:focus {
  outline: none;
}
.sheet {
  position: relative;
  flex: none;
  min-width: 0;
  padding: 24px clamp(14px, 3vw, 34px) 30px;
  background: #fffdf7;
  color: var(--ink);
  font-family: var(--font-body);
  box-shadow: 0 8px 18px rgba(50, 25, 5, 0.35);
  animation: pin-up 0.25s ease-out;
}
@keyframes pin-up {
  from {
    opacity: 0;
    translate: 0 10px;
  }
}
/* ---------- notes ---------- */
.note {
  position: relative;
  padding: 16px 16px 12px;
  rotate: var(--tilt);
  box-shadow: 3px 7px 10px rgba(50, 25, 5, 0.35);
}
.white {
  background: #fffdf7;
}
.pin {
  position: absolute;
  z-index: 2;
  top: -7px;
  left: 50%;
  width: 16px;
  height: 16px;
  margin-left: -8px;
  border-radius: 50%;
  box-shadow: 0 3px 4px rgba(0, 0, 0, 0.4), inset -2px -2px 0 rgba(0, 0, 0, 0.15);
}
.pin.red {
  background: #e2573c;
}
.pin.yellow-pin {
  background: #f2b134;
}
.pin.green {
  background: #2e6b46;
}
.note-title {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.note-title small {
  display: inline-grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  border-radius: 999px;
  background: #1f2a24;
  color: #fffdf7;
  font-size: 11px;
  letter-spacing: 0;
}
.link {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

/* ---------- the header note: search, filters, vibes ---------- */
.feed {
  flex: 1;
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 24px;
}
.head {
  z-index: 4; /* the filter menu opens out over the flyers */
  display: grid;
  gap: 10px;
}
.head-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 18px;
}
.search {
  flex: 1;
  min-width: 0;
}
.filters :deep(.filter-btn) {
  min-height: 40px;
  padding: 0 12px;
  font-size: 13px;
  box-shadow: none;
}
.chosen {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.vibe {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  padding: 0 10px;
  border: 2px solid #1f2a24;
  border-radius: 999px;
  background: #1f2a24;
  color: #fffdf7;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.status {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 12px;
  margin: 0;
  font-size: 12.5px;
  color: var(--ink-soft);
}
.found {
  font-family: var(--font-hand);
  font-size: 20px;
  font-weight: 700;
  color: #1f2a24;
}
.attribution {
  margin-left: auto;
  color: var(--ink-mute);
  font-size: 12px;
}

/* ---------- the flyers ---------- */
.results {
  padding-bottom: 26px;
}
.feed-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 224px;
  align-items: start;
  gap: 26px;
}
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(236px, 1fr));
  gap: 28px 22px;
}
.flyer {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 2px solid #1f2a24;
  border-radius: 6px;
  background: #fffdf7;
  box-shadow: 0 8px 14px rgba(50, 25, 5, 0.32);
  rotate: var(--tilt);
  cursor: grab;
  touch-action: pan-y;
  user-select: none;
  transition: rotate 0.15s, box-shadow 0.15s;
}
.flyer:hover {
  rotate: 0deg;
  box-shadow: 0 12px 18px rgba(50, 25, 5, 0.38);
}
.flyer:active {
  cursor: grabbing;
}
.flyer:focus-visible {
  outline: 3px dashed #1f2a24;
  outline-offset: 4px;
}
/* the places get pressed onto the cork, one after another */
.dealing .flyer {
  animation: pin-up 0.45s cubic-bezier(0.3, 1.4, 0.5, 1) backwards;
  animation-delay: calc(var(--i) * 70ms);
}
.dealing .head,
.dealing .backpack {
  animation: pin-up 0.4s cubic-bezier(0.3, 1.4, 0.5, 1) backwards;
}
@keyframes pin-up {
  from {
    opacity: 0;
    translate: 0 -22px;
    scale: 1.08;
  }
}
.f-photo {
  flex: none;
  width: 100%;
  height: 150px;
  object-fit: cover;
  border-bottom: 2px solid #1f2a24;
  border-radius: 4px 4px 0 0;
  pointer-events: none;
}
.f-blank {
  display: grid;
  place-items: center;
}
.f-quick {
  position: absolute;
  z-index: 2;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 6px;
}
.quick {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 2px solid #1f2a24;
  border-radius: 50%;
  background: #fffdf7;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
  color: #1f2a24;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}
.quick.pack {
  background: #2e6b46;
  color: #fffdf7;
}
.quick:active {
  translate: 0 2px;
  box-shadow: none;
}
.f-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px 14px 14px;
  font-family: var(--font-body);
}
.f-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 0;
}
.f-name {
  margin: 8px 0 0;
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 19px;
  line-height: 1.12;
}
.place-link {
  color: inherit;
  text-decoration: none;
}
.place-link:hover {
  text-decoration: underline;
}
.f-meta {
  margin: 4px 0 0;
  font-size: 13px;
}
.dim {
  color: var(--ink-soft);
}
.f-desc {
  margin: 8px 0 0;
  font-size: 13.5px;
  line-height: 1.35;
}
.spacer {
  flex: 1;
}
.f-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}
.f-actions .btn {
  min-height: 34px;
  padding: 0 10px;
  font-size: 12.5px;
}
.deck-empty {
  display: grid;
  place-items: center;
  min-height: 260px;
  margin: 0;
  padding: 20px;
  border: 3px dashed rgba(60, 30, 10, 0.5);
  text-align: center;
  font-family: var(--font-hand);
  font-size: 24px;
}
.stamp {
  position: absolute;
  z-index: 2;
  top: 34px;
  padding: 4px 10px;
  border: 4px solid currentColor;
  border-radius: 8px;
  background: rgba(255, 253, 247, 0.85);
  font-family: var(--font-story);
  font-weight: 800;
  font-size: 22px;
  opacity: 0;
  transition: opacity 0.1s;
  pointer-events: none;
}
.keep-stamp {
  left: 16px;
  color: #2e6b46;
  rotate: -14deg;
}
.skip-stamp {
  right: 16px;
  color: #c2412d;
  rotate: 14deg;
}
.flyer.keep .keep-stamp,
.flyer.skip .skip-stamp {
  opacity: 1;
}

/* ---------- backpack ---------- */
/* a clean sheet of a spiral notepad */
.backpack {
  position: sticky;
  top: 20px;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  margin-top: 12px;
  padding: 28px 16px 16px;
  background: #fffdf7;
  box-shadow: 3px 7px 10px rgba(50, 25, 5, 0.35);
}
.backpack::before {
  content: "";
  position: absolute;
  top: -12px;
  left: 10px;
  right: 10px;
  height: 28px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='28'%3E%3Ccircle cx='13' cy='21' r='4' fill='%23d9d0bd'/%3E%3Crect x='9' y='1' width='8' height='22' rx='4' fill='none' stroke='%231f2a24' stroke-width='2'/%3E%3C/svg%3E") 0 0 / 26px 28px round no-repeat;
}
@media (min-width: 961px) {
  .feed-scroll {
    container-type: size;
  }
  /* no taller than the visible cork below its sticky offset (cqh leaves out the same 20px as top padding), so it stays in reach while the flyers scroll */
  .backpack {
    max-height: 100cqh;
  }
}
.bp-empty {
  margin: 0;
  font-family: var(--font-hand);
  font-size: 20px;
  line-height: 1.1;
}
.bp-list {
  min-height: 0;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  align-content: start;
  gap: 6px;
}
.bp-list li {
  display: flex;
  align-items: center;
  gap: 4px;
}
.bp-name {
  flex: 1;
  min-width: 0;
  font-family: var(--font-hand);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.05;
}
.mini {
  flex: none;
  min-height: 26px;
  padding: 0 9px;
  border: 2px solid #1f2a24;
  border-radius: 999px;
  background: #f5bf4f;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.mini.ghost {
  padding: 0 7px;
  background: transparent;
}

@media (max-width: 960px) {
  .notice-page {
    padding: 10px 10px 12px;
  }
  .back {
    position: relative;
    top: 0;
    left: 0;
    align-self: flex-start;
    margin-bottom: 6px;
  }
  .board-wrap {
    --roof-h: 72px;
    --lip-h: 14px;
    --frame-inset: 6px;
    --frame-pad: 14px;
    --frame-foot: 20px;
  }
  .cork-scroll {
    padding: 18px 12px 20px;
  }
  .p-post {
    display: none;
  }
  /* the backpack moves above the flyers so it stays in reach */
  .feed-body {
    grid-template-columns: minmax(0, 1fr);
  }
  .backpack {
    position: relative;
    top: 0;
    order: -1;
    align-self: start;
    max-height: 220px;
  }
  .attribution {
    margin-left: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .dealing .flyer,
  .dealing .head,
  .dealing .backpack {
    animation: none;
  }
}
</style>
