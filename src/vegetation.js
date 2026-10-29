import * as THREE from 'three';
import { QUALITY, TOWN, POND, TAU, detailRandom, worldRandom } from './config.js';
import { material } from './materials.js';
import { scene } from './engine.js';
import { addCircleCollider, boxColliders, terrainHeight } from './world.js';

function isTreeClear(x, z) {
  if (Math.hypot(x - TOWN.x, (z - TOWN.z) * 0.93) < 45) return false;
  if (Math.abs(x) < 7.5 && z > -56 && z < 42) return false;
  if (Math.abs(z + 8) < 7.5 && Math.abs(x) < 48) return false;
  if (Math.hypot(x - POND.x, z - POND.z) < POND.radius + 5) return false;
  if (Math.hypot(x - 2, z - 27) < 9) return false;
  if (Math.abs(x) > 154 || Math.abs(z) > 154) return false;
  for (const collider of boxColliders) {
    if (x > collider.minX - 4 && x < collider.maxX + 4 && z > collider.minZ - 4 && z < collider.maxZ + 4) return false;
  }
  return true;
}

function buildTrees() {
  const targetCount = QUALITY === 'low' ? 84 : 158;
  const trees = [];
  let attempts = 0;
  while (trees.length < targetCount && attempts < targetCount * 40) {
    attempts += 1;
    const angle = worldRandom() * TAU;
    const radius = 35 + Math.pow(worldRandom(), 0.72) * 116;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius - 8;
    if (!isTreeClear(x, z)) continue;
    let overlapping = false;
    for (const tree of trees) {
      if (Math.hypot(x - tree.x, z - tree.z) < 2.1) {
        overlapping = true;
        break;
      }
    }
    if (overlapping) continue;
    trees.push({
      x,
      z,
      scale: 0.72 + worldRandom() * 0.68,
      rotation: worldRandom() * TAU,
      tint: worldRandom(),
    });
  }

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.31, 2.5, 5);
  const trunkMesh = new THREE.InstancedMesh(trunkGeometry, material.trunk, trees.length);
  trunkMesh.castShadow = QUALITY === 'high';
  trunkMesh.receiveShadow = QUALITY === 'high';

  const layerDefinitions = [
    { radius: 1.62, height: 3.3, y: 2.55, colorA: 0x2f4b35, colorB: 0x3c5a3d },
    { radius: 1.26, height: 2.95, y: 4.2, colorA: 0x38563b, colorB: 0x466645 },
    { radius: 0.78, height: 2.2, y: 5.35, colorA: 0x405f40, colorB: 0x50704a },
  ];
  const foliageMeshes = layerDefinitions.map((layer) => {
    const geometry = new THREE.ConeGeometry(layer.radius, layer.height, 6);
    const mesh = new THREE.InstancedMesh(geometry, material.foliage, trees.length);
    mesh.castShadow = QUALITY === 'high';
    mesh.receiveShadow = QUALITY === 'high';
    return mesh;
  });

  trees.forEach((tree, index) => {
    const ground = terrainHeight(tree.x, tree.z);
    const scale = tree.scale;
    dummy.position.set(tree.x, ground + 1.25 * scale, tree.z);
    dummy.rotation.set(0, tree.rotation, 0);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(index, dummy.matrix);

    layerDefinitions.forEach((layer, layerIndex) => {
      dummy.position.set(tree.x, ground + layer.y * scale, tree.z);
      dummy.rotation.set(0, tree.rotation + layerIndex * 0.24, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      foliageMeshes[layerIndex].setMatrixAt(index, dummy.matrix);
      color.setHex(layer.colorA).lerp(new THREE.Color(layer.colorB), tree.tint);
      color.multiplyScalar(0.9 + detailRandom() * 0.16);
      foliageMeshes[layerIndex].setColorAt(index, color);
    });

    addCircleCollider(tree.x, tree.z, 0.26 * scale);
  });

  trunkMesh.instanceMatrix.needsUpdate = true;
  scene.add(trunkMesh);
  for (const mesh of foliageMeshes) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
  }
}

function buildRocks() {
  const count = QUALITY === 'low' ? 32 : 55;
  const mesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), material.rock, count);
  mesh.castShadow = QUALITY === 'high';
  mesh.receiveShadow = QUALITY === 'high';
  const dummy = new THREE.Object3D();
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 25) {
    attempts += 1;
    const angle = worldRandom() * TAU;
    const radius = 30 + worldRandom() * 118;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius - 8;
    if (Math.hypot(x - TOWN.x, z - TOWN.z) < 36) continue;
    if (Math.hypot(x - POND.x, z - POND.z) < POND.radius + 2) continue;
    if (Math.abs(x) < 6 && z > -55 && z < 40) continue;
    const scale = 0.3 + Math.pow(worldRandom(), 1.6) * 1.7;
    dummy.position.set(x, terrainHeight(x, z) + scale * 0.32, z);
    dummy.rotation.set(worldRandom() * 0.5, worldRandom() * TAU, worldRandom() * 0.5);
    dummy.scale.set(scale * (0.8 + worldRandom() * 0.7), scale * 0.7, scale * (0.8 + worldRandom() * 0.5));
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    placed += 1;
  }
  mesh.count = placed;
  scene.add(mesh);
}

function buildGrass() {
  const count = QUALITY === 'low' ? 150 : 360;
  const geometry = new THREE.ConeGeometry(0.085, 0.58, 3);
  geometry.translate(0, 0.29, 0);
  const mesh = new THREE.InstancedMesh(geometry, material.foliage, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 8) {
    attempts += 1;
    const angle = worldRandom() * TAU;
    const radius = 18 + Math.pow(worldRandom(), 0.65) * 115;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius - 8;
    if (Math.abs(x) < 4.2 && z > -54 && z < 40) continue;
    if (Math.abs(z + 8) < 4.2 && Math.abs(x) < 44) continue;
    if (Math.hypot(x - POND.x, z - POND.z) < POND.radius) continue;
    const scale = 0.55 + worldRandom() * 1.2;
    dummy.position.set(x, terrainHeight(x, z), z);
    dummy.rotation.set(0, worldRandom() * TAU, (worldRandom() - 0.5) * 0.12);
    dummy.scale.set(scale, scale * (0.65 + worldRandom() * 0.7), scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    color.setHex(worldRandom() > 0.35 ? 0x7d7c4f : 0x8b8455).multiplyScalar(0.8 + worldRandom() * 0.25);
    mesh.setColorAt(placed, color);
    placed += 1;
  }
  mesh.count = placed;
  scene.add(mesh);
}

function buildBushes() {
  const count = QUALITY === 'low' ? 18 : 38;
  const geometry = new THREE.IcosahedronGeometry(0.62, 0);
  const mesh = new THREE.InstancedMesh(geometry, material.foliage, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 15) {
    attempts += 1;
    const angle = worldRandom() * TAU;
    const radius = 26 + worldRandom() * 112;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius - 8;
    if (Math.hypot(x - TOWN.x, z - TOWN.z) < 37) continue;
    if (Math.abs(x) < 6 && z > -55 && z < 40) continue;
    if (Math.hypot(x - POND.x, z - POND.z) < POND.radius) continue;
    const scale = 0.55 + worldRandom() * 1.1;
    dummy.position.set(x, terrainHeight(x, z) + scale * 0.35, z);
    dummy.rotation.set(worldRandom() * 0.12, worldRandom() * TAU, worldRandom() * 0.12);
    dummy.scale.set(scale * 1.5, scale * 0.7, scale * 1.3);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    color.setHex(worldRandom() > 0.4 ? 0x46603d : 0x5b6844).multiplyScalar(0.85 + worldRandom() * 0.2);
    mesh.setColorAt(placed, color);
    placed += 1;
  }
  mesh.count = placed;
  scene.add(mesh);
}

function buildMountains() {
  const count = 18;
  const geometry = new THREE.ConeGeometry(1, 1, 5);
  const mountainMaterial = new THREE.MeshLambertMaterial({ color: 0x536066, flatShading: true });
  const mesh = new THREE.InstancedMesh(geometry, mountainMaterial, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * TAU + worldRandom() * 0.12;
    const radius = 205 + worldRandom() * 72;
    const width = 24 + worldRandom() * 38;
    const height = 38 + worldRandom() * 55;
    dummy.position.set(Math.cos(angle) * radius, height * 0.5 - 8, Math.sin(angle) * radius);
    dummy.rotation.set(0, worldRandom() * TAU, 0);
    dummy.scale.set(width, height, width * (0.8 + worldRandom() * 0.5));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  scene.add(mesh);
}

export function buildVegetation() {
  buildTrees();
  buildRocks();
  buildGrass();
  buildBushes();
  buildMountains();
}
