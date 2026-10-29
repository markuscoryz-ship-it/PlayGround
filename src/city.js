import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import {
  asphaltTexture, sidewalkTexture, sandTexture, signTexture, billboardTexture,
  glowTexture, palmLeafTexture, woodTexture
} from './textures.js'
import { createTrafficCar } from './vehicles.js'

export const CITY = {
  centers: [-160, -96, -32, 32, 96, 160],
  roads: [-192, -128, -64, 0, 64, 128, 192],
  block: 50,
  roadWidth: 14,
  limit: 206,
  beachStart: 204,
  shore: 268,
  start: { x: 4, z: 94, heading: 0 },
  target: { x: 0, z: 202 }
}

const PALETTES = [
  ['#30374a', '#252b3c', '#424b60'],
  ['#3d3044', '#2f2538', '#55405d'],
  ['#2d3e3e', '#243131', '#425958'],
  ['#46392f', '#342b24', '#604d3d'],
  ['#343b46', '#292f38', '#4c5564'],
  ['#4a3540', '#382832', '#644a57'],
  ['#2a3440', '#202832', '#3e4e5e']
]
const BEACH_PALETTE = [
  ['#d7a88e', '#c38e76', '#f2cdb3'],
  ['#a9c6c1', '#8daeaa', '#d1e3db'],
  ['#e6c3ad', '#cea28e', '#f6ddc7'],
  ['#c8a6bc', '#ad879f', '#e3c7d6'],
  ['#d8c69d', '#bfa87c', '#f1e2bd']
]
const NEON = [0xff3d7f, 0x4ce6ff, 0xffb347, 0xc8ff5c, 0xff7a45, 0xa77bff]
const SIGN_WORDS = [
  ['VICE', 'BEACH HOTEL'], ['OCEAN', 'DRIVE'], ['SUNSET', 'PALMS'], ['NEON', 'CLUB'],
  ['PARADISE', 'MOTEL'], ['HOTEL', 'VACANCY'], ['CLUB', 'AFTER DARK'], ['GTA', 'VII']
]

function rnd(a, b) { return a + Math.random() * (b - a) }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

const matCache = new Map()
function cachedStandard(color, opts = {}) {
  const key = 's|' + color + '|' + JSON.stringify(opts)
  let mat = matCache.get(key)
  if (!mat) { mat = new THREE.MeshStandardMaterial({ color, ...opts }); matCache.set(key, mat) }
  return mat
}
function cachedBasic(color, opts = {}) {
  const key = 'b|' + color + '|' + JSON.stringify(opts)
  let mat = matCache.get(key)
  if (!mat) { mat = new THREE.MeshBasicMaterial({ color, ...opts }); matCache.set(key, mat) }
  return mat
}

function mergeStatic(root) {
  root.updateMatrixWorld(true)
  const buckets = new Map()
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return
    if (o.material && (o.material.isShaderMaterial || Array.isArray(o.material))) return
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
    mesh.matrixAutoUpdate = false
    root.add(mesh)
    for (const o of bucket.meshes) if (o.parent) o.parent.remove(o)
    for (const g of bucket.geos) g.dispose()
  }
}

function coloredGeo(geometry, color, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
  g.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale)
  ))
  const c = new THREE.Color(color)
  const count = g.attributes.position.count
  const arr = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return g
}

function makeSky(scene, low = false) {
  const geo = new THREE.SphereGeometry(1000, 40, 24)
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x140826) },
      uMid: { value: new THREE.Color(0x67205e) },
      uLow: { value: new THREE.Color(0xff8a4f) },
      uBottom: { value: new THREE.Color(0x180d18) },
      uSun: { value: new THREE.Vector3(-0.18, 0.08, 1).normalize() }
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uLow; uniform vec3 uBottom; uniform vec3 uSun;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 col = mix(uLow, uMid, smoothstep(-0.02, 0.34, h));
        col = mix(col, uTop, smoothstep(0.25, 0.92, h));
        col = mix(uBottom, col, smoothstep(-0.28, 0.0, h));
        float sun = pow(max(dot(normalize(vDir), normalize(uSun)), 0.0), 320.0);
        float halo = pow(max(dot(normalize(vDir), normalize(uSun)), 0.0), 10.0);
        col += vec3(1.0, 0.5, 0.2) * halo * 0.16;
        col += vec3(1.0, 0.58, 0.26) * sun * 1.25;
        float band = sin(vDir.y * 70.0 + vDir.x * 13.0) * 0.5 + 0.5;
        col += vec3(0.15, 0.03, 0.08) * band * smoothstep(0.0, 0.22, h) * (1.0 - smoothstep(0.22, 0.6, h)) * 0.25;
        gl_FragColor = vec4(col, 1.0);
      }`
  })
  scene.add(new THREE.Mesh(geo, mat))

  const sunTex = glowTexture('rgba(255,247,216,1)', 'rgba(255,128,52,0)')
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, color: 0xff7a35, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.3, fog: false }))
  sun.position.set(-140, 78, 760)
  sun.scale.set(132, 132, 1)
  scene.add(sun)
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, color: 0xffc27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55, fog: false }))
  core.position.set(-140, 78, 758)
  core.scale.set(32, 32, 1)
  scene.add(core)

  const cloudTex = glowTexture('rgba(255,138,118,.22)', 'rgba(160,70,110,0)')
  for (let i = 0; i < (low ? 6 : 14); i++) {
    const cloud = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: i % 3 === 0 ? 0xffb58c : 0xd58ab4, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: rnd(0.12, 0.26), fog: false }))
    cloud.position.set(rnd(-520, 520), rnd(90, 220), rnd(520, 760))
    cloud.scale.set(rnd(150, 340), rnd(16, 42), 1)
    scene.add(cloud)
  }
}

function makeOcean(scene) {
  const geo = new THREE.PlaneGeometry(1500, 1000, 90, 70)
  const mat = new THREE.ShaderMaterial({
    transparent: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.z += sin(p.x * 0.06 + uTime * 1.2) * 0.22 + sin(p.y * 0.11 - uTime * 0.8) * 0.12;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vWorld;
      varying vec2 vUv;
      void main() {
        float horizon = smoothstep(268.0, 900.0, vWorld.z);
        vec3 deep = vec3(0.012, 0.045, 0.095);
        vec3 warm = vec3(0.44, 0.16, 0.18);
        vec3 gold = vec3(1.0, 0.45, 0.18);
        vec3 col = mix(deep, warm, horizon * 0.72);
        float sunColumn = exp(-abs(vWorld.x + 140.0) * 0.018) * (0.4 + 0.6 * smoothstep(268.0, 600.0, vWorld.z));
        float ripple = sin(vWorld.x * 0.22 + uTime * 1.6 + sin(vWorld.z * 0.04) * 3.0) * 0.5 + 0.5;
        float ripple2 = sin(vWorld.x * 0.51 - uTime * 2.1 + vWorld.z * 0.13) * 0.5 + 0.5;
        col += gold * sunColumn * (0.16 + ripple * 0.12 + ripple2 * 0.08);
        float glint = pow(max(0.0, sin(vWorld.z * 0.7 - uTime * 2.2) * sin(vWorld.x * 0.4 + uTime)), 18.0);
        col += vec3(1.0, 0.8, 0.5) * glint * sunColumn * 0.55;
        col = mix(col, vec3(0.34, 0.12, 0.16), (1.0 - smoothstep(268.0, 340.0, vWorld.z)) * 0.24);
        gl_FragColor = vec4(col, 1.0);
      }`
  })
  const ocean = new THREE.Mesh(geo, mat)
  ocean.rotation.x = -Math.PI / 2
  ocean.position.set(0, -0.32, 780)
  scene.add(ocean)

  const foam = new THREE.Mesh(new THREE.PlaneGeometry(620, 4.4), new THREE.MeshBasicMaterial({ color: 0xffe3c2, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false }))
  foam.rotation.x = -Math.PI / 2
  foam.position.set(0, -0.12, 267.5)
  scene.add(foam)
  const foam2 = foam.clone()
  foam2.material = foam.material.clone()
  foam2.material.opacity = 0.18
  foam2.scale.y = 0.6
  foam2.position.z = 261.5
  scene.add(foam2)
  return { ocean, mat, foam, foam2 }
}

function makeBeach(scene) {
  const sand = sandTexture()
  sand.repeat.set(18, 3)
  const sandMat = new THREE.MeshStandardMaterial({ map: sand, color: 0xe2bd95, roughness: 0.94, metalness: 0.02 })
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(640, 68), sandMat)
  beach.rotation.x = -Math.PI / 2
  beach.position.set(0, 0.02, 236)
  beach.receiveShadow = true
  scene.add(beach)

  const promenade = new THREE.Mesh(new THREE.PlaneGeometry(640, 11), new THREE.MeshStandardMaterial({ map: (() => { const t = woodTexture(); t.repeat.set(40, 1); return t })(), color: 0xc69a78, roughness: 0.8 }))
  promenade.rotation.x = -Math.PI / 2
  promenade.position.set(0, 0.07, 204.5)
  promenade.receiveShadow = true
  scene.add(promenade)

  const railMat = cachedStandard(0x2d2b31, { roughness: 0.45, metalness: 0.65 })
  for (let x = -310; x <= 310; x += 6) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.05, 0.1), railMat)
    post.position.set(x, 0.58, 209.7)
    scene.add(post)
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(630, 0.09, 0.12), railMat)
  rail.position.set(0, 1.06, 209.7)
  scene.add(rail)

  const umbrellaColors = [0xff3d7f, 0x4ce6ff, 0xffd34e, 0xff8b3d, 0xc8ff5c]
  for (let i = 0; i < 17; i++) {
    const x = -290 + i * 36 + rnd(-8, 8)
    const z = 226 + (i % 3) * 13 + rnd(-4, 4)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 6), cachedStandard(0xd7d0c2, { roughness: 0.6 }))
    pole.position.set(x, 1.3, z)
    scene.add(pole)
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.55, 0.5, 12, 1, true), cachedStandard(pick(umbrellaColors), { roughness: 0.72, side: THREE.DoubleSide }))
    canopy.position.set(x, 2.5, z)
    canopy.rotation.y = Math.random() * 3
    scene.add(canopy)
    const chair = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.1, 1.6, 2, 0.05), cachedStandard(0xf0e4c8, { roughness: 0.8 }))
    chair.position.set(x + 2.1, 0.3, z + 1.2)
    chair.rotation.y = rnd(-0.4, 0.4)
    scene.add(chair)
  }

  for (const x of [-86, 78]) {
    const tower = new THREE.Group()
    const wood = cachedStandard(0xd7b88f, { roughness: 0.82 })
    for (const sx of [-1.3, 1.3]) for (const sz of [-1.3, 1.3]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.3, 0.16), wood)
      leg.position.set(sx, 1.65, sz)
      tower.add(leg)
    }
    const hut = new THREE.Mesh(new RoundedBoxGeometry(3.1, 2.1, 3.1, 3, 0.08), cachedStandard(0xf2dfb9, { roughness: 0.8 }))
    hut.position.y = 3.6
    tower.add(hut)
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.65, 1.15, 4), cachedStandard(0xd85345, { roughness: 0.7 }))
    roof.position.y = 5.1
    roof.rotation.y = Math.PI / 4
    tower.add(roof)
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.16, 0.28, 3.16), cachedStandard(0xff3d7f, { roughness: 0.55 }))
    stripe.position.y = 3.1
    tower.add(stripe)
    tower.position.set(x, 0, 238)
    tower.traverse(o => { if (o.isMesh) o.castShadow = true })
    scene.add(tower)
  }
}

function makeGround(scene) {
  const asphalt = asphaltTexture()
  asphalt.repeat.set(36, 36)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(470, 460), new THREE.MeshStandardMaterial({ map: asphalt, color: 0x7a7482, roughness: 0.68, metalness: 0.18, envMapIntensity: 0.5 }))
  ground.rotation.x = -Math.PI / 2
  ground.position.set(0, -0.02, -15)
  ground.receiveShadow = true
  scene.add(ground)
  return ground
}

function makeRoads(scene) {
  const dashes = []
  const solids = []
  const crosses = []
  const dummy = new THREE.Object3D()
  const dashGeo = new THREE.PlaneGeometry(0.2, 4.1)
  const solidGeo = new THREE.PlaneGeometry(0.14, 4.6)
  for (const road of CITY.roads) {
    for (let z = -205; z < 205; z += 9) {
      dummy.position.set(road, 0.012, z)
      dummy.rotation.set(-Math.PI / 2, 0, 0)
      dummy.updateMatrix()
      dashes.push(dummy.matrix.clone())
    }
    for (let x = -205; x < 205; x += 9) {
      dummy.position.set(x, 0.012, road)
      dummy.rotation.set(-Math.PI / 2, 0, Math.PI / 2)
      dummy.updateMatrix()
      dashes.push(dummy.matrix.clone())
    }
  }
  for (const z of [-205, 205]) {
    for (let x = -205; x < 205; x += 9) {
      dummy.position.set(x, 0.012, z)
      dummy.rotation.set(-Math.PI / 2, 0, Math.PI / 2)
      dummy.updateMatrix()
      dashes.push(dummy.matrix.clone())
    }
  }
  for (const x of [-1.05, 1.05]) {
    for (let z = -205; z < 205; z += 9) {
      dummy.position.set(x, 0.014, z)
      dummy.rotation.set(-Math.PI / 2, 0, 0)
      dummy.updateMatrix()
      solids.push(dummy.matrix.clone())
    }
  }
  for (const xr of CITY.roads) {
    for (const zr of CITY.roads) {
      for (let i = -5; i <= 5; i++) {
        dummy.position.set(xr + i * 1.25, 0.018, zr + 7.8)
        dummy.rotation.set(-Math.PI / 2, 0, 0)
        dummy.updateMatrix()
        crosses.push(dummy.matrix.clone())
        dummy.position.set(xr + i * 1.25, 0.018, zr - 7.8)
        dummy.updateMatrix()
        crosses.push(dummy.matrix.clone())
        dummy.position.set(xr + 7.8, 0.018, zr + i * 1.25)
        dummy.rotation.set(-Math.PI / 2, 0, Math.PI / 2)
        dummy.updateMatrix()
        crosses.push(dummy.matrix.clone())
        dummy.position.set(xr - 7.8, 0.018, zr + i * 1.25)
        dummy.updateMatrix()
        crosses.push(dummy.matrix.clone())
      }
    }
  }
  const dashMesh = new THREE.InstancedMesh(dashGeo, new THREE.MeshBasicMaterial({ color: 0xd8cfb9, transparent: true, opacity: 0.55 }), dashes.length)
  dashes.forEach((m, i) => dashMesh.setMatrixAt(i, m))
  scene.add(dashMesh)
  const solidMesh = new THREE.InstancedMesh(solidGeo, new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.7 }), solids.length)
  solids.forEach((m, i) => solidMesh.setMatrixAt(i, m))
  scene.add(solidMesh)
  const crossMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.52, 3.1), new THREE.MeshBasicMaterial({ color: 0xf3ead7, transparent: true, opacity: 0.68 }), crosses.length)
  crosses.forEach((m, i) => crossMesh.setMatrixAt(i, m))
  scene.add(crossMesh)
}

function makeBlockSlabs(scene) {
  const tex = sidewalkTexture()
  tex.repeat.set(6, 6)
  const mat = new THREE.MeshStandardMaterial({ map: tex, color: 0xb2aca3, roughness: 0.86, metalness: 0.04 })
  const slabGeo = new THREE.BoxGeometry(CITY.block, 0.24, CITY.block)
  const slabs = new THREE.InstancedMesh(slabGeo, mat, 36)
  const curbGeo = new THREE.BoxGeometry(CITY.block + 0.2, 0.19, 0.34)
  const curbs = []
  const dummy = new THREE.Object3D()
  let idx = 0
  for (const x of CITY.centers) {
    for (const z of CITY.centers) {
      dummy.position.set(x, 0.11, z)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      slabs.setMatrixAt(idx++, dummy.matrix)
      for (const side of [-1, 1]) {
        dummy.position.set(x, 0.11, z + side * (CITY.block / 2 + 0.18))
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        curbs.push(dummy.matrix.clone())
        dummy.position.set(x + side * (CITY.block / 2 + 0.18), 0.11, z)
        dummy.rotation.set(0, Math.PI / 2, 0)
        dummy.updateMatrix()
        curbs.push(dummy.matrix.clone())
      }
    }
  }
  slabs.receiveShadow = true
  scene.add(slabs)
  const curbMesh = new THREE.InstancedMesh(curbGeo, new THREE.MeshStandardMaterial({ color: 0x9b958d, roughness: 0.82 }), curbs.length)
  curbs.forEach((m, i) => curbMesh.setMatrixAt(i, m))
  curbMesh.receiveShadow = true
  scene.add(curbMesh)
}

function makeWindows(scene) {
  const winGeo = new THREE.PlaneGeometry(1, 1)
  const mat = new THREE.MeshBasicMaterial({ toneMapped: false })
  const list = []
  return {
    add(x, y, z, ry, sx, sy, color) {
      list.push({ x, y, z, ry, sx, sy, color })
    },
    build() {
      const mesh = new THREE.InstancedMesh(winGeo, mat, list.length)
      const dummy = new THREE.Object3D()
      const c = new THREE.Color()
      list.forEach((w, i) => {
        dummy.position.set(w.x, w.y, w.z)
        dummy.rotation.set(0, w.ry, 0)
        dummy.scale.set(w.sx, w.sy, 1)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        mesh.setColorAt(i, c.setHex(w.color))
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      scene.add(mesh)
    }
  }
}

function addBuilding(scene, colliders, windows, opts) {
  const { x, z, w, d, h, color, trim, neon, district } = opts
  const bodyMat = cachedStandard(color, { roughness: 0.78, metalness: 0.12 })
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat)
  body.position.set(x, h / 2 + 0.24, z)
  body.castShadow = true
  body.receiveShadow = true
  scene.add(body)

  const trimMat = cachedStandard(trim, { roughness: 0.7, metalness: 0.2 })
  const lip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.55, 0.38, d + 0.55), trimMat)
  lip.position.set(x, h + 0.2, z)
  lip.castShadow = true
  scene.add(lip)
  const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.24, 0.5, d + 0.24), trimMat)
  base.position.set(x, 0.46, z)
  base.receiveShadow = true
  scene.add(base)

  const bands = h > 30 ? 2 : 1
  for (let i = 0; i < bands; i++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.36, 0.16, d + 0.36), trimMat)
    band.position.set(x, 0.24 + h * ((i + 1) / (bands + 1)), z)
    band.castShadow = true
    scene.add(band)
  }
  if (district === 'beach') {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.3, h, 0.3), trimMat)
      col.position.set(x + sx * (w / 2 - 0.02), h / 2 + 0.24, z + sz * (d / 2 - 0.02))
      col.castShadow = true
      scene.add(col)
    }
  }

  colliders.push({ minX: x - w / 2 - 0.4, maxX: x + w / 2 + 0.4, minZ: z - d / 2 - 0.4, maxZ: z + d / 2 + 0.4, h })

  const floorH = 3.35
  const rows = Math.max(0, Math.floor((h - 5.2) / floorH))
  const faceDefs = [
    { ry: 0, px: x, pz: z + d / 2 + 0.035, len: w, axis: 'x' },
    { ry: Math.PI, px: x, pz: z - d / 2 - 0.035, len: w, axis: 'x' },
    { ry: Math.PI / 2, px: x + w / 2 + 0.035, pz: z, len: d, axis: 'z' },
    { ry: -Math.PI / 2, px: x - w / 2 - 0.035, pz: z, len: d, axis: 'z' }
  ]
  for (const face of faceDefs) {
    const cols = Math.max(1, Math.floor((face.len - 1.7) / 2.45))
    const span = (cols - 1) * 2.45
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const along = -span / 2 + c * 2.45
        const wx = face.axis === 'x' ? face.px + along : face.px
        const wz = face.axis === 'x' ? face.pz : face.pz + along
        const wy = 4.1 + r * floorH
        const lit = Math.random()
        let col
        if (lit < 0.22) col = pick([0xffc46b, 0xffdf9c, 0xffa85c, 0xfff0c8])
        else if (lit < 0.32) col = pick([0x8ee7ff, 0x6fc9ff, 0xa8c6ff])
        else if (lit < 0.38) col = pick([0xff7aa8, 0xff5d94])
        else col = pick([0x0a1220, 0x0d1828, 0x08111d, 0x122030])
        windows.add(wx, wy, wz, face.ry, 0.96, 1.42, col)
      }
    }
    if (district === 'beach' || Math.random() < 0.55) {
      const shop = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(3, face.len - 3), 1.55), cachedBasic(pick([0xffb56e, 0x7fe6ff, 0xff8fc4, 0xffe0a0]), { toneMapped: false, transparent: true, opacity: 0.82 }))
      shop.position.set(face.axis === 'x' ? face.px : face.px, 1.7, face.axis === 'x' ? face.pz + (face.ry === 0 ? 0.01 : -0.01) : face.pz)
      shop.rotation.y = face.ry
      scene.add(shop)
      const outward = face.ry === 0 ? [0, 1] : face.ry === Math.PI ? [0, -1] : face.ry === Math.PI / 2 ? [1, 0] : [-1, 0]
      const awning = new THREE.Mesh(new THREE.BoxGeometry(Math.max(3, face.len - 3), 0.12, 0.9), cachedStandard(pick([0xff3d7f, 0x4ce6ff, 0xffb347, 0xc8ff5c]), { roughness: 0.62, metalness: 0.1 }))
      awning.position.set(face.px + outward[0] * 0.46, 2.75, face.pz + outward[1] * 0.46)
      awning.rotation.y = face.ry
      awning.castShadow = true
      scene.add(awning)
    }
  }

  if (neon) {
    const neonMat = cachedBasic(neon, { toneMapped: false })
    for (const side of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.14, h * 0.72, 0.14), neonMat)
      strip.position.set(x + side * (w / 2 + 0.1), h * 0.48 + 1.5, z + d / 2 + 0.1)
      scene.add(strip)
    }
  }

  const roofCount = h > 35 ? 3 : 1
  for (let i = 0; i < roofCount; i++) {
    const rw = rnd(1.2, Math.min(5, w * 0.3))
    const rd = rnd(1.2, Math.min(5, d * 0.3))
    const box = new THREE.Mesh(new THREE.BoxGeometry(rw, rnd(0.6, 1.8), rd), cachedStandard(pick(['#55525b', '#3b3d44', '#6c6259']), { roughness: 0.8, metalness: 0.3 }))
    box.position.set(x + rnd(-w * 0.25, w * 0.25), h + 0.55, z + rnd(-d * 0.25, d * 0.25))
    box.castShadow = true
    scene.add(box)
  }
  if (h > 48) {
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 8, 5), cachedStandard(0x9fa6ae, { metalness: 0.8, roughness: 0.3 }))
    antenna.position.set(x, h + 4.4, z)
    scene.add(antenna)
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,42,70,1)', 'rgba(255,20,50,0)'), color: 0xff2038, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
    beacon.position.set(x, h + 8.5, z)
    beacon.scale.set(1.2, 1.2, 1)
    scene.add(beacon)
  }
  return { x, z, w, d, h }
}

function addSignGlow(root, x, y, z, color) {
  if (!root.userData.signGlows) root.userData.signGlows = []
  root.userData.signGlows.push({ x, y, z, color })
}

function buildSignGlows(root) {
  const list = root.userData.signGlows
  if (!list || !list.length) return
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(list.length * 3)
  const col = new Float32Array(list.length * 3)
  const c = new THREE.Color()
  list.forEach((g, i) => {
    pos[i * 3] = g.x; pos[i * 3 + 1] = g.y; pos[i * 3 + 2] = g.z
    c.setHex(g.color)
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b
  })
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const mat = new THREE.PointsMaterial({
    map: glowTexture('rgba(255,255,255,.5)', 'rgba(255,255,255,0)'),
    vertexColors: true, size: 7.5, transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, sizeAttenuation: true, opacity: 0.6
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  root.add(points)
}

function addSign(scene, building, text, sub, color, face = 'auto', rooftop = false) {
  const tex = signTexture(text, { color: '#' + new THREE.Color(color).getHexString(), sub, glow: '#' + new THREE.Color(color).getHexString() })
  const isVertical = Math.random() < 0.18
  const width = isVertical ? 2.2 : rnd(6, 9.5)
  const height = isVertical ? width * 2.7 : width * 0.46
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.DoubleSide })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat)
  let x = building.x
  let z = building.z
  let ry = 0
  if (rooftop) {
    x = building.x
    z = building.z - building.d / 2 - 0.2
    mesh.position.set(x, building.h + 3.6, z)
    mesh.rotation.y = Math.PI
    scene.add(mesh)
    addSignGlow(scene, x, building.h + 3.6, z - 0.4, color)
    return
  }
  if (face === 'auto') {
    const left = Math.abs(building.x - (-32)) < 1
    const right = Math.abs(building.x - 32) < 1
    if (Math.abs(building.x) === 32 && Math.abs(building.z) <= 110) {
      if (building.z > 94) { z = building.z - building.d / 2 - 0.08; ry = Math.PI }
      else { z = building.z + building.d / 2 + 0.08; ry = 0 }
    } else if (left) { x = building.x + building.w / 2 + 0.08; ry = Math.PI / 2 }
    else if (right) { x = building.x - building.w / 2 - 0.08; ry = -Math.PI / 2 }
    else if (Math.random() < 0.5) { z = building.z - building.d / 2 - 0.08; ry = Math.PI }
    else { x = building.x + building.w / 2 + 0.08; ry = Math.PI / 2 }
  }
  const y = Math.min(building.h - 3, Math.max(4.4, building.h * 0.34))
  mesh.position.set(x, y, z)
  mesh.rotation.y = ry
  scene.add(mesh)
  addSignGlow(scene, x + Math.sin(ry) * 0.4, y, z + Math.cos(ry) * 0.4, color)
}

function makeBuildings(scene, colliders, windows) {
  const blocks = []
  let signIndex = 0
  for (const bx of CITY.centers) {
    for (const bz of CITY.centers) {
      const district = bz >= 150 ? 'beach' : bz >= 80 ? 'mid' : bz >= -80 ? 'downtown' : bz >= -130 ? 'mid' : 'industrial'
      const beach = district === 'beach'
      const park = (bx === -96 && bz === -32) || (bx === 96 && bz === -160) || (bx === -160 && bz === 160)
      const parking = (bx === 96 && bz === 96)
      blocks.push({ x: bx, z: bz, type: park ? 'park' : parking ? 'parking' : 'city', district })
      if (park) { makePark(scene, bx, bz); continue }
      if (parking) { makeParking(scene, bx, bz); continue }

      let layout
      const r = Math.random()
      if (beach && Math.abs(bx) === 32) layout = [{ x: 0, z: -10.5, w: 39, d: 19.5 }, { x: 0, z: 10.5, w: 39, d: 19.5 }]
      else if (Math.abs(bx) === 32 && Math.abs(bz) <= 96) layout = [{ x: 0, z: 0, w: 37, d: 39 }]
      else if (r < 0.3) layout = [{ x: 0, z: 0, w: rnd(34, 40), d: rnd(34, 40) }]
      else if (r < 0.58) layout = [{ x: -11, z: 0, w: 19.5, d: rnd(34, 40) }, { x: 11, z: 0, w: 19.5, d: rnd(34, 40) }]
      else if (r < 0.8) layout = [{ x: 0, z: -11, w: rnd(34, 40), d: 19.5 }, { x: 0, z: 11, w: rnd(34, 40), d: 19.5 }]
      else layout = [{ x: -11, z: -11, w: 19.5, d: 19.5 }, { x: 11, z: -11, w: 19.5, d: 19.5 }, { x: -11, z: 11, w: 19.5, d: 19.5 }, { x: 11, z: 11, w: 19.5, d: 19.5 }]

      for (let i = 0; i < layout.length; i++) {
        const lot = layout[i]
        if (Math.random() < 0.1 && layout.length > 1) continue
        const w = Math.max(13, lot.w + rnd(-1.2, 0.5))
        const d = Math.max(13, lot.d + rnd(-1.2, 0.5))
        let h
        if (beach) h = rnd(11, 28)
        else if (district === 'downtown') h = rnd(34, 92) * (Math.abs(bx) < 70 ? 1.1 : 0.82)
        else if (district === 'mid') h = rnd(22, 48)
        else h = rnd(12, 34)
        if (Math.abs(bx) === 160 || Math.abs(bz) === 160) h *= 0.78
        const palette = beach ? pick(BEACH_PALETTE) : pick(PALETTES)
        const color = palette[0]
        const trim = palette[1]
        let neon = Math.random() < (beach ? 0.88 : 0.4) ? pick(NEON) : null
        if (Math.abs(bx) === 32 && Math.abs(bz) <= 96) neon = pick(NEON)
        const building = addBuilding(scene, colliders, windows, {
          x: bx + lot.x, z: bz + lot.z, w, d, h, color, trim, neon, district
        })
        if (beach && bz === 160 && Math.abs(bx) === 32 && i === 0) {
          addSign(scene, building, bx < 0 ? 'VICE BEACH' : 'OCEAN DRIVE', bx < 0 ? 'HOTEL  •  CASINO' : 'SUNSET STRIP', bx < 0 ? 0xff3d7f : 0x4ce6ff, 'auto', true)
        }
        if (neon && Math.random() < (beach ? 0.95 : 0.72)) {
          const [word, sub] = SIGN_WORDS[signIndex++ % SIGN_WORDS.length]
          addSign(scene, building, word, sub, neon)
        }
      }
    }
  }
  return blocks
}

function makePark(scene, x, z) {
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(45, 45), cachedStandard(0x355e3b, { roughness: 0.95 }))
  grass.rotation.x = -Math.PI / 2
  grass.position.set(x, 0.25, z)
  grass.receiveShadow = true
  scene.add(grass)
  const pathMat = cachedStandard(0xbfb49e, { roughness: 0.88 })
  const pathA = new THREE.Mesh(new THREE.PlaneGeometry(45, 3.4), pathMat)
  pathA.rotation.x = -Math.PI / 2
  pathA.position.set(x, 0.27, z)
  scene.add(pathA)
  const pathB = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 45), pathMat)
  pathB.rotation.x = -Math.PI / 2
  pathB.position.set(x, 0.27, z)
  scene.add(pathB)
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.4, 0.9, 24), cachedStandard(0x9aa0a6, { roughness: 0.6 }))
  fountain.position.set(x, 0.65, z)
  scene.add(fountain)
  const water = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, 0.2, 24), new THREE.MeshPhysicalMaterial({ color: 0x4fb7c9, roughness: 0.08, metalness: 0.5, transparent: true, opacity: 0.85 }))
  water.position.set(x, 1.1, z)
  scene.add(water)
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.2, 3.2, 8), new THREE.MeshBasicMaterial({ color: 0xa8f0ff, transparent: true, opacity: 0.55 }))
  jet.position.set(x, 2.6, z)
  scene.add(jet)
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 0.6), cachedStandard(0x6a4b33, { roughness: 0.85 }))
    bench.position.set(x + Math.cos(angle) * 9, 0.7, z + Math.sin(angle) * 9)
    bench.rotation.y = -angle
    scene.add(bench)
  }
}

function makeParking(scene, x, z) {
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), cachedStandard(0x2b2a30, { roughness: 0.9 }))
  lot.rotation.x = -Math.PI / 2
  lot.position.set(x, 0.25, z)
  scene.add(lot)
  const lineMat = cachedBasic(0xbab19f, { transparent: true, opacity: 0.55 })
  for (let i = -4; i <= 4; i++) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 9), lineMat)
    line.rotation.x = -Math.PI / 2
    line.position.set(x + i * 4.6, 0.27, z - 12)
    scene.add(line)
  }
  for (let i = 0; i < 7; i++) {
    const car = createTrafficCar(pick(['sedan', 'sports', 'taxi']))
    car.position.set(x - 18 + i * 5.2, 0.27, z - 13)
    car.rotation.y = Math.PI
    scene.add(car)
  }
}

function makeBeachArch(root) {
  const pillarMat = cachedStandard(0x241a2a, { roughness: 0.5, metalness: 0.45 })
  const neonMat = cachedBasic(0x4ce6ff, { toneMapped: false })
  const pinkMat = cachedBasic(0xff3d7f, { toneMapped: false })
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.7, 10.5, 1.7), pillarMat)
    pillar.position.set(side * 12.5, 5.25, 208)
    pillar.castShadow = true
    root.add(pillar)
    for (const xOff of [-0.86, 0.86]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 9.6, 0.09), side < 0 ? pinkMat : neonMat)
      strip.position.set(side * 12.5 + xOff, 5.4, 207.1)
      root.add(strip)
    }
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.45, 2.3), pillarMat)
    base.position.set(side * 12.5, 0.22, 208)
    root.add(base)
  }
  const tex = signTexture('VICE BEACH', { color: '#4ce6ff', sub: 'SUNSET STRIP  •  EST. 1986', glow: '#4ce6ff' })
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(21, 5.4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.DoubleSide }))
  sign.position.set(0, 9.1, 207.1)
  sign.rotation.y = Math.PI
  root.add(sign)
  addSignGlow(root, 0, 9.1, 206.4, 0x4ce6ff)
  const bar = new THREE.Mesh(new THREE.BoxGeometry(25.4, 0.16, 0.22), neonMat)
  bar.position.set(0, 6.45, 207.4)
  root.add(bar)
}

function makePalms(scene) {
  const positions = []
  for (const x of [-9.2, 9.2]) for (let z = -182; z <= 188; z += 18) positions.push([x + rnd(-0.4, 0.4), z, rnd(0.85, 1.15)])
  for (let x = -292; x <= 292; x += 26) positions.push([x + rnd(-3, 3), 214 + rnd(-1.5, 1.5), rnd(0.9, 1.25)])
  for (const p of [[-96, -32], [-86, -24], [-106, -40], [96, -160], [86, -150]]) positions.push([p[0] + rnd(-8, 8), p[1] + rnd(-8, 8), rnd(0.9, 1.2)])

  const trunkGeo = new THREE.CylinderGeometry(0.13, 0.31, 1, 7)
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7b5a3c, roughness: 0.92 })
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, positions.length)
  const leafShape = new THREE.Shape()
  leafShape.moveTo(0, 0)
  leafShape.quadraticCurveTo(1.5, 0.58, 4.35, 0.04)
  leafShape.quadraticCurveTo(1.5, -0.46, 0, 0)
  const leafGeo = new THREE.ShapeGeometry(leafShape, 8)
  leafGeo.rotateX(-Math.PI / 2)
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.82, metalness: 0.02 })
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, positions.length * 11)
  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  let li = 0
  positions.forEach(([x, z, s], i) => {
    const h = rnd(6.8, 8.6) * s
    dummy.position.set(x, h / 2, z)
    dummy.rotation.set(0, Math.random() * 6.28, 0)
    dummy.scale.set(1, h, 1)
    dummy.updateMatrix()
    trunks.setMatrixAt(i, dummy.matrix)
    for (let j = 0; j < 11; j++) {
      const a = (j / 11) * Math.PI * 2 + Math.random() * 0.22
      dummy.position.set(x, h + 0.2, z)
      dummy.rotation.order = 'YXZ'
      dummy.rotation.set(rnd(-0.08, 0.08), a, rnd(-0.62, -0.18))
      dummy.scale.set(s * rnd(0.9, 1.15), 1, 1)
      dummy.updateMatrix()
      leaves.setMatrixAt(li, dummy.matrix)
      leaves.setColorAt(li, color.setHSL(0.28 + Math.random() * 0.06, 0.55, 0.4 + Math.random() * 0.15))
      li++
    }
  })
  trunks.castShadow = true
  leaves.castShadow = true
  scene.add(trunks, leaves)
}

function makeStreetLights(scene, low = false) {
  const positions = []
  for (const x of [-10.2, 10.2]) for (let z = -192; z <= 192; z += 32) positions.push([x, z, x > 0 ? -1 : 1])
  for (let x = -280; x <= 280; x += 40) positions.push([x, 198, 0])

  const poleGeo = new THREE.CylinderGeometry(0.07, 0.11, 4.7, 6)
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x22252c, roughness: 0.5, metalness: 0.7 })
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, positions.length)
  const armGeo = new THREE.BoxGeometry(1.25, 0.08, 0.08)
  const arms = new THREE.InstancedMesh(armGeo, poleMat, positions.length)
  const lampGeo = new THREE.BoxGeometry(0.52, 0.16, 0.3)
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false })
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, positions.length)
  const dummy = new THREE.Object3D()
  const glowPositions = []
  positions.forEach(([x, z, dir], i) => {
    dummy.position.set(x, 2.35, z)
    dummy.rotation.set(0, 0, 0)
    dummy.scale.set(1, 1, 1)
    dummy.updateMatrix()
    poles.setMatrixAt(i, dummy.matrix)
    const armX = dir === 0 ? 0 : x + dir * 0.62
    dummy.position.set(armX, 4.66, z)
    dummy.rotation.set(0, dir === 0 ? Math.PI / 2 : 0, 0)
    dummy.updateMatrix()
    arms.setMatrixAt(i, dummy.matrix)
    const lampX = dir === 0 ? x : x + dir * 1.2
    dummy.position.set(lampX, 4.55, z)
    dummy.rotation.set(0, 0, 0)
    dummy.updateMatrix()
    lamps.setMatrixAt(i, dummy.matrix)
    glowPositions.push(lampX, 4.55, z)
  })
  scene.add(poles, arms, lamps)
  const glowGeo = new THREE.BufferGeometry()
  glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(glowPositions, 3))
  const glow = new THREE.Points(glowGeo, new THREE.PointsMaterial({ map: glowTexture('rgba(255,200,120,.55)', 'rgba(255,150,50,0)'), color: 0xffc477, size: 1.55, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }))
  scene.add(glow)
  const p1 = new THREE.PointLight(0xffb36b, 12, 17, 1.8)
  p1.position.set(10, 4.4, 94)
  const p2 = new THREE.PointLight(0xff8b5a, 9, 16, 1.8)
  p2.position.set(-10, 4.4, 126)
  if (!low) scene.add(p1, p2)
}

function makeStreetProps(scene) {
  const hydrantMat = cachedStandard(0xc84035, { roughness: 0.55, metalness: 0.4 })
  const hydrants = []
  for (const x of [-9.4, 9.4]) for (let z = -180; z <= 180; z += 44) hydrants.push([x, z + 7])
  const hydrantGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.62, 8)
  const hydrantsMesh = new THREE.InstancedMesh(hydrantGeo, hydrantMat, hydrants.length)
  const dummy = new THREE.Object3D()
  hydrants.forEach(([x, z], i) => {
    dummy.position.set(x, 0.55, z)
    dummy.rotation.set(0, 0, 0)
    dummy.updateMatrix()
    hydrantsMesh.setMatrixAt(i, dummy.matrix)
  })
  scene.add(hydrantsMesh)

  const benchMat = cachedStandard(0x63452e, { roughness: 0.86 })
  const benchGeo = new THREE.BoxGeometry(2.2, 0.14, 0.55)
  const benches = []
  for (let z = -150; z <= 160; z += 62) {
    benches.push([-12.2, z, Math.PI / 2], [12.2, z + 18, -Math.PI / 2])
  }
  const benchMesh = new THREE.InstancedMesh(benchGeo, benchMat, benches.length)
  benches.forEach(([x, z, ry], i) => {
    dummy.position.set(x, 0.7, z)
    dummy.rotation.set(0, ry, 0)
    dummy.updateMatrix()
    benchMesh.setMatrixAt(i, dummy.matrix)
  })
  scene.add(benchMesh)

  const canMat = cachedStandard(0x2c3a31, { roughness: 0.8, metalness: 0.35 })
  const canGeo = new THREE.CylinderGeometry(0.3, 0.26, 0.85, 8)
  const cans = []
  for (let z = -170; z <= 170; z += 52) cans.push([-13.2, z], [13.2, z + 20])
  const canMesh = new THREE.InstancedMesh(canGeo, canMat, cans.length)
  cans.forEach(([x, z], i) => {
    dummy.position.set(x, 0.65, z)
    dummy.rotation.set(0, 0, 0)
    dummy.updateMatrix()
    canMesh.setMatrixAt(i, dummy.matrix)
  })
  scene.add(canMesh)

  for (const [x, z] of [[-14, 150], [14, 170], [-14, 30]]) {
    const stop = new THREE.Group()
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5.3, 6), cachedStandard(0x24272d, { metalness: 0.7, roughness: 0.5 }))
    pole.position.y = 2.65
    stop.add(pole)
    const arm = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.12), cachedStandard(0x24272d, { metalness: 0.7, roughness: 0.5 }))
    arm.position.set(x > 0 ? -1.4 : 1.4, 5.2, 0)
    stop.add(arm)
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.1, 0.38), cachedStandard(0x14161a, { roughness: 0.6 }))
    box.position.set(x > 0 ? -2.9 : 2.9, 4.7, 0)
    stop.add(box)
    const light = new THREE.Mesh(new THREE.CircleGeometry(0.12, 10), cachedBasic(0x38ff7c, { toneMapped: false }))
    light.position.set(x > 0 ? -2.9 : 2.9, 4.4, 0.2)
    stop.add(light)
    stop.position.set(x, 0.2, z)
    scene.add(stop)
  }
}

function makeTraffic(scene, low = false) {
  const cars = []
  const types = ['sedan', 'taxi', 'sports', 'van', 'sedan', 'taxi', 'sedan', 'sports']
  const presets = [
    { axis: 'z', road: 0, dir: 1, pos: 138, speed: 10, type: 'taxi' },
    { axis: 'z', road: 0, dir: 1, pos: 170, speed: 8, type: 'sedan' },
    { axis: 'z', road: 0, dir: -1, pos: 58, speed: 11, type: 'sports' },
    { axis: 'x', road: 64, dir: -1, pos: 38, speed: 9, type: 'van' }
  ]
  for (let i = 0; i < (low ? 8 : 12); i++) {
    const preset = presets[i]
    const type = preset ? preset.type : types[i % types.length]
    const car = createTrafficCar(type)
    const axis = preset ? preset.axis : Math.random() < 0.55 ? 'z' : 'x'
    const road = preset ? preset.road : pick(CITY.roads)
    const dir = preset ? preset.dir : Math.random() < 0.5 ? 1 : -1
    const speed = preset ? preset.speed : rnd(8, 15)
    const pos = preset ? preset.pos : rnd(-200, 200)
    const state = { group: car, axis, road, dir, speed, pos, type }
    if (axis === 'z') {
      car.position.set(road + dir * 3.3, 0.02, pos)
      car.rotation.y = dir > 0 ? 0 : Math.PI
    } else {
      car.position.set(pos, 0.02, road + dir * 3.3)
      car.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2
    }
    car.userData.traffic = state
    scene.add(car)
    cars.push(state)
  }
  return cars
}

function makePedestrians(scene, low = false) {
  const peds = []
  const shirts = [0xff3d7f, 0x4ce6ff, 0xffd34e, 0xff8b3d, 0xc8ff5c, 0xe8e1cf, 0xa77bff]
  const pants = [0x222b42, 0x2f2a28, 0x3b3d44, 0x5a4a3c]
  const skinTones = [0xb87955, 0x8c5a3d, 0xe0b08a, 0x5c3a28]
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.02 })
  const legMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02 })
  for (let i = 0; i < (low ? 16 : 22); i++) {
    const shirt = pick(shirts)
    const pant = pick(pants)
    const skin = pick(skinTones)
    const bodyParts = [
      coloredGeo(new RoundedBoxGeometry(0.46, 0.62, 0.28, 2, 0.07), shirt, [0, 1.17, 0]),
      coloredGeo(new THREE.SphereGeometry(0.165, 10, 8), skin, [0, 1.62, 0], [0, 0, 0], [0.92, 1.03, 0.94]),
      coloredGeo(new THREE.SphereGeometry(0.175, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), 0x17110e, [0, 1.66, 0], [0, 0, 0], [0.95, 1.05, 0.97]),
      coloredGeo(new THREE.CapsuleGeometry(0.06, 0.26, 3, 6), shirt, [-0.3, 1.14, 0], [0, 0, 0.16]),
      coloredGeo(new THREE.CapsuleGeometry(0.06, 0.26, 3, 6), shirt, [0.3, 1.14, 0], [0, 0, -0.16])
    ]
    const body = new THREE.Mesh(mergeGeometries(bodyParts, false), bodyMat)
    body.castShadow = true
    const legPartsL = [
      coloredGeo(new THREE.CapsuleGeometry(0.085, 0.58, 3, 6), pant, [0, -0.34, 0]),
      coloredGeo(new RoundedBoxGeometry(0.14, 0.1, 0.27, 2, 0.04), 0xe9e9e4, [0, -0.72, 0.05])
    ]
    const legPartsR = [
      coloredGeo(new THREE.CapsuleGeometry(0.085, 0.58, 3, 6), pant, [0, -0.34, 0]),
      coloredGeo(new RoundedBoxGeometry(0.14, 0.1, 0.27, 2, 0.04), 0xe9e9e4, [0, -0.72, 0.05])
    ]
    const legL = new THREE.Mesh(mergeGeometries(legPartsL, false), legMat)
    const legR = new THREE.Mesh(mergeGeometries(legPartsR, false), legMat)
    legL.position.set(-0.13, 0.85, 0)
    legR.position.set(0.13, 0.85, 0)
    const group = new THREE.Group()
    group.add(body, legL, legR)
    const beach = i > 16
    const side = Math.random() < 0.5 ? -1 : 1
    const state = {
      group, legL, legR, speed: rnd(0.8, 1.8), dir: Math.random() < 0.5 ? 1 : -1,
      axis: beach ? 'x' : 'z', fixed: beach ? 221 + rnd(-5, 5) : side * rnd(10.5, 14),
      pos: rnd(-180, 180), dead: false, fall: 0, phase: Math.random() * 10
    }
    const pedPresets = [[12.8, 112, -1, 1.1], [-12.8, 122, 1, 1.4], [12.6, 151, -1, 0.9], [-12.6, 76, 1, 1.2]]
    if (i < pedPresets.length) {
      state.fixed = pedPresets[i][0]
      state.pos = pedPresets[i][1]
      state.dir = pedPresets[i][2]
      state.speed = pedPresets[i][3]
    }
    if (beach) {
      group.position.set(state.pos, 0.06, state.fixed)
      group.rotation.y = state.dir > 0 ? Math.PI / 2 : -Math.PI / 2
    } else {
      group.position.set(state.fixed, 0.1, state.pos)
      group.rotation.y = state.dir > 0 ? 0 : Math.PI
    }
    group.userData.ped = state
    group.traverse(o => { if (o.isMesh) o.userData.ped = state })
    scene.add(group)
    peds.push(state)
  }
  return peds
}

function makeSeagulls(scene, low = false) {
  const birds = []
  const mat = new THREE.MeshBasicMaterial({ color: 0xfff3df, side: THREE.DoubleSide })
  for (let i = 0; i < (low ? 4 : 8); i++) {
    const g = new THREE.Group()
    const wingGeo = new THREE.PlaneGeometry(1.15, 0.28)
    wingGeo.translate(0.55, 0, 0)
    const l = new THREE.Mesh(wingGeo, mat)
    const r = new THREE.Mesh(wingGeo, mat)
    r.rotation.y = Math.PI
    g.add(l, r)
    g.position.set(rnd(-120, 120), rnd(14, 30), rnd(220, 330))
    g.userData = { l, r, phase: Math.random() * 10, radius: rnd(8, 26), speed: rnd(0.1, 0.25), cx: g.position.x, cz: g.position.z, y: g.position.y }
    scene.add(g)
    birds.push(g)
  }
  return birds
}

function makeBoats(scene) {
  const boats = []
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group()
    const hull = new THREE.Mesh(new RoundedBoxGeometry(rnd(3, 5.5), 0.6, rnd(8, 13), 3, 0.2), new THREE.MeshStandardMaterial({ color: pick([0xf2eee4, 0x2d3444, 0xb23a35]), roughness: 0.42, metalness: 0.35 }))
    hull.position.y = 0.3
    const cabin = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.9, 2.2, 2, 0.1), new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.5 }))
    cabin.position.set(0, 0.95, -1)
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 4, 5), new THREE.MeshStandardMaterial({ color: 0xd6d0c4, metalness: 0.5 }))
    mast.position.set(0, 2.3, 1)
    g.add(hull, cabin, mast)
    g.position.set(rnd(-160, 160), -0.1, rnd(300, 390))
    g.rotation.y = rnd(0, 6.28)
    g.userData = { phase: Math.random() * 10, baseY: -0.1, speed: rnd(0.01, 0.04) }
    scene.add(g)
    boats.push(g)
  }
  return boats
}

function makeMissionMarker(scene) {
  const group = new THREE.Group()
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.4, 26, 24, 1, true), beamMat)
  beam.position.y = 13
  group.add(beam)
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.1, 8, 48), ringMat)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.18
  group.add(ring)
  const ring2 = ring.clone()
  ring2.scale.setScalar(1.5)
  ring2.material = ringMat.clone()
  ring2.material.opacity = 0.4
  ring2.position.y = 0.4
  group.add(ring2)
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,179,71,.85)', 'rgba(255,120,30,0)'), color: 0xffb347, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
  glow.position.y = 1.2
  glow.scale.set(9, 9, 1)
  group.add(glow)
  group.position.set(CITY.target.x, 0.15, CITY.target.z)
  scene.add(group)
  return { group, beam, ring, ring2, glow }
}

export function buildCity(scene, opts = {}) {
  const low = !!opts.low
  const colliders = []
  const staticRoot = new THREE.Group()
  const windows = makeWindows(staticRoot)
  makeSky(staticRoot, low)
  makeGround(staticRoot)
  makeBlockSlabs(staticRoot)
  makeRoads(staticRoot)
  makeBeach(staticRoot)
  makeBeachArch(staticRoot)
  colliders.push({ minX: -13.6, maxX: -11.4, minZ: 206.9, maxZ: 209.1, h: 10 }, { minX: 11.4, maxX: 13.6, minZ: 206.9, maxZ: 209.1, h: 10 })
  const ocean = makeOcean(staticRoot)
  const blocks = makeBuildings(staticRoot, colliders, windows)
  windows.build()
  makePalms(staticRoot)
  makeStreetLights(staticRoot, low)
  makeStreetProps(staticRoot)
  buildSignGlows(staticRoot)
  mergeStatic(staticRoot)
  scene.add(staticRoot)
  const traffic = makeTraffic(scene, low)
  const peds = makePedestrians(scene, low)
  const birds = makeSeagulls(scene, low)
  const boats = makeBoats(scene)
  const marker = makeMissionMarker(scene)

  const hemi = new THREE.HemisphereLight(0x8f75ff, 0xff7040, 0.74)
  scene.add(hemi)
  const sunLight = new THREE.DirectionalLight(0xffa363, 2.15)
  sunLight.position.set(-110, 150, 240)
  sunLight.castShadow = !low
  sunLight.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048)
  sunLight.shadow.camera.left = -130
  sunLight.shadow.camera.right = 130
  sunLight.shadow.camera.top = 130
  sunLight.shadow.camera.bottom = -130
  sunLight.shadow.camera.near = 1
  sunLight.shadow.camera.far = 420
  sunLight.shadow.bias = -0.0004
  sunLight.shadow.normalBias = 0.025
  scene.add(sunLight)
  scene.add(sunLight.target)
  const fill = new THREE.DirectionalLight(0x6b7bff, 0.4)
  fill.position.set(-120, 80, -140)
  scene.add(fill)
  if (!low) {
    const warm = new THREE.DirectionalLight(0xff8c55, 0.24)
    warm.position.set(0, 30, 300)
    scene.add(warm)
  }

  const markerState = marker

  function setTarget(x, z) {
    markerState.group.position.set(x, 0.15, z)
    markerState.group.visible = true
  }

  function update(dt, time, playerPos) {
    ocean.mat.uniforms.uTime.value = time
    const pulse = 0.5 + Math.sin(time * 2.4) * 0.5
    ocean.foam.material.opacity = 0.25 + pulse * 0.2
    ocean.foam2.material.opacity = 0.12 + (1 - pulse) * 0.12

    markerState.ring.rotation.z += dt * 0.6
    markerState.ring2.rotation.z -= dt * 0.35
    markerState.beam.material.opacity = 0.1 + Math.sin(time * 2) * 0.035
    markerState.glow.material.opacity = 0.5 + Math.sin(time * 3) * 0.2
    markerState.group.position.y = 0.15 + Math.sin(time * 1.7) * 0.08

    for (const car of traffic) {
      car.pos += car.dir * car.speed * dt
      if (car.pos > 205) car.pos = -205
      if (car.pos < -205) car.pos = 205
      if (car.axis === 'z') car.group.position.z = car.pos
      else car.group.position.x = car.pos
    }

    for (const ped of peds) {
      if (ped.dead) {
        ped.fall = Math.min(1, ped.fall + dt * 2.6)
        ped.group.rotation.x = ped.fall * 1.45
        ped.group.position.y = Math.max(0.06, 0.1 - ped.fall * 0.04)
        continue
      }
      ped.pos += ped.dir * ped.speed * dt
      if (ped.pos > 190) ped.pos = -190
      if (ped.pos < -190) ped.pos = 190
      if (ped.axis === 'z') ped.group.position.z = ped.pos
      else ped.group.position.x = ped.pos
      const swing = Math.sin(time * (4.4 + ped.speed * 1.2) + ped.phase) * 0.42
      ped.legL.rotation.x = swing
      ped.legR.rotation.x = -swing
      ped.group.position.y = 0.1 + Math.abs(Math.sin(time * 5 + ped.phase)) * 0.025
    }

    for (const b of birds) {
      const u = b.userData
      const a = time * u.speed + u.phase
      b.position.x = u.cx + Math.cos(a) * u.radius
      b.position.z = u.cz + Math.sin(a) * u.radius
      b.position.y = u.y + Math.sin(a * 2) * 1.2
      b.rotation.y = -a
      u.l.rotation.z = Math.sin(time * 9 + u.phase) * 0.4
      u.r.rotation.z = -Math.sin(time * 9 + u.phase) * 0.4
    }

    for (const b of boats) {
      b.position.y = b.userData.baseY + Math.sin(time * 0.9 + b.userData.phase) * 0.16
      b.rotation.z = Math.sin(time * 0.7 + b.userData.phase) * 0.025
    }

    if (playerPos) {
      sunLight.position.set(playerPos.x - 110, 150, playerPos.z + 240)
      sunLight.target.position.set(playerPos.x, 0, playerPos.z)
      sunLight.target.updateMatrixWorld()
    }
  }

  return {
    colliders, blocks, traffic, peds, marker: markerState, setTarget, update,
    roads: CITY.roads, centers: CITY.centers, beach: CITY.beachStart, shore: CITY.shore
  }
}
