import * as THREE from 'three';
import {
  clamp, lerp, damp, dampAngle, shortestAngle,
  mergeGeometries, transformed, glowTexture, makeGlowSprite, mulberry32, textTexture
} from './utils.js';

let carCache = null;

function buildCarGeometries() {
  if (carCache) return carCache;
  const painted = [];
  painted.push(transformed(new THREE.BoxGeometry(1.9, 0.5, 4.35), [0, 0.62, 0], [0, 0, 0], [1, 1, 1]));
  painted.push(transformed(new THREE.BoxGeometry(1.76, 0.2, 4.0), [0, 0.4, 0], [0, 0, 0], [1, 1, 1]));
  painted.push(transformed(new THREE.BoxGeometry(1.7, 0.16, 1.2), [0, 0.9, 1.5], [0, 0, 0], [1, 1, 1]));
  painted.push(transformed(new THREE.BoxGeometry(1.7, 0.16, 1.05), [0, 0.9, -1.58], [0, 0, 0], [1, 1, 1]));
  painted.push(transformed(new THREE.BoxGeometry(1.5, 0.14, 1.55), [0, 1.37, -0.12], [0, 0, 0], [1, 1, 1]));
  painted.push(transformed(new THREE.BoxGeometry(1.28, 0.08, 0.5), [0, 1.1, -1.88], [0, 0, 0], [1, 1, 1]));
  painted.push(transformed(new THREE.BoxGeometry(0.08, 0.34, 0.08), [-0.5, 0.97, -1.82], [0, 0, 0], [1, 1, 1]));
  painted.push(transformed(new THREE.BoxGeometry(0.08, 0.34, 0.08), [0.5, 0.97, -1.82], [0, 0, 0], [1, 1, 1]));
  const paintedGeo = mergeGeometries(painted);

  const glass = mergeGeometries([
    transformed(new THREE.BoxGeometry(1.6, 0.51, 1.86), [0, 1.08, -0.14], [0, 0, 0], [1, 1, 1])
  ]);

  const wheelParts = [];
  for (const x of [-0.99, 0.99]) {
    for (const z of [-1.38, 1.38]) {
      wheelParts.push(transformed(new THREE.CylinderGeometry(0.41, 0.41, 0.32, 12), [x, 0.4, z], [0, 0, Math.PI / 2], [1, 1, 1]));
    }
  }
  const wheelGeo = mergeGeometries(wheelParts);

  const rimParts = [];
  for (const x of [-0.99, 0.99]) {
    for (const z of [-1.38, 1.38]) {
      rimParts.push(transformed(new THREE.CylinderGeometry(0.2, 0.2, 0.34, 10), [x, 0.4, z], [0, 0, Math.PI / 2], [1, 1, 1]));
    }
  }
  const rimGeo = mergeGeometries(rimParts);

  const headParts = [];
  for (const x of [-0.62, 0.62]) {
    headParts.push(transformed(new THREE.BoxGeometry(0.36, 0.16, 0.1), [x, 0.71, 2.16], [0, 0, 0], [1, 1, 1]));
  }
  const headGeo = mergeGeometries(headParts);

  const tailParts = [];
  for (const x of [-0.66, 0.66]) {
    tailParts.push(transformed(new THREE.BoxGeometry(0.34, 0.14, 0.08), [x, 0.78, -2.16], [0, 0, 0], [1, 1, 1]));
  }
  const tailGeo = mergeGeometries(tailParts);

  const trimParts = [];
  trimParts.push(transformed(new THREE.BoxGeometry(1.86, 0.18, 0.18), [0, 0.52, 2.14], [0, 0, 0], [1, 1, 1]));
  trimParts.push(transformed(new THREE.BoxGeometry(1.86, 0.18, 0.18), [0, 0.52, -2.14], [0, 0, 0], [1, 1, 1]));
  trimParts.push(transformed(new THREE.BoxGeometry(0.1, 0.24, 0.28), [-1.02, 0.8, 1.45], [0, 0, 0], [1, 1, 1]));
  trimParts.push(transformed(new THREE.BoxGeometry(0.1, 0.24, 0.28), [1.02, 0.8, 1.45], [0, 0, 0], [1, 1, 1]));
  trimParts.push(transformed(new THREE.BoxGeometry(1.03, 0.2, 0.06), [0, 0.56, 2.181], [0, 0, 0], [1, 1, 1]));
  trimParts.push(transformed(new THREE.BoxGeometry(1.32, 0.075, 0.4), [0, 0.345, 2.03], [0, 0, 0], [1, 1, 1]));
  trimParts.push(transformed(new THREE.BoxGeometry(0.34, 0.02, 0.58), [-0.33, 0.985, 1.2], [0, 0, 0], [1, 1, 1]));
  trimParts.push(transformed(new THREE.BoxGeometry(0.34, 0.02, 0.58), [0.33, 0.985, 1.2], [0, 0, 0], [1, 1, 1]));
  trimParts.push(transformed(new THREE.BoxGeometry(0.09, 0.14, 2.45), [-0.955, 0.38, 0], [0, 0, 0], [1, 1, 1]));
  trimParts.push(transformed(new THREE.BoxGeometry(0.09, 0.14, 2.45), [0.955, 0.38, 0], [0, 0, 0], [1, 1, 1]));
  const trimGeo = mergeGeometries(trimParts);

  carCache = { paintedGeo, glass, wheelGeo, rimGeo, headGeo, tailGeo, trimGeo };
  return carCache;
}

const glassMat = new THREE.MeshStandardMaterial({ color: 0x07131f, roughness: 0.14, metalness: 0.92, transparent: true, opacity: 0.94 });
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0d0d11, roughness: 0.86, metalness: 0.1 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xc9d3dc, roughness: 0.26, metalness: 0.95 });
const headMat = new THREE.MeshStandardMaterial({ color: 0xfff7dd, emissive: 0xfff0c4, emissiveIntensity: 2.6, roughness: 0.2 });
const tailMat = new THREE.MeshStandardMaterial({ color: 0x8a0f18, emissive: 0xff1838, emissiveIntensity: 1.6, roughness: 0.3 });
const trimMat = new THREE.MeshStandardMaterial({ color: 0x17151d, roughness: 0.55, metalness: 0.55 });

export function createCarMesh(color, options = {}) {
  const geos = buildCarGeometries();
  const group = new THREE.Group();
  const paintedMat = new THREE.MeshStandardMaterial({
    color, roughness: 0.32, metalness: 0.55,
    emissive: new THREE.Color(color).multiplyScalar(0.06), emissiveIntensity: 0.8
  });
  const body = new THREE.Mesh(geos.paintedGeo, paintedMat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const glass = new THREE.Mesh(geos.glass, glassMat);
  glass.castShadow = true;
  group.add(glass);
  const wheels = new THREE.Mesh(geos.wheelGeo, wheelMat);
  wheels.castShadow = true;
  group.add(wheels);
  group.add(new THREE.Mesh(geos.rimGeo, rimMat));
  const head = new THREE.Mesh(geos.headGeo, headMat.clone());
  group.add(head);
  const tail = new THREE.Mesh(geos.tailGeo, tailMat.clone());
  group.add(tail);
  const trim = new THREE.Mesh(geos.trimGeo, trimMat);
  group.add(trim);

  let lightbar = null;
  if (options.police) {
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.1, 0.36), trimMat);
    barBase.position.set(0, 1.47, -0.1);
    group.add(barBase);
    const redMat = new THREE.MeshStandardMaterial({ color: 0x550008, emissive: 0xff1028, emissiveIntensity: 3.5, toneMapped: false });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x001144, emissive: 0x1a6bff, emissiveIntensity: 3.5, toneMapped: false });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.32), redMat);
    red.position.set(-0.3, 1.54, -0.1);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.32), blueMat);
    blue.position.set(0.3, 1.54, -0.1);
    group.add(red, blue);
    const redGlow = makeGlowSprite(0xff2038, 2.6, 0.5);
    redGlow.position.copy(red.position);
    const blueGlow = makeGlowSprite(0x2a7bff, 2.6, 0.5);
    blueGlow.position.copy(blue.position);
    group.add(redGlow, blueGlow);
    lightbar = { redMat, blueMat, redGlow, blueGlow };

    const stripeMat = new THREE.MeshStandardMaterial({ color: 0x0c0e16, roughness: 0.5, metalness: 0.35 });
    for (const side of [-1, 1]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.36, 2.5), stripeMat);
      stripe.position.set(side * 0.965, 0.7, -0.1);
      group.add(stripe);
    }
  }

  if (options.sports) {
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 5.8),
      new THREE.MeshBasicMaterial({
        map: glowTexture(), color: options.glowColor || 0x34e5ff, transparent: true,
        opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
      })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.035;
    group.add(glow);
  }

  return { group, paintedMat, headMat: head.material, tailMat: tail.material, lightbar };
}

export class Car {
  constructor(scene, options = {}) {
    this.scene = scene;
    const { group, paintedMat, headMat: hm, tailMat: tm, lightbar } = createCarMesh(options.color ?? 0xff2f8e, options);
    this.group = group;
    this.bodyMat = paintedMat;
    this.headMat = hm;
    this.tailMat = tm;
    this.lightbar = lightbar;
    this.pos = group.position;
    this.heading = 0;
    this.speed = 0;
    this.maxSpeed = options.maxSpeed || (options.sports ? 38 : 31);
    this.health = options.health || 100;
    this.maxHealth = this.health;
    this.radius = 1.25;
    this.police = !!options.police;
    this.sports = !!options.sports;
    this.hero = !!options.hero;
    this.braking = false;
    this.throttle = 0;
    this.steer = 0;
    this.hitFlash = 0;
    this.destroyed = false;
    scene.add(group);
  }

  place(x, z, heading = 0) {
    this.pos.set(x, 0.04, z);
    this.heading = heading;
    this.group.rotation.y = heading;
  }

  get forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  physicalUpdate(dt, world, throttle, steer, brake) {
    this.throttle = throttle;
    this.steer = steer;
    this.braking = brake;
    if (Math.abs(throttle) > 0.05) {
      const boost = this.hero ? 1.12 : 1;
      if (throttle > 0) this.speed += throttle * 16 * boost * dt;
      else this.speed += throttle * 9 * dt;
    }
    if (brake) {
      this.speed = damp(this.speed, 0, 4.4, dt);
    }
    this.speed -= this.speed * 0.32 * dt;
    this.speed = clamp(this.speed, -11, this.maxSpeed);
    if (Math.abs(this.speed) < 0.04 && !throttle) this.speed = 0;

    const grip = clamp(Math.abs(this.speed) / 5.5, 0, 1);
    this.heading -= steer * 1.95 * dt * grip * Math.sign(this.speed || 1);

    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    let nx = this.pos.x + fx * this.speed * dt;
    let nz = this.pos.z + fz * this.speed * dt;

    if (world.isSolid(nx, nz, this.radius)) {
      const canX = !world.isSolid(nx, this.pos.z, this.radius);
      const canZ = !world.isSolid(this.pos.x, nz, this.radius);
      if (canX) { nz = this.pos.z; }
      else if (canZ) { nx = this.pos.x; }
      else { nx = this.pos.x; nz = this.pos.z; }
      if (Math.abs(this.speed) > 5) {
        this.speed *= -0.22;
        this.damage(Math.abs(this.speed) * 0.16);
      } else {
        this.speed *= 0.15;
      }
    }
    this.pos.x = nx;
    this.pos.z = nz;
    const ride = world.groundHeight(nx, nz) > 0.1 ? 0.3 : 0;
    this.pos.y = damp(this.pos.y, 0.04 + ride, 12, dt);
    this.group.rotation.y = this.heading;
    this.group.rotation.z = damp(this.group.rotation.z, -steer * clamp(Math.abs(this.speed) / 30, 0, 1) * 0.055, 8, dt);
    this.updateLights(dt);
  }

  updateLights(dt) {
    if (this.hitFlash > 0) {
      this.hitFlash = Math.max(0, this.hitFlash - dt);
      this.bodyMat.emissiveIntensity = 1.8 * this.hitFlash;
    } else {
      this.bodyMat.emissiveIntensity = 0.8;
    }
    this.tailMat.emissiveIntensity = this.braking ? 4.5 : 1.4;
    this.headMat.emissiveIntensity = this.braking ? 2.1 : 2.9;
    if (this.lightbar) {
      const t = performance.now() / 1000;
      const on = Math.sin(t * 15) > 0;
      this.lightbar.redMat.emissiveIntensity = on ? 5 : 0.2;
      this.lightbar.blueMat.emissiveIntensity = on ? 0.2 : 5;
      this.lightbar.redGlow.material.opacity = on ? 0.85 : 0.06;
      this.lightbar.blueGlow.material.opacity = on ? 0.06 : 0.85;
    }
  }

  damage(amount) {
    if (this.destroyed) return;
    this.health = Math.max(0, this.health - amount);
    this.hitFlash = Math.min(1, this.hitFlash + 0.5);
    if (this.health <= 0) this.destroyed = true;
  }

  distanceTo(x, z) {
    return Math.hypot(this.pos.x - x, this.pos.z - z);
  }
}

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.model = new THREE.Group();
    this.root.add(this.model);

    const skin = new THREE.MeshStandardMaterial({ color: 0xb87955, roughness: 0.72 });
    const jacket = new THREE.MeshStandardMaterial({ color: 0x12b4ad, roughness: 0.5, metalness: 0.12, emissive: 0x032b2a, emissiveIntensity: 0.5 });
    const jacketDark = new THREE.MeshStandardMaterial({ color: 0x0a6d70, roughness: 0.6, metalness: 0.15 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0xf7f3e8, roughness: 0.82 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x1b1e2d, roughness: 0.85 });
    const shoes = new THREE.MeshStandardMaterial({ color: 0xf0ebe0, roughness: 0.55 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x15131c, roughness: 0.45, metalness: 0.35 });
    const neon = new THREE.MeshBasicMaterial({ color: 0x37e8ff, toneMapped: false });

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.27), dark);
    belt.position.y = 0.92;
    this.model.add(belt);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.245, 0.4, 5, 12), jacket);
    torso.position.y = 1.2;
    torso.scale.set(1, 1, 0.74);
    torso.castShadow = true;
    this.model.add(torso);

    const zipper = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.44, 0.02), neon);
    zipper.position.set(0, 1.19, 0.188);
    this.model.add(zipper);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 12), jacketDark);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 1.6;
    this.model.add(collar);

    const shoulderPadL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), jacketDark);
    shoulderPadL.position.set(-0.32, 1.44, 0);
    shoulderPadL.scale.set(1, 0.8, 0.9);
    this.model.add(shoulderPadL);
    const shoulderPadR = shoulderPadL.clone();
    shoulderPadR.position.x = 0.32;
    this.model.add(shoulderPadR);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.14, 8), skin);
    neck.position.y = 1.57;
    this.model.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 14), skin);
    head.position.y = 1.75;
    head.castShadow = true;
    head.scale.set(0.95, 1.05, 0.95);
    this.model.add(head);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.185, 0.11, 14), new THREE.MeshStandardMaterial({ color: 0x12142a, roughness: 0.65 }));
    cap.position.y = 1.9;
    this.model.add(cap);
    const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.205, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x12142a, roughness: 0.65 }));
    capTop.position.y = 1.905;
    capTop.scale.y = 0.5;
    this.model.add(capTop);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.035, 0.2), new THREE.MeshStandardMaterial({ color: 0xff2f8e, roughness: 0.45, emissive: 0x4a001e, emissiveIntensity: 0.7 }));
    brim.position.set(0, 1.86, 0.17);
    this.model.add(brim);

    const emblemTex = textTexture('VII', { size: 96, color: '#ffd8ec', glowColor: '#ff2f8e', glowBlur: 14, pad: 8 });
    const emblem = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.22),
      new THREE.MeshBasicMaterial({ map: emblemTex, transparent: true, depthWrite: false, toneMapped: false })
    );
    emblem.position.set(0, 1.27, -0.186);
    emblem.rotation.y = Math.PI;
    this.model.add(emblem);

    this.arms = [];
    this.legs = [];
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.36, 1.43, 0);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.34, 4, 8), jacket);
      arm.position.y = -0.24;
      arm.castShadow = true;
      shoulder.add(arm);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.06, 8), neon);
      cuff.position.y = -0.44;
      shoulder.add(cuff);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.078, 10, 8), skin);
      hand.position.y = -0.53;
      shoulder.add(hand);
      this.model.add(shoulder);
      this.arms.push(shoulder);
    }

    const gun = new THREE.Group();
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.1, 0.4), dark);
    gunBody.position.z = 0.15;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.18, 6), dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.4;
    const gunsight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.12), neon);
    gunsight.position.set(0, 0.075, 0.18);
    gun.add(gunBody, barrel, gunsight);
    gun.position.set(0.02, -0.52, 0.12);
    gun.rotation.x = -0.15;
    this.arms[1].add(gun);
    this.gun = gun;
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, 0.01, 0.5);
    gun.add(this.muzzle);

    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.145, 0.9, 0);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.092, 0.52, 4, 8), pants);
      leg.position.y = -0.32;
      leg.castShadow = true;
      hip.add(leg);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.34), shoes);
      shoe.position.set(0, -0.65, 0.05);
      hip.add(shoe);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.03, 0.35), neon);
      sole.position.set(0, -0.715, 0.05);
      hip.add(sole);
      this.model.add(hip);
      this.legs.push(hip);
    }

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.4),
      new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    this.root.add(shadow);
    this.shadow = shadow;

    this.pos = new THREE.Vector3(5.2, 0.3, 91);
    this.heading = Math.PI;
    this.speed = 0;
    this.phase = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.vy = 0;
    this.jumpY = 0;
    this.onGround = true;
    this.inCar = null;
    this.shootTimer = 0;
    this.hurtTimer = 0;
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.heading;
    scene.add(this.root);
  }

  setVisible(v) { this.root.visible = v; }

  update(dt, world, input, camYaw) {
    if (this.inCar) return;
    const mx = input.moveX;
    const my = input.moveY;
    const fx = -Math.sin(camYaw);
    const fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw);
    const rz = -Math.sin(camYaw);
    let dx = fx * my + rx * mx;
    let dz = fz * my + rz * mx;
    const len = Math.hypot(dx, dz);
    if (len > 1) { dx /= len; dz /= len; }
    const moving = len > 0.06;
    const sprint = input.sprint && len > 0.25;
    const targetSpeed = moving ? (sprint ? 7.4 : 3.7) : 0;
    this.speed = damp(this.speed, targetSpeed, moving ? 10 : 13, dt);

    if (moving) {
      const targetHeading = Math.atan2(dx, dz);
      this.heading = dampAngle(this.heading, targetHeading, 12, dt);
    }
    const step = this.speed * dt;
    if (step > 0.0001) {
      const nx = this.pos.x + Math.sin(this.heading) * step;
      const nz = this.pos.z + Math.cos(this.heading) * step;
      if (!world.isSolid(nx, this.pos.z, 0.45)) this.pos.x = nx;
      if (!world.isSolid(this.pos.x, nz, 0.45)) this.pos.z = nz;
    }

    const ground = world.groundHeight(this.pos.x, this.pos.z);
    if (input.jump && this.onGround) {
      this.vy = 5.6;
      this.onGround = false;
    }
    if (!this.onGround || this.jumpY > 0) {
      this.vy -= 19 * dt;
      this.jumpY += this.vy * dt;
      if (this.jumpY <= 0) { this.jumpY = 0; this.vy = 0; this.onGround = true; }
    }
    this.pos.y = damp(this.pos.y, ground, 14, dt);
    this.root.position.set(this.pos.x, this.pos.y + this.jumpY, this.pos.z);
    this.root.rotation.y = this.heading;

    this.phase += dt * (2.4 + this.speed * 1.5);
    if (this.speed > 0.15) {
      const s = Math.sin(this.phase);
      const amp = clamp(this.speed / 6.5, 0.3, 1);
      this.legs[0].rotation.x = s * 0.72 * amp;
      this.legs[1].rotation.x = -s * 0.72 * amp;
      this.arms[0].rotation.x = -s * 0.6 * amp;
      this.arms[1].rotation.x = s * 0.35 * amp - 0.1;
      this.model.position.y = Math.abs(Math.sin(this.phase)) * 0.045;
      this.model.rotation.z = Math.sin(this.phase) * 0.018;
    } else {
      const idle = Math.sin(performance.now() * 0.002) * 0.02;
      this.legs[0].rotation.x = damp(this.legs[0].rotation.x, 0, 8, dt);
      this.legs[1].rotation.x = damp(this.legs[1].rotation.x, 0, 8, dt);
      this.arms[0].rotation.x = damp(this.arms[0].rotation.x, idle, 8, dt);
      this.arms[1].rotation.x = damp(this.arms[1].rotation.x, idle * 0.5, 8, dt);
      this.model.position.y = damp(this.model.position.y, 0, 8, dt);
      this.model.rotation.z = damp(this.model.rotation.z, 0, 8, dt);
    }
    this.shadow.position.y = 0.02 - this.jumpY;
    this.shadow.material.opacity = 0.31 - this.jumpY * 0.07;
    this.shootTimer = Math.max(0, this.shootTimer - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
  }

  get worldPos() {
    return new THREE.Vector3(this.pos.x, this.pos.y + this.jumpY, this.pos.z);
  }

  shoot() {
    if (this.shootTimer > 0) return false;
    this.shootTimer = 0.16;
    this.arms[1].rotation.x = -0.9;
    return true;
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    this.hurtTimer = 0.4;
  }
}

export class PedSystem {
  constructor(scene, world, count = 30) {
    this.scene = scene;
    this.world = world;
    this.count = count;
    this.peds = [];
    this.rng = mulberry32(4242);
    this.dummy = new THREE.Object3D();
    this.matrix = new THREE.Matrix4();
    this.rot = new THREE.Matrix4();
    this.rotX = new THREE.Matrix4();
    this.tmp = new THREE.Matrix4();
    this.tmp2 = new THREE.Matrix4();

    const torsoGeo = new THREE.BoxGeometry(1, 1, 1);
    const headGeo = new THREE.SphereGeometry(1, 10, 8);
    const limbGeo = new THREE.BoxGeometry(1, 1, 1);

    const torsoMat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 });
    const headMat = new THREE.MeshStandardMaterial({ roughness: 0.78 });
    const limbMat = new THREE.MeshStandardMaterial({ roughness: 0.84 });

    this.torsoMesh = new THREE.InstancedMesh(torsoGeo, torsoMat, count);
    this.headMesh = new THREE.InstancedMesh(headGeo, headMat, count);
    this.legMesh = new THREE.InstancedMesh(limbGeo, limbMat, count * 2);
    this.armMesh = new THREE.InstancedMesh(limbGeo, limbMat, count * 2);
    for (const m of [this.torsoMesh, this.headMesh, this.legMesh, this.armMesh]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
    }

    const shirts = [0xe14b5a, 0x3f8fd1, 0xe4c95a, 0x61b36b, 0xcf73ad, 0xd9d4c5, 0x7d63c9, 0x39b8b0, 0xe28a43];
    const skins = [0xe0ad82, 0xa86b45, 0x75472c, 0xf0c9a0, 0xc78c5c];
    const pantsColors = [0x272a3a, 0x3b3d4a, 0x1d2632, 0x5b4a3c, 0x2f3b2f];
    const col = new THREE.Color();

    const nearby = [[30, 90], [30, 30], [90, 90], [-30, 90], [30, 150], [90, 30]];
    for (let i = 0; i < count; i++) {
      let bx, bz, tries = 0;
      if (i < nearby.length) {
        bx = nearby[i][0];
        bz = nearby[i][1];
      } else {
        do {
          bx = (Math.floor(this.rng() * 8) - 3.5) * 60;
          bz = (Math.floor(this.rng() * 8) - 3.5) * 60;
          tries++;
        } while (tries < 10 && Math.hypot(bx - 30, bz - 90) < 26);
      }
      const edge = Math.floor(this.rng() * 4);
      const s = this.rng() * 46;
      const dir = this.rng() < 0.5 ? -1 : 1;
      const shirt = shirts[Math.floor(this.rng() * shirts.length)];
      const skin = skins[Math.floor(this.rng() * skins.length)];
      const pants = pantsColors[Math.floor(this.rng() * pantsColors.length)];
      const ped = {
        bx, bz, edge, s, dir, speed: 0.8 + this.rng() * 0.9,
        phase: this.rng() * 6.28, shirt, skin, pants,
        flee: 0, heading: 0, x: 0, z: 0, y: 0.3,
        alertCooldown: 0
      };
      this.setPerimeter(ped);
      this.peds.push(ped);
      this.torsoMesh.setColorAt(i, col.setHex(shirt));
      this.headMesh.setColorAt(i, col.setHex(skin));
      this.legMesh.setColorAt(i * 2, col.setHex(pants));
      this.legMesh.setColorAt(i * 2 + 1, col.setHex(pants));
      this.armMesh.setColorAt(i * 2, col.setHex(shirt));
      this.armMesh.setColorAt(i * 2 + 1, col.setHex(shirt));
    }
    for (const m of [this.torsoMesh, this.headMesh, this.legMesh, this.armMesh]) {
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    this.update(0, this.world, null);
  }

  setPerimeter(ped) {
    const h = 23;
    if (ped.edge === 0) { ped.x = ped.bx - h + ped.s; ped.z = ped.bz - h; ped.heading = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else if (ped.edge === 1) { ped.x = ped.bx + h; ped.z = ped.bz - h + ped.s; ped.heading = ped.dir > 0 ? 0 : Math.PI; }
    else if (ped.edge === 2) { ped.x = ped.bx + h - ped.s; ped.z = ped.bz + h; ped.heading = ped.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
    else { ped.x = ped.bx - h; ped.z = ped.bz + h - ped.s; ped.heading = ped.dir > 0 ? Math.PI : 0; }
  }

  alert(x, z, radius = 28) {
    for (const ped of this.peds) {
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < radius) {
        ped.flee = 3.2 + this.rng() * 2.4;
        const a = Math.atan2(ped.x - x, ped.z - z);
        ped.fleeDir = a;
      }
    }
  }

  update(dt, world, playerPos) {
    const m = this.matrix;
    const rot = this.rot;
    const rx = this.rotX;
    const tmp = this.tmp;
    for (let i = 0; i < this.peds.length; i++) {
      const p = this.peds[i];
      p.alertCooldown = Math.max(0, p.alertCooldown - dt);
      if (p.flee > 0) {
        p.flee -= dt;
        const spd = 4.1;
        const nx = p.x + Math.sin(p.fleeDir) * spd * dt;
        const nz = p.z + Math.cos(p.fleeDir) * spd * dt;
        if (!world.isSolid(nx, nz, 0.35)) { p.x = nx; p.z = nz; }
        else p.fleeDir += 1.4;
        p.heading = p.fleeDir;
        p.phase += dt * 14;
        p.y = world.groundHeight(p.x, p.z);
      } else {
        const step = p.speed * dt * p.dir;
        p.s += step;
        if (p.s > 46) { p.s = 46; p.dir = -1; p.edge = (p.edge + 1) % 4; }
        if (p.s < 0) { p.s = 0; p.dir = 1; p.edge = (p.edge + 1) % 4; }
        this.setPerimeter(p);
        p.y = 0.3;
        p.phase += dt * (4.5 + p.speed * 1.2);
      }
      const ground = p.y;
      const swing = p.flee > 0 ? Math.sin(p.phase) * 0.85 : Math.sin(p.phase) * 0.55;
      m.makeTranslation(p.x, ground, p.z);
      rot.makeRotationY(p.heading);
      m.multiply(rot);
      // torso
      tmp.copy(m).multiply(new THREE.Matrix4().makeTranslation(0, 1.12, 0));
      tmp.multiply(new THREE.Matrix4().makeScale(0.5, 0.62, 0.3));
      this.torsoMesh.setMatrixAt(i, tmp);
      // head
      tmp.copy(m).multiply(new THREE.Matrix4().makeTranslation(0, 1.58, 0));
      tmp.multiply(new THREE.Matrix4().makeScale(0.18, 0.21, 0.18));
      this.headMesh.setMatrixAt(i, tmp);
      for (let l = 0; l < 2; l++) {
        const side = l === 0 ? -1 : 1;
        const ang = swing * (l === 0 ? 1 : -1);
        tmp.copy(m)
          .multiply(new THREE.Matrix4().makeTranslation(side * 0.14, 0.88, 0))
          .multiply(rx.makeRotationX(ang))
          .multiply(new THREE.Matrix4().makeTranslation(0, -0.37, 0))
          .multiply(new THREE.Matrix4().makeScale(0.17, 0.74, 0.19));
        this.legMesh.setMatrixAt(i * 2 + l, tmp);
      }
      for (let a = 0; a < 2; a++) {
        const side = a === 0 ? -1 : 1;
        const ang = -swing * (a === 0 ? 1 : -1) * 0.72;
        tmp.copy(m)
          .multiply(new THREE.Matrix4().makeTranslation(side * 0.33, 1.42, 0))
          .multiply(rx.makeRotationX(ang))
          .multiply(new THREE.Matrix4().makeTranslation(0, -0.3, 0))
          .multiply(new THREE.Matrix4().makeScale(0.13, 0.6, 0.15));
        this.armMesh.setMatrixAt(i * 2 + a, tmp);
      }
    }
    for (const mesh of [this.torsoMesh, this.headMesh, this.legMesh, this.armMesh]) {
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  hitTest(origin, dir, maxDist = 80) {
    let best = null;
    let bestT = maxDist;
    const vx = new THREE.Vector3();
    for (const ped of this.peds) {
      vx.set(ped.x - origin.x, ped.y + 1.05 - origin.y, ped.z - origin.z);
      const t = vx.dot(dir);
      if (t < 1 || t > bestT) continue;
      const d2 = vx.lengthSq() - t * t;
      if (d2 < 0.42 * 0.42) {
        best = ped;
        bestT = t;
      }
    }
    return best ? { ped: best, distance: bestT } : null;
  }
}

export class TrafficCar extends Car {
  constructor(scene, world, options = {}) {
    super(scene, { ...options, color: options.color ?? 0x9aa0ad });
    this.world = world;
    this.aiSpeed = options.aiSpeed || (8 + Math.random() * 5);
    this.target = new THREE.Vector3();
    this.prevNode = null;
    this.direction = new THREE.Vector2(0, 1);
    this.repath = 0;
    this.stuckTimer = 0;
    this.chooseInitial(options.x, options.z, options.heading);
  }

  chooseInitial(x, z, heading) {
    const nodeX = Math.round(x / 60) * 60;
    const nodeZ = Math.round(z / 60) * 60;
    this.pos.set(x, 0.04, z);
    this.heading = heading ?? 0;
    this.group.rotation.y = this.heading;
    this.prevNode = new THREE.Vector2(nodeX, nodeZ);
    this.chooseNextNode();
  }

  chooseNextNode() {
    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1]
    ];
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const backX = -fx, backZ = -fz;
    const options = dirs.filter((d) => {
      if (Math.abs(d[0] - backX) < 0.2 && Math.abs(d[1] - backZ) < 0.2) return false;
      const nx = this.prevNode.x + d[0] * 60;
      const nz = this.prevNode.y + d[1] * 60;
      return Math.abs(nx) <= 240 && Math.abs(nz) <= 240;
    });
    const choice = options.length ? options[Math.floor(Math.random() * options.length)] : [0, 1];
    const nx = this.prevNode.x + choice[0] * 60;
    const nz = this.prevNode.y + choice[1] * 60;
    const lane = 2.4;
    const rightX = -choice[1];
    const rightZ = choice[0];
    this.target.set(nx + rightX * lane, 0.04, nz + rightZ * lane);
    this.direction.set(choice[0], choice[1]);
    this.prevNode = this.prevNode.clone().set(nx, nz);
  }

  updateAI(dt, cars, playerCar) {
    const dx = this.target.x - this.pos.x;
    const dz = this.target.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 5) this.chooseNextNode();
    const desired = Math.atan2(dx, dz);
    const diff = shortestAngle(this.heading, desired);
    const steer = clamp(diff * 2.5, -1, 1);
    let throttle = 1;
    let brake = false;
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    for (const other of cars) {
      if (other === this) continue;
      const ox = other.pos.x - this.pos.x;
      const oz = other.pos.z - this.pos.z;
      const ahead = ox * fx + oz * fz;
      const side = Math.abs(ox * fz - oz * fx);
      if (ahead > 0 && ahead < 10 && side < 2.4) {
        brake = true;
        throttle = 0;
        break;
      }
    }
    if (playerCar && playerCar !== this) {
      const ox = playerCar.pos.x - this.pos.x;
      const oz = playerCar.pos.z - this.pos.z;
      const ahead = ox * fx + oz * fz;
      const side = Math.abs(ox * fz - oz * fx);
      if (ahead > 0 && ahead < 12 && side < 3.2) { brake = true; throttle = 0; }
    }
    const targetSpeed = this.aiSpeed;
    if (!brake && this.speed > targetSpeed) throttle = -0.2;
    this.physicalUpdate(dt, this.world, throttle, steer, brake);
    if (this.speed < 0.4) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 2.5) {
        this.stuckTimer = 0;
        this.chooseNextNode();
      }
    } else {
      this.stuckTimer = 0;
    }
  }
}

export class CopCar extends Car {
  constructor(scene, world, x, z, heat = 1) {
    super(scene, { color: 0xf1ede4, police: true, maxSpeed: 30 + heat * 2.2 });
    this.world = world;
    this.heat = heat;
    this.pos.set(x, 0.04, z);
    this.heading = Math.atan2(-x, -z);
    this.group.rotation.y = this.heading;
    this.stuck = 0;
  }

  updateAI(dt, targetX, targetZ) {
    const dx = targetX - this.pos.x;
    const dz = targetZ - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const desired = Math.atan2(dx, dz);
    const diff = shortestAngle(this.heading, desired);
    const steer = clamp(diff * 2.3, -1, 1);
    let throttle = dist > 8 ? 1 : 0.4;
    let brake = false;
    if (dist < 7 && Math.abs(this.speed) > 10) { brake = true; throttle = 0; }
    this.physicalUpdate(dt, this.world, throttle, steer, brake);
    if (Math.abs(this.speed) < 0.6) {
      this.stuck += dt;
      if (this.stuck > 1.6) {
        this.heading += (Math.random() - 0.5) * 1.6;
        this.stuck = 0;
      }
    } else this.stuck = 0;
  }
}
