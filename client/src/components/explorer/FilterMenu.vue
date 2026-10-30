<script setup>

import { ref, computed, onMounted, onBeforeUnmount } from "vue";

const props = defineProps({
  modelValue: { type: Object, required: true }, // { checkpoint, maxDistanceKm, maxPrice, hiddenGem }
  defaults: { type: Object, required: true },
});
const emit = defineEmits(["update:modelValue"]);

const open = ref(false);
const root = ref(null);

const set = (key, value) =>
  emit("update:modelValue", { ...props.modelValue, [key]: value });
const reset = () => emit("update:modelValue", { ...props.defaults });

/** how many filters differ from the defaults → small badge on the button */
const activeCount = computed(
  () =>
    Object.keys(props.defaults).filter(
      (k) => props.modelValue[k] !== props.defaults[k],
    ).length,
);

const price = (n) => "$".repeat(n);

// close when tapping outside or pressing Esc
function onDocClick(e) {
  if (open.value && root.value && !root.value.contains(e.target))
    open.value = false;
}
function onKey(e) {
  if (e.key === "Escape") open.value = false;
}
onMounted(() => {
  document.addEventListener("click", onDocClick);
  document.addEventListener("keydown", onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", onDocClick);
  document.removeEventListener("keydown", onKey);
});
</script>

<template>
  <div ref="root" class="filter-menu">
    <button
      type="button"
      class="btn filter-btn"
      :aria-expanded="open"
      aria-controls="explorer-filters"
      data-cy="filters-button"
      @click="open = !open"
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
      class="scrim-mobile"
      aria-hidden="true"
      @click="open = false"
    />
    <div
      v-if="open"
      id="explorer-filters"
      class="menu card"
      role="dialog"
      aria-label="Filters"
    >
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
        <button
          type="button"
          class="btn btn-sm btn-primary"
          @click="open = false"
        >
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
.menu {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 40;
  width: 320px;
  padding: 18px;
  display: grid;
  gap: 16px;
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
.scrim-mobile {
  display: none;
}

/* phones: bottom sheet */
@media (max-width: 640px) {
  .scrim-mobile {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 39;
    background: rgba(42, 33, 23, 0.45);
  }
  .menu {
    position: fixed;
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: auto;
    border-radius: 18px 18px 0 0;
    padding: 20px 16px 24px;
  }
}
</style>
