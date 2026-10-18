<script setup>
/**
 * Explorer: find places by vibe and pin them to a trip's bucket list.
 * GET /api/places/google/search?q=&vibe=&…  → live Google Places results (key stays on the server)
 * ?pinTo=<tripId> preselects the trip in the pin modal (from Planner "+ Add from Explorer").
 */
import { ref, reactive, computed, watch, onMounted } from "vue";
import { useRoute } from "vue-router";
import { api, errorMessage, assetUrl } from "@/lib/api";
import { useTripsStore } from "@/stores/trips";
import { VIBES, VIBE_LABEL, VIBE_TINT } from "@/utils/constants";
import { dayLabel } from "@/utils/format";
import VibeIcon from "@/components/common/VibeIcon.vue";
import ToastMessage from "@/components/common/ToastMessage.vue";

const route = useRoute();
const trips = useTripsStore();

// Google search takes one vibe at a time, so `vibe` is a single id ('' = any).
const filters = reactive({
  vibe: "",
  hiddenGem: false,
  maxDistanceKm: 40,
  maxPrice: "",
  checkpoint: "woodlands",
  q: "",
});
const places = ref([]);
const loading = ref(false);
const error = ref("");
const toast = ref({ message: "", linkTo: "", linkLabel: "" });

// pin modal
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

function toggleVibe(id) {
  filters.vibe = filters.vibe === id ? "" : id;
}

let debounce;
async function search() {
  loading.value = true;
  error.value = "";
  try {
    const { data } = await api.get("/places/google/search", {
      params: {
        vibe: filters.vibe || undefined,
        hiddenGem: filters.hiddenGem || undefined,
        maxDistanceKm:
          filters.maxDistanceKm < 60 ? filters.maxDistanceKm : undefined,
        maxPrice: filters.maxPrice || undefined,
        checkpoint: filters.checkpoint,
        q: filters.q.trim() || undefined,
      },
    });
    places.value = data;
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    loading.value = false;
  }
}
// Google is billed per request, so wait a little before searching while typing.
watch(
  filters,
  () => {
    clearTimeout(debounce);
    debounce = setTimeout(search, 600);
  },
  { deep: true },
);

onMounted(async () => {
  search();
  await trips.fetch().catch(() => {});
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
    <span class="tag-stamp">Explorer</span>
    <h1 class="display display-lg" style="margin-top: 16px">
      Find a place by vibe.
    </h1>
    <p class="lead">
      Pick the terrain, set how far you'll drive from the checkpoint, and pin
      the good ones to a trip.
    </p>

    <section class="filters card-flat card-pad" aria-label="Filters">
      <p class="muted" style="margin: 0 0 12px; font-size: 13px">
        Live results from Google Maps · one vibe at a time
      </p>
      <div class="row" role="group" aria-label="Vibes">
        <button
          v-for="v in VIBES"
          :key="v.id"
          type="button"
          class="chip"
          :aria-pressed="filters.vibe === v.id"
          :data-cy="`vibe-${v.id}`"
          @click="toggleVibe(v.id)"
        >
          <VibeIcon :vibe="v.id" :size="18" /> {{ v.label }}
        </button>
        <button
          type="button"
          class="chip"
          :aria-pressed="filters.hiddenGem"
          @click="filters.hiddenGem = !filters.hiddenGem"
        >
          ✦ Hidden gems
        </button>
      </div>
      <div class="row" style="margin-top: 14px">
        <label class="field" style="flex: 2 1 240px"
          >Search<input
            v-model="filters.q"
            class="input"
            type="search"
            placeholder="bak kut teh, mural, durian…"
        /></label>
        <label class="field" style="flex: 2 1 220px">
          Within
          {{
            filters.maxDistanceKm >= 60
              ? "any distance"
              : `${filters.maxDistanceKm} km`
          }}
          of
          <input
            v-model.number="filters.maxDistanceKm"
            type="range"
            min="2"
            max="60"
            step="1"
            aria-label="Max distance in km"
          />
        </label>
        <label class="field" style="flex: 1 1 140px"
          >Checkpoint
          <select v-model="filters.checkpoint" class="select">
            <option value="woodlands">Woodlands</option>
            <option value="tuas">Tuas</option>
          </select>
        </label>
        <label class="field" style="flex: 1 1 120px"
          >Max price
          <select v-model="filters.maxPrice" class="select">
            <option value="">Any</option>
            <option v-for="n in 4" :key="n" :value="n">{{ price(n) }}</option>
          </select>
        </label>
      </div>
    </section>

    <p class="hand muted" style="margin: 20px 0 0" aria-live="polite">
      {{ loading ? "Scouting…" : `${places.length} places found` }}
    </p>
    <!-- Google requires attribution when showing Places data outside a Google map.
         TODO(team): also show each photo's authorAttributions (see Places API photo policies). -->
    <p v-if="places.length" class="attribution">Places data © Google</p>
    <p v-if="error" class="error-text" role="alert">{{ error }}</p>

    <ul class="grid">
      <li
        v-for="p in places"
        :key="p.id || p.googlePlaceId"
        class="card place"
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
            {{ p.name }}
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
          <blockquote v-if="p.communityQuote" class="hand quote">
            “{{ p.communityQuote.text }}”
            <cite>— {{ p.communityQuote.author }}</cite>
          </blockquote>
          <div class="spacer" />
          <div class="row" style="gap: 8px; margin-top: 12px">
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
              :to="`/tales?placeId=${p.id}`"
              class="btn btn-sm btn-ghost"
              >Read tales</RouterLink
            >
            <a
              v-if="p.mapsUrl || p.maps_url"
              :href="p.mapsUrl || p.maps_url"
              target="_blank"
              rel="noopener"
              class="btn btn-sm btn-ghost"
              >Google Maps ↗</a
            >
          </div>
        </div>
      </li>
    </ul>

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
          <RouterLink to="/planner?new=1">Pack a new trip</RouterLink> first.
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
.filters {
  margin-top: 24px;
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
.quote {
  margin: 10px 0 0;
  padding-left: 10px;
  border-left: 3px solid var(--mustard);
  font-size: 19px;
}
.quote cite {
  font-style: normal;
  font-size: 16px;
  color: var(--ink-mute);
}
input[type="range"] {
  accent-color: var(--jungle);
  min-height: 44px;
}
.attribution {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--ink-mute);
}
</style>
