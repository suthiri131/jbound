<script setup>
/**
 * The 3D basecamp. You walk your character around and step up to a station to go in: the camera swoops to it,
 * its door opens, and `enter` fires so the page can change route.
 * Desktop: WASD / arrows / click the ground, with the whole camp in view.
 * Phones and touch screens: an on-screen joystick, with the camera following close behind you.
 *
 * Props:
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
  returnFrom: { type: String, default: null },
  showLabels: { type: Boolean, default: true},
  traffic: { type: Object, default: () => ({}) },
  locked: { type: Array, default: () => [] },
  viewShift : { type: Object, default: () => ({ x: 0, y: 0}) },
});
const emit = defineEmits(['enter', 'move', 'wave', 'locked']);

const host = ref(null);
const canvasWrap = ref(null);
const labelEls = {};
const tagEls = {};
const nearby = ref(null); // station you are standing next to
const hovered = ref(null);
const entering = ref(null); // station being entered
const wipe = ref(props.returnFrom ? 'out' : null); // 'in' = iris closing as you step through, 'out' = opening as you walk back out
const ready = ref(false);
const COMPACT_QUERY = '(max-width: 700px), (pointer: coarse)';
const compactMedia = typeof window !== 'undefined' ? window.matchMedia?.(COMPACT_QUERY) : null;
const compact = ref(Boolean(compactMedia?.matches)); // small screen: follow camera instead of the overview
const onCompactChange = (e) => (compact.value = e.matches);
// touch screens only: joystick instead of tap-to-walk (a narrow desktop window still uses the mouse)
const TOUCH_QUERY = '(pointer: coarse)';
const touchMedia = typeof window !== 'undefined' ? window.matchMedia?.(TOUCH_QUERY) : null;
const touch = ref(Boolean(touchMedia?.matches));
const onTouchChange = (e) => (touch.value = e.matches);const knob = ref(null);
const people = shallowRef([]); // name tags: [{ id, name, live }]

const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let renderer, scene, camera, camp, raf, resizeObs, envTimer;
const clock = new THREE.Clock();
const player = { avatar: null, pos: new THREE.Vector3(0, 0, 8.5), ry: Math.PI, target: null, speed: 0, waveT: -1 };
const mates = new Map(); // id -> { avatar, pos, ry, target, wait, live, lookKey, waveT }
const keys = new Set();
const joy = { pointerId: null, x: 0, z: 0 }; // x / z are -1..1; length = how hard you are pushing
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

const FOLLOW_OFFSET = new THREE.Vector3(0, 15, 20); // camera, relative to you: far enough to see the tall stations' bubbles
const FOLLOW_LOOK = new THREE.Vector3(0, 3, -2); // what it looks at, relative to you

// Narrow screens (phones held upright) don't zoom out to fit the whole camp any more. Like Pocket Camp, the
// camera stays close, looks down a little more, follows you around, and you can drag to look around.
const CAM_DIST = OVERVIEW_POS.distanceTo(OVERVIEW_TARGET);
const WIDE_PITCH = Math.atan2(OVERVIEW_POS.y - OVERVIEW_TARGET.y, OVERVIEW_POS.z - OVERVIEW_TARGET.z); 
const TALL_PITCH = THREE.MathUtils.degToRad(30); // phones: more ground, less sky (the Causeway still shows)
const MIN_HALF_W = 8.5; // world units kept visible either side of centre, about one station and its neighbours
const MAX_ZOOM_OUT = 1.35; // the old code went to 2.3, which is what made the camp tiny
const CAMP_HALF_W = 13; // left/right edge of the camp the view may slide to
const CAMP_Z = [-9, 7]; // back/front limits for where the camera looks
const pan = new THREE.Vector2(); // drag offset: x = sideways, y = forwards/back (world z)

const WIDE_HALF_W = 16; // landscape: the whole camp, even with a panel (sign-in card) covering one side

function framing() {
  const aspect = camera ? camera.aspect : 1.6;
  const el = renderer?.domElement;
  const w = el?.clientWidth || 1;
  const h = el?.clientHeight || 1;
  const sx = props.viewShift?.x || 0;
  const sy = props.viewShift?.y || 0;
  // the part of the screen not covered by a panel: that's what has to frame the camp
  const freeW = Math.max(0.3, 1 - (2 * sx) / w);
  const freeAspect = (w * freeW) / Math.max(1, h - 2 * sy);
  const tall = THREE.MathUtils.clamp((1.3 - freeAspect) / 0.8, 0, 1); // 0 = landscape, 1 = phone upright
  const halfTan = Math.tan(THREE.MathUtils.degToRad((camera?.fov ?? 40) / 2));
  const wantHalfW = THREE.MathUtils.lerp(WIDE_HALF_W, MIN_HALF_W, tall);
  const k = THREE.MathUtils.clamp(wantHalfW / (CAM_DIST * halfTan * aspect * freeW), 1, MAX_ZOOM_OUT);

  const halfW = CAM_DIST * k * halfTan * aspect; // half the visible width, at the point we look at
  return {
    tall,
    k,
    pitch: THREE.MathUtils.lerp(WIDE_PITCH, TALL_PITCH, tall),
    roam: Math.max(0, CAMP_HALF_W - halfW), // how far the view can slide before showing past the camp
    worldPerPx: (2 * CAM_DIST * k * halfTan) / (renderer?.domElement.clientHeight || 800),
  };
}

/** Where the camera wants to be when nothing special is happening. */
function overview(out = { pos: new THREE.Vector3(), target: new THREE.Vector3() }) {
  if (compact.value) {
    // close behind you. A drag looks around, as far as the edge of the camp; walking brings the view back
    pan.x = THREE.MathUtils.clamp(pan.x, Math.min(0, -CAMP_HALF_W - player.pos.x), Math.max(0, CAMP_HALF_W - player.pos.x));
    const lookZ = player.pos.z + FOLLOW_LOOK.z;
    pan.y = THREE.MathUtils.clamp(pan.y, Math.min(0, CAMP_Z[0] - lookZ), Math.max(0, CAMP_Z[1] - lookZ));
    out.target.copy(player.pos).add(FOLLOW_LOOK);
    out.pos.copy(player.pos).add(FOLLOW_OFFSET);
    out.target.x += pan.x;
    out.pos.x += pan.x;
    out.target.z += pan.y;
    out.pos.z += pan.y;
    return out;
  }
  const f = framing();
  // follow you: barely on a wide screen (just enough to feel alive), properly on a phone
  const followX = THREE.MathUtils.lerp(0.18, 1, f.tall);
  const followZ = THREE.MathUtils.lerp(0.08, 0.6, f.tall);
  const limitX = f.roam + 2.5;
  const cx = THREE.MathUtils.clamp(player.pos.x * followX + pan.x, -limitX, limitX);
  const lookAhead = -2.5 * f.tall; // on a phone, look a little past you so the camp fills the screen, not the grass in front
  const cz = THREE.MathUtils.clamp(OVERVIEW_TARGET.z + lookAhead + (player.pos.z - 6) * followZ + pan.y, CAMP_Z[0], CAMP_Z[1]);
  // keep the drag inside the same limits, so it never builds up past the edge
  pan.set(cx - player.pos.x * followX, cz - OVERVIEW_TARGET.z - lookAhead - (player.pos.z - 6) * followZ);

  out.target.set(cx, THREE.MathUtils.lerp(OVERVIEW_TARGET.y, 1.2, f.tall), cz);
  const d = CAM_DIST * f.k;
  out.pos.set(cx, out.target.y + Math.sin(f.pitch) * d, cz + Math.cos(f.pitch) * d);
  return out;
}

function closeUp(station) {
  return { pos: station.camPos.clone(), target: station.camTarget.clone() };
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
  if (entering.value || typing(e)) return;
  const k = e.key.toLowerCase();
  if (MOVE_KEYS[k]) {
    // arrows only move you when focus is on the camp itself, so they still scroll / work in other controls
    if (k.startsWith('arrow') && document.activeElement && document.activeElement !== document.body && !host.value?.contains(document.activeElement)) return;
    keys.add(k);
    player.target = null;
    e.preventDefault();
  } else if ((k === 'e' || (k === ' ' && document.activeElement?.tagName !== 'BUTTON')) && nearby.value) { // Space also presses a focused button
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
  releaseJoystick();
}

// the joystick: how far the knob is from the centre, as a fraction of how far it can travel
const JOY_TRAVEL = 44; // px
const JOY_DEADZONE = 0.14;

function moveJoystick(e) {
  const box = e.currentTarget.getBoundingClientRect();
  let dx = (e.clientX - (box.left + box.width / 2)) / JOY_TRAVEL;
  let dz = (e.clientY - (box.top + box.height / 2)) / JOY_TRAVEL;
  const push = Math.hypot(dx, dz);
  if (push > 1) {
    dx /= push;
    dz /= push;
  }
  if (knob.value) knob.value.style.transform = `translate(${dx * JOY_TRAVEL}px, ${dz * JOY_TRAVEL}px)`;
  joy.x = push < JOY_DEADZONE ? 0 : dx;
  joy.z = push < JOY_DEADZONE ? 0 : dz;
}
function onJoystickDown(e) {
  if (entering.value || joy.pointerId !== null) return;
  joy.pointerId = e.pointerId;
  e.currentTarget.setPointerCapture?.(e.pointerId);
  player.target = null;
  moveJoystick(e);
}
function onJoystickMove(e) {
  if (e.pointerId === joy.pointerId) moveJoystick(e);
}
function onJoystickUp(e) {
  if (e.pointerId === joy.pointerId) releaseJoystick();
}
function releaseJoystick() {
  joy.pointerId = null;
  joy.x = 0;
  joy.z = 0;
  if (knob.value) knob.value.style.transform = '';
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

// A press is a tap (walk / go in) unless it moves more than a few px: then it's a drag that slides the view.
let drag = null; // { id, x, y, panX, panY, moved }

function onPointerMove(e) {
  if (drag && e.pointerId === drag.id) {
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 8) drag.moved = true;
    if (drag.moved) {
      const f = framing();
      // grab the ground: it moves with your finger
      pan.x = drag.panX - dx * f.worldPerPx;
      pan.y = drag.panY - (dy * f.worldPerPx) / Math.sin(f.pitch + 0.35);
      hovered.value = null;
    }
    return;
  }
  if (entering.value || e.pointerType === 'touch') return;
  hovered.value = pick(e).stationId;
}

function onPointerDown(e) {
  if (entering.value || e.button > 0) return;
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y, moved: false };
  e.currentTarget.setPointerCapture?.(e.pointerId);
}

function onPointerCancel() {
  drag = null;
}

function onPointerUp(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const wasDrag = drag.moved;
  drag = null;
  if (wasDrag || entering.value) return;
  const { stationId, ray } = pick(e);
  if (stationId) return enter(stationId);
  if (touch.value) return; // the joystick does the walking here
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
  if (props.locked.includes(stationId)) {
    emit('locked', station);
    return;
  }
  entering.value = stationId;
  keys.clear();
  releaseJoystick();

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
  if (player.avatar) {
    let ix = joy.x;
    let iz = joy.z;
    for (const k of keys) {
      ix += MOVE_KEYS[k][0];
      iz += MOVE_KEYS[k][1];
    }
    const pace = Math.min(1, Math.hypot(ix, iz)); // keys are always full speed; the joystick is as hard as you push
    if (ix || iz) {
      // camera-relative: "up" walks away from the camera
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      fwd.normalize();
      right.crossVectors(fwd, camera.up).normalize();
      const dir = new THREE.Vector3().addScaledVector(right, ix).addScaledVector(fwd, -iz).normalize();
      player.pos.addScaledVector(dir, 5.5 * pace * dt);
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
    if (moving && !drag) pan.multiplyScalar(1 - Math.min(1, dt * 2.5));
    player.speed += ((moving ? (ix || iz ? pace : 1) : 0) - player.speed) * Math.min(1, dt * 10);
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
    } else {
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
  } else if (!entering.value) {
    const o = overview();
    const k = Math.min(1, dt * (compact.value ? 6 : 3)); // the follow camera keeps up with you
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
  // slide the picture (not the camera) so the camp sits in the space beside or above a panel
  const sx = props.viewShift?.x || 0;
  const sy = props.viewShift?.y || 0;
  if (sx || sy) camera.setViewOffset(w, h, sx, sy, w, h);
  else camera.clearViewOffset();
   camera.updateProjectionMatrix();}

function wave() {
  if (!player.avatar) return;
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
  camp.setTraffic(props.traffic)

  rebuildPlayer();
  syncMates();
  applyEnvironment(true);
  envTimer = setInterval(() => applyEnvironment(), 60_000);

  resize();
  resizeObs = new ResizeObserver(resize);
  resizeObs.observe(canvasWrap.value);

  const station = props.returnFrom && camp.stations.find((s) => s.id === props.returnFrom);
  if (station) {
    // you just walked out of it: stand on the doorstep, door open, camera close, then pull back
    player.pos.copy(station.approachPoint);
    player.ry = Math.atan2(-player.pos.x, 12 - player.pos.z);
    setDoor(station.id, 1);
    const c = closeUp(station);
    cam.pos.copy(c.pos);
    cam.target.copy(c.target);
    tweenDoor(station.id, 0, 0.7, 0.2);
    tweenCamera(overview(), 1.3);
  } else {
    const o = overview();
    cam.pos.copy(o.pos);
    cam.target.copy(o.target);
  }
  placeAvatar(player.avatar, player.pos, player.ry);

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  compactMedia?.addEventListener?.('change', onCompactChange);
  touchMedia?.addEventListener?.('change', onTouchChange);
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
  compactMedia?.removeEventListener?.('change', onCompactChange);
  touchMedia?.removeEventListener?.('change', onTouchChange);
  player.avatar?.dispose();  mates.forEach((m) => m.avatar.dispose());
  camp?.dispose();
  renderer?.dispose();
  renderer?.forceContextLoss();
  renderer?.domElement.remove();
});

watch(() => props.me?.look, () => scene && rebuildPlayer(), { deep: true });
watch(() => [props.crew, props.live], syncMates, { deep: true });
watch(() => [props.mode, props.condition], () => applyEnvironment(true));
watch(() => props.traffic, (t) => camp?.setTraffic(t), { deep: true })
watch(() => [props.viewShift?.x, props.viewShift?.y], () => resize())

defineExpose({ enter, wave });

const highlighted = (id) => nearby.value === id || hovered.value === id || entering.value === id;
const stationList = [
  { id: 'watcher', name: 'Watcher' },
  { id: 'explorer', name: 'Explorer' },
  { id: 'trips', name: 'Planner' },
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
    :class="{ 'is-entering': entering, compact, touch }"
    tabindex="-1"
    @pointermove="onPointerMove"
    @pointerleave="hovered = null"
  >
    <div ref="canvasWrap" class="canvas" :style="{ cursor: hovered ? 'pointer' : 'default' }" @pointerdown="onPointerDown" @pointerup="onPointerUp" @pointercancel="onPointerCancel" />

    <div class="overlays" :class="{ ready, 'labels-hidden' : !showLabels }">
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

      <span v-if="me" :ref="(el) => (tagEls.me = el)" class="tag me" aria-hidden="true">{{ me.id === 'guest' ? 'You' : `${(me.name || 'You').split(' ')[0]} (you)` }}</span>
      <span v-for="p in people" :key="p.id" :ref="(el) => (tagEls[p.id] = el)" class="tag" aria-hidden="true">
        <i v-if="p.live" class="dot" />{{ p.name }}
      </span>
    </div>

    <div aria-live="polite">
      <button v-if="nearby && !entering" type="button" class="prompt" @click="enter(nearby)">
        <kbd v-if="!touch">E</kbd> Enter {{ nearbyName(nearby) }}
      </button>
    </div>

    <div class="hud-slot"><slot /></div>

    <!-- stations stay reachable without it: every bubble is a button -->
    <div
      v-if="touch"
      class="joystick"
      aria-hidden="true"
      @pointerdown.prevent="onJoystickDown"
      @pointermove="onJoystickMove"
      @pointerup="onJoystickUp"
      @pointercancel="onJoystickUp"
    >
      <i ref="knob" class="knob" />
    </div>
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
  touch-action: none;
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
  transition: background 0.15s, opacity 0.2s;
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
  /* colour only: `scale` here would also scale the translate placeOverlay sets, throwing the bubble across the screen */
  background: #f5bf4f;
}
.bubble:focus-visible {
  outline: 3px solid #fffdf7;
  outline-offset: 2px;
}
/* labels hidden (the default): a place's label only pops up when you walk up to it, hover it or tab to it.
   The hidden ones still let taps through to the building and are still read out by screen readers. */
.labels-hidden .bubble:not(.hot):not(:focus-visible) {
  opacity: 0;
  pointer-events: none;
}
.labels-hidden .bubble.hot {
  animation: label-pop 0.22s ease-out;
}
@keyframes label-pop {
  from { opacity: 0; margin-top: -4px; }
  to { opacity: 1; margin-top: -12px; }
}
@media (prefers-reduced-motion: reduce) {
  .labels-hidden .bubble.hot { animation: none; }
}

/* night: warm paper lanterns instead of bright white cards */
.is-night .bubble {
  border-color: #3a2618;
  background: #f3e2bd;
  color: #3a2618;
  box-shadow: 0 0 0 4px rgba(255, 190, 90, 0.18), 0 0 18px rgba(255, 180, 80, 0.55);
}
.is-night .bubble::after {
  border-color: #3a2618;
}
.is-night .bubble span {
  color: #5a3a22;
  opacity: 1;
}
.is-night .bubble.hot,
.is-night .bubble:hover,
.is-night .bubble:focus-visible {
  /* the one you're next to burns a little brighter */
  background: #f5bf4f;
  box-shadow: 0 0 0 5px rgba(255, 190, 90, 0.3), 0 0 26px rgba(255, 180, 80, 0.8);
}
@media (max-width: 640px) {
  /* phones: smaller labels, names only */
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
  font: inherit;
  font-weight: 700;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.18);
  cursor: pointer;
  animation: pop 0.2s ease-out;
}
/* the bottom-left corner belongs to the joystick */
.touch .prompt {
  left: auto;
  right: 18px;
  bottom: 56px;
  translate: none;
  min-height: 48px;
  padding: 10px 18px;
  z-index: 3;
}
.joystick {
  position: absolute;
  z-index: 3;
  left: 22px;
  bottom: 26px;
  display: grid;
  place-items: center;
  width: 128px;
  height: 128px;
  border: 2px solid rgba(255, 255, 255, 0.55);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: grab;
}
.knob {
  width: 56px;
  height: 56px;
  border: 2px solid rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}
.is-entering .joystick {
  opacity: 0;
  pointer-events: none;
}
button.prompt {
  min-height: 44px;
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
