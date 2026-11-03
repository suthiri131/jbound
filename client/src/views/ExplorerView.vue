<script setup>

import { ref, reactive, computed, watch, onMounted } from "vue";
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

const vibes = ref(vibesFromUrl());
const q = ref(String(route.query.q || ""));
const filters = ref({ ...DEFAULT_FILTERS });

const places = ref([]);
const loading = ref(false);
const error = ref("");
const toast = ref({ message: "", linkTo: "", linkLabel: "" });

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
    deckIndex.value = 0;
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
watch(
  [vibes, filters],
  () => searchSoon(),
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
function clearSearch() {
  q.value = "";
  submitSearch();
}

function toggleVibe(id) {
  if (q.value) q.value = ""; // picking a category leaves the typed search
  const i = vibes.value.indexOf(id);
  i === -1 ? vibes.value.push(id) : vibes.value.splice(i, 1);
}

onMounted(async () => {
  search();
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

// ---------- the flyer deck + backpack ----------
// Swipe right (or ♥) to drop a place in your Backpack to plan with later; left (or ✕) to skip.
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
const deck = computed(() => places.value.filter((p) => !inBackpack(p)));
const deckIndex = ref(0);
const current = computed(() => deck.value[deckIndex.value] || null);
const upNext = computed(() => deck.value.slice(deckIndex.value + 1, deckIndex.value + 3));
const lastAction = ref(null); // { kind: 'keep' | 'skip', place } for undo

function keep(place = current.value) {
  if (!place) return;
  backpack.value.unshift({ key: keyOf(place), id: place.id || null, googlePlaceId: place.googlePlaceId || place.google_place_id || null, name: place.name, photo: place.photos?.[0] || null, vibes: place.vibes || [] });
  lastAction.value = { kind: "keep", place };
  // the kept card leaves the deck, so the index already points at the next one
}
function skip(place = current.value) {
  if (!place) return;
  lastAction.value = { kind: "skip", place };
  deckIndex.value++;
}
function undo() {
  const last = lastAction.value;
  if (!last) return;
  if (last.kind === "keep") backpack.value = backpack.value.filter((b) => b.key !== keyOf(last.place));
  else deckIndex.value = Math.max(0, deckIndex.value - 1);
  lastAction.value = null;
}
function dropFromBackpack(item) {
  backpack.value = backpack.value.filter((b) => b.key !== item.key);
}

// drag to swipe
const drag = ref({ active: false, startX: 0, dx: 0 });
const leaving = ref(null); // 'left' | 'right' while the card flies off
function onDown(e) {
  if (leaving.value) return;
  drag.value = { active: true, startX: e.clientX, dx: 0 };
  e.currentTarget.setPointerCapture?.(e.pointerId);
}
function onMove(e) {
  if (drag.value.active) drag.value.dx = e.clientX - drag.value.startX;
}
function onUp() {
  if (!drag.value.active) return;
  const { dx } = drag.value;
  drag.value = { active: false, startX: 0, dx: 0 };
  if (dx > 110) fling("right");
  else if (dx < -110) fling("left");
}
function fling(dir) {
  if (!current.value || leaving.value) return;
  leaving.value = dir;
  const place = current.value;
  setTimeout(() => {
    dir === "right" ? keep(place) : skip(place);
    leaving.value = null;
  }, 260);
}
function onDeckKey(e) {
  if (e.key === "ArrowRight") fling("right");
  else if (e.key === "ArrowLeft") fling("left");
  else return;
  e.preventDefault();
}
const cardStyle = computed(() => {
  if (leaving.value) return { transform: `translateX(${leaving.value === "right" ? 140 : -140}%) rotate(${leaving.value === "right" ? 24 : -24}deg)`, opacity: 0, transition: "transform .26s ease-in, opacity .26s" };
  const { dx, active } = drag.value;
  return { transform: `translateX(${dx}px) rotate(${dx / 18}deg)`, transition: active ? "none" : "transform .25s" };
});
const hint = computed(() => (drag.value.dx > 50 ? "keep" : drag.value.dx < -50 ? "skip" : ""));

/** Open the pin-to-trip dialog for a backpack item. */
function pinFromBackpack(item) {
  openPin({ id: item.id, googlePlaceId: item.googlePlaceId, name: item.name });
}
</script>

<template>
  <main class="notice-page">
    <SkyBackdrop />
    <RouterLink to="/" class="camp-back back">← Basecamp</RouterLink>

    <div class="board-wrap">
      <header class="roof">
        <h1 class="roof-title">Notice Board</h1>
      </header>

      <div class="frame">
        <div class="cork">
          <!-- left: what you are looking for -->
          <div class="col">
            <section class="note yellow" style="--tilt: -1.6deg" aria-label="Search">
              <i class="pin red" aria-hidden="true" />
              <h2 class="note-title hand-title">Looking for…</h2>
              <form class="search" role="search" @submit.prevent="submitSearch">
                <input v-model="q" type="search" placeholder="Bak kut teh, murals…" aria-label="Search places in JB" data-cy="explorer-search" @input="onSearchInput" />
              </form>
              <p v-if="q.trim()" class="note-sub">Results for “{{ q.trim() }}” · <button type="button" class="link" @click="clearSearch">clear</button></p>
              <FilterMenu v-model="filters" :defaults="DEFAULT_FILTERS" class="filters" />
            </section>

            <section class="note blue grow" style="--tilt: 1.2deg" aria-label="Filter by vibe">
              <i class="pin yellow-pin" aria-hidden="true" />
              <h2 class="note-title">Filter by vibe</h2>
              <div class="vibes" role="group" aria-label="Vibes">
                <button
                  v-for="v in VIBES"
                  :key="v.id"
                  type="button"
                  class="vibe"
                  :aria-pressed="!q.trim() && vibes.includes(v.id)"
                  :data-cy="`vibe-${v.id}`"
                  @click="toggleVibe(v.id)"
                >
                  <VibeIcon :vibe="v.id" :size="15" /> {{ v.label }}
                </button>
              </div>
              <p class="note-sub">{{ vibes.length ? `Feeling ${vibeSummary}` : 'A bit of everything around JB' }}</p>
            </section>
          </div>

          <!-- middle: the flyer you are deciding on -->
          <div class="deck" tabindex="0" aria-label="Flyer deck. Left arrow skips, right arrow packs it." @keydown="onDeckKey">
            <p v-if="loading" class="deck-empty" role="status">Pinning up fresh flyers…</p>
            <p v-else-if="error" class="deck-empty error-text" role="alert">{{ error }}</p>
            <p v-else-if="!current" class="deck-empty">
              {{ places.length ? 'That’s every flyer on the board. Try another vibe.' : 'No flyers for that. Try another vibe or search.' }}
            </p>

            <template v-else>
              <div v-for="(p, i) in upNext" :key="keyOf(p)" class="flyer under" :style="{ '--n': i + 1 }" aria-hidden="true" />
              <article
                :key="keyOf(current)"
                class="flyer top"
                :class="hint"
                :style="cardStyle"
                data-cy="place-card"
                @pointerdown="onDown"
                @pointermove="onMove"
                @pointerup="onUp"
                @pointercancel="onUp"
              >
                <i class="pin big-pin red" aria-hidden="true" />
                <img v-if="current.photos?.[0]" :src="assetUrl(current.photos[0])" :alt="current.name" class="f-photo" draggable="false" />
                <div v-else class="f-photo f-blank" :style="{ background: VIBE_TINT[current.vibes?.[0]] || '#f6d58e' }">
                  <VibeIcon :vibe="current.vibes?.[0] || 'eating'" :size="48" />
                </div>
                <p class="f-kicker">
                  <span v-for="v in (current.vibes || []).slice(0, 2)" :key="v">{{ VIBE_LABEL[v] }}</span>
                </p>
                <h2 class="f-name">{{ current.name }}</h2>
                <p v-if="current.description" class="f-desc">{{ current.description }}</p>
                <p class="f-tags">
                  <span v-if="current.rating" class="tag sand">★ {{ current.rating.toFixed(1) }}<small v-if="current.ratingCount || current.rating_count"> ({{ current.ratingCount || current.rating_count }})</small></span>
                  <span v-if="current.price_level" class="tag sand">{{ price(current.price_level) }}</span>
                  <span v-if="current.distanceKm != null" class="tag sky">{{ current.distanceKm.toFixed(1) }} km from CIQ</span>
                  <span v-if="current.isHiddenGem" class="tag gem">Hidden gem</span>
                  <span v-if="current.postCount" class="tag sage">{{ current.postCount }} tales</span>
                </p>
                <RouterLink v-if="placeLink(current)" :to="placeLink(current)" class="f-more" @pointerdown.stop>Read the full flyer →</RouterLink>
                <span class="stamp keep-stamp" aria-hidden="true">PACK IT</span>
                <span class="stamp skip-stamp" aria-hidden="true">NAH</span>
              </article>
            </template>
          </div>

          <!-- right: what comes next + what you kept -->
          <div class="col">
            <section class="note white" style="--tilt: 1.4deg" aria-label="Up next">
              <i class="pin yellow-pin" aria-hidden="true" />
              <h2 class="note-title story">Up next</h2>
              <template v-if="upNext[0]">
                <p class="next-name">{{ upNext[0].name }}</p>
                <p class="note-sub">{{ VIBE_LABEL[upNext[0].vibes?.[0]] || 'Around JB' }}<template v-if="upNext[0].distanceKm != null"> · {{ upNext[0].distanceKm.toFixed(1) }} km</template></p>
              </template>
              <p v-else class="note-sub">This is the last flyer.</p>
            </section>

            <section class="note kraft grow" style="--tilt: -1deg" aria-labelledby="bp-title">
              <i class="pin green" aria-hidden="true" />
              <h2 id="bp-title" class="note-title">Backpack <small>{{ backpack.length }}</small></h2>
              <p v-if="!backpack.length" class="bp-empty">Places you pack land here, ready to pin to a trip.</p>
              <ul v-else class="bp-list">
                <li v-for="item in backpack" :key="item.key">
                  <span class="bp-name">{{ item.name }}</span>
                  <button type="button" class="mini" @click="pinFromBackpack(item)">Pin</button>
                  <button type="button" class="mini ghost" :aria-label="`Take ${item.name} out of the backpack`" @click="dropFromBackpack(item)">✕</button>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>

      <i class="post left" aria-hidden="true" />
      <i class="post right" aria-hidden="true" />
    </div>

    <div class="controls">
      <button type="button" class="round skip" aria-label="Skip this place" :disabled="!current" @click="fling('left')">✕</button>
      <p class="count">
        <strong>Swipe ← pass · → pack it</strong>
        <span>
          <template v-if="deck.length">Flyer {{ Math.min(deckIndex + 1, deck.length) }} of {{ deck.length }} · </template>{{ backpack.length }} packed
          <button v-if="lastAction" type="button" class="link" @click="undo">Undo</button>
        </span>
      </p>
      <button type="button" class="round keep" aria-label="Put this place in your backpack" :disabled="!current" @click="fling('right')">♥</button>
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
  gap: 10px;
  padding: 12px 20px 14px;
  font-family: var(--font-round);
  color: #1f2a24;
}
.back {
  position: absolute;
  z-index: 6;
  top: 16px;
  left: 18px;
}

/* ---------- the board itself ---------- */
.board-wrap {
  position: relative;
  flex: 1;
  min-height: 560px;
  width: min(100%, 1180px);
  display: flex;
  flex-direction: column;
}
.roof {
  position: relative;
  z-index: 2;
  flex: none;
  display: grid;
  place-items: center;
  height: 72px;
  margin: 0 -2%;
  background: linear-gradient(90deg, #bf6a48 50%, #9c4d31 50%);
  clip-path: polygon(50% 0, 100% 86%, 100% 100%, 0 100%, 0 86%);
  border-bottom: 10px solid #5c3520;
}
.roof-title {
  margin: 12px 0 0;
  color: #fff8ea;
  font-family: var(--font-story);
  font-weight: 800;
  font-size: 28px;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
}
.frame {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  display: flex;
  padding: 16px;
  background: #8a5a34;
  border-bottom: 12px solid #6f4426;
  box-shadow: 0 10px 18px rgba(0, 0, 0, 0.22);
}
.cork {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(200px, 250px) minmax(0, 1fr) minmax(200px, 250px);
  gap: 22px;
  padding: 20px 22px;
  background: radial-gradient(rgba(100, 62, 28, 0.35) 1.2px, transparent 1.6px) 0 0 / 9px 9px, #c9975f;
  box-shadow: inset 0 3px 10px rgba(60, 30, 10, 0.4);
}
.post {
  position: absolute;
  z-index: 0;
  top: 40px;
  bottom: -26px;
  width: 26px;
  background: #5c3520;
}
.post.left {
  left: 5%;
}
.post.right {
  right: 5%;
}

/* ---------- notes ---------- */
.col:first-child {
  position: relative;
  z-index: 2; /* the filter menu opens out over the flyer */
}
.col {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.note {
  position: relative;
  padding: 18px 14px 14px;
  rotate: var(--tilt);
  box-shadow: 0 6px 12px rgba(50, 25, 5, 0.3);
}
.note.grow {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.yellow {
  z-index: 3; /* the filter menu opens over the notes below */
  background: #fff3a6;
}
.blue {
  background: #aee2f2;
}
.white {
  background: #fffdf7;
}
.kraft {
  background: #f0d09d;
}
.pin {
  position: absolute;
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
.big-pin {
  top: -11px;
  width: 24px;
  height: 24px;
  margin-left: -12px;
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
.hand-title {
  font-family: var(--font-hand);
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: none;
}
.story {
  font-family: var(--font-story);
  font-size: 19px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: none;
}
.note-sub {
  margin: 8px 0 0;
  font-size: 12.5px;
  line-height: 1.25;
}
.next-name {
  margin: 0;
  font-weight: 700;
  line-height: 1.15;
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
.search input {
  width: 100%;
  min-height: 38px;
  padding: 0 10px;
  border: 2px solid #1f2a24;
  border-radius: 10px;
  background: #fffdf7;
  font: inherit;
  font-size: 14px;
}
.filters {
  margin-top: 8px;
}
.filters :deep(.filter-btn) {
  min-height: 34px;
  padding: 0 12px;
  font-size: 13px;
  box-shadow: none;
}
.filters :deep(.menu) {
  left: 0;
  right: auto; /* this note sits on the left of the board: open towards the middle */
}
.vibes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.vibe {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 30px;
  padding: 0 9px;
  border: 2px solid #1f2a24;
  border-radius: 999px;
  background: #fffdf7;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
.vibe[aria-pressed='true'] {
  background: #e2573c;
  color: #fff;
}
.bp-empty {
  margin: 0;
  font-family: var(--font-hand);
  font-size: 20px;
  line-height: 1.1;
}
.bp-list {
  flex: 1;
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

/* ---------- the flyer ---------- */
.deck {
  position: relative;
  z-index: 1;
  min-width: 0;
  min-height: 0;
  outline: none;
}
.deck:focus-visible {
  outline: 3px dashed #1f2a24;
  outline-offset: 6px;
}
.deck-empty {
  display: grid;
  place-items: center;
  height: 100%;
  margin: 0;
  padding: 20px;
  border: 3px dashed rgba(60, 30, 10, 0.5);
  text-align: center;
  font-family: var(--font-hand);
  font-size: 24px;
}
.flyer {
  position: absolute;
  inset: 0;
  background: #fffdf7;
  box-shadow: 0 8px 16px rgba(50, 25, 5, 0.35);
}
.under {
  translate: 0 calc(var(--n) * 5px);
  rotate: calc(var(--n) * 1.6deg - 0.6deg);
  z-index: calc(3 - var(--n));
  background: #f6eedb;
}
.top {
  z-index: 5;
  display: flex;
  flex-direction: column;
  padding: 14px 14px 12px;
  rotate: -1deg;
  cursor: grab;
  touch-action: pan-y;
  user-select: none;
  animation: deal 0.3s ease-out;
}
.top:active {
  cursor: grabbing;
}
@keyframes deal {
  from {
    translate: 0 14px;
    scale: 0.96;
  }
}
.f-photo {
  flex: 1 1 0;
  min-height: 90px;
  width: 100%;
  object-fit: cover;
  border-radius: 3px;
  pointer-events: none;
}
.f-blank {
  display: grid;
  place-items: center;
}
.f-kicker {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  margin: 10px 0 0;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #2e6b46;
}
.f-name {
  margin: 2px 0 0;
  font-family: var(--font-story);
  font-weight: 800;
  font-size: clamp(22px, 2.2vw, 28px);
  line-height: 1.05;
}
.f-desc {
  margin: 6px 0 0;
  font-size: 14px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.f-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0 0;
}
.tag {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}
.tag small {
  opacity: 0.7;
}
.tag.sand {
  background: #f6d9a8;
}
.tag.sky {
  background: #aee2f2;
}
.tag.sage {
  background: #cfe6d3;
}
.tag.gem {
  background: #d9cdf2;
}
.f-more {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 700;
  color: #2e6b46;
}
.stamp {
  position: absolute;
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
  left: 24px;
  color: #2e6b46;
  rotate: -14deg;
}
.skip-stamp {
  right: 24px;
  color: #c2412d;
  rotate: 14deg;
}
.top.keep .keep-stamp,
.top.skip .skip-stamp {
  opacity: 1;
}

/* ---------- swipe controls, on the path below the board ---------- */
.controls {
  position: relative;
  z-index: 2;
  flex: none;
  display: flex;
  align-items: center;
  gap: 20px;
}
.round {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border: 2.5px solid #1f2a24;
  border-radius: 50%;
  box-shadow: 0 5px 0 rgba(0, 0, 0, 0.25);
  font-size: 22px;
  cursor: pointer;
}
.round:active {
  translate: 0 3px;
  box-shadow: none;
}
.round:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.round.skip {
  background: #fffdf7;
}
.round.keep {
  background: #2e6b46;
  color: #fffdf7;
}
.count {
  display: grid;
  justify-items: center;
  margin: 0;
  padding: 7px 18px;
  border: 2.5px solid #1f2a24;
  border-radius: 12px;
  background: #fffdf7;
  box-shadow: 0 5px 0 rgba(0, 0, 0, 0.25);
  font-size: 13.5px;
  line-height: 1.3;
}

@media (max-width: 960px) {
  .board-wrap {
    flex: none;
    min-height: 0;
  }
  .roof {
    margin: 0;
  }
  .back {
    position: relative;
    top: 0;
    left: 0;
    align-self: flex-start;
  }
  .cork {
    display: flex;
    flex-direction: column;
    padding: 18px 12px;
  }
  .deck {
    order: -1;
    height: 440px;
    flex: none;
  }
  .frame {
    padding: 10px;
  }
  .post {
    display: none;
  }
  .controls {
    position: sticky;
    bottom: 8px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .top {
    animation: none;
  }
}
</style>
