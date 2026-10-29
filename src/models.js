import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { makeShadowTexture, makeGlowTexture } from './textures.js'

const shadowTexture = makeShadowTexture()
const glowTexture = makeGlowTexture()

export function createShadowBlob(width, depth, opacity = 0.85) {
  const material = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.025
  mesh.renderOrder = 1
  return mesh
}

export function createCar({ color = 0xff2d87, accent = 0x39f5ff, type = 'sedan' } = {}) {
  const group = new THREE.Group()
  group.name = 'car'

  const spec = type === 'sports'
    ? { w: 1.98, l: 4.35, bodyH: 0.48, cabinW: 1.62, cabinL: 1.72, cabinH: 0.46, cabinZ: -0.18, wheelR: 0.39 }
    : type === 'taxi'
      ? { w: 2.02, l: 4.55, bodyH: 0.5, cabinW: 1.72, cabinL: 1.95, cabinH: 0.52, cabinZ: -0.22, wheelR: 0.4 }
      : { w: 2.0, l: 4.5, bodyH: 0.5, cabinW: 1.7, cabinL: 1.9, cabinH: 0.52, cabinZ: -0.2, wheelR: 0.4 }

  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.72, roughness: 0.3 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x101018, metalness: 0.55, roughness: 0.5 })
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a1626, metalness: 0.95, roughness: 0.12 })
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc8d4e6, metalness: 1, roughness: 0.22 })
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0a0a0d, roughness: 0.95 })
  const headlight = new THREE.MeshBasicMaterial({ color: 0xfff3d6, toneMapped: false })
  const taillight = new THREE.MeshBasicMaterial({ color: 0xff2444, toneMapped: false })

  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.w, spec.bodyH, spec.l), paint)
  body.position.y = 0.38 + spec.bodyH / 2
  group.add(body)

  const lower = new THREE.Mesh(new THREE.BoxGeometry(spec.w + 0.09, 0.16, spec.l + 0.1), dark)
  lower.position.y = 0.3
  group.add(lower)

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(spec.cabinW, spec.cabinH, spec.cabinL), glass)
  cabin.position.set(0, 0.38 + spec.bodyH + spec.cabinH / 2 - 0.02, spec.cabinZ)
  group.add(cabin)

  const roof = new THREE.Mesh(new THREE.BoxGeometry(spec.cabinW + 0.03, 0.07, spec.cabinL * 0.86), paint)
  roof.position.set(0, 0.38 + spec.bodyH + spec.cabinH + 0.015, spec.cabinZ - 0.02)
  group.add(roof)

  const hood = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.9, 0.09, spec.l * 0.24), paint)
  hood.position.set(0, 0.38 + spec.bodyH + 0.02, spec.l * 0.29)
  group.add(hood)

  const bumperFront = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.94, 0.13, 0.14), chrome)
  bumperFront.position.set(0, 0.41, spec.l / 2 + 0.03)
  group.add(bumperFront)
  const bumperRear = bumperFront.clone()
  bumperRear.position.z = -spec.l / 2 - 0.03
  group.add(bumperRear)

  const wheels = []
  const wheelGeometry = new THREE.CylinderGeometry(spec.wheelR, spec.wheelR, 0.31, 14)
  const rimGeometry = new THREE.CylinderGeometry(spec.wheelR * 0.54, spec.wheelR * 0.54, 0.33, 10)
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      const wheelPivot = new THREE.Group()
      wheelPivot.position.set(x * (spec.w / 2 - 0.06), spec.wheelR, z * spec.l * 0.3)
      const tyre = new THREE.Mesh(wheelGeometry, rubber)
      tyre.rotation.z = Math.PI / 2
      wheelPivot.add(tyre)
      const rim = new THREE.Mesh(rimGeometry, chrome)
      rim.rotation.z = Math.PI / 2
      wheelPivot.add(rim)
      group.add(wheelPivot)
      wheels.push(wheelPivot)
    }
  }

  for (const x of [-1, 1]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), headlight)
    light.position.set(x * spec.w * 0.31, 0.64, spec.l / 2 + 0.08)
    group.add(light)
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.13, 0.06), taillight)
    tail.position.set(x * spec.w * 0.32, 0.66, -spec.l / 2 - 0.08)
    group.add(tail)
  }

  const glowMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xffe2ae,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  })
  for (const x of [-1, 1]) {
    const sprite = new THREE.Sprite(glowMaterial)
    sprite.position.set(x * spec.w * 0.31, 0.64, spec.l / 2 + 0.16)
    sprite.scale.set(1.15, 0.72, 1)
    group.add(sprite)
  }

  if (type === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.2, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xffd166, toneMapped: false })
    )
    sign.position.set(0, 0.38 + spec.bodyH + spec.cabinH + 0.16, spec.cabinZ)
    group.add(sign)
  }

  if (type === 'sports') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.3), dark)
    spoiler.position.set(0, 0.86, -spec.l * 0.46)
    group.add(spoiler)
    for (const x of [-0.6, 0.6]) {
      const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.07), dark)
      stalk.position.set(x, 0.74, -spec.l * 0.46)
      group.add(stalk)
    }
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, spec.l * 0.7), new THREE.MeshBasicMaterial({ color: accent, toneMapped: false }))
    stripe.position.set(0, 0.38 + spec.bodyH + 0.09, -0.05)
    group.add(stripe)
  }

  const shadow = createShadowBlob(spec.w * 1.5, spec.l * 1.2, 0.8)
  shadow.position.y = 0.02
  group.add(shadow)

  group.userData = { wheels, spec, type, color }
  return group
}

export function createPoliceCar() {
  const group = createCar({ color: 0x161622, accent: 0xffffff, type: 'sedan' })
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e4f4, metalness: 0.2, roughness: 0.55 })
  for (const side of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 2.4), white)
    stripe.position.set(side * 1.015, 0.66, -0.15)
    group.add(stripe)
  }
  const barGroup = new THREE.Group()
  barGroup.position.set(0, 1.52, -0.15)
  const redMaterial = new THREE.MeshBasicMaterial({ color: 0xff1f4f, toneMapped: false })
  const blueMaterial = new THREE.MeshBasicMaterial({ color: 0x1f7bff, toneMapped: false })
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.13, 0.24), redMaterial)
  red.position.x = -0.42
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.13, 0.24), blueMaterial)
  blue.position.x = 0.42
  barGroup.add(red, blue)
  const redGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, color: 0xff1f4f, transparent: true, opacity: 0.8,
    depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
  }))
  redGlow.position.set(-0.42, 0, 0)
  redGlow.scale.set(1.8, 1.8, 1)
  const blueGlow = redGlow.clone()
  blueGlow.material = redGlow.material.clone()
  blueGlow.material.color.setHex(0x1f7bff)
  blueGlow.position.x = 0.42
  barGroup.add(redGlow, blueGlow)
  group.add(barGroup)
  group.userData.policeLights = { red, blue, redGlow, blueGlow }
  return group
}

export function animatePoliceLights(car, time) {
  const lights = car.userData?.policeLights
  if (!lights) return
  const phase = Math.floor(time * 7) % 2
  lights.red.visible = phase === 0
  lights.blue.visible = phase === 1
  lights.redGlow.visible = phase === 0
  lights.blueGlow.visible = phase === 1
}

export function animateCar(car, speed) {
  const wheels = car.userData?.wheels
  if (!wheels) return
  for (const wheel of wheels) wheel.rotation.x -= speed * 0.07
}

export function createCharacter({ jacket = 0xff2d87, pants = 0x1d2436, skin = 0xc98d6b, hair = 0x17111c } = {}) {
  const group = new THREE.Group()
  group.name = 'character'

  const jacketMat = new THREE.MeshStandardMaterial({ color: jacket, roughness: 0.66, metalness: 0.08 })
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.84 })
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.72 })
  const hairMat = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.9 })
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x0c0d12, roughness: 0.7 })

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.68, 0.34), jacketMat)
  torso.position.y = 1.06
  group.add(torso)

  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: 0xf1e9ff, roughness: 0.5 }))
  collar.position.y = 1.42
  group.add(collar)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.205, 12, 10), skinMat)
  head.position.y = 1.58
  group.add(head)

  const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.212, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.54), hairMat)
  hairMesh.position.y = 1.6
  group.add(hairMesh)

  const arms = []
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group()
    pivot.position.set(side * 0.38, 1.28, 0)
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.58, 0.19), jacketMat)
    arm.position.y = -0.27
    pivot.add(arm)
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), skinMat)
    hand.position.y = -0.58
    pivot.add(hand)
    group.add(pivot)
    arms.push(pivot)
  }

  const legs = []
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group()
    pivot.position.set(side * 0.17, 0.73, 0)
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.7, 0.25), pantsMat)
    leg.position.y = -0.35
    pivot.add(leg)
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, 0.4), shoeMat)
    shoe.position.set(0, -0.69, 0.07)
    pivot.add(shoe)
    group.add(pivot)
    legs.push(pivot)
  }

  const shadow = createShadowBlob(1.05, 1.05, 0.8)
  group.add(shadow)

  group.userData = {
    torso,
    head,
    arms,
    legs,
    jacketMat,
    pantsMat,
    phase: Math.random() * Math.PI * 2
  }
  return group
}

export function animateCharacter(character, speed, dt, running = false) {
  const data = character.userData
  if (!data) return
  const amount = Math.min(1, speed / 3.6)
  data.phase += dt * (running ? 12 : 8) * Math.max(0.3, amount)
  const swing = Math.sin(data.phase) * (running ? 0.82 : 0.55) * amount
  data.legs[0].rotation.x = swing
  data.legs[1].rotation.x = -swing
  data.arms[0].rotation.x = -swing * 0.8
  data.arms[1].rotation.x = swing * 0.8
  data.torso.position.y = 1.06 + Math.abs(Math.sin(data.phase)) * 0.035 * amount
  data.head.position.y = 1.58 + Math.abs(Math.sin(data.phase)) * 0.028 * amount
  data.arms[0].rotation.z = 0.06
  data.arms[1].rotation.z = -0.06
}

const palmLeafGeometry = (() => {
  const leaves = []
  for (let i = 0; i < 8; i++) {
    const geo = new THREE.ConeGeometry(0.26, 3.1, 5, 1, true)
    geo.translate(0, 1.55, 0)
    const matrix = new THREE.Matrix4()
    const rotZ = new THREE.Matrix4().makeRotationZ(0.85 + (i % 2) * 0.12)
    const rotY = new THREE.Matrix4().makeRotationY((i / 8) * Math.PI * 2)
    matrix.multiply(rotY).multiply(rotZ)
    matrix.setPosition(0, 4.5, 0)
    geo.applyMatrix4(matrix)
    leaves.push(geo)
  }
  return mergeGeometries(leaves, false)
})()

const palmTrunkGeometry = new THREE.CylinderGeometry(0.16, 0.29, 4.7, 7)
palmTrunkGeometry.translate(0, 2.35, 0)

export function createPalm() {
  const group = new THREE.Group()
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d3d2c, roughness: 0.95 })
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x1d6b4c, roughness: 0.82, side: THREE.DoubleSide })
  const trunk = new THREE.Mesh(palmTrunkGeometry, trunkMat)
  const leaves = new THREE.Mesh(palmLeafGeometry, leafMat)
  group.add(trunk, leaves)
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), trunkMat)
  crown.position.y = 4.55
  group.add(crown)
  const shadow = createShadowBlob(3.2, 3.2, 0.6)
  shadow.rotation.z = 0
  group.add(shadow)
  group.userData = { leaves, phase: Math.random() * Math.PI * 2 }
  return group
}

export function createStreetLight() {
  const group = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color: 0x24222c, metalness: 0.8, roughness: 0.4 })
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 6.2, 7), metal)
  pole.position.y = 3.1
  group.add(pole)
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.09, 0.09), metal)
  arm.position.set(0.66, 6.1, 0)
  group.add(arm)
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.26), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }))
  lamp.position.set(1.3, 6.03, 0)
  group.add(lamp)
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xffc98a,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  }))
  glow.position.set(1.3, 6.02, 0)
  glow.scale.set(2.4, 2.4, 1)
  group.add(glow)
  return group
}

export function createMarker() {
  const group = new THREE.Group()
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x39f5ff,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  })
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.65, 36), ringMat)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.12
  group.add(ring)

  const inner = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.95, 24), ringMat.clone())
  inner.rotation.x = -Math.PI / 2
  inner.position.y = 0.13
  group.add(inner)

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.9, 18, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x39f5ff,
      transparent: true,
      opacity: 0.17,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    })
  )
  beam.position.y = 9
  group.add(beam)

  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.85, 2.1, 4),
    new THREE.MeshBasicMaterial({ color: 0x9ffcff, toneMapped: false })
  )
  arrow.rotation.x = Math.PI
  arrow.position.y = 5.4
  group.add(arrow)

  group.userData = { ring, inner, beam, arrow, time: 0 }
  return group
}

export function createFountain() {
  const group = new THREE.Group()
  const stone = new THREE.MeshStandardMaterial({ color: 0x8a8296, roughness: 0.8 })
  const water = new THREE.MeshStandardMaterial({ color: 0x2ab4d1, metalness: 0.35, roughness: 0.18, emissive: 0x0a3b4c })
  const base = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, 0.6, 24), stone)
  base.position.y = 0.3
  group.add(base)
  const pool = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.18, 24), water)
  pool.position.y = 0.62
  group.add(pool)
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.9, 3.4, 12), stone)
  column.position.y = 1.9
  group.add(column)
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 0.7, 0.5, 16), stone)
  bowl.position.y = 3.4
  group.add(bowl)
  const topWater = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.65, 0.12, 16), water)
  topWater.position.y = 3.66
  group.add(topWater)
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0x5ce8ff,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  }))
  glow.position.y = 2.2
  glow.scale.set(8, 8, 1)
  group.add(glow)
  return group
}

export function makeBuildingGeometry(w, h, d) {
  const geometry = new THREE.BoxGeometry(w, h, d)
  const uv = geometry.attributes.uv
  const dims = [
    [d, h], [d, h],
    [w, d], [w, d],
    [w, h], [w, h]
  ]
  for (const group of geometry.groups) {
    const dim = dims[group.materialIndex] || [w, h]
    const repeatU = Math.max(1, Math.round(dim[0] / 7.5))
    const repeatV = Math.max(1, Math.round(dim[1] / 7.5))
    for (let i = group.start; i < group.start + group.count; i++) {
      uv.setXY(i, uv.getX(i) * repeatU, uv.getY(i) * repeatV)
    }
  }
  uv.needsUpdate = true
  return geometry
}
