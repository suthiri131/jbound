<script setup>
/**
 * Well planned / Rushed / Overloaded verdict for the whole trip.
 * Data comes from GET /api/trips/:id/feasibility (server/services/logic/feasibility.js),
 * so the whole crew sees the same result.
 */
import { computed } from 'vue';

const props = defineProps({
  report: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  readOnly: { type: Boolean, default: false },
});
const emit = defineEmits(['fix']);

const THEME = [
  { bg: 'var(--sage)', border: 'var(--jungle)', ink: 'var(--jungle)' },
  { bg: 'var(--sand)', border: 'var(--ink)', ink: 'var(--ink)' },
  { bg: 'var(--clay)', border: 'var(--brick)', ink: 'var(--brick)' },
];
const TAG_BG = { 0: 'var(--card)', 1: 'var(--mustard)', 2: 'var(--brick)' };

const theme = computed(() => THEME[props.report?.level ?? 0]);
const multiDay = computed(() => (props.report?.days?.length ?? 0) > 1);
</script>

<template>
  <section
    v-if="report && report.days.length"
    class="feas"
    aria-label="Feasibility check"
    aria-live="polite"
    :style="{ background: theme.bg, borderColor: theme.border }"
    data-cy="feasibility"
  >
    <div class="row top">
      <div class="row" style="gap: 12px; flex-wrap: nowrap">
        <svg v-if="report.level === 0" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" :style="{ color: theme.ink }" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="m7 12.5 3.2 3.2L17 9" /></svg>
        <svg v-else-if="report.level === 1" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8.5" /><path d="M12 8.5V13l3 2M9.5 2.5h5M19 5.5l1.5-1.5" /></svg>
        <svg v-else width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" :style="{ color: theme.ink }" aria-hidden="true"><path d="M12 3 2 20.5h20Z" /><path d="M12 9.5v5M12 17.5v.5" /></svg>
        <div>
          <p class="eyebrow" style="font-size: 11px">Feasibility check</p>
          <p class="display verdict" data-cy="verdict">{{ report.label }}</p>
        </div>
      </div>
      <div v-if="multiDay" class="row" style="gap: 6px">
        <span v-for="d in report.days" :key="d.label" class="pill" :style="{ background: THEME[d.level].bg }">
          {{ d.label }} · {{ d.verdictLabel }}
        </span>
      </div>
    </div>

    <p class="summary">{{ loading ? 'Re-checking…' : report.summary }}</p>

    <p v-for="c in report.crossings" :key="c.itemId" class="crossing">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="14" r="4" /><circle cx="17" cy="14" r="4" /><path d="M11 14h2M5 10l2-5h3l1 5M19 10l-2-5h-3l-1 5" /></svg>
      {{ c.message }}
    </p>

    <ul v-if="report.warnings.length" class="warnings">
      <li v-for="(w, i) in report.warnings" :key="i">
        <span class="tag" :style="{ background: TAG_BG[w.level], color: w.level === 2 ? 'var(--card)' : 'var(--ink)' }">{{ w.tag }}</span>
        <span class="msg">{{ w.message }}</span>
        <button
          v-if="w.suggestedTime && w.itemId && !readOnly"
          type="button"
          class="btn btn-dark btn-sm"
          data-cy="feas-fix"
          @click="emit('fix', { itemId: w.itemId, time: w.suggestedTime })"
        >Move to {{ w.suggestedTime }}</button>
      </li>
    </ul>

    <details class="how">
      <summary>How we judge · shared with the whole crew</summary>
      <!-- TODO(team): keep this text in sync with THRESHOLDS / DWELL_BY_VIBE in server/services/logic/feasibility.js -->
      <p>
        Time at each stop: Eat 60 min, Culture 45, Do 90, Wild 60, unless the stop has its own estimate. Travel: walking under 0.8 km,
        about 30 km/h in town and 70 km/h on highways, plus 10 min to park. A leg with under 15 min to spare is <strong>Rushed</strong>;
        one more than 15 min short is <strong>Overloaded</strong>. Days over 11 hours are Rushed; over 13 hours or more than 6 stops are
        Overloaded. Checkpoint queues use Watcher's typical patterns.
      </p>
      <p>The check runs on the trip's shared data, so everyone in the crew sees the same verdict and it updates when anyone changes a stop or time.</p>
    </details>
  </section>
</template>

<style scoped>
.feas { margin-top: 18px; padding: 16px 18px; border: 2px solid; border-radius: 12px; }
.top { justify-content: space-between; gap: 10px; }
.verdict { margin: 2px 0 0; font-size: 24px; line-height: 1.1; }
.summary { margin: 10px 0 0; font-size: 14px; }
.crossing { margin: 8px 0 0; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
.warnings { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.warnings li { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 10px; padding: 10px 12px; background: var(--card); border: 1.5px solid var(--ink); border-radius: 8px; }
.tag { flex: none; padding: 2px 8px; border: 1.5px solid var(--ink); border-radius: 4px; font-size: 11px; font-weight: 800; letter-spacing: 1px; }
.msg { flex: 1 1 200px; font-size: 14px; line-height: 1.45; }
.how { margin-top: 12px; font-size: 13px; line-height: 1.55; }
.how summary { cursor: pointer; min-height: 32px; font-weight: 700; }
.how p { margin: 6px 0 0; }
</style>
