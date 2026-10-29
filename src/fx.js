import * as THREE from 'three';
import { scene } from './engine.js';

const effects = [];
const tracers = [];
const tracerMaterialBase = {
  color: 0xffd58a,
  transparent: true,
  opacity: 0.92,
  depthWrite: false,
};

export function spawnParticles(position, color, count, options = {}) {
  const {
    speed = 3,
    gravity = 8,
    size = 0.1,
    life = 0.65,
    spread = 0.12,
  } = options;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const index = i * 3;
    positions[index] = position.x + (Math.random() - 0.5) * spread;
    positions[index + 1] = position.y + (Math.random() - 0.5) * spread;
    positions[index + 2] = position.z + (Math.random() - 0.5) * spread;
    velocities[index] = (Math.random() - 0.5) * speed;
    velocities[index + 1] = Math.random() * speed * 0.75 + speed * 0.16;
    velocities[index + 2] = (Math.random() - 0.5) * speed;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size,
    sizeAttenuation: true,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);
  effects.push({
    points,
    velocities,
    life,
    maxLife: life,
    gravity,
  });
}

export function spawnBlood(position) {
  spawnParticles(position, 0x7b2118, 9, {
    speed: 3.4,
    gravity: 9,
    size: 0.1,
    life: 0.62,
    spread: 0.06,
  });
}

export function spawnDust(position) {
  spawnParticles(position, 0x9b8b69, 7, {
    speed: 1.8,
    gravity: 2.2,
    size: 0.13,
    life: 0.48,
    spread: 0.1,
  });
}

export function spawnTracer(start, end) {
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const material = new THREE.LineBasicMaterial(tracerMaterialBase);
  const line = new THREE.Line(geometry, material);
  line.frustumCulled = false;
  scene.add(line);
  tracers.push({ line, life: 0.085, maxLife: 0.085 });
}

export function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i -= 1) {
    const effect = effects[i];
    effect.life -= dt;
    if (effect.life <= 0) {
      scene.remove(effect.points);
      effect.points.geometry.dispose();
      effect.points.material.dispose();
      effects.splice(i, 1);
      continue;
    }
    const positionAttribute = effect.points.geometry.attributes.position;
    const array = positionAttribute.array;
    for (let p = 0; p < array.length; p += 3) {
      effect.velocities[p + 1] -= effect.gravity * dt;
      array[p] += effect.velocities[p] * dt;
      array[p + 1] += effect.velocities[p + 1] * dt;
      array[p + 2] += effect.velocities[p + 2] * dt;
      if (array[p + 1] < 0.03) {
        array[p + 1] = 0.03;
        effect.velocities[p + 1] *= -0.22;
        effect.velocities[p] *= 0.75;
        effect.velocities[p + 2] *= 0.75;
      }
    }
    positionAttribute.needsUpdate = true;
    effect.points.material.opacity = effect.life / effect.maxLife;
  }

  for (let i = tracers.length - 1; i >= 0; i -= 1) {
    const tracer = tracers[i];
    tracer.life -= dt;
    if (tracer.life <= 0) {
      scene.remove(tracer.line);
      tracer.line.geometry.dispose();
      tracer.line.material.dispose();
      tracers.splice(i, 1);
      continue;
    }
    tracer.line.material.opacity = (tracer.life / tracer.maxLife) * 0.92;
  }
}
