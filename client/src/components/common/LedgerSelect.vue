<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps({
  id: { type: String, required: true },
  label: { type: String, required: true },
  modelValue: { type: String, default: '' },
  options: { type: Array, required: true },
  placeholder: { type: String, default: 'Select an option' },
});
const emit = defineEmits(['update:modelValue', 'change']);
const root = ref(null);
const trigger = ref(null);
const open = ref(false);
const active = ref(0);
const selected = computed(() => props.options.find(option => option.value === props.modelValue));
function reveal() {
  open.value = true;
  active.value = Math.max(0, props.options.findIndex(option => option.value === props.modelValue));
  scrollActive();
}
function scrollActive() {
  nextTick(() => document.getElementById(`${props.id}-option-${active.value}`)?.scrollIntoView({ block: 'nearest' }));
}
function choose(index) {
  const option = props.options[index];
  if (!option) return;
  emit('update:modelValue', option.value);
  emit('change', option.value);
  open.value = false;
  trigger.value?.focus({ preventScroll: true });
}
function onKey(event) {
  if (event.key === 'Tab') { open.value = false; return; }
  if (event.key === 'Escape') { open.value = false; event.preventDefault(); return; }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  if (!open.value) { reveal(); return; }
  if (event.key === 'Enter' || event.key === ' ') { choose(active.value); return; }
  if (event.key === 'Home') active.value = 0;
  else if (event.key === 'End') active.value = props.options.length - 1;
  else active.value = Math.max(0, Math.min(props.options.length - 1, active.value + (event.key === 'ArrowDown' ? 1 : -1)));
  scrollActive();
}
function outside(event) {
  if (!root.value?.contains(event.target)) open.value = false;
}
onMounted(() => document.addEventListener('pointerdown', outside));
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside));
</script>

<template>
  <div ref="root" class="ledger-select" @focusout="!root.contains($event.relatedTarget) && (open = false)">
    <button :id="id" ref="trigger" type="button" class="select-trigger" role="combobox"
      :aria-label="`${label}: ${selected?.label || placeholder}`" aria-haspopup="listbox"
      :aria-expanded="open" :aria-controls="`${id}-options`"
      :aria-activedescendant="open && options.length ? `${id}-option-${active}` : undefined"
      :title="selected?.label" @click="open ? (open = false) : reveal()" @keydown="onKey">
      <span>{{ selected?.label || placeholder }}</span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    <ul v-if="open" :id="`${id}-options`" role="listbox" :aria-label="label" class="select-options">
      <li v-for="(option, index) in options" :id="`${id}-option-${index}`" :key="option.value"
        role="option" :aria-selected="option.value === modelValue" :class="{ active: index === active }"
        @pointerdown.prevent @click="choose(index)">
        <span>{{ option.label }}</span><span v-if="option.value === modelValue" aria-hidden="true">✓</span>
      </li>
      <li v-if="!options.length" class="no-options">No options available</li>
    </ul>
  </div>
</template>

<style scoped>
.ledger-select { width: 100%; min-width: 0; text-align: left; color: #2a1b0e; font-family: var(--font-round); }
.select-trigger { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-width: 0; min-height: 46px; padding: 8px 16px; border: 2px solid #2a1b0e; border-radius: 999px; background: #fffdf7; color: inherit; font: inherit; font-size: 14px; font-weight: 700; box-shadow: 0 3px 0 #2a1b0e; cursor: pointer; text-align: left; }
.select-trigger > span { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.select-trigger svg { flex: none; }
.select-trigger:active { transform: translateY(2px); box-shadow: 0 1px 0 #2a1b0e; }
.select-trigger:focus-visible { outline: 3px solid #b4471f; outline-offset: 2px; }
.select-options { max-height: min(260px, 40dvh); overflow-y: auto; overscroll-behavior: contain; list-style: none; padding: 6px; margin: 8px 0 3px; border: 2px solid #2a1b0e; border-radius: 16px; background: #fffdf7; box-shadow: 0 3px 0 #2a1b0e; font-size: 14px; font-weight: 700; }
.select-options > li { display: flex; gap: 10px; justify-content: space-between; padding: 10px; border-radius: 10px; overflow-wrap: anywhere; cursor: pointer; }
.select-options > li > span:first-child { min-width: 0; }
.select-options > li[aria-selected='true'] { background: #e0a43b; }
.select-options > li.active { outline: 2px solid #b4471f; outline-offset: -2px; }
.select-options > li:hover { background: #f3e3bd; }
.no-options { opacity: .7; }
</style>
