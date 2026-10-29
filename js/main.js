import * as THREE from 'three';
import { World, CITY } from './world.js';
import { Player, PedSystem, Car, TrafficCar, CopCar } from './entities.js';
import { Input } from './input.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import {
  clamp, damp, dampAngle, shortestAngle, makeGlowSprite, textTexture, glowTexture, mulberry32
} from './utils.js';

const $ = (id) => document.getElementById(id);

const MISSIONS = [
  { title: 'FIRST RIDE', desc: 'Steal a ride and reach the marina', x: 180, z: 210, reward: 1200 },
  { title: 'NIGHT RUN', desc: 'Blast downtown and hit the marker', x: -60, z: -180, reward: 2000 },
  { title: 'HEAT', desc: 'Grab the docks drop — then lose the cops', x: -180, z: 180, reward: 3000, wanted: 2 },
  { title: 'SUNSET STRIP', desc: 'Finish the run at the north pier', x: 180, z: -180, reward: 5000 }
];

class Game {
  constructor() {
    this.canvas = $('game');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 900 ? 1.5 : 1.8));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(63, window.innerWidth / window.innerHeight, 0.12, 1700);
    this.clock = new THREE.Clock();

    this.world = new World(this.scene, this.renderer);
    this.player = new Player(this.scene);
    this.peds = new PedSystem(this.scene, this.world, window.innerWidth < 700 ? 24 : 32);
    this.hud = new HUD();
    this.audio = new AudioEngine();
    this.input = new Input(this.canvas, {
      stickZone: $('stickZone'),
      stickBase: $('stickBase'),
      stickKnob: $('stickKnob'),
      btnAction: $('btnAction'),
      btnFire: $('btnFire'),
      btnSprint: $('btnSprint'),
      btnBrake: $('btnBrake')
    }, { onPause: () => this.togglePause() });

    this.state = 'menu';
    this.isTouch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || window.innerWidth <= 900;
    this.elapsed = 0;
    this.menuTime = 0;
    this.cameraYaw = 0;
    this.cameraPitch = 0.23;
    this.cameraDist = 6.6;
    this.lastLook = 0;
    this.shake = 0;
    this.prevVehicleSpeed = 0;
    this.crashTimer = 0;
    this.time = 0;

    this.cash = 450;
    this.heat = 0;
    this.lastCrime = -100;
    this.escapeTimer = 0;
    this.copSpawnTimer = 0;
    this.lastDamage = -100;
    this.deadTimer = 0;
    this.damageFlash = 0;
    this.missionIndex = 0;
    this.missionDone = false;
    this.missionCooldown = 0;
    this.areaTimer = 0;
    this.hintTimer = 0;
    this.vehicleHintShown = false;

    this.cars = [];
    this.traffic = [];
    this.cops = [];
    this.playerCar = null;
    this.pickups = [];
    this.flashes = [];
    this.particles = [];
    this.tracers = [];
    this.raycaster = new THREE.Raycaster();
    this.tmpVec = new THREE.Vector3();
    this.tmpVec2 = new THREE.Vector3();
    this.tmpVec3 = new THREE.Vector3();

    this.spawnParkedCars();
    this.spawnTraffic(10);
    this.createMarker();
    this.createPickups();

    this.bindUI();
    this.resize();
    this.hud.setCash(this.cash);
    this.hud.setHealth(this.player.health, this.player.maxHealth);
    this.hud.setMission(0, MISSIONS.length, MISSIONS[0].title, MISSIONS[0].desc);
    this.updateMarker();

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 220));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.togglePause(true);
    });
    this.canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());

    this.camera.position.set(170, 66, 250);
    this.camera.lookAt(20, 20, 30);
    this.scene.fog.density = 0.00145;

    this.loop = this.loop.bind(this);
    this.lastFrame = performance.now();
    requestAnimationFrame(this.loop);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 900 ? 1.5 : 1.8));
    this.renderer.setSize(w, h);
  }

  spawnParkedCars() {
    this.world.carSpots.forEach((spot, i) => {
      const car = new Car(this.scene, {
        color: spot.color,
        sports: spot.sports,
        hero: spot.hero,
        maxSpeed: spot.sports ? 39 : 32
      });
      car.place(spot.x, spot.z, spot.heading);
      car.pos.y = this.world.groundHeight(spot.x, spot.z) + 0.04;
      car.spot = spot;
      this.cars.push(car);
    });
  }

  spawnTraffic(count) {
    const colors = [0xb7c0c9, 0x2d425c, 0xc45a3f, 0x8b8b96, 0xd5b257, 0x3c8a7a, 0x6d5fb8, 0xcf7ea4, 0x606a7d];
    const rng = mulberry32(9001);
    const seeds = [
      { x: 3, z: 36, heading: 0 },
      { x: -60, z: 105, heading: Math.PI / 2 },
      { x: 60, z: 148, heading: -Math.PI / 2 },
      { x: -3, z: 150, heading: Math.PI }
    ];
    for (let i = 0; i < count; i++) {
      let x, z, heading;
      if (seeds[i]) {
        ({ x, z, heading } = seeds[i]);
      } else {
        for (let t = 0; t < 20; t++) {
          const onX = rng() < 0.5;
          const c = (Math.floor(rng() * 7) - 3) * 60;
          const along = (rng() * 2 - 1) * 220;
          if (onX) { x = c; z = along; heading = rng() < 0.5 ? 0 : Math.PI; }
          else { x = along; z = c; heading = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2; }
          if (Math.hypot(x - this.player.pos.x, z - this.player.pos.z) > 45) break;
        }
      }
      const car = new TrafficCar(this.scene, this.world, {
        x, z, heading, color: colors[i % colors.length],
        aiSpeed: 7.5 + rng() * 4
      });
      this.traffic.push(car);
    }
  }

  createMarker() {
    const group = new THREE.Group();
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x34e5ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, depthWrite: false, toneMapped: false
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(4.7, 5.2, 28, 26, 1, true), beamMat);
    beam.position.y = 14;
    group.add(beam);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd166, toneMapped: false, transparent: true, opacity: 0.9 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.16, 6, 40), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.22;
    group.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.07, 6, 32), new THREE.MeshBasicMaterial({ color: 0x34e5ff, toneMapped: false, transparent: true, opacity: 0.65 }));
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = 0.32;
    group.add(ring2);
    const glow = makeGlowSprite(0x34e5ff, 18, 0.26);
    glow.position.y = 1.2;
    group.add(glow);
    const core = makeGlowSprite(0xffd166, 5.5, 0.65);
    core.position.y = 0.7;
    group.add(core);
    this.marker = group;
    this.markerBeam = beam;
    this.markerRing = ring;
    this.markerRing2 = ring2;
    this.markerGlow = glow;
    this.scene.add(group);
  }

  createPickups() {
    const rng = mulberry32(555);
    const tex = textTexture('$', { size: 110, color: '#b6ffdc', glowColor: '#28ff9d', pad: 10, glowBlur: 22 });
    for (let i = 0; i < 14; i++) {
      const bx = (Math.floor(rng() * 8) - 3.5) * 60;
      const bz = (Math.floor(rng() * 8) - 3.5) * 60;
      const edge = Math.floor(rng() * 4);
      let x, z;
      if (edge === 0) { x = bx - 18 + rng() * 36; z = bz + 22.4; }
      else if (edge === 1) { x = bx + 22.4; z = bz - 18 + rng() * 36; }
      else if (edge === 2) { x = bx - 18 + rng() * 36; z = bz - 22.4; }
      else { x = bx - 22.4; z = bz - 18 + rng() * 36; }
      if (Math.hypot(x - 8.0, z - 92) < 24) { x += 22; z += 22; }
      const group = new THREE.Group();
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, toneMapped: false, color: 0xffffff
      }));
      sprite.scale.set(1.05, 1.45, 1);
      sprite.position.y = 1.35;
      group.add(sprite);
      const glow = makeGlowSprite(0x2effa0, 3.5, 0.35);
      glow.position.y = 1.2;
      group.add(glow);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.1, 0.045, 5, 22),
        new THREE.MeshBasicMaterial({ color: 0x7dffc4, transparent: true, opacity: 0.7, toneMapped: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.1;
      group.add(ring);
      group.position.set(x, 0.3, z);
      this.scene.add(group);
      this.pickups.push({ x, z, group, sprite, ring, active: true, phase: rng() * 6.28 });
    }
  }

  bindUI() {
    $('startBtn').addEventListener('click', () => this.start());
    $('menuTiltBtn').addEventListener('click', () => this.toggleTilt());
    $('menuSoundBtn').addEventListener('click', () => this.toggleSound());
    $('tiltBtn').addEventListener('click', () => this.toggleTilt());
    $('soundBtn').addEventListener('click', () => this.toggleSound());
    $('pauseBtn').addEventListener('click', () => this.togglePause());
    $('resumeBtn').addEventListener('click', () => this.togglePause());
    $('restartBtn').addEventListener('click', () => window.location.reload());
    this.updateSoundLabels();
    this.updateTiltLabels();
  }

  async toggleTilt() {
    if (this.state === 'menu') this.audio.start();
    const wasOn = this.input.tiltEnabled;
    const ok = await this.input.toggleTilt();
    this.updateTiltLabels();
    if (this.input.tiltEnabled) {
      this.hud.toast('TILT STEERING ON', 'gold');
    } else if (!wasOn && !this.input.tiltEnabled) {
      this.hud.toast(this.input.tiltSupported ? 'MOTION ACCESS DENIED' : 'MOTION NOT SUPPORTED', 'pink');
    }
  }

  updateTiltLabels() {
    const on = this.input.tiltEnabled;
    $('menuTiltState').textContent = on ? 'ON' : 'OFF';
    $('tiltState').textContent = on ? 'ON' : 'OFF';
    $('menuTiltBtn').classList.toggle('on', on);
    $('tiltBtn').classList.toggle('on', on);
    $('motionHint').textContent = on
      ? 'Tilt to steer · joystick controls throttle'
      : 'Optional tilt steering available on phones & tablets';
  }

  toggleSound() {
    this.audio.start();
    this.audio.setMuted(!this.audio.muted);
    this.updateSoundLabels();
    this.hud.toast(this.audio.muted ? 'SOUND OFF' : 'SOUND ON', this.audio.muted ? '' : 'gold', 1400);
  }

  updateSoundLabels() {
    const txt = this.audio.muted ? 'OFF' : 'ON';
    $('menuSoundState').textContent = txt;
    $('soundState').textContent = txt;
    $('menuSoundBtn').classList.toggle('on', !this.audio.muted);
    $('soundBtn').classList.toggle('on', !this.audio.muted);
  }

  start() {
    if (this.state !== 'menu') return;
    this.state = 'playing';
    this.audio.start();
    this.hud.showGame();
    this.hud.setCash(this.cash);
    this.hud.setHealth(this.player.health, this.player.maxHealth);
    this.hud.setWanted(this.heat);
    this.hud.setDriving(false);
    this.hud.setMission(0, MISSIONS.length, MISSIONS[0].title, MISSIONS[0].desc);
    this.cameraYaw = 0;
    this.cameraPitch = 0.23;
    this.snapCameraToPlayer();
    this.hud.toast('WELCOME TO NEON CITY', 'gold', 3000);
    this.clock.getDelta();
  }

  snapCameraToPlayer() {
    const target = this.cameraTarget();
    const offset = this.cameraOffset(this.cameraYaw, this.cameraPitch, 6.6);
    this.camera.position.copy(target).add(offset);
    this.camera.lookAt(target);
  }

  cameraTarget() {
    if (this.playerCar) {
      return this.tmpVec3.set(this.playerCar.pos.x, 1.0, this.playerCar.pos.z);
    }
    return this.tmpVec3.set(this.player.pos.x, this.player.pos.y + 1.35, this.player.pos.z);
  }

  cameraOffset(yaw, pitch, dist) {
    const cp = Math.cos(pitch);
    return new THREE.Vector3(Math.sin(yaw) * cp * dist, Math.sin(pitch) * dist + 0.22, Math.cos(yaw) * cp * dist);
  }

  togglePause(force) {
    if (this.state === 'menu' || this.state === 'dead') return;
    const shouldPause = force ?? this.state === 'playing';
    if (shouldPause && this.state === 'playing') {
      this.state = 'paused';
      this.hud.showPause(true);
      this.audio.suspend();
    } else if (!shouldPause && this.state === 'paused') {
      this.state = 'playing';
      this.hud.showPause(false);
      this.audio.resume();
      this.clock.getDelta();
    }
  }

  nearestCar(maxDist = 7.2) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.cars) {
      if (car.destroyed) continue;
      const d = car.distanceTo(this.player.pos.x, this.player.pos.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    for (const car of this.traffic) {
      if (car.destroyed) continue;
      const d = car.distanceTo(this.player.pos.x, this.player.pos.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  enterCar(car) {
    if (!car || car.destroyed || this.player.inCar) return;
    const wasTraffic = this.traffic.includes(car);
    this.playerCar = car;
    this.player.inCar = car;
    this.player.setVisible(false);
    if (wasTraffic) {
      const idx = this.traffic.indexOf(car);
      if (idx >= 0) this.traffic.splice(idx, 1);
      this.addHeat(1, true);
      this.hud.toast('CARJACKED', 'pink', 1800);
    }
    this.cameraYaw = car.heading + Math.PI;
    this.cameraPitch = 0.2;
    this.cameraDist = 8.8;
    this.hud.setDriving(true);
    this.hud.setVehicleHint(false);
    this.audio.blip(320, 0.09, 'square', 0.06);
    this.audio.horn();
    this.prevVehicleSpeed = car.speed;
  }

  exitCar() {
    const car = this.playerCar;
    if (!car) return;
    const ch = car.heading;
    const sideX = Math.cos(ch), sideZ = -Math.sin(ch);
    let x = car.pos.x + sideX * 2.6;
    let z = car.pos.z + sideZ * 2.6;
    if (this.world.isSolid(x, z, 0.5)) {
      x = car.pos.x - sideX * 2.6;
      z = car.pos.z - sideZ * 2.6;
    }
    if (this.world.isSolid(x, z, 0.5)) {
      x = car.pos.x;
      z = car.pos.z - 2.8;
    }
    this.player.pos.set(x, this.world.groundHeight(x, z), z);
    this.player.heading = ch;
    this.player.inCar = null;
    this.player.setVisible(true);
    car.speed = 0;
    car.braking = true;
    this.playerCar = null;
    this.hud.setDriving(false);
    this.audio.blip(260, 0.08, 'square', 0.05);
    this.snapCameraToPlayer();
  }

  addHeat(amount, quiet = false) {
    const before = Math.ceil(this.heat);
    this.heat = clamp(this.heat + amount, 0, 5);
    this.lastCrime = this.elapsed;
    this.escapeTimer = 0;
    this.hud.setWanted(this.heat, true);
    if (!quiet && Math.ceil(this.heat) > before) this.audio.wanted();
    if (!quiet) this.shake = Math.max(this.shake, 0.12);
  }

  shoot() {
    if (!this.player.shoot()) return;
    this.audio.gunshot();
    this.shake = Math.max(this.shake, 0.2);

    const origin = this.camera.position.clone();
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    const muzzle = this.player.muzzle.getWorldPosition(new THREE.Vector3());
    let dist = 95;
    let hitPoint = origin.clone().addScaledVector(dir, dist);
    let hitType = 'air';
    let hitCar = null;
    let hitPed = null;

    this.raycaster.set(origin, dir);
    this.raycaster.far = 120;
    const hits = this.raycaster.intersectObjects(this.world.raycastMeshes, false);
    if (hits.length && hits[0].distance < dist) {
      dist = hits[0].distance;
      hitPoint = hits[0].point.clone();
      hitType = 'building';
    }

    const pedHit = this.peds.hitTest(origin, dir, dist);
    if (pedHit) {
      dist = pedHit.distance;
      hitPoint = origin.clone().addScaledVector(dir, dist);
      hitType = 'ped';
      hitPed = pedHit.ped;
    }

    const allCars = [...this.cars, ...this.traffic, ...this.cops];
    for (const car of allCars) {
      if (car === this.playerCar || car.destroyed) continue;
      const center = this.tmpVec.set(car.pos.x, car.pos.y + 0.8, car.pos.z);
      const sph = this.raySphere(origin, dir, center, 1.65);
      if (sph && sph.t > 2 && sph.t < dist) {
        dist = sph.t;
        hitPoint = origin.clone().addScaledVector(dir, dist);
        hitType = car.police ? 'cop' : 'car';
        hitCar = car;
      }
    }

    const flash = makeGlowSprite(0xffd9a0, 1.7, 0.95);
    flash.position.copy(muzzle);
    this.scene.add(flash);
    this.flashes.push({ sprite: flash, life: 0.07, max: 0.07, grow: 1.6, scale: 1.7 });

    const tracerGeo = new THREE.BufferGeometry().setFromPoints([muzzle, hitPoint]);
    const tracerMat = new THREE.LineBasicMaterial({
      color: 0xffe6b0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    });
    const line = new THREE.Line(tracerGeo, tracerMat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.075, max: 0.075 });

    if (hitType === 'ped') {
      this.peds.alert(this.player.pos.x, this.player.pos.z, 36);
      hitPed.flee = 7;
      hitPed.fleeDir = Math.atan2(hitPed.x - this.player.pos.x, hitPed.z - this.player.pos.z);
      this.addHeat(1.3);
      this.hud.hitmarker();
      this.spawnSpark(hitPoint, 0xff5a72);
    } else if (hitCar) {
      hitCar.damage(hitCar.police ? 42 : 30);
      this.hud.hitmarker();
      this.spawnSpark(hitPoint, 0xffb347);
      this.audio.crash(0.4);
      this.addHeat(hitCar.police ? 1.6 : 0.85);
      if (hitCar.destroyed) this.destroyCar(hitCar);
    } else if (hitType === 'building') {
      this.spawnSpark(hitPoint, 0xffe0a0);
    }
    this.peds.alert(this.player.pos.x, this.player.pos.z, 48);
    this.addHeat(0.32, true);
  }

  raySphere(origin, dir, center, radius) {
    const ox = center.x - origin.x;
    const oy = center.y - origin.y;
    const oz = center.z - origin.z;
    const t = ox * dir.x + oy * dir.y + oz * dir.z;
    if (t < 0) return null;
    const d2 = ox * ox + oy * oy + oz * oz - t * t;
    const r2 = radius * radius;
    if (d2 > r2) return null;
    const thc = Math.sqrt(r2 - d2);
    return { t: Math.max(0, t - thc) };
  }

  spawnSpark(pos, color) {
    const flash = makeGlowSprite(color, 1.1, 1);
    flash.position.copy(pos);
    this.scene.add(flash);
    this.flashes.push({ sprite: flash, life: 0.16, max: 0.16, grow: 0.5, scale: 1.1 });
    const count = 12;
    const positions = new Float32Array(count * 3);
    const vels = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      vels.push(new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color, size: 0.35, map: glowTexture(), transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.particles.push({ points, vels, life: 0.4, max: 0.4 });
  }

  spawnExplosion(pos) {
    this.audio.explosion();
    this.shake = Math.max(this.shake, 0.65);
    const flash = makeGlowSprite(0xffb347, 13, 0.95);
    flash.position.copy(pos);
    flash.position.y += 1.2;
    this.scene.add(flash);
    this.flashes.push({ sprite: flash, life: 0.55, max: 0.55, grow: 2.4, scale: 13 });
    const count = 30;
    const positions = new Float32Array(count * 3);
    const vels = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y + 0.8;
      positions[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 7;
      vels.push(new THREE.Vector3(Math.cos(a) * r, 3 + Math.random() * 7, Math.sin(a) * r));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffa33d, size: 1.2, map: glowTexture(), transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.particles.push({ points, vels, life: 1.1, max: 1.1, gravity: 8 });
    const smoke = makeGlowSprite(0x1b1420, 16, 0.55);
    smoke.position.copy(pos);
    smoke.position.y += 3;
    this.scene.add(smoke);
    this.flashes.push({ sprite: smoke, life: 1.8, max: 1.8, grow: 1.2, scale: 16 });
  }

  destroyCar(car) {
    car.destroyed = true;
    car.group.visible = false;
    this.spawnExplosion(car.pos.clone());
    let arr = this.cars;
    let idx = arr.indexOf(car);
    if (idx < 0) { arr = this.traffic; idx = arr.indexOf(car); }
    if (idx < 0) { arr = this.cops; idx = arr.indexOf(car); }
    if (idx >= 0) arr.splice(idx, 1);
    if (this.playerCar === car) {
      this.playerCar = null;
      this.player.inCar = null;
      this.player.setVisible(true);
      this.player.pos.set(car.pos.x + 2.5, 0.3, car.pos.z + 1);
      this.player.damage(38);
      this.lastDamage = this.elapsed;
      this.hud.setDriving(false);
      if (car.police) this.addHeat(1);
    }
    if (car.police) this.addHeat(0.6, true);
    this.scene.remove(car.group);
  }

  updateMarker() {
    if (this.missionDone || this.missionIndex >= MISSIONS.length) {
      this.marker.visible = false;
      this.hud.setMissionDistance(null);
      return;
    }
    const m = MISSIONS[this.missionIndex];
    this.marker.visible = true;
    this.marker.position.set(m.x, this.world.groundHeight(m.x, m.z), m.z);
  }

  completeMission() {
    const m = MISSIONS[this.missionIndex];
    this.cash += m.reward;
    this.hud.setCash(this.cash);
    this.audio.mission();
    this.hud.toast(`MISSION COMPLETE  +$${m.reward.toLocaleString('en-US')}`, 'gold', 3200);
    this.missionIndex++;
    this.missionCooldown = 1.2;
    if (this.missionIndex < MISSIONS.length) {
      const next = MISSIONS[this.missionIndex];
      this.hud.setMission(this.missionIndex, MISSIONS.length, next.title, next.desc);
      if (next.wanted) {
        this.addHeat(next.wanted);
        this.hud.toast('THE COPS ARE ON YOUR TAIL', 'pink', 2600);
      }
      this.updateMarker();
    } else {
      this.missionDone = true;
      this.hud.setMission(MISSIONS.length - 1, MISSIONS.length, 'CITY IS YOURS', 'Free roam Neon City');
      this.hud.setMissionDistance(null);
      this.marker.visible = false;
      setTimeout(() => this.hud.toast('NEON CITY IS YOURS', 'pink', 3800), 800);
    }
  }

  updateMission(dt) {
    if (this.missionCooldown > 0) this.missionCooldown -= dt;
    if (this.missionDone) return;
    const m = MISSIONS[this.missionIndex];
    const dx = m.x - this.player.pos.x;
    const dz = m.z - this.player.pos.z;
    const dist = Math.hypot(dx, dz);
    this.hud.setMissionDistance(dist);
    if (dist < 7.5 && this.missionCooldown <= 0) this.completeMission();
  }

  updatePickups(dt) {
    for (const p of this.pickups) {
      if (!p.active) continue;
      p.phase += dt;
      p.group.position.y = 0.3 + Math.sin(p.phase * 2.2) * 0.16;
      p.ring.rotation.z += dt * 1.8;
      p.sprite.material.opacity = 0.85 + Math.sin(p.phase * 3) * 0.15;
      const d = Math.hypot(p.x - this.player.pos.x, p.z - this.player.pos.z);
      if (d < 3.2) {
        p.active = false;
        p.group.visible = false;
        this.cash += 250;
        this.player.health = Math.min(this.player.maxHealth, this.player.health + 12);
        this.hud.setCash(this.cash);
        this.hud.toast('+$250', 'gold', 1600);
        this.audio.pickup();
      }
    }
  }

  updateWanted(dt) {
    let nearest = Infinity;
    for (const cop of this.cops) {
      nearest = Math.min(nearest, cop.distanceTo(this.player.pos.x, this.player.pos.z));
    }
    if (this.heat > 0) {
      if (nearest > 78 && this.elapsed - this.lastCrime > 11) this.escapeTimer += dt;
      else this.escapeTimer = Math.max(0, this.escapeTimer - dt * 2);
      if (this.escapeTimer > 6) {
        this.heat = Math.max(0, this.heat - dt * 0.16);
        this.hud.setWanted(this.heat, false);
        if (this.heat <= 0) {
          this.heat = 0;
          this.hud.toast('YOU LOST THE COPS', 'gold', 2400);
          this.audio.blip(660, 0.25, 'sine', 0.08);
        }
      }
      this.copSpawnTimer -= dt;
      const targetCops = Math.min(3, Math.ceil(this.heat));
      if (this.copSpawnTimer <= 0 && this.cops.length < targetCops) {
        this.spawnCop();
        this.copSpawnTimer = 3.2;
      }
    } else {
      this.copSpawnTimer = 0;
    }
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const cop = this.cops[i];
      if (this.heat <= 0 && cop.distanceTo(this.player.pos.x, this.player.pos.z) > 90) {
        this.scene.remove(cop.group);
        this.cops.splice(i, 1);
      }
    }
  }

  spawnCop() {
    const nodes = [];
    for (let ix = -4; ix <= 4; ix++) {
      for (let iz = -4; iz <= 4; iz++) {
        const x = ix * 60;
        const z = iz * 60;
        const d = Math.hypot(x - this.player.pos.x, z - this.player.pos.z);
        if (d > 65 && d < 170) nodes.push({ x, z, d });
      }
    }
    if (!nodes.length) return;
    nodes.sort((a, b) => a.d - b.d);
    const node = nodes[Math.floor(Math.random() * Math.min(nodes.length, 8))];
    const cop = new CopCar(this.scene, this.world, node.x, node.z, this.heat);
    cop.targetHeading = Math.atan2(this.player.pos.x - node.x, this.player.pos.z - node.z);
    cop.heading = cop.targetHeading;
    cop.group.rotation.y = cop.heading;
    this.cops.push(cop);
  }

  updateCops(dt) {
    for (const cop of this.cops) {
      const dist = cop.distanceTo(this.player.pos.x, this.player.pos.z);
      cop.updateAI(dt, this.player.pos.x, this.player.pos.z);
      if (dist < 4.9) {
        const dmg = this.playerCar ? 7.5 : 23;
        this.player.damage(dmg * dt);
        this.lastDamage = this.elapsed;
        if (this.playerCar) this.playerCar.damage(13 * dt);
        this.shake = Math.max(this.shake, 0.18);
        if (this.crashTimer <= 0) {
          this.audio.crash(0.5);
          this.crashTimer = 0.55;
        }
      }
      if (cop.destroyed) {
        const idx = this.cops.indexOf(cop);
        if (idx >= 0) this.cops.splice(idx, 1);
        this.spawnExplosion(cop.pos.clone());
        this.audio.explosion();
        this.addHeat(0.7, true);
        this.scene.remove(cop.group);
      }
    }
  }

  handleAction() {
    if (!this.input.consumeAction()) return;
    if (this.player.inCar) {
      this.exitCar();
      return;
    }
    const car = this.nearestCar(this.playerCar ? 99 : 7.2);
    if (car) this.enterCar(car);
  }

  updatePlayer(dt) {
    if (this.player.inCar) {
      const car = this.playerCar;
      if (!car || car.destroyed) {
        this.exitCar();
        return;
      }
      let throttle = this.input.moveY;
      let steer = this.input.moveX;
      if (this.input.tiltEnabled && Math.abs(this.input.moveX) < 0.12) steer = this.input.tiltValue;
      if (this.input.tiltEnabled) throttle = this.input.moveY;
      const brake = this.input.brake;
      const beforeHealth = car.health;
      const beforeSpeed = car.speed;
      car.physicalUpdate(dt, this.world, throttle, steer, brake);
      if (car.health < beforeHealth) {
        this.audio.crash(Math.min(1, Math.abs(beforeSpeed) / 24));
        this.shake = Math.max(this.shake, 0.22);
      }
      this.player.pos.copy(car.pos);
      this.player.heading = car.heading;
      if (car.health <= 0) this.destroyCar(car);
      this.hud.setSpeed(car.speed, car.maxSpeed);
      if (this.input.brake && Math.abs(car.speed) < 1 && this.input.moveY < -0.3) {
        // reverse handled by throttle sign
      }
      this.audio.update(dt, { speed: car.speed, driving: true, wanted: this.heat });
    } else {
      this.player.update(dt, this.world, this.input, this.cameraYaw);
      this.audio.update(dt, { speed: 0, driving: false, wanted: this.heat });
      this.hud.setSpeed(0, 1);
      if (this.input.fire) this.shoot();
    }
  }

  updateCamera(dt) {
    const look = this.input.consumeCamera();
    if (look.dx || look.dy) {
      this.cameraYaw -= look.dx * 0.0055;
      this.cameraPitch = clamp(this.cameraPitch + look.dy * 0.0038, 0.02, 0.84);
      this.lastLook = this.elapsed;
    }
    if (this.playerCar) {
      const speed = Math.abs(this.playerCar.speed);
      if (this.elapsed - this.lastLook > 1.4 && speed > 2) {
        this.cameraYaw = dampAngle(this.cameraYaw, this.playerCar.heading + Math.PI, 2.2, dt);
      }
    } else if (this.elapsed - this.lastLook > 4 && this.player.speed > 1) {
      this.cameraYaw = dampAngle(this.cameraYaw, this.player.heading + Math.PI, 0.7, dt);
    }

    const target = this.cameraTarget();
    const dist = this.playerCar ? (8.8 + Math.min(2.2, Math.abs(this.playerCar.speed) * 0.06)) : 6.5;
    const offset = this.cameraOffset(this.cameraYaw, this.cameraPitch, dist);
    const desired = target.clone().add(offset);
    desired.y = Math.max(0.9, desired.y);

    // Keep the camera out of buildings with a coarse probe.
    const steps = 9;
    let allowed = 1;
    for (let i = 3; i <= steps; i++) {
      const t = i / steps;
      const sx = target.x + (desired.x - target.x) * t;
      const sz = target.z + (desired.z - target.z) * t;
      if (this.world.isSolid(sx, sz, 0.15)) { allowed = Math.max(0.25, (i - 1) / steps); break; }
    }
    if (allowed < 1) {
      desired.x = target.x + (desired.x - target.x) * allowed;
      desired.z = target.z + (desired.z - target.z) * allowed;
    }

    const lambda = this.playerCar ? 6.5 : 9;
    this.camera.position.lerp(desired, 1 - Math.exp(-lambda * dt));
    if (this.shake > 0) {
      const s = this.shake;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s * 0.7;
      this.camera.position.z += (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 1.8);
    }
    const lookTarget = target.clone();
    lookTarget.y += 0.2;
    this.camera.lookAt(lookTarget);

    const targetFov = this.playerCar ? 68 + Math.min(8, Math.abs(this.playerCar.speed) * 0.28) : 63;
    this.camera.fov = damp(this.camera.fov, targetFov, 3, dt);
    this.camera.updateProjectionMatrix();
  }

  updateEffects(dt) {
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      const t = 1 - f.life / f.max;
      f.sprite.material.opacity = Math.max(0, (1 - t)) * (f.sprite.userData.baseOpacity || 1);
      f.sprite.scale.setScalar(f.scale * (1 + (f.grow - 1) * t));
      if (f.life <= 0) {
        this.scene.remove(f.sprite);
        f.sprite.material.dispose();
        this.flashes.splice(i, 1);
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      const pos = p.points.geometry.attributes.position;
      for (let j = 0; j < p.vels.length; j++) {
        const v = p.vels[j];
        v.y -= (p.gravity ?? 12) * dt;
        pos.setX(j, pos.getX(j) + v.x * dt);
        pos.setY(j, pos.getY(j) + v.y * dt);
        pos.setZ(j, pos.getZ(j) + v.z * dt);
      }
      pos.needsUpdate = true;
      p.points.material.opacity = Math.max(0, p.life / p.max);
      if (p.life <= 0) {
        this.scene.remove(p.points);
        p.points.geometry.dispose();
        p.points.material.dispose();
        this.particles.splice(i, 1);
      }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / t.max) * 0.85;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }

  updateHUD(dt) {
    this.hud.setHealth(this.player.health, this.player.maxHealth);
    this.hud.setWanted(this.heat, false);
    this.hud.setCash(this.cash);
    this.areaTimer -= dt;
    if (this.areaTimer <= 0) {
      this.areaTimer = 0.35;
      const x = this.player.pos.x;
      const z = this.player.pos.z;
      let area = 'NEON CITY';
      if (z > 155) area = 'OCEAN DRIVE';
      else if (z < -110) area = 'DOWNTOWN';
      else if (x < -150) area = 'THE DOCKS';
      else if (x > 150) area = 'SUNSET STRIP';
      else if (z < 60) area = 'MIDTOWN';
      this.hud.setArea(area);
      const near = !this.playerCar ? this.nearestCar(7.2) : null;
      if (near) {
        const verb = this.isTouch ? 'TAP ENTER' : 'PRESS E';
        this.hud.setVehicleHint(true, near.police ? verb + ' TO CARJACK' : verb + ' TO STEAL');
      } else {
        this.hud.setVehicleHint(false);
      }
    }
    this.hud.updateMinimap(dt, {
      player: { x: this.player.pos.x, z: this.player.pos.z, heading: this.player.inCar ? this.playerCar.heading : this.player.heading },
      mission: this.missionDone ? null : { visible: true, x: MISSIONS[this.missionIndex]?.x, z: MISSIONS[this.missionIndex]?.z },
      pickups: this.pickups,
      traffic: this.traffic,
      cops: this.cops
    });
  }

  updateHealth(dt) {
    if (this.elapsed - this.lastDamage > 7 && this.player.health < this.player.maxHealth) {
      this.player.health = Math.min(this.player.maxHealth, this.player.health + 3.4 * dt);
    }
    if (this.player.health <= 0 && this.state === 'playing') this.die();
  }

  die() {
    this.state = 'dead';
    this.deadTimer = 0;
    this.hud.showWasted(true);
    this.audio.explosion();
    this.shake = 1;
    if (this.playerCar) {
      this.playerCar.speed = 0;
      this.player.inCar = null;
      this.playerCar = null;
      this.hud.setDriving(false);
    }
    this.player.setVisible(false);
    this.player.health = 0;
  }

  respawn() {
    this.state = 'playing';
    this.hud.showWasted(false);
    this.player.health = this.player.maxHealth;
    this.player.pos.set(5.2, 0.3, 91);
    this.player.heading = Math.PI;
    this.player.jumpY = 0;
    this.player.vy = 0;
    this.player.setVisible(true);
    this.player.inCar = null;
    this.playerCar = null;
    this.cash = Math.max(0, this.cash - 500);
    this.heat = 0;
    this.cops.forEach((c) => this.scene.remove(c.group));
    this.cops = [];
    this.escapeTimer = 0;
    this.hud.setWanted(0);
    this.hud.setCash(this.cash);
    this.hud.setHealth(this.player.health, this.player.maxHealth);
    this.hud.setDriving(false);
    this.cameraYaw = 0;
    this.cameraPitch = 0.23;
    this.snapCameraToPlayer();
    this.hud.toast('HOSPITAL BILL  -$500', 'pink', 2600);
    this.lastDamage = this.elapsed;
  }

  updateAmbient(dt) {
    this.peds.update(dt, this.world, this.player.pos);
    for (const car of this.traffic) car.updateAI(dt, this.traffic, this.playerCar);
    if (!this.player.inCar && this.crashTimer <= 0) {
      for (const car of this.traffic) {
        if (Math.abs(car.speed) > 4 && car.distanceTo(this.player.pos.x, this.player.pos.z) < 2.2) {
          this.player.damage(16);
          this.lastDamage = this.elapsed;
          this.shake = Math.max(this.shake, 0.4);
          this.audio.crash(0.8);
          this.crashTimer = 0.7;
          car.speed *= 0.45;
          break;
        }
      }
    }
  }

  loop(now) {
    const rawDt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    const dt = clamp(rawDt, 0.0001, 0.05);
    this.menuTime += dt;

    if (this.state === 'menu') {
      this.world.update(dt, this.player.pos);
      this.updateAmbient(dt);
      const a = this.menuTime * 0.035 + 0.8;
      const radius = 168;
      this.camera.position.set(Math.cos(a) * radius + 10, 62 + Math.sin(this.menuTime * 0.12) * 7, Math.sin(a) * radius + 70);
      this.camera.lookAt(18, 26, 25);
      this.camera.fov = 62;
      this.camera.updateProjectionMatrix();
      this.renderer.render(this.scene, this.camera);
      this.updateEffects(dt);
      requestAnimationFrame(this.loop);
      return;
    }

    if (this.state === 'paused') {
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(this.loop);
      return;
    }

    if (this.state === 'dead') {
      this.deadTimer += dt;
      this.updateEffects(dt);
      this.world.update(dt, this.player.pos);
      this.updateAmbient(dt);
      this.updateCamera(dt);
      this.renderer.render(this.scene, this.camera);
      if (this.deadTimer > 2.8) this.respawn();
      requestAnimationFrame(this.loop);
      return;
    }

    this.elapsed += dt;
    this.crashTimer = Math.max(0, this.crashTimer - dt);
    this.input.update(dt);
    this.handleAction();
    this.updatePlayer(dt);
    this.updateAmbient(dt);
    this.updateCops(dt);
    this.updateWanted(dt);
    this.updateMission(dt);
    this.updatePickups(dt);
    this.updateHealth(dt);
    this.updateCamera(dt);
    this.updateEffects(dt);
    this.updateHUD(dt);
    this.world.update(dt, this.player.pos);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.loop);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    window.__game = new Game();
  } catch (err) {
    console.error(err);
    const menu = document.getElementById('startBtn');
    if (menu) menu.textContent = 'WEBGL UNAVAILABLE';
  }
});
