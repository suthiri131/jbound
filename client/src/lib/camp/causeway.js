import * as THREE from 'three';


const Z = -64; // middle of the deck
const Y = 0.5; // road surface
const HALF = 47; // half the length of the road, end to end between the checkpoints
const LANE_Z = { toJb: Z + 0.9, toSg: Z - 0.9 };

// traffic
const MAX_CARS = 34;
const carsFor = (score) => Math.round(4 + (score / 100) * 30);
const crossingTime = (score) => 16 + (score / 100) * 64; // seconds for one car to cross
const DEFAULT_SCORE = 30;

const CAR_COLORS = ['#e2573c', '#fffdf7', '#2f7fbf', '#f2b134', '#2e6b46', '#b48ad8', '#3a3f47', '#3f8f86'];

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

function checkpoint({ x, roof, wall, flag, towers = [] }, M) {
  const g = new THREE.Group();
  g.position.set(x, 0, Z);
  const side = Math.sign(x); // +1 = Johor end
  g.add(box(13, Y + 1.62, 12, M.pad, side * 3, (Y - 1.6) / 2, 0)); // reclaimed land the checkpoint stands on
  g.add(box(9, 5, 9, M.hall(wall), side * 3, Y + 0.2, 0)); // the hall the road runs into
  g.add(box(9.8, 0.6, 9.8, M.hall(roof), side * 3, Y + 3, 0)); // flat roof
  g.add(box(4.2, 0.4, 7.4, M.hall(roof), -side * 2.8, Y + 2.6, 0)); // canopy over the booths
  for (const dz of [-3.2, 3.2]) g.add(box(0.4, 2.2, 0.4, M.post, -side * 1.2, Y + 1.3, dz));
  for (const dz of [-2, 0, 2]) g.add(box(0.6, 1.1, 0.6, M.booth, -side * 2.6, Y + 0.55, dz)); // booths sit between the lanes
  // flagpole on the roof
  g.add(box(0.16, 3, 0.16, M.post, side * 1, Y + 4.8, -3));
  const f = new THREE.Group();
  f.position.set(side * 1, Y + 5.9, -3);
  flag(f, M);
  g.add(f);
  // a few towers on the shore behind (JB's skyline)
  for (const [dx, dz, w, h, col] of towers) g.add(box(w, h, w, M.hall(col), side * dx, -1.6 + h / 2, dz));
  return { group: g, flag: f };
}

const sgFlag = (g, M) => {
  g.add(box(2.2, 0.7, 0.06, M.flagRed, 1.1, 0.35, 0));
  g.add(box(2.2, 0.7, 0.06, M.flagWhite, 1.1, -0.35, 0));
};
const myFlag = (g, M) => {
  for (let i = 0; i < 4; i++) g.add(box(2.2, 0.35, 0.06, i % 2 ? M.flagWhite : M.flagRed, 1.1, 0.52 - i * 0.35, 0));
  g.add(box(1, 0.7, 0.08, M.flagBlue, 0.5, 0.35, 0));
};

export function buildCauseway() {
  const root = new THREE.Group();
  root.name = 'causeway';
  const mats = [];
  const keep = (m) => (mats.push(m), m);
  const hallCache = new Map();
  const M = {
    sea: keep(lambert('#4f93b5', { emissive: '#12324a', emissiveIntensity: 0.25 })),
    sand: keep(lambert('#dcc48f')),
    pad: keep(lambert('#8cb35e')),
    wall: keep(lambert('#a49a8a')),
    wallDark: keep(lambert('#7f7668')),
    road: keep(lambert('#8a8580')),
    dash: keep(lambert('#f4efe2')),
    rail: keep(lambert('#5d5a55')),
    post: keep(lambert('#3a3f47')),
    booth: keep(lambert('#f2b134')),
    lamp: keep(new THREE.MeshLambertMaterial({ color: '#fff3c4', emissive: '#ffd36b', emissiveIntensity: 0 })),
    flagRed: keep(lambert('#d63a2f')),
    flagWhite: keep(lambert('#f8f4ea')),
    flagBlue: keep(lambert('#1f3a8a')),
    hall: (c) => hallCache.get(c) || (hallCache.set(c, keep(lambert(c))), hallCache.get(c)),
  };

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(320, 22), M.sea);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -1.55, Z);
  root.add(sea);
  for (const dz of [-11.4, 11.4]) {
    const shore = new THREE.Mesh(new THREE.PlaneGeometry(320, 1.6), M.sand);
    shore.rotation.x = -Math.PI / 2;
    shore.position.set(0, -1.54, Z + dz);
    root.add(shore);
  }

  // the causeway
  const len = HALF * 2;
  root.add(box(len, Y + 1.6, 4.6, M.wall, 0, (Y - 1.6) / 2, Z));
  root.add(box(len, 0.5, 4.9, M.wallDark, 0, -1.35, Z)); // darker footing at the waterline
  root.add(box(len, 0.08, 4.2, M.road, 0, Y + 0.04, Z));
  for (let x = -HALF + 2; x < HALF; x += 4) root.add(box(1.8, 0.02, 0.14, M.dash, x, Y + 0.09, Z));
  for (const dz of [-2.25, 2.25]) root.add(box(len, 0.35, 0.16, M.rail, 0, Y + 0.25, Z + dz));

  // lamp posts down the far side, lit after dark
  for (let x = -HALF + 6; x < HALF - 4; x += 9) {
    root.add(box(0.14, 2.6, 0.14, M.post, x, Y + 1.3, Z - 2.25));
    root.add(box(0.7, 0.12, 0.14, M.post, x + 0.3, Y + 2.6, Z - 2.25));
    root.add(box(0.36, 0.22, 0.3, M.lamp, x + 0.55, Y + 2.5, Z - 2.25));
  }

  // a checkpoint at each end: Singapore on the left, Johor Bahru on the right
  const sg = checkpoint({ x: -HALF - 1, roof: '#2f6f6a', wall: '#f1e6c9', flag: sgFlag }, M);
  const jb = checkpoint({
    x: HALF + 1, roof: '#c94f3d', wall: '#efe2c4', flag: myFlag,
    towers: [[2, -15, 3, 7, '#d9cdb2'], [6, -14, 2.6, 10, '#c9d4dc'], [10, -16, 3.2, 6, '#e6d3a8'], [-3, -14.5, 2.4, 8, '#b9c3c9'], [14, -15, 2.4, 7.5, '#d9cdb2']],
  }, M);
  root.add(sg.group, jb.group);

  // traffic: two instanced meshes (bodies + cabins) shared by both lanes
  const bodyGeo = new THREE.BoxGeometry(2.3, 0.75, 1.1);
  const cabinGeo = new THREE.BoxGeometry(1.2, 0.5, 0.95);
  const bodyMat = keep(new THREE.MeshLambertMaterial({ flatShading: true }));
  const cabinMat = keep(lambert('#cfe6f0', { emissive: '#000000' }));
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, MAX_CARS * 2);
  const cabins = new THREE.InstancedMesh(cabinGeo, cabinMat, MAX_CARS * 2);
  bodies.frustumCulled = cabins.frustumCulled = false; // instances move; the base box sits at the origin
  root.add(bodies, cabins);

  const lanes = [
    { key: 'toJb', dir: 1, z: LANE_Z.toJb, score: DEFAULT_SCORE, phase: 0 },
    { key: 'toSg', dir: -1, z: LANE_Z.toSg, score: DEFAULT_SCORE, phase: 0.37 },
  ];
  const color = new THREE.Color();
  lanes.forEach((lane, li) => {
    for (let i = 0; i < MAX_CARS; i++) {
      bodies.setColorAt(li * MAX_CARS + i, color.set(CAR_COLORS[(i * 5 + 2 + li * 3) % CAR_COLORS.length]));
    }
  });
  bodies.instanceColor.needsUpdate = true;

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  function layoutLanes() {
    lanes.forEach((lane, li) => {
      const n = carsFor(lane.score);
      for (let i = 0; i < MAX_CARS; i++) {
        const idx = li * MAX_CARS + i;
        if (i >= n) {
          bodies.setMatrixAt(idx, hidden);
          cabins.setMatrixAt(idx, hidden);
          continue;
        }
        // evenly spaced around a loop that runs from one checkpoint hall to the other
        const u = (((lane.phase + (i + li * 0.5) / n) % 1) + 1) % 1;
        const x = lane.dir * (-HALF - 3 + u * (len + 6));
        const truck = i % 7 === 3;
        scl.set(truck ? 1.55 : 1, truck ? 1.35 : 1, 1);
        pos.set(x, Y + 0.48 * scl.y, lane.z);
        bodies.setMatrixAt(idx, m4.compose(pos, q, scl));
        // cabin sits towards the front for cars, at the very front for trucks
        pos.set(x + lane.dir * (truck ? 1.35 : -0.1), Y + (truck ? 1.25 : 1.05), lane.z);
        scl.set(truck ? 0.75 : 1, 1, 1);
        cabins.setMatrixAt(idx, m4.compose(pos, q, scl));
      }
    });
    bodies.instanceMatrix.needsUpdate = true;
    cabins.instanceMatrix.needsUpdate = true;
  }
  layoutLanes();

  return {
    group: root,
    /** congestion scores 0-100 per direction; anything missing keeps its current value. */
    setTraffic({ toJb, toSg } = {}) {
      if (Number.isFinite(toJb)) lanes[0].score = THREE.MathUtils.clamp(toJb, 0, 100);
      if (Number.isFinite(toSg)) lanes[1].score = THREE.MathUtils.clamp(toSg, 0, 100);
      layoutLanes();
    },
    tick(t, dt) {
      // phase advances continuously, so a new score changes the speed without making cars jump
      for (const lane of lanes) lane.phase = (lane.phase + dt / crossingTime(lane.score)) % 1;
      layoutLanes();
      sg.flag.rotation.y = Math.sin(t * 2.4) * 0.2;
      jb.flag.rotation.y = Math.sin(t * 2.4 + 1) * 0.2;
    },
    /** 0 = day, 1 = full night: street lamps and car windows light up. */
    night(amount) {
      M.lamp.emissiveIntensity = amount * 1.6;
      cabinMat.emissive.set('#ffd36b');
      cabinMat.emissiveIntensity = amount * 0.6;
    },
    dispose() {
      root.traverse((o) => o.geometry?.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

export const __test = { carsFor, crossingTime };
