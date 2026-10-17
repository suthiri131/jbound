<script setup>
import { computed } from 'vue';
import { PHASE_STAMP } from '@/utils/constants';
import { dateRange } from '@/utils/format';

const props = defineProps({
  trip: { type: Object, required: true },
  selected: { type: Boolean, default: false },
});

const stamp = computed(() => PHASE_STAMP[props.trip.phase] || PHASE_STAMP.planning);
const progress = computed(() => {
  const t = props.trip;
  if (t.phase === 'memory_box') return `${t.daysLeft} day${t.daysLeft === 1 ? '' : 's'} to add photos`;
  return `${t.doneCount ?? 0} of ${t.stopCount ?? 0} ticked`;
});
</script>

<template>
  <div class="cover" :class="{ selected }" :style="{ background: trip.cover_color || '#2E5A3C' }">
    <span class="eyebrow">{{ dateRange(trip.start_date, trip.end_date) }}</span>
    <span class="display name">{{ trip.name }}</span>
    <span class="foot">
      <span class="hand">{{ progress }}</span>
      <span class="badge">{{ stamp.label }}</span>
    </span>
  </div>
</template>

<style scoped>
.cover { display: block; text-align: left; padding: 16px 16px 18px; border: 2px solid var(--ink); border-radius: 14px 14px 6px 6px; color: var(--card); box-shadow: inset 0 -10px 0 rgba(0,0,0,.2), 2px 2px 0 var(--ink); transition: transform .15s; }
.cover.selected { transform: translateY(-8px); box-shadow: inset 0 -10px 0 rgba(0,0,0,.2), 5px 5px 0 var(--ink); }
.eyebrow { display: block; font-size: 11px; letter-spacing: 1.5px; }
.name { display: block; margin-top: 4px; font-size: 20px; line-height: 1.15; }
.foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 12px; }
.badge { flex: none; padding: 3px 7px; border: 2px solid currentColor; border-radius: 4px; font-size: 10px; font-weight: 800; letter-spacing: 1px; transform: rotate(5deg); }
</style>
