<script setup>
import { nextTick, ref, watch, onMounted, onBeforeUnmount } from "vue";

const props = defineProps({
  trip: { type: Object, required: true },
  capacity: { type: Number, default: 7 },
  waiting: { type: Number, default: 0 }, // more archives queued behind this one
  busy: Boolean,
  error: { type: String, default: "" },
});
const emit = defineEmits(["clear", "swap"]);
const root = ref(null);
const swapBtn = ref(null);
const goBackBtn = ref(null);
const confirming = ref(false); // the second step of discarding
let previousFocus;
onMounted(() => {
  previousFocus = document.activeElement;
  swapBtn.value?.focus();
});
onBeforeUnmount(() => previousFocus?.focus());
// each step starts on its safe choice, so a stray Enter never discards anything
watch(confirming, async (now) => {
  await nextTick();
  (now ? goBackBtn : swapBtn).value?.focus();
});
function trapFocus(event) {
  event.preventDefault();
  if (props.busy) return;
  const buttons = [...root.value.querySelectorAll(".actions button")];
  buttons[
    (buttons.indexOf(document.activeElement) + 1) % buttons.length
  ]?.focus();
}
</script>

<template>
  <Teleport to="body">
    <div class="scrim" />
    <div
      ref="root"
      class="modal attic-full"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="attic-full-title"
      aria-describedby="attic-full-description"
      :aria-busy="busy"
      tabindex="-1"
      @keydown.tab="trapFocus"
    >
      <template v-if="confirming">
        <span class="eyebrow muted">Are you sure?</span>
        <h2 id="attic-full-title" class="display display-md">
          Discard “{{ trip.name }}”?
        </h2>
        <div id="attic-full-description">
          <p>
            It won't get a drawer in your tent, and you won't be able to bring
            it back afterwards.
          </p>
          <p class="hand muted note">The rest of the crew keeps their copy.</p>
        </div>
        <p v-if="error" class="error-text" role="alert">{{ error }}</p>
        <div class="row actions">
          <button
            ref="goBackBtn"
            type="button"
            class="btn btn-ghost"
            :disabled="busy"
            @click="confirming = false"
          >
            Go back
          </button>
          <button
            type="button"
            class="btn btn-ember"
            :disabled="busy"
            @click="emit('clear')"
          >
            {{ busy ? "Discarding…" : "Yes, discard it" }}
          </button>
        </div>
      </template>
      <template v-else>
        <span class="eyebrow muted">All {{ capacity }} drawers are taken</span>
        <h2 id="attic-full-title" class="display display-md">
          The tent is full.
        </h2>
        <div id="attic-full-description">
          <p>
            <strong>“{{ trip.name }}”</strong> just came up from the Memory Box,
            but there's no empty drawer for it. Discard it, or swap it with one
            of your old drawers.
          </p>
          <p class="hand muted note">
            Either way, this only changes your tent. The rest of the crew keeps
            their copy.
          </p>
          <p v-if="waiting" class="hand muted note">
            {{ waiting }} more trip{{ waiting === 1 ? " is" : "s are" }} waiting
            after this one.
          </p>
        </div>
        <p v-if="error" class="error-text" role="alert">{{ error }}</p>
        <div class="row actions">
          <button
            type="button"
            class="btn btn-ghost"
            :disabled="busy"
            @click="confirming = true"
          >
            Discard it
          </button>
          <button
            ref="swapBtn"
            type="button"
            class="btn btn-mustard"
            :disabled="busy"
            @click="emit('swap')"
          >
            Swap with a drawer
          </button>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.note {
  margin: 6px 0 0;
  font-size: 18px;
}
.actions {
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}
</style>
