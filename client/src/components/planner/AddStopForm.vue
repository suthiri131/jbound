<script setup>
/** Scribble a stop - add a custom stop (no place from the Explorer). */
import { reactive, ref, watch } from "vue";
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
      // TODO(team): add a map picker / geocoder so scribbled stops get lat/lng and show on the route map
    };
    if (props.item) {
      await api.patch(`/trips/${props.trip.id}/itinerary/${props.item.id}`, payload);
    } else {
      await api.post(`/trips/${props.trip.id}/itinerary`, payload);
    }
    Object.assign(form, blank());
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
