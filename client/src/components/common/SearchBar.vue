<script setup>
defineOptions({ inheritAttrs: false }); // data-cy, aria and the like belong on the input

defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, required: true },
});
defineEmits(['update:modelValue']);
</script>

<template>
  <label class="search">
    <span class="sr-only">{{ placeholder }}</span>
    <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
    <input v-bind="$attrs" :value="modelValue" class="input" type="search" :placeholder="placeholder" @input="$emit('update:modelValue', $event.target.value)" />
  </label>
</template>

<style scoped>
/* magnifier inside the bar on the left */
.search {
  position: relative;
  display: block;
  flex: 1 1 260px;
  min-width: 0;
}
.search-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  translate: 0 -50%;
  color: #5a4a36;
  pointer-events: none;
}
.input {
  width: 100%;
  height: 46px;
  min-height: 46px;
  margin: 0;
  padding-left: 46px;
  border-radius: 999px;
  line-height: normal;
}
</style>
