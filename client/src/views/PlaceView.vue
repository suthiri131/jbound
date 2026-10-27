<script setup>
/**
 * Place page: what you see after clicking a place in the Explorer (like a Google Maps place page).
 * Route: /explorer/place/:googlePlaceId
 * GET /api/places/google/details/:googlePlaceId → Google details + reviews (+ our own id / Tales count)
 *
 * Skeleton: each section below is its own block, so it's easy to add more.
 * TODO(team): see the TODO notes in each section.
 */
import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, errorMessage, assetUrl } from "@/lib/api";
import { loadGoogleMaps, hasGoogleMaps, MAP_ID } from "@/lib/googleMaps";

const route = useRoute();
const router = useRouter();

const place = ref(null);
const loading = ref(true);
const error = ref("");
const tab = ref("overview"); // 'overview' | 'reviews' | 'about'
const photoIndex = ref(0);
const showAllHours = ref(false);
const copied = ref(false);

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "reviews", label: "Reviews" },
  { id: "about", label: "About" },
];

async function load() {
  loading.value = true;
  error.value = "";
  place.value = null;
  photoIndex.value = 0;
  try {
    const { data } = await api.get(
      `/places/google/details/${encodeURIComponent(route.params.googlePlaceId)}`,
    );
    place.value = data;
    document.title = `${data.name} · JBound`;
  } catch (err) {
    error.value = errorMessage(err, "Couldn't load this place.");
  } finally {
    loading.value = false;
  }
}
onMounted(load);
watch(
  () => route.params.googlePlaceId,
  (id) => id && load(),
);

// ---------- helpers ----------
const price = (n) => (n ? "$".repeat(n) : "");
const stars = (rating) => {
  const full = Math.round(rating || 0);
  return "★".repeat(full) + "☆".repeat(5 - full);
};
const heroPhoto = computed(
  () => place.value?.photos?.[photoIndex.value] ?? null,
);

// Today's line from Google's Monday-first weekday list (JS getDay() is Sunday-first).
const todayHours = computed(() => {
  const hours = place.value?.hours ?? [];
  if (hours.length !== 7) return null;
  return hours[(new Date().getDay() + 6) % 7];
});

/** Opens Google Maps directions. origin left out → Google uses the phone's location. */
const directionsUrl = computed(() => {
  const p = place.value;
  if (!p) return "#";
  const params = new URLSearchParams({
    api: "1",
    destination: `${p.lat},${p.lng}`,
    destination_place_id: p.googlePlaceId,
    travelmode: "driving",
  });
  return `https://www.google.com/maps/dir/?${params}`;
});

function goBack() {
  // came from the Explorer → keep its filters; opened from a shared link → go to the Explorer
  if (window.history.state?.back) router.back();
  else router.push("/explorer");
}

async function share() {
  const url = window.location.href;
  try {
    if (navigator.share)
      await navigator.share({ title: place.value.name, url });
    else {
      await navigator.clipboard.writeText(url);
      copied.value = true;
      setTimeout(() => (copied.value = false), 2000);
    }
  } catch {
    /* user cancelled the share sheet */
  }
}

// TODO(team): reuse the pin modal from ExplorerView here.
// Easiest: move it into components/explorer/PinModal.vue and use it in both pages.
function pinToTrip() {
  router.push({ path: "/explorer", query: { pin: place.value.googlePlaceId } });
}

// ---------- mini map ----------
const mapEl = ref(null);
const mapError = ref(
  hasGoogleMaps
    ? ""
    : "Add VITE_GOOGLE_MAPS_API_KEY to client/.env.local to show the map.",
);
let marker = null;

async function drawMap() {
  if (!hasGoogleMaps || !mapEl.value || !place.value) return;
  try {
    const { Map, AdvancedMarkerElement } = await loadGoogleMaps();
    const centre = { lat: place.value.lat, lng: place.value.lng };
    const map = new Map(mapEl.value, {
      center: centre,
      zoom: 16,
      mapId: MAP_ID,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: "cooperative",
    });
    marker = new AdvancedMarkerElement({
      map,
      position: centre,
      title: place.value.name,
    });
  } catch {
    mapError.value = "The map couldn't load.";
  }
}
// The map div only exists on the Overview tab, so draw it when that tab shows.
watch([place, tab], async () => {
  if (tab.value !== "overview") return;
  await nextTick();
  drawMap();
});
onBeforeUnmount(() => {
  if (marker) marker.map = null;
});
</script>

<template>
  <main class="container page place-page">
    <button type="button" class="btn btn-sm btn-ghost back" @click="goBack">
      ← Back to Explorer
    </button>

    <!-- loading skeleton -->
    <div
      v-if="loading"
      class="skeleton"
      aria-busy="true"
      aria-label="Loading place"
    >
      <div class="sk sk-hero" />
      <div class="sk sk-line" style="width: 45%" />
      <div class="sk sk-line" style="width: 30%" />
    </div>

    <p v-else-if="error" class="error-text" role="alert">
      {{ error }}
      <button type="button" class="btn btn-sm btn-ghost" @click="load">
        Try again
      </button>
    </p>

    <template v-else-if="place">
      <!-- 1. PHOTOS: one big photo + thumbnails -->
      <section class="gallery" aria-label="Photos">
        <figure class="hero card">
          <img
            v-if="heroPhoto"
            :src="assetUrl(heroPhoto.url)"
            :alt="place.name"
          />
          <div v-else class="placeholder-photo hero-empty">No photos yet</div>
          <figcaption v-if="heroPhoto?.credit" class="credit">
            Photo:
            <a
              v-if="heroPhoto.creditUrl"
              :href="heroPhoto.creditUrl"
              target="_blank"
              rel="noopener"
              >{{ heroPhoto.credit }}</a
            >
            <span v-else>{{ heroPhoto.credit }}</span>
          </figcaption>
        </figure>
        <ul v-if="place.photos.length > 1" class="thumbs">
          <li v-for="(ph, i) in place.photos" :key="ph.url">
            <button
              type="button"
              class="thumb"
              :aria-pressed="i === photoIndex"
              :aria-label="`Photo ${i + 1} of ${place.photos.length}`"
              @click="photoIndex = i"
            >
              <img :src="assetUrl(ph.thumb)" alt="" loading="lazy" />
            </button>
          </li>
        </ul>
      </section>

      <!-- 2. HEADER: name, rating, type, price, open now -->
      <header class="head">
        <h1 class="display display-lg">{{ place.name }}</h1>
        <p class="meta">
          <template v-if="place.rating">
            <strong>{{ place.rating.toFixed(1) }}</strong>
            <span class="stars" :aria-label="`${place.rating} out of 5`">{{
              stars(place.rating)
            }}</span>
            <button type="button" class="link" @click="tab = 'reviews'">
              ({{ place.ratingCount.toLocaleString() }})
            </button>
            <span aria-hidden="true">·</span>
          </template>
          <span v-if="place.kind">{{ place.kind }}</span>
          <template v-if="place.price_level"
            ><span aria-hidden="true">·</span>
            {{ price(place.price_level) }}</template
          >
        </p>
        <p class="row" style="gap: 8px; margin-top: 8px">
          <span
            v-if="place.openNow !== null"
            class="pill"
            :class="place.openNow ? 'open' : 'closed'"
          >
            {{ place.openNow ? "Open now" : "Closed now" }}
          </span>
          <span class="pill"
            >{{ place.distanceKm.woodlands }} km from Woodlands</span
          >
          <span class="pill">{{ place.distanceKm.tuas }} km from Tuas</span>
        </p>
      </header>

      <!-- 3. ACTIONS: the round-button row on Google Maps -->
      <nav class="actions" aria-label="Place actions">
        <a
          :href="directionsUrl"
          target="_blank"
          rel="noopener"
          class="btn btn-primary"
          data-cy="place-directions"
          >Directions ↗</a
        >
        <button
          type="button"
          class="btn btn-mustard"
          data-cy="place-pin"
          @click="pinToTrip"
        >
          + Pin to trip
        </button>
        <a
          v-if="place.website"
          :href="place.website"
          target="_blank"
          rel="noopener"
          class="btn btn-ghost"
          >Website ↗</a
        >
        <a
          v-if="place.phone"
          :href="`tel:${place.phone.replace(/\s/g, '')}`"
          class="btn btn-ghost"
          >Call</a
        >
        <button type="button" class="btn btn-ghost" @click="share">
          {{ copied ? "Link copied!" : "Share" }}
        </button>
        <RouterLink
          v-if="place.id"
          :to="`/tales/place/${place.id}`"
          class="btn btn-ghost"
        >
          Tales ({{ place.postCount }})
        </RouterLink>
      </nav>

      <!-- 4. TABS -->
      <div class="segmented tabs" role="tablist" aria-label="Place sections">
        <button
          v-for="t in TABS"
          :key="t.id"
          type="button"
          role="tab"
          :aria-selected="tab === t.id"
          :aria-pressed="tab === t.id"
          :data-cy="`place-tab-${t.id}`"
          @click="tab = t.id"
        >
          {{ t.label }}
        </button>
      </div>

      <!-- 4a. OVERVIEW: address, hours, phone, website + mini map -->
      <section
        v-if="tab === 'overview'"
        class="overview"
        role="tabpanel"
        aria-label="Overview"
      >
        <ul class="info card-flat">
          <li v-if="place.address">
            <span class="ico" aria-hidden="true">📍</span>
            <span>{{ place.address }}</span>
          </li>
          <li v-if="place.hours.length">
            <span class="ico" aria-hidden="true">🕒</span>
            <div>
              <button
                type="button"
                class="link"
                :aria-expanded="showAllHours"
                @click="showAllHours = !showAllHours"
              >
                {{ todayHours || "Opening hours" }}
                {{ showAllHours ? "▲" : "▼" }}
              </button>
              <ul v-if="showAllHours" class="hours">
                <li v-for="line in place.hours" :key="line">{{ line }}</li>
              </ul>
            </div>
          </li>
          <li v-if="place.phone">
            <span class="ico" aria-hidden="true">📞</span>
            <a :href="`tel:${place.phone.replace(/\s/g, '')}`">{{
              place.phone
            }}</a>
          </li>
          <li v-if="place.website">
            <span class="ico" aria-hidden="true">🌐</span>
            <a
              :href="place.website"
              target="_blank"
              rel="noopener"
              class="truncate"
              >{{ place.website.replace(/^https?:\/\//, "") }}</a
            >
          </li>
          <li v-if="place.mapsUrl">
            <span class="ico" aria-hidden="true">🗺️</span>
            <a :href="place.mapsUrl" target="_blank" rel="noopener"
              >Open in Google Maps ↗</a
            >
          </li>
          <!-- TODO(team): add border-crossing tip here, e.g. best time to cross from the Watcher. -->
        </ul>

        <div class="map-card card-flat">
          <div
            v-if="!mapError"
            ref="mapEl"
            class="map"
            role="img"
            :aria-label="`Map showing ${place.name}`"
          />
          <p v-else class="muted map-fallback">{{ mapError }}</p>
        </div>
      </section>

      <!-- 4b. REVIEWS: Google reviews + JBound Tales -->
      <section
        v-else-if="tab === 'reviews'"
        class="reviews"
        role="tabpanel"
        aria-label="Reviews"
      >
        <div v-if="place.rating" class="summary card-flat">
          <span class="big">{{ place.rating.toFixed(1) }}</span>
          <div>
            <span class="stars">{{ stars(place.rating) }}</span>
            <p class="muted" style="margin: 2px 0 0">
              {{ place.ratingCount.toLocaleString() }} Google reviews
            </p>
          </div>
        </div>

        <h2 class="display display-sm section-title">From Google</h2>
        <p v-if="!place.reviews.length" class="muted">No Google reviews yet.</p>
        <ul class="review-list">
          <li v-for="(r, i) in place.reviews" :key="i" class="review card-flat">
            <div class="row" style="gap: 10px">
              <img
                v-if="r.authorPhoto"
                :src="r.authorPhoto"
                alt=""
                class="avatar"
                referrerpolicy="no-referrer"
              />
              <div>
                <a
                  v-if="r.authorUrl"
                  :href="r.authorUrl"
                  target="_blank"
                  rel="noopener"
                  class="author"
                  >{{ r.author }}</a
                >
                <span v-else class="author">{{ r.author }}</span>
                <p class="muted small">
                  <span class="stars">{{ stars(r.rating) }}</span> ·
                  {{ r.when }}
                </p>
              </div>
            </div>
            <p class="review-text">{{ r.text }}</p>
          </li>
        </ul>
        <p class="attribution">
          Reviews from Google. Google shows up to 5 per place.
        </p>

        <h2 class="display display-sm section-title">From the JBound crew</h2>
        <!-- TODO(team): list Tales posts here (GET /api/places/:id gives the latest 20). -->
        <p class="muted">
          <template v-if="place.id">
            {{ place.postCount }} tale{{ place.postCount === 1 ? "" : "s" }} so
            far.
            <RouterLink :to="`/tales/place/${place.id}`"
              >Read them →</RouterLink
            >
          </template>
          <template v-else
            >No tales yet. Pin this place to a trip and be the first to share
            one.</template
          >
        </p>
      </section>

      <!-- 4c. ABOUT: description + place types -->
      <section v-else class="about" role="tabpanel" aria-label="About">
        <p v-if="place.description" class="lead" style="margin-top: 0">
          {{ place.description }}
        </p>
        <p v-else class="muted">No description from Google for this place.</p>
        <div class="row" style="gap: 6px; margin-top: 14px">
          <span v-for="t in place.types" :key="t" class="pill">{{
            t.replace(/_/g, " ")
          }}</span>
        </div>
        <!-- TODO(team): accessibility, parking, halal, payment options… (each needs a new field in PROFILE_MASK). -->
      </section>

      <p class="attribution" style="margin-top: 28px">Places data © Google</p>
    </template>
  </main>
</template>

<style scoped>
.back {
  margin-bottom: 16px;
}

/* photos */
.gallery {
  display: grid;
  gap: 10px;
}
.hero {
  position: relative;
  margin: 0;
  overflow: hidden;
  aspect-ratio: 16 / 7;
}
.hero img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.hero-empty {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
}
.credit {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(42, 33, 23, 0.75);
  color: var(--paper);
  font-size: 11px;
}
.credit a {
  color: inherit;
}
.thumbs {
  list-style: none;
  margin: 0;
  padding: 0 0 4px;
  display: flex;
  gap: 8px;
  overflow-x: auto;
}
.thumb {
  width: 84px;
  height: 64px;
  padding: 0;
  border: 2px solid var(--ink);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  background: var(--card);
  opacity: 0.7;
}
.thumb[aria-pressed="true"] {
  opacity: 1;
  outline: 3px solid var(--mustard);
  outline-offset: 1px;
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* header */
.head {
  margin-top: 22px;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 8px 0 0;
  color: var(--ink-soft);
}
.stars {
  color: var(--mustard);
  letter-spacing: 1px;
}
.pill.open {
  background: var(--sage);
}
.pill.closed {
  background: var(--clay);
}
.link {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}

/* actions */
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
  padding-bottom: 18px;
  border-bottom: 2px dashed var(--line);
}

/* tabs */
.tabs {
  margin-top: 18px;
}

/* overview */
.overview {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 18px;
  margin-top: 18px;
}
.info {
  list-style: none;
  margin: 0;
  padding: 6px 18px;
}
.info > li {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}
.info > li:last-child {
  border-bottom: 0;
}
.ico {
  width: 22px;
  flex: none;
  text-align: center;
}
.hours {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  font-size: 14px;
  line-height: 1.7;
}
.truncate {
  overflow-wrap: anywhere;
}
.map-card {
  overflow: hidden;
  min-height: 280px;
}
.map {
  width: 100%;
  height: 100%;
  min-height: 280px;
}
.map-fallback {
  padding: 20px;
}

/* reviews */
.reviews,
.about {
  margin-top: 18px;
}
.summary {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  max-width: 360px;
}
.summary .big {
  font-family: var(--font-display);
  font-size: 44px;
  line-height: 1;
}
.section-title {
  margin: 26px 0 12px;
}
.review-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
}
.review {
  padding: 14px 18px;
}
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1.5px solid var(--ink);
}
.author {
  font-weight: 700;
  color: var(--ink);
}
.small {
  margin: 2px 0 0;
  font-size: 13px;
}
.review-text {
  margin: 10px 0 0;
  line-height: 1.55;
  white-space: pre-line;
}
.attribution {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--ink-mute);
}

/* loading skeleton */
.sk {
  background: var(--paper-deep);
  border-radius: var(--radius);
  animation: pulse 1.2s ease-in-out infinite;
}
.sk-hero {
  aspect-ratio: 16 / 7;
}
.sk-line {
  height: 22px;
  margin-top: 14px;
  border-radius: 6px;
}
@keyframes pulse {
  50% {
    opacity: 0.5;
  }
}

@media (max-width: 760px) {
  .hero {
    aspect-ratio: 4 / 3;
  }
  .overview {
    grid-template-columns: 1fr;
  }
  .actions {
    flex-wrap: nowrap;
    overflow-x: auto;
  }
  .actions > * {
    flex: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sk {
    animation: none;
  }
}
</style>
