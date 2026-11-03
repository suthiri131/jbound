import * as THREE from 'three';

const WARM = ['#ffe9a8', '#ffd27a', '#fff4d6', '#ffe0a0'];
const PARTY = ['#ffb3c7', '#b8e0ff', '#c9f2b0', '#f7c6ff'];

/** soft round glow, drawn once on a canvas */
function glowTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext?.('2d');
  if (!ctx) return null;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** bulbs spiralling up a tree's canopy, in the tree's local units (before scaling). */
function spiral(tree, r) {
  const pts = [];
  const turns = 3;
  const n = 26;
  const start = r() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = start + t * turns * Math.PI * 2;
    let rad, y;
    if (tree.pine) {
      // follow the outside of the stacked cones, wide at the bottom, narrow at the tip
      y = 0.65 + t * 2.6;
      rad = 1.38 - t * 1.05;
    } else {
      // wrap the round canopy (a 1.2 ball centred 2.3 up)
      const lat = -0.55 + t * 1.5; // from below the equator to near the top
      y = 2.3 + Math.sin(lat) * 1.28;
      rad = Math.cos(lat) * 1.28;
    }
    pts.push(new THREE.Vector3(tree.x + Math.cos(a) * rad * tree.scale, y * tree.scale, tree.z + Math.sin(a) * rad * tree.scale));
  }
  return pts;
}

/** sagging string of bulbs between two points */
function drape(a, b, sag, spacing = 0.42) {
  const len = a.distanceTo(b);
  const n = Math.max(2, Math.round(len / spacing));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= sag * 4 * t * (1 - t);
    pts.push(p);
  }
  return pts;
}

// trees
export function buildFairyLights(trees, r = Math.random) {
  const group = new THREE.Group();
  group.name = 'fairy-lights';
  const bulbs = []; // Vector3
  const wires = []; // line segments (pairs of Vector3), for the dark cable between bulbs

  const addStrand = (pts) => {
    bulbs.push(...pts);
    for (let i = 1; i < pts.length; i++) wires.push(pts[i - 1], pts[i]);
  };

  // a strand round most trees (skip a few so it doesn't look machine-made)
  for (const tree of trees) if (r() > 0.2) addStrand(spiral(tree, r));

  // strings draped between near neighbours, each tree used at most once
  const used = new Set();
  const top = (t) => new THREE.Vector3(t.x, (t.pine ? 2.2 : 2.5) * t.scale, t.z);
  for (let i = 0; i < trees.length; i++) {
    if (used.has(i)) continue;
    let best = -1;
    let bestD = Infinity;
    for (let j = i + 1; j < trees.length; j++) {
      if (used.has(j)) continue;
      const d = Math.hypot(trees[i].x - trees[j].x, trees[i].z - trees[j].z);
      if (d > 2.5 && d < 7 && d < bestD) {
        best = j;
        bestD = d;
      }
    }
    if (best < 0) continue;
    used.add(i).add(best);
    addStrand(drape(top(trees[i]), top(trees[best]), 0.35 + bestD * 0.08));
  }

  // bulbs
  const count = bulbs.length;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const base = [];
  const phase = new Float32Array(count);
  const speed = new Float32Array(count);
  const c = new THREE.Color();
  bulbs.forEach((p, i) => {
    pos.set([p.x, p.y, p.z], i * 3);
    c.set(r() < 0.8 ? WARM[i % WARM.length] : PARTY[i % PARTY.length]);
    base.push(c.clone());
    phase[i] = r() * Math.PI * 2;
    speed[i] = 1.2 + r() * 2.4;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const map = glowTexture();
  const mat = new THREE.PointsMaterial({
    size: map ? 0.85 : 0.16,
    map,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.visible = false;
  group.add(points);

  // the cable
  const wireGeo = new THREE.BufferGeometry().setFromPoints(wires);
  const wireMat = new THREE.LineBasicMaterial({ color: '#1b1f1a', transparent: true, opacity: 0 });
  const cable = new THREE.LineSegments(wireGeo, wireMat);
  cable.visible = false;
  group.add(cable);

  let night = 0;
  return {
    group,
    count,
    night(amount) {
      night = amount;
      mat.opacity = Math.min(1, amount * 1.4);
      wireMat.opacity = amount * 0.25;
      points.visible = cable.visible = amount > 0.02;
    },
    tick(t) {
      if (!points.visible) return;
      for (let i = 0; i < count; i++) {
        // mostly steady with a soft shimmer; now and then a bulb dips low, like real fairy lights
        const s = Math.sin(t * speed[i] + phase[i]);
        const k = (0.75 + 0.25 * s - (s > 0.97 ? 0.45 : 0)) * 1.7; // over 1 on purpose: additive glow reads brighter
        col[i * 3] = base[i].r * k;
        col[i * 3 + 1] = base[i].g * k;
        col[i * 3 + 2] = base[i].b * k;
      }
      geo.attributes.color.needsUpdate = true;
      mat.size = (map ? 0.85 : 0.16) * (0.85 + night * 0.15);
    },
    dispose() {
      geo.dispose();
      wireGeo.dispose();
      mat.dispose();
      wireMat.dispose();
      map?.dispose();
    },
  };
}