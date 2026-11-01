<script setup>
/**
 * The 3D basecamp. You walk your character around (WASD / arrows / tap the ground) and step up to a station
 * to go in: the camera swoops to it, its door opens, and `enter` fires so the page can change route.
 *
 * Props:
 *  - focus: render one station close up with its door open and no controls (e.g. the Ledger page)
 *  - returnFrom: start zoomed in on this station and pull back (you just walked out of it)
 */
import { onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import * as THREE from 'three';
import { buildCamp, CAMP_RADIUS } from '@/lib/camp/world';
import { buildAvatar, lookFromId } from '@/lib/camp/avatar';
import { environmentFor, sgHours } from '@/lib/camp/environment';

const props = defineProps({
  me: { type: Object, default: null }, // { id, name, look }
  crew: { type: Array, default: () => [] }, // offline crewmates: [{ id, name, look }]
  live: { type: Object, default: () => ({}) }, // online crewmates by id: { name, look, x, z, ry, waveAt }
  subtitles: { type: Object, default: () => ({}) }, // station id -> one-liner under its name
  mode: { type: String, default: 'auto' }, // 'auto' | 'day' | 'night'
  condition: { type: String, default: 'clear' },
  focus: { type: String, default: null },
  focusShift: { type: Number, default: 0 }, // slide the close-up sideways (screen-widths) to leave room for a panel
  returnFrom: { type: String, default: null },
});
const emit = defineEmits(['enter', 'move', 'wave']);

const host = ref(null);
const canvasWrap = ref(null);
const labelEls = {};
const tagEls = {};
const nearby = ref(null); // station you are standing next to
const hovered = ref(null);
const entering = ref(null); // station being entered
const wipe = ref(props.returnFrom ? 'out' : null); // 'in' = iris closing as you step through, 'out' = opening as you walk back out
const ready = ref(false);
const people = shallowRef([]); // name tags: [{ id, name, live }]

const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let renderer, scene, camera, camp, raf, resizeObs, envTimer;
const clock = new THREE.Clock();
const player = { avatar: null, pos: new THREE.Vector3(0, 0, 8.5), ry: Math.PI, target: null, speed: 0, waveT: -1 };
const mates = new Map(); // id -> { avatar, pos, ry, target, wait, live, lookKey, waveT }
const keys = new Set();
const cam = {
  pos: new THREE.Vector3(),
  target: new THREE.Vector3(),
  tween: null, // { fromPos, fromTarget, toPos, toTarget, t, dur, done }
};
let doorTween = null; // { station, from, to, t, dur }
const doors = reactive({}); // station id -> open amount 0..1
let arrivalResolve = null;

// ---------- camera framing ----------

const OVERVIEW_POS = new THREE.Vector3(0, 13, 27);
const OVERVIEW_TARGET = new THREE.Vector3(0, 2.4, -2);

/** Pull back on narrow screens so the whole camp still fits. */
function overview(out = { pos: new THREE.Vector3(), target: new THREE.Vector3() }) {
  const aspect = camera ? camera.aspect : 1.6;
  const k = THREE.MathUtils.clamp(1.6 / aspect, 1, 2.3);
  out.target.copy(OVERVIEW_TARGET);
  out.pos.copy(OVERVIEW_TARGET).addScaledVector(OVERVIEW_POS.clone().sub(OVERVIEW_TARGET), k);
  // drift a little with the player so it feels alive, Overcooked-style
  out.target.x += player.pos.x * 0.18;
  out.pos.x += player.pos.x * 0.18;
  out.target.z += (player.pos.z - 6) * 0.08;
  out.pos.z += (player.pos.z - 6) * 0.08;
  return out;
}

function closeUp(station) {
  const target = station.camTarget.clone();
  // beside a panel the shot is wider than the swoop-in close-up
  const zoom = props.focus ? station.focusZoom : 1;
  const pos = station.camPos.clone().sub(target).multiplyScalar(zoom).add(target);
  if (props.focusShift && camera) {
    // move camera + target sideways along the screen's x axis so the station sits off-centre
    const right = new THREE.Vector3().subVectors(target, pos).cross(camera.up).normalize();
    const dist = pos.distanceTo(target);
    const shift = right.multiplyScalar(-props.focusShift * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    pos.add(shift);
    target.add(shift);
  }
  return { pos, target };
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function tweenCamera(to, dur) {
  return new Promise((done) => {
    if (reduceMotion || dur === 0) {
      cam.pos.copy(to.pos);
      cam.target.copy(to.target);
      cam.tween = null;
      done();
      return;
    }
    cam.tween = { fromPos: cam.pos.clone(), fromTarget: cam.target.clone(), to, t: 0, dur, done };
  });
}

function setDoor(stationId, value) {
  doors[stationId] = value;
  camp.stations.find((s) => s.id === stationId)?.setOpen(value);
}

function tweenDoor(stationId, to, dur, delay = 0) {
  if (reduceMotion) return setDoor(stationId, to);
  doorTween = { stationId, from: doors[stationId] || 0, to, t: -delay, dur };
}

// ---------- characters ----------

function placeAvatar(av, pos, ry) {
  av.group.position.copy(pos);
  av.group.rotation.y = ry;
}

function rebuildPlayer() {
  if (player.avatar) {
    scene.remove(player.avatar.group);
    player.avatar.dispose();
  }
  player.avatar = buildAvatar(props.me?.look);
  scene.add(player.avatar.group);
  placeAvatar(player.avatar, player.pos, player.ry);
}

function syncMates() {
  if (!scene) return;
  const wanted = new Map();
  for (const m of props.crew) wanted.set(m.id, { ...m, live: false });
  for (const [id, m] of Object.entries(props.live)) wanted.set(id, { ...(wanted.get(id) || {}), ...m, id, live: true });

  for (const [id, mate] of mates) {
    if (!wanted.has(id)) {
      scene.remove(mate.avatar.group);
      mate.avatar.dispose();
      mates.delete(id);
    }
  }
  const r = Math.random;
  for (const [id, info] of wanted) {
    const look = info.look || lookFromId(id);
    const lookKey = JSON.stringify(look);
    let mate = mates.get(id);
    if (!mate || mate.lookKey !== lookKey) {
      const pos = mate?.pos || randomSpot(r);
      if (mate) {
        scene.remove(mate.avatar.group);
        mate.avatar.dispose();
      }
      mate = { avatar: buildAvatar(look), pos, ry: r() * Math.PI * 2, target: null, wait: r() * 3, lookKey, waveT: -1 };
      scene.add(mate.avatar.group);
      mates.set(id, mate);
    }
    mate.live = info.live;
    mate.name = info.name;
    if (info.live && info.x !== undefined) mate.target = new THREE.Vector3(info.x, 0, info.z);
    if (info.live && info.ry !== undefined) mate.liveRy = info.ry;
    if (info.waveAt && info.waveAt !== mate.lastWave) {
      mate.lastWave = info.waveAt;
      mate.waveT = 0;
    }
  }
  people.value = [...mates.entries()].map(([id, m]) => ({ id, name: (m.name || 'Crewmate').split(' ')[0], live: m.live }));
}

function randomSpot(r = Math.random) {
  // somewhere near a station's doorstep, so idle crewmates look like they are hanging out
  const s = camp.stations[Math.floor(r() * camp.stations.length)];
  return new THREE.Vector3(s.approachPoint.x + (r() - 0.5) * 2.5, 0, s.approachPoint.z + (r() - 0.5) * 2.5);
}

/** Keep feet out of buildings, trees and the pond, and inside the island. */
function collide(pos) {
  for (const c of camp.colliders) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const d = Math.hypot(dx, dz);
    const min = c.r + 0.45;
    if (d < min && d > 0.0001) {
      pos.x = c.x + (dx / d) * min;
      pos.z = c.z + (dz / d) * min;
    }
  }
  const d = Math.hypot(pos.x, pos.z);
  if (d > CAMP_RADIUS) pos.multiplyScalar(CAMP_RADIUS / d);
}

const tmp = new THREE.Vector3();
function stepToward(body, target, speed, dt) {
  tmp.subVectors(target, body.pos);
  tmp.y = 0;
  const dist = tmp.length();
  if (dist < 0.08) return true;
  const step = Math.min(dist, speed * dt);
  tmp.normalize();
  body.pos.addScaledVector(tmp, step);
  body.ry = turn(body.ry, Math.atan2(tmp.x, tmp.z), dt);
  return dist - step < 0.08;
}

function turn(from, to, dt) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + d * Math.min(1, dt * 12);
}

// ---------- input ----------

const MOVE_KEYS = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };

function typing(e) {
  const el = e.target;
  return el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

function onKeyDown(e) {
  if (props.focus || entering.value || typing(e)) return;
  const k = e.key.toLowerCase();
  if (MOVE_KEYS[k]) {
    // arrows only move you when focus is on the camp itself, so they still scroll / work in other controls
    if (k.startsWith('arrow') && document.activeElement && document.activeElement !== document.body && !host.value?.contains(document.activeElement)) return;
    keys.add(k);
    player.target = null;
    e.preventDefault();
  } else if ((k === 'e' || k === ' ') && nearby.value && document.activeElement?.tagName !== 'BUTTON') {
    e.preventDefault();
    enter(nearby.value);
  } else if (k === 'q') {
    wave();
  }
}
function onKeyUp(e) {
  keys.delete(e.key.toLowerCase());
}
function onBlur() {
  keys.clear();
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function pick(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const stationHit = raycaster.intersectObjects(camp.stations.map((s) => s.group), true)[0];
  return { stationId: stationHit?.object.userData.station || null, ray: raycaster.ray };
}

function onPointerMove(e) {
  if (props.focus || entering.value || e.pointerType === 'touch') return;
  hovered.value = pick(e).stationId;
}

function onPointerDown(e) {
  if (props.focus || entering.value || e.button > 0) return;
  const { stationId, ray } = pick(e);
  if (stationId) return enter(stationId);
  const hit = ray.intersectPlane(groundPlane, new THREE.Vector3());
  if (hit) {
    collide(hit);
    player.target = hit;
  }
}

// ---------- going in / coming out ----------

async function enter(stationId) {
  if (entering.value || !camp) return;
  const station = camp.stations.find((s) => s.id === stationId);
  if (!station) return;
  entering.value = stationId;
  keys.clear();

  // walk to the doorstep first (skip the stroll if motion is reduced)
  if (reduceMotion) {
    player.pos.copy(station.approachPoint);
  } else if (player.pos.distanceTo(station.approachPoint) > 0.2) {
    player.target = station.approachPoint.clone();
    await new Promise((resolve) => (arrivalResolve = resolve));
  }
  player.target = null;
  player.ry = Math.atan2(station.x - player.pos.x, station.z - player.pos.z);

  tweenDoor(stationId, 1, 0.8, 0.35);
  const swooped = tweenCamera(closeUp(station), 1.25);
  setTimeout(() => (wipe.value = 'in'), reduceMotion ? 0 : 800);
  await swooped;
  await new Promise((r) => setTimeout(r, reduceMotion ? 0 : 420)); // let the iris finish closing
  emit('enter', station);
}

// ---------- environment ----------

let lastEnvKey = '';
function applyEnvironment(force = false) {
  if (!camp) return;
  const hours = sgHours();
  const key = `${props.mode}|${props.condition}|${Math.floor(hours * 12)}`; // re-tint every 5 minutes
  if (!force && key === lastEnvKey) return;
  lastEnvKey = key;
  const env = environmentFor({ hours, condition: props.condition, mode: props.mode });
  camp.setEnvironment(env);
  renderer.toneMappingExposure = 1;
  host.value?.style.setProperty('--camp-ink', env.night ? '#0f1b2d' : '#1f2a24');
  host.value?.classList.toggle('is-night', env.night);
}

// ---------- the loop ----------

const projected = new THREE.Vector3();
function placeOverlay(el, worldPos, yOffset = 0) {
  if (!el) return;
  projected.copy(worldPos);
  projected.y += yOffset;
  projected.project(camera);
  const hidden = projected.z > 1 || Math.abs(projected.x) > 1.2 || Math.abs(projected.y) > 1.2;
  el.style.visibility = hidden ? 'hidden' : 'visible';
  const w = renderer.domElement.clientWidth;
  const h = renderer.domElement.clientHeight;
  el.style.transform = `translate(-50%, -100%) translate(${((projected.x + 1) / 2) * w}px, ${((1 - projected.y) / 2) * h}px)`;
}

const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
let lastEmit = 0;

function frame() {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // --- you ---
  let moving = false;
  if (!props.focus && player.avatar) {
    let ix = 0;
    let iz = 0;
    for (const k of keys) {
      ix += MOVE_KEYS[k][0];
      iz += MOVE_KEYS[k][1];
    }
    if (ix || iz) {
      // camera-relative: "up" walks away from the camera
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      fwd.normalize();
      right.crossVectors(fwd, camera.up).normalize();
      const dir = new THREE.Vector3().addScaledVector(right, ix).addScaledVector(fwd, -iz).normalize();
      player.pos.addScaledVector(dir, 5.5 * dt);
      player.ry = turn(player.ry, Math.atan2(dir.x, dir.z), dt);
      moving = true;
    } else if (player.target) {
      const arrived = stepToward(player, player.target, 5.5, dt);
      moving = !arrived;
      if (arrived) {
        player.target = null;
        arrivalResolve?.();
        arrivalResolve = null;
      }
    }
    if (moving) collide(player.pos);
    player.speed += ((moving ? 1 : 0) - player.speed) * Math.min(1, dt * 10);
    placeAvatar(player.avatar, player.pos, player.ry);
    player.avatar.animate(dt, player.speed);
    if (player.waveT >= 0) {
      player.waveT += dt;
      if (player.waveT < 1.6) player.avatar.wave(player.waveT);
      else {
        player.waveT = -1;
        player.avatar.stopWave();
      }
    }
    if (moving && t - lastEmit > 0.1) {
      lastEmit = t;
      emit('move', { x: player.pos.x, z: player.pos.z, ry: player.ry });
    }

    // which station are you next to?
    if (!entering.value) {
      let best = null;
      let bestD = 2.4;
      for (const s of camp.stations) {
        const d = s.approachPoint.distanceTo(player.pos);
        if (d < bestD) {
          best = s.id;
          bestD = d;
        }
      }
      if (nearby.value !== best) nearby.value = best;
    }
  }

  // --- crewmates ---
  for (const mate of mates.values()) {
    let speed = 0;
    if (mate.live) {
      if (mate.target) {
        const far = mate.pos.distanceTo(mate.target);
        if (far > 8) mate.pos.copy(mate.target); // they teleported (just joined, or a long gap)
        else if (!stepToward(mate, mate.target, 6.5, dt)) speed = 1;
        else if (mate.liveRy !== undefined) mate.ry = turn(mate.ry, mate.liveRy, dt);
      }
    } else if (!props.focus) {
      // offline: amble between doorsteps
      if (mate.target) {
        if (stepToward(mate, mate.target, 2.2, dt)) {
          mate.target = null;
          mate.wait = 3 + Math.random() * 6;
        } else speed = 0.6;
        collide(mate.pos);
      } else if ((mate.wait -= dt) <= 0) mate.target = randomSpot();
    }
    mate.speed = (mate.speed || 0) + (speed - (mate.speed || 0)) * Math.min(1, dt * 10);
    placeAvatar(mate.avatar, mate.pos, mate.ry);
    mate.avatar.animate(dt, mate.speed);
    if (mate.waveT >= 0) {
      mate.waveT += dt;
      if (mate.waveT < 1.6) mate.avatar.wave(mate.waveT);
      else {
        mate.waveT = -1;
        mate.avatar.stopWave();
      }
    }
  }

  // --- camera ---
  if (cam.tween) {
    const tw = cam.tween;
    tw.t += dt / tw.dur;
    const k = ease(Math.min(1, tw.t));
    cam.pos.lerpVectors(tw.fromPos, tw.to.pos, k);
    cam.target.lerpVectors(tw.fromTarget, tw.to.target, k);
    if (tw.t >= 1) {
      cam.tween = null;
      tw.done();
    }
  } else if (!props.focus && !entering.value) {
    const o = overview();
    const k = Math.min(1, dt * 3);
    cam.pos.lerp(o.pos, k);
    cam.target.lerp(o.target, k);
  }
  camera.position.copy(cam.pos);
  camera.lookAt(cam.target);

  // --- doors ---
  if (doorTween) {
    doorTween.t += dt / doorTween.dur;
    if (doorTween.t > 0) {
      const k = ease(Math.min(1, doorTween.t));
      setDoor(doorTween.stationId, doorTween.from + (doorTween.to - doorTween.from) * k);
      if (doorTween.t >= 1) doorTween = null;
    }
  }

  camp.tick(t, dt);
  renderer.render(scene, camera);

  // --- HTML overlays follow their 3D anchors ---
  for (const s of camp.stations) placeOverlay(labelEls[s.id], s.labelAnchor);
  if (player.avatar) placeOverlay(tagEls.me, player.pos, 2.2);
  for (const [id, mate] of mates) placeOverlay(tagEls[id], mate.pos, 2.2);
}

function resize() {
  const el = canvasWrap.value;
  if (!el || !renderer) return;
  const w = el.clientWidth;
  const h = el.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (props.focus) {
    const station = camp.stations.find((s) => s.id === props.focus);
    const c = closeUp(station);
    cam.pos.copy(c.pos);
    cam.target.copy(c.target);
  }
}

function wave() {
  if (props.focus || !player.avatar) return;
  player.waveT = 0;
  emit('wave');
}

// ---------- lifecycle ----------

onMounted(() => {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  canvasWrap.value.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1.6, 0.5, 400);
  camp = buildCamp(scene);
  camp.stations.forEach((s) => (doors[s.id] = 0));

  rebuildPlayer();
  syncMates();
  applyEnvironment(true);
  envTimer = setInterval(() => applyEnvironment(), 60_000);

  resize();
  resizeObs = new ResizeObserver(resize);
  resizeObs.observe(canvasWrap.value);

  const start = props.focus || props.returnFrom;
  const station = start && camp.stations.find((s) => s.id === start);
  if (station) {
    // stand on the doorstep, door open, camera close
    player.pos.copy(station.approachPoint);
    player.ry = props.focus ? Math.atan2(cam.pos.x - player.pos.x, cam.pos.z - player.pos.z) : Math.atan2(-player.pos.x, 12 - player.pos.z);
    setDoor(station.id, 1);
    const c = closeUp(station);
    cam.pos.copy(c.pos);
    cam.target.copy(c.target);
    if (props.focus) player.ry = Math.atan2(c.pos.x - player.pos.x, c.pos.z - player.pos.z);
    if (!props.focus) {
      // walk out: pull back to the overview and shut the door behind you
      tweenDoor(station.id, 0, 0.7, 0.2);
      tweenCamera(overview(), 1.3);
    }
  } else {
    const o = overview();
    cam.pos.copy(o.pos);
    cam.target.copy(o.target);
  }
  placeAvatar(player.avatar, player.pos, player.ry);

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  frame();
  ready.value = true;
});

onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  clearInterval(envTimer);
  resizeObs?.disconnect();
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  window.removeEventListener('blur', onBlur);
  player.avatar?.dispose();
  mates.forEach((m) => m.avatar.dispose());
  camp?.dispose();
  renderer?.dispose();
  renderer?.forceContextLoss();
  renderer?.domElement.remove();
});

watch(() => props.me?.look, () => scene && rebuildPlayer(), { deep: true });
watch(() => [props.crew, props.live], syncMates, { deep: true });
watch(() => [props.mode, props.condition], () => applyEnvironment(true));

defineExpose({ enter, wave });

const highlighted = (id) => nearby.value === id || hovered.value === id || entering.value === id;
const stationList = [
  { id: 'watcher', name: 'Watcher' },
  { id: 'explorer', name: 'Explorer' },
  { id: 'trips', name: 'Trips' },
  { id: 'tales', name: 'Tales' },
  { id: 'archives', name: 'Archives' },
  { id: 'ledger', name: 'Ledger' },
];
const nearbyName = (id) => stationList.find((s) => s.id === id)?.name;
</script>

<template>
  <div
    ref="host"
    class="camp"
    :class="{ 'is-focus': focus, 'is-entering': entering }"
    tabindex="-1"
    @pointermove="onPointerMove"
    @pointerleave="hovered = null"
  >
    <div ref="canvasWrap" class="canvas" :style="{ cursor: hovered ? 'pointer' : 'default' }" @pointerdown="onPointerDown" />

    <div class="overlays" :class="{ ready }">
      <template v-if="!focus">
        <button
          v-for="s in stationList"
          :key="s.id"
          :ref="(el) => (labelEls[s.id] = el)"
          type="button"
          class="bubble"
          :class="{ hot: highlighted(s.id) }"
          :aria-label="`Go to ${s.name}${subtitles[s.id] ? ': ' + subtitles[s.id] : ''}`"
          @click="enter(s.id)"
        >
          <strong>{{ s.name }}</strong>
          <span v-if="subtitles[s.id]">{{ subtitles[s.id] }}</span>
        </button>
      </template>

      <span v-if="me" :ref="(el) => (tagEls.me = el)" class="tag me" aria-hidden="true">{{ me.id === 'guest' ? 'You' : `${(me.name || 'You').split(' ')[0]} (you)` }}</span>
      <span v-for="p in people" :key="p.id" :ref="(el) => (tagEls[p.id] = el)" class="tag" aria-hidden="true">
        <i v-if="p.live" class="dot" />{{ p.name }}
      </span>
    </div>

    <p v-if="!focus && nearby && !entering" class="prompt" aria-live="polite">
      <kbd>E</kbd> Enter {{ nearbyName(nearby) }}
    </p>

    <div class="hud-slot"><slot /></div>
    <div v-if="wipe" class="wipe" :class="wipe" aria-hidden="true" @animationend="wipe === 'out' && (wipe = null)" />
  </div>
</template>

<style scoped>
.camp {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  outline: none;
  touch-action: manipulation;
  font-family: var(--font-round);
}
.canvas,
.canvas :deep(canvas) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.overlays {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.4s;
}
.overlays.ready {
  opacity: 1;
}
.is-entering .overlays,
.is-entering .hud-slot {
  opacity: 0;
  pointer-events: none;
}
.hud-slot {
  transition: opacity 0.3s;
}

/* speech-bubble labels over each station */
.bubble {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: auto;
  display: grid;
  justify-items: center;
  gap: 1px;
  padding: 7px 14px 8px;
  margin-top: -12px;
  border: 2.5px solid var(--camp-ink, #1f2a24);
  border-radius: 14px;
  background: #fffdf7;
  color: var(--camp-ink, #1f2a24);
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.18);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, scale 0.15s;
  font: inherit;
}
.bubble::after {
  content: '';
  position: absolute;
  bottom: -9px;
  left: 50%;
  width: 12px;
  height: 12px;
  background: inherit;
  border-right: 2.5px solid var(--camp-ink, #1f2a24);
  border-bottom: 2.5px solid var(--camp-ink, #1f2a24);
  transform: translateX(-50%) rotate(45deg);
}
.bubble strong {
  font-size: 17px;
  font-weight: 700;
  line-height: 1.1;
}
.bubble span {
  font-size: 12.5px;
  font-weight: 500;
  opacity: 0.85;
}
.bubble.hot,
.bubble:hover,
.bubble:focus-visible {
  background: #f5bf4f;
  scale: 1.06;
}
.bubble:focus-visible {
  outline: 3px solid #fffdf7;
  outline-offset: 2px;
}
@media (max-width: 640px) {
  /* phones: names only, or the bubbles pile on top of each other */
  .bubble {
    padding: 4px 10px 5px;
    border-width: 2px;
  }
  .bubble strong {
    font-size: 14px;
  }
  .bubble span {
    display: none;
  }
}

.tag {
  position: absolute;
  left: 0;
  top: 0;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(20, 28, 24, 0.72);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.tag.me {
  background: #fffdf7;
  color: #1f2a24;
  border: 2px solid #1f2a24;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #5ee08a;
  box-shadow: 0 0 0 2px rgba(94, 224, 138, 0.35);
}

.prompt {
  position: absolute;
  left: 50%;
  bottom: 22px;
  translate: -50% 0;
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 2.5px solid #1f2a24;
  border-radius: 999px;
  background: #fffdf7;
  color: #1f2a24;
  font-weight: 700;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.18);
  animation: pop 0.2s ease-out;
}
kbd {
  display: inline-grid;
  place-items: center;
  min-width: 24px;
  height: 24px;
  border-radius: 6px;
  background: #1f2a24;
  color: #fffdf7;
  font: inherit;
  font-size: 13px;
}
@keyframes pop {
  from {
    scale: 0.8;
    opacity: 0;
  }
}

/* the door wipe: an iris closes on the doorway as you step through (and opens again when you come back out) */
.wipe {
  position: absolute;
  left: 50%;
  top: 55%;
  width: 0;
  height: 0;
  border-radius: 50%;
  box-shadow: 0 0 0 200vmax #1a1410;
  translate: -50% -50%;
  pointer-events: none;
}
.wipe.in {
  animation: iris-in 0.75s cubic-bezier(0.6, 0, 0.4, 1) forwards;
}
.wipe.out {
  animation: iris-in 0.9s cubic-bezier(0.6, 0, 0.4, 1) reverse forwards;
}
@keyframes iris-in {
  from {
    width: 300vmax;
    height: 300vmax;
  }
  to {
    width: 0;
    height: 0;
  }
}
</style>
