<script setup>
/** A single camp character on a patch of grass, slowly turning. Used by the profile's character editor. */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as THREE from 'three';
import { buildAvatar } from '@/lib/camp/avatar';

const props = defineProps({
  look: { type: Object, default: null },
  size: { type: Number, default: 220 },
});

const wrap = ref(null);
let renderer, scene, camera, avatar, raf;
const clock = new THREE.Clock();
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function rebuild() {
  if (avatar) {
    scene.remove(avatar.group);
    avatar.dispose();
  }
  avatar = buildAvatar(props.look);
  avatar.group.rotation.y = 0.5;
  scene.add(avatar.group);
}

function frame() {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!reduceMotion) avatar.group.rotation.y += dt * 0.6;
  avatar.animate(dt, 0);
  renderer.render(scene, camera);
}

onMounted(() => {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(props.size, props.size);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  wrap.value.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 2.2, 5.4);
  camera.lookAt(0, 0.95, 0);
  scene.add(new THREE.HemisphereLight('#eef8ff', '#7a9a50', 1.5));
  const sun = new THREE.DirectionalLight('#fff1d6', 1.8);
  sun.position.set(3, 5, 4);
  scene.add(sun);
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.2, 0.3, 10), new THREE.MeshLambertMaterial({ color: '#8cc461', flatShading: true }));
  grass.position.y = -0.15;
  scene.add(grass);

  rebuild();
  frame();
});

onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  avatar?.dispose();
  scene?.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose?.();
  });
  renderer?.dispose();
  renderer?.forceContextLoss();
});

watch(() => props.look, () => scene && rebuild(), { deep: true });
</script>

<template>
  <div ref="wrap" class="avatar-preview" :style="{ width: `${size}px`, height: `${size}px` }" />
</template>

<style scoped>
.avatar-preview {
  border-radius: 50%;
  background: radial-gradient(circle at 50% 35%, #d6eff2, #9fd2e8);
  overflow: hidden;
  flex: none;
}
.avatar-preview :deep(canvas) {
  display: block;
}
</style>
