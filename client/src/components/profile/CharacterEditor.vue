<script setup>
/** Pick how you look when you walk around basecamp (and in your crewmates' camps). */
import { computed, ref, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { errorMessage } from '@/lib/api';
import { LOOK_OPTIONS, STYLE_LABEL, normaliseLook } from '@/lib/camp/look';
import AvatarFlat from '@/components/scene/AvatarFlat.vue';

const auth = useAuthStore();
const saved = computed(() => normaliseLook(auth.profile?.look));
const draft = ref({ ...saved.value });
watch(saved, (v) => (draft.value = { ...v }));

const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(saved.value));
const busy = ref(false);
const status = ref('');
const error = ref('');

const COLOR_ROWS = [
  { key: 'skin', label: 'Skin' },
  { key: 'hair', label: 'Hair colour' },
  { key: 'top', label: 'Top' },
  { key: 'bottom', label: 'Bottoms' },
];
const STYLE_ROWS = [
  { key: 'hairStyle', label: 'Hairstyle' },
  { key: 'hat', label: 'Hat' },
];

function shuffle() {
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  draft.value = Object.fromEntries(Object.keys(LOOK_OPTIONS).map((k) => [k, pick(LOOK_OPTIONS[k])]));
  status.value = '';
}

async function save() {
  if (busy.value || !dirty.value) return;
  busy.value = true;
  error.value = '';
  status.value = 'Saving your character…';
  try {
    await auth.setLook(draft.value);
    status.value = 'Saved. Your crew will see the new look at basecamp.';
  } catch (err) {
    status.value = '';
    error.value = errorMessage(err, 'We could not save your character. Please try again.');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="card-flat card-pad block character" aria-labelledby="character-title" :aria-busy="busy">
    <h2 id="character-title" class="display display-sm">Your camp character</h2>
    <p class="hint">This is you at basecamp. Crewmates on your trips see it walking around their camp too.</p>

    <div class="layout">
      <div class="stage"><AvatarFlat :look="draft" :height="190" /></div>

      <div class="controls">
        <fieldset v-for="row in COLOR_ROWS" :key="row.key" class="row-set">
          <legend>{{ row.label }}</legend>
          <div class="swatches">
            <label v-for="c in LOOK_OPTIONS[row.key]" :key="c" class="swatch" :style="{ '--c': c }">
              <input v-model="draft[row.key]" type="radio" :name="row.key" :value="c" class="sr-only" />
              <span class="sr-only">{{ row.label }} {{ c }}</span>
            </label>
          </div>
        </fieldset>

        <fieldset v-for="row in STYLE_ROWS" :key="row.key" class="row-set">
          <legend>{{ row.label }}</legend>
          <div class="styles">
            <label v-for="s in LOOK_OPTIONS[row.key]" :key="s" class="style-chip">
              <input v-model="draft[row.key]" type="radio" :name="row.key" :value="s" class="sr-only" />
              <span>{{ STYLE_LABEL[s] }}</span>
            </label>
          </div>
        </fieldset>

        <div class="row buttons">
          <button type="button" class="btn btn-primary" :aria-disabled="busy || !dirty" @click="save">Save character</button>
          <button type="button" class="btn btn-ghost" @click="shuffle">Surprise me</button>
          <button v-if="dirty" type="button" class="btn btn-ghost" @click="draft = { ...saved }">Undo changes</button>
        </div>
        <p class="status" role="status">{{ status }}</p>
        <p v-if="error" class="error-text" role="alert">{{ error }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.block h2 {
  margin-bottom: 4px;
}
.hint {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--ink-mute);
}
.layout {
  display: flex;
  flex-wrap: wrap;
  gap: 22px 28px;
  align-items: flex-start;
}
.stage {
  flex: none;
  display: grid;
  place-items: center;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: linear-gradient(#bfe3f0 62%, #8cc461 62%);
  border: 2px solid var(--ink);
  overflow: hidden;
}
.controls {
  flex: 1 1 300px;
  display: grid;
  gap: 12px;
  min-width: 0;
}
.row-set {
  margin: 0;
  padding: 0;
  border: 0;
}
legend {
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 700;
}
.swatches,
.styles {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.swatch {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 2px solid var(--ink);
  background: var(--c);
  cursor: pointer;
}
.swatch:has(input:checked) {
  box-shadow: 0 0 0 3px var(--card), 0 0 0 6px var(--ink);
}
.swatch:has(input:focus-visible),
.style-chip:has(input:focus-visible) {
  outline: 3px solid var(--ink);
  outline-offset: 4px;
}
.style-chip span {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 0 14px;
  border: 2px solid var(--ink);
  border-radius: 999px;
  background: var(--card);
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
}
.style-chip:has(input:checked) span {
  background: var(--ink);
  color: var(--paper);
}
.buttons {
  gap: 10px;
}
.status {
  margin: 0;
  min-height: 1.4em;
  font-size: 14px;
  font-weight: 600;
}
</style>
