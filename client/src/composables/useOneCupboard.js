import { onBeforeUnmount, onMounted, ref } from 'vue';

const QUERY = '(max-width: 720px)'; // the same width AtticScene's phone styles start at

/** True on phones, where the Archives' dresser and map chest become one cupboard with all 7 drawers. */
export function useOneCupboard() {
  const media = typeof window !== 'undefined' ? window.matchMedia?.(QUERY) : null;
  const one = ref(Boolean(media?.matches));
  const onChange = (e) => (one.value = e.matches);
  onMounted(() => media?.addEventListener?.('change', onChange));
  onBeforeUnmount(() => media?.removeEventListener?.('change', onChange));
  return one;
}
