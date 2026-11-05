/**
 * The basecamp island: every mesh, light and weather effect, built in code (no model files to load).
 * buildCamp() returns the stations (where each feature lives), colliders for walking, and two hooks the
 * scene calls: setEnvironment(env) when the sky changes and tick(t, dt) every frame.
 */
import * as THREE from 'three';
import { buildCauseway } from './causeway';
import { buildFairyLights } from './fairyLights'

// ---------- helpers ----------

function rng(seed) {
  // mulberry32: same camp layout on every visit
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rt, rb, h, seg, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function blob(r, material, x = 0, y = 0, z = 0, detail = 0) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** A hinge: returns a group positioned at the hinge, so rotating it swings whatever you add. */
function hinge(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/** Stripes for awnings: alternating boxes along x. */
function stripes(width, depth, count, colors, y, tilt = 0) {
  const g = new THREE.Group();
  const w = width / count;
  for (let i = 0; i < count; i++) {
    g.add(box(w, 0.12, depth, colors[i % colors.length], -width / 2 + w * (i + 0.5), y, 0));
  }
  g.rotation.x = tilt;
  return g;
}

// ---------- palette (night tints are applied by lighting, not by swapping these) ----------

let P; // fresh materials per camp, so unmounting can dispose them safely
const makePalette = () => ({
  wood: lambert('#8a5a34'),
  woodDark: lambert('#5e3b22'),
  cream: lambert('#f1e6c9'),
  teal: lambert('#2f6f6a'),
  pink: lambert('#e17a8f'),
  white: lambert('#f8f4ea'),
  roofPink: lambert('#d4677c'),
  stone: lambert('#a6a196'),
  coin: lambert('#f2b134', { emissive: '#5a3a00', emissiveIntensity: 0.25 }),
  canvas: lambert('#e6d3a8'),
  canvasDark: lambert('#cdb582'),
  tire: lambert('#1f1f24'),
  solar: lambert('#2a4f9a', { emissive: '#0a1a3a', emissiveIntensity: 0.3 }),
  pine: lambert('#2f6b46'),
  pineDark: lambert('#245638'),
  leaf: lambert('#4f8f3e'),
  leafLight: lambert('#6aa84f'),
  sand: lambert('#e2c48e'),
  mustard: lambert('#e0a43b'),
  red: lambert('#c94f3d'),
  chair: lambert('#3f8f86'),
});

// ---------- the stations ----------

/** Trips: the camper trailer. Its side door swings open. */
function buildTrailer() {
  const g = new THREE.Group();
  const windowMat = lambert('#ffd98a', { emissive: '#ffb84d', emissiveIntensity: 0 });

  g.add(box(5.2, 2.0, 2.4, P.cream, 0, 1.45, 0));
  g.add(box(5.24, 0.35, 2.44, P.teal, 0, 0.75, 0)); // skirt
  g.add(box(5.24, 0.16, 2.44, P.pink, 0, 1.25, 0)); // stripe
  g.add(box(5.4, 0.16, 2.6, P.woodDark, 0, 2.52, 0)); // roof lip
  g.add(box(1.5, 0.08, 1.1, P.solar, -1.3, 2.64, 0));
  g.add(box(1.5, 0.08, 1.1, P.solar, 0.4, 2.64, 0));
  // roof rack with a cooler box
  g.add(box(1.3, 0.55, 0.9, P.teal, 1.8, 2.88, 0));
  g.add(box(1.34, 0.1, 0.94, P.white, 1.8, 3.18, 0));
  // windows (glow at night)
  for (const x of [-1.8, -0.4]) g.add(box(0.9, 0.6, 0.05, windowMat, x, 1.75, 1.22));
  g.add(box(0.05, 0.7, 1.4, windowMat, -2.62, 1.7, 0));
  // wheels
  for (const x of [-1.5, 1.6]) {
    const w = cyl(0.48, 0.48, 0.3, 10, P.tire, x, 0.5, 1.22);
    w.rotation.x = Math.PI / 2;
    g.add(w);
  }
  // door: hinge on its left edge, door spans +x from there
  const doorHinge = hinge(g, 0.7, 1.4, 1.23);
  doorHinge.add(box(0.9, 1.7, 0.08, P.cream, 0.45, 0, 0));
  doorHinge.add(box(0.5, 0.45, 0.09, windowMat, 0.45, 0.35, 0));
  doorHinge.add(box(0.08, 0.08, 0.12, P.woodDark, 0.8, -0.1, 0.06));
  // warm interior behind the door
  g.add(box(0.86, 1.66, 0.04, lambert('#ffcf7a', { emissive: '#ff9d3a', emissiveIntensity: 0.6 }), 1.15, 1.4, 1.215)); // just proud of the wall; the closed door covers it
  // awning on the door side
  const awning = stripes(2.6, 1.4, 8, [P.pink, P.white], 0, -0.25);
  awning.position.set(-1.2, 2.3, 1.85);
  g.add(awning);
  g.add(cyl(0.04, 0.04, 2.2, 5, P.woodDark, -2.4, 1.1, 2.45));
  g.add(cyl(0.04, 0.04, 2.2, 5, P.woodDark, 0, 1.1, 2.45));
  // camp chairs
  for (const x of [-1.8, -0.9]) {
    g.add(box(0.6, 0.08, 0.55, P.chair, x, 0.5, 2.6));
    g.add(box(0.6, 0.6, 0.08, P.chair, x, 0.8, 2.33));
  }
  const light = new THREE.PointLight('#ffb35c', 0, 7, 1.6);
  light.position.set(1.15, 1.6, 2.2);
  g.add(light);

  return {
    group: g,
    setOpen: (p) => (doorHinge.rotation.y = -1.9 * p),
    night: (n) => {
      windowMat.emissiveIntensity = 0.15 + n * 1.2;
      light.intensity = n * 3;
    },
  };
}

/** Watcher: the lookout tower. The cabin door at the top swings open and the binoculars come out. */
function buildTower() {
  const g = new THREE.Group();
  for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
    const leg = box(0.22, 4.2, 0.22, P.wood, x, 2.1, z);
    g.add(leg);
  }
  for (const y of [1.4, 2.8]) {
    g.add(box(2.0, 0.12, 0.12, P.woodDark, 0, y, 0.9));
    g.add(box(2.0, 0.12, 0.12, P.woodDark, 0, y, -0.9));
  }
  g.add(box(2.6, 0.2, 2.6, P.wood, 0, 4.25, 0)); // deck
  // cabin
  g.add(box(1.9, 1.3, 0.12, P.wood, 0, 5.0, -0.9));
  g.add(box(0.12, 1.3, 1.9, P.wood, -0.9, 5.0, 0));
  g.add(box(0.12, 1.3, 1.9, P.wood, 0.9, 5.0, 0));
  g.add(box(0.5, 1.3, 0.12, P.wood, -0.7, 5.0, 0.9));
  g.add(box(0.5, 1.3, 0.12, P.wood, 0.7, 5.0, 0.9));
  const doorHinge = hinge(g, -0.45, 5.0, 0.92);
  doorHinge.add(box(0.9, 1.2, 0.08, P.woodDark, 0.45, 0, 0));
  // roof
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.3, 4), P.roofPink);
  roof.position.set(0, 6.3, 0);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);
  // flag
  g.add(cyl(0.04, 0.04, 1.6, 5, P.woodDark, 0, 7.4, 0));
  const flag = box(0.7, 0.4, 0.04, P.mustard, 0.35, 7.95, 0);
  g.add(flag);
  // ladder
  for (let y = 0.4; y < 4.2; y += 0.45) g.add(box(0.7, 0.07, 0.07, P.woodDark, 0, y, 1.25));
  g.add(box(0.07, 4.2, 0.07, P.woodDark, -0.35, 2.1, 1.25));
  g.add(box(0.07, 4.2, 0.07, P.woodDark, 0.35, 2.1, 1.25));
  // binoculars (slide out of the doorway when opening)
  const bino = new THREE.Group();
  for (const x of [-0.12, 0.12]) {
    const tube = cyl(0.09, 0.11, 0.4, 8, lambert('#2a2f36'), x, 0, 0);
    tube.rotation.x = Math.PI / 2;
    bino.add(tube);
  }
  bino.position.set(0, 5.1, 0.5);
  g.add(bino);

  // ---- night lights: glowing windows, a warm room behind the door, a lantern, and a searchlight ----
const glowMat = lambert('#ffd98a', { emissive: '#ffae42', emissiveIntensity: 0 });
for (const x of [-0.97, 0.97]) g.add(box(0.04, 0.5, 0.8, glowMat, x, 5.15, -0.1)); // side windows
g.add(box(0.8, 0.5, 0.04, glowMat, 0, 5.15, -0.97)); // back window
g.add(box(0.86, 1.16, 0.03, glowMat, 0, 5.0, 0.86)); // warm room seen through the doorway (the door covers it)
const lanternMat = lambert('#fff1c4', { emissive: '#ffc25a', emissiveIntensity: 0.2 });
g.add(cyl(0.015, 0.015, 0.35, 4, P.woodDark, 0.75, 5.6, 1.15)); // hook
const lantern = new THREE.Group(); // swings from its hook
lantern.position.set(0.75, 5.42, 1.15);
lantern.add(box(0.14, 0.18, 0.14, lanternMat, 0, -0.1, 0));
lantern.add(box(0.2, 0.05, 0.2, P.woodDark, 0, 0.01, 0)); // cap
lantern.add(box(0.18, 0.04, 0.18, P.woodDark, 0, -0.21, 0)); // base
g.add(lantern);
const roomLight = new THREE.PointLight('#ffb35c', 0, 9, 1.6);
roomLight.position.set(0, 4.9, 1.4);
g.add(roomLight)
// searchlight on the back corner of the deck, sweeping slowly towards the Causeway (back of the camp)
g.add(box(0.1, 0.3, 0.1, P.woodDark, 0.8, 4.5, -1.15)); // its little post
const lampHead = new THREE.Group();
lampHead.position.set(0.8, 4.75, -1.15);
g.add(lampHead);
lampHead.add(box(0.3, 0.26, 0.36, lambert('#2a2f36'), 0, 0, 0));
const lens = box(0.24, 0.2, 0.04, lanternMat, 0, 0, -0.19);
lampHead.add(lens);
const beamMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  fog: false,
  uniforms: { opacity: { value: 0 }, tint: { value: new THREE.Color('#fff0c0') } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
   // bright at the lamp, fading out along the beam
   fragmentShader: `uniform float opacity; uniform vec3 tint; varying vec2 vUv;
void main() {
 gl_FragColor = vec4(tint, opacity * pow(vUv.y, 1.6));
 #include <colorspace_fragment>
}`,
});
const BEAM = 22;
const beamGeo = new THREE.ConeGeometry(3.2, BEAM, 20, 1, true);
beamGeo.translate(0, -BEAM / 2, 0); // tip at the lamp
beamGeo.rotateX(Math.PI / 2 - 0.12); // point backwards (-z) and a little down
const beam = new THREE.Mesh(beamGeo, beamMat);
beam.visible = false;
beam.castShadow = false;
beam.raycast = () => {}; // never block clicks on the stations
lampHead.add(beam);

let night = 0;

  return {
    group: g,
    setOpen: (p) => {
      doorHinge.rotation.y = -1.8 * p;
      bino.position.z = 0.5 + p * 0.7;
    },
    night: (n) => {
      night = n;
      glowMat.emissiveIntensity = n * 1.3;
      lens.material.emissiveIntensity = 0.2 + n * 1.6;
      roomLight.intensity = n * 3.2;
      beamMat.uniforms.opacity.value = n * 0.22;
      beam.visible = n > 0.02;
    },
    tick: (t) => {
      flag.rotation.y = Math.sin(t * 3) * 0.25;
      lampHead.rotation.y = Math.sin(t * 0.35) * 0.75;
      lantern.rotation.z = Math.sin(t * 1.8) * 0.12;
      if (night > 0.02) roomLight.intensity = night * (3 + Math.sin(t * 9) * 0.15 + Math.sin(t * 5.3) * 0.1 )
    },
  };
}

/** Tales: the campfire, plus the camp mailbox where postcards land. Its lid flips open and the flag pops up. */
function buildCampfire() {
  const g = new THREE.Group();
  const r = rng(7);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.add(blob(0.28 + r() * 0.08, P.stone, Math.cos(a) * 1.0, 0.15, Math.sin(a) * 1.0));
  }
  for (let i = 0; i < 3; i++) {
    const log = cyl(0.12, 0.12, 1.3, 6, P.woodDark, 0, 0.25, 0);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 3) * Math.PI;
    g.add(log);
  }
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ff8a2a' });
  const coreMat = new THREE.MeshBasicMaterial({ color: '#ffd45a' });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.3, 5), flameMat);
  flame.position.y = 0.85;
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.8, 5), coreMat);
  core.position.y = 0.7;
  g.add(flame, core);
  // sitting logs
  const seat1 = cyl(0.3, 0.3, 2.0, 7, P.wood, -0.6, 0.3, 2.0);
  seat1.rotation.z = Math.PI / 2;
  seat1.rotation.y = 0.5;
  const seat2 = cyl(0.3, 0.3, 2.0, 7, P.wood, 2.1, 0.3, 0.4);
  seat2.rotation.z = Math.PI / 2;
  seat2.rotation.y = 1.4;
  const seat3 = cyl(0.3, 0.3, 1.8, 7, P.wood, -1.6, 0.3, -1.6);
  seat3.rotation.z = Math.PI / 2;
  seat3.rotation.y = -0.8;
  g.add(seat1, seat2, seat3);
  // mailbox
  const mail = new THREE.Group();
  mail.position.set(2.0, 0, -1.4);
  mail.add(box(0.12, 1.1, 0.12, P.woodDark, 0, 0.55, 0));
  mail.add(box(0.5, 0.42, 0.75, P.teal, 0, 1.3, 0));
  const lid = hinge(mail, 0, 1.3, 0.38);
  lid.add(box(0.52, 0.44, 0.06, P.teal, 0, 0, 0.0));
  const flagHinge = hinge(mail, 0.28, 1.2, -0.1);
  flagHinge.add(box(0.05, 0.5, 0.08, P.red, 0, 0.25, 0));
  flagHinge.add(box(0.05, 0.18, 0.22, P.red, 0, 0.45, 0.1));
  flagHinge.rotation.x = Math.PI / 2;
  // postcard peeking out
  const card = box(0.36, 0.26, 0.02, P.white, 0, 1.3, 0.3);
  mail.add(card);
  g.add(mail);

  const light = new THREE.PointLight('#ff9a3c', 2, 10, 1.6);
  light.position.y = 1.3;
  g.add(light);
  let night = 0;
  let flare = 0;

  return {
    group: g,
    setOpen: (p) => {
      lid.rotation.x = 1.6 * p;
      flagHinge.rotation.x = (Math.PI / 2) * (1 - p);
      card.position.z = 0.3 + p * 0.4;
      card.position.y = 1.3 + p * 0.35;
      flare = p;
    },
    night: (n) => (night = n),
    tick: (t) => {
      const f = 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.06 + flare * 0.4;
      flame.scale.set(f, f * (1 + Math.sin(t * 9) * 0.1), f);
      core.scale.setScalar(f);
      light.intensity = (0.6 + night * 3.4) * f;
    },
  };
}

/** Ledger: the market stall. The cash box lid lifts and the lantern brightens. */
function buildStall() {
  const g = new THREE.Group();
  g.add(box(3.2, 1.1, 1.3, P.wood, 0, 0.55, 0)); // counter
  g.add(box(3.4, 0.12, 1.5, P.woodDark, 0, 1.16, 0));
  for (const [x, z] of [[-1.6, -0.6], [1.6, -0.6], [-1.6, 0.6], [1.6, 0.6]]) g.add(box(0.14, 2.8, 0.14, P.woodDark, x, 1.4, z));
  const awning = stripes(3.6, 1.8, 9, [P.pink, P.white], 0, 0.18);
  awning.position.set(0, 2.85, 0.2);
  g.add(awning);
  // coin stacks
  const r = rng(11);
  for (let i = 0; i < 5; i++) {
    const h = 0.15 + r() * 0.35;
    g.add(cyl(0.18, 0.18, h, 10, P.coin, -1.1 + i * 0.32, 1.22 + h / 2, -0.15 + (i % 2) * 0.3));
  }
  // cash box with lid
  g.add(box(0.7, 0.35, 0.5, P.teal, 0.9, 1.4, 0));
  const lid = hinge(g, 0.9, 1.58, -0.25);
  lid.add(box(0.72, 0.06, 0.52, P.teal, 0, 0, 0.26));
  const notes = box(0.5, 0.05, 0.3, lambert('#8fcf8a'), 0.9, 1.55, 0);
  g.add(notes);
  // crates
  g.add(box(0.9, 0.7, 0.9, P.woodDark, 2.2, 0.35, 0.6));
  g.add(box(0.7, 0.55, 0.7, P.wood, 2.1, 0.98, 0.5));
  // lantern
  const lanternMat = lambert('#ffe3a0', { emissive: '#ffb84d', emissiveIntensity: 0.2 });
  const lantern = box(0.22, 0.3, 0.22, lanternMat, -1.4, 2.4, 0.7);
  g.add(lantern);
  const light = new THREE.PointLight('#ffc070', 0, 7, 1.6);
  light.position.set(-1.4, 2.3, 1.0);
  g.add(light);
  let night = 0;
  let open = 0;
  const glow = () => {
    lanternMat.emissiveIntensity = 0.2 + night * 1.4 + open;
    light.intensity = night * 2.5 + open * 2;
  };

  return {
    group: g,
    setOpen: (p) => {
      open = p;
      lid.rotation.x = -1.7 * p;
      notes.position.y = 1.55 + p * 0.15;
      glow();
    },
    night: (n) => {
      night = n;
      glow();
    },
    tick: (t) => (lantern.rotation.z = Math.sin(t * 2) * 0.08),
  };
}

/** Archives: the canvas tent. Both front flaps fold back. */
function buildTent() {
  const g = new THREE.Group();
  // a 3-sided cylinder lying on its side = triangular prism: base on the ground, ridge 2.55 up, 3.2 deep
  const tent = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 3.2, 3), P.canvas);
  tent.rotation.x = -Math.PI / 2; // first vertex of the triangle ends up pointing straight up
  tent.position.y = 0.85;
  tent.castShadow = true;
  tent.receiveShadow = true;
  g.add(tent);
  // dark doorway at the front (glows when the lantern is on)
  const doorway = new THREE.Mesh(new THREE.CircleGeometry(1.1, 3), lambert('#3a2a1c', { emissive: '#ffb050', emissiveIntensity: 0 }));
  doorway.position.set(0, 0.55, 1.61);
  doorway.rotation.z = Math.PI / 2;
  g.add(doorway);
  // flaps: each covers half the front and swings around the tent's sloped edge
  const SLOPE = Math.PI / 6; // the front is an equilateral triangle, so each side leans 30 degrees
  const flapMat = lambert('#d8c08c', { side: THREE.DoubleSide });
  const flap = (side) => {
    const tilt = hinge(g, -1.47 * side, 0, 1.63);
    tilt.rotation.z = -SLOPE * side;
    const swing = hinge(tilt, 0, 0, 0);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 2.94, 0, 1.273 * side, 0.735, 0], 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, flapMat);
    m.castShadow = true;
    swing.add(m);
    return swing;
  };
  const left = flap(1);
  const right = flap(-1);
  // front pole
  g.add(cyl(0.05, 0.05, 2.8, 5, P.woodDark, 0, 1.4, 1.72));
  // lantern hanging inside
  const lanternMat = lambert('#ffe3a0', { emissive: '#ffb84d', emissiveIntensity: 0.4 });
  g.add(box(0.2, 0.26, 0.2, lanternMat, 0, 1.6, 0.6));
  const light = new THREE.PointLight('#ffc070', 0, 6, 1.6);
  light.position.set(0, 1.4, 1.2);
  g.add(light);
  // trunk of memories by the door
  g.add(box(0.9, 0.5, 0.55, P.wood, 1.7, 0.25, 1.8));
  g.add(box(0.92, 0.1, 0.57, P.mustard, 1.7, 0.45, 1.8));

  let night = 0;
  let open = 0;
  const glow = () => {
    lanternMat.emissiveIntensity = 0.4 + night * 1.2;
    doorway.material.emissiveIntensity = night * 0.35 + open * 0.4;
    light.intensity = night * 2 + open * 1.5;
  };
  return {
    group: g,
    setOpen: (p) => {
      open = p;
      left.rotation.y = -2.0 * p;
      right.rotation.y = 2.0 * p;
      glow();
    },
    night: (n) => {
      night = n;
      glow();
    },
  };
}

/** Explorer: the big tree with a birdhouse full of flyers, and a signpost. The birdhouse door swings open. */
function buildBirdTree() {
  const g = new THREE.Group();
  g.add(cyl(0.35, 0.5, 4.2, 7, P.wood, 0, 2.1, 0));
  g.add(blob(2.2, P.leaf, 0, 5.2, 0, 1));
  g.add(blob(1.6, P.leafLight, -1.4, 4.6, 0.6, 0));
  g.add(blob(1.5, P.leaf, 1.3, 4.4, -0.4, 0));
  g.add(blob(1.3, P.leafLight, 0.4, 6.4, 0.5, 0));
  // birdhouse
  const house = new THREE.Group();
  house.position.set(0, 2.6, 0.48);
  house.add(box(0.7, 0.75, 0.6, P.red, 0, 0, 0.1));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.45, 4), P.woodDark);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 0.6;
  house.add(roof);
  house.add(new THREE.Mesh(new THREE.CircleGeometry(0.16, 10), lambert('#1b1410')).translateZ(0.41).translateY(0.08));
  const door = hinge(house, -0.35, 0, 0.42);
  door.add(box(0.7, 0.75, 0.05, lambert('#d9644f'), 0.35, 0, 0));
  // flyers rolled up inside, pop out on open
  const flyer = box(0.35, 0.45, 0.03, P.white, 0, 0.0, 0.25);
  house.add(flyer);
  g.add(house);
  // signpost
  const sign = new THREE.Group();
  sign.position.set(2.3, 0, 2.2);
  sign.add(box(0.14, 2.0, 0.14, P.woodDark, 0, 1.0, 0));
  const a1 = box(1.2, 0.3, 0.08, P.mustard, 0.35, 1.7, 0);
  const a2 = box(1.0, 0.28, 0.08, P.teal, -0.3, 1.3, 0);
  a2.rotation.y = 0.4;
  sign.add(a1, a2);
  g.add(sign);

  return {
    group: g,
    setOpen: (p) => {
      door.rotation.y = -1.9 * p;
      flyer.position.z = 0.25 + p * 0.55;
      flyer.position.y = p * 0.25;
      flyer.rotation.z = p * 0.3;
    },
  };
}

/**
 * Where each feature lives. `approach` is where your character stands to go in, `cam` the close-up when entering.
 * `labelY` is how high above the station's origin its speech bubble floats.
 */
export const STATIONS = [
  { id: 'trips', name: 'Planner', to: '/planner', x: 1.5, z: -3.2, ry: 0, r: 3.0, approach: [3.8, -0.3], labelY: 4.3, cam: [[0.4, 3.3, 5.8], [2.5, 1.4, -2.0]] },
  { id: 'watcher', name: 'Watcher', to: '/watcher', x: -7.2, z: -4.2, ry: 0.35, r: 1.6, approach: [-6.0, -1.9], labelY: 8.8, cam: [[-3.4, 5.8, 2.6], [-7.0, 4.6, -3.8]] },
  { id: 'tales', name: 'Tales', to: '/tales', x: -3.8, z: 3.4, ry: 0, r: 1.5, approach: [-0.6, 3.0], labelY: 2.9, cam: [[-1.4, 3.4, 8.6], [-2.6, 1.0, 2.2]] },
  { id: 'ledger', name: 'Ledger', to: '/ledger', x: 7.4, z: 2.4, ry: -0.35, r: 2.0, approach: [5.7, 4.6], labelY: 4.0, cam: [[5.6, 3.6, 12.6], [7.2, 1.7, 2.6]] },
  { id: 'archives', name: 'Archives', to: '/archives', x: 10.2, z: -5.6, ry: -0.5, r: 2.1, approach: [7.7, -3.3], labelY: 4.6, cam: [[7.8, 2.8, 2.9], [9.4, 1.1, -4.2]] },
  { id: 'explorer', name: 'Explorer', to: '/explorer', x: -11.0, z: 0.2, ry: 0.5, r: 1.4, approach: [-9.0, 2.6], labelY: 7.4, cam: [[-7.2, 3.8, 8.8], [-10.2, 2.5, 1.0]] },
];

const BUILDERS = {
  trips: buildTrailer, watcher: buildTower, tales: buildCampfire, ledger: buildStall, archives: buildTent, explorer: buildBirdTree,
};

// ---------- scenery ----------

function pineTree(scale, r) {
  const g = new THREE.Group();
  g.add(cyl(0.18, 0.25, 0.9, 5, P.woodDark, 0, 0.45, 0));
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.3 - i * 0.3, 1.5, 6), i % 2 ? P.pineDark : P.pine);
    cone.position.y = 1.3 + i * 0.75;
    cone.rotation.y = r() * Math.PI;
    cone.castShadow = true;
    g.add(cone);
  }
  g.scale.setScalar(scale);
  return g;
}

function roundTree(scale, r) {
  const g = new THREE.Group();
  g.add(cyl(0.2, 0.3, 1.6, 6, P.wood, 0, 0.8, 0));
  g.add(blob(1.2, r() > 0.5 ? P.leaf : P.leafLight, 0, 2.3, 0, 0));
  g.add(blob(0.8, P.leafLight, 0.6, 2.0, 0.3, 0));
  g.scale.setScalar(scale);
  return g;
}

function windmill() {
  const g = new THREE.Group();
  const white = lambert('#f4efe2');
  g.add(cyl(0.18, 0.35, 9, 6, white, 0, 4.5, 0));
  const hub = new THREE.Group();
  hub.position.set(0, 9, 0.35);
  for (let i = 0; i < 3; i++) {
    const blade = box(0.35, 4.2, 0.08, white, 0, 2.1, 0);
    const arm = new THREE.Group();
    arm.rotation.z = (i / 3) * Math.PI * 2;
    arm.add(blade);
    hub.add(arm);
  }
  g.add(hub);
  return { group: g, hub };
}

/** Sky dome with a vertical gradient. */
function buildSky() {
  const uniforms = { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } };
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms,
    vertexShader: 'varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    // colorspace_fragment converts to the canvas's sRGB like the built-in materials do (must sit on its own line)
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vPos;
void main() {
  float h = clamp(normalize(vPos).y * 1.6 + 0.15, 0.0, 1.0);
  gl_FragColor = vec4(mix(bottom, top, h), 1.0);
  #include <colorspace_fragment>
}`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(160, 24, 12), mat);
  return { sky, uniforms };
}

function buildStars() {
  const r = rng(99);
  const pts = [];
  for (let i = 0; i < 400; i++) {
    const a = r() * Math.PI * 2;
    const y = 0.15 + r() * 0.85;
    const rad = Math.sqrt(1 - y * y);
    pts.push(Math.cos(a) * rad * 140, y * 140, Math.sin(a) * rad * 140);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const mat = new THREE.PointsMaterial({ color: '#ffffff', size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  return new THREE.Points(geo, mat);
}

function buildClouds() {
  const r = rng(5);
  const mat = lambert('#ffffff', { transparent: true, opacity: 0.92 });
  const clouds = [];
  for (let i = 0; i < 12; i++) {
    const c = new THREE.Group();
    const n = 3 + Math.floor(r() * 3);
    for (let j = 0; j < n; j++) c.add(blob(1.4 + r() * 1.2, mat, j * 1.7 - n * 0.8, r() * 0.6, r() * 0.8, 0));
    c.position.set(-50 + r() * 100, 16 + r() * 8, -45 + r() * 25);
    c.userData.speed = 0.4 + r() * 0.6;
    clouds.push(c);
  }
  return { clouds, mat };
}

function buildRain() {
  const count = 1400;
  const pos = new Float32Array(count * 6);
  const r = rng(3);
  for (let i = 0; i < count; i++) {
    const x = -24 + r() * 48;
    const y = r() * 22;
    const z = -20 + r() * 40;
    pos.set([x, y, z, x + 0.05, y - 0.6, z], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: '#cfe0ff', transparent: true, opacity: 0.55 });
  const lines = new THREE.LineSegments(geo, mat);
  lines.visible = false;
  return lines;
}

function buildFireflies() {
  const count = 70;
  const r = rng(42);
  const base = [];
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2;
    const d = 3 + r() * 13;
    base.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: 0.6 + r() * 2.5, p: r() * 10 });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: '#fff3a0', size: 0.18, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  return {
    points,
    tick(t) {
      for (let i = 0; i < count; i++) {
        const b = base[i];
        pos[i * 3] = b.x + Math.sin(t * 0.4 + b.p) * 0.8;
        pos[i * 3 + 1] = b.y + Math.sin(t * 0.9 + b.p * 2) * 0.4;
        pos[i * 3 + 2] = b.z + Math.cos(t * 0.35 + b.p) * 0.8;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

/** Sandy paths: segments with round joints, flat on the grass. */
function buildPaths(material) {
  const g = new THREE.Group();
  const W = 1.6;
  const segments = [
    [[0, 19], [0, 7]],
    [[0, 7], [-1.8, 4.6]],
    [[0, 7], [2.2, 0.8]],
    [[0, 7], [6.4, 4.6]],
    [[-1.8, 4.6], [-6.2, -1.6]],
    [[-1.8, 4.6], [-9.2, 2.2]],
    [[6.4, 4.6], [8.8, -2.6]],
  ];
  const joints = new Set();
  for (const [[x1, z1], [x2, z2]] of segments) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(W, len), material);
    plane.rotation.x = -Math.PI / 2;
    plane.rotation.z = Math.atan2(x2 - x1, z2 - z1); // the plane's length (local y) lines up with the segment
    plane.position.set((x1 + x2) / 2, 0.02, (z1 + z2) / 2);
    plane.receiveShadow = true;
    g.add(plane);
    joints.add(`${x1},${z1}`);
    joints.add(`${x2},${z2}`);
  }
  for (const j of joints) {
    const [x, z] = j.split(',').map(Number);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(W / 2, 14), material);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, 0.021, z);
    disc.receiveShadow = true;
    g.add(disc);
  }
  return g;
}

// ---------- the whole camp ----------

export const CAMP_RADIUS = 17; // how far from the middle you can walk

export function buildCamp(scene) {
  P = makePalette();
  const root = new THREE.Group();
  scene.add(root);
  const tickers = [];
  const nightHooks = [];

  // sky, stars, moon, sun disc
  const { sky, uniforms: skyUniforms } = buildSky();
  root.add(sky);
  const stars = buildStars();
  root.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff6d8', fog: false }));
  moon.position.set(38, 42, -110);
  root.add(moon);
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff4c8', fog: false }));
  root.add(sunDisc);

  // lights
  const hemi = new THREE.HemisphereLight('#ffffff', '#556b2f', 1);
  root.add(hemi);
  const sun = new THREE.DirectionalLight('#ffffff', 1.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 90 });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.03;
  root.add(sun, sun.target);

  // ground: a chunky island on a wide meadow
  const groundMat = lambert('#86b85a');
  const island = new THREE.Mesh(new THREE.CylinderGeometry(21, 19.5, 2, 44), groundMat);
  island.position.y = -1;
  island.receiveShadow = true;
  root.add(island);
  const meadowMat = lambert('#7aa752');
  const meadow = new THREE.Mesh(new THREE.CircleGeometry(150, 32), meadowMat);
  meadow.rotation.x = -Math.PI / 2;
  meadow.position.y = -1.6;
  root.add(meadow);
  root.add(buildPaths(P.sand));

  // pond behind the trailer
  const pond = new THREE.Mesh(new THREE.CircleGeometry(2.4, 12), lambert('#5aa3c4', { emissive: '#1a3a5a', emissiveIntensity: 0.2 }));
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(4.6, 0.03, -8.2);
  pond.scale.set(1.4, 1, 1);
  root.add(pond);
  const r = rng(2026);
  for (let i = 0; i < 6; i++) root.add(blob(0.35 + r() * 0.3, P.stone, 4.6 + Math.cos(i) * 3.2, 0.1, -8.2 + Math.sin(i) * 2.3));

  // background hills + windmills
  const hillMat = lambert('#b9cf98');
  for (const [x, z, s, h] of [[-46, -85, 40, 11], [6, -95, 46, 14], [54, -82, 40, 12], [-85, -45, 30, 8], [88, -48, 30, 9]]) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
    hill.scale.set(s, h, s * 0.6);
    hill.position.set(x, -1.6, z);
    root.add(hill);
  }
  const windmills = [];
  for (const [x, z, s] of [[-28, -44, 1], [-12, -56, 1.1], [24, -50, 1], [42, -36, 0.9]]) {
    const w = windmill();
    w.group.position.set(x, -1.5, z);
    w.group.scale.setScalar(s);
    root.add(w.group);
    windmills.push(w.hub);
  }

  const causeway = buildCauseway()
  root.add(causeway.group)
  tickers.push(causeway.tick)
  nightHooks.push(causeway.night)

  // stations
  const stations = STATIONS.map((def) => {
    const built = BUILDERS[def.id]();
    built.group.position.set(def.x, 0, def.z);
    built.group.rotation.y = def.ry;
    built.group.traverse((o) => (o.userData.station = def.id));
    root.add(built.group);
    if (built.tick) tickers.push(built.tick);
    if (built.night) nightHooks.push(built.night);
    return {
      ...def,
      group: built.group,
      setOpen: built.setOpen,
      labelAnchor: new THREE.Vector3(def.x, def.labelY, def.z),
      approachPoint: new THREE.Vector3(def.approach[0], 0, def.approach[1]),
      camPos: new THREE.Vector3(...def.cam[0]),
      camTarget: new THREE.Vector3(...def.cam[1]),
    };
  });

  // colliders: stations + trees (circles on the ground)
  const colliders = STATIONS.map((s) => ({ x: s.x, z: s.z, r: s.r }));
  colliders.push({ x: 4.6, z: -8.2, r: 3.2 }); // pond

  // trees: a ring of pines and round trees around the edge, plus a few in between
  // no trees on doorsteps, paths' ends, or anywhere a close-up camera has to fly through
  const clearZones = [{ x: 4.6, z: -8.2, r: 4 }];
  for (const st of STATIONS) {
    clearZones.push({ x: st.x, z: st.z, r: st.r + 2.2 }, { x: st.approach[0], z: st.approach[1], r: 2.6 });
    const [[cx, , cz], [tx, , tz]] = st.cam;
    for (let k = 0; k <= 4; k++) clearZones.push({ x: cx + ((tx - cx) * k) / 4, z: cz + ((tz - cz) * k) / 4, r: 3.2 });
  }

  const planted = []

  const keepClear = (x, z) => (Math.abs(x) < 2.2 && z > 4) || clearZones.some((c) => Math.hypot(c.x - x, c.z - z) < c.r);
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2;
    const d = i < 30 ? 14 + r() * 5.5 : 6 + r() * 9;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (keepClear(x, z)) continue;
    if (z > 10 && Math.abs(x) < 7) continue; // keep the front open for the camera
    const scale = 0.9 + r() * 0.8;
    const pine = r() > 0.4 ? pineTree(scale, r) : roundTree(scale, r);
    const tree = pine ? pineTree(scale, r) : roundTree(scale, r);
    tree.position.set(x, 0, z);
    root.add(tree);
    colliders.push({ x, z, r: 0.8 * scale });
    planted.push({ x, z, scale, pine});
  }

  const fairyLights = buildFairyLights(planted, rng(77));
  root.add(fairyLights.group);
  tickers.push(fairyLights.tick);
  nightHooks.push(fairyLights.night)

  // flowers
  const flowerGeo = new THREE.IcosahedronGeometry(0.12, 0);
  const flowerMat = new THREE.MeshLambertMaterial({ flatShading: true });
  const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, 160);
  const colors = ['#f7f2e6', '#e86f8a', '#f2b134', '#b48ad8', '#e8a8c8'].map((c) => new THREE.Color(c));
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 160; i++) {
    const a = r() * Math.PI * 2;
    const d = 2 + r() * 17;
    m4.makeTranslation(Math.cos(a) * d, 0.1, Math.sin(a) * d);
    flowers.setMatrixAt(i, m4);
    flowers.setColorAt(i, colors[i % colors.length]);
  }
  root.add(flowers);

  // weather + night
  const { clouds, mat: cloudMat } = buildClouds();
  clouds.forEach((c) => root.add(c));
  const rain = buildRain();
  root.add(rain);
  const fireflies = buildFireflies();
  root.add(fireflies.points);

  let env = null;
  let lightning = 0;

  function setEnvironment(next) {
    env = next;
    skyUniforms.top.value.copy(next.skyTop);
    skyUniforms.bottom.value.copy(next.skyBottom);
    scene.fog = scene.fog || new THREE.FogExp2(0xffffff, 0.01);
    scene.fog.color.copy(next.fog);
    scene.fog.density = next.fogDensity;
    groundMat.color.copy(next.ground);
    meadowMat.color.copy(next.ground).multiplyScalar(0.9);
    hillMat.color.copy(next.hills);
    hemi.color.copy(next.hemiSky);
    hemi.groundColor.copy(next.hemiGround);
    hemi.intensity = next.hemiIntensity;
    sun.color.copy(next.sunColor);
    sun.intensity = next.sunIntensity;
    sun.position.copy(next.sunDir).multiplyScalar(40);
    sunDisc.position.copy(next.sunDir).multiplyScalar(120);
    sunDisc.visible = next.daylight > 0.05 && !next.rain && next.condition !== 'cloudy';
    moon.visible = next.night && !next.rain;
    stars.material.opacity = Math.max(0, 1 - next.daylight * 2.5) * (next.rain ? 0.2 : next.clouds > 6 ? 0.5 : 1);
    fireflies.points.material.opacity = next.rain ? 0 : Math.max(0, 1 - next.daylight * 2);
    const nightAmount = Math.max(0, 1 - next.daylight * 1.6);
    nightHooks.forEach((fn) => fn(nightAmount));
    clouds.forEach((c, i) => (c.visible = i < next.clouds));
    cloudMat.color.set(next.rain ? '#9aa3ad' : '#ffffff').lerp(new THREE.Color('#3a4566'), 1 - next.daylight);
    rain.visible = next.rain;
  }

  const rainPos = rain.geometry.attributes.position;
  function tick(t, dt) {
    tickers.forEach((fn) => fn(t, dt));
    windmills.forEach((hub, i) => (hub.rotation.z = t * (0.6 + i * 0.1)));
    clouds.forEach((c) => {
      if (!c.visible) return;
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 60) c.position.x = -60;
    });
    if (fireflies.points.material.opacity > 0) fireflies.tick(t);
    if (rain.visible) {
      const arr = rainPos.array;
      const fall = dt * 22;
      for (let i = 0; i < arr.length; i += 6) {
        arr[i + 1] -= fall;
        arr[i + 4] -= fall;
        if (arr[i + 4] < 0) {
          arr[i + 1] += 22;
          arr[i + 4] += 22;
        }
      }
      rainPos.needsUpdate = true;
    }
    if (env?.storm) {
      // occasional lightning: a quick double flash of the sky light
      if (lightning <= 0 && Math.random() < dt * 0.12) lightning = 0.35;
      if (lightning > 0) {
        lightning -= dt;
        const flash = lightning > 0.25 || (lightning > 0.08 && lightning < 0.15) ? 2.5 : 0;
        hemi.intensity = env.hemiIntensity + flash;
      }
    }
  }

  function dispose() {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach((m) => m.dispose());
    });
    scene.remove(root);
  }

  return { root, stations, colliders, setEnvironment, setTraffic: causeway.setTraffic, tick, dispose, ground: island };
}
