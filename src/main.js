import * as THREE from 'three';
import {
  DAWN_HOUR,
  DAY_SECONDS,
  QUALITY,
  WATER_LEVEL,
  WEAPONS,
  WELL,
  clamp,
  damp,
  dampAngle,
  refreshTouchUi,
  state,
  touchUi,
} from './config.js';
import { ui } from './dom.js';
import {
  animateClouds,
  camera,
  raycaster,
  renderer,
  resizeRenderer,
  scene,
  updateEnvironment,
} from './engine.js';
import {
  buildPond,
  buildRoads,
  buildTerrain,
  isPondWater,
  resolvePosition,
  terrainHeight,
  terrainMesh,
} from './world.js';
import { buildTown, campFires, houseMeshes } from './town.js';
import { buildVegetation } from './vegetation.js';
import { createPlayer } from './player.js';
import {
  collectPickup,
  createLoot,
  findNearestPickup,
  updateLoot,
} from './loot.js';
import {
  alertZombies,
  createInitialZombies,
  damageZombie,
  spawnZombieNear,
  updateZombies,
  zombies,
} from './zombies.js';
import { spawnDust, spawnTracer, updateEffects } from './fx.js';
import { audio } from './audio.js';
import {
  buildMagPips,
  flashDamage,
  flashHeal,
  hideAimHint,
  initHud,
  refreshAmmo,
  refreshInventory,
  setInteract,
  setReloadRing,
  showAimHint,
  showEndScreen,
  showHitmarker,
  showLocation,
  showToast,
  updateCompass,
  updateHud,
  updateSoundButton,
} from './hud.js';
import {
  getMovement,
  isMoving,
  releaseInput,
  setupInput,
  sprintHeld,
} from './input.js';

/* --------------------------------------------------------------------------
   Build the world
-------------------------------------------------------------------------- */

buildTerrain();
buildRoads();
buildPond();
buildTown();
buildVegetation();
createLoot();
const player = createPlayer();
createInitialZombies();
initHud();
updateSoundButton();

const clockNow = () => performance.now();
const aimDir = new THREE.Vector3();
const shotOrigin = new THREE.Vector3();
const shotEnd = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const camDesired = new THREE.Vector3();
const camLook = new THREE.Vector3();
const camForward = new THREE.Vector3();
const camRight = new THREE.Vector3();
const camDirection = new THREE.Vector3();
const muzzleWorld = new THREE.Vector3();
const raycasterTargets = [];

let elapsed = 0;
let lastFrame = performance.now();
let uiAccumulator = 0;
let lastNearCheck = -100;
let walkPhase = 0;
let muzzleTimer = 0;
let aimHintTimeout = 0;
let dust;

function createDust() {
  const count = QUALITY === 'low' ? 110 : 240;
  const positions = [];
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 4 + Math.random() * 24;
    positions.push(
      Math.cos(angle) * radius,
      0.2 + Math.random() * 7,
      Math.sin(angle) * radius,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({
    color: 0xd6c7a2,
    size: 0.055,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    sizeAttenuation: true,
  }));
  points.frustumCulled = false;
  scene.add(points);
  dust = points;
}
createDust();

/* --------------------------------------------------------------------------
   Camera
-------------------------------------------------------------------------- */

function updateCamera(dt) {
  if (!state.started) {
    const angle = elapsed * 0.034 + 0.3;
    camera.position.set(
      Math.sin(angle) * 33,
      11.6 + Math.sin(angle * 0.72) * 1.5,
      Math.cos(angle) * 33 - 8,
    );
    camera.lookAt(0, 2.5, -9);
    if (Math.abs(camera.fov - 62) > 0.01) {
      camera.fov = damp(camera.fov, 62, 4, dt);
      camera.updateProjectionMatrix();
    }
    return;
  }

  camTarget.set(player.root.position.x, player.root.position.y + 1.36, player.root.position.z);
  camForward.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
  camRight.set(Math.cos(state.yaw), 0, -Math.sin(state.yaw));

  const distance = touchUi ? 5.55 : 5.85;
  const shoulder = touchUi ? 0.62 : 0.76;
  camDesired.copy(camTarget)
    .addScaledVector(camForward, -distance)
    .addScaledVector(camRight, shoulder);
  camDesired.y += 1.55 + Math.sin(state.pitch) * 1.4;

  const groundAtCamera = terrainHeight(camDesired.x, camDesired.z) + 0.6;
  if (camDesired.y < groundAtCamera) camDesired.y = groundAtCamera;

  camDirection.copy(camDesired).sub(camTarget);
  const cameraDistance = camDirection.length();
  camDirection.normalize();
  raycaster.set(camTarget, camDirection);
  raycaster.far = cameraDistance;
  const hits = raycaster.intersectObjects(houseMeshes, true);
  if (hits.length > 0) {
    const safeDistance = Math.max(1.4, hits[0].distance - 0.28);
    camDesired.copy(camTarget).addScaledVector(camDirection, safeDistance);
  }

  const rate = state.elapsed < 1.25 ? 5.2 : 11.5;
  camera.position.lerp(camDesired, 1 - Math.exp(-rate * dt));

  const shake = state.shake;
  if (shake > 0.0005) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake * 0.7;
    camera.position.z += (Math.random() - 0.5) * shake;
    state.shake *= Math.exp(-7.5 * dt);
  }

  camLook.copy(camTarget)
    .addScaledVector(camForward, 8.5)
    .addScaledVector(camRight, shoulder);
  camLook.y += Math.sin(state.pitch) * 8.5;
  camera.lookAt(camLook);

  const sprinting = sprintHeld() && isMoving() && state.stamina > 1;
  const targetFov = sprinting ? 67 : 62;
  if (Math.abs(camera.fov - targetFov) > 0.02) {
    camera.fov = damp(camera.fov, targetFov, 7, dt);
    camera.updateProjectionMatrix();
  }
}

/* --------------------------------------------------------------------------
   Player movement and animation
-------------------------------------------------------------------------- */

function updatePlayer(dt) {
  const movement = getMovement();
  const sprinting = sprintHeld() && movement.moving && state.stamina > 0.5;
  let speed = movement.moving ? (sprinting ? 5.72 : 3.15) : 0;
  const inWater = isPondWater(player.root.position.x, player.root.position.z);
  if (inWater) speed *= 0.54;

  if (movement.moving) {
    camForward.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
    camRight.set(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
    let moveX = camForward.x * movement.forward + camRight.x * movement.strafe;
    let moveZ = camForward.z * movement.forward + camRight.z * movement.strafe;
    const length = Math.hypot(moveX, moveZ) || 1;
    moveX /= length;
    moveZ /= length;

    player.root.position.x += moveX * speed * dt;
    player.root.position.z += moveZ * speed * dt;
    resolvePosition(player.root.position, 0.36);

    const facing = Math.atan2(moveX, moveZ);
    player.root.rotation.y = dampAngle(player.root.rotation.y, facing, 12, dt);
    walkPhase += dt * speed * 2.7;
    state.stepAccumulator += dt * (sprinting ? 2.2 : 1.15);
    if (state.stepAccumulator > 0.78) {
      state.stepAccumulator = 0;
      audio.footstep(sprinting);
    }
  } else if (state.fireHeld) {
    aimDir.set(
      -Math.sin(state.yaw) * Math.cos(state.pitch),
      Math.sin(state.pitch),
      -Math.cos(state.yaw) * Math.cos(state.pitch),
    );
    player.root.rotation.y = dampAngle(
      player.root.rotation.y,
      Math.atan2(aimDir.x, aimDir.z),
      9,
      dt,
    );
    state.stepAccumulator = 0;
  } else {
    state.stepAccumulator = 0;
  }

  const ground = inWater
    ? Math.max(terrainHeight(player.root.position.x, player.root.position.z), WATER_LEVEL - 1.18)
    : terrainHeight(player.root.position.x, player.root.position.z);
  player.root.position.y = damp(player.root.position.y, ground, 18, dt);

  if (sprinting) {
    state.stamina = Math.max(0, state.stamina - dt * 24);
  } else {
    state.stamina = Math.min(100, state.stamina + dt * (movement.moving ? 9 : 16));
  }
  ui.sprintBtn.classList.toggle('active', sprinting);

  const intensity = movement.moving ? (sprinting ? 0.95 : 0.68) : 0;
  const swing = Math.sin(walkPhase) * intensity;
  const idle = Math.sin(elapsed * 1.8) * (movement.moving ? 0 : 0.035);
  player.legL.rotation.x = swing + idle;
  player.legR.rotation.x = -swing - idle;
  player.armL.rotation.x = -swing * 0.7 + idle;
  player.armR.rotation.x = swing * 0.4 + (state.fireHeld ? -0.55 : 0);
  player.body.position.y = movement.moving ? Math.abs(Math.sin(walkPhase)) * 0.045 : Math.sin(elapsed * 1.6) * 0.012;
  player.body.rotation.z = movement.moving ? Math.sin(walkPhase) * 0.018 : 0;
  player.head.rotation.y = movement.moving ? Math.sin(walkPhase * 0.38) * 0.07 : Math.sin(elapsed * 0.6) * 0.06;
  player.head.rotation.x = Math.sin(elapsed * 1.15) * 0.012;
}

/* --------------------------------------------------------------------------
   Aiming, shooting, reloading
-------------------------------------------------------------------------- */

function computeAimDirection() {
  aimDir.set(
    -Math.sin(state.yaw) * Math.cos(state.pitch),
    Math.sin(state.pitch),
    -Math.cos(state.yaw) * Math.cos(state.pitch),
  ).normalize();
  return aimDir;
}

function findAimTarget(origin, direction) {
  const cone = Math.cos((touchUi ? 13.5 : 7.5) * Math.PI / 180);
  let best = null;
  let bestDot = cone;
  for (const zombie of zombies) {
    if (zombie.dead) continue;
    const targetX = zombie.x - origin.x;
    const targetY = zombie.root.position.y + 1.12 - origin.y;
    const targetZ = zombie.z - origin.z;
    const distance = Math.hypot(targetX, targetY, targetZ);
    if (distance > state.weapon.range || distance < 0.8) continue;
    const dot = (targetX * direction.x + targetY * direction.y + targetZ * direction.z) / distance;
    if (dot > bestDot) {
      bestDot = dot;
      best = zombie;
    }
  }
  return best;
}

function tryFire() {
  const now = clockNow();
  if (!state.started || state.paused || state.ended || state.reloading) return;
  if (now - state.lastShot < state.weapon.fireDelay * 1000) return;
  if (state.mag <= 0) {
    audio.empty();
    startReload();
    return;
  }

  state.lastShot = now;
  state.mag -= 1;
  refreshAmmo();
  audio.shoot(state.weapon.id);
  state.shake = Math.min(0.42, state.shake + (state.weapon.id === 'rifle' ? 0.27 : 0.13));
  state.pitch = clamp(state.pitch + (state.weapon.id === 'rifle' ? 0.024 : 0.009), -0.27, 0.54);
  muzzleTimer = 0.055;
  player.muzzleFlash.visible = true;
  player.muzzleFlash.rotation.z = Math.random() * Math.PI;
  document.body.classList.add('firing');
  window.setTimeout(() => document.body.classList.remove('firing'), 90);

  computeAimDirection();
  player.root.rotation.y = Math.atan2(aimDir.x, aimDir.z);
  shotOrigin.set(
    player.root.position.x,
    player.root.position.y + 1.34,
    player.root.position.z,
  ).addScaledVector(aimDir, 0.42);

  const target = findAimTarget(shotOrigin, aimDir);
  if (target) {
    shotEnd.set(target.x, target.root.position.y + 1.12, target.z);
    const result = damageZombie(target, state.weapon.damage, shotEnd);
    if (result.killed) {
      state.kills += 1;
      showToast('INFECTED DOWN', 'good');
    }
    showHitmarker(result.killed);
  } else {
    raycaster.set(shotOrigin, aimDir);
    raycaster.far = state.weapon.range + 35;
    raycasterTargets.length = 0;
    if (terrainMesh) raycasterTargets.push(terrainMesh);
    for (const mesh of houseMeshes) raycasterTargets.push(mesh);
    const hits = raycaster.intersectObjects(raycasterTargets, true);
    if (hits.length > 0) {
      shotEnd.copy(hits[0].point);
      spawnDust(shotEnd);
    } else {
      shotEnd.copy(shotOrigin).addScaledVector(aimDir, state.weapon.range + 30);
    }
  }

  muzzleWorld.set(0.35, 1.22, state.weapon.id === 'rifle' ? 1.46 : 0.77);
  player.root.localToWorld(muzzleWorld);
  spawnTracer(muzzleWorld, shotEnd);
  alertZombies(player.root.position.x, player.root.position.z, 35);

  if (state.mag === 0) {
    window.setTimeout(() => {
      if (state.started && !state.ended && !state.reloading) startReload();
    }, 260);
  }
}

function startReload() {
  if (!state.started || state.ended) return;
  if (state.reloading) return;
  if (state.mag >= state.weapon.magSize) return;
  if (state.reserve <= 0) {
    showToast('NO RESERVE AMMO', 'danger');
    audio.empty();
    return;
  }
  state.reloading = true;
  state.reloadProgress = 0;
  audio.reload();
  setReloadRing(true, 0);
}

function updateReload(dt) {
  if (!state.reloading) return;
  state.reloadProgress += dt / state.weapon.reloadTime;
  setReloadRing(true, state.reloadProgress);
  if (state.reloadProgress >= 1) {
    const needed = state.weapon.magSize - state.mag;
    const loaded = Math.min(needed, state.reserve);
    state.mag += loaded;
    state.reserve -= loaded;
    state.reloading = false;
    setReloadRing(false);
    refreshAmmo();
  }
}

function setWeaponVisuals() {
  const rifle = state.weapon.id === 'rifle';
  player.weaponPistol.visible = !rifle;
  player.weaponRifle.visible = rifle;
  player.slungRifle.visible = !rifle;
  player.muzzleFlash.position.set(0.35, 1.22, rifle ? 1.46 : 0.77);
}

/* --------------------------------------------------------------------------
   Scavenging, survival and interactions
-------------------------------------------------------------------------- */

function useItem(kind) {
  if (!state.started || state.paused || state.ended || state.useCooldown > 0) return;
  if (kind === 'food') {
    if (state.inventory.food <= 0) {
      showToast('NO FOOD LEFT', 'danger');
      return;
    }
    if (state.hunger > 97) {
      showToast('NOT HUNGRY', 'danger');
      return;
    }
    state.inventory.food -= 1;
    state.hunger = Math.min(100, state.hunger + 34);
    state.health = Math.min(100, state.health + 2);
    showToast('CANNED FOOD +34', 'good');
    audio.pickup();
  } else if (kind === 'water') {
    if (state.inventory.water <= 0) {
      showToast('NO WATER LEFT', 'danger');
      return;
    }
    if (state.thirst > 97) {
      showToast('NOT THIRSTY', 'danger');
      return;
    }
    state.inventory.water -= 1;
    state.thirst = Math.min(100, state.thirst + 38);
    showToast('WATER +38', 'good');
    audio.pickup();
  } else if (kind === 'med') {
    if (state.inventory.med <= 0) {
      showToast('NO BANDAGES LEFT', 'danger');
      return;
    }
    if (state.health > 98) {
      showToast('ALREADY HEALTHY', 'danger');
      return;
    }
    state.inventory.med -= 1;
    state.health = Math.min(100, state.health + 44);
    flashHeal();
    showToast('BANDAGED +44 HEALTH', 'good');
    audio.heal();
  }
  state.useCooldown = 0.7;
  refreshInventory();
  updateHud();
}

function applyLoot(pickup) {
  const type = pickup.type;
  if (type === 'food') {
    state.inventory.food += 1;
    showToast('CANNED FOOD +1', 'good');
  } else if (type === 'water') {
    state.inventory.water += 1;
    showToast('WATER BOTTLE +1', 'good');
  } else if (type === 'med') {
    state.inventory.med += 1;
    showToast('BANDAGE +1', 'good');
  } else if (type === 'ammo') {
    state.reserve += 14;
    showToast('AMMO +14', 'good');
  } else if (type === 'rifleAmmo') {
    state.reserve += 10;
    showToast('RIFLE AMMO +10', 'good');
  } else if (type === 'rifle') {
    if (state.weapon.id === 'rifle') {
      state.reserve += 12;
      showToast('MOSIN AMMO +12', 'good');
    } else {
      state.weapon = WEAPONS.rifle;
      state.mag = WEAPONS.rifle.magSize;
      state.reserve += 10;
      buildMagPips();
      setWeaponVisuals();
      showToast('MOSIN RIFLE ACQUIRED', 'good');
    }
  }
  state.looted += 1;
  state.reloading = false;
  setReloadRing(false);
  refreshAmmo();
  refreshInventory();
  updateHud();
  audio.pickup();
}

function updateNear(force = false) {
  const now = clockNow();
  if (!force && now - lastNearCheck < 110) return;
  lastNearCheck = now;
  const position = player.root.position;
  const pickup = findNearestPickup(position, 2.8);
  let nearest = pickup ? {
    type: 'pickup',
    pickup,
    distance: Math.hypot(position.x - pickup.x, position.z - pickup.z),
  } : null;

  const wellDistance = Math.hypot(position.x - WELL.x, position.z - WELL.z);
  if (wellDistance < 3.35 && (!nearest || wellDistance < nearest.distance)) {
    nearest = { type: 'well', distance: wellDistance };
  }
  state.near = nearest;
  setInteract(nearest);
}

function interact() {
  if (!state.started || state.paused || state.ended) return;
  updateNear(true);
  if (!state.near) return;
  if (state.near.type === 'pickup') {
    const pickup = state.near.pickup;
    collectPickup(pickup);
    applyLoot(pickup);
    state.near = null;
    setInteract(null);
    return;
  }
  if (state.near.type === 'well') {
    if (state.thirst > 97) {
      showToast('NOT THIRSTY', 'danger');
      return;
    }
    state.thirst = Math.min(100, state.thirst + 30);
    showToast('WELL WATER +30', 'good');
    audio.pickup();
    updateHud();
  }
}

function hurtPlayer(amount) {
  if (state.ended || state.hurtCooldown > 0) return;
  state.hurtCooldown = 0.42;
  state.health = Math.max(0, state.health - amount);
  state.shake = Math.min(0.5, state.shake + 0.3);
  flashDamage();
  audio.hurt();
  if (state.health <= 0) endGame(false);
}

function updateSurvival(dt) {
  state.hurtCooldown = Math.max(0, state.hurtCooldown - dt);
  state.useCooldown = Math.max(0, state.useCooldown - dt);
  state.hunger = Math.max(0, state.hunger - dt * 0.33);
  state.thirst = Math.max(0, state.thirst - dt * 0.41);

  const starving = state.hunger <= 0;
  const dehydrated = state.thirst <= 0;
  if (starving || dehydrated) {
    const damage = (starving ? 0.5 : 0) + (dehydrated ? 0.55 : 0) + (starving && dehydrated ? 0.35 : 0);
    state.health = Math.max(0, state.health - dt * damage);
    if (state.health <= 0) endGame(false);
  } else if (state.health < 100 && state.hunger > 48 && state.thirst > 42) {
    state.health = Math.min(100, state.health + dt * 0.22);
  }

  if (state.health < 30) {
    state.heartTimer -= dt;
    if (state.heartTimer <= 0) {
      state.heartTimer = 1.25;
      audio.heartbeat();
    }
  } else {
    state.heartTimer = 0;
  }

  state.zombieSpawnTimer -= dt;
  if (state.zombieSpawnTimer <= 0) {
    const hour = ((state.gameHour % 24) + 24) % 24;
    const night = hour >= 20 || hour < 6;
    const limit = state.zombieLimit + (night ? 3 : 0);
    const alive = zombies.reduce((count, zombie) => count + (zombie.dead ? 0 : 1), 0);
    if (alive < limit) spawnZombieNear(player.root.position, 29, 47);
    state.zombieSpawnTimer = night ? 10 + Math.random() * 7 : 16 + Math.random() * 10;
  }
}

/* --------------------------------------------------------------------------
   Game state transitions
-------------------------------------------------------------------------- */

function startGame() {
  if (state.started) return;
  state.started = true;
  state.elapsed = 0;
  state.gameHour = 17.5;
  audio.init();
  document.body.classList.add('playing');
  ui.hud.inert = false;
  ui.hud.setAttribute('aria-hidden', 'false');
  ui.start.classList.add('is-leaving');
  window.setTimeout(() => ui.start.classList.add('hidden'), 900);
  window.setTimeout(() => {
    if (!state.ended) {
      showLocation();
      showToast('SCAVENGE · SURVIVE UNTIL DAWN', 'good');
    }
  }, 500);
  aimHintTimeout = window.setTimeout(() => {
    if (state.started && !state.paused && !state.ended && document.pointerLockElement !== ui.canvas) {
      showAimHint();
    }
  }, 2600);
  updateNear(true);
  refreshAmmo();
  refreshInventory();
  updateHud();
}

function togglePause() {
  if (!state.started || state.ended) return;
  if (state.paused) {
    resumeGame();
    return;
  }
  state.paused = true;
  releaseInput();
  hideAimHint();
  setInteract(null);
  ui.pause.classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}

function resumeGame() {
  if (!state.started || state.ended || !state.paused) return;
  state.paused = false;
  ui.pause.classList.add('hidden');
  lastFrame = performance.now();
  updateNear(true);
}

function toggleSound() {
  audio.init();
  const muted = audio.toggle();
  state.soundOn = !muted;
  updateSoundButton();
  showToast(muted ? 'SOUND OFF' : 'SOUND ON');
}

function endGame(won) {
  if (state.ended) return;
  state.ended = true;
  state.won = won;
  state.fireHeld = false;
  releaseInput();
  setReloadRing(false);
  setInteract(null);
  hideAimHint();
  clearTimeout(aimHintTimeout);
  document.body.classList.add('ended');
  if (won) audio.win();
  else audio.lose();
  if (document.pointerLockElement) document.exitPointerLock();
  window.setTimeout(() => showEndScreen(won), won ? 550 : 900);
}

/* --------------------------------------------------------------------------
   Input bindings
-------------------------------------------------------------------------- */

setupInput({
  onStart: startGame,
  onPause: togglePause,
  onResume: resumeGame,
  onSound: toggleSound,
  onReload: startReload,
  onInteract: interact,
  onUse: useItem,
  onFire: tryFire,
  onHidden: () => {
    if (state.started && !state.paused && !state.ended) togglePause();
  },
});

window.addEventListener('resize', () => {
  refreshTouchUi();
  resizeRenderer();
  if (touchUi) ui.interactKey.textContent = 'USE';
});

/* --------------------------------------------------------------------------
   Frame loop
-------------------------------------------------------------------------- */

function animateCampfires() {
  for (const fire of campFires) {
    const flicker = 0.82
      + Math.sin(elapsed * 9.2 + fire.phase) * 0.1
      + Math.sin(elapsed * 21.7 + fire.phase * 2) * 0.05;
    fire.flame.scale.set(0.88 + flicker * 0.18, flicker, 0.88 + flicker * 0.18);
    fire.flame.rotation.y = elapsed * 0.7 + fire.phase;
    fire.core.scale.setScalar(0.82 + flicker * 0.16);
    fire.light.intensity = (QUALITY === 'low' ? 1.05 : 1.65) * flicker;
  }
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  elapsed += dt;

  updateEnvironment(state.gameHour, elapsed);
  animateClouds(elapsed);
  animateCampfires();
  updateLoot(elapsed, dt);

  if (state.started && !state.paused && !state.ended) {
    state.elapsed += dt;
    state.gameHour += dt * (24 / DAY_SECONDS);
    updatePlayer(dt);
    const hour = ((state.gameHour % 24) + 24) % 24;
    updateZombies(dt, {
      player,
      night: hour >= 20 || hour < 6,
      elapsed: state.elapsed,
      onAttack: (damage) => hurtPlayer(damage),
    });
    updateSurvival(dt);
    updateReload(dt);
    updateNear();
    if (state.fireHeld) tryFire();
    if (!state.ended && state.gameHour >= DAWN_HOUR) endGame(true);
  }

  if (muzzleTimer > 0) {
    muzzleTimer -= dt;
    if (muzzleTimer <= 0) player.muzzleFlash.visible = false;
  }

  if (dust) {
    dust.position.x = damp(dust.position.x, player.root.position.x, 1.8, dt);
    dust.position.z = damp(dust.position.z, player.root.position.z, 1.8, dt);
    dust.position.y = player.root.position.y + 2.6;
    dust.rotation.y += dt * 0.014;
  }

  updateEffects(dt);
  updateCamera(dt);
  updateCompass(state.yaw);

  uiAccumulator -= dt;
  if (uiAccumulator <= 0) {
    uiAccumulator = 0.075;
    updateHud();
  }

  renderer.render(scene, camera);
}

updateEnvironment(state.gameHour, 0);
updateHud();
updateCompass(state.yaw);
requestAnimationFrame(loop);
