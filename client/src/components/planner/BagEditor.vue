<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useTripsStore } from "@/stores/trips";
import { errorMessage } from "@/lib/api";
import { COVER_COLORS } from "@/utils/constants";
import {
  BAG_BADGES,
  BAG_KINDS,
  DEFAULT_BADGES,
  MAX_BADGES,
  bagBadgesFor,
  bagColour,
  bagKindFor,
} from "@/utils/bags";
import TripBackpack from "./TripBackpack.vue";
import BagBadge from "./BagBadge.vue";

/** Restyle one trip's bag: pick a style, a colour and up to four badges, with a live preview. */
const props = defineProps({ trip: { type: Object, required: true } });
const emit = defineEmits(["close", "saved"]);
const trips = useTripsStore();

const kind = ref(bagKindFor(props.trip));
const coverColor = ref(props.trip.cover_color || COVER_COLORS[0]);
const badges = ref([...bagBadgesFor(props.trip)]);
// until someone touches the badges, switching style swaps in that style's default ones
const badgesTouched = ref(Array.isArray(props.trip.bag_badges));
const colours = [...new Set([...COVER_COLORS, coverColor.value])];

function pickKind(id) {
  kind.value = id;
  if (!badgesTouched.value) badges.value = [...(DEFAULT_BADGES[id] || [])];
}
function toggleBadge(id) {
  badgesTouched.value = true;
  if (badges.value.includes(id))
    badges.value = badges.value.filter((b) => b !== id);
  else if (badges.value.length < MAX_BADGES)
    badges.value = [...badges.value, id];
}
const full = computed(() => badges.value.length >= MAX_BADGES);

const busy = ref(false);
const error = ref("");
async function save() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    const data = await trips.update(props.trip.id, {
      coverColor: coverColor.value,
      bagKind: kind.value,
      bagBadges: badges.value,
    });
    emit("saved", data);
  } catch (err) {
    error.value = errorMessage(err, "Could not save this bag");
  } finally {
    busy.value = false;
  }
}

// a proper dialog: focus moves in, Tab stays inside, Esc closes, focus goes back to the bag you picked
const dialog = ref(null);
let previousFocus;
onMounted(() => {
  previousFocus = document.activeElement;
  dialog.value?.querySelector('[aria-checked="true"]')?.focus();
});
onBeforeUnmount(() => previousFocus?.focus?.());
function close() {
  if (!busy.value) emit("close");
}
function trapFocus(event) {
  const els = [...dialog.value.querySelectorAll("button")].filter(
    (el) => !el.disabled,
  );
  const first = els[0];
  const last = els.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="scrim" @click="close" />
    <div
      ref="dialog"
      class="modal bag-editor"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bag-editor-title"
      :aria-busy="busy"
      @keydown.esc.stop.prevent="close"
      @keydown.tab="trapFocus"
    >
      <header class="head">
        <p class="eyebrow">Pack it your way</p>
        <h2 id="bag-editor-title" class="display display-md">
          {{ trip.name }}'s bag
        </h2>
      </header>

      <div class="layout">
        <div class="preview" aria-hidden="true">
          <TripBackpack
            :trip="trip"
            :kind="kind"
            :cover-color="coverColor"
            :badges="badges"
          />
        </div>

        <div class="controls">
          <section aria-labelledby="bag-style-label">
            <h3 id="bag-style-label" class="label">Bag</h3>
            <div
              class="styles"
              role="radiogroup"
              aria-labelledby="bag-style-label"
            >
              <button
                v-for="k in BAG_KINDS"
                :key="k.id"
                type="button"
                role="radio"
                class="style"
                :aria-checked="kind === k.id"
                :disabled="busy"
                @click="pickKind(k.id)"
              >
                <span class="mini"
                  ><TripBackpack
                    :trip="trip"
                    :kind="k.id"
                    :cover-color="coverColor"
                    :badges="[]"
                    bare
                /></span>
                <span class="style-name">{{ k.label }}</span>
              </button>
            </div>
          </section>

          <section aria-labelledby="bag-colour-label">
            <h3 id="bag-colour-label" class="label">Colour</h3>
            <div
              class="swatches"
              role="radiogroup"
              aria-labelledby="bag-colour-label"
            >
              <button
                v-for="c in colours"
                :key="c"
                type="button"
                role="radio"
                class="swatch"
                :style="{ background: bagColour(c) }"
                :aria-checked="coverColor === c"
                :aria-label="`Colour ${c}`"
                :disabled="busy"
                @click="coverColor = c"
              />
            </div>
          </section>

          <section aria-labelledby="bag-badge-label">
            <h3 id="bag-badge-label" class="label">
              Badges
              <span class="count">{{ badges.length }} of {{ MAX_BADGES }}</span>
            </h3>
            <div class="badges" role="group" aria-labelledby="bag-badge-label">
              <button
                v-for="b in BAG_BADGES"
                :key="b.id"
                type="button"
                class="badge"
                :aria-pressed="badges.includes(b.id)"
                :disabled="busy || (full && !badges.includes(b.id))"
                @click="toggleBadge(b.id)"
              >
                <svg viewBox="-17 -17 34 34" aria-hidden="true">
                  <BagBadge :kind="b.id" />
                </svg>
                <span>{{ b.label }}</span>
              </button>
            </div>
            <p v-if="full" class="hint">
              Bag's full. Take a badge off to add another.
            </p>
          </section>
        </div>
      </div>

      <p v-if="error" class="error-text" role="alert">{{ error }}</p>
      <div class="row actions">
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="busy"
          @click="close"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="busy"
          @click="save"
        >
          {{ busy ? "Packing…" : "Save bag" }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.bag-editor {
  width: min(860px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  font-family: var(--font-round);
}
.head .eyebrow {
  margin: 0;
}
.head h2 {
  margin: 2px 0 0;
  text-align: left;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 260px) minmax(0, 1fr);
  gap: 24px;
  margin-top: 14px;
}
.preview {
  align-self: start;
  position: sticky;
  top: 0;
  padding: 14px 10px 6px;
  border-radius: 14px;
  background: repeating-linear-gradient(
    90deg,
    #f3e3bd 0 90px,
    #e3cc9a 90px 92px,
    #efdcb0 92px 180px,
    #e3cc9a 180px 182px
  );
}
.controls {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}
.label {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 8px;
  font-size: 15px;
}
.count {
  color: var(--ink-soft);
  font-size: 13px;
  font-weight: 600;
}

/* bag styles */
.styles {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}
.style {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 4px 8px;
  border: 2px solid var(--line);
  border-radius: 12px;
  background: var(--card);
  color: var(--ink);
  font: inherit;
  cursor: pointer;
}
.style[aria-checked="true"] {
  border-color: var(--ink);
  background: var(--sand);
  box-shadow: 0 3px 0 var(--ink);
}
.mini {
  width: 100%;
  max-width: 92px;
}
.style-name {
  font-size: 12px;
  font-weight: 700;
  line-height: 1.1;
  text-align: center;
}

/* colours */
.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.swatch {
  width: 44px;
  height: 44px;
  border: 2px solid var(--ink);
  border-radius: 50%;
  cursor: pointer;
}
.swatch[aria-checked="true"] {
  outline: 3px solid var(--mustard);
  outline-offset: 3px;
}

/* badges */
.badges {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.badge {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 4px 10px 4px 6px;
  border: 2px solid var(--line);
  border-radius: 999px;
  background: var(--card);
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}
.badge svg {
  flex: none;
  width: 34px;
  height: 34px;
}
.badge[aria-pressed="true"] {
  border-color: var(--ink);
  background: var(--sand);
  box-shadow: 0 3px 0 var(--ink);
}
.badge:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.hint {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--ink-soft);
}

.style:focus-visible,
.swatch:focus-visible,
.badge:focus-visible {
  outline: 3px solid var(--ember);
  outline-offset: 2px;
}
.actions {
  justify-content: flex-end;
  margin-top: 18px;
}

@media (max-width: 720px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .preview {
    position: static;
    max-width: 220px;
    justify-self: center;
    width: 100%;
  }
  .styles {
    gap: 6px;
  }
  .style {
    padding: 4px 2px 6px;
  }
  .style-name {
    font-size: 10px;
  }
  .badges {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
