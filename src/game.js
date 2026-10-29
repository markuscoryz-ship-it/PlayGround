import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import {
  makeFacade, makeAsphalt, makeConcrete, makeSand, makeBillboardTexture,
  makeGlowTexture, makeSmokeTexture, mulberry32
} from './textures.js'
import {
  createCar, animateCar, createCharacter, animateCharacter, createPalm,
  createStreetLight, createMarker, createFountain, makeBuildingGeometry,
  createPoliceCar, animatePoliceLights
} from './models.js'
import { AudioFX } from './audio.js'

const $ = (id) => document.getElementById(id)
const dom = {
  canvas: $('game'),
  hud: $('hud'),
  start: $('start-screen'),
  startBtn: $('start-btn'),
  tiltStart: $('tilt-start'),
  soundStart: $('sound-start'),
  pause: $('pause-screen'),
  pauseBtn: $('btn-pause'),
  resumeBtn: $('resume-btn'),
  restartBtn: $('restart-btn'),
  tiltPause: $('tilt-pause'),
  soundPause: $('sound-pause'),
  money: $('money'),
  stars: $('stars'),
  objectiveKicker: $('objective-kicker'),
  objectiveTitle: $('objective-title'),
  objectiveSub: $('objective-sub'),
  objectiveTimer: $('objective-timer'),
  toast: $('toast'),
  speedo: $('speedo'),
  speedValue: $('speed-value'),
  speedFill: $('speed-fill'),
  prompt: $('prompt'),
  actionBtn: $('btn-action'),
  brakeBtn: $('btn-brake'),
  sprintBtn: $('btn-sprint'),
  joystickZone: $('joystick-zone'),
  joystickBase: $('joystick-base'),
  joystickKnob: $('joystick-knob'),
  lookZone: $('look-zone'),
  minimap: $('minimap'),
  pauseMoney: $('pause-money'),
  pauseDeliveries: $('pause-deliveries'),
  pauseSpeed: $('pause-speed'),
  flash: $('flash'),
  error: $('error-overlay')
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
const damp = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt))
const lerpAngle = (a, b, t) => {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI
  if (diff < -Math.PI) diff += Math.PI * 2
  return a + diff * t
}
const distance2D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)

const CELL = 90
const ROAD = 16
const GRID = 6
const HALF = CELL * GRID / 2
const BLOCK_HALF = (CELL - ROAD) / 2
const WORLD_LIMIT = HALF + 20
const SPAWN = { x: 4, z: 34, heading: Math.PI }

const state = {
  mode: 'menu',
  started: false,
  money: 2500,
  deliveries: 0,
  topSpeed: 0,
  heat: 0,
  time: 0,
  mission: {
    active: false,
    cooldown: 0,
    timeLeft: 120,
    target: new THREE.Vector3(),
    distance: 0
  }
}

const player = {
  position: new THREE.Vector3(SPAWN.x, 0, SPAWN.z),
  heading: SPAWN.heading,
  speed: 0,
  moving: false,
  car: null,
  character: null
}

const world = {
  colliders: [],
  buildings: [],
  cars: [],
  police: [],
  peds: [],
  palms: [],
  marker: null,
  playerCar: null
}

const cameraRig = {
  heading: SPAWN.heading,
  lookYaw: 0,
  lookPitch: 0,
  basePitch: 0.3,
  distance: 8.5,
  shake: 0,
  snap: true
}

const input = {
  joyActive: false,
  joyX: 0,
  joyY: 0,
  brake: false,
  sprint: false,
  keys: new Set(),
  lookActive: false,
  lookId: null,
  lookX: 0,
  lookY: 0
}

const tilt = {
  enabled: false,
  listening: false,
  target: 0,
  value: 0,
  available: typeof window.DeviceOrientationEvent !== 'undefined'
}

const particles = {
  pool: [],
  spawnTimer: 0
}

const audio = new AudioFX()

let renderer
try {
  renderer = new THREE.WebGLRenderer({
    canvas: dom.canvas,
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false
  })
} catch (error) {
  dom.error.classList.remove('hidden')
  throw error
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.85))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.12
const glInfo = renderer.getContext().getExtension('WEBGL_debug_renderer_info')
const gpuName = glInfo ? renderer.getContext().getParameter(glInfo.UNMASKED_RENDERER_WEBGL) : ''
const softwareRenderer = /swiftshader|llvmpipe|software/i.test(gpuName)

const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0x2a1530, 0.00165)

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 4000)
camera.position.set(120, 70, 120)
camera.lookAt(0, 12, 0)

const clock = new THREE.Clock()
const rng = mulberry32(20261029)
const glowTexture = makeGlowTexture()
const smokeTexture = makeSmokeTexture()

function initialize() {
  createSky()
  createLights()
  createGround()
  createCity()
  createProps()
  createTraffic()
  createPedestrians()
  createPlayer()
  createParticles()
  setActorsVisible(false)
  bindUI()
  updateHud()
  updateTiltUi()
  updateSoundUi()
}

/* ------------------------------------------------------------------ */
/* World                                                              */
/* ------------------------------------------------------------------ */

function createSky() {
  const sunDirection = new THREE.Vector3(-0.82, 0.07, -0.57).normalize()
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x10061f) },
      midColor: { value: new THREE.Color(0x43164e) },
      horizonColor: { value: new THREE.Color(0xff6a55) },
      sunColor: { value: new THREE.Color(0xff9448) },
      sunDirection: { value: sunDirection }
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vDir = normalize(worldPosition.xyz - cameraPosition);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      uniform vec3 sunColor;
      uniform vec3 sunDirection;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, -0.08, 1.0);
        vec3 color = mix(horizonColor, midColor, smoothstep(-0.01, 0.16, h));
        color = mix(color, topColor, smoothstep(0.14, 0.62, h));
        float sunDot = max(dot(normalize(vDir), normalize(sunDirection)), 0.0);
        color += sunColor * pow(sunDot, 1400.0) * 3.4;
        color += sunColor * pow(sunDot, 90.0) * 0.12;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 18), skyMaterial)
  sky.renderOrder = -10
  scene.add(sky)

  const starCount = 320
  const positions = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i++) {
    const radius = 1600
    const u = rng() * Math.PI * 2
    const v = 0.2 + rng() * 0.78
    const y = Math.sqrt(v) * radius
    const rr = Math.sqrt(Math.max(0, radius * radius - y * y))
    positions[i * 3] = Math.cos(u) * rr
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = Math.sin(u) * rr
  }
  const starGeometry = new THREE.BufferGeometry()
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({
    color: 0xc9b8ff,
    size: 1.7,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    toneMapped: false
  }))
  stars.renderOrder = -9
  scene.add(stars)
}

function createLights() {
  const hemi = new THREE.HemisphereLight(0xc3a0ff, 0x3a2038, 2.05)
  scene.add(hemi)

  const ambient = new THREE.AmbientLight(0x6a4d8a, 0.8)
  scene.add(ambient)

  const sunLight = new THREE.DirectionalLight(0xffb27a, 3.1)
  sunLight.position.set(-130, 150, -190)
  scene.add(sunLight)

  const rim = new THREE.DirectionalLight(0x39f5ff, 0.85)
  rim.position.set(120, 70, 160)
  scene.add(rim)

  const fill = new THREE.DirectionalLight(0x8c9dff, 0.95)
  fill.position.set(160, 90, 120)
  scene.add(fill)
}

function createGround() {
  const asphaltMap = makeAsphalt()
  asphaltMap.repeat.set(46, 46)
  const cityGround = new THREE.Mesh(
    new THREE.PlaneGeometry(572, 572),
    new THREE.MeshStandardMaterial({ map: asphaltMap, color: 0xe8e2f0, roughness: 0.89, metalness: 0.05 })
  )
  cityGround.rotation.x = -Math.PI / 2
  cityGround.position.y = 0
  scene.add(cityGround)

  const sandMap = makeSand()
  sandMap.repeat.set(34, 34)
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(880, 880),
    new THREE.MeshStandardMaterial({ map: sandMap, color: 0xcab199, roughness: 1 })
  )
  beach.rotation.x = -Math.PI / 2
  beach.position.y = -0.14
  scene.add(beach)

  const oceanMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x04121f) },
      uShallow: { value: new THREE.Color(0x0c3e51) },
      uSun: { value: new THREE.Color(0xffb16b) }
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld;
      void main() {
        vec3 p = position;
        float wave = sin(p.x * 0.035 + uTime * 0.9) * 0.34 + sin(p.y * 0.052 - uTime * 1.3) * 0.22;
        p.z += wave;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSun;
      varying vec3 vWorld;
      void main() {
        float bands = 0.5 + 0.5 * sin(vWorld.x * 0.021 + vWorld.z * 0.028 + uTime * 0.8);
        vec3 col = mix(uDeep, uShallow, bands * 0.74);
        float glint = pow(max(0.0, sin(vWorld.x * 0.14 + vWorld.z * 0.11 + uTime * 2.1)), 26.0);
        col += uSun * glint * 0.42;
        float dist = length(vWorld - cameraPosition);
        col = mix(col, vec3(0.17, 0.08, 0.19), smoothstep(420.0, 1500.0, dist));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    fog: false
  })
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000, 1, 1), oceanMaterial)
  ocean.rotation.x = -Math.PI / 2
  ocean.position.y = -1.1
  scene.add(ocean)
  world.oceanMaterial = oceanMaterial

  createRoadMarkings()
}

function createRoadMarkings() {
  const dashGeometry = new THREE.BoxGeometry(0.24, 0.025, 3.2)
  const dashMaterial = new THREE.MeshBasicMaterial({ color: 0xd8cfb1, transparent: true, opacity: 0.66, toneMapped: false })
  const matrices = []
  const crosswalkMatrices = []
  const dummy = new THREE.Object3D()
  const lines = []
  for (let i = 0; i <= GRID; i++) lines.push(-HALF + i * CELL)

  const nearLine = (value) => {
    let best = Infinity
    for (const line of lines) best = Math.min(best, Math.abs(value - line))
    return best
  }

  for (const z of lines) {
    for (let x = -HALF + 10; x <= HALF - 10; x += 10) {
      if (nearLine(x) < ROAD + 5) continue
      dummy.position.set(x, 0.035, z)
      dummy.rotation.set(0, Math.PI / 2, 0)
      dummy.updateMatrix()
      matrices.push(dummy.matrix.clone())
    }
  }
  for (const x of lines) {
    for (let z = -HALF + 10; z <= HALF - 10; z += 10) {
      if (nearLine(z) < ROAD + 5) continue
      dummy.position.set(x, 0.035, z)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      matrices.push(dummy.matrix.clone())
    }
  }

  for (const gx of lines) {
    for (const gz of lines) {
      for (const offset of [-1, 1]) {
        for (let i = -4; i <= 4; i++) {
          dummy.position.set(gx + i * 1.55, 0.036, gz + offset * (ROAD / 2 + 2.6))
          dummy.rotation.set(0, 0, 0)
          dummy.updateMatrix()
          crosswalkMatrices.push(dummy.matrix.clone())
          dummy.position.set(gx + offset * (ROAD / 2 + 2.6), 0.036, gz + i * 1.55)
          dummy.rotation.set(0, Math.PI / 2, 0)
          dummy.updateMatrix()
          crosswalkMatrices.push(dummy.matrix.clone())
        }
      }
    }
  }

  const dashes = new THREE.InstancedMesh(dashGeometry, dashMaterial, matrices.length)
  matrices.forEach((matrix, index) => dashes.setMatrixAt(index, matrix))
  dashes.instanceMatrix.needsUpdate = true
  scene.add(dashes)

  const crosswalks = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.68, 0.025, 2.6),
    new THREE.MeshBasicMaterial({ color: 0xe7dfca, transparent: true, opacity: 0.55, toneMapped: false }),
    crosswalkMatrices.length
  )
  crosswalkMatrices.forEach((matrix, index) => crosswalks.setMatrixAt(index, matrix))
  crosswalks.instanceMatrix.needsUpdate = true
  scene.add(crosswalks)

  const curbMaterial = new THREE.MeshBasicMaterial({ color: 0x39f5ff, transparent: true, opacity: 0.5, toneMapped: false })
  for (const x of [-ROAD / 2 - 0.35, ROAD / 2 + 0.35]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 520), curbMaterial)
    strip.position.set(x, 0.16, 0)
    scene.add(strip)
  }
  for (const z of [-ROAD / 2 - 0.35, ROAD / 2 + 0.35]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(520, 0.06, 0.16), curbMaterial)
    strip.position.set(0, 0.16, z)
    scene.add(strip)
  }
}

function blockCenters() {
  const centers = []
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      centers.push({ x: -HALF + CELL * (i + 0.5), z: -HALF + CELL * (j + 0.5), i, j })
    }
  }
  return centers
}

const palettes = [
  ['#5b4a72', '#33294a'], ['#2d5a68', '#1b3444'], ['#75445f', '#45273a'],
  ['#3d4f8a', '#202a4c'], ['#6b5a43', '#3a2f22'], ['#756687', '#3c334a']
]

function createCity() {
  const concrete = makeConcrete()
  concrete.repeat.set(2, 2)
  const sidewalkMaterial = new THREE.MeshStandardMaterial({ map: concrete, color: 0xb6aabf, roughness: 0.94 })
  const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x1e5237, roughness: 0.96 })
  const metalMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2934, metalness: 0.7, roughness: 0.45 })

  const facadeSets = palettes.map((palette, index) => makeFacade(9100 + index * 71, palette))
  const facadeMaterials = facadeSets.map((set) => new THREE.MeshStandardMaterial({
    map: set.map,
    emissiveMap: set.emissiveMap,
    emissive: 0xffffff,
    emissiveIntensity: 1.1,
    metalness: 0.12,
    roughness: 0.74
  }))
  const variantGeometries = palettes.map(() => [])
  const roofDetails = []
  const neon = { pink: [], cyan: [], amber: [], violet: [] }
  const neonColors = [
    { key: 'pink', color: 0xff2d87 }, { key: 'cyan', color: 0x39f5ff },
    { key: 'amber', color: 0xffbe3d }, { key: 'violet', color: 0x9f76ff }
  ]

  const sidewalkGeometries = []
  const centers = blockCenters()
  const parkCenter = centers.find((c) => c.i === 2 && c.j === 2)
  world.park = parkCenter

  for (const center of centers) {
    const sidewalk = new THREE.BoxGeometry(CELL - ROAD, 0.15, CELL - ROAD)
    sidewalk.translate(center.x, 0.075, center.z)
    sidewalkGeometries.push(sidewalk)

    if (center === parkCenter) {
      const grass = new THREE.Mesh(new THREE.BoxGeometry(CELL - ROAD - 1, 0.2, CELL - ROAD - 1), grassMaterial)
      grass.position.set(center.x, 0.18, center.z)
      scene.add(grass)
      const fountain = createFountain()
      fountain.position.set(center.x, 0.2, center.z)
      scene.add(fountain)
      world.colliders.push({ x: center.x, z: center.z, hw: 6.2, hd: 6.2, height: 4 })
      world.palms.push({ x: center.x - 22, z: center.z - 22 })
      world.palms.push({ x: center.x + 22, z: center.z - 20 })
      world.palms.push({ x: center.x - 21, z: center.z + 23 })
      world.palms.push({ x: center.x + 24, z: center.z + 22 })
      continue
    }

    const footprints = []
    const layout = rng()
    const heightBoost = Math.max(0, 1 - Math.hypot(center.x, center.z) / (HALF * 1.15))

    if (layout < 0.34) {
      const w1 = 19 + rng() * 13
      const w2 = 19 + rng() * 13
      const gap = 4 + rng() * 2
      const total = w1 + w2 + gap
      if (total < 70) {
        const depth = 32 + rng() * 30
        const start = -total / 2
        footprints.push({ x: center.x + start + w1 / 2, z: center.z, w: w1, d: depth })
        footprints.push({ x: center.x + start + w1 + gap + w2 / 2, z: center.z, w: w2, d: depth })
      }
    } else if (layout < 0.58) {
      const d1 = 19 + rng() * 13
      const d2 = 19 + rng() * 13
      const gap = 4 + rng() * 2
      const total = d1 + d2 + gap
      if (total < 70) {
        const width = 32 + rng() * 28
        const start = -total / 2
        footprints.push({ x: center.x, z: center.z + start + d1 / 2, w: width, d: d1 })
        footprints.push({ x: center.x, z: center.z + start + d1 + gap + d2 / 2, w: width, d: d2 })
      }
    }

    if (!footprints.length) {
      const w = 34 + rng() * 26
      const d = 34 + rng() * 26
      footprints.push({
        x: center.x + (rng() - 0.5) * (68 - w),
        z: center.z + (rng() - 0.5) * (68 - d),
        w,
        d
      })
    }

    for (const footprint of footprints) {
      const variant = Math.floor(rng() * palettes.length)
      const height = clamp(13 + rng() * 24 + heightBoost * (24 + rng() * 34), 12, 94)
      const geometry = makeBuildingGeometry(footprint.w, height, footprint.d)
      geometry.translate(footprint.x, height / 2 + 0.15, footprint.z)
      variantGeometries[variant].push(geometry)
      world.colliders.push({ x: footprint.x, z: footprint.z, hw: footprint.w / 2 + 0.2, hd: footprint.d / 2 + 0.2, height })
      world.buildings.push({ ...footprint, h: height })

      const roofCap = new THREE.BoxGeometry(footprint.w + 0.08, 0.28, footprint.d + 0.08)
      roofCap.translate(footprint.x, height + 0.29, footprint.z)
      roofDetails.push(roofCap)

      if (rng() < 0.82) {
        const acCount = 1 + Math.floor(rng() * 3)
        for (let i = 0; i < acCount; i++) {
          const w = 1.8 + rng() * 3.6
          const d = 1.8 + rng() * 3.4
          const h = 0.7 + rng() * 1.6
          const box = new THREE.BoxGeometry(w, h, d)
          box.translate(
            footprint.x + (rng() - 0.5) * (footprint.w - w - 2),
            height + h / 2 + 0.18,
            footprint.z + (rng() - 0.5) * (footprint.d - d - 2)
          )
          roofDetails.push(box)
        }
      }

      if (rng() < 0.38) {
        const neonChoice = neonColors[Math.floor(rng() * neonColors.length)]
        const top = height + 0.65
        const thickness = 0.14
        const strips = [
          [footprint.w, thickness, thickness, 0, top, -footprint.d / 2],
          [footprint.w, thickness, thickness, 0, top, footprint.d / 2],
          [thickness, thickness, footprint.d, -footprint.w / 2, top, 0],
          [thickness, thickness, footprint.d, footprint.w / 2, top, 0]
        ]
        for (const [w, h, d, dx, y, dz] of strips) {
          const strip = new THREE.BoxGeometry(w, h, d)
          strip.translate(footprint.x + dx, y, footprint.z + dz)
          neon[neonChoice.key].push(strip)
        }
      }

      if (rng() < 0.26 && height > 26) {
        const neonChoice = neonColors[Math.floor(rng() * neonColors.length)]
        const side = rng() < 0.5 ? -1 : 1
        const strip = new THREE.BoxGeometry(0.16, height * 0.82, 0.16)
        strip.translate(
          footprint.x + side * (footprint.w / 2 + 0.06),
          height * 0.42,
          footprint.z + (rng() < 0.5 ? -1 : 1) * (footprint.d / 2 + 0.06)
        )
        neon[neonChoice.key].push(strip)
      }

      if (height > 42 && rng() < 0.36) {
        const antenna = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.13, 5 + rng() * 5, 5),
          metalMaterial
        )
        antenna.position.set(footprint.x, height + 2.8, footprint.z)
        scene.add(antenna)
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 6, 4),
          new THREE.MeshBasicMaterial({ color: 0xff3355, toneMapped: false })
        )
        beacon.position.set(footprint.x, height + 5.5, footprint.z)
        scene.add(beacon)
      }
    }
  }

  if (sidewalkGeometries.length) {
    const merged = mergeGeometries(sidewalkGeometries, false)
    const sidewalks = new THREE.Mesh(merged, sidewalkMaterial)
    scene.add(sidewalks)
  }

  variantGeometries.forEach((geometries, index) => {
    if (!geometries.length) return
    const merged = mergeGeometries(geometries, false)
    const mesh = new THREE.Mesh(merged, facadeMaterials[index])
    scene.add(mesh)
  })

  if (roofDetails.length) {
    const merged = mergeGeometries(roofDetails, false)
    scene.add(new THREE.Mesh(merged, metalMaterial))
  }

  for (const [key, color] of Object.entries({ pink: 0xff2d87, cyan: 0x39f5ff, amber: 0xffbe3d, violet: 0x9f76ff })) {
    if (!neon[key].length) continue
    const merged = mergeGeometries(neon[key], false)
    const material = new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0.86 })
    scene.add(new THREE.Mesh(merged, material))
  }

  createBillboards()
}

function createBillboards() {
  const texts = ['VICE', 'NEON', 'SUNSET', 'ARCADE', 'HOTEL', 'GTA VII', 'HARBOR', 'NIGHT']
  const colors = ['#ff2d87', '#39f5ff', '#ffbe3d', '#9f76ff']
  const candidates = world.buildings.filter((b) => b.h > 20)
  let made = 0
  while (made < 8 && candidates.length) {
    const building = candidates[Math.floor(rng() * candidates.length)]
    const face = Math.floor(rng() * 4)
    const width = clamp(building.w * 0.62, 8, 17)
    const height = width * 0.5
    const texture = makeBillboardTexture(texts[made % texts.length], colors[made % colors.length])
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide })
    )
    const y = Math.min(building.h * 0.58 + 6, building.h - 3)
    if (face === 0) {
      plane.position.set(building.x, y, building.z + building.d / 2 + 0.15)
    } else if (face === 1) {
      plane.position.set(building.x, y, building.z - building.d / 2 - 0.15)
      plane.rotation.y = Math.PI
    } else if (face === 2) {
      plane.position.set(building.x + building.w / 2 + 0.15, y, building.z)
      plane.rotation.y = Math.PI / 2
    } else {
      plane.position.set(building.x - building.w / 2 - 0.15, y, building.z)
      plane.rotation.y = -Math.PI / 2
    }
    scene.add(plane)
    made++
  }
}

function createProps() {
  const centers = blockCenters()
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  const chosen = []

  for (let i = 0; i < 26; i++) {
    const block = centers[Math.floor(rng() * centers.length)]
    if (block === world.park) continue
    const corner = corners[Math.floor(rng() * corners.length)]
    chosen.push({
      x: block.x + corner[0] * (BLOCK_HALF - 3.8),
      z: block.z + corner[1] * (BLOCK_HALF - 3.8)
    })
  }

  for (const position of [...world.palms, ...chosen]) {
    const palm = createPalm()
    palm.position.set(position.x, 0.12, position.z)
    palm.rotation.y = rng() * Math.PI * 2
    const scale = 0.82 + rng() * 0.45
    palm.scale.setScalar(scale)
    scene.add(palm)
    world.palms.push(palm)
  }
  world.palms = world.palms.filter((p) => p.isObject3D)

  const lightPositions = []
  for (let i = -2; i <= 2; i++) {
    const z = i * CELL + 24
    lightPositions.push({ x: ROAD / 2 + 2.6, z, rot: Math.PI })
    lightPositions.push({ x: -ROAD / 2 - 2.6, z, rot: 0 })
  }
  for (let i = -2; i <= 2; i++) {
    const x = i * CELL + 24
    lightPositions.push({ x, z: ROAD / 2 + 2.6, rot: -Math.PI / 2 })
    lightPositions.push({ x, z: -ROAD / 2 - 2.6, rot: Math.PI / 2 })
  }
  const poolMaterial = new THREE.MeshBasicMaterial({
    map: glowTexture,
    color: 0xffbe73,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  })
  for (const spot of lightPositions) {
    const light = createStreetLight()
    light.position.set(spot.x, 0.12, spot.z)
    light.rotation.y = spot.rot
    scene.add(light)
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), poolMaterial)
    pool.rotation.x = -Math.PI / 2
    pool.position.set(spot.x, 0.19, spot.z)
    scene.add(pool)
  }
}

function createTraffic() {
  const colors = [0x2f8bff, 0xffbe3d, 0xff5c77, 0x86f3c8, 0xd7d1e6, 0x8f6bff, 0xff8c42]
  const types = ['sedan', 'sedan', 'sedan', 'sports', 'taxi']
  const centers = blockCenters().filter((c) => c !== world.park)

  world.playerCar = addCar({
    x: SPAWN.x - 2.6,
    z: SPAWN.z,
    heading: SPAWN.heading,
    color: 0xff2d87,
    accent: 0x39f5ff,
    type: 'sports',
    ai: false
  })

  const parked = [
    { x: -6.6, z: 92, heading: 0, color: 0x2f8bff, type: 'sedan' },
    { x: 6.6, z: -54, heading: Math.PI, color: 0xffbe3d, type: 'taxi' },
    { x: -6.6, z: -142, heading: Math.PI, color: 0x86f3c8, type: 'sedan' },
    { x: 142, z: -6.6, heading: -Math.PI / 2, color: 0x8f6bff, type: 'sports' },
    { x: -110, z: 6.6, heading: Math.PI / 2, color: 0xff5c77, type: 'sedan' },
    { x: 6.6, z: 176, heading: Math.PI, color: 0xd7d1e6, type: 'sedan' }
  ]
  for (const spot of parked) {
    addCar({ ...spot, accent: 0x39f5ff, ai: false })
  }

  for (let i = 0; i < 10; i++) {
    const center = centers[Math.floor(rng() * centers.length)]
    const radius = CELL / 2
    const clockwise = rng() < 0.5
    const points = [
      { x: center.x + radius, z: center.z + radius },
      { x: center.x - radius, z: center.z + radius },
      { x: center.x - radius, z: center.z - radius },
      { x: center.x + radius, z: center.z - radius }
    ]
    const start = Math.floor(rng() * 4)
    const point = points[start]
    const car = addCar({
      x: point.x,
      z: point.z,
      heading: 0,
      color: colors[i % colors.length],
      accent: 0x39f5ff,
      type: types[i % types.length],
      ai: false
    })
    car.ai = {
      points,
      next: (start + (clockwise ? 1 : 3)) % 4,
      direction: clockwise ? 1 : -1,
      cruise: 7 + rng() * 5
    }
    const target = points[car.ai.next]
    car.heading = Math.atan2(target.x - car.pos.x, target.z - car.pos.z)
    car.mesh.rotation.y = car.heading
  }
}

function addCar({ x, z, heading, color, accent, type, ai }) {
  const mesh = createCar({ color, accent, type })
  mesh.position.set(x, 0, z)
  mesh.rotation.y = heading
  scene.add(mesh)
  const car = {
    mesh,
    pos: new THREE.Vector3(x, 0, z),
    heading,
    speed: 0,
    steer: 0,
    ai: ai ? {} : null,
    type,
    color,
    isPlayer: false,
    baseY: 0
  }
  world.cars.push(car)
  return car
}

function createPedestrians() {
  const centers = blockCenters().filter((c) => c !== world.park)
  const jackets = [0xff2d87, 0x39f5ff, 0xffbe3d, 0x9f76ff, 0x5cffb1, 0xff7a4d, 0xd7c9ff]
  const pants = [0x1d2436, 0x2a1b2e, 0x172a2a, 0x2e2618]
  for (let i = 0; i < 12; i++) {
    const center = centers[Math.floor(rng() * centers.length)]
    const radius = BLOCK_HALF - 3.4
    const points = [
      { x: center.x + radius, z: center.z + radius },
      { x: center.x - radius, z: center.z + radius },
      { x: center.x - radius, z: center.z - radius },
      { x: center.x + radius, z: center.z - radius }
    ]
    const start = Math.floor(rng() * 4)
    const character = createCharacter({
      jacket: jackets[i % jackets.length],
      pants: pants[i % pants.length],
      skin: [0xc98d6b, 0x8a5a3c, 0xe0b38f, 0x6f4630][i % 4],
      hair: [0x17111c, 0x2f2116, 0x553a20, 0x0b0b10][i % 4]
    })
    const point = points[start]
    character.position.set(point.x, 0.13, point.z)
    scene.add(character)
    const ped = {
      mesh: character,
      pos: new THREE.Vector3(point.x, 0, point.z),
      heading: rng() * Math.PI * 2,
      speed: 0.7 + rng() * 0.9,
      phase: rng() * Math.PI * 2,
      points,
      next: (start + 1) % 4,
      direction: 1
    }
    world.peds.push(ped)
  }
}

function createPlayer() {
  player.character = createCharacter({ jacket: 0xff2d87, pants: 0x1d2436, skin: 0xc98d6b, hair: 0x17111c })
  player.character.position.copy(player.position)
  player.character.rotation.y = player.heading
  scene.add(player.character)
  player.character.visible = false
}

/* ------------------------------------------------------------------ */
/* Mission + markers                                                  */
/* ------------------------------------------------------------------ */

function setActorsVisible(visible) {
  for (const car of world.cars) car.mesh.visible = visible
  for (const ped of world.peds) ped.mesh.visible = visible
  for (const police of world.police) police.mesh.visible = visible
  if (player.character) player.character.visible = visible
}

function createMissionMarker() {
  const marker = createMarker()
  marker.visible = false
  scene.add(marker)
  world.marker = marker
}

function pickDropOff() {
  const lines = []
  for (let i = 0; i <= GRID; i++) lines.push(-HALF + i * CELL)
  let best = null
  for (let attempt = 0; attempt < 80; attempt++) {
    const x = lines[Math.floor(rng() * lines.length)]
    const z = lines[Math.floor(rng() * lines.length)]
    const distance = Math.hypot(x - player.position.x, z - player.position.z)
    if (distance > 115 && distance < 320) {
      best = new THREE.Vector3(x, 0.1, z)
      break
    }
  }
  if (!best) best = new THREE.Vector3(90, 0.1, -90)
  return best
}

function startMission() {
  const target = pickDropOff()
  state.mission.target.copy(target)
  state.mission.active = true
  state.mission.cooldown = 0
  state.mission.timeLeft = 120
  world.marker.position.copy(target)
  world.marker.visible = true
  state.heat = Math.max(0, state.heat - 0.4)
  toast('NEW DELIVERY · GET MOVING', 'good')
}

function completeMission() {
  const reward = 450 + Math.round(state.mission.timeLeft * 11)
  state.money += reward
  state.deliveries++
  state.heat = Math.max(0, state.heat - 0.75)
  state.mission.active = false
  state.mission.cooldown = 4.5
  world.marker.visible = false
  audio.success()
  flashScreen()
  toast(`DELIVERY COMPLETE +$${reward.toLocaleString()}`, 'good')
}

function failMission() {
  state.mission.active = false
  state.mission.cooldown = 4.5
  world.marker.visible = false
  audio.fail()
  toast('TIME UP · DELIVERY FAILED', 'warn')
}

function updateMission(dt) {
  if (state.mission.active) {
    const car = player.car
    const pos = car ? car.pos : player.position
    state.mission.distance = distance2D(pos, state.mission.target)
    if (car) {
      state.mission.timeLeft -= dt
      if (state.mission.timeLeft <= 0) {
        state.mission.timeLeft = 0
        failMission()
      } else if (state.mission.distance < 7) {
        completeMission()
      }
    }
  } else if (state.mission.cooldown > 0) {
    state.mission.cooldown -= dt
    if (state.mission.cooldown <= 0) startMission()
  }

  if (world.marker && world.marker.visible) {
    const marker = world.marker
    marker.userData.time += dt
    const t = marker.userData.time
    marker.userData.ring.scale.setScalar(1 + Math.sin(t * 3.4) * 0.14)
    marker.userData.inner.scale.setScalar(0.75 + Math.sin(t * 5.1) * 0.28)
    marker.userData.ring.material.opacity = 0.6 + Math.sin(t * 3.4) * 0.3
    marker.userData.beam.material.opacity = 0.12 + Math.sin(t * 2.2) * 0.05
    marker.userData.arrow.position.y = 5.3 + Math.sin(t * 2.6) * 0.3
    marker.userData.arrow.rotation.y += dt * 1.6
  }
}

/* ------------------------------------------------------------------ */
/* Player + AI                                                        */
/* ------------------------------------------------------------------ */

function combinedAxes() {
  let x = 0
  let y = 0
  if (input.joyActive) {
    x = input.joyX
    y = input.joyY
  }
  const keys = input.keys
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1
  return { x: clamp(x, -1, 1), y: clamp(y, -1, 1) }
}

function updatePlayerFoot(dt) {
  const axes = combinedAxes()
  const magnitude = Math.min(1, Math.hypot(axes.x, axes.y))
  const running = input.sprint
  const cameraYaw = cameraRig.heading + cameraRig.lookYaw

  if (magnitude > 0.08) {
    const forwardX = Math.sin(cameraYaw)
    const forwardZ = Math.cos(cameraYaw)
    const rightX = Math.cos(cameraYaw)
    const rightZ = -Math.sin(cameraYaw)
    let moveX = forwardX * -axes.y + rightX * axes.x
    let moveZ = forwardZ * -axes.y + rightZ * axes.x
    const length = Math.hypot(moveX, moveZ) || 1
    moveX /= length
    moveZ /= length

    const targetSpeed = magnitude * (running ? 8.4 : 4.5)
    player.speed = damp(player.speed, targetSpeed, 10, dt)
    const targetHeading = Math.atan2(moveX, moveZ)
    player.heading = lerpAngle(player.heading, targetHeading, 1 - Math.exp(-14 * dt))
    player.position.x += moveX * player.speed * dt
    player.position.z += moveZ * player.speed * dt
    player.moving = true
    cameraRig.lookYaw = damp(cameraRig.lookYaw, 0, 0.8, dt)
  } else {
    player.speed = damp(player.speed, 0, 11, dt)
    player.moving = false
  }

  collideCircle(player.position, 0.46)
  player.position.x = clamp(player.position.x, -WORLD_LIMIT, WORLD_LIMIT)
  player.position.z = clamp(player.position.z, -WORLD_LIMIT, WORLD_LIMIT)

  player.character.position.copy(player.position)
  player.character.position.y = 0
  player.character.rotation.y = player.heading
  animateCharacter(player.character, player.speed, dt, running && player.speed > 5)
}

function updatePlayerCar(dt) {
  const car = player.car
  if (!car) return
  const axes = combinedAxes()
  const throttle = -axes.y
  const tiltSteer = tilt.enabled ? tilt.value : 0
  const steering = clamp(axes.x + tiltSteer, -1, 1)
  const handbrake = input.brake
  const boosting = input.sprint && car.speed > 2

  const maxForward = boosting ? 44 : 33
  if (throttle > 0.02) {
    car.speed += throttle * (boosting ? 31 : 21) * dt
  } else if (throttle < -0.02) {
    if (car.speed > 0.6) car.speed -= 27 * Math.abs(throttle) * dt
    else car.speed += throttle * 12 * dt
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 4.4 * dt)
  }

  if (handbrake) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 18 * dt)
  }

  car.speed -= car.speed * 0.26 * dt
  car.speed = clamp(car.speed, -11, maxForward)

  const speedFactor = clamp(Math.abs(car.speed) / 9, 0.18, 1.3)
  const grip = handbrake ? 1.85 : 1
  car.steer = damp(car.steer, steering, 9, dt)
  car.heading += car.steer * 2.1 * speedFactor * grip * dt * (car.speed < -0.2 ? -1 : 1)

  const oldSpeed = car.speed
  const forwardX = Math.sin(car.heading)
  const forwardZ = Math.cos(car.heading)
  car.pos.x += forwardX * car.speed * dt
  car.pos.z += forwardZ * car.speed * dt

  const collided = collideCircle(car.pos, 1.72)
  if (collided) {
    const impact = Math.abs(oldSpeed)
    car.speed *= -0.16
    if (impact > 8) {
      cameraRig.shake = Math.max(cameraRig.shake, Math.min(0.9, impact / 24))
      audio.bump(impact / 20)
      flashScreen()
      state.heat = Math.min(5, state.heat + (impact > 18 ? 0.5 : 0.2))
    }
  }

  const nearX = clamp(car.pos.x, -WORLD_LIMIT, WORLD_LIMIT)
  const nearZ = clamp(car.pos.z, -WORLD_LIMIT, WORLD_LIMIT)
  if (nearX !== car.pos.x || nearZ !== car.pos.z) {
    car.pos.x = nearX
    car.pos.z = nearZ
    car.speed *= 0.4
  }

  for (const other of world.cars) {
    if (other === car) continue
    const dx = other.pos.x - car.pos.x
    const dz = other.pos.z - car.pos.z
    const d = Math.hypot(dx, dz)
    if (d < 3.3 && Math.abs(car.speed) > 4) {
      const push = (3.3 - d) / Math.max(0.01, d)
      car.pos.x -= dx * push * 0.7
      car.pos.z -= dz * push * 0.7
      other.speed = Math.min(other.speed + Math.abs(car.speed) * 0.2, 18)
      if (Math.abs(car.speed) > 14) {
        car.speed *= 0.55
        cameraRig.shake = Math.max(cameraRig.shake, 0.55)
        audio.bump(1.2)
        flashScreen()
        state.heat = Math.min(5, state.heat + 0.3)
      }
    }
  }

  car.mesh.position.set(car.pos.x, 0, car.pos.z)
  car.mesh.rotation.set(0, car.heading, -car.steer * 0.035)
  animateCar(car.mesh, car.speed)

  player.position.copy(car.pos)
  player.heading = car.heading
  player.speed = Math.abs(car.speed)
  state.topSpeed = Math.max(state.topSpeed, Math.abs(car.speed) * 3.6)

  if (car.speed > 30) cameraRig.shake = Math.max(cameraRig.shake, 0.06)

  if ((handbrake || Math.abs(car.steer) > 0.72) && Math.abs(car.speed) > 8) {
    particles.spawnTimer -= dt
    if (particles.spawnTimer <= 0) {
      particles.spawnTimer = 0.055
      const rightX = Math.cos(car.heading)
      const rightZ = -Math.sin(car.heading)
      for (const side of [-1, 1]) {
        spawnParticle(
          car.pos.x + rightX * side * 0.85 - forwardX * 1.5,
          0.28,
          car.pos.z + rightZ * side * 0.85 - forwardZ * 1.5,
          0.75 + rng() * 0.35,
          (rng() - 0.5) * 1.4,
          0.7 + rng() * 0.8,
          (rng() - 0.5) * 1.4,
          0xa89aad,
          1.4,
          1.9
        )
      }
      if (rng() < 0.16) audio.skid()
    }
  }

  audio.updateEngine(car.speed, throttle, boosting)

  const carToTarget = distance2D(car.pos, state.mission.target)
  state.mission.distance = carToTarget
}

function updateAI(dt) {
  for (const car of world.cars) {
    if (!car.ai || car === player.car) continue
    const ai = car.ai
    const target = ai.points[ai.next]
    const dx = target.x - car.pos.x
    const dz = target.z - car.pos.z
    if (Math.hypot(dx, dz) < 3.2) {
      ai.next = (ai.next + ai.direction + 4) % 4
    }
    const nextTarget = ai.points[ai.next]
    const targetHeading = Math.atan2(nextTarget.x - car.pos.x, nextTarget.z - car.pos.z)
    car.heading = lerpAngle(car.heading, targetHeading, 1 - Math.exp(-3.3 * dt))
    car.speed = damp(car.speed, ai.cruise, 1.7, dt)
    car.pos.x += Math.sin(car.heading) * car.speed * dt
    car.pos.z += Math.cos(car.heading) * car.speed * dt
    car.mesh.position.set(car.pos.x, 0, car.pos.z)
    car.mesh.rotation.set(0, car.heading, 0)
    animateCar(car.mesh, car.speed)
  }
}

function updatePeds(dt) {
  for (const ped of world.peds) {
    const target = ped.points[ped.next]
    const dx = target.x - ped.pos.x
    const dz = target.z - ped.pos.z
    if (Math.hypot(dx, dz) < 2.2) {
      ped.next = (ped.next + 1) % 4
    }
    const nextTarget = ped.points[ped.next]
    const targetHeading = Math.atan2(nextTarget.x - ped.pos.x, nextTarget.z - ped.pos.z)
    ped.heading = lerpAngle(ped.heading, targetHeading, 1 - Math.exp(-4 * dt))
    ped.pos.x += Math.sin(ped.heading) * ped.speed * dt
    ped.pos.z += Math.cos(ped.heading) * ped.speed * dt
    ped.mesh.position.set(ped.pos.x, 0.13, ped.pos.z)
    ped.mesh.rotation.y = ped.heading
    animateCharacter(ped.mesh, ped.speed, dt, false)
  }
}

function lineIndex(value) {
  return clamp(Math.round((value + HALF) / CELL), 0, GRID)
}

function lineCoordinate(index) {
  return -HALF + index * CELL
}

function roadPath(from, to) {
  const startI = lineIndex(from.x)
  const startJ = lineIndex(from.z)
  const endI = lineIndex(to.x)
  const endJ = lineIndex(to.z)
  const size = GRID + 1
  const key = (i, j) => j * size + i
  const queue = [[startI, startJ]]
  const previous = new Map([[key(startI, startJ), null]])
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  let found = false
  while (queue.length) {
    const [i, j] = queue.shift()
    if (i === endI && j === endJ) { found = true; break }
    for (const [di, dj] of directions) {
      const ni = i + di
      const nj = j + dj
      if (ni < 0 || ni > GRID || nj < 0 || nj > GRID) continue
      const nextKey = key(ni, nj)
      if (previous.has(nextKey)) continue
      previous.set(nextKey, [i, j])
      queue.push([ni, nj])
    }
  }
  if (!found) return []
  const nodes = []
  let cursor = [endI, endJ]
  while (cursor) {
    nodes.push({ x: lineCoordinate(cursor[0]), z: lineCoordinate(cursor[1]) })
    cursor = previous.get(key(cursor[0], cursor[1]))
  }
  nodes.reverse()
  nodes.shift()
  return nodes
}

function spawnPolice() {
  const target = player.position
  let best = null
  let bestDistance = 0
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j++) {
      const x = lineCoordinate(i)
      const z = lineCoordinate(j)
      const distance = Math.hypot(x - target.x, z - target.z)
      if (distance > 90 && distance < 300 && distance > bestDistance) {
        bestDistance = distance
        best = { x, z }
      }
    }
  }
  if (!best) return
  const mesh = createPoliceCar()
  mesh.position.set(best.x, 0, best.z)
  const heading = Math.atan2(target.x - best.x, target.z - best.z)
  mesh.rotation.y = heading
  scene.add(mesh)
  const car = {
    mesh,
    pos: new THREE.Vector3(best.x, 0, best.z),
    heading,
    speed: 0,
    steer: 0,
    ai: null,
    type: 'police',
    color: 0x161622,
    isPlayer: false,
    police: true,
    path: [],
    pathIndex: 0,
    repath: 0,
    siren: 0.2
  }
  world.cars.push(car)
  world.police.push(car)
}

function removePolice(car) {
  scene.remove(car.mesh)
  world.cars = world.cars.filter((entry) => entry !== car)
  world.police = world.police.filter((entry) => entry !== car)
}

function busted() {
  state.money = Math.max(0, state.money - 500)
  state.heat = 0
  audio.fail()
  flashScreen()
  toast('BUSTED · $500 FINE', 'warn')
  if (player.car) {
    const car = player.car
    car.pos.set(SPAWN.x - 2.6, 0, SPAWN.z)
    car.heading = SPAWN.heading
    car.speed = 0
    car.steer = 0
    car.mesh.position.set(car.pos.x, 0, car.pos.z)
    car.mesh.rotation.set(0, car.heading, 0)
    player.position.copy(car.pos)
    player.heading = car.heading
  } else {
    player.position.set(SPAWN.x, 0, SPAWN.z)
    player.heading = SPAWN.heading
    player.character.position.copy(player.position)
    player.character.rotation.y = player.heading
  }
  state.mission.active = false
  state.mission.cooldown = 4.5
  world.marker.visible = false
  for (const police of [...world.police]) removePolice(police)
  cameraRig.heading = player.heading
  cameraRig.lookYaw = 0
  cameraRig.snap = true
}

function updatePolice(dt) {
  const desired = state.heat >= 4 ? 2 : state.heat >= 2 ? 1 : 0
  while (world.police.length < desired) spawnPolice()
  if (!desired) {
    for (const police of [...world.police]) {
      if (police !== player.car) removePolice(police)
    }
    return
  }

  const target = player.car ? player.car.pos : player.position
  for (const car of [...world.police]) {
    if (car === player.car) continue
    const playerDistance = distance2D(car.pos, target)
    car.repath -= dt
    if (car.repath <= 0 || !car.path.length) {
      car.path = roadPath(car.pos, target)
      car.pathIndex = 0
      car.repath = 2.4
    }

    let waypoint = car.path[car.pathIndex]
    if (playerDistance < 32 || !waypoint) waypoint = target
    if (waypoint) {
      if (distance2D(car.pos, waypoint) < 5 && car.pathIndex < car.path.length - 1) {
        car.pathIndex++
        waypoint = car.path[car.pathIndex]
      }
      const desiredHeading = Math.atan2(waypoint.x - car.pos.x, waypoint.z - car.pos.z)
      car.heading = lerpAngle(car.heading, desiredHeading, 1 - Math.exp(-3.6 * dt))
    }

    const cruise = playerDistance < 34 ? 27 : 20
    car.speed = damp(car.speed, cruise, 1.7, dt)
    car.pos.x += Math.sin(car.heading) * car.speed * dt
    car.pos.z += Math.cos(car.heading) * car.speed * dt
    if (collideCircle(car.pos, 1.75)) {
      car.speed *= 0.4
      car.repath = 0
    }
    car.pos.x = clamp(car.pos.x, -WORLD_LIMIT, WORLD_LIMIT)
    car.pos.z = clamp(car.pos.z, -WORLD_LIMIT, WORLD_LIMIT)
    car.mesh.position.set(car.pos.x, 0, car.pos.z)
    car.mesh.rotation.set(0, car.heading, 0)
    animateCar(car.mesh, car.speed)
    animatePoliceLights(car.mesh, state.time)

    car.siren -= dt
    if (car.siren <= 0 && playerDistance < 45) {
      car.siren = 1.5
      audio.siren()
    }

    if (playerDistance < 5.2 && (!player.car || Math.abs(player.car.speed) < 4.5)) {
      busted()
      return
    }
  }
}

function collideCircle(position, radius) {
  let hit = false
  for (const collider of world.colliders) {
    const dx = position.x - collider.x
    const dz = position.z - collider.z
    const overlapX = collider.hw + radius - Math.abs(dx)
    const overlapZ = collider.hd + radius - Math.abs(dz)
    if (overlapX > 0 && overlapZ > 0) {
      hit = true
      if (overlapX < overlapZ) {
        position.x = collider.x + Math.sign(dx || 1) * (collider.hw + radius)
      } else {
        position.z = collider.z + Math.sign(dz || 1) * (collider.hd + radius)
      }
    }
  }
  return hit
}

/* ------------------------------------------------------------------ */
/* Particle FX                                                        */
/* ------------------------------------------------------------------ */

function createParticles() {
  for (let i = 0; i < 56; i++) {
    const material = new THREE.SpriteMaterial({
      map: smokeTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.NormalBlending,
      toneMapped: false
    })
    const sprite = new THREE.Sprite(material)
    sprite.visible = false
    scene.add(sprite)
    particles.pool.push({
      sprite,
      material,
      life: 0,
      maxLife: 1,
      vx: 0,
      vy: 0,
      vz: 0,
      baseSize: 1
    })
  }
}

function spawnParticle(x, y, z, life, vx, vy, vz, color, size, opacity = 0.5) {
  const particle = particles.pool.find((p) => p.life <= 0)
  if (!particle) return
  particle.life = life
  particle.maxLife = life
  particle.vx = vx
  particle.vy = vy
  particle.vz = vz
  particle.baseSize = size
  particle.material.color.setHex(color)
  particle.material.opacity = opacity
  particle.material.blending = color === 0xffbe3d ? THREE.AdditiveBlending : THREE.NormalBlending
  particle.sprite.position.set(x, y, z)
  particle.sprite.scale.setScalar(size)
  particle.sprite.visible = true
}

function updateParticles(dt) {
  for (const particle of particles.pool) {
    if (particle.life <= 0) continue
    particle.life -= dt
    if (particle.life <= 0) {
      particle.sprite.visible = false
      particle.material.opacity = 0
      continue
    }
    const progress = 1 - particle.life / particle.maxLife
    particle.sprite.position.x += particle.vx * dt
    particle.sprite.position.y += particle.vy * dt
    particle.sprite.position.z += particle.vz * dt
    particle.vy += 0.7 * dt
    particle.sprite.scale.setScalar(particle.baseSize * (1 + progress * 2.1))
    particle.material.opacity = (1 - progress) * 0.55
  }
}

/* ------------------------------------------------------------------ */
/* Camera + loop                                                      */
/* ------------------------------------------------------------------ */

function updateCamera(dt) {
  if (state.mode === 'menu') {
    const t = state.time * 0.045
    const radius = 382 + Math.sin(state.time * 0.13) * 22
    const desired = new THREE.Vector3(Math.cos(t) * radius, 100 + Math.sin(state.time * 0.19) * 12, Math.sin(t) * radius)
    camera.position.lerp(desired, 1 - Math.exp(-dt * 1.2))
    camera.lookAt(0, 24, 0)
    camera.fov = damp(camera.fov, 58, 2, dt)
    camera.updateProjectionMatrix()
    return
  }

  const car = player.car
  const targetHeading = car ? car.heading : player.heading
  const followRate = car ? 5.2 : (player.moving ? 4.4 : 2)
  cameraRig.heading = lerpAngle(cameraRig.heading, targetHeading, 1 - Math.exp(-followRate * dt))

  if (car) cameraRig.lookYaw = damp(cameraRig.lookYaw, 0, 0.55, dt)

  const yaw = cameraRig.heading + cameraRig.lookYaw
  const pitch = clamp(cameraRig.basePitch + cameraRig.lookPitch, 0.11, 0.92)
  const speed = car ? Math.abs(car.speed) : 0
  const framing = camera.aspect < 0.78 ? 1.34 : camera.aspect < 1.05 ? 1.16 : 1
  const distance = (car ? 9.8 + Math.min(speed * 0.09, 4.4) : 7.4) * framing
  const target = new THREE.Vector3(
    player.position.x,
    car ? 1.3 : 1.45,
    player.position.z
  )

  const desired = new THREE.Vector3(
    target.x - Math.sin(yaw) * Math.cos(pitch) * distance,
    target.y + Math.sin(pitch) * distance,
    target.z - Math.cos(yaw) * Math.cos(pitch) * distance
  )

  if (cameraRig.snap) {
    camera.position.copy(desired)
    cameraRig.snap = false
  } else {
    camera.position.lerp(desired, 1 - Math.exp(-7 * dt))
  }

  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))
  const lookTarget = target.clone().addScaledVector(forward, car ? 2.6 + speed * 0.05 : 0.8)
  camera.lookAt(lookTarget)

  if (cameraRig.shake > 0.001) {
    const amount = cameraRig.shake * 0.28
    camera.position.x += (Math.random() - 0.5) * amount
    camera.position.y += (Math.random() - 0.5) * amount
    camera.position.z += (Math.random() - 0.5) * amount
    cameraRig.shake = damp(cameraRig.shake, 0, 7, dt)
  }

  const targetFov = 58 + Math.min(speed * 0.52, 17)
  camera.fov = damp(camera.fov, targetFov, 3, dt)
  camera.updateProjectionMatrix()
}

function animate() {
  if (state.mode !== 'menu' || !softwareRenderer) requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.05)
  state.time += dt

  if (state.mode === 'play') {
    if (player.car) updatePlayerCar(dt)
    else updatePlayerFoot(dt)
    updateAI(dt)
    updatePeds(dt)
    updatePolice(dt)
    updateMission(dt)
    updateParticles(dt)
    updateCamera(dt)
    updateTilt(dt)
    updateHud()
    if (state.time % 0.1 < dt) drawMinimap()
  } else if (state.mode === 'menu') {
    updateAI(dt)
    updatePeds(dt)
    updateParticles(dt)
    updateCamera(dt)
    updateHud()
    if (state.time % 0.1 < dt) drawMinimap()
  } else {
    drawMinimap()
  }

  if (world.oceanMaterial) world.oceanMaterial.uniforms.uTime.value = state.time
  for (const palm of world.palms) {
    if (palm.isObject3D && palm.userData?.leaves) {
      palm.userData.leaves.rotation.y = Math.sin(state.time * 0.7 + palm.userData.phase) * 0.035
    }
  }

  renderer.render(scene, camera)
}

/* ------------------------------------------------------------------ */
/* HUD                                                                */
/* ------------------------------------------------------------------ */

function updateHud() {
  dom.money.textContent = `$${state.money.toLocaleString()}`
  const stars = Math.min(5, Math.round(state.heat))
  dom.stars.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars)

  const mission = state.mission
  if (mission.active) {
    if (player.car) {
      dom.objectiveKicker.textContent = 'DELIVERY ACTIVE'
      dom.objectiveTitle.textContent = 'REACH THE DROP-OFF'
      dom.objectiveSub.textContent = `${Math.max(0, Math.round(mission.distance))} M · MAKE THE DROP`
      dom.objectiveTimer.textContent = formatTime(mission.timeLeft)
      dom.objectiveTimer.classList.toggle('urgent', mission.timeLeft < 16)
    } else {
      dom.objectiveKicker.textContent = 'NEXT STEP'
      dom.objectiveTitle.textContent = 'GET IN A VEHICLE'
      dom.objectiveSub.textContent = 'Your ride is parked nearby'
      dom.objectiveTimer.textContent = '--:--'
      dom.objectiveTimer.classList.remove('urgent')
    }
  } else if (mission.cooldown > 0) {
    dom.objectiveKicker.textContent = 'JOB COMPLETE'
    dom.objectiveTitle.textContent = 'NEXT PICKUP INBOUND'
    dom.objectiveSub.textContent = 'Stay on the move'
    dom.objectiveTimer.textContent = '--:--'
    dom.objectiveTimer.classList.remove('urgent')
  } else {
    dom.objectiveKicker.textContent = 'FREEROAM'
    dom.objectiveTitle.textContent = 'OWN THE STREETS'
    dom.objectiveSub.textContent = 'Wait for the next job'
    dom.objectiveTimer.textContent = '--:--'
    dom.objectiveTimer.classList.remove('urgent')
  }

  const nearest = nearestCar()
  if (!player.car && nearest) {
    dom.prompt.classList.remove('hidden')
    dom.prompt.innerHTML = '<b>ENTER</b> GET IN VEHICLE'
  } else {
    dom.prompt.classList.add('hidden')
  }

  dom.actionBtn.querySelector('.btn-text').textContent = player.car ? 'EXIT' : 'ENTER'
  dom.actionBtn.setAttribute('aria-label', player.car ? 'Exit vehicle' : 'Enter vehicle')
  dom.sprintBtn.querySelector('.btn-text').textContent = player.car ? 'BOOST' : 'RUN'
  dom.sprintBtn.setAttribute('aria-label', player.car ? 'Boost' : 'Sprint')
  dom.brakeBtn.classList.toggle('hidden', !player.car)

  if (player.car) {
    dom.speedo.classList.remove('hidden')
    const kmh = Math.round(Math.abs(player.car.speed) * 3.6)
    dom.speedValue.textContent = kmh
    dom.speedFill.style.width = `${clamp(kmh / 160, 0, 1) * 100}%`
  } else {
    dom.speedo.classList.add('hidden')
  }
}

function formatTime(seconds) {
  const value = Math.max(0, Math.ceil(seconds))
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

let toastTimeout = 0
function toast(message, tone = '') {
  clearTimeout(toastTimeout)
  dom.toast.textContent = message
  dom.toast.classList.remove('good', 'warn')
  if (tone) dom.toast.classList.add(tone)
  dom.toast.classList.add('show')
  toastTimeout = setTimeout(() => dom.toast.classList.remove('show'), 2400)
}

function flashScreen() {
  dom.flash.classList.add('on')
  setTimeout(() => dom.flash.classList.remove('on'), 90)
}

const minimapCtx = dom.minimap.getContext('2d')
function drawMinimap() {
  const ctx = minimapCtx
  const size = 360
  const radius = 174
  const center = size / 2
  const scale = 1.1
  ctx.clearRect(0, 0, size, size)
  ctx.save()
  ctx.beginPath()
  ctx.arc(center, center, radius, 0, Math.PI * 2)
  ctx.clip()

  const bg = ctx.createRadialGradient(center, center, 12, center, center, radius)
  bg.addColorStop(0, 'rgba(23, 13, 36, 0.96)')
  bg.addColorStop(1, 'rgba(7, 5, 14, 0.98)')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)

  const playerPos = player.position
  ctx.translate(center, center)

  const toMap = (x, z) => [(x - playerPos.x) * scale, (z - playerPos.z) * scale]
  const lines = []
  for (let i = 0; i <= GRID; i++) lines.push(-HALF + i * CELL)

  ctx.strokeStyle = 'rgba(255,255,255,0.11)'
  ctx.lineWidth = (CELL - ROAD) * scale
  for (const z of lines) {
    const [, my] = toMap(0, z)
    ctx.beginPath()
    ctx.moveTo(-radius * 1.8, my)
    ctx.lineTo(radius * 1.8, my)
    ctx.stroke()
  }
  for (const x of lines) {
    const [mx] = toMap(x, 0)
    ctx.beginPath()
    ctx.moveTo(mx, -radius * 1.8)
    ctx.lineTo(mx, radius * 1.8)
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(57,245,255,0.3)'
  ctx.lineWidth = 1
  for (const z of lines) {
    const [, my] = toMap(0, z)
    ctx.beginPath()
    ctx.moveTo(-radius * 1.8, my)
    ctx.lineTo(radius * 1.8, my)
    ctx.stroke()
  }
  for (const x of lines) {
    const [mx] = toMap(x, 0)
    ctx.beginPath()
    ctx.moveTo(mx, -radius * 1.8)
    ctx.lineTo(mx, radius * 1.8)
    ctx.stroke()
  }

  for (const car of world.cars) {
    if (car === player.car) continue
    const [mx, my] = toMap(car.pos.x, car.pos.z)
    if (Math.hypot(mx, my) > radius - 4) continue
    ctx.fillStyle = car.police ? '#ff4d6d' : car === world.playerCar ? 'rgba(255,45,135,0.95)' : 'rgba(255,255,255,0.4)'
    ctx.beginPath()
    ctx.arc(mx, my, car === world.playerCar ? 3.5 : 2.2, 0, Math.PI * 2)
    ctx.fill()
  }

  for (const ped of world.peds) {
    const [mx, my] = toMap(ped.pos.x, ped.pos.z)
    if (Math.hypot(mx, my) > radius - 4) continue
    ctx.fillStyle = 'rgba(200,180,255,0.24)'
    ctx.fillRect(mx - 1, my - 1, 2, 2)
  }

  if (state.mission.active) {
    const [mx, my] = toMap(state.mission.target.x, state.mission.target.z)
    const distance = Math.hypot(mx, my)
    let tx = mx
    let ty = my
    if (distance > radius - 14) {
      tx = (mx / distance) * (radius - 14)
      ty = (my / distance) * (radius - 14)
    }
    ctx.save()
    ctx.translate(tx, ty)
    ctx.rotate(state.time * 1.3)
    ctx.fillStyle = '#39f5ff'
    ctx.shadowColor = '#39f5ff'
    ctx.shadowBlur = 14
    ctx.beginPath()
    ctx.moveTo(0, -7)
    ctx.lineTo(7, 0)
    ctx.lineTo(0, 7)
    ctx.lineTo(-7, 0)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  ctx.rotate(Math.PI - player.heading)
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = '#ff2d87'
  ctx.shadowBlur = 10
  ctx.beginPath()
  ctx.moveTo(0, -9)
  ctx.lineTo(6, 7)
  ctx.lineTo(0, 3.5)
  ctx.lineTo(-6, 7)
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}

/* ------------------------------------------------------------------ */
/* Interaction + controls                                             */
/* ------------------------------------------------------------------ */

function nearestCar() {
  if (player.car) return player.car
  let best = null
  let bestDistance = 999
  for (const car of world.cars) {
    const distance = distance2D(player.position, car.pos)
    if (distance < bestDistance) {
      bestDistance = distance
      best = car
    }
  }
  return bestDistance < 5.4 ? best : null
}

function enterCar(car) {
  if (!car || player.car) return
  player.car = car
  car.isPlayer = true
  car.ai = null
  if (car.police) world.police = world.police.filter((entry) => entry !== car)
  car.mesh.userData.isPlayer = true
  player.character.visible = false
  player.position.copy(car.pos)
  player.heading = car.heading
  cameraRig.heading = car.heading
  cameraRig.lookYaw = 0
  audio.unlock()
  audio.enter()
  audio.startEngine()
  toast(car === world.playerCar ? 'YOUR RIDE · LET’S MOVE' : 'HOT WIRED · NICE CHOICE', 'good')
}

function exitCar() {
  const car = player.car
  if (!car) return
  const rightX = Math.cos(car.heading)
  const rightZ = -Math.sin(car.heading)
  player.position.set(car.pos.x + rightX * 2.7, 0, car.pos.z + rightZ * 2.7)
  collideCircle(player.position, 0.46)
  player.position.x = clamp(player.position.x, -WORLD_LIMIT, WORLD_LIMIT)
  player.position.z = clamp(player.position.z, -WORLD_LIMIT, WORLD_LIMIT)
  player.heading = car.heading + Math.PI / 2
  player.character.visible = true
  player.character.position.copy(player.position)
  player.character.rotation.y = player.heading
  car.isPlayer = false
  car.mesh.userData.isPlayer = false
  car.speed = 0
  car.steer = 0
  car.mesh.rotation.set(0, car.heading, 0)
  player.car = null
  audio.stopEngine()
  audio.exit()
}

function performAction() {
  if (state.mode !== 'play') return
  if (player.car) {
    exitCar()
  } else {
    const car = nearestCar()
    if (car) enterCar(car)
    else toast('NO VEHICLE NEARBY', 'warn')
  }
}

function bindUI() {
  dom.startBtn.addEventListener('click', () => {
    audio.unlock()
    audio.click()
    maybeRequestMotion()
    startGame()
  })

  dom.tiltStart.addEventListener('click', () => setTilt(!tilt.enabled))
  dom.tiltPause.addEventListener('click', () => setTilt(!tilt.enabled))
  dom.soundStart.addEventListener('click', () => toggleSound())
  dom.soundPause.addEventListener('click', () => toggleSound())

  dom.pauseBtn.addEventListener('click', () => togglePause())
  dom.resumeBtn.addEventListener('click', () => togglePause(false))
  dom.restartBtn.addEventListener('click', () => restartRun())

  dom.actionBtn.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    dom.actionBtn.classList.add('active')
    performAction()
  })
  const releaseAction = () => dom.actionBtn.classList.remove('active')
  dom.actionBtn.addEventListener('pointerup', releaseAction)
  dom.actionBtn.addEventListener('pointercancel', releaseAction)
  dom.actionBtn.addEventListener('pointerleave', releaseAction)

  for (const [button, key] of [[dom.brakeBtn, 'brake'], [dom.sprintBtn, 'sprint']]) {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      input[key] = true
      button.classList.add('active')
    })
    const release = () => {
      input[key] = false
      button.classList.remove('active')
    }
    button.addEventListener('pointerup', release)
    button.addEventListener('pointercancel', release)
    button.addEventListener('pointerleave', release)
  }

  bindJoystick()
  bindLook()
  bindKeyboard()
  window.addEventListener('resize', onResize)
  window.addEventListener('orientationchange', () => setTimeout(onResize, 250))
  window.addEventListener('contextmenu', (event) => event.preventDefault())
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.mode === 'play') togglePause(true)
  })

  loadSettings()
  createMissionMarker()
  setTimeout(() => startMission(), 800)
  updateTiltUi()
  updateSoundUi()
}

function bindJoystick() {
  const zone = dom.joystickZone
  const base = dom.joystickBase
  const knob = dom.joystickKnob
  let pointerId = null

  const update = (clientX, clientY) => {
    const rect = base.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    let dx = clientX - cx
    let dy = clientY - cy
    const max = rect.width * 0.34
    const distance = Math.hypot(dx, dy)
    if (distance > max) {
      dx = (dx / distance) * max
      dy = (dy / distance) * max
    }
    input.joyX = dx / max
    input.joyY = dy / max
    knob.style.transform = `translate(${dx}px, ${dy}px)`
  }

  zone.addEventListener('pointerdown', (event) => {
    if (pointerId !== null) return
    pointerId = event.pointerId
    zone.setPointerCapture(pointerId)
    input.joyActive = true
    update(event.clientX, event.clientY)
    event.preventDefault()
  })
  zone.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return
    update(event.clientX, event.clientY)
  })
  const release = (event) => {
    if (pointerId !== null && event.pointerId !== pointerId) return
    pointerId = null
    input.joyActive = false
    input.joyX = 0
    input.joyY = 0
    knob.style.transform = 'translate(0px, 0px)'
  }
  zone.addEventListener('pointerup', release)
  zone.addEventListener('pointercancel', release)
  zone.addEventListener('lostpointercapture', release)
}

function bindLook() {
  const zone = dom.lookZone
  zone.addEventListener('pointerdown', (event) => {
    if (state.mode !== 'play') return
    if (input.lookActive) return
    input.lookActive = true
    input.lookId = event.pointerId
    input.lookX = event.clientX
    input.lookY = event.clientY
    zone.setPointerCapture(event.pointerId)
  })
  zone.addEventListener('pointermove', (event) => {
    if (!input.lookActive || event.pointerId !== input.lookId) return
    const dx = event.clientX - input.lookX
    const dy = event.clientY - input.lookY
    input.lookX = event.clientX
    input.lookY = event.clientY
    cameraRig.lookYaw = clamp(cameraRig.lookYaw - dx * 0.0055, -2.8, 2.8)
    cameraRig.lookPitch = clamp(cameraRig.lookPitch + dy * 0.0042, -0.2, 0.56)
  })
  const release = () => {
    input.lookActive = false
    input.lookId = null
  }
  zone.addEventListener('pointerup', release)
  zone.addEventListener('pointercancel', release)
  zone.addEventListener('lostpointercapture', release)
}

function bindKeyboard() {
  window.addEventListener('keydown', (event) => {
    const code = event.code
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) event.preventDefault()
    if (event.repeat) return
    input.keys.add(code)
    if (code === 'KeyE') performAction()
    if (code === 'Space') input.brake = true
    if (code === 'ShiftLeft' || code === 'ShiftRight') input.sprint = true
    if (code === 'KeyP' || code === 'Escape') togglePause()
    if (code === 'KeyM') toggleSound()
    if (code === 'KeyR') {
      cameraRig.lookYaw = 0
      cameraRig.lookPitch = 0
    }
  })
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code)
    if (event.code === 'Space') input.brake = false
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') input.sprint = false
  })
  window.addEventListener('blur', () => {
    input.keys.clear()
    input.brake = false
    input.sprint = false
    input.joyActive = false
    input.joyX = 0
    input.joyY = 0
    dom.joystickKnob.style.transform = 'translate(0px, 0px)'
  })
}

function onResize() {
  const width = window.innerWidth
  const height = window.innerHeight
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.85))
  renderer.setSize(width, height)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

/* ------------------------------------------------------------------ */
/* Game flow                                                          */
/* ------------------------------------------------------------------ */

function startGame() {
  if (state.started) return
  state.started = true
  state.mode = 'play'
  state.money = 2500
  state.deliveries = 0
  state.topSpeed = 0
  state.heat = 0
  setActorsVisible(true)
  player.position.set(SPAWN.x, 0, SPAWN.z)
  player.heading = SPAWN.heading
  player.speed = 0
  player.character.visible = true
  player.character.position.copy(player.position)
  player.character.rotation.y = player.heading
  cameraRig.heading = SPAWN.heading
  cameraRig.lookYaw = 0
  cameraRig.lookPitch = 0
  cameraRig.snap = true
  dom.start.classList.add('leaving')
  setTimeout(() => dom.start.classList.add('hidden'), 520)
  dom.hud.classList.remove('hidden')
  if (state.mission.active) {
    state.mission.timeLeft = 120
  } else {
    startMission()
  }
  toast('WELCOME TO VICE HARBOR · PRESS ENTER TO DRIVE', 'good')
  updateHud()
  if (softwareRenderer) requestAnimationFrame(animate)
}

function togglePause(force) {
  if (!state.started) return
  const pause = force !== undefined ? force : state.mode === 'play'
  if (pause && state.mode === 'play') {
    state.mode = 'paused'
    dom.pause.classList.remove('hidden')
    dom.pauseMoney.textContent = `$${state.money.toLocaleString()}`
    dom.pauseDeliveries.textContent = state.deliveries
    dom.pauseSpeed.textContent = `${Math.round(state.topSpeed)}`
    audio.stopEngine()
  } else if (!pause && state.mode === 'paused') {
    state.mode = 'play'
    dom.pause.classList.add('hidden')
    if (player.car) {
      audio.unlock()
      audio.startEngine()
    }
  }
}

function restartRun() {
  togglePause(false)
  if (player.car) exitCar()
  for (const police of [...world.police]) removePolice(police)
  state.money = 2500
  state.deliveries = 0
  state.topSpeed = 0
  state.heat = 0
  player.position.set(SPAWN.x, 0, SPAWN.z)
  player.heading = SPAWN.heading
  player.speed = 0
  player.character.visible = true
  player.character.position.copy(player.position)
  player.character.rotation.y = player.heading
  cameraRig.heading = SPAWN.heading
  cameraRig.lookYaw = 0
  cameraRig.lookPitch = 0
  cameraRig.snap = true
  state.mission.active = false
  state.mission.cooldown = 0.8
  state.mission.timeLeft = 120
  world.marker.visible = false
  toast('RUN RESTARTED', 'good')
  updateHud()
}

/* ------------------------------------------------------------------ */
/* Tilt, sound, settings                                              */
/* ------------------------------------------------------------------ */

function handleOrientation(event) {
  const angle = Math.abs((screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0)
  let raw
  if (angle === 90) raw = -(event.beta ?? 0)
  else if (angle === 270) raw = event.beta ?? 0
  else raw = event.gamma ?? 0
  tilt.target = clamp(raw / 27, -1, 1)
}

function updateTilt(dt) {
  if (!tilt.enabled) {
    tilt.value = damp(tilt.value, 0, 8, dt)
    return
  }
  tilt.value = damp(tilt.value, tilt.target, 9, dt)
}

async function ensureMotionPermission() {
  if (typeof DeviceOrientationEvent === 'undefined') return false
  const request = DeviceOrientationEvent.requestPermission
  if (typeof request !== 'function') {
    return true
  }
  try {
    const response = await request.call(DeviceOrientationEvent)
    return response === 'granted'
  } catch (error) {
    return false
  }
}

async function maybeRequestMotion() {
  if (!tilt.enabled) return
  const granted = await ensureMotionPermission()
  if (!granted) {
    setTilt(false)
    toast('MOTION ACCESS NEEDED FOR TILT STEERING', 'warn')
  }
}

async function setTilt(enabled) {
  if (enabled) {
    audio.unlock()
    audio.click()
    const granted = await ensureMotionPermission()
    if (!granted) {
      tilt.enabled = false
      if (!tilt.listening) {
        toast('MOTION ACCESS DENIED', 'warn')
      }
      updateTiltUi()
      return
    }
    if (!tilt.listening) {
      window.addEventListener('deviceorientation', handleOrientation, { passive: true })
      tilt.listening = true
    }
    tilt.enabled = true
    toast('TILT STEERING ON · LEAN TO TURN', 'good')
  } else {
    tilt.enabled = false
    tilt.target = 0
    try { localStorage.setItem('gta7-tilt', '0') } catch {}
    toast('TILT STEERING OFF')
  }
  try { localStorage.setItem('gta7-tilt', tilt.enabled ? '1' : '0') } catch {}
  updateTiltUi()
}

function updateTiltUi() {
  for (const button of [dom.tiltStart, dom.tiltPause]) {
    if (!button) continue
    button.setAttribute('aria-pressed', tilt.enabled ? 'true' : 'false')
    const label = button.querySelector('b')
    if (label) label.textContent = tilt.enabled ? 'ON' : 'OFF'
  }
}

function toggleSound() {
  audio.unlock()
  audio.setMuted(!audio.muted)
  try { localStorage.setItem('gta7-muted', audio.muted ? '1' : '0') } catch {}
  updateSoundUi()
  if (!audio.muted) audio.click()
}

function updateSoundUi() {
  for (const button of [dom.soundStart, dom.soundPause]) {
    if (!button) continue
    button.setAttribute('aria-pressed', audio.muted ? 'false' : 'true')
    const label = button.querySelector('b')
    if (label) label.textContent = audio.muted ? 'OFF' : 'ON'
  }
}

function loadSettings() {
  try {
    if (localStorage.getItem('gta7-muted') === '1') {
      audio.muted = true
      audio.setMuted(true)
    }
    if (localStorage.getItem('gta7-tilt') === '1' && tilt.available) {
      tilt.enabled = true
      if (!tilt.listening) {
        window.addEventListener('deviceorientation', handleOrientation, { passive: true })
        tilt.listening = true
      }
    }
  } catch {}
  updateTiltUi()
  updateSoundUi()
}

initialize()
animate()

window.__gta = { scene, camera, renderer, world, state, player, startMission, SPAWN, THREE }
