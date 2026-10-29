import * as THREE from 'three';
import { QUALITY } from './config.js';
import { scene } from './engine.js';
import { material } from './materials.js';
import { terrainHeight } from './world.js';

function shadowed(mesh, cast = true) {
  mesh.castShadow = QUALITY === 'high' && cast;
  mesh.receiveShadow = QUALITY === 'high';
  return mesh;
}

export function createPlayer() {
  const root = new THREE.Group();
  root.name = 'player';
  const body = new THREE.Group();
  root.add(body);

  const jacket = new THREE.MeshLambertMaterial({ color: 0x4b523d, flatShading: true });
  const jacketDark = new THREE.MeshLambertMaterial({ color: 0x343a2d, flatShading: true });
  const pants = new THREE.MeshLambertMaterial({ color: 0x3e4437, flatShading: true });
  const skin = new THREE.MeshLambertMaterial({ color: 0xaa8363, flatShading: true });
  const boot = new THREE.MeshLambertMaterial({ color: 0x24251f, flatShading: true });
  const pack = new THREE.MeshLambertMaterial({ color: 0x645640, flatShading: true });
  const gunmetal = new THREE.MeshLambertMaterial({ color: 0x262923, flatShading: true });

  const torso = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), jacket));
  torso.position.y = 1.22;
  body.add(torso);

  const chestRig = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.27, 0.43), jacketDark));
  chestRig.position.y = 1.21;
  body.add(chestRig);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.1, 0.34), boot);
  belt.position.y = 0.87;
  body.add(belt);

  const pelvis = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.28, 0.33), pants));
  pelvis.position.y = 0.81;
  body.add(pelvis);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.12, 6), skin);
  neck.position.y = 1.62;
  body.add(neck);

  const head = new THREE.Group();
  head.position.y = 1.79;
  body.add(head);
  const skull = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(0.235, 1), skin));
  head.add(skull);
  const beanie = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.27, 0.2, 6), jacketDark));
  beanie.position.y = 0.11;
  head.add(beanie);
  const beanieTop = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), jacketDark);
  beanieTop.position.y = 0.23;
  head.add(beanieTop);
  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.12, 0.07), gunmetal);
  mask.position.set(0, -0.035, 0.2);
  head.add(mask);
  const eyeGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.025, 0.02),
    new THREE.MeshBasicMaterial({ color: 0xd1b06a }),
  );
  eyeGlow.position.set(0, 0.035, 0.235);
  head.add(eyeGlow);

  const backpack = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.56, 0.25), pack));
  backpack.position.set(0, 1.25, -0.31);
  body.add(backpack);
  const packRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.54, 6), jacketDark);
  packRoll.rotation.z = Math.PI / 2;
  packRoll.position.set(0, 1.58, -0.34);
  body.add(packRoll);
  const packPouch = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.12), jacketDark);
  packPouch.position.set(0.12, 1.1, -0.45);
  body.add(packPouch);

  const shoulderL = new THREE.Group();
  shoulderL.position.set(-0.4, 1.52, 0);
  body.add(shoulderL);
  const upperArmL = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.62, 0.19), jacket));
  upperArmL.position.y = -0.29;
  shoulderL.add(upperArmL);
  const gloveL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.18), boot);
  gloveL.position.y = -0.64;
  shoulderL.add(gloveL);

  const shoulderR = new THREE.Group();
  shoulderR.position.set(0.4, 1.52, 0);
  body.add(shoulderR);
  const upperArmR = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.62, 0.19), jacket));
  upperArmR.position.y = -0.29;
  shoulderR.add(upperArmR);
  const gloveR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.18), boot);
  gloveR.position.y = -0.64;
  shoulderR.add(gloveR);

  const hipL = new THREE.Group();
  hipL.position.set(-0.17, 0.72, 0);
  body.add(hipL);
  const legL = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.72, 0.25), pants));
  legL.position.y = -0.35;
  hipL.add(legL);
  const bootL = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.18, 0.34), boot), false);
  bootL.position.set(0, -0.77, 0.05);
  hipL.add(bootL);

  const hipR = new THREE.Group();
  hipR.position.set(0.17, 0.72, 0);
  body.add(hipR);
  const legR = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.72, 0.25), pants));
  legR.position.y = -0.35;
  hipR.add(legR);
  const bootR = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.18, 0.34), boot), false);
  bootR.position.set(0, -0.77, 0.05);
  hipR.add(bootR);

  const slungRifle = new THREE.Group();
  slungRifle.position.set(-0.06, 1.33, -0.45);
  slungRifle.rotation.z = 0.52;
  const rifleBody = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.12, 0.1), material.wood), false);
  slungRifle.add(rifleBody);
  const rifleBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.62, 5), gunmetal);
  rifleBarrel.position.y = 0.77;
  slungRifle.add(rifleBarrel);
  body.add(slungRifle);

  const weaponPistol = new THREE.Group();
  weaponPistol.position.set(0.35, 1.17, 0.3);
  const pistolBody = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.42), gunmetal), false);
  pistolBody.position.z = 0.12;
  weaponPistol.add(pistolBody);
  const pistolGrip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.25, 0.11), gunmetal);
  pistolGrip.position.set(0, -0.15, -0.03);
  pistolGrip.rotation.x = -0.2;
  weaponPistol.add(pistolGrip);
  const pistolBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 5), gunmetal);
  pistolBarrel.rotation.x = Math.PI / 2;
  pistolBarrel.position.set(0, 0.03, 0.37);
  weaponPistol.add(pistolBarrel);
  body.add(weaponPistol);

  const weaponRifle = new THREE.Group();
  weaponRifle.position.set(0.33, 1.1, 0.28);
  weaponRifle.visible = false;
  const rifleStock = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.5), material.wood), false);
  rifleStock.position.z = -0.12;
  weaponRifle.add(rifleStock);
  const rifleReceiver = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 0.78), gunmetal), false);
  rifleReceiver.position.z = 0.35;
  weaponRifle.add(rifleReceiver);
  const rifleLongBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.78, 5), gunmetal);
  rifleLongBarrel.rotation.x = Math.PI / 2;
  rifleLongBarrel.position.set(0, 0.035, 1.08);
  weaponRifle.add(rifleLongBarrel);
  const rifleScope = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 6), gunmetal);
  rifleScope.rotation.x = Math.PI / 2;
  rifleScope.position.set(0, 0.115, 0.3);
  weaponRifle.add(rifleScope);
  body.add(weaponRifle);

  const muzzleFlash = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.36, 5),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, depthWrite: false }),
  );
  muzzleFlash.rotation.x = Math.PI / 2;
  muzzleFlash.position.set(0.35, 1.22, 0.77);
  muzzleFlash.visible = false;
  body.add(muzzleFlash);

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.58, 16), material.shadow.clone());
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  shadow.scale.z = 1.25;
  root.add(shadow);

  const spawnX = -2.5;
  const spawnZ = 27;
  root.position.set(spawnX, terrainHeight(spawnX, spawnZ), spawnZ);
  root.rotation.y = Math.PI;
  scene.add(root);

  return {
    root,
    body,
    head,
    torso,
    armL: shoulderL,
    armR: shoulderR,
    legL: hipL,
    legR: hipR,
    weaponPistol,
    weaponRifle,
    slungRifle,
    muzzleFlash,
    shadow,
  };
}
