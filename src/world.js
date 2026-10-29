import * as THREE from 'three';
import { QUALITY, TOWN, POND, WATER_LEVEL, clamp, smoothstep, worldRandom } from './config.js';
import { material } from './materials.js';
import { scene } from './engine.js';

export const boxColliders = [];
export const circleColliders = [];
export let terrainMesh;

export function terrainHeight(x, z) {
  let height =
    Math.sin(x * 0.045 + 1.3) * 0.72 +
    Math.cos(z * 0.038 - 0.7) * 0.48 +
    Math.sin((x + z) * 0.021 + 0.6) * 1.55 +
    Math.sin(x * 0.105 + z * 0.072) * 0.24;

  const townDistance = Math.hypot(x - TOWN.x, (z - TOWN.z) * 0.93);
  height *= smoothstep(40, 82, townDistance);

  const pondDistance = Math.hypot(x - POND.x, z - POND.z);
  if (pondDistance < POND.radius) {
    height -= Math.pow(1 - pondDistance / POND.radius, 2) * 3.25;
  }

  const edge = Math.max(Math.abs(x), Math.abs(z));
  if (edge > 112) height += Math.pow(edge - 112, 1.36) * 0.055;

  return height;
}

export function isPondWater(x, z) {
  return Math.hypot(x - POND.x, z - POND.z) < POND.radius * 0.83 && terrainHeight(x, z) < WATER_LEVEL;
}

export function addBoxCollider(x, z, width, depth, pad = 0.15) {
  boxColliders.push({
    minX: x - width / 2 - pad,
    maxX: x + width / 2 + pad,
    minZ: z - depth / 2 - pad,
    maxZ: z + depth / 2 + pad,
  });
}

export function addCircleCollider(x, z, radius) {
  circleColliders.push({ x, z, radius });
}

export function resolvePosition(position, radius = 0.35) {
  for (let pass = 0; pass < 2; pass += 1) {
    for (const collider of boxColliders) {
      const nearestX = clamp(position.x, collider.minX, collider.maxX);
      const nearestZ = clamp(position.z, collider.minZ, collider.maxZ);
      const dx = position.x - nearestX;
      const dz = position.z - nearestZ;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq >= radius * radius) continue;

      if (distanceSq > 0.000001) {
        const distance = Math.sqrt(distanceSq);
        position.x = nearestX + (dx / distance) * radius;
        position.z = nearestZ + (dz / distance) * radius;
      } else {
        const left = position.x - collider.minX;
        const right = collider.maxX - position.x;
        const top = position.z - collider.minZ;
        const bottom = collider.maxZ - position.z;
        const nearest = Math.min(left, right, top, bottom);
        if (nearest === left) position.x = collider.minX - radius;
        else if (nearest === right) position.x = collider.maxX + radius;
        else if (nearest === top) position.z = collider.minZ - radius;
        else position.z = collider.maxZ + radius;
      }
    }

    for (const collider of circleColliders) {
      const dx = position.x - collider.x;
      const dz = position.z - collider.z;
      const minDistance = radius + collider.radius;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq >= minDistance * minDistance) continue;
      const distance = Math.sqrt(distanceSq) || 0.0001;
      position.x = collider.x + (dx / distance) * minDistance;
      position.z = collider.z + (dz / distance) * minDistance;
    }
  }

  position.x = clamp(position.x, -136, 136);
  position.z = clamp(position.z, -136, 136);
}

export function buildTerrain() {
  const size = 360;
  const segments = QUALITY === 'low' ? 72 : 96;
  let geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const source = geometry.attributes.position;
  for (let i = 0; i < source.count; i += 1) {
    source.setY(i, terrainHeight(source.getX(i), source.getZ(i)));
  }
  source.needsUpdate = true;
  geometry = geometry.toNonIndexed();
  geometry.computeVertexNormals();

  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const grassPalette = [
    new THREE.Color(0x596a43),
    new THREE.Color(0x61734a),
    new THREE.Color(0x4e603d),
    new THREE.Color(0x6a714b),
    new THREE.Color(0x747052),
  ];
  const dirtPalette = [
    new THREE.Color(0x70654c),
    new THREE.Color(0x786b50),
    new THREE.Color(0x655c46),
  ];
  const chosen = new THREE.Color();

  for (let i = 0; i < position.count; i += 3) {
    const x = (position.getX(i) + position.getX(i + 1) + position.getX(i + 2)) / 3;
    const z = (position.getZ(i) + position.getZ(i + 1) + position.getZ(i + 2)) / 3;
    const townDistance = Math.hypot(x - TOWN.x, (z - TOWN.z) * 0.93);
    const nearTown = smoothstep(42, 20, townDistance);
    const noise = Math.sin(x * 0.37 + z * 0.21) * 0.5 + 0.5;
    if (nearTown > 0.35 && worldRandom() < nearTown * 0.74) {
      chosen.copy(dirtPalette[Math.floor(worldRandom() * dirtPalette.length)]);
    } else {
      const index = Math.floor((noise * 0.65 + worldRandom() * 0.35) * grassPalette.length) % grassPalette.length;
      chosen.copy(grassPalette[index]);
    }
    chosen.multiplyScalar(0.9 + worldRandom() * 0.18);
    for (let vertex = 0; vertex < 3; vertex += 1) {
      colors[(i + vertex) * 3] = chosen.r;
      colors[(i + vertex) * 3 + 1] = chosen.g;
      colors[(i + vertex) * 3 + 2] = chosen.b;
    }
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainMesh = new THREE.Mesh(geometry, material.terrain);
  terrainMesh.receiveShadow = QUALITY === 'high';
  scene.add(terrainMesh);
}

export function buildRoads() {
  const main = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 84), material.road);
  main.rotation.x = -Math.PI / 2;
  main.position.set(0, 0.035, -9);
  main.receiveShadow = QUALITY === 'high';
  scene.add(main);

  const cross = new THREE.Mesh(new THREE.PlaneGeometry(80, 5.6), material.road);
  cross.rotation.x = -Math.PI / 2;
  cross.position.set(0, 0.036, -8);
  cross.receiveShadow = QUALITY === 'high';
  scene.add(cross);

  for (const x of [-3.7, 3.7]) {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 84), material.roadEdge);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(x, 0.04, -9);
    scene.add(edge);
  }
  for (const z of [-11.2, -4.8]) {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(80, 0.18), material.roadEdge);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(0, 0.04, z);
    scene.add(edge);
  }
}

export function buildPond() {
  const geometry = new THREE.CircleGeometry(POND.radius * 0.87, 20);
  geometry.scale(1, 1, 0.82);
  const water = new THREE.Mesh(geometry, material.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set(POND.x, WATER_LEVEL, POND.z);
  scene.add(water);

  const shore = new THREE.Mesh(
    new THREE.RingGeometry(POND.radius * 0.82, POND.radius * 1.02, 24),
    new THREE.MeshLambertMaterial({ color: 0x5d5943, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
  );
  shore.rotation.x = -Math.PI / 2;
  shore.position.set(POND.x, WATER_LEVEL + 0.03, POND.z);
  shore.scale.z = 0.82;
  scene.add(shore);

  for (let i = 0; i < 14; i += 1) {
    const angle = (i / 14) * Math.PI * 2 + worldRandom() * 0.2;
    const radius = POND.radius * (0.9 + worldRandom() * 0.16);
    const x = POND.x + Math.cos(angle) * radius;
    const z = POND.z + Math.sin(angle) * radius * 0.82;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.45 + worldRandom() * 0.65, 0),
      material.rock,
    );
    rock.position.set(x, terrainHeight(x, z) + 0.14, z);
    rock.scale.y = 0.55 + worldRandom() * 0.5;
    rock.rotation.set(worldRandom(), worldRandom() * Math.PI * 2, worldRandom());
    rock.castShadow = QUALITY === 'high';
    scene.add(rock);
  }
}
