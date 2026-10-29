<script setup>
/** One round sticker slapped on an attic drawer. Kinds match STICKER_KINDS on the server. */
defineProps({ kind: { type: String, required: true } });
</script>

<template>
  <svg class="sticker" viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="17" fill="#fbf6e9" stroke="#2a2117" stroke-width="2.5" />
    <g v-if="kind === 'star'" stroke="#2a2117" stroke-width="1.6" stroke-linejoin="round">
      <path d="M20 8.5l3.3 7 7.6.9-5.6 5.2 1.5 7.5L20 25.3l-6.8 3.8 1.5-7.5-5.6-5.2 7.6-.9z" fill="#e0a43b" />
    </g>
    <g v-else-if="kind === 'sun'" stroke="#c2502a" stroke-width="2.4" stroke-linecap="round">
      <path d="M20 7v4M20 29v4M7 20h4M29 20h4M10.8 10.8l2.8 2.8M26.4 26.4l2.8 2.8M10.8 29.2l2.8-2.8M26.4 13.6l2.8-2.8" />
      <circle cx="20" cy="20" r="5.5" fill="#e0a43b" stroke="none" />
    </g>
    <g v-else-if="kind === 'palm'" fill="none" stroke-linecap="round">
      <path d="M20 32c0-7 .5-12 1-17" stroke="#7a5a36" stroke-width="2.4" />
      <path d="M21 15c-3-4-8-4-10-1M21 15c3-4 8-4 10-1M21 15c-1-4 0-7 2-8M21 15c-4-1-7 1-8 4M21 15c4-1 7 1 8 4" stroke="#2e5a3c" stroke-width="2.4" />
    </g>
    <g v-else-if="kind === 'chili'">
      <path d="M26 11c-1 9-6 16-15 19 7-5 9-10 9-17z" fill="#b4471f" stroke="#2a2117" stroke-width="1.6" stroke-linejoin="round" />
      <path d="M20 13c1-2 3-3 6-2l1-3" fill="none" stroke="#2e5a3c" stroke-width="2.2" stroke-linecap="round" />
    </g>
    <path v-else-if="kind === 'heart'" d="M20 30s-10-6-10-13a5.5 5.5 0 0 1 10-3 5.5 5.5 0 0 1 10 3c0 7-10 13-10 13z" fill="#b4352a" stroke="#2a2117" stroke-width="1.6" />
    <g v-else-if="kind === 'car'" stroke="#2a2117" stroke-width="1.6" stroke-linejoin="round">
      <path d="M9 25v-5l3-6h14l4 6v5z" fill="#2e5a3c" />
      <path d="M14 15.5h5v4h-7zM21 15.5h4.5l2 4H21z" fill="#cfe0d9" />
      <circle cx="14" cy="26" r="2.6" fill="#2a2117" /><circle cx="26" cy="26" r="2.6" fill="#2a2117" />
    </g>
    <g v-else-if="kind === 'bowl'" stroke="#2a2117" stroke-width="1.6" stroke-linecap="round">
      <path d="M9 19h22a11 11 0 0 1-22 0z" fill="#f2cdb8" />
      <path d="M15 15c-1-2 1-3 0-5M20 15c-1-2 1-3 0-5M25 15c-1-2 1-3 0-5" fill="none" />
      <path d="M10 22c4 2 16 2 20 0" fill="none" stroke="#b4471f" />
    </g>
    <g v-else-if="kind === 'compass'" stroke="#2a2117" stroke-width="1.4">
      <circle cx="20" cy="20" r="11" fill="#f3ead3" />
      <path d="M20 10.5l2.6 9.5h-5.2z" fill="#b4352a" />
      <path d="M20 29.5l2.6-9.5h-5.2z" fill="#2a2117" />
    </g>
  </svg>
</template>

<style scoped>
.sticker { display: block; width: 100%; height: 100%; filter: drop-shadow(1px 2px 0 rgba(0, 0, 0, .35)); }
</style>
