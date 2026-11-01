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
import StationShell from "@/components/basecamp/StationShell.vue";
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
  <StationShell station="explorer" sign="The Flyer Tree" label="Flyers">
    <section class="board">
      <header class="b-head">
        <h1 class="b-title">Flyers from the tree</h1>
        <p class="b-sub">Swipe right to pack it, left to skip. Quick for indecisive groups.</p>
      </header>

      <div class="tools">
        <form class="search" role="search" @submit.prevent="submitSearch">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <input v-model="q" type="search" placeholder="Bak kut teh, murals, durian…" aria-label="Search places in JB" data-cy="explorer-search" @input="onSearchInput" />
        </form>
        <FilterMenu v-model="filters" :defaults="DEFAULT_FILTERS" />
      </div>

      <div class="vibes" role="group" aria-label="Vibes">
        <button
          v-for="v in VIBES"
          :key="v.id"
          type="button"
          class="vibe"
          :aria-pressed="!q.trim() && vibes.includes(v.id)"
          :style="{ '--tint': VIBE_TINT[v.id] }"
          :data-cy="`vibe-${v.id}`"
          @click="toggleVibe(v.id)"
        >
          <VibeIcon :vibe="v.id" :size="16" /> {{ v.label }}
        </button>
      </div>
      <p class="b-sub" aria-live="polite">
        <template v-if="q.trim()">Results for “{{ q.trim() }}” · <button type="button" class="link" @click="clearSearch">clear</button></template>
        <template v-else>{{ vibes.length ? `Feeling ${vibeSummary}` : 'A bit of everything around JB' }}</template>
      </p>

      <!-- the deck -->
      <div class="deck" tabindex="0" aria-label="Flyer deck. Left arrow skips, right arrow packs it." @keydown="onDeckKey">
        <p v-if="loading" class="deck-empty" role="status">Pinning up fresh flyers…</p>
        <p v-else-if="error" class="error-text" role="alert">{{ error }}</p>
        <p v-else-if="!current" class="deck-empty">
          {{ places.length ? 'That’s every flyer on the tree. Try another vibe.' : 'No flyers for that. Try another vibe or search.' }}
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
            <span class="tape" aria-hidden="true" />
            <img v-if="current.photos?.[0]" :src="assetUrl(current.photos[0])" :alt="current.name" class="f-photo" draggable="false" />
            <div v-else class="f-photo f-blank" :style="{ background: VIBE_TINT[current.vibes?.[0]] || '#f6d58e' }">
              <VibeIcon :vibe="current.vibes?.[0] || 'eating'" :size="48" />
            </div>
            <p class="f-kicker">
              <span v-for="v in (current.vibes || []).slice(0, 2)" :key="v">{{ VIBE_LABEL[v] }}</span>
              <span v-if="current.distanceKm != null">{{ current.distanceKm.toFixed(1) }} km from CIQ</span>
            </p>
            <h2 class="f-name">{{ current.name }}</h2>
            <p v-if="current.description" class="f-desc">{{ current.description }}</p>
            <p class="f-tags">
              <span v-if="current.rating" class="tag">★ {{ current.rating.toFixed(1) }}<small v-if="current.ratingCount || current.rating_count"> ({{ current.ratingCount || current.rating_count }})</small></span>
              <span v-if="current.price_level" class="tag">{{ price(current.price_level) }}</span>
              <span v-if="current.isHiddenGem" class="tag gem">Hidden gem</span>
              <span v-if="current.postCount" class="tag">{{ current.postCount }} tales</span>
            </p>
            <RouterLink v-if="placeLink(current)" :to="placeLink(current)" class="f-more" @pointerdown.stop>Read the full flyer →</RouterLink>
            <span class="stamp keep-stamp" aria-hidden="true">PACK IT</span>
            <span class="stamp skip-stamp" aria-hidden="true">NAH</span>
          </article>
        </template>
      </div>

      <div class="controls">
        <button type="button" class="round skip" aria-label="Skip this place" :disabled="!current" @click="fling('left')">✕</button>
        <p class="count">
          <template v-if="deck.length">Flyer {{ Math.min(deckIndex + 1, deck.length) }} of {{ deck.length }}</template>
          <button v-if="lastAction" type="button" class="link" @click="undo">Undo</button>
        </p>
        <button type="button" class="round keep" aria-label="Put this place in your backpack" :disabled="!current" @click="fling('right')">♥</button>
      </div>

      <!-- backpack -->
      <section class="backpack" aria-labelledby="bp-title">
        <h2 id="bp-title" class="bp-title">🎒 Backpack <small>{{ backpack.length }}</small></h2>
        <p v-if="!backpack.length" class="b-sub">Places you pack show up here, ready to pin to a trip.</p>
        <ul v-else class="bp-list">
          <li v-for="item in backpack" :key="item.key">
            <img v-if="item.photo" :src="assetUrl(item.photo)" alt="" />
            <span v-else class="bp-dot" :style="{ background: VIBE_TINT[item.vibes?.[0]] || '#f6d58e' }" aria-hidden="true" />
            <span class="bp-name">{{ item.name }}</span>
            <button type="button" class="mini" @click="pinFromBackpack(item)">Pin to trip</button>
            <button type="button" class="mini ghost" :aria-label="`Take ${item.name} out of the backpack`" @click="dropFromBackpack(item)">✕</button>
          </li>
        </ul>
      </section>
    </section>

    <ToastMessage v-if="toast.message" :message="toast.message" :link-to="toast.linkTo" :link-label="toast.linkLabel" @close="toast = { message: '' }" />

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
  </StationShell>
</template>

<style scoped>
.board {
  padding: 20px 20px 22px;
  background: #fffdf7;
  border: 2.5px solid #1f2a24;
  border-radius: 18px;
  box-shadow: 0 8px 0 rgba(0, 0, 0, 0.15);
  display: grid;
  gap: 12px;
  animation: pop-in 0.5s cubic-bezier(0.2, 0.8, 0.3, 1.2) both;
}
@keyframes pop-in {
  from {
    opacity: 0;
    transform: translateX(30px) scale(0.96);
  }
}
.b-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 26px;
  line-height: 1.05;
}
.b-sub {
  margin: 2px 0 0;
  font-size: 13px;
  opacity: 0.8;
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
.tools {
  display: flex;
  gap: 8px;
  align-items: center;
}
.search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 12px;
  border: 2px solid #1f2a24;
  border-radius: 999px;
  background: #fffdf7;
}
.search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  font: inherit;
  font-size: 14px;
}
.search:focus-within {
  outline: 3px solid #1f2a24;
  outline-offset: 2px;
}
.vibes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.vibe {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 32px;
  padding: 0 10px;
  border: 2px solid #1f2a24;
  border-radius: 999px;
  background: #fffdf7;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.vibe[aria-pressed='true'] {
  background: var(--tint);
  box-shadow: inset 0 0 0 1px #1f2a24;
}

/* ---------- deck ---------- */
.deck {
  position: relative;
  height: 400px;
  margin-top: 6px;
  border-radius: 14px;
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
  border: 2.5px dashed rgba(31, 42, 36, 0.4);
  border-radius: 14px;
  text-align: center;
  font-family: var(--font-hand);
  font-size: 22px;
}
.flyer {
  position: absolute;
  inset: 0;
  border: 2.5px solid #1f2a24;
  border-radius: 6px;
  background: #fffaf0;
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.18);
}
.under {
  translate: 0 calc(var(--n) * 7px);
  scale: calc(1 - var(--n) * 0.04);
  rotate: calc(var(--n) * 2deg - 1deg);
  z-index: calc(3 - var(--n));
  background: #f6eedb;
}
.top {
  z-index: 5;
  display: flex;
  flex-direction: column;
  padding: 12px 12px 14px;
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
.tape {
  position: absolute;
  top: -12px;
  left: 50%;
  width: 80px;
  height: 24px;
  translate: -50% 0;
  rotate: -3deg;
  background: rgba(245, 191, 79, 0.75);
  border: 1px solid rgba(31, 42, 36, 0.2);
}
.f-photo {
  width: 100%;
  height: 170px;
  flex: none;
  object-fit: cover;
  border: 2px solid #1f2a24;
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
  gap: 4px 10px;
  margin: 10px 0 0;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #9e3b1b;
}
.f-name {
  margin: 2px 0 0;
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 24px;
  line-height: 1.05;
}
.f-desc {
  margin: 6px 0 0;
  font-size: 13.5px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.f-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: auto 0 0;
  padding-top: 8px;
}
.tag {
  padding: 2px 10px;
  border: 1.5px solid #1f2a24;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: #fffdf7;
}
.tag small {
  opacity: 0.7;
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
  top: 26px;
  padding: 4px 10px;
  border: 4px solid currentColor;
  border-radius: 8px;
  font-family: var(--font-display);
  font-size: 22px;
  opacity: 0;
  transition: opacity 0.1s;
  pointer-events: none;
}
.keep-stamp {
  left: 22px;
  color: #2e6b46;
  rotate: -14deg;
}
.skip-stamp {
  right: 22px;
  color: #9e3b1b;
  rotate: 14deg;
}
.top.keep .keep-stamp,
.top.skip .skip-stamp {
  opacity: 1;
}

.controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 4px;
}
.round {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border: 2.5px solid #1f2a24;
  border-radius: 50%;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.2);
  font-size: 22px;
  cursor: pointer;
}
.round:active {
  translate: 0 3px;
  box-shadow: none;
}
.round:disabled {
  opacity: 0.4;
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
  margin: 0;
  display: grid;
  justify-items: center;
  gap: 2px;
  padding: 6px 14px;
  border: 2px solid #1f2a24;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
}

.backpack {
  margin-top: 6px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #e9dcc0;
  border: 2px solid #1f2a24;
}
.bp-title {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 700;
}
.bp-title small {
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  margin-left: 4px;
  border-radius: 999px;
  background: #1f2a24;
  color: #fffdf7;
  font-size: 12px;
}
.bp-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}
.bp-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  background: #fffdf7;
}
.bp-list img,
.bp-dot {
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 6px;
  object-fit: cover;
  border: 1.5px solid #1f2a24;
}
.bp-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  font-size: 14px;
}
.mini {
  min-height: 28px;
  padding: 0 10px;
  border: 2px solid #1f2a24;
  border-radius: 999px;
  background: #f5bf4f;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.mini.ghost {
  background: transparent;
  padding: 0 8px;
}
@media (prefers-reduced-motion: reduce) {
  .top {
    animation: none;
  }
}
</style>
