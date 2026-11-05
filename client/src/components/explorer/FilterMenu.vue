<script setup>
import { ref, computed, nextTick, onBeforeUnmount } from "vue";
import { VIBES } from "@/utils/constants";
import VibeIcon from "@/components/common/VibeIcon.vue";

const props = defineProps({
  modelValue: { type: Object, required: true }, // { checkpoint, maxDistanceKm, maxPrice, hiddenGem }
  defaults: { type: Object, required: true },
  vibes: { type: Array, default: () => [] },
});
const emit = defineEmits([
  "update:modelValue",
  "toggle-vibe",
  "clear-vibes",
  "change-vibe",
]);

const open = ref(false);
const pop = ref(null);
const button = ref(null);

const set = (key, value) =>
  emit("update:modelValue", { ...props.modelValue, [key]: value });
const reset = () => {
  emit("update:modelValue", { ...props.defaults });
  emit("clear-vibes");
};

/** how many filters differ from the defaults → small badge on the button */
const activeCount = computed(
  () =>
    props.vibes.length +
    Object.keys(props.defaults).filter(
      (k) => props.modelValue[k] !== props.defaults[k],
    ).length,
);

const price = (n) => "$".repeat(n);

function onOutsideClick(e) {
  if (!pop.value?.contains(e.target) && !button.value?.contains(e.target))
    close(false);
}
function onKey(e) {
  if (e.key === "Escape") close();
}
async function show() {
  open.value = true;
  document.addEventListener("pointerdown", onOutsideClick);
  document.addEventListener("keydown", onKey);
  await nextTick();
  pop.value?.querySelector("button")?.focus();
}
function close(returnFocus = true) {
  if (!open.value) return;
  open.value = false;
  document.removeEventListener("pointerdown", onOutsideClick);
  document.removeEventListener("keydown", onKey);
  if (returnFocus) button.value?.focus();
}
const toggle = () => (open.value ? close() : show());
onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onOutsideClick);
  document.removeEventListener("keydown", onKey);
});
</script>

<template>
  <div class="filter-menu">
    <button
      ref="button"
      type="button"
      class="btn filter-btn"
      :aria-expanded="open"
      aria-controls="explorer-filters"
      data-cy="filters-button"
      @click="toggle"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
        <circle cx="16" cy="6" r="2" />
        <circle cx="10" cy="12" r="2" />
        <circle cx="18" cy="18" r="2" />
      </svg>
      Filters
      <span
        v-if="activeCount"
        class="badge"
        :aria-label="`${activeCount} active`"
        >{{ activeCount }}</span
      >
    </button>

    <div
      v-if="open"
      id="explorer-filters"
      ref="pop"
      class="pop"
      role="dialog"
      aria-label="Filters"
    >
      <div class="field">
        <span>Vibes</span>
        <div class="vibes" role="group" aria-label="Filter by vibe">
          <button
            v-for="v in VIBES"
            :key="v.id"
            type="button"
            class="vibe"
            :aria-pressed="vibes.includes(v.id)"
            :data-cy="`vibe-${v.id}`"
            @click="emit('toggle-vibe', v.id)"
          >
            <VibeIcon :vibe="v.id" :size="15" /> {{ v.label }}
          </button>
          <button
            type="button"
            class="vibe change"
            data-cy="change-vibe"
            @click="emit('change-vibe')"
          >
            ↺ Change my vibe
          </button>
        </div>
      </div>

      <div class="field">
        <span>Crossing at</span>
        <div class="segmented" role="group" aria-label="Checkpoint">
          <button
            type="button"
            :aria-pressed="modelValue.checkpoint === 'woodlands'"
            @click="set('checkpoint', 'woodlands')"
          >
            Woodlands
          </button>
          <button
            type="button"
            :aria-pressed="modelValue.checkpoint === 'tuas'"
            @click="set('checkpoint', 'tuas')"
          >
            Tuas
          </button>
        </div>
      </div>

      <label class="field">
        Within
        {{
          modelValue.maxDistanceKm >= 60
            ? "any distance"
            : `${modelValue.maxDistanceKm} km`
        }}
        of the checkpoint
        <input
          :value="modelValue.maxDistanceKm"
          type="range"
          min="2"
          max="60"
          step="1"
          aria-label="Max distance in km"
          data-cy="filter-distance"
          @input="set('maxDistanceKm', Number($event.target.value))"
        />
      </label>

      <label class="field">
        Max price
        <select
          class="select"
          :value="modelValue.maxPrice"
          @change="
            set(
              'maxPrice',
              $event.target.value ? Number($event.target.value) : '',
            )
          "
        >
          <option value="">Any</option>
          <option v-for="n in 4" :key="n" :value="n">{{ price(n) }}</option>
        </select>
      </label>

      <label class="check">
        <input
          type="checkbox"
          :checked="modelValue.hiddenGem"
          @change="set('hiddenGem', $event.target.checked)"
        />
        <span
          >✦ Hidden gems only<br /><small class="muted"
            >Fewer than 150 Google reviews</small
          ></span
        >
      </label>

      <div class="row foot">
        <button
          type="button"
          class="btn btn-sm btn-ghost"
          :disabled="!activeCount"
          @click="reset"
        >
          Reset
        </button>
        <button type="button" class="btn btn-sm btn-primary" @click="close()">
          Done
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-menu {
  position: relative;
}
.filter-btn {
  gap: 8px;
}
.badge {
  display: inline-grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--ember);
  color: var(--card);
  font-size: 12px;
}
.pop {
  position: absolute;
  z-index: 30;
  top: calc(100% + 10px);
  right: 0;
  width: min(340px, calc(100vw - 40px));
  padding: 14px;
  display: grid;
  gap: 16px;
  border: 2px solid var(--ink);
  border-radius: 14px;
  background: var(--card);
  box-shadow: var(--shadow);
  animation: pop-in 0.16s ease-out;
}
.pop::before {
  /* the little point up to the Filters button */
  content: "";
  position: absolute;
  top: -9px;
  right: 34px;
  width: 14px;
  height: 14px;
  background: var(--card);
  border-left: 2px solid var(--ink);
  border-top: 2px solid var(--ink);
  rotate: 45deg;
}
@keyframes pop-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.vibes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.vibe {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  padding: 0 10px;
  border: 2px solid var(--ink);
  border-radius: 999px;
  background: #fbf6e9;
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.vibe[aria-pressed="true"] {
  background: #4f6b34;
  color: #fbf6e9;
}
.vibe.change {
  border-style: dashed;
  background: transparent;
}
.check {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}
.check input {
  width: 18px;
  height: 18px;
  margin-top: 1px;
  accent-color: var(--jungle);
}
.check .muted {
  font-weight: 400;
  font-size: 12px;
}
.segmented {
  display: flex;
}
.segmented button {
  flex: 1;
}
input[type="range"] {
  accent-color: var(--jungle);
  min-height: 36px;
}
.foot {
  justify-content: flex-end;
  gap: 8px;
}
@media (prefers-reduced-motion: reduce) {
  .pop {
    animation: none;
  }
}
</style>
