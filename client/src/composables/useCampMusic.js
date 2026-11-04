import { ref, watch } from 'vue';
import { hoursForMode, isNightAt } from '@/lib/camp/sky';
import { skyMode } from './useCampSky';

// Your tracks, in client/public/audio/. Played in order, looped, one list by day and one by night.
const PLAYLISTS = {
  day: ['/audio/day/day-1.mp3', '/audio/day/day-2.mp3', '/audio/day/day-3.mp3'],
  night: ['/audio/night/night-1.mp3', '/audio/night/night-2.mp3', '/audio/night/night-3.mp3'],
};
const VOLUME = 0.35;
const KEY = 'jbound:camp-music';

const readOn = () => {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
};

let instance = null;

/**
 * App-wide background music. Every caller gets the SAME player, so it keeps playing across pages.
 * Off by default; the choice is remembered. Browsers block sound until the visitor taps or presses a key,
 * so a remembered "on" waits for that first input. Follows the sky: day list by day, night list by night.
 */
export function useCampMusic() {
  if (!instance) instance = createPlayer();
  return instance;
}

function createPlayer() {
  const on = ref(readOn());
  const audio = new Audio();
  audio.preload = 'none';
  audio.volume = 0;

  // night or day, from the shared sky mode + Singapore's clock (checked every minute for real sunsets)
  const nowNight = () => isNightAt(hoursForMode(skyMode.value));
  const night = ref(nowNight());
  watch(skyMode, () => (night.value = nowNight()));
  setInterval(() => (night.value = nowNight()), 60_000);

  // where each playlist is up to; starts somewhere random so it isn't always the same first song
  const listFor = (isNight) => (isNight ? PLAYLISTS.night : PLAYLISTS.day) || [];
  const index = {
    day: Math.floor(Math.random() * Math.max(1, listFor(false).length)),
    night: Math.floor(Math.random() * Math.max(1, listFor(true).length)),
  };
  let current = null; // 'day' | 'night': the playlist loaded right now
  let failures = 0;

  let fadeTimer = null;
  function fadeTo(target, ms, done) {
    clearInterval(fadeTimer);
    const start = audio.volume;
    const steps = Math.max(1, Math.round(ms / 40));
    let i = 0;
    fadeTimer = setInterval(() => {
      i += 1;
      audio.volume = Math.min(1, Math.max(0, start + (target - start) * (i / steps)));
      if (i >= steps) {
        clearInterval(fadeTimer);
        done?.();
      }
    }, 40);
  }

  function load(which) {
    const list = listFor(which === 'night');
    if (!list.length) return false;
    current = which;
    index[which] %= list.length;
    audio.src = list[index[which]];
    return true;
  }

  async function play() {
    const which = night.value ? 'night' : 'day';
    if (current !== which || !audio.src) {
      if (!load(which)) return;
    }
    try {
      await audio.play();
      failures = 0;
      fadeTo(VOLUME, 1200);
    } catch {
      // blocked until the first tap/keypress: unlock() retries then
    }
  }

  function stop() {
    fadeTo(0, 500, () => audio.pause());
  }

  // next song when one finishes; the list wraps round to the start
  function next() {
    if (!current) return;
    index[current] += 1;
    load(current);
    if (on.value) audio.play().catch(() => {});
  }
  audio.addEventListener('ended', next);
  // a missing or broken file: skip it (but give up if the whole list is broken)
  audio.addEventListener('error', () => {
    if (!audio.src || !on.value) return;
    failures += 1;
    if (failures < listFor(current === 'night').length) next();
  });

  // the sky changed: fade out, swap playlist, fade back in
  watch(night, (isNight) => {
    const which = isNight ? 'night' : 'day';
    if (which === current) return;
    if (!on.value || audio.paused) {
      current = null; // load the right list next time it plays
      return;
    }
    fadeTo(0, 700, () => {
      load(which);
      audio.play().then(() => fadeTo(VOLUME, 1500)).catch(() => {});
    });
  });

  // tab in the background: pause; back again: carry on
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.pause();
    else if (on.value) play();
  });

  function toggle() {
    on.value = !on.value;
    try {
      localStorage.setItem(KEY, on.value ? 'on' : 'off');
    } catch {
      /* private mode: just not remembered */
    }
    if (on.value) play();
    else stop();
  }

  function unlock() {
    if (on.value && audio.paused) play();
  }
  if (on.value) {
    play();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  return { on, toggle };
}