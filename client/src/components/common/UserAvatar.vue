<script setup>

import { computed, ref, watch } from 'vue';
import { assetUrl } from '@/lib/api';
import { initials } from '@/utils/format';

const props = defineProps({
  name: { type: String, default: '' },
  url: { type: String, default: '' },
  size: { type: Number, default: 44 },
  alt: { type: String, default: '' },
});

const failed = ref(false);
watch(() => props.url, () => (failed.value = false));
const src = computed(() => (props.url && !failed.value ? assetUrl(props.url) : ''));
</script>

<template>
  <span class="user-avatar" :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.4)}px` }">
    <img v-if="src" :src="src" :alt="alt" @error="failed = true" />
    <span v-else aria-hidden="true">{{ initials(name) }}</span>
  </span>
</template>

<style scoped>
.user-avatar {
  display: inline-grid; place-items: center; flex: none; overflow: hidden;
  border-radius: 50%; background: var(--sage); color: var(--ink); font-weight: 800; line-height: 1;
}
.user-avatar img { width: 100%; height: 100%; object-fit: cover; }
</style>
