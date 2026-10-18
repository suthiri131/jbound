<script setup>
/** Scribble a stop - add a custom stop (no place from the Explorer). */
import { reactive, ref, watch, onBeforeUnmount } from "vue";
import { api, errorMessage } from "@/lib/api";
import { VIBES } from "@/utils/constants";
import { dayLabel } from "@/utils/format";

const props = defineProps({
  trip: { type: Object, required: true },
  item: { type: Object, default: null },
  dates: { type: Array, default: () => [] },
});
const emit = defineEmits(["added", "error", "saved", "close", "busy"]);

const open = ref(Boolean(props.item));
const saveError = ref("");
const busy = ref(false);
const locationQuery = ref("");
const locationResults = ref([]);
const locationLoading = ref(false);
const locationError = ref("");
const locationSearched = ref(false);
const selectedLocation = ref(props.item?.lat != null && props.item?.lng != null
  ? { lat: props.item.lat, lng: props.item.lng, name: "Saved location", address: "" }
  : null);
let locationChanged = false;
let searchVersion = 0;

function invalidateSearch() {
  searchVersion++;
  locationLoading.value = false;
  locationResults.value = [];
  locationError.value = "";
  locationSearched.value = false;
}
watch(locationQuery, invalidateSearch);
onBeforeUnmount(invalidateSearch);

async function searchLocation() {
  const query = locationQuery.value.trim();
  if (busy.value || query.length < 2 || locationLoading.value) return;
  const version = ++searchVersion;
  locationLoading.value = true;
  locationError.value = "";
  locationResults.value = [];
  locationSearched.value = false;
  try {
    const { data } = await api.get("/places/google/search", { params: { q: query } });
    if (version !== searchVersion) return;
    locationResults.value = data.filter(place => Number.isFinite(place.lat) && Number.isFinite(place.lng)).slice(0, 6);
    locationSearched.value = true;
  } catch (err) {
    if (version === searchVersion) locationError.value = errorMessage(err);
  } finally {
    if (version === searchVersion) locationLoading.value = false;
  }
}

function selectLocation(place) {
  selectedLocation.value = { name: place.name, address: place.address, lat: place.lat, lng: place.lng };
  locationChanged = true;
  invalidateSearch();
  locationQuery.value = "";
}
function clearLocation() {
  selectedLocation.value = null;
  locationChanged = true;
  invalidateSearch();
  locationQuery.value = "";
}
function resetLocation() {
  clearLocation();
  locationChanged = false;
}

const blank = () => ({
  title: "",
  day: props.dates[0] || "",
  time: "",
  vibe: "eating",
  notes: "",
  dwellMinutes: "",
  crossing: "",
  crossingDir: "to_jb",
});
const form = reactive(props.item ? {
  title: props.item.title,
  day: props.item.day || "",
  time: props.item.time?.slice(0, 5) || "",
  vibe: props.item.vibe || "",
  notes: props.item.notes || "",
  dwellMinutes: props.item.dwell_minutes ?? "",
  crossing: props.item.crossing || "",
  crossingDir: props.item.crossing_dir || "to_jb",
} : blank());

watch(
  () => props.dates,
  (dates) => {
    if (form.day && !dates.includes(form.day)) form.day = dates[0] || "";
  },
);

function cancel() {
  if (busy.value) return;
  Object.assign(form, blank());
  resetLocation();
  open.value = false;
  emit("close");
}

async function submit() {
  if (busy.value) return;
  busy.value = true;
  emit("busy", true);
  saveError.value = "";
  try {
    const empty = props.item ? null : undefined;
    const payload = {
      title: form.title,
      day: form.day || empty,
      time: form.time || empty,
      vibe: form.vibe || empty,
      notes: form.notes || empty,
      dwellMinutes:
        form.dwellMinutes === "" ? empty : Number(form.dwellMinutes),
      crossing: form.crossing || empty,
      crossingDir: form.crossing ? form.crossingDir : empty,
      ...(locationChanged ? {
        lat: selectedLocation.value?.lat ?? null,
        lng: selectedLocation.value?.lng ?? null,
      } : {}),
    };
    if (props.item) {
      await api.patch(`/trips/${props.trip.id}/itinerary/${props.item.id}`, payload);
    } else {
      await api.post(`/trips/${props.trip.id}/itinerary`, payload);
    }
    Object.assign(form, blank());
    resetLocation();
    open.value = false;
    emit(props.item ? "saved" : "added");
  } catch (err) {
    if (props.item) saveError.value = errorMessage(err);
    else emit("error", errorMessage(err));
  } finally {
    busy.value = false;
    emit("busy", false);
  }
}
</script>

<template>
  <div style="margin-top: 10px">
    <button
      v-if="!open"
      type="button"
      class="btn btn-ghost"
      data-cy="scribble"
      @click="open = true"
    >
      + Scribble a stop
    </button>
    <form v-else class="scribble" :aria-busy="busy" @submit.prevent="submit">
      <fieldset class="scribble-fields stack" :disabled="busy">
        <label class="field"
          >Stop name<input
            v-model="form.title"
            class="input"
            required
            maxlength="120"
            placeholder="Cross via Woodlands Causeway"
            data-cy="stop-title"
        /></label>
        <div class="location-field">
          <div class="location-heading">
            <label for="stop-location-search">Location <span class="optional">optional</span></label>
            <span class="location-region">Johor Bahru</span>
          </div>
          <div class="location-search-row">
            <div class="location-input-wrap">
              <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>
              <input id="stop-location-search" v-model="locationQuery" class="input" maxlength="80" placeholder="Place name or postal code" autocomplete="off" data-cy="stop-location" aria-describedby="stop-location-hint" @keydown.enter.prevent="searchLocation" />
            </div>
            <button type="button" class="btn btn-teal btn-sm location-search" :disabled="locationLoading || locationQuery.trim().length < 2" @click="searchLocation">{{ locationLoading ? 'Searching…' : 'Search' }}</button>
          </div>
          <p id="stop-location-hint" class="location-hint muted">Pick a place to add this stop to your route.</p>
          <div v-if="selectedLocation" class="selected-location" role="status">
            <span class="location-pin" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>
            </span>
            <div class="selected-location-copy">
              <span class="location-caption">Location selected</span>
              <strong>{{ selectedLocation.name }}</strong>
              <p v-if="selectedLocation.address">{{ selectedLocation.address }}</p>
              <p v-else>{{ selectedLocation.lat.toFixed(5) }}, {{ selectedLocation.lng.toFixed(5) }}</p>
            </div>
            <button type="button" class="location-clear" aria-label="Clear selected location" title="Clear location" @click="clearLocation">×</button>
          </div>
          <p v-if="locationLoading" class="location-hint" role="status">Searching Google Places…</p>
          <p v-if="locationError" class="error-text" role="alert">{{ locationError }}</p>
          <p v-if="locationSearched && !locationResults.length" class="location-hint" role="status">No places found. Try a different name.</p>
          <ul v-if="locationResults.length" class="location-results" aria-label="Location search results">
            <li v-for="place in locationResults" :key="place.googlePlaceId || place.id">
              <button type="button" class="location-result" @click="selectLocation(place)">
                <span class="result-pin" aria-hidden="true">↗</span>
                <span class="result-copy"><strong>{{ place.name }}</strong><span>{{ place.address }}</span></span>
                <span class="result-select" aria-hidden="true">Select</span>
              </button>
            </li>
          </ul>
          <p v-if="locationResults.length" class="location-hint muted">Results from Google Maps</p>
        </div>
        <div class="field-grid">
          <label class="field"
            >Day
            <select v-model="form.day" class="select">
              <option value="">Unscheduled</option>
              <option v-for="d in dates" :key="d" :value="d">
                {{ dayLabel(trip.start_date, d) }} · {{ d }}
              </option>
            </select>
          </label>
          <label class="field"
            >Time<input
              v-model="form.time"
              type="time"
              class="input"
              data-cy="stop-time-new"
          /></label>
          <label class="field"
            >Vibe
            <select v-model="form.vibe" class="select">
              <option v-if="item" value="">No vibe</option>
              <option v-for="v in VIBES" :key="v.id" :value="v.id">
                {{ v.label }}
              </option>
            </select>
          </label>
          <label class="field"
            >Stay (min)<input
              v-model="form.dwellMinutes"
              type="number"
              min="0"
              max="1440"
              class="input"
              placeholder="auto"
          /></label>
        </div>
        <div class="field-grid">
          <label class="field"
            >Border crossing?
            <select v-model="form.crossing" class="select">
              <option value="">No</option>
              <option value="woodlands">Woodlands</option>
              <option value="tuas">Tuas</option>
            </select>
          </label>
          <label v-if="form.crossing" class="field"
            >Direction
            <select v-model="form.crossingDir" class="select">
              <option value="to_jb">SG → JB</option>
              <option value="to_sg">JB → SG</option>
            </select>
          </label>
        </div>
        <label class="field"
          >Note<input
            v-model="form.notes"
            class="input"
            maxlength="500"
            placeholder="go early, the queue is real"
        /></label>
        <p v-if="saveError" class="error-text" role="alert">{{ saveError }}</p>
        <div class="form-actions">
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            @click="cancel"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="btn btn-primary btn-sm"
            :disabled="busy"
            data-cy="stop-add"
          >
            {{ busy ? (item ? "Saving…" : "Adding…") : (item ? "Save changes" : "Add stop") }}
          </button>
        </div>
      </fieldset>
    </form>
  </div>
</template>

<style scoped>
.location-field { min-width: 0; padding: 14px; border: 1.5px solid var(--line-strong); border-radius: 10px; background: var(--card); }
.location-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; font-size: 13px; font-weight: 700; }
.optional { margin-left: 4px; color: var(--ink-soft); font-weight: 400; font-size: 12px; }
.location-region { color: var(--jungle); font-size: 11px; font-weight: 600; }
.location-search-row { display: flex; align-items: stretch; gap: 8px; }
.location-input-wrap { position: relative; flex: 1; min-width: 0; }
.search-icon { position: absolute; top: 13px; left: 10px; color: var(--ink-soft); pointer-events: none; }
.scribble .location-input-wrap .input { padding-left: 34px; font-size: 13px; }
.location-search { flex: none; min-height: 44px; box-shadow: none; }
.location-hint { margin: 8px 0 0; font-size: 12px; line-height: 1.5; }
.selected-location { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding: 12px; border: 1.5px solid var(--jungle); border-radius: 8px; background: var(--paper); }
.location-pin { flex: none; color: var(--jungle); }
.selected-location-copy { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.location-caption { display: block; margin-bottom: 4px; color: var(--jungle); font-size: 10px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
.selected-location strong { display: block; font-size: 14px; }
.selected-location p { margin: 4px 0 0; font-size: 12px; color: var(--ink-soft); line-height: 1.5; }
.location-clear { flex: none; width: 30px; height: 30px; border: 0; border-radius: 6px; background: transparent; color: var(--ink-soft); font-size: 24px; cursor: pointer; }
.location-clear:hover { background: var(--paper-deep); color: var(--ink); }
.location-results { list-style: none; margin: 12px 0 0; padding: 0; max-height: 240px; overflow-y: auto; border: 1.5px solid var(--line-strong); border-radius: 8px; }
.location-result { display: flex; align-items: center; gap: 10px; width: 100%; padding: 12px 10px; border: 0; border-bottom: 1px solid var(--line); background: var(--paper); text-align: left; font: inherit; color: var(--ink); cursor: pointer; }
.location-results li:last-child .location-result { border-bottom: 0; }
.location-result:hover, .location-result:focus-visible { background: var(--paper-deep); }
.result-copy { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.result-copy strong { display: block; font-size: 13px; }
.result-copy > span { display: block; margin-top: 4px; font-size: 12px; line-height: 1.4; color: var(--ink-soft); }
.result-pin { color: var(--jungle); font-size: 18px; }
.result-select { font-size: 11px; font-weight: 700; color: var(--jungle); }
@container (max-width: 320px) {
  .location-search-row { flex-wrap: wrap; }
  .location-input-wrap { flex-basis: 100%; }
  .location-search { width: 100%; }
  .result-select { display: none; }
}
.scribble-fields {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  gap: 16px;
}
.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 12px;
  align-items: start;
}
.scribble .field {
  min-width: 0;
  gap: 8px;
}
.scribble .input,
.scribble .select {
  height: 44px;
  min-height: 44px;
  min-width: 0;
  padding: 0 12px;
  line-height: normal;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 4px;
}
.form-actions .btn {
  min-height: 40px;
}
@container (max-width: 280px) {
  .field-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
.scribble {
  container-type: inline-size;
  padding: 16px;
  border: 2px dashed var(--ink);
  border-radius: 12px;
  background: var(--paper);
}
</style>
