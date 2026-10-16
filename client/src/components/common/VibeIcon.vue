<script setup>
import { VIBE_ICON } from '@/utils/constants';

defineProps({
  vibe: { type: String, default: 'eating' },
  size: { type: Number, default: 20 },
  strokeWidth: { type: Number, default: 2 },
});
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" :stroke-width="strokeWidth" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="VIBE_ICON[vibe] || VIBE_ICON.eating" />
  </svg>
</template>
