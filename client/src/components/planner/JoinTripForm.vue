<script setup>
import { ref } from "vue";
import { useTripsStore } from "@/stores/trips";
import { errorMessage } from "@/lib/api";

const emit = defineEmits(["joined"]);
const trips = useTripsStore();
const code = ref("");
const error = ref("");
const busy = ref(false);
const errId = `join-err-${Math.random().toString(36).slice(2, 8)}`;
const props = defineProps({
  compact: { type: Boolean, default: false },
});

function cleanCode(raw) {
  const text = raw.trim();
  const fromLink = text.match(/[?&]join=([a-z0-9]+)/i);
  return (fromLink ? fromLink[1] : text).replace(/\s+/g, "").toLowerCase();
}

async function submit() {
  if (busy.value) return;
  const value = cleanCode(code.value);
  if (!value) return;
  error.value = "";
  if (value.length < 4 || value.length > 32) {
    error.value =
      "That doesn't look like an invite code. Ask your friend to copy it again.";
    return;
  }
  busy.value = true;
  try {
    const trip = await trips.join(value);
    code.value = "";
    emit("joined", trip);
  } catch (err) {
    error.value = errorMessage(err, "Could not join that trip");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <form novalidate :class="{ compact: props.compact }" @submit.prevent="submit">
    <label class="field">
      <span :class="{ 'sr-only': props.compact }"
        >Join a crew with an invite code</span
      >
      <span class="row join-controls">
        <input
          v-model="code"
          class="input"
          maxlength="200"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          :placeholder="
            props.compact ? 'Join code, e.g. a3f9c21e' : 'e.g. a3f9c21e'
          "
          :disabled="busy"
          :aria-describedby="error ? errId : undefined"
          data-cy="join-code"
        />
        <button
          type="submit"
          class="btn btn-mustard btn-sm"
          :disabled="busy || !code.trim()"
          data-cy="join-submit"
        >
          {{ busy ? "Joining…" : "Join" }}
        </button>
      </span>
    </label>
    <p
      v-if="error"
      :id="errId"
      class="error-text"
      role="alert"
      style="margin: 6px 0 0"
    >
      {{ error }}
    </p>
  </form>
</template>

<style scoped>
.compact .join-controls {
  gap: 10px;
}
.compact .input {
  border-radius: 999px;
  padding-inline: 18px;
}
.compact .error-text {
  position: absolute;
  margin-top: 6px !important;
  padding: 4px 10px;
  border-radius: 8px;
  background: #f1dfb6;
}
.compact {
  position: relative;
}
.join-controls {
  gap: 16px;
  flex-wrap: nowrap;
}
.join-controls .btn {
  box-shadow: var(--shadow-sm);
}
.join-controls .btn:disabled {
  opacity: 1;
}
</style>
