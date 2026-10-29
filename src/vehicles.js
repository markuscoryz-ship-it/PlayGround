import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { glowTexture } from './textures.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const tireMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.92, metalness: 0.05 })
const rimMat = new THREE.MeshStandardMaterial({ color: 0xa8b1bb, roughness: 0.28, metalness: 0.95 })
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0x04080f, roughness: 0.12, metalness: 0.25, transmission: 0.08,
  transparent: true, opacity: 0.94, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.45
})
const darkMat = new THREE.MeshStandardMaterial({ color: 0x111116, roughness: 0.6, metalness: 0.3 })
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd9dee4, roughness: 0.18, metalness: 1 })
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff4d6, toneMapped: false })
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2038, toneMapped: false })
const reverseMat = new THREE.MeshBasicMaterial({ color: 0xf2f6ff, toneMapped: false })
const glowTex = glowTexture('rgba(255,236,196,.9)', 'rgba(255,190,90,0)')
const redGlowTex = glowTexture('rgba(255,42,70,.95)', 'rgba(255,20,50,0)')

export function setVehicleQuality(low) {
  glassMat.transmission = low ? 0 : 0.08
  glassMat.clearcoat = low ? 0 : 1
  glassMat.opacity = low ? 0.9 : 0.94
  glassMat.needsUpdate = true
}

const CAR_SPECS = {
  infernus: { length: 4.5, width: 1.98, height: 0.58, cabin: [1.5, 0.5, 1.86], wheel: 0.37, wheelZ: 1.45, color: 0xff5b24, accent: 0x1a1420, name: 'INFERNUS', sub: 'VICE EDITION', player: true },
  sedan: { length: 4.4, width: 1.9, height: 0.62, cabin: [1.56, 0.54, 1.92], wheel: 0.35, wheelZ: 1.42, color: 0x3e6b8f, accent: 0x10131c, name: 'REGINA', sub: 'SEDAN' },
  taxi: { length: 4.4, width: 1.9, height: 0.62, cabin: [1.56, 0.54, 1.92], wheel: 0.35, wheelZ: 1.42, color: 0xf2b32e, accent: 0x141018, name: 'TAXI', sub: 'VICE CAB CO.' },
  van: { length: 4.9, width: 2.02, height: 0.82, cabin: [1.7, 0.9, 2.7], wheel: 0.38, wheelZ: 1.55, color: 0xd7d5c9, accent: 0x22252a, name: 'BURRITO', sub: 'CARGO' },
  police: { length: 4.5, width: 1.94, height: 0.62, cabin: [1.56, 0.54, 1.94], wheel: 0.36, wheelZ: 1.45, color: 0xe8edf1, accent: 0x0c1018, name: 'POLICE', sub: 'VCPD' },
  sports: { length: 4.3, width: 1.94, height: 0.54, cabin: [1.44, 0.46, 1.7], wheel: 0.36, wheelZ: 1.38, color: 0x4ce6ff, accent: 0x0a1b20, name: 'CHEETAH', sub: 'CLASSIC' }
}

function plateTexture(text) {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 40
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#e8e3d4'
  ctx.fillRect(0, 0, 128, 40)
  ctx.strokeStyle = '#3b3a38'
  ctx.lineWidth = 3
  ctx.strokeRect(2, 2, 124, 36)
  ctx.fillStyle = '#1c1d24'
  ctx.font = 'bold 22px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 64, 21)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function makeWheel(radius, width, front) {
  const pivot = new THREE.Group()
  const spin = new THREE.Group()
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 18), tireMat)
  tire.rotation.z = Math.PI / 2
  tire.castShadow = true
  spin.add(tire)
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width * 1.04, 12), rimMat)
  rim.rotation.z = Math.PI / 2
  spin.add(rim)
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(width * 1.1, radius * 1.05, 0.045), darkMat)
    spoke.rotation.x = (i / 5) * Math.PI
    spin.add(spoke)
  }
  pivot.add(spin)
  pivot.userData.front = front
  pivot.userData.spin = spin
  return pivot
}

export function createCar(type = 'infernus', options = {}) {
  const spec = { ...CAR_SPECS[type], ...options }
  const group = new THREE.Group()
  const paint = spec.player
    ? new THREE.MeshPhysicalMaterial({ color: spec.color, roughness: 0.22, metalness: 0.8, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.5 })
    : new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.32, metalness: 0.72, envMapIntensity: 1.1 })
  const accent = new THREE.MeshStandardMaterial({ color: spec.accent, roughness: 0.44, metalness: 0.5 })

  const body = new THREE.Mesh(new RoundedBoxGeometry(spec.width, spec.height, spec.length, 4, 0.14), paint)
  body.position.y = spec.wheel + spec.height * 0.32
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  const lower = new THREE.Mesh(new RoundedBoxGeometry(spec.width * 1.01, 0.24, spec.length * 0.95, 3, 0.08), accent)
  lower.position.y = spec.wheel * 0.72
  lower.castShadow = true
  group.add(lower)

  const [cw, ch, cl] = spec.cabin
  const cabin = new THREE.Mesh(new RoundedBoxGeometry(cw, ch, cl, 4, 0.14), glassMat)
  cabin.position.set(0, spec.wheel + spec.height + ch * 0.36, -0.1)
  cabin.castShadow = true
  group.add(cabin)

  const roof = new THREE.Mesh(new RoundedBoxGeometry(cw * 0.9, 0.12, cl * 0.66, 3, 0.05), paint)
  roof.position.set(0, spec.wheel + spec.height + ch * 0.84, -0.17)
  roof.castShadow = true
  group.add(roof)

  const hoodStripe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.025, spec.length * 0.52), new THREE.MeshBasicMaterial({ color: spec.player ? 0xffd9a8 : 0xffffff, toneMapped: false }))
  hoodStripe.position.set(0, spec.wheel + spec.height * 0.63, spec.length * 0.18)
  if (spec.player) group.add(hoodStripe)

  const front = spec.length / 2
  const rear = -spec.length / 2
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.05), headMat)
    head.position.set(side * spec.width * 0.31, spec.wheel + spec.height * 0.48, front - 0.035)
    group.add(head)
    const headGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe4ac, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.72 }))
    headGlow.position.set(side * spec.width * 0.31, spec.wheel + spec.height * 0.48, front + 0.05)
    headGlow.scale.set(1.1, 0.65, 1)
    group.add(headGlow)
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.045), tailMat)
    tail.position.set(side * spec.width * 0.3, spec.wheel + spec.height * 0.52, rear + 0.02)
    group.add(tail)
    const tailGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: redGlowTex, color: 0xff2848, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.66 }))
    tailGlow.position.set(side * spec.width * 0.3, spec.wheel + spec.height * 0.52, rear - 0.08)
    tailGlow.scale.set(0.9, 0.55, 1)
    group.add(tailGlow)
  }

  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.18), new THREE.MeshBasicMaterial({ map: plateTexture(type === 'police' ? 'VCPD-07' : 'VICE 7'), toneMapped: false }))
  plate.position.set(0, spec.wheel + 0.02, rear - 0.02)
  plate.rotation.y = Math.PI
  group.add(plate)

  const rearPanel = new THREE.Mesh(new RoundedBoxGeometry(spec.width * 0.92, 0.34, 0.06, 2, 0.03), new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.38, metalness: 0.55 }))
  rearPanel.position.set(0, spec.wheel + spec.height * 0.56, rear + 0.035)
  group.add(rearPanel)
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.7, 0.055, 0.025), new THREE.MeshBasicMaterial({ color: 0xff1830, toneMapped: false }))
  tailBar.position.set(0, spec.wheel + spec.height * 0.56, rear + 0.075)
  group.add(tailBar)
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.82, 0.16, 0.2), accent)
  diffuser.position.set(0, spec.wheel * 0.6, rear + 0.06)
  group.add(diffuser)
  for (const side of [-1, 1]) {
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.2, 10), chromeMat)
    exhaust.rotation.x = Math.PI / 2
    exhaust.position.set(side * spec.width * 0.3, spec.wheel * 0.66, rear - 0.08)
    group.add(exhaust)
  }
  const rearWindow = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.46), glassMat)
  rearWindow.position.set(0, spec.wheel + spec.height + ch * 0.56, -0.98)
  rearWindow.rotation.x = -0.36
  group.add(rearWindow)

  if (spec.player || type === 'sports') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.92, 0.06, 0.34), accent)
    spoiler.position.set(0, spec.wheel + spec.height * 1.5, rear + 0.25)
    group.add(spoiler)
    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.28, 0.1), accent)
      strut.position.set(side * spec.width * 0.34, spec.wheel + spec.height * 1.25, rear + 0.25)
      group.add(strut)
    }
  }

  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, spec.length * 0.62), accent)
    skirt.position.set(side * spec.width * 0.51, spec.wheel * 0.62, 0)
    group.add(skirt)
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.14), accent)
    mirror.position.set(side * spec.width * 0.58, spec.wheel + spec.height + ch * 0.4, cl * 0.33)
    group.add(mirror)
  }

  const wheels = []
  for (const z of [spec.wheelZ, -spec.wheelZ]) {
    for (const x of [-spec.width * 0.48, spec.width * 0.48]) {
      const wheel = makeWheel(spec.wheel, 0.26, z > 0)
      wheel.position.set(x, spec.wheel, z)
      group.add(wheel)
      wheels.push(wheel)
    }
  }

  const underGlow = new THREE.Mesh(new THREE.PlaneGeometry(spec.width * 1.9, spec.length * 1.05), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,61,127,.4)', 'rgba(255,61,127,0)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.62 }))
  underGlow.rotation.x = -Math.PI / 2
  underGlow.position.y = 0.03
  group.add(underGlow)

  let siren = null
  if (type === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.11, 0.28), darkMat)
    bar.position.set(0, spec.wheel + spec.height + ch * 0.92, -0.1)
    group.add(bar)
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.24), new THREE.MeshBasicMaterial({ color: 0xff1b2e, toneMapped: false }))
    red.position.set(-0.27, spec.wheel + spec.height + ch * 0.99, -0.1)
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.24), new THREE.MeshBasicMaterial({ color: 0x1877ff, toneMapped: false }))
    blue.position.set(0.27, spec.wheel + spec.height + ch * 0.99, -0.1)
    group.add(red, blue)
    const rg = new THREE.Sprite(new THREE.SpriteMaterial({ map: redGlowTex, color: 0xff2038, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
    rg.position.set(-0.27, spec.wheel + spec.height + ch * 0.99, -0.1)
    rg.scale.set(1.6, 1.1, 1)
    const bg = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(40,120,255,.95)', 'rgba(20,70,255,0)'), color: 0x3d8cff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
    bg.position.set(0.27, spec.wheel + spec.height + ch * 0.99, -0.1)
    bg.scale.set(1.6, 1.1, 1)
    group.add(rg, bg)
    siren = { red: rg, blue: bg, lights: [red, blue] }
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.42), new THREE.MeshBasicMaterial({ map: (() => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 64
      const x = c.getContext('2d'); x.fillStyle = '#0b1524'; x.fillRect(0, 0, 256, 64)
      x.fillStyle = '#fff'; x.font = 'bold 34px Arial Narrow'; x.textAlign = 'center'; x.fillText('VCPD', 128, 45)
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
    })(), toneMapped: false }))
    decal.position.set(0, spec.wheel + spec.height * 0.64, spec.width * 0.51)
    decal.rotation.y = Math.PI / 2
    group.add(decal)
  }

  if (spec.player) {
    for (const side of [-1, 1]) {
      const light = new THREE.SpotLight(0xffe3b0, 26, 38, 0.38, 0.55, 1.4)
      light.position.set(side * 0.6, spec.wheel + spec.height * 0.55, front)
      const target = new THREE.Object3D()
      target.position.set(side * 1.2, 0, front + 12)
      group.add(target)
      light.target = target
      group.add(light)
    }
  }

  mergeCarMeshes(group, wheels)
  for (const wheel of wheels) bakeWheel(wheel)

  group.userData = {
    type, spec, wheels, body, cabin, siren, paint,
    headlights: group.children.filter(c => c.isSprite)
  }
  group.traverse(o => { if (o.isMesh && spec.player) { o.castShadow = true; o.receiveShadow = true } })
  return group
}

export function updateCarVisuals(car, dt, speed, steer, brake = false) {
  const u = car.userData
  const spin = speed * dt / (u.spec.wheel || 0.36)
  for (const wheel of u.wheels) {
    wheel.userData.spin.rotation.x -= spin
    if (wheel.userData.front) wheel.rotation.y = THREE.MathUtils.clamp(steer * 0.48, -0.52, 0.52)
  }
  if (u.paint) {
    u.paint.emissive = u.paint.emissive || new THREE.Color()
    u.paint.emissive.setHex(brake ? 0x220000 : 0x000000)
  }
  if (u.siren) {
    const t = performance.now() * 0.008
    const on = Math.sin(t) > 0
    u.siren.red.material.opacity = on ? 0.95 : 0.1
    u.siren.blue.material.opacity = on ? 0.1 : 0.95
    u.siren.lights[0].material.color.setHex(on ? 0xff2038 : 0x521018)
    u.siren.lights[1].material.color.setHex(on ? 0x14306e : 0x3d8cff)
  }
}


function mergeCarMeshes(group, wheels) {
  const wheelParts = new Set()
  for (const wheel of wheels) {
    wheel.traverse((o) => { if (o.isMesh) wheelParts.add(o) })
  }
  const buckets = new Map()
  group.traverse((o) => {
    if (!o.isMesh || o.isSprite || wheelParts.has(o)) return
    if (o.material && (Array.isArray(o.material) || o.material.transparent)) return
    const geo = o.geometry
    if (!geo || !geo.attributes.position) return
    const attrs = Object.keys(geo.attributes).sort().join(',')
    const key = [o.material.uuid, o.castShadow ? 1 : 0, o.receiveShadow ? 1 : 0, attrs].join('|')
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { material: o.material, cast: o.castShadow, receive: o.receiveShadow, geos: [], meshes: [] }
      buckets.set(key, bucket)
    }
    const g = geo.index ? geo.toNonIndexed() : geo.clone()
    o.updateWorldMatrix(true, false)
    g.applyMatrix4(o.matrixWorld)
    bucket.geos.push(g)
    bucket.meshes.push(o)
  })
  for (const bucket of buckets.values()) {
    if (bucket.geos.length < 2) {
      for (const g of bucket.geos) g.dispose()
      continue
    }
    const merged = mergeGeometries(bucket.geos, false)
    if (!merged) {
      for (const g of bucket.geos) g.dispose()
      continue
    }
    const mesh = new THREE.Mesh(merged, bucket.material)
    mesh.castShadow = bucket.cast
    mesh.receiveShadow = bucket.receive
    group.add(mesh)
    for (const o of bucket.meshes) if (o.parent) o.parent.remove(o)
    for (const g of bucket.geos) g.dispose()
  }
}

const wheelVertexMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.42, envMapIntensity: 0.8 })
function bakeWheel(wheel) {
  const spin = wheel.userData.spin
  const parts = []
  const remove = []
  spin.traverse((o) => {
    if (!o.isMesh) return
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
    o.updateMatrix()
    geo.applyMatrix4(o.matrix)
    const c = o.material.color || new THREE.Color(0xffffff)
    const n = geo.attributes.position.count
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
    parts.push(geo)
    remove.push(o)
  })
  if (!parts.length) return
  const merged = mergeGeometries(parts, false)
  if (!merged) return
  for (const o of remove) if (o.parent) o.parent.remove(o)
  const mesh = new THREE.Mesh(merged, wheelVertexMat)
  mesh.castShadow = true
  spin.add(mesh)
  for (const g of parts) g.dispose()
}

function colored(geometry, color, position, rotation, scale) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
  if (rotation) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2])))
  if (scale) g.scale(scale[0], scale[1], scale[2])
  if (position) g.translate(position[0], position[1], position[2])
  const c = new THREE.Color(color)
  const n = g.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return g
}

export function createTrafficCar(type = 'sedan') {
  const spec = CAR_SPECS[type] || CAR_SPECS.sedan
  const group = new THREE.Group()
  const paint = spec.color
  const accent = spec.accent
  const parts = []
  const wheelR = spec.wheel
  parts.push(colored(new RoundedBoxGeometry(spec.width, spec.height, spec.length, 2, 0.12), paint, [0, wheelR + spec.height * 0.32, 0]))
  parts.push(colored(new RoundedBoxGeometry(spec.width * 1.01, 0.22, spec.length * 0.95, 2, 0.06), accent, [0, wheelR * 0.72, 0]))
  const [cw, ch, cl] = spec.cabin
  parts.push(colored(new RoundedBoxGeometry(cw, ch, cl, 2, 0.1), paint, [0, wheelR + spec.height + ch * 0.36, -0.1]))
  parts.push(colored(new RoundedBoxGeometry(cw * 0.9, 0.1, cl * 0.62, 2, 0.04), paint, [0, wheelR + spec.height + ch * 0.84, -0.17]))
  for (const z of [spec.wheelZ, -spec.wheelZ]) {
    for (const x of [-spec.width * 0.48, spec.width * 0.48]) {
      parts.push(colored(new THREE.CylinderGeometry(wheelR, wheelR, 0.24, 10), 0x0a0a0d, [x, wheelR, z], [0, 0, Math.PI / 2]))
      parts.push(colored(new THREE.CylinderGeometry(wheelR * 0.58, wheelR * 0.58, 0.25, 8), 0x9aa3ad, [x, wheelR, z], [0, 0, Math.PI / 2]))
    }
  }
  const body = new THREE.Mesh(mergeGeometries(parts, false), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.55, envMapIntensity: 0.9 }))
  body.castShadow = true
  group.add(body)

  const glass = new THREE.Mesh(new RoundedBoxGeometry(cw * 0.97, ch * 0.9, cl * 0.94, 2, 0.08), glassMat)
  glass.position.set(0, wheelR + spec.height + ch * 0.36, -0.1)
  group.add(glass)

  const lights = []
  for (const side of [-1, 1]) {
    lights.push(colored(new THREE.BoxGeometry(0.4, 0.13, 0.04), 0xfff0c8, [side * spec.width * 0.31, wheelR + spec.height * 0.48, spec.length / 2 - 0.02]))
    lights.push(colored(new THREE.BoxGeometry(0.44, 0.14, 0.04), 0xff1830, [side * spec.width * 0.3, wheelR + spec.height * 0.52, -spec.length / 2 + 0.01]))
  }
  const lightMesh = new THREE.Mesh(mergeGeometries(lights, false), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }))
  group.add(lightMesh)
  group.userData = { spec, type }
  return group
}

export { CAR_SPECS }
