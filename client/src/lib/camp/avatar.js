/**
 * Low-poly camp characters. One builder for you, your crewmates and the profile preview,
 * so a look always renders the same everywhere.
 * The style ids must match lookBody in server/routes/schemas.js.
 */
import * as THREE from 'three';

export const DEFAULT_LOOK = {
  skin: '#c68b59',
  hair: '#2b1d14',
  hairStyle: 'short',
  top: '#e2603f',
  bottom: '#2f4858',
  hat: 'none',
};

export const LOOK_OPTIONS = {
  skin: ['#f3d2b3', '#e8b48a', '#c68b59', '#a0663c', '#6e4325', '#4a2c17'],
  hair: ['#1b1410', '#2b1d14', '#6b3f1f', '#b5793a', '#e3c27a', '#8c8c8c', '#c2412d', '#3b5bdb'],
  hairStyle: ['short', 'long', 'bun', 'buzz', 'curly'],
  top: ['#e2603f', '#f2b134', '#3f8f5b', '#2f7fbf', '#7a4fbf', '#e86fa0', '#f4efe2', '#2a2f36'],
  bottom: ['#2f4858', '#3d3a36', '#7a5a3a', '#4f6d3a', '#c9b48f', '#1f2a44'],
  hat: ['none', 'cap', 'bucket', 'beanie'],
};

export const STYLE_LABEL = {
  short: 'Short', long: 'Long', bun: 'Bun', buzz: 'Buzz', curly: 'Curly',
  none: 'No hat', cap: 'Cap', bucket: 'Bucket hat', beanie: 'Beanie',
};

/** Fill gaps / drop junk so a half-saved or old look still builds. */
export function normaliseLook(look) {
  const out = { ...DEFAULT_LOOK };
  if (!look || typeof look !== 'object') return out;
  for (const key of Object.keys(DEFAULT_LOOK)) {
    const value = look[key];
    if (key === 'hairStyle' || key === 'hat') {
      if (LOOK_OPTIONS[key].includes(value)) out[key] = value;
    } else if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) out[key] = value;
  }
  return out;
}

/** A stable made-up look for someone who never picked one, so crewmates do not all look identical. */
export function lookFromId(id = '') {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pick = (list, salt) => list[(h >>> salt) % list.length];
  return {
    skin: pick(LOOK_OPTIONS.skin, 1),
    hair: pick(LOOK_OPTIONS.hair, 4),
    hairStyle: pick(LOOK_OPTIONS.hairStyle, 7),
    top: pick(LOOK_OPTIONS.top, 10),
    bottom: pick(LOOK_OPTIONS.bottom, 13),
    hat: pick(LOOK_OPTIONS.hat, 16),
  };
}

const mat = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });

function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function addHair(head, look, hairMat) {
  const style = look.hairStyle;
  if (style === 'buzz') {
    head.add(mesh(new THREE.SphereGeometry(0.43, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2.2), hairMat, 0, 0.04, 0));
    return;
  }
  // a fringe-high cap on top (stops above the eyes) plus a back piece that comes down to the neck
  head.add(mesh(new THREE.SphereGeometry(0.46, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2.6), hairMat, 0, 0.05, -0.02));
  head.add(mesh(new THREE.SphereGeometry(0.45, 7, 5, Math.PI, Math.PI, 0, Math.PI / 1.7), hairMat, 0, 0.04, -0.03));
  if (style === 'long') {
    head.add(mesh(new THREE.BoxGeometry(0.8, 0.62, 0.3), hairMat, 0, -0.22, -0.26));
  } else if (style === 'bun') {
    head.add(mesh(new THREE.IcosahedronGeometry(0.2, 0), hairMat, 0, 0.42, -0.22));
  } else if (style === 'curly') {
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.95 + (i / 6) * 1.1); // sides and back only (front is +z), so the face stays clear
      head.add(mesh(new THREE.IcosahedronGeometry(0.17, 0), hairMat, Math.cos(a) * 0.36, 0.22 + (i % 2) * 0.08, Math.sin(a) * 0.36 - 0.04));
    }
  }
}

function addHat(head, look) {
  const hatMat = mat(look.top);
  if (look.hat === 'cap') {
    head.add(mesh(new THREE.SphereGeometry(0.47, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2.4), hatMat, 0, 0.1, 0));
    head.add(mesh(new THREE.BoxGeometry(0.5, 0.05, 0.36), hatMat, 0, 0.16, 0.42));
  } else if (look.hat === 'bucket') {
    head.add(mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 10), mat('#d9c9a3'), 0, 0.2, 0));
    head.add(mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.3, 10), mat('#d9c9a3'), 0, 0.36, 0));
  } else if (look.hat === 'beanie') {
    head.add(mesh(new THREE.SphereGeometry(0.48, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), hatMat, 0, 0.1, 0));
    head.add(mesh(new THREE.IcosahedronGeometry(0.1, 0), mat('#f4efe2'), 0, 0.6, 0));
  }
}

/**
 * Builds a character. Returns the group (feet at y=0, facing +z) and an animate(dt, speed) to swing limbs.
 * Call dispose() when removing it from the scene.
 */
export function buildAvatar(rawLook) {
  const look = normaliseLook(rawLook);
  const group = new THREE.Group();
  const skin = mat(look.skin);
  const top = mat(look.top);
  const bottom = mat(look.bottom);
  const hairMat = mat(look.hair);
  const shoe = mat('#2a2117');

  const hips = new THREE.Group();
  hips.position.y = 0.55;
  group.add(hips);

  const leg = (x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, 0);
    pivot.add(mesh(new THREE.BoxGeometry(0.2, 0.46, 0.22), bottom, 0, -0.23, 0));
    pivot.add(mesh(new THREE.BoxGeometry(0.22, 0.1, 0.3), shoe, 0, -0.5, 0.04));
    hips.add(pivot);
    return pivot;
  };
  const legL = leg(-0.13);
  const legR = leg(0.13);

  const body = new THREE.Group();
  hips.add(body);
  body.add(mesh(new THREE.CylinderGeometry(0.27, 0.33, 0.62, 7), top, 0, 0.3, 0));

  const arm = (x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.55, 0);
    pivot.add(mesh(new THREE.BoxGeometry(0.15, 0.44, 0.17), top, 0, -0.2, 0));
    pivot.add(mesh(new THREE.IcosahedronGeometry(0.09, 0), skin, 0, -0.45, 0));
    body.add(pivot);
    return pivot;
  };
  const armL = arm(-0.38);
  const armR = arm(0.38);

  const head = new THREE.Group();
  head.position.y = 1.0;
  body.add(head);
  head.add(mesh(new THREE.IcosahedronGeometry(0.42, 1), skin));
  const eye = mat('#1b1410');
  head.add(mesh(new THREE.BoxGeometry(0.07, 0.11, 0.04), eye, -0.14, 0.02, 0.39));
  head.add(mesh(new THREE.BoxGeometry(0.07, 0.11, 0.04), eye, 0.14, 0.02, 0.39));
  head.add(mesh(new THREE.BoxGeometry(0.1, 0.05, 0.04), mat('#e98a7a'), -0.25, -0.1, 0.34));
  head.add(mesh(new THREE.BoxGeometry(0.1, 0.05, 0.04), mat('#e98a7a'), 0.25, -0.1, 0.34));
  addHair(head, look, hairMat);
  addHat(head, look);

  // soft blob shadow so characters still read when real shadows are off (night)
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  group.add(blob);

  let phase = 0;
  function animate(dt, speed) {
    // speed 0..1: 0 = idle breathing, 1 = full walk cycle
    phase += dt * (speed > 0.05 ? 10 : 2);
    const swing = Math.sin(phase) * 0.7 * speed;
    legL.rotation.x = swing;
    legR.rotation.x = -swing;
    armL.rotation.x = -swing * 0.8;
    armR.rotation.x = swing * 0.8;
    hips.position.y = 0.55 + Math.abs(Math.sin(phase)) * 0.06 * speed + (speed < 0.05 ? Math.sin(phase) * 0.01 : 0);
  }

  function wave(t) {
    // raise the right arm and wiggle it (t in seconds since the wave started)
    armR.rotation.x = 0;
    armR.rotation.z = Math.PI * 0.85 + Math.sin(t * 14) * 0.25;
  }
  function stopWave() {
    armR.rotation.z = 0;
  }

  function dispose() {
    group.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
  }

  return { group, animate, wave, stopWave, dispose, look };
}
