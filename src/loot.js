import * as THREE from 'three';
import { QUALITY, LOOT_INFO, TAU, clamp, worldRandom } from './config.js';
import { scene } from './engine.js';
import { material } from './materials.js';
import { terrainHeight } from './world.js';

export const pickups = [];

const lootPositions = [
  ['food', -7.1, 20.8],
  ['food', 11.1, -28.7],
  ['food', -30.6, 37.2],
  ['food', 4.2, 33.2],
  ['water', 13, 4.5],
  ['water', -20.1, -9.4],
  ['water', 6.4, 30.1],
  ['water', 30.2, -40.8],
  ['med', 19.4, -6.2],
  ['med', -8.4, -41.4],
  ['med', 4.1, -51.1],
  ['ammo', -8.3, -3.6],
  ['ammo', 10.7, -43.7],
  ['ammo', 33.1, 16.7],
  ['ammo', -29.2, 31.4],
  ['rifleAmmo', 26.2, -40.3],
  ['rifleAmmo', -26.5, -48.8],
  ['rifle', -12.1, -18.8],
];

function addCan(visual) {
  const can = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.3, 8),
    new THREE.MeshLambertMaterial({ color: 0xb8994e, flatShading: true }),
  );
  visual.add(can);
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.163, 0.163, 0.16, 8),
    new THREE.MeshLambertMaterial({ color: 0x7d3d2d, flatShading: true }),
  );
  visual.add(label);
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.012, 8),
    material.metal,
  );
  lid.position.y = 0.155;
  visual.add(lid);
}

function addBottle(visual) {
  const bottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.15, 0.35, 7),
    new THREE.MeshLambertMaterial({ color: 0x5c9ba6, transparent: true, opacity: 0.82, flatShading: true }),
  );
  visual.add(bottle);
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.075, 0.11, 6),
    new THREE.MeshLambertMaterial({ color: 0x5c9ba6, transparent: true, opacity: 0.82, flatShading: true }),
  );
  neck.position.y = 0.22;
  visual.add(neck);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.055, 6), material.metal);
  cap.position.y = 0.29;
  visual.add(cap);
}

function addMed(visual) {
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.18, 0.24),
    new THREE.MeshLambertMaterial({ color: 0xd6d0bb, flatShading: true }),
  );
  visual.add(box);
  const crossVertical = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.13, 0.015),
    new THREE.MeshBasicMaterial({ color: 0xa9372d }),
  );
  crossVertical.position.set(0, 0, 0.125);
  visual.add(crossVertical);
  const crossHorizontal = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.05, 0.015),
    new THREE.MeshBasicMaterial({ color: 0xa9372d }),
  );
  crossHorizontal.position.set(0, 0, 0.125);
  visual.add(crossHorizontal);
}

function addAmmo(visual) {
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.19, 0.24),
    new THREE.MeshLambertMaterial({ color: 0x5b5c3d, flatShading: true }),
  );
  visual.add(box);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.33, 0.045, 0.245),
    new THREE.MeshLambertMaterial({ color: 0xb39559, flatShading: true }),
  );
  stripe.position.y = 0.025;
  visual.add(stripe);
}

function addRifle(visual) {
  const stock = new THREE.Mesh(
    new THREE.BoxGeometry(0.105, 0.12, 0.85),
    new THREE.MeshLambertMaterial({ color: 0x775638, flatShading: true }),
  );
  stock.position.z = -0.1;
  visual.add(stock);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.78, 5), material.metal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.025, 0.58);
  visual.add(barrel);
  const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.06), material.metal);
  bolt.position.set(0.08, 0.04, 0.08);
  visual.add(bolt);
}

function createPickup(type, x, z) {
  const info = LOOT_INFO[type];
  const group = new THREE.Group();
  const visual = new THREE.Group();
  group.add(visual);
  group.position.set(x, terrainHeight(x, z), z);

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: info.color,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.43, 16), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.025;
  group.add(ring);

  if (type === 'food') addCan(visual);
  else if (type === 'water') addBottle(visual);
  else if (type === 'med') addMed(visual);
  else if (type === 'ammo' || type === 'rifleAmmo') addAmmo(visual);
  else if (type === 'rifle') addRifle(visual);

  visual.position.y = 0.45;
  visual.rotation.y = worldRandom() * TAU;
  visual.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = QUALITY === 'high';
      child.receiveShadow = QUALITY === 'high';
    }
  });

  scene.add(group);
  pickups.push({
    type,
    group,
    visual,
    ring,
    ringMaterial,
    x,
    z,
    phase: worldRandom() * TAU,
    taken: false,
    baseRotation: visual.rotation.y,
  });
}

export function createLoot() {
  for (const [type, x, z] of lootPositions) createPickup(type, x, z);
}

export function updateLoot(elapsed, dt) {
  for (const pickup of pickups) {
    if (pickup.taken) continue;
    pickup.visual.position.y = 0.44 + Math.sin(elapsed * 2.1 + pickup.phase) * 0.065;
    pickup.visual.rotation.y += dt * 0.55;
    const pulse = 0.26 + Math.sin(elapsed * 2.4 + pickup.phase) * 0.08;
    pickup.ringMaterial.opacity = pulse;
    pickup.ring.scale.setScalar(1 + Math.sin(elapsed * 1.7 + pickup.phase) * 0.04);
  }
}

export function findNearestPickup(position, range = 2.75) {
  let nearest = null;
  let nearestDistance = range;
  for (const pickup of pickups) {
    if (pickup.taken) continue;
    const distance = Math.hypot(position.x - pickup.x, position.z - pickup.z);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = pickup;
    }
  }
  return nearest;
}

export function collectPickup(pickup) {
  if (!pickup || pickup.taken) return;
  pickup.taken = true;
  pickup.group.visible = false;
}
