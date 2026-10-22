<script setup>
const props = defineProps({
  page: { type: Number, required: true },
  totalPages: { type: Number, required: true },
  disabled: { type: Boolean, default: false },
  label: { type: String, default: 'Pages' },
});
const emit = defineEmits(['page-change']);

function changePage(value) {
  if (!props.disabled && value >= 1 && value <= props.totalPages && value !== props.page) {
    emit('page-change', value);
  }
}
</script>

<template>
  <nav v-if="totalPages > 1" class="pagination" :aria-label="label">
    <button type="button" class="btn btn-sm" :disabled="disabled || page <= 1" @click="changePage(page - 1)">Previous</button>
    <span class="muted" role="status">Page {{ page }} of {{ totalPages }}</span>
    <button type="button" class="btn btn-sm" :disabled="disabled || page >= totalPages" @click="changePage(page + 1)">Next</button>
  </nav>
</template>

<style scoped>
.pagination { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 12px; }
</style>
