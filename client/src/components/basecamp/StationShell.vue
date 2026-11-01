<script setup>
/**
 * Layout for a feature that lives inside the camp: the station close up on the left (about three quarters of the
 * screen) with a panel popping up on the right. Ledger, Tales and Explorer all use it.
 * The panel goes in the default slot; extra HUD bits for the scene (badges, tips) go in the #scene slot.
 */
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useCampSky } from '@/composables/useCampSky';
import CampScene from '@/components/basecamp/CampScene.vue';

defineProps({
  station: { type: String, required: true }, // station id in lib/camp/world.js
  sign: { type: String, default: '' }, // wooden sign over the scene, e.g. "The Market Stall"
  label: { type: String, required: true }, // accessible name for the panel
  shift: { type: Number, default: 0.12 }, // nudge the station left so the panel does not cover it
});

const auth = useAuthStore();
const { mode, condition } = useCampSky();
const me = computed(() => ({ id: auth.user?.id || 'guest', name: auth.profile?.name || 'You', look: auth.profile?.look }));
</script>

<template>
  <main class="station-shell">
    <section class="scene" :aria-label="sign || label">
      <CampScene :focus="station" :focus-shift="shift" :me="me" :mode="mode" :condition="condition">
        <RouterLink to="/" class="back">← Walk back to camp</RouterLink>
        <p v-if="sign" class="sign" aria-hidden="true">{{ sign }}</p>
        <slot name="scene" />
      </CampScene>
    </section>

    <aside class="panel-wrap" :aria-label="label">
      <slot />
    </aside>
  </main>
</template>

<style scoped>
.station-shell {
  position: relative;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr minmax(360px, 460px);
  background: #8cc461;
  font-family: var(--font-round);
  color: #1f2a24;
}
.scene {
  position: relative;
  min-height: 420px;
}
.scene > :deep(.camp) {
  position: absolute;
  inset: 0;
}
.back,
.sign {
  position: absolute;
  z-index: 2;
  margin: 0;
  border: 2.5px solid #1f2a24;
  background: #fffdf7;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.18);
  font-weight: 700;
}
.back {
  top: 18px;
  left: 18px;
  padding: 8px 14px;
  border-radius: 12px;
  color: #1f2a24;
  text-decoration: none;
}
.back:hover {
  color: #1f2a24;
  translate: 0 -1px;
}
.sign {
  left: 50%;
  top: 18px;
  translate: -50% 0;
  padding: 6px 18px;
  border-radius: 8px;
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 20px;
}
.panel-wrap {
  position: relative;
  overflow-y: auto;
  padding: 22px 22px 40px 0;
}

@media (max-width: 900px) {
  .station-shell {
    grid-template-columns: 1fr;
    grid-template-rows: 42vh auto;
    overflow-y: auto;
  }
  .panel-wrap {
    overflow: visible;
    padding: 0 14px 40px;
    margin-top: -40px;
    z-index: 3;
  }
  .sign {
    display: none;
  }
}
</style>
