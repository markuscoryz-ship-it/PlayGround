import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { glowTexture } from './textures.js'

const skin = new THREE.MeshStandardMaterial({ color: 0xb87955, roughness: 0.72, metalness: 0.02 })
const jacket = new THREE.MeshStandardMaterial({ color: 0x1c2432, roughness: 0.55, metalness: 0.12 })
const jacketAccent = new THREE.MeshStandardMaterial({ color: 0xff3d7f, roughness: 0.4, metalness: 0.2 })
const shirt = new THREE.MeshStandardMaterial({ color: 0xe8e1cf, roughness: 0.8 })
const jeans = new THREE.MeshStandardMaterial({ color: 0x222b42, roughness: 0.8 })
const shoes = new THREE.MeshStandardMaterial({ color: 0xe9e9e4, roughness: 0.6 })
const hair = new THREE.MeshStandardMaterial({ color: 0x17110e, roughness: 0.82 })
const glasses = new THREE.MeshStandardMaterial({ color: 0x05070c, roughness: 0.14, metalness: 0.85 })
const gunMat = new THREE.MeshStandardMaterial({ color: 0x252932, roughness: 0.34, metalness: 0.8 })
const muzzleTex = glowTexture('rgba(255,245,190,1)', 'rgba(255,120,20,0)')

function limb(radius, length, mat) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 8), mat)
  mesh.castShadow = true
  return mesh
}

export function createPlayer() {
  const group = new THREE.Group()
  const rig = new THREE.Group()
  group.add(rig)

  const torso = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.66, 0.34, 4, 0.1), jacket)
  torso.position.y = 1.16
  torso.castShadow = true
  rig.add(torso)

  const tee = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.42, 0.02), shirt)
  tee.position.set(0, 1.18, 0.18)
  rig.add(tee)

  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.2), jacketAccent)
  collar.position.set(0, 1.45, 0.12)
  rig.add(collar)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), skin)
  head.position.y = 1.65
  head.scale.set(0.92, 1.05, 0.95)
  head.castShadow = true
  rig.add(head)

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.187, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.54), hair)
  cap.position.y = 1.68
  cap.scale.set(0.95, 1.08, 0.98)
  rig.add(cap)

  const shade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.075, 0.05), glasses)
  shade.position.set(0, 1.67, 0.17)
  rig.add(shade)

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.12, 8), skin)
  neck.position.y = 1.51
  rig.add(neck)

  const leftArm = new THREE.Group()
  const rightArm = new THREE.Group()
  const upperL = limb(0.075, 0.3, jacket)
  upperL.position.y = -0.18
  const lowerL = limb(0.064, 0.28, jacket)
  lowerL.position.y = -0.5
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.072, 8, 6), skin)
  handL.position.y = -0.68
  leftArm.add(upperL, lowerL, handL)
  leftArm.position.set(-0.37, 1.41, 0)

  const upperR = limb(0.075, 0.3, jacket)
  upperR.position.y = -0.18
  const lowerR = limb(0.064, 0.28, jacket)
  lowerR.position.y = -0.5
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.072, 8, 6), skin)
  handR.position.y = -0.68
  rightArm.add(upperR, lowerR, handR)
  rightArm.position.set(0.37, 1.41, 0)
  rig.add(leftArm, rightArm)

  const legL = new THREE.Group()
  const legR = new THREE.Group()
  const thighL = limb(0.1, 0.34, jeans)
  thighL.position.y = -0.22
  const shinL = limb(0.082, 0.34, jeans)
  shinL.position.y = -0.59
  const shoeL = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.12, 0.3, 3, 0.05), shoes)
  shoeL.position.set(0, -0.83, 0.06)
  legL.add(thighL, shinL, shoeL)
  legL.position.set(-0.16, 0.89, 0)

  const thighR = limb(0.1, 0.34, jeans)
  thighR.position.y = -0.22
  const shinR = limb(0.082, 0.34, jeans)
  shinR.position.y = -0.59
  const shoeR = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.12, 0.3, 3, 0.05), shoes)
  shoeR.position.set(0, -0.83, 0.06)
  legR.add(thighR, shinR, shoeR)
  legR.position.set(0.16, 0.89, 0)
  rig.add(legL, legR)

  const gun = new THREE.Group()
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.36), gunMat)
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 8), gunMat)
  barrel.rotation.x = Math.PI / 2
  barrel.position.z = 0.28
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.09), gunMat)
  mag.position.set(0, -0.1, 0.02)
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.16), gunMat)
  stock.position.z = -0.22
  gun.add(receiver, barrel, mag, stock)
  gun.position.set(0.26, 1.12, 0.34)
  gun.rotation.x = -0.06
  rig.add(gun)

  const muzzle = new THREE.Sprite(new THREE.SpriteMaterial({ map: muzzleTex, color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }))
  muzzle.position.set(0, 0, 0.43)
  muzzle.scale.set(0.52, 0.52, 1)
  gun.add(muzzle)

  group.userData = { rig, leftArm, rightArm, legL, legR, gun, muzzle, head, torso }
  group.traverse(o => { if (o.isMesh) o.castShadow = true })
  return group
}

export function animatePlayer(player, time, moveSpeed, aiming = false, airborne = false) {
  const u = player.userData
  const moving = Math.abs(moveSpeed) > 0.15
  const rate = Math.min(11, 4.5 + Math.abs(moveSpeed) * 0.55)
  const swing = moving ? Math.sin(time * rate) * Math.min(0.72, 0.18 + Math.abs(moveSpeed) * 0.06) : 0
  u.legL.rotation.x = swing
  u.legR.rotation.x = -swing
  u.leftArm.rotation.x = -swing * 0.8
  u.rightArm.rotation.x = aiming ? -1.15 : swing * 0.55
  u.rightArm.rotation.z = aiming ? 0.12 : 0
  u.gun.visible = aiming
  u.rig.position.y = moving && !airborne ? Math.abs(Math.sin(time * rate)) * 0.035 : 0
  u.rig.rotation.z = moving ? Math.sin(time * rate) * 0.018 : 0
  if (airborne) {
    u.legL.rotation.x = -0.28
    u.legR.rotation.x = 0.34
    u.leftArm.rotation.x = -0.6
    u.rightArm.rotation.x = -0.4
  }
}

export function flashMuzzle(player, time) {
  const muzzle = player.userData.muzzle
  muzzle.material.opacity = 1
  muzzle.material.rotation = Math.random() * Math.PI
  const s = 0.34 + Math.random() * 0.3
  muzzle.scale.set(s, s, 1)
  clearTimeout(muzzle.userData.timer)
  muzzle.userData.timer = setTimeout(() => { muzzle.material.opacity = 0 }, 55)
}
