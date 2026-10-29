import * as THREE from 'three';
import { QUALITY, TAU, clamp, dampAngle, worldRandom } from './config.js';
import { scene, camera } from './engine.js';
import { material } from './materials.js';
import { resolvePosition, terrainHeight, isPondWater } from './world.js';
import { audio } from './audio.js';
import { spawnBlood } from './fx.js';

export const zombies = [];

const skinMaterials = [
  new THREE.MeshLambertMaterial({ color: 0x7d8b69, flatShading: true }),
  new THREE.MeshLambertMaterial({ color: 0x879176, flatShading: true }),
  new THREE.MeshLambertMaterial({ color: 0x6e7c60, flatShading: true }),
];
const shirtMaterials = [
  new THREE.MeshLambertMaterial({ color: 0x514b3c, flatShading: true }),
  new THREE.MeshLambertMaterial({ color: 0x4a5047, flatShading: true }),
  new THREE.MeshLambertMaterial({ color: 0x5a4639, flatShading: true }),
];
const pantsMaterial = new THREE.MeshLambertMaterial({ color: 0x363b35, flatShading: true });
const goreMaterial = new THREE.MeshLambertMaterial({ color: 0x5f2823, flatShading: true });

function makeBarTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 4;
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, 4, 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
const barTexture = makeBarTexture();

function makeShadow() {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.52, 12), material.shadow.clone());
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.025;
  return mesh;
}

function createZombieModel() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skin = skinMaterials[Math.floor(worldRandom() * skinMaterials.length)];
  const shirt = shirtMaterials[Math.floor(worldRandom() * shirtMaterials.length)];
  const scale = 0.92 + worldRandom() * 0.16;
  body.scale.setScalar(scale);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.7, 0.32), shirt);
  torso.position.y = 1.2;
  torso.rotation.x = 0.1;
  torso.castShadow = QUALITY === 'high';
  body.add(torso);

  const exposed = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.325), skin);
  exposed.position.set(0.14, 1.3, 0.005);
  exposed.rotation.z = -0.12;
  body.add(exposed);

  const wound = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.15, 0.02), goreMaterial);
  wound.position.set(0.08, 1.22, 0.17);
  body.add(wound);

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.27, 0.3), pantsMaterial);
  pelvis.position.y = 0.8;
  body.add(pelvis);

  const head = new THREE.Group();
  head.position.set(0, 1.68, 0.08);
  head.rotation.x = 0.18;
  head.rotation.z = (worldRandom() - 0.5) * 0.25;
  body.add(head);

  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), skin);
  skull.scale.set(0.9, 1.05, 0.9);
  skull.castShadow = QUALITY === 'high';
  head.add(skull);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.18), goreMaterial);
  jaw.position.set(0, -0.15, 0.11);
  head.add(jaw);

  const eye = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.025, 0.02),
    new THREE.MeshBasicMaterial({ color: 0xc2a85d }),
  );
  eye.position.set(-0.07, 0.02, 0.22);
  head.add(eye);

  const shoulders = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.38, 1.49, 0);
    body.add(shoulder);
    shoulder.rotation.x = -1.18 + worldRandom() * 0.18;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.67, 0.18), shirt);
    arm.position.y = -0.31;
    arm.castShadow = QUALITY === 'high';
    shoulder.add(arm);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.17, 0.17), skin);
    hand.position.y = -0.68;
    shoulder.add(hand);
    shoulders.push(shoulder);
  }

  const hips = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.16, 0.72, 0);
    body.add(hip);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.68, 0.23), pantsMaterial);
    leg.position.y = -0.33;
    leg.castShadow = QUALITY === 'high';
    hip.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.16, 0.31), goreMaterial);
    foot.position.set(0, -0.75, 0.05);
    hip.add(foot);
    hips.push(hip);
  }

  for (let i = 0; i < 3; i += 1) {
    const tear = new THREE.Mesh(
      new THREE.BoxGeometry(0.2 + worldRandom() * 0.2, 0.08, 0.02),
      goreMaterial,
    );
    tear.position.set((worldRandom() - 0.5) * 0.35, 0.92 + worldRandom() * 0.4, 0.17);
    tear.rotation.z = worldRandom() * 0.8;
    body.add(tear);
  }

  root.add(makeShadow());
  return { root, body, head, arms: shoulders, legs: hips, scale };
}

function createHealthBar() {
  const background = new THREE.Sprite(new THREE.SpriteMaterial({
    map: barTexture,
    color: 0x17140f,
    transparent: true,
    opacity: 0.72,
    depthTest: false,
    depthWrite: false,
  }));
  background.scale.set(0.76, 0.085, 1);
  background.renderOrder = 7;
  background.visible = false;
  scene.add(background);

  const fill = new THREE.Sprite(new THREE.SpriteMaterial({
    map: barTexture,
    color: 0xb24233,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
    depthWrite: false,
  }));
  fill.center.set(0, 0.5);
  fill.scale.set(0.7, 0.045, 1);
  fill.renderOrder = 8;
  fill.visible = false;
  scene.add(fill);

  return { background, fill };
}

export function spawnZombie(x, z, alerted = false) {
  const model = createZombieModel();
  const bar = createHealthBar();
  const zombie = {
    ...model,
    bar,
    x,
    z,
    health: 68,
    maxHealth: 68,
    dead: false,
    deadTime: 0,
    alerted,
    attackCooldown: worldRandom() * 0.8,
    wanderTimer: 2 + worldRandom() * 4,
    wanderAngle: worldRandom() * TAU,
    phase: worldRandom() * TAU,
    barTimer: 0,
    growlTimer: 3 + worldRandom() * 8,
    speedBase: 1.95 + worldRandom() * 0.58,
    facing: worldRandom() * TAU,
  };
  zombie.root.name = `zombie-${zombies.length}`;
  zombie.root.position.set(x, terrainHeight(x, z), z);
  zombie.root.rotation.y = zombie.facing;
  scene.add(zombie.root);
  zombies.push(zombie);
  return zombie;
}

export function spawnZombieNear(playerPosition, distanceMin = 28, distanceMax = 46) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const angle = worldRandom() * TAU;
    const distance = distanceMin + worldRandom() * (distanceMax - distanceMin);
    const x = clamp(playerPosition.x + Math.cos(angle) * distance, -128, 128);
    const z = clamp(playerPosition.z + Math.sin(angle) * distance, -128, 128);
    if (Math.hypot(x - 2, z - 27) < 14) continue;
    if (isPondWater(x, z)) continue;
    const position = { x, z };
    resolvePosition(position, 0.5);
    if (Math.hypot(position.x - playerPosition.x, position.z - playerPosition.z) < 18) continue;
    return spawnZombie(position.x, position.z, true);
  }
  return null;
}

export function alertZombies(x, z, radius = 28) {
  for (const zombie of zombies) {
    if (zombie.dead) continue;
    if (Math.hypot(zombie.x - x, zombie.z - z) < radius) zombie.alerted = true;
  }
}

export function damageZombie(zombie, amount, hitPoint) {
  if (zombie.dead) return { killed: false, health: 0 };
  zombie.health = Math.max(0, zombie.health - amount);
  zombie.alerted = true;
  zombie.barTimer = 2.8;
  spawnBlood(hitPoint);
  audio.hit();
  if (zombie.health <= 0) {
    zombie.dead = true;
    zombie.deadTime = 0;
    zombie.bar.background.visible = false;
    zombie.bar.fill.visible = false;
    audio.growl();
    return { killed: true, health: 0 };
  }
  return { killed: false, health: zombie.health };
}

const cameraRight = new THREE.Vector3();
const center = new THREE.Vector3();

function updateBar(zombie) {
  const ratio = clamp(zombie.health / zombie.maxHealth, 0, 1);
  const visible = zombie.barTimer > 0 && !zombie.dead;
  zombie.bar.background.visible = visible;
  zombie.bar.fill.visible = visible;
  if (!visible) return;
  cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
  center.set(zombie.x, zombie.root.position.y + 2.28, zombie.z);
  zombie.bar.background.position.copy(center);
  const offset = -((1 - ratio) * 0.7) / 2;
  zombie.bar.fill.position.copy(center).addScaledVector(cameraRight, offset);
  zombie.bar.fill.scale.x = 0.7 * ratio;
}

export function updateZombies(dt, context) {
  const playerPosition = context.player.root.position;
  const night = context.night;
  const targetSpeedMultiplier = night ? 1.22 : 1;

  for (let i = zombies.length - 1; i >= 0; i -= 1) {
    const zombie = zombies[i];

    if (zombie.dead) {
      zombie.deadTime += dt;
      zombie.root.rotation.x = Math.min(1.42, zombie.root.rotation.x + dt * 3.8);
      if (zombie.deadTime > 4.5) {
        zombie.root.position.y -= dt * 0.5;
      }
      if (zombie.deadTime > 7) {
        scene.remove(zombie.root);
        scene.remove(zombie.bar.background);
        scene.remove(zombie.bar.fill);
        zombies.splice(i, 1);
      }
      continue;
    }

    zombie.barTimer = Math.max(0, zombie.barTimer - dt);
    zombie.growlTimer -= dt;
    zombie.attackCooldown = Math.max(0, zombie.attackCooldown - dt);

    const dx = playerPosition.x - zombie.x;
    const dz = playerPosition.z - zombie.z;
    const distance = Math.hypot(dx, dz);

    if (distance < 21) zombie.alerted = true;
    if (distance > 33) zombie.alerted = false;

    let moveX = 0;
    let moveZ = 0;
    let speed = 0;

    if (zombie.alerted) {
      if (distance > 1.18) {
        const strafe = Math.sin(context.elapsed * 2.1 + zombie.phase) * 0.22;
        moveX = dx / (distance || 1) + strafe * (dz / (distance || 1));
        moveZ = dz / (distance || 1) - strafe * (dx / (distance || 1));
        speed = zombie.speedBase * targetSpeedMultiplier;
      } else if (zombie.attackCooldown <= 0) {
        zombie.attackCooldown = 1.05 + worldRandom() * 0.45;
        context.onAttack(7 + Math.floor(worldRandom() * 7), zombie);
        zombie.growlTimer = 1.4;
      }
      if (zombie.growlTimer <= 0 && distance < 17) {
        zombie.growlTimer = 5 + worldRandom() * 8;
        audio.growl();
      }
    } else {
      zombie.wanderTimer -= dt;
      if (zombie.wanderTimer <= 0) {
        zombie.wanderTimer = 3 + worldRandom() * 6;
        zombie.wanderAngle = worldRandom() * TAU;
      }
      moveX = Math.cos(zombie.wanderAngle);
      moveZ = Math.sin(zombie.wanderAngle);
      speed = 0.42;
    }

    if (speed > 0) {
      const length = Math.hypot(moveX, moveZ) || 1;
      moveX /= length;
      moveZ /= length;
      zombie.x += moveX * speed * dt;
      zombie.z += moveZ * speed * dt;
      resolvePosition(zombie, 0.36);
      zombie.facing = dampAngle(zombie.facing, Math.atan2(moveX, moveZ), 6.5, dt);
      zombie.phase += dt * speed * 3.3;
    }

    zombie.root.position.set(zombie.x, terrainHeight(zombie.x, zombie.z), zombie.z);
    zombie.root.rotation.y = zombie.facing;

    const swing = Math.sin(zombie.phase) * (zombie.alerted ? 0.74 : 0.38);
    zombie.legs[0].rotation.x = swing;
    zombie.legs[1].rotation.x = -swing;
    const armBase = -1.18;
    zombie.arms[0].rotation.x = armBase + Math.sin(zombie.phase + 0.8) * 0.12;
    zombie.arms[1].rotation.x = armBase + Math.sin(zombie.phase + 2.1) * 0.12;
    zombie.body.position.y = Math.abs(Math.sin(zombie.phase)) * 0.035;
    zombie.body.rotation.z = Math.sin(zombie.phase * 0.5) * 0.035;
    zombie.head.rotation.z = Math.sin(zombie.phase * 0.37 + zombie.phase) * 0.1;

    updateBar(zombie);
  }
}

const initialSpawns = [
  [-24, 5], [24, 4], [-7, 22], [21, 20],
  [-31, -11], [29, -18], [-24, -35], [25, -40],
  [3, -55], [-39, 31],
];

export function createInitialZombies() {
  initialSpawns.forEach(([x, z], index) => spawnZombie(x, z, index < 4));
}
