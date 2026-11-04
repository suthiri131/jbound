import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { api } from '@/lib/api';
import { CONDITION_LABEL, flatSky, hoursForMode, isNightAt } from '@/lib/camp/sky';

const MODE_KEY = 'jbound:camp-sky';
const MODES = ['auto', 'day', 'night'];

const readMode = () => {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    return MODES.includes(saved) ? saved : 'auto';
  } catch {
    return 'auto';
  }
};

/**
 * The basecamp sky, shared by every page that shows the camp: Singapore time + NEA's Woodlands forecast,
 * plus the visitor's day/night override (remembered in localStorage).
 * `?weather=rain` (or clear/partly/cloudy/haze/storm) previews another sky.
 */

export const skyMode = ref(readMode());

export function useCampSky({ weather = true } = {}) {
  const mode = skyMode;
  const forced = new URLSearchParams(location.search).get('weather');
  const condition = ref(CONDITION_LABEL[forced] ? forced : 'clear');
  const forecast = ref('');
  const isNight = computed(() => isNightAt(hoursForMode(mode.value)));
  // the flat colours for 2D scenes
  const sky = computed(() => flatSky({ hours: hoursForMode(mode.value), condition: condition.value }));
  const modeLabel = computed(() => ({ auto: 'Sky follows Singapore time', day: 'Always day', night: 'Always night' })[mode.value]);

  function cycleMode() {
    mode.value = MODES[(MODES.indexOf(mode.value) + 1) % MODES.length];
    try {
      localStorage.setItem(MODE_KEY, mode.value);
    } catch {
      /* private mode: just not remembered */
    }
  }

  async function load() {
    if (CONDITION_LABEL[forced]) return;
    try {
      const { data } = await api.get('/weather');
      condition.value = data.condition;
      forecast.value = data.forecast;
    } catch {
      /* no forecast: keep a fair sky */
    }
  }

  let timer;
  onMounted(() => {
    if (!weather) return; // this page only cares about the time of day
    load();
    timer = setInterval(load, 10 * 60_000);
  });
  onBeforeUnmount(() => clearInterval(timer));

  return { mode, condition, forecast, forced: Boolean(CONDITION_LABEL[forced]), isNight, sky, modeLabel, cycleMode, conditionLabel: computed(() => CONDITION_LABEL[condition.value]) };
}
