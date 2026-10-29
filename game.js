import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

const $ = selector => document.querySelector(selector)
const canvas = $('#scene')
const touchMode = matchMedia('(pointer: coarse)').matches || innerWidth <= 900

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, t) => a + (b - a) * t
const damp = (a, b, speed, dt) => lerp(a, b, 1 - Math.exp(-speed * dt))
const rand = (a, b) => a + Math.random() * (b - a)
const pick = array => array[Math.floor(Math.random() * array.length)]

function angleDamp(a, b, speed, dt) {
  let d = (b - a + Math.PI * 3) % (Math.PI * 2) - Math.PI
  return a + d * (1 - Math.exp(-speed * dt))
}

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

const random = mulberry32(70707)

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  stencil: false
})
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, touchMode ? 1.55 : 1.35))
renderer.setSize(innerWidth, innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.06
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0x120c22, 0.00155)

const camera = new THREE.PerspectiveCamera(61, innerWidth / innerHeight, 0.1, 1800)
camera.position.set(8.5, 15, 22)
camera.lookAt(0, 7, 136)

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.62, 0.52, 0.84)
composer.addPass(bloom)
composer.addPass(new OutputPass())

const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())

function canvasTexture(width, height, draw, options = {}) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d')
  draw(ctx, width, height)
  const texture = new THREE.CanvasTexture(c)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = maxAnisotropy
  if (options.repeat) {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(options.repeat[0], options.repeat[1])
  }
  return texture
}

const glowTexture = canvasTexture(128, 128, (ctx, w, h) => {
  const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.13, 'rgba(255,255,255,.9)')
  gradient.addColorStop(0.38, 'rgba(255,255,255,.26)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)
})

const asphaltTexture = canvasTexture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#171723'
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < 9000; i++) {
    const shade = 18 + Math.floor(Math.random() * 28)
    ctx.fillStyle = `rgba(${shade},${shade},${shade + 8},${0.06 + Math.random() * 0.12})`
    const size = Math.random() * 2.2
    ctx.fillRect(Math.random() * w, Math.random() * h, size, size)
  }
  ctx.globalAlpha = 0.16
  ctx.strokeStyle = '#05060a'
  for (let i = 0; i < 9; i++) {
    ctx.beginPath()
    let x = Math.random() * w
    let y = Math.random() * h
    ctx.moveTo(x, y)
    for (let j = 0; j < 6; j++) {
      x += rand(-18, 18)
      y += rand(10, 34)
      ctx.lineTo(x, y)
    }
    ctx.lineWidth = rand(0.5, 1.8)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}, { repeat: [50, 50] })

const sidewalkTexture = canvasTexture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#625c70'
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < 2500; i++) {
    const v = 75 + Math.floor(Math.random() * 45)
    ctx.fillStyle = `rgba(${v},${v - 4},${v + 10},${Math.random() * 0.18})`
    ctx.fillRect(Math.random() * w, Math.random() * h, Math.random() * 3, Math.random() * 3)
  }
  ctx.strokeStyle = 'rgba(32,28,40,.52)'
  ctx.lineWidth = 3
  for (let x = 0; x <= w; x += 128) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  for (let y = 0; y <= h; y += 128) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(24,20,32,.2)'
  ctx.lineWidth = 1
  for (let x = 64; x <= w; x += 128) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
}, { repeat: [7, 7] })

const woodTexture = canvasTexture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#3b2a28'
  ctx.fillRect(0, 0, w, h)
  for (let y = 0; y < h; y += 22) {
    ctx.fillStyle = `rgba(${rand(35, 72)},${rand(22, 45)},${rand(20, 40)},${rand(0.15, 0.48)})`
    ctx.fillRect(0, y, w, rand(9, 20))
    ctx.fillStyle = 'rgba(8,4,8,.28)'
    ctx.fillRect(0, y + 19, w, 2)
  }
}, { repeat: [3, 12] })

function makeFacadeTextures(style) {
  const palette = [
    { wall: ['#222437', '#101223'], win: ['#ffd58d', '#ffe8b0', '#7defff', '#ff75bc'], lit: 0.4, metal: 0.15, rough: 0.66 },
    { wall: ['#332236', '#151021'], win: ['#ffbf78', '#ffe4ae', '#ff7bbd', '#b59aff'], lit: 0.48, metal: 0.2, rough: 0.63 },
    { wall: ['#122f38', '#07151f'], win: ['#9ffcff', '#d5fdff', '#5fd4ff', '#ff77c8'], lit: 0.58, metal: 0.38, rough: 0.47 },
    { wall: ['#31252a', '#151115'], win: ['#ffd08a', '#ffb96b', '#a8ffe4', '#ff8bb5'], lit: 0.37, metal: 0.1, rough: 0.76 },
    { wall: ['#1e2038', '#0d0f1f'], win: ['#89eeff', '#d3fbff', '#90b5ff', '#ff86cc'], lit: 0.52, metal: 0.45, rough: 0.4 },
    { wall: ['#301c4b', '#120c27'], win: ['#ff84d0', '#ffd3ee', '#80ffff', '#fff0a7'], lit: 0.55, metal: 0.24, rough: 0.51 },
    { wall: ['#3c2c1e', '#1b130d'], win: ['#ffd483', '#ffefb0', '#79e6ff', '#ff8ca9'], lit: 0.31, metal: 0.2, rough: 0.7 }
  ][style]
  const base = document.createElement('canvas')
  const emission = document.createElement('canvas')
  base.width = base.height = 512
  emission.width = emission.height = 512
  const b = base.getContext('2d')
  const e = emission.getContext('2d')
  const gradient = b.createLinearGradient(0, 0, 0, 512)
  gradient.addColorStop(0, palette.wall[0])
  gradient.addColorStop(1, palette.wall[1])
  b.fillStyle = gradient
  b.fillRect(0, 0, 512, 512)
  e.fillStyle = '#000'
  e.fillRect(0, 0, 512, 512)
  b.fillStyle = 'rgba(255,255,255,.025)'
  for (let i = 0; i < 22; i++) b.fillRect(0, i * 27, 512, 1)
  const cols = 10
  const rows = 11
  const cw = 512 / cols
  const ch = 512 / rows
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cw + 12
      const y = row * ch + 12
      const ww = cw - 24
      const wh = ch - 23
      const lit = random() < palette.lit * 0.82
      b.fillStyle = lit ? 'rgba(34,28,38,.88)' : 'rgba(8,10,18,.9)'
      b.fillRect(x, y, ww, wh)
      b.strokeStyle = 'rgba(255,255,255,.06)'
      b.lineWidth = 2
      b.strokeRect(x, y, ww, wh)
      if (lit) {
        const color = palette.win[Math.floor(random() * palette.win.length)]
        e.fillStyle = color
        e.globalAlpha = rand(0.42, 0.8)
        e.fillRect(x + 2, y + 2, ww - 4, wh - 4)
        e.globalAlpha = rand(0.18, 0.4)
        e.fillStyle = '#ffffff'
        e.fillRect(x + 4, y + 4, ww - 8, 3)
        e.globalAlpha = 1
        b.fillStyle = color
        b.globalAlpha = 0.34
        b.fillRect(x, y, ww, wh)
        b.globalAlpha = 1
      }
      if (random() < 0.08) {
        b.fillStyle = 'rgba(0,0,0,.5)'
        b.fillRect(x, y, ww, wh * rand(0.08, 0.2))
      }
    }
  }
  b.strokeStyle = 'rgba(0,0,0,.34)'
  b.lineWidth = 2
  for (let c = 0; c <= cols; c++) {
    b.beginPath()
    b.moveTo(c * cw, 0)
    b.lineTo(c * cw, 512)
    b.stroke()
  }
  const map = new THREE.CanvasTexture(base)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.anisotropy = maxAnisotropy
  const em = new THREE.CanvasTexture(emission)
  em.colorSpace = THREE.SRGBColorSpace
  em.wrapS = em.wrapT = THREE.RepeatWrapping
  em.anisotropy = maxAnisotropy
  const material = new THREE.MeshStandardMaterial({
    map,
    emissiveMap: em,
    emissive: 0xffffff,
    emissiveIntensity: style === 2 || style === 4 ? 1.07 : 0.9,
    metalness: palette.metal,
    roughness: palette.rough
  })
  return { material, style }
}

const facadeMaterials = Array.from({ length: 7 }, (_, i) => makeFacadeTextures(i))
const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x15131d, roughness: 0.86, metalness: 0.12 })
const sidewalkMaterial = new THREE.MeshStandardMaterial({ map: sidewalkTexture, color: 0x8b849d, roughness: 0.82, metalness: 0.08 })
const asphaltMaterial = new THREE.MeshStandardMaterial({ map: asphaltTexture, color: 0x6f6d7d, roughness: 0.54, metalness: 0.24 })
const darkMetal = new THREE.MeshStandardMaterial({ color: 0x25212e, roughness: 0.42, metalness: 0.72 })
const blackMetal = new THREE.MeshStandardMaterial({ color: 0x0b0b11, roughness: 0.34, metalness: 0.78 })
const glassMaterial = new THREE.MeshPhysicalMaterial({ color: 0x0b1722, roughness: 0.12, metalness: 0.55, clearcoat: 0.8, clearcoatRoughness: 0.15 })

const colliders = []
const signFlickers = []
const neonStrips = []
const traffic = []
const pedestrians = []
const waypointPosition = new THREE.Vector3(0, 1, 358)

const ROADS = [-234, -156, -78, 0, 78, 156, 234]
const BLOCKS = [-195, -117, -39, 39, 117, 195]
const WORLD_LIMIT_X = 292
const WORLD_LIMIT_Z = 425

function scaleBoxUv(geometry, width, height, depth, unit = 24) {
  const uv = geometry.attributes.uv
  for (let i = 0; i < uv.count; i++) {
    const face = Math.floor(i / 4)
    let su = width / unit
    let sv = height / unit
    if (face === 0 || face === 1) su = depth / unit
    if (face === 2 || face === 3) {
      su = width / unit
      sv = depth / unit
    }
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv)
  }
  uv.needsUpdate = true
}

function addGlow(color, scale, x, y, z, opacity = 0.75) {
  const material = new THREE.SpriteMaterial({
    map: glowTexture,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  })
  const sprite = new THREE.Sprite(material)
  sprite.position.set(x, y, z)
  sprite.scale.set(scale, scale, 1)
  scene.add(sprite)
  return sprite
}

function addNeonStrip(x, y, z, w, h, d, color) {
  neonStrips.push({ x, y, z, w, h, d, color })
}


const skyMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    uTop: { value: new THREE.Color(0x07051a) },
    uHorizon: { value: new THREE.Color(0xff526f) },
    uSun: { value: new THREE.Color(0xffbd6a) },
    uSunDir: { value: new THREE.Vector3(-0.06, 0.075, 0.995).normalize() }
  },
  vertexShader: `
    varying vec3 vWorld;
    void main() {
      vec4 world = modelMatrix * vec4(position, 1.0);
      vWorld = world.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uTop;
    uniform vec3 uHorizon;
    uniform vec3 uSun;
    uniform vec3 uSunDir;
    varying vec3 vWorld;
    void main() {
      vec3 dir = normalize(vWorld);
      float h = dir.y;
      vec3 color = mix(uHorizon, uTop, smoothstep(-0.03, 0.72, h));
      float band = pow(max(0.0, 1.0 - abs(h) * 3.4), 3.0);
      color += vec3(1.0, 0.10, 0.38) * band * 0.075;
      float d = max(dot(dir, normalize(uSunDir)), 0.0);
      color += uSun * pow(d, 950.0) * 2.9;
      color += uSun * pow(d, 18.0) * 0.13;
      color += uSun * pow(d, 5.0) * 0.028;
      float haze = pow(max(0.0, 1.0 - h * 4.6), 8.0);
      color = mix(color, vec3(0.34, 0.16, 0.31), haze * 0.10);
      gl_FragColor = vec4(color, 1.0);
    }
  `
})
const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 40, 24), skyMaterial)
scene.add(sky)

const starGeometry = new THREE.BufferGeometry()
const starPositions = []
for (let i = 0; i < 520; i++) {
  const theta = random() * Math.PI * 2
  const y = rand(0.16, 0.95)
  const r = Math.sqrt(1 - y * y)
  starPositions.push(Math.cos(theta) * r * 760, y * 760, Math.sin(theta) * r * 760)
}
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3))
const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({
  color: 0xcce4ff,
  size: 1.5,
  transparent: true,
  opacity: 0.58,
  depthWrite: false,
  sizeAttenuation: true
}))
scene.add(stars)

const hemi = new THREE.HemisphereLight(0x6d70d8, 0x1a1228, 1.75)
scene.add(hemi)

const sunLight = new THREE.DirectionalLight(0xff9468, 1.55)
sunLight.position.set(-90, 110, 180)
sunLight.target.position.set(0, 0, 40)
sunLight.castShadow = true
sunLight.shadow.mapSize.set(1024, 1024)
sunLight.shadow.camera.left = -48
sunLight.shadow.camera.right = 48
sunLight.shadow.camera.top = 48
sunLight.shadow.camera.bottom = -48
sunLight.shadow.camera.near = 1
sunLight.shadow.camera.far = 310
sunLight.shadow.bias = -0.0006
scene.add(sunLight)
scene.add(sunLight.target)

const rimLight = new THREE.DirectionalLight(0x778dff, 1.15)
rimLight.position.set(70, 48, -150)
scene.add(rimLight)
const fillLight = new THREE.DirectionalLight(0xbc86ff, 0.6)
fillLight.position.set(-80, 35, -120)
scene.add(fillLight)

const cityGround = new THREE.Mesh(new THREE.PlaneGeometry(640, 640), asphaltMaterial)
cityGround.rotation.x = -Math.PI / 2
cityGround.position.set(0, -0.02, 0)
cityGround.receiveShadow = true
scene.add(cityGround)

const markingMaterial = new THREE.MeshBasicMaterial({ color: 0xb9adc5, transparent: true, opacity: 0.38, toneMapped: false })
const verticalDashes = []
const horizontalDashes = []
for (const x of ROADS) {
  for (let z = -278; z <= 278; z += 9) {
    if (ROADS.some(r => Math.abs(z - r) < 13)) continue
    verticalDashes.push([x, z])
  }
}
for (const z of ROADS) {
  for (let x = -278; x <= 278; x += 9) {
    if (ROADS.some(r => Math.abs(x - r) < 13)) continue
    horizontalDashes.push([x, z])
  }
}
const dashGeometry = new THREE.PlaneGeometry(0.17, 3.6)
dashGeometry.rotateX(-Math.PI / 2)
const verticalDashMesh = new THREE.InstancedMesh(dashGeometry, markingMaterial, verticalDashes.length)
const horizontalDashMesh = new THREE.InstancedMesh(dashGeometry, markingMaterial, horizontalDashes.length)
const dummy = new THREE.Object3D()
verticalDashes.forEach(([x, z], i) => {
  dummy.position.set(x, 0.012, z)
  dummy.rotation.set(0, 0, 0)
  dummy.updateMatrix()
  verticalDashMesh.setMatrixAt(i, dummy.matrix)
})
horizontalDashes.forEach(([x, z], i) => {
  dummy.position.set(x, 0.012, z)
  dummy.rotation.set(0, Math.PI / 2, 0)
  dummy.updateMatrix()
  horizontalDashMesh.setMatrixAt(i, dummy.matrix)
})
verticalDashMesh.instanceMatrix.needsUpdate = true
horizontalDashMesh.instanceMatrix.needsUpdate = true
verticalDashMesh.frustumCulled = false
horizontalDashMesh.frustumCulled = false
scene.add(verticalDashMesh, horizontalDashMesh)

const sidewalkGeometry = new THREE.BoxGeometry(56, 0.3, 56)
for (const bx of BLOCKS) {
  for (const bz of BLOCKS) {
    const sidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial)
    sidewalk.position.set(bx, 0.15, bz)
    sidewalk.receiveShadow = true
    scene.add(sidewalk)
  }
}

const laneGlowMaterial = new THREE.MeshBasicMaterial({ color: 0x9b8dff, transparent: true, opacity: 0.19, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
for (let i = 0; i < 24; i++) {
  const vertical = random() > 0.5
  const road = pick(ROADS)
  const along = rand(-270, 270)
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(rand(1.8, 5.5), rand(7, 22)), laneGlowMaterial)
  plane.rotation.x = -Math.PI / 2
  plane.rotation.z = vertical ? 0 : Math.PI / 2
  plane.position.set(vertical ? road + rand(-9, 9) : along, 0.008, vertical ? along : road + rand(-9, 9))
  plane.material = laneGlowMaterial.clone()
  plane.material.color.set(pick([0x8a7dff, 0x54f4ff, 0xff4fa8]))
  plane.material.opacity = rand(0.05, 0.14)
  scene.add(plane)
}

const GROUND_STORE_NAMES = ['VICE', 'LIQUOR', 'RAMEN', 'NIGHT', 'HOTEL', 'ARCADE', '24/7', 'NEON', 'CLUB', 'TATTOO', 'MOTEL', 'DINER', 'GOLD', 'RADIO', 'PIZZA']
const SIGN_COLORS = ['#ff3fa4', '#55f5ff', '#ffd166', '#a6ff7a', '#b985ff', '#ff7a4d']

function makeSignTexture(text, color, accent) {
  return canvasTexture(512, 148, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(5,3,11,.92)'
    ctx.fillRect(4, 4, w - 8, h - 8)
    ctx.strokeStyle = color
    ctx.lineWidth = 5
    ctx.shadowColor = color
    ctx.shadowBlur = 28
    ctx.strokeRect(13, 13, w - 26, h - 26)
    ctx.shadowBlur = 34
    ctx.fillStyle = color
    ctx.font = '900 76px "Arial Black", Impact, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, w / 2, h / 2 + 4)
    ctx.shadowBlur = 9
    ctx.fillStyle = accent
    ctx.font = '800 17px Arial, sans-serif'
    ctx.letterSpacing = '7px'
    ctx.fillText('OCEAN DRIVE', w / 2, h - 27)
  })
}

function addStorefrontSign(buildingX, buildingZ, width, side, height, signIndex) {
  const text = GROUND_STORE_NAMES[signIndex % GROUND_STORE_NAMES.length]
  const color = new THREE.Color(SIGN_COLORS[signIndex % SIGN_COLORS.length])
  const accent = new THREE.Color(SIGN_COLORS[(signIndex + 2) % SIGN_COLORS.length])
  const texture = makeSignTexture(text, '#' + color.getHexString(), '#' + accent.getHexString())
  const signWidth = Math.min(width * 0.62, 10.5)
  const signHeight = signWidth * 0.29
  const faceX = buildingX + side * 0.11
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(signWidth, signHeight),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, side: THREE.DoubleSide })
  )
  plane.position.set(faceX, 4.9 + rand(0, 2.4), buildingZ + rand(-width * 0.2, width * 0.2))
  plane.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2
  scene.add(plane)
  const backing = new THREE.Mesh(new THREE.BoxGeometry(signWidth + 0.3, signHeight + 0.25, 0.16), darkMetal)
  backing.position.copy(plane.position)
  backing.position.x -= side * 0.09
  backing.rotation.y = plane.rotation.y
  scene.add(backing)
  const glow = addGlow(color, signWidth * 1.55, plane.position.x - side * 0.2, plane.position.y, plane.position.z, 0.16)
  glow.scale.y = signHeight * 2.2
  signFlickers.push({ material: plane.material, base: 1, phase: random() * 10, rare: Math.random() < 0.2 })
}

function addBillboard(text, sub, colorA, colorB, x, y, z, rotationY, width, height) {
  const texture = canvasTexture(1024, 512, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, w, h)
    gradient.addColorStop(0, colorA)
    gradient.addColorStop(0.6, colorB)
    gradient.addColorStop(1, '#090713')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(6,4,14,.78)'
    ctx.fillRect(34, 34, w - 68, h - 68)
    ctx.strokeStyle = '#fff2c2'
    ctx.globalAlpha = 0.7
    ctx.lineWidth = 3
    ctx.strokeRect(34, 34, w - 68, h - 68)
    ctx.globalAlpha = 1
    ctx.fillStyle = '#ffe7a1'
    ctx.font = '900 136px Impact, "Arial Black", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = colorA
    ctx.shadowBlur = 35
    ctx.fillText(text, w / 2, h / 2 - 28)
    ctx.shadowBlur = 14
    ctx.fillStyle = colorB
    ctx.font = '800 34px Arial, sans-serif'
    ctx.letterSpacing = '12px'
    ctx.fillText(sub, w / 2, h / 2 + 78)
    ctx.globalAlpha = 0.18
    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < 17; i++) ctx.fillRect(0, i * 31, w, 1)
  })
  const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 1.1, height + 1.1, 0.35), blackMetal)
  frame.position.set(x, y, z)
  frame.rotation.y = rotationY
  scene.add(frame)
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide })
  )
  panel.position.set(x + Math.sin(rotationY) * 0.21, y, z + Math.cos(rotationY) * 0.21)
  panel.rotation.y = rotationY
  scene.add(panel)
  addGlow(new THREE.Color(colorA), width * 1.34, panel.position.x, y, panel.position.z, 0.1)
  signFlickers.push({ material: panel.material, base: 1, phase: random() * 10, rare: false })
}

const BOULEVARD_NAMES = ['THE VICE', 'HOTEL NOIR', 'KARAOKE', 'SUNSET', 'TACOS', 'CLUB 77', 'ARCADE', 'LIQUOR']
let boulevardLightCount = 0

function addBoulevardFront(cx, cz, w, d, h, index) {
  const name = BOULEVARD_NAMES[index % BOULEVARD_NAMES.length]
  const color = new THREE.Color(SIGN_COLORS[(index + 1) % SIGN_COLORS.length])
  const storeWidth = Math.min(w * 0.76, 14)
  const storeHeight = 3.3
  const frontZ = cz - d / 2 - 0.09
  const texture = canvasTexture(768, 256, (ctx, cw, ch) => {
    ctx.fillStyle = '#08060f'
    ctx.fillRect(0, 0, cw, ch)
    const glow = ctx.createLinearGradient(0, 0, 0, ch)
    glow.addColorStop(0, 'rgba(255,188,109,.22)')
    glow.addColorStop(1, 'rgba(255,118,80,.05)')
    ctx.fillStyle = glow
    ctx.fillRect(12, 12, cw - 24, ch - 24)
    ctx.strokeStyle = '#ffcf86'
    ctx.globalAlpha = 0.85
    ctx.lineWidth = 4
    ctx.strokeRect(12, 12, cw - 24, ch - 24)
    ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(255,203,139,.23)'
    ctx.fillRect(28, 46, cw - 56, ch - 82)
    for (let pane = 0; pane < 4; pane++) {
      const x = 35 + pane * (cw - 70) / 4
      const pw = (cw - 70) / 4 - 10
      const paneGlow = ctx.createLinearGradient(0, 48, 0, ch - 39)
      paneGlow.addColorStop(0, 'rgba(255,225,170,.62)')
      paneGlow.addColorStop(1, 'rgba(255,129,94,.07)')
      ctx.fillStyle = paneGlow
      ctx.fillRect(x, 48, pw, ch - 86)
      ctx.fillStyle = 'rgba(9,5,14,.7)'
      ctx.fillRect(x + pw * 0.18, ch * 0.49, pw * 0.16, ch * 0.35)
      ctx.beginPath()
      ctx.arc(x + pw * 0.26, ch * 0.43, pw * 0.08, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillRect(x + pw * 0.6, ch * 0.55, pw * 0.16, ch * 0.28)
      ctx.beginPath()
      ctx.arc(x + pw * 0.68, ch * 0.49, pw * 0.07, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#fff0c4'
    ctx.font = '900 38px Impact, "Arial Black", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = '#' + color.getHexString()
    ctx.shadowBlur = 22
    ctx.fillText(name, cw / 2, 30)
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(12,7,17,.88)'
    for (let i = 1; i < 4; i++) ctx.fillRect(35 + i * (cw - 70) / 4 - 4, 46, 7, ch - 84)
  })
  const store = new THREE.Mesh(
    new THREE.PlaneGeometry(storeWidth, storeHeight),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
  )
  store.position.set(cx + rand(-w * 0.06, w * 0.06), 1.93, frontZ)
  store.rotation.y = Math.PI
  scene.add(store)
  const awning = new THREE.Mesh(new THREE.BoxGeometry(storeWidth + 0.5, 0.28, 1.0), darkMetal)
  awning.position.set(store.position.x, 3.72, frontZ - 0.45)
  scene.add(awning)
  addNeonStrip(store.position.x, 3.92, frontZ - 0.92, storeWidth + 0.25, 0.075, 0.075, color)
  addGlow(color, storeWidth * 0.72, store.position.x, 2.2, frontZ - 0.8, 0.12)
  const storeGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(storeWidth * 0.8, 6),
    new THREE.MeshBasicMaterial({ map: glowTexture, color, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  )
  storeGlow.rotation.x = -Math.PI / 2
  storeGlow.position.set(store.position.x, 0.025, frontZ - 1.4)
  scene.add(storeGlow)
  if (random() < 0.55 || boulevardLightCount < 3) {
    const light = new THREE.PointLight(color, 8, 18, 2)
    light.position.set(store.position.x, 2.8, frontZ - 2.1)
    scene.add(light)
    boulevardLightCount++
  }
  const signWidth = Math.min(storeWidth * 0.72, 10)
  const signTexture = makeSignTexture(name.replace(' THE', ''), '#' + color.getHexString(), '#fff0cc')
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(signWidth, signWidth * 0.29),
    new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, toneMapped: false, side: THREE.DoubleSide })
  )
  sign.position.set(store.position.x, 5.35, frontZ - 0.02)
  sign.rotation.y = Math.PI
  scene.add(sign)
  signFlickers.push({ material: sign.material, base: 1, phase: random() * 10, rare: Math.random() < 0.18 })
}

const BLADE_NAMES = ['HOTEL', 'VICE', 'CLUB', '24/7', 'LIQUOR', 'RAMEN', 'MOTEL', 'ARCADE']
let bladeLightCount = 0

function addBladeSign(side, z, index) {
  const name = BLADE_NAMES[index % BLADE_NAMES.length]
  const color = new THREE.Color(SIGN_COLORS[(index + 3) % SIGN_COLORS.length])
  const texture = canvasTexture(256, 768, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(4,3,10,.94)'
    ctx.fillRect(3, 3, w - 6, h - 6)
    ctx.strokeStyle = '#' + color.getHexString()
    ctx.lineWidth = 7
    ctx.shadowColor = '#' + color.getHexString()
    ctx.shadowBlur = 28
    ctx.strokeRect(15, 15, w - 30, h - 30)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '900 104px Impact, "Arial Black", sans-serif'
    const step = 122
    const start = h / 2 - (name.length - 1) * step / 2
    for (let i = 0; i < name.length; i++) {
      ctx.fillStyle = i === 0 ? '#fff4cc' : '#' + color.getHexString()
      ctx.fillText(name[i], w / 2, start + i * step)
    }
    ctx.font = '800 17px Arial, sans-serif'
    ctx.letterSpacing = '4px'
    ctx.fillStyle = 'rgba(255,255,255,.65)'
    ctx.fillText('OCEAN DRIVE', w / 2, h - 46)
  })
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 12.5, 6), darkMetal)
  pole.position.set(side * 12.2, 6.25, z)
  scene.add(pole)
  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 0.1), darkMetal)
  arm.position.set(side * 10.95, 10.9, z)
  scene.add(arm)
  const plate = new THREE.Mesh(new THREE.BoxGeometry(2.55, 6.9, 0.18), blackMetal)
  plate.position.set(side * 9.9, 7.65, z)
  scene.add(plate)
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.35, 6.65),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, side: THREE.DoubleSide })
  )
  plane.position.set(side * 9.9, 7.65, z - 0.11)
  plane.rotation.y = Math.PI
  scene.add(plane)
  addGlow(color, 7.2, side * 9.9, 7.65, z - 0.7, 0.12)
  const roadGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, 15),
    new THREE.MeshBasicMaterial({ map: glowTexture, color, transparent: true, opacity: 0.11, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  )
  roadGlow.rotation.x = -Math.PI / 2
  roadGlow.position.set(side * 8.4, 0.025, z + 1.5)
  scene.add(roadGlow)
  addNeonStrip(side * 9.9, 4.24, z - 0.12, 2.25, 0.06, 0.06, color)
  addNeonStrip(side * 9.9, 11.08, z - 0.12, 2.25, 0.06, 0.06, color)
  signFlickers.push({ material: plane.material, base: 1, phase: random() * 10, rare: Math.random() < 0.25 })
  if (bladeLightCount < 4) {
    const light = new THREE.PointLight(color, 9, 22, 2)
    light.position.set(side * 8.5, 7.6, z - 1)
    scene.add(light)
    bladeLightCount++
  }
}

function createBuilding(cx, cz, w, d, h, style, signIndex) {
  const geometry = new THREE.BoxGeometry(w, h, d)
  scaleBoxUv(geometry, w, h, d, 30)
  const facade = facadeMaterials[style].material
  const mesh = new THREE.Mesh(geometry, [facade, facade, roofMaterial, roofMaterial, facade, facade])
  mesh.position.set(cx, 0.3 + h / 2, cz)
  mesh.receiveShadow = true
  scene.add(mesh)
  colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, height: h })
  const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.25, 0.45, d + 0.25), roofMaterial)
  cap.position.set(cx, 0.3 + h + 0.2, cz)
  scene.add(cap)
  if (h > 28) {
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, rand(4, 10), 5), darkMetal)
    antenna.position.set(cx + rand(-w * 0.2, w * 0.2), 0.3 + h + 2.5, cz + rand(-d * 0.2, d * 0.2))
    scene.add(antenna)
  }
  if (random() < 0.63) {
    const color = new THREE.Color(pick(SIGN_COLORS))
    const bandY = 0.3 + h - rand(0.8, 3.2)
    addNeonStrip(cx, bandY, cz - d / 2 - 0.08, w * 0.82, 0.14, 0.14, color)
    addNeonStrip(cx, bandY, cz + d / 2 + 0.08, w * 0.82, 0.14, 0.14, color)
  }
  if (random() < 0.25) {
    addNeonStrip(cx + w / 2 + 0.08, 0.3 + h * 0.55, cz, 0.12, h * 0.5, 0.12, new THREE.Color(pick(SIGN_COLORS)))
  }
  const side = cx >= 0 ? 1 : -1
  addStorefrontSign(cx, cz, w, side, h, signIndex)
  if (cz > 92 && Math.abs(cx) < 78 && random() < 0.62) addBoulevardFront(cx, cz, w, d, h, signIndex)
  return mesh
}

function createPlaza(cx, cz) {
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(28, 0.55, 28), new THREE.MeshStandardMaterial({ color: 0x282139, roughness: 0.62, metalness: 0.22 }))
  plinth.position.set(cx, 0.55, cz)
  scene.add(plinth)
  const sculpture = new THREE.Mesh(new THREE.TorusKnotGeometry(3.6, 0.38, 90, 12, 2, 3), new THREE.MeshBasicMaterial({ color: 0xff4fa8, toneMapped: false }))
  sculpture.position.set(cx, 6.8, cz)
  sculpture.rotation.x = 0.4
  scene.add(sculpture)
  addGlow(new THREE.Color(0xff3fa4), 18, cx, 7, cz, 0.24)
  const light = new THREE.PointLight(0xff4fa8, 16, 42, 2)
  light.position.set(cx, 7, cz)
  scene.add(light)
  colliders.push({ minX: cx - 14, maxX: cx + 14, minZ: cz - 14, maxZ: cz + 14, height: 1 })
  return sculpture
}

const plazaSculptures = []
let signIndex = 0
for (const bx of BLOCKS) {
  for (const bz of BLOCKS) {
    const central = Math.abs(bx) < 125 && Math.abs(bz) < 150
    if (random() < 0.075 && !(Math.abs(bx) === 39 && Math.abs(bz) === 39)) {
      plazaSculptures.push(createPlaza(bx, bz))
      continue
    }
    const rows = random() < 0.48 ? 2 : 1
    const cols = random() < 0.58 ? 2 : 1
    const cellW = 56 / cols
    const cellD = 56 / rows
    for (let ix = 0; ix < cols; ix++) {
      for (let iz = 0; iz < rows; iz++) {
        if (rows * cols > 1 && random() < 0.12) continue
        const w = cellW - rand(5, 8.5)
        const d = cellD - rand(5, 8.5)
        const px = bx - 28 + cellW * ix + cellW / 2 + rand(-1.4, 1.4)
        const pz = bz - 28 + cellD * iz + cellD / 2 + rand(-1.4, 1.4)
        let h = 9 + Math.pow(random(), 1.65) * (central ? 80 : 48)
        if (Math.abs(bx) === 39 && Math.abs(bz) < 90) h += rand(15, 45)
        if (random() < 0.07) h += 35
        const style = random() < 0.45 ? 2 : Math.floor(random() * facadeMaterials.length)
        createBuilding(px, pz, w, d, h, (style + ix + iz) % facadeMaterials.length, signIndex++)
      }
    }
  }
}

addBillboard('VICE CITY', 'NEVER SLEEPS', '#ff3fa4', '#7b4dff', 41, 31, 48, -Math.PI / 2, 25, 12.5)
addBillboard('NIGHTLIFE', 'OCEAN DRIVE 07', '#55f5ff', '#a560ff', -41, 43, 143, Math.PI / 2, 23, 11.5)
addBillboard('PARADISE', 'LIVE FOREVER', '#ffd166', '#ff5b7b', 41, 49, 213, -Math.PI / 2, 24, 12)
const bladeZ = [116, 154, 192, 230, 268]
bladeZ.forEach((z, i) => {
  addBladeSign(-1, z, i)
  addBladeSign(1, z + 13, i + 3)
})

const neonGeometry = new THREE.BoxGeometry(1, 1, 1)
const neonMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
const neonMesh = new THREE.InstancedMesh(neonGeometry, neonMaterial, neonStrips.length)
neonStrips.forEach((s, i) => {
  dummy.position.set(s.x, s.y, s.z)
  dummy.rotation.set(0, 0, 0)
  dummy.scale.set(s.w, s.h, s.d)
  dummy.updateMatrix()
  neonMesh.setMatrixAt(i, dummy.matrix)
  neonMesh.setColorAt(i, s.color)
})
neonMesh.instanceMatrix.needsUpdate = true
if (neonMesh.instanceColor) neonMesh.instanceColor.needsUpdate = true
neonMesh.frustumCulled = false
scene.add(neonMesh)


function addStreetArch() {
  const group = new THREE.Group()
  const pillarMaterial = new THREE.MeshStandardMaterial({ color: 0x15131d, roughness: 0.28, metalness: 0.82 })
  for (const x of [-13.1, 13.1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.72, 14, 0.72), pillarMaterial)
    pillar.position.set(x, 7, 0)
    group.add(pillar)
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.13, 13.2, 0.13), new THREE.MeshBasicMaterial({ color: 0x55f5ff, toneMapped: false }))
    strip.position.set(x - Math.sign(x) * 0.39, 7, 0.38)
    group.add(strip)
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(27, 0.6, 0.8), pillarMaterial)
  beam.position.y = 13.7
  group.add(beam)
  const signTexture = canvasTexture(1024, 180, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(5,4,12,.9)'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#55f5ff'
    ctx.lineWidth = 4
    ctx.strokeRect(8, 8, w - 16, h - 16)
    ctx.fillStyle = '#f8ffff'
    ctx.font = '900 104px Impact, "Arial Black", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = '#55f5ff'
    ctx.shadowBlur = 25
    ctx.fillText('OCEAN DRIVE', w / 2, h / 2 + 3)
    ctx.fillStyle = '#ff3fa4'
    ctx.shadowColor = '#ff3fa4'
    ctx.font = '800 21px Arial, sans-serif'
    ctx.letterSpacing = '11px'
    ctx.fillText('SOUTH BEACH · 07', w / 2, h - 31)
  })
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(23.5, 4.15), new THREE.MeshBasicMaterial({ map: signTexture, toneMapped: false, side: THREE.DoubleSide }))
  sign.position.set(0, 13.7, -0.46)
  sign.rotation.y = Math.PI
  group.add(sign)
  addGlow(new THREE.Color(0x55f5ff), 18, 0, 13.8, -0.7, 0.15)
  addGlow(new THREE.Color(0xff3fa4), 11, -13.1, 7, 0, 0.13)
  addGlow(new THREE.Color(0xff3fa4), 11, 13.1, 7, 0, 0.13)
  group.position.z = 168
  scene.add(group)
}
addStreetArch()

const lampPositions = []
for (const x of [-12.3, 12.3]) {
  for (let z = -264; z <= 264; z += 38) {
    if (ROADS.some(r => Math.abs(z - r) < 9)) continue
    lampPositions.push({ x, z, side: Math.sign(x) })
  }
}
const lampPoleGeometry = new THREE.CylinderGeometry(0.09, 0.14, 6.2, 6)
const lampArmGeometry = new THREE.BoxGeometry(1.25, 0.09, 0.09)
const lampBulbGeometry = new THREE.SphereGeometry(0.17, 8, 6)
const lampPoleMaterial = new THREE.MeshStandardMaterial({ color: 0x1f1c28, roughness: 0.38, metalness: 0.8 })
const lampBulbMaterial = new THREE.MeshBasicMaterial({ color: 0xffd8a1, toneMapped: false })
const lampPoleMesh = new THREE.InstancedMesh(lampPoleGeometry, lampPoleMaterial, lampPositions.length)
const lampArmMesh = new THREE.InstancedMesh(lampArmGeometry, lampPoleMaterial, lampPositions.length)
const lampBulbMesh = new THREE.InstancedMesh(lampBulbGeometry, lampBulbMaterial, lampPositions.length)
const lampGlowPositions = []
const poolPositions = []
lampPositions.forEach((lamp, i) => {
  dummy.position.set(lamp.x, 3.1, lamp.z)
  dummy.rotation.set(0, 0, 0)
  dummy.scale.set(1, 1, 1)
  dummy.updateMatrix()
  lampPoleMesh.setMatrixAt(i, dummy.matrix)
  dummy.position.set(lamp.x - lamp.side * 0.58, 6.16, lamp.z)
  dummy.updateMatrix()
  lampArmMesh.setMatrixAt(i, dummy.matrix)
  dummy.position.set(lamp.x - lamp.side * 1.14, 6.06, lamp.z)
  dummy.updateMatrix()
  lampBulbMesh.setMatrixAt(i, dummy.matrix)
  lampGlowPositions.push(lamp.x - lamp.side * 1.14, 6.06, lamp.z)
  poolPositions.push({ x: lamp.x - lamp.side * 1.14, z: lamp.z })
})
lampPoleMesh.instanceMatrix.needsUpdate = true
lampArmMesh.instanceMatrix.needsUpdate = true
lampBulbMesh.instanceMatrix.needsUpdate = true
lampPoleMesh.frustumCulled = false
lampArmMesh.frustumCulled = false
lampBulbMesh.frustumCulled = false
scene.add(lampPoleMesh, lampArmMesh, lampBulbMesh)

const lampGlowGeometry = new THREE.BufferGeometry()
lampGlowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lampGlowPositions, 3))
const lampGlowPoints = new THREE.Points(lampGlowGeometry, new THREE.PointsMaterial({
  map: glowTexture,
  color: 0xffbf7b,
  size: 3.9,
  transparent: true,
  opacity: 0.7,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  sizeAttenuation: true,
  toneMapped: false
}))
scene.add(lampGlowPoints)

const poolGeometry = new THREE.PlaneGeometry(1, 1)
poolGeometry.rotateX(-Math.PI / 2)
const poolMaterial = new THREE.MeshBasicMaterial({
  map: glowTexture,
  color: 0xffa663,
  transparent: true,
  opacity: 0.16,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false
})
const poolMesh = new THREE.InstancedMesh(poolGeometry, poolMaterial, poolPositions.length)
poolPositions.forEach((p, i) => {
  dummy.position.set(p.x, 0.018, p.z)
  dummy.rotation.set(0, 0, 0)
  dummy.scale.set(12, 1, 15)
  dummy.updateMatrix()
  poolMesh.setMatrixAt(i, dummy.matrix)
})
poolMesh.instanceMatrix.needsUpdate = true
poolMesh.frustumCulled = false
scene.add(poolMesh)

for (const z of [-192, -96, 8, 108, 208]) {
  const light = new THREE.PointLight(0xffb47a, 14, 34, 2)
  light.position.set(0, 6.2, z)
  scene.add(light)
}
for (const [x, z, color] of [[-18, 62, 0xff3fa4], [20, 137, 0x55f5ff], [-20, 212, 0x9a63ff]]) {
  const light = new THREE.PointLight(color, 20, 32, 2)
  light.position.set(x, 5.4, z)
  scene.add(light)
}

function makeLeafGeometry() {
  const positions = []
  const indices = []
  const segments = 5
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const x = t * 4.6
    const width = (0.34 * (1 - t) + 0.055) * (1 + Math.sin(t * Math.PI) * 0.4)
    const y = -t * t * 1.25 + Math.sin(t * Math.PI) * 0.15
    positions.push(x, y, -width, x, y, width)
    if (i < segments) {
      const a = i * 2
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

const palmSpots = []
for (const x of [-17.5, 17.5]) {
  for (let z = -248; z <= 248; z += 41) {
    if (random() < 0.76) palmSpots.push({ x: x + rand(-1.4, 1.4), z: z + rand(-5, 5), scale: rand(0.8, 1.15) })
  }
}
for (let i = 0; i < 22; i++) {
  const side = i % 2 === 0 ? -1 : 1
  palmSpots.push({ x: side * rand(35, 250), z: rand(292, 312), scale: rand(0.85, 1.25) })
}
for (const p of palmSpots) p.rotation = random() * Math.PI * 2

const trunkGeometry = new THREE.CylinderGeometry(0.18, 0.38, 7, 7)
const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x49342c, roughness: 0.92, metalness: 0.02 })
const trunkMesh = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, palmSpots.length)
const leafGeometry = makeLeafGeometry()
const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x2c724b, roughness: 0.82, metalness: 0.05, side: THREE.DoubleSide, emissive: 0x07190f, emissiveIntensity: 0.7 })
const leafMesh = new THREE.InstancedMesh(leafGeometry, leafMaterial, palmSpots.length * 8)
palmSpots.forEach((palm, pIndex) => {
  dummy.position.set(palm.x, 3.5 * palm.scale + 0.3, palm.z)
  dummy.rotation.set(0, palm.rotation, 0)
  dummy.scale.set(palm.scale, palm.scale, palm.scale)
  dummy.updateMatrix()
  trunkMesh.setMatrixAt(pIndex, dummy.matrix)
  for (let leaf = 0; leaf < 8; leaf++) {
    const angle = palm.rotation + leaf / 8 * Math.PI * 2
    dummy.position.set(palm.x, 0.3 + 6.85 * palm.scale, palm.z)
    dummy.rotation.set(0, -angle, 0)
    dummy.scale.set(palm.scale, palm.scale, palm.scale)
    dummy.updateMatrix()
    leafMesh.setMatrixAt(pIndex * 8 + leaf, dummy.matrix)
  }
})
trunkMesh.instanceMatrix.needsUpdate = true
leafMesh.instanceMatrix.needsUpdate = true
trunkMesh.frustumCulled = false
leafMesh.frustumCulled = false
trunkMesh.castShadow = true
scene.add(trunkMesh, leafMesh)

const puddleMaterial = new THREE.MeshBasicMaterial({
  map: glowTexture,
  color: 0xffffff,
  transparent: true,
  opacity: 0.19,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false
})
const puddleMesh = new THREE.InstancedMesh(poolGeometry, puddleMaterial, 34)
for (let i = 0; i < 34; i++) {
  const road = pick(ROADS)
  const vertical = random() > 0.5
  dummy.position.set(vertical ? road + rand(-8, 8) : rand(-270, 270), 0.022, vertical ? rand(-270, 270) : road + rand(-8, 8))
  dummy.rotation.set(0, random() * Math.PI, 0)
  dummy.scale.set(rand(2, 7), 1, rand(5, 14))
  dummy.updateMatrix()
  puddleMesh.setMatrixAt(i, dummy.matrix)
  puddleMesh.setColorAt(i, new THREE.Color(pick([0x8b6cff, 0x42d9ff, 0xff4d9d])))
}
puddleMesh.instanceMatrix.needsUpdate = true
if (puddleMesh.instanceColor) puddleMesh.instanceColor.needsUpdate = true
puddleMesh.frustumCulled = false
scene.add(puddleMesh)

const beach = new THREE.Mesh(
  new THREE.PlaneGeometry(680, 42),
  new THREE.MeshStandardMaterial({ color: 0x806a5d, roughness: 0.94, metalness: 0.02 })
)
beach.rotation.x = -Math.PI / 2
beach.position.set(0, -0.02, 296)
beach.receiveShadow = true
scene.add(beach)

const waterMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x06182c,
  roughness: 0.14,
  metalness: 0.7,
  clearcoat: 0.8,
  clearcoatRoughness: 0.18,
  emissive: 0x03101e,
  emissiveIntensity: 0.7
})
const water = new THREE.Mesh(new THREE.PlaneGeometry(1600, 650), waterMaterial)
water.rotation.x = -Math.PI / 2
water.position.set(0, -0.62, 610)
scene.add(water)

const reflectionTexture = canvasTexture(256, 1024, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h)
  const horizontal = ctx.createLinearGradient(0, 0, w, 0)
  horizontal.addColorStop(0, 'rgba(255,255,255,0)')
  horizontal.addColorStop(0.44, 'rgba(255,255,255,.06)')
  horizontal.addColorStop(0.5, 'rgba(255,255,255,.9)')
  horizontal.addColorStop(0.56, 'rgba(255,255,255,.06)')
  horizontal.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = horizontal
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'destination-out'
  for (let y = 0; y < h; y += 9) {
    ctx.fillStyle = `rgba(0,0,0,${0.2 + Math.random() * 0.48})`
    ctx.fillRect(0, y, w, rand(1, 4))
  }
  const fade = ctx.createLinearGradient(0, 0, 0, h)
  fade.addColorStop(0, 'rgba(0,0,0,0)')
  fade.addColorStop(0.72, 'rgba(0,0,0,.18)')
  fade.addColorStop(1, 'rgba(0,0,0,.95)')
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, w, h)
})
const reflection = new THREE.Mesh(
  new THREE.PlaneGeometry(52, 560),
  new THREE.MeshBasicMaterial({ map: reflectionTexture, color: 0xffb168, transparent: true, opacity: 0.48, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
)
reflection.rotation.x = -Math.PI / 2
reflection.position.set(-8, -0.52, 560)
scene.add(reflection)

const pier = new THREE.Mesh(new THREE.BoxGeometry(46, 1.1, 146), new THREE.MeshStandardMaterial({ map: woodTexture, color: 0x8d746b, roughness: 0.76, metalness: 0.08 }))
pier.position.set(0, -0.18, 365)
scene.add(pier)

for (const x of [-22.5, 22.5]) {
  for (let z = 294; z <= 434; z += 14) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.4, 0.35), darkMetal)
    post.position.set(x, 0.55, z)
    scene.add(post)
    addGlow(new THREE.Color(0xffc47a), 5.4, x, 1.15, z, 0.15)
  }
}
const pierRailGeometry = new THREE.BoxGeometry(0.1, 0.1, 140)
for (const x of [-23, 23]) {
  const rail = new THREE.Mesh(pierRailGeometry, new THREE.MeshStandardMaterial({ color: 0x2f2630, roughness: 0.4, metalness: 0.8 }))
  rail.position.set(x, 1.55, 366)
  scene.add(rail)
}

const pierGateTexture = canvasTexture(1024, 256, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(5,4,12,.95)'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#ffd166'
  ctx.lineWidth = 6
  ctx.strokeRect(12, 12, w - 24, h - 24)
  ctx.fillStyle = '#ffe8a8'
  ctx.font = '900 128px Impact, "Arial Black", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = '#ffb52e'
  ctx.shadowBlur = 38
  ctx.fillText('NEON PIER', w / 2, 112)
  ctx.shadowColor = '#ff3fa4'
  ctx.fillStyle = '#ff62b6'
  ctx.font = '800 30px Arial, sans-serif'
  ctx.letterSpacing = '15px'
  ctx.fillText('OPEN ALL NIGHT', w / 2, 205)
})
const pierGate = new THREE.Mesh(new THREE.PlaneGeometry(34, 8.5), new THREE.MeshBasicMaterial({ map: pierGateTexture, transparent: true, toneMapped: false, side: THREE.DoubleSide }))
pierGate.position.set(0, 9, 293.5)
pierGate.rotation.y = Math.PI
scene.add(pierGate)
for (const x of [-16, 16]) {
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9, 0.8), darkMetal)
  leg.position.set(x, 4.5, 294)
  scene.add(leg)
  addGlow(new THREE.Color(0xff3fa4), 13, x, 4.6, 293.8, 0.12)
}

const ferris = new THREE.Group()
const ferrisCenter = new THREE.Group()
ferrisCenter.position.set(0, 21, 386)
const wheelMaterial = new THREE.MeshBasicMaterial({ color: 0xff4fb2, toneMapped: false })
const wheel = new THREE.Mesh(new THREE.TorusGeometry(16.5, 0.22, 8, 80), wheelMaterial)
ferrisCenter.add(wheel)
const innerWheel = new THREE.Mesh(new THREE.TorusGeometry(11.6, 0.1, 6, 68), new THREE.MeshBasicMaterial({ color: 0x55f5ff, toneMapped: false }))
ferrisCenter.add(innerWheel)
for (let i = 0; i < 16; i++) {
  const angle = i / 16 * Math.PI * 2
  const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 32.8, 5), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x55f5ff : 0xff4fb2, toneMapped: false }))
  spoke.rotation.z = angle + Math.PI / 2
  ferrisCenter.add(spoke)
}
const gondolas = []
for (let i = 0; i < 16; i++) {
  const angle = i / 16 * Math.PI * 2
  const gondola = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 1.7), new THREE.MeshStandardMaterial({ color: pick([0xffd166, 0x55f5ff, 0xff4fa8, 0xa6ff7a]), roughness: 0.4, metalness: 0.4, emissive: 0x221122, emissiveIntensity: 0.4 }))
  gondola.add(body)
  gondola.position.set(Math.cos(angle) * 16.5, Math.sin(angle) * 16.5, 0)
  gondola.rotation.z = angle
  ferrisCenter.add(gondola)
  gondolas.push(gondola)
}
ferris.add(ferrisCenter)
for (const x of [-5.4, 5.4]) {
  for (const z of [-3, 3]) {
    const support = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.48, 22, 6), darkMetal)
    support.position.set(x, 10.5, z)
    support.rotation.z = x * 0.025
    ferris.add(support)
  }
}
ferris.position.z = 0
scene.add(ferris)
addGlow(new THREE.Color(0xff3fa4), 56, 0, 21, 386, 0.13)
const ferrisLight = new THREE.PointLight(0xff4fa8, 25, 90, 2)
ferrisLight.position.set(0, 21, 382)
scene.add(ferrisLight)

const wheelRing = new THREE.Mesh(
  new THREE.TorusGeometry(7, 0.12, 6, 56),
  new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.8, toneMapped: false })
)
wheelRing.rotation.x = -Math.PI / 2
wheelRing.position.set(0, 0.25, 358)
scene.add(wheelRing)
const beacon = new THREE.Mesh(
  new THREE.CylinderGeometry(0.16, 0.55, 24, 12, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
)
beacon.position.set(0, 12, 358)
scene.add(beacon)


const carBodyShape = new THREE.Shape()
carBodyShape.moveTo(-2.15, 0.26)
carBodyShape.lineTo(-2.15, 0.57)
carBodyShape.lineTo(-1.72, 0.67)
carBodyShape.lineTo(-1.12, 1.13)
carBodyShape.lineTo(0.52, 1.13)
carBodyShape.lineTo(1.36, 0.71)
carBodyShape.lineTo(2.15, 0.63)
carBodyShape.lineTo(2.15, 0.29)
carBodyShape.lineTo(1.72, 0.21)
carBodyShape.lineTo(-1.72, 0.21)
carBodyShape.closePath()
const carBodyGeometry = new THREE.ExtrudeGeometry(carBodyShape, {
  depth: 1.9,
  bevelEnabled: true,
  bevelThickness: 0.08,
  bevelSize: 0.075,
  bevelSegments: 2,
  steps: 1
})
carBodyGeometry.rotateY(-Math.PI / 2)
carBodyGeometry.translate(0.95, 0, 0)
const carGlassGeometry = new THREE.BoxGeometry(1.87, 0.35, 1.52)
const carWheelGeometry = new THREE.CylinderGeometry(0.39, 0.39, 0.3, 16)
carWheelGeometry.rotateZ(Math.PI / 2)
const carRimGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.315, 12)
carRimGeometry.rotateZ(Math.PI / 2)
const tireMaterial = new THREE.MeshStandardMaterial({ color: 0x08080c, roughness: 0.72, metalness: 0.15 })
const rimMaterial = new THREE.MeshStandardMaterial({ color: 0xc9c6d2, roughness: 0.22, metalness: 0.9 })
const headlightMaterial = new THREE.MeshBasicMaterial({ color: 0xfff7d6, toneMapped: false })
const taillightMaterial = new THREE.MeshBasicMaterial({ color: 0xff183d, toneMapped: false })
const underglowTexture = glowTexture

function createCar({ color = 0xff5838, playerCar = false } = {}) {
  const group = new THREE.Group()
  const paint = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.24,
    metalness: 0.62,
    clearcoat: 1,
    clearcoatRoughness: 0.13
  })
  const body = new THREE.Mesh(carBodyGeometry, paint)
  group.add(body)
  const glass = new THREE.Mesh(carGlassGeometry, glassMaterial)
  glass.position.set(0, 0.96, -0.08)
  group.add(glass)
  if (playerCar) {
    const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0xfff3d4, roughness: 0.3, metalness: 0.35 })
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 4.0), stripeMaterial)
    stripe.position.set(0, 1.145, 0)
    group.add(stripe)
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.07, 0.36), blackMetal)
    spoiler.position.set(0, 1.27, -1.8)
    group.add(spoiler)
    for (const x of [-0.73, 0.73]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.12), blackMetal)
      strut.position.set(x, 1.13, -1.78)
      group.add(strut)
    }
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.07, 0.26), blackMetal)
    splitter.position.set(0, 0.25, 2.12)
    group.add(splitter)
    const sideGlowMaterial = new THREE.MeshBasicMaterial({ color: 0x55f5ff, toneMapped: false })
    for (const x of [-1.03, 1.03]) {
      const sideGlow = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.055, 2.8), sideGlowMaterial)
      sideGlow.position.set(x, 0.45, 0)
      group.add(sideGlow)
    }
  }
  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.53, 0.28, 0.45), glassMaterial)
  rearGlass.position.set(0, 0.91, -1.46)
  rearGlass.rotation.x = -0.48
  group.add(rearGlass)
  for (const x of [-1.02, 1.02]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.25), blackMetal)
    mirror.position.set(x, 0.95, 0.38)
    group.add(mirror)
  }
  const lightBar = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.11, 0.06), headlightMaterial)
  lightBar.position.set(0, 0.63, 2.18)
  group.add(lightBar)
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.12, 0.06), taillightMaterial)
  tailBar.position.set(0, 0.66, -2.16)
  group.add(tailBar)
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.16, 0.04), new THREE.MeshBasicMaterial({ color: 0xd8ffca }))
  plate.position.set(0, 0.43, -2.21)
  group.add(plate)
  const wheels = []
  for (const x of [-0.97, 0.97]) {
    for (const z of [-1.38, 1.38]) {
      const wheel = new THREE.Group()
      const tire = new THREE.Mesh(carWheelGeometry, tireMaterial)
      wheel.add(tire)
      const rim = new THREE.Mesh(carRimGeometry, rimMaterial)
      wheel.add(rim)
      wheel.position.set(x, 0.39, z)
      group.add(wheel)
      wheels.push(wheel)
    }
  }
  const glowMaterial = new THREE.SpriteMaterial({ map: glowTexture, color: 0xfff0c0, transparent: true, opacity: playerCar ? 0.72 : 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  for (const x of [-0.62, 0.62]) {
    const headGlow = new THREE.Sprite(glowMaterial)
    headGlow.position.set(x, 0.64, 2.3)
    headGlow.scale.set(playerCar ? 2.7 : 1.55, playerCar ? 2.7 : 1.55, 1)
    group.add(headGlow)
  }
  const tailGlowMaterial = new THREE.SpriteMaterial({ map: glowTexture, color: 0xff183d, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  const tailGlow = new THREE.Sprite(tailGlowMaterial)
  tailGlow.position.set(0, 0.68, -2.3)
  tailGlow.scale.set(1.35, 1.35, 1)
  group.add(tailGlow)
  if (playerCar) {
    const glowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(3.0, 5.1),
      new THREE.MeshBasicMaterial({ map: underglowTexture, color: 0xff3fa4, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    )
    glowPlane.rotation.x = -Math.PI / 2
    glowPlane.position.y = 0.025
    group.add(glowPlane)
    const headlight = new THREE.SpotLight(0xfff0d0, 85, 56, 0.42, 0.7, 1.45)
    headlight.position.set(0, 0.72, 2.1)
    headlight.target.position.set(0, 0.2, 15)
    group.add(headlight, headlight.target)
  }
  group.traverse(child => {
    if (child.isMesh) {
      child.castShadow = playerCar
      child.receiveShadow = true
    }
  })
  group.userData.wheels = wheels
  return group
}

const playerCar = createCar({ color: 0xff5a36, playerCar: true })
playerCar.position.set(1.8, 0, 105.5)
scene.add(playerCar)

const trafficColors = [0xe8b536, 0x53d8f2, 0xdf4d8c, 0xa6e85c, 0x6d63ee, 0xe6dfcc, 0xff7a45, 0x4b94d8]
for (let i = 0; i < 13; i++) {
  const color = trafficColors[i % trafficColors.length]
  const car = createCar({ color })
  const vertical = random() > 0.5
  const road = pick(ROADS)
  const offset = pick([-4.7, 4.7])
  const direction = offset > 0 ? 1 : -1
  const along = rand(-265, 265)
  const speed = rand(8, 15)
  let x, z, yaw
  if (vertical) {
    x = road + offset
    z = along
    yaw = direction > 0 ? 0 : Math.PI
  } else {
    x = along
    z = road + offset
    yaw = direction > 0 ? Math.PI / 2 : -Math.PI / 2
  }
  car.position.set(x, 0, z)
  car.rotation.y = yaw
  scene.add(car)
  traffic.push({ car, vertical, road, offset, direction, speed, wheels: car.userData.wheels })
}

const pedestrianGeometries = {
  torso: new THREE.CapsuleGeometry(0.2, 0.5, 4, 8),
  head: new THREE.SphereGeometry(0.17, 10, 8),
  leg: new THREE.CapsuleGeometry(0.1, 0.54, 4, 8),
  arm: new THREE.CapsuleGeometry(0.075, 0.48, 4, 8)
}
const skinMaterials = [0xc98f6d, 0x8f6048, 0xe0ad8b, 0x6c4636].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.78 }))
const shirtColors = [0x4ec9df, 0xff4877, 0xf0cb55, 0x9b73ee, 0x8ee06c, 0xdad6e6, 0xff8e3f]
const pantsColors = [0x1e2740, 0x25212d, 0x3d3448, 0x23372f]

function createPedestrian() {
  const root = new THREE.Group()
  const shirt = new THREE.MeshStandardMaterial({ color: pick(shirtColors), roughness: 0.73, metalness: 0.03 })
  const pants = new THREE.MeshStandardMaterial({ color: pick(pantsColors), roughness: 0.84 })
  const skin = pick(skinMaterials)
  const torso = new THREE.Mesh(pedestrianGeometries.torso, shirt)
  torso.position.y = 1.25
  root.add(torso)
  const head = new THREE.Mesh(pedestrianGeometries.head, skin)
  head.position.y = 1.76
  root.add(head)
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.178, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.62), new THREE.MeshStandardMaterial({ color: pick([0x16121a, 0x3b241b, 0xd7b26b]), roughness: 0.9 }))
  hair.position.y = 1.79
  root.add(hair)
  const legL = new THREE.Group()
  const legR = new THREE.Group()
  legL.position.set(-0.12, 0.92, 0)
  legR.position.set(0.12, 0.92, 0)
  for (const [leg, side] of [[legL, -1], [legR, 1]]) {
    const limb = new THREE.Mesh(pedestrianGeometries.leg, pants)
    limb.position.y = -0.36
    leg.add(limb)
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.11, 0.32), new THREE.MeshStandardMaterial({ color: side > 0 ? 0xf1eee4 : 0xe4e1da, roughness: 0.55 }))
    shoe.position.set(0, -0.76, 0.06)
    leg.add(shoe)
    root.add(leg)
  }
  const armL = new THREE.Group()
  const armR = new THREE.Group()
  armL.position.set(-0.33, 1.5, 0)
  armR.position.set(0.33, 1.5, 0)
  for (const arm of [armL, armR]) {
    const limb = new THREE.Mesh(pedestrianGeometries.arm, shirt)
    limb.position.y = -0.28
    arm.add(limb)
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 7, 6), skin)
    hand.position.y = -0.58
    arm.add(hand)
    root.add(arm)
  }
  root.traverse(child => { if (child.isMesh) child.castShadow = false })
  return { root, legL, legR, armL, armR, walk: random() * 10 }
}

const pedPaths = BLOCKS.flatMap(x => BLOCKS.map(z => [
  new THREE.Vector3(x - 25, 0.3, z - 25),
  new THREE.Vector3(x + 25, 0.3, z - 25),
  new THREE.Vector3(x + 25, 0.3, z + 25),
  new THREE.Vector3(x - 25, 0.3, z + 25)
]))
for (let i = 0; i < 14; i++) {
  const ped = createPedestrian()
  const path = pick(pedPaths)
  const start = Math.floor(random() * 4)
  ped.root.position.copy(path[start])
  ped.path = path
  ped.segment = start
  ped.progress = random()
  ped.speed = rand(1.0, 1.7)
  ped.direction = random() > 0.5 ? 1 : -1
  scene.add(ped.root)
  pedestrians.push(ped)
}

const player = new THREE.Group()
const playerBody = new THREE.Group()
player.add(playerBody)
const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xb97c5d, roughness: 0.7 })
const jacketMaterial = new THREE.MeshStandardMaterial({ color: 0xf0e3d2, roughness: 0.55, metalness: 0.08, emissive: 0x3a2116, emissiveIntensity: 0.36 })
const jacketTrim = new THREE.MeshStandardMaterial({ color: 0xffcf6e, roughness: 0.4, metalness: 0.3, emissive: 0x5a3000, emissiveIntensity: 0.45 })
const pantsMaterial = new THREE.MeshStandardMaterial({ color: 0x1b2233, roughness: 0.84 })
const shoeMaterial = new THREE.MeshStandardMaterial({ color: 0xf4eee4, roughness: 0.52 })
const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.58, 5, 10), jacketMaterial)
torso.position.y = 1.27
playerBody.add(torso)
const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.56, 0.03), jacketTrim)
chestStripe.position.set(0, 1.28, 0.225)
playerBody.add(chestStripe)
for (const x of [-0.245, 0.245]) {
  const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.16, 0.3), jacketMaterial)
  shoulder.position.set(x, 1.53, 0)
  shoulder.rotation.z = x > 0 ? -0.13 : 0.13
  playerBody.add(shoulder)
}
const collar = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.021, 6, 20), jacketTrim)
collar.position.set(0, 1.62, 0)
collar.rotation.x = Math.PI / 2
playerBody.add(collar)
const belt = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.09, 0.31), blackMetal)
belt.position.set(0, 0.95, 0)
playerBody.add(belt)
const holster = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.26, 0.18), new THREE.MeshStandardMaterial({ color: 0x241b16, roughness: 0.6 }))
holster.position.set(0.27, 0.86, 0.03)
playerBody.add(holster)
const emblemTexture = canvasTexture(256, 256, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h)
  ctx.strokeStyle = '#ffcf6e'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(w / 2, h / 2, 88, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#ffcf6e'
  ctx.font = '900 98px Impact, "Arial Black", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = '#ffb13b'
  ctx.shadowBlur = 12
  ctx.fillText('VII', w / 2, h / 2 + 5)
  ctx.font = '800 22px Arial, sans-serif'
  ctx.letterSpacing = '4px'
  ctx.fillText('VICE', w / 2, h / 2 + 63)
})
const emblem = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), new THREE.MeshBasicMaterial({ map: emblemTexture, transparent: true, toneMapped: false }))
emblem.position.set(0, 1.33, -0.228)
emblem.rotation.y = Math.PI
playerBody.add(emblem)
const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10), skinMaterial)
head.position.y = 1.79
playerBody.add(head)
const hair = new THREE.Mesh(new THREE.SphereGeometry(0.195, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), new THREE.MeshStandardMaterial({ color: 0x1a1114, roughness: 0.88 }))
hair.position.y = 1.82
playerBody.add(hair)
const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.075, 0.04), new THREE.MeshStandardMaterial({ color: 0x07070b, roughness: 0.16, metalness: 0.65 }))
glasses.position.set(0, 1.805, 0.177)
playerBody.add(glasses)
const playerLegL = new THREE.Group()
const playerLegR = new THREE.Group()
playerLegL.position.set(-0.13, 0.94, 0)
playerLegR.position.set(0.13, 0.94, 0)
for (const leg of [playerLegL, playerLegR]) {
  const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.55, 4, 8), pantsMaterial)
  limb.position.y = -0.37
  leg.add(limb)
  const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.34), shoeMaterial)
  shoe.position.set(0, -0.77, 0.07)
  leg.add(shoe)
  playerBody.add(leg)
}
const playerArmL = new THREE.Group()
const playerArmR = new THREE.Group()
playerArmL.position.set(-0.35, 1.51, 0)
playerArmR.position.set(0.35, 1.51, 0)
for (const arm of [playerArmL, playerArmR]) {
  const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.48, 4, 8), jacketMaterial)
  limb.position.y = -0.28
  arm.add(limb)
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 7), jacketTrim)
  cuff.position.y = -0.53
  arm.add(cuff)
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.083, 8, 6), skinMaterial)
  hand.position.y = -0.61
  arm.add(hand)
  playerBody.add(arm)
}
const playerGun = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.11, 0.34), blackMetal)
playerGun.position.set(0.02, -0.62, 0.18)
playerArmR.add(playerGun)
player.traverse(child => {
  if (child.isMesh) {
    child.castShadow = true
    child.receiveShadow = true
  }
})
player.position.set(4, 0, 96)
scene.add(player)
const playerFillLight = new THREE.PointLight(0xffd6a8, 46, 15, 1.65)
scene.add(playerFillLight)

const muzzle = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xffd479, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
muzzle.scale.set(1.1, 1.1, 1)
scene.add(muzzle)


const startButton = $('#start-btn')
const tiltButton = $('#tilt-btn')
const tiltLabel = $('#tilt-label')
const joystick = $('#joystick')
const joystickKnob = $('#joystick-knob')
const vehicleButton = $('#btn-vehicle')
const vehicleLabel = $('#vehicle-label')
const attackButton = $('#btn-attack')
const jumpButton = $('#btn-jump')
const flashEl = $('#flash')
const permissionToast = $('#permission-toast')
const objectiveToast = $('#objective-toast')
const completionToast = $('#completion-toast')
const interactEl = $('#interact')
const interactLabel = $('#interact-label')
const touchLayout = window.matchMedia('(max-width: 900px), (pointer: coarse)')
const waypointEl = $('#waypoint')
const speedEl = $('#speed')
const gearEl = $('#gear')
const cashEl = $('#cash')
const wantedEl = $('#wanted')
const missionDistance = $('#mission-distance')
const waypointDistance = $('#waypoint-distance')
const missionState = $('#mission-state')
const districtEl = $('#district')
const clockEl = $('#clock')
const healthBar = $('#health-bar')
const armorBar = $('#armor-bar')
const boostFill = $('#boost-fill')

let orientationBound = false

const state = {
  started: false,
  driving: false,
  missionComplete: false,
  cash: 1264000,
  wanted: 2,
  health: 86,
  armor: 54,
  tilt: false,
  tiltSteer: 0,
  tiltTarget: 0,
  carYaw: 0,
  carSpeed: 0,
  steering: 0,
  playerY: 0,
  playerVy: 0,
  grounded: true,
  walkPhase: 0,
  attackTime: 0,
  attackCooldown: 0,
  muzzleLife: 0,
  shake: 0,
  orbitYaw: 0,
  clock: 21 * 60 + 47,
  clockAcc: 0,
  hudAcc: 0,
  nearCar: false,
  objectiveTimer: 0,
  completionTimer: 0,
  lastToast: 0
}

const input = { x: 0, y: 0 }
const look = { yaw: 0, pitch: 0.265, dragging: false, lastX: 0, lastY: 0, steady: 0 }
const keys = new Set()
const cameraTarget = new THREE.Vector3(4, 1.3, 96)
const desiredCamera = new THREE.Vector3()
const tempVector = new THREE.Vector3()
const projected = new THREE.Vector3()

function showPermissionToast(message, duration = 3400) {
  permissionToast.textContent = message
  permissionToast.classList.add('show')
  clearTimeout(state.lastToast)
  state.lastToast = setTimeout(() => permissionToast.classList.remove('show'), duration)
}

function startGame() {
  if (state.started) return
  state.started = true
  document.body.classList.add('playing')
  if (state.tilt) document.body.classList.add('tilt-on')
  look.yaw = 0
  look.pitch = 0.265
  cameraTarget.set(player.position.x, player.position.y + 1.28, player.position.z)
  const snapHorizontal = Math.cos(look.pitch) * 6.45
  camera.position.set(
    cameraTarget.x - Math.sin(look.yaw) * snapHorizontal,
    cameraTarget.y + Math.sin(look.pitch) * 6.45,
    cameraTarget.z - Math.cos(look.yaw) * snapHorizontal
  )
  camera.lookAt(cameraTarget.x, cameraTarget.y + 0.36, cameraTarget.z)
  state.objectiveTimer = setTimeout(() => {
    objectiveToast.classList.add('show')
    setTimeout(() => objectiveToast.classList.remove('show'), 4300)
  }, 3200)
  startButton.blur()
}

async function toggleTilt() {
  if (state.tilt) {
    state.tilt = false
    state.tiltTarget = 0
    state.tiltSteer = 0
    tiltButton.setAttribute('aria-pressed', 'false')
    tiltLabel.textContent = 'Tilt Steering: Off'
    document.body.classList.remove('tilt-on')
    showPermissionToast('Tilt steering disabled. Touch controls remain active.')
    return
  }
  if (!('DeviceOrientationEvent' in window)) {
    showPermissionToast('Motion sensors are not available in this browser.')
    return
  }
  try {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const permission = await DeviceOrientationEvent.requestPermission()
      if (permission !== 'granted') {
        showPermissionToast('Motion access was denied. Enable Motion & Orientation in Settings to steer with tilt.')
        return
      }
    }
    state.tilt = true
    tiltButton.setAttribute('aria-pressed', 'true')
    tiltLabel.textContent = 'Tilt Steering: On'
    document.body.classList.add('tilt-on')
    if (!orientationBound) {
      window.addEventListener('deviceorientation', handleOrientation, { passive: true })
      orientationBound = true
    }
    showPermissionToast('Tilt steering enabled. Tilt left or right while driving.')
  } catch (error) {
    showPermissionToast('Motion permission could not be requested. Try again from a secure page.')
  }
}

function handleOrientation(event) {
  if (!state.tilt) return
  const angle = screen.orientation && typeof screen.orientation.angle === 'number' ? screen.orientation.angle : 0
  const landscape = Math.abs(angle) === 90 || Math.abs(angle) === 270
  const raw = landscape ? (event.beta || 0) : (event.gamma || 0)
  const deadzone = 2.5
  const magnitude = Math.abs(raw) < deadzone ? 0 : (Math.abs(raw) - deadzone) / 20
  state.tiltTarget = clamp(Math.sign(raw) * magnitude, -1, 1)
}

function doJump() {
  if (!state.started || state.driving || !state.grounded) return
  state.playerVy = 6.4
  state.grounded = false
}

function enterVehicle() {
  if (!state.started) return
  if (state.driving) {
    exitVehicle()
    return
  }
  if (!state.nearCar) {
    showPermissionToast('No vehicle within reach.')
    return
  }
  state.driving = true
  state.carYaw = playerCar.rotation.y
  state.carSpeed = 0
  state.orbitYaw = 0
  state.grounded = true
  player.visible = false
  document.body.classList.add('driving')
  vehicleLabel.textContent = 'EXIT'
  look.pitch = 0.24
  state.shake = 0.04
}

function exitVehicle() {
  if (!state.driving) return
  const yaw = playerCar.rotation.y
  const rightX = -Math.cos(yaw)
  const rightZ = Math.sin(yaw)
  let px = playerCar.position.x + rightX * 2.7
  let pz = playerCar.position.z + rightZ * 2.7
  if (isBlocked(px, pz, 0.42)) {
    px = playerCar.position.x - rightX * 2.7
    pz = playerCar.position.z - rightZ * 2.7
  }
  if (isBlocked(px, pz, 0.42)) {
    px = playerCar.position.x
    pz = playerCar.position.z - 3.2
  }
  player.position.set(px, groundAt(px, pz), pz)
  player.rotation.y = yaw + Math.PI / 2
  player.visible = true
  state.playerY = player.position.y
  state.playerVy = 0
  state.grounded = true
  state.driving = false
  state.carSpeed = 0
  playerCar.userData.wheels.forEach(wheel => wheel.rotation.x = 0)
  document.body.classList.remove('driving')
  vehicleLabel.textContent = 'ENTER'
  state.shake = 0.04
}

function doAttack() {
  if (!state.started || state.attackCooldown > 0) return
  state.attackTime = 0.32
  state.attackCooldown = 0.27
  state.shake = 0.11
  state.wanted = Math.min(5, state.wanted + (Math.random() < 0.34 ? 1 : 0))
  updateWanted()
  flashEl.classList.remove('fire')
  void flashEl.offsetWidth
  flashEl.classList.add('fire')
  const hand = player.localToWorld(new THREE.Vector3(0.38, 1.3, 0.45))
  if (state.driving) hand.set(playerCar.position.x, 1.15, playerCar.position.z + 2.4)
  muzzle.position.copy(hand)
  state.muzzleLife = 0.11
}

function updateWanted() {
  [...wantedEl.children].forEach((star, index) => star.classList.toggle('on', index < state.wanted))
  wantedEl.setAttribute('aria-label', `Wanted level ${state.wanted} of 5`)
}

function isBlocked(x, z, radius) {
  if (x < -WORLD_LIMIT_X || x > WORLD_LIMIT_X || z < -286 || z > WORLD_LIMIT_Z) return true
  for (const c of colliders) {
    if (x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ) return true
  }
  return false
}

function groundAt(x, z) {
  if (Math.abs(x) < 23 && z > 292 && z < 438) return 0.38
  if (Math.abs(x) < 302 && z > -285 && z < 285) {
    if (BLOCKS.some(bx => Math.abs(x - bx) < 28) && BLOCKS.some(bz => Math.abs(z - bz) < 28)) return 0.3
  }
  return 0
}

function updatePlayer(dt) {
  if (state.driving) return
  let ix = 0
  let iz = 0
  if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1
  if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1
  if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1
  if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1
  ix += input.x
  iz += input.y
  const magnitude = Math.min(1, Math.hypot(ix, iz))
  let moving = false
  if (magnitude > 0.06) {
    moving = true
    const dx = Math.sin(look.yaw) * iz - Math.cos(look.yaw) * ix
    const dz = Math.cos(look.yaw) * iz + Math.sin(look.yaw) * ix
    const length = Math.hypot(dx, dz) || 1
    const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 9.1 : 6.3) * Math.min(1, magnitude * 1.14)
    const moveX = dx / length * speed * dt
    const moveZ = dz / length * speed * dt
    const nextX = player.position.x + moveX
    if (!isBlocked(nextX, player.position.z, 0.4)) player.position.x = nextX
    const nextZ = player.position.z + moveZ
    if (!isBlocked(player.position.x, nextZ, 0.4)) player.position.z = nextZ
    player.rotation.y = angleDamp(player.rotation.y, Math.atan2(dx, dz), 15, dt)
    state.walkPhase += speed * dt * 2.15
  }
  const ground = groundAt(player.position.x, player.position.z)
  if (state.grounded) {
    state.playerY = damp(state.playerY, ground, 18, dt)
  } else {
    state.playerVy -= 20 * dt
    state.playerY += state.playerVy * dt
    if (state.playerY <= ground) {
      state.playerY = ground
      state.playerVy = 0
      state.grounded = true
    }
  }
  player.position.y = state.playerY
  const bob = moving ? Math.abs(Math.sin(state.walkPhase)) * 0.035 : Math.sin(performance.now() * 0.0017) * 0.012
  playerBody.position.y = bob
  const stride = moving ? Math.sin(state.walkPhase) : 0
  playerLegL.rotation.x = stride * 0.65
  playerLegR.rotation.x = -stride * 0.65
  playerArmL.rotation.x = -stride * 0.5
  playerArmR.rotation.x = stride * 0.5
  if (state.attackTime > 0) {
    const progress = 1 - state.attackTime / 0.32
    playerArmR.rotation.x = -1.2 + progress * 1.6
    playerArmR.rotation.z = -0.15
  } else {
    playerArmR.rotation.z = 0.02
  }
  playerBody.rotation.z = moving ? Math.sin(state.walkPhase * 0.5) * 0.018 : 0
  state.attackTime = Math.max(0, state.attackTime - dt)
  state.attackCooldown = Math.max(0, state.attackCooldown - dt)
  state.nearCar = player.position.distanceTo(playerCar.position) < 10.6
}

function updateDriving(dt) {
  const throttle = clamp(input.y + (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0), -1, 1)
  let steer = clamp(input.x + (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0), -1, 1)
  if (state.tilt && Math.abs(state.tiltSteer) > 0.05) steer = state.tiltSteer
  state.tiltSteer = damp(state.tiltSteer, state.tiltTarget, 9, dt)
  state.steering = damp(state.steering, steer, 7, dt)
  if (throttle > 0) state.carSpeed += 19 * throttle * dt
  else if (throttle < 0) state.carSpeed += 13 * throttle * dt
  state.carSpeed *= Math.exp(-0.38 * dt)
  state.carSpeed = clamp(state.carSpeed, -12, 39)
  const speedNorm = clamp(Math.abs(state.carSpeed) / 11, 0, 1)
  state.carYaw -= state.steering * 1.95 * speedNorm * dt * (state.carSpeed < 0 ? -1 : 1)
  const forwardX = Math.sin(state.carYaw)
  const forwardZ = Math.cos(state.carYaw)
  const nx = playerCar.position.x + forwardX * state.carSpeed * dt
  const nz = playerCar.position.z + forwardZ * state.carSpeed * dt
  let hit = false
  if (!isBlocked(nx, playerCar.position.z, 1.15)) playerCar.position.x = nx
  else hit = true
  if (!isBlocked(playerCar.position.x, nz, 1.15)) playerCar.position.z = nz
  else hit = true
  if (hit) {
    state.carSpeed *= -0.19
    state.shake = Math.min(0.22, Math.abs(state.carSpeed) * 0.007 + 0.07)
  }
  playerCar.rotation.y = state.carYaw
  const wheelSpin = state.carSpeed * dt / 0.39
  playerCar.userData.wheels.forEach(wheel => { wheel.rotation.x += wheelSpin })
  player.position.set(playerCar.position.x, 0, playerCar.position.z)
  player.rotation.y = state.carYaw
  if (state.attackTime > 0) state.attackTime = Math.max(0, state.attackTime - dt)
  state.attackCooldown = Math.max(0, state.attackCooldown - dt)
  state.nearCar = true
}

function updateTraffic(dt) {
  for (const car of traffic) {
    const travel = car.speed * dt * car.direction
    if (car.vertical) {
      car.car.position.z += travel
      if (car.car.position.z > 282) car.car.position.z = -282
      if (car.car.position.z < -282) car.car.position.z = 282
    } else {
      car.car.position.x += travel
      if (car.car.position.x > 282) car.car.position.x = -282
      if (car.car.position.x < -282) car.car.position.x = 282
    }
    car.wheels.forEach(wheel => { wheel.rotation.x += travel / 0.39 })
  }
}

function updatePedestrians(dt) {
  for (const ped of pedestrians) {
    const nextIndex = (ped.segment + (ped.direction > 0 ? 1 : 3)) % 4
    const target = ped.path[nextIndex]
    const current = ped.root.position
    const dx = target.x - current.x
    const dz = target.z - current.z
    const distance = Math.hypot(dx, dz)
    if (distance < 0.4) {
      ped.segment = nextIndex
      if (Math.random() < 0.08) ped.direction *= -1
      continue
    }
    const move = Math.min(distance, ped.speed * dt)
    current.x += dx / distance * move
    current.z += dz / distance * move
    current.y = 0.3
    ped.root.rotation.y = angleDamp(ped.root.rotation.y, Math.atan2(dx, dz), 8, dt)
    ped.walk += dt * ped.speed * 5.5
    const stride = Math.sin(ped.walk) * 0.55
    ped.legL.rotation.x = stride
    ped.legR.rotation.x = -stride
    ped.armL.rotation.x = -stride * 0.7
    ped.armR.rotation.x = stride * 0.7
  }
}

function updateCamera(dt) {
  const t = performance.now() * 0.001
  if (!state.started) {
    camera.position.set(8.5 + Math.sin(t * 0.09) * 1.6, 15 + Math.sin(t * 0.15) * 0.65, 22 + Math.cos(t * 0.07) * 2.4)
    camera.lookAt(-1, 7.5, 136)
    return
  }
  if (state.driving) {
    if (!look.dragging) {
      state.orbitYaw = damp(state.orbitYaw, 0, 2.8, dt)
      look.yaw = damp(look.yaw, state.carYaw, 3.6, dt)
    }
    tempVector.set(playerCar.position.x, 1.25, playerCar.position.z)
  } else {
    tempVector.set(player.position.x, player.position.y + 1.28, player.position.z)
  }
  cameraTarget.lerp(tempVector, 1 - Math.exp(-9 * dt))
  let yaw
  if (state.driving) {
    yaw = state.carYaw + state.orbitYaw
  } else {
    yaw = look.yaw
  }
  const speedFactor = state.driving ? clamp(Math.abs(state.carSpeed) / 39, 0, 1) : 0
  const distance = state.driving ? 10.6 - speedFactor * 1.4 : 6.45
  const pitch = state.driving ? 0.19 : look.pitch
  const horizontal = Math.cos(pitch) * distance
  desiredCamera.set(
    cameraTarget.x - Math.sin(yaw) * horizontal,
    cameraTarget.y + Math.sin(pitch) * distance,
    cameraTarget.z - Math.cos(yaw) * horizontal
  )
  if (state.shake > 0.001) {
    desiredCamera.x += rand(-state.shake, state.shake)
    desiredCamera.y += rand(-state.shake, state.shake) * 0.7
    desiredCamera.z += rand(-state.shake, state.shake)
    state.shake *= Math.exp(-8 * dt)
  }
  camera.position.lerp(desiredCamera, 1 - Math.exp(-7.5 * dt))
  const targetFov = 61 + speedFactor * 7.5
  camera.fov = damp(camera.fov, targetFov, 4, dt)
  camera.updateProjectionMatrix()
  tempVector.copy(cameraTarget)
  tempVector.y += 0.36
  camera.lookAt(tempVector)
}

function updateMission(dt) {
  if (state.missionComplete) return
  const distance = Math.hypot(player.position.x - waypointPosition.x, player.position.z - waypointPosition.z)
  if (distance < 12) {
    state.missionComplete = true
    state.cash += 25000
    cashEl.textContent = '$' + state.cash.toLocaleString('en-US')
    missionState.textContent = 'PASSED'
    missionDistance.textContent = 'COMPLETE'
    completionToast.classList.add('show')
    state.completionTimer = setTimeout(() => completionToast.classList.remove('show'), 5200)
    waypointEl.classList.remove('show')
  }
}

const offscreenMap = document.createElement('canvas')
offscreenMap.width = 260
offscreenMap.height = 260
const mapCtx = offscreenMap.getContext('2d')
function buildMinimapBase() {
  mapCtx.fillStyle = '#191523'
  mapCtx.fillRect(0, 0, 260, 260)
  const ocean = mapCtx.createLinearGradient(0, 0, 0, 34)
  ocean.addColorStop(0, '#071623')
  ocean.addColorStop(1, '#101526')
  mapCtx.fillStyle = ocean
  mapCtx.fillRect(0, 0, 260, 28)
  mapCtx.fillStyle = '#100d18'
  for (const road of ROADS) {
    const x = (road + 300) / 600 * 260
    const y = (300 - road) / 600 * 260
    mapCtx.fillRect(x - 4.7, 0, 9.4, 260)
    mapCtx.fillRect(0, y - 4.7, 260, 9.4)
  }
  mapCtx.fillStyle = '#251e36'
  for (const c of colliders) {
    const x = (c.minX + 300) / 600 * 260
    const y = (300 - c.maxZ) / 600 * 260
    const w = (c.maxX - c.minX) / 600 * 260
    const h = (c.maxZ - c.minZ) / 600 * 260
    mapCtx.fillRect(x, y, w, h)
  }
  mapCtx.strokeStyle = 'rgba(255,209,102,.24)'
  mapCtx.lineWidth = 1
  mapCtx.beginPath()
  mapCtx.arc(130, 130, 96, 0, Math.PI * 2)
  mapCtx.stroke()
  mapCtx.strokeStyle = 'rgba(85,245,255,.12)'
  mapCtx.beginPath()
  mapCtx.moveTo(130, 26)
  mapCtx.lineTo(130, 234)
  mapCtx.moveTo(26, 130)
  mapCtx.lineTo(234, 130)
  mapCtx.stroke()
}
buildMinimapBase()
const minimap = $('#minimap')
const miniCtx = minimap.getContext('2d')

function drawMinimap() {
  miniCtx.clearRect(0, 0, 260, 260)
  miniCtx.drawImage(offscreenMap, 0, 0)
  const px = (player.position.x + 300) / 600 * 260
  const py = (300 - player.position.z) / 600 * 260
  const wx = 130
  const wy = 7
  miniCtx.save()
  miniCtx.translate(wx, wy)
  miniCtx.rotate(Math.PI / 4)
  miniCtx.fillStyle = '#ffd166'
  miniCtx.shadowColor = '#ffd166'
  miniCtx.shadowBlur = 9
  miniCtx.fillRect(-3.5, -3.5, 7, 7)
  miniCtx.restore()
  if (!state.driving) {
    miniCtx.fillStyle = '#55f5ff'
    miniCtx.shadowColor = '#55f5ff'
    miniCtx.shadowBlur = 8
    miniCtx.beginPath()
    miniCtx.arc((playerCar.position.x + 300) / 600 * 260, (300 - playerCar.position.z) / 600 * 260, 2.5, 0, Math.PI * 2)
    miniCtx.fill()
  }
  miniCtx.save()
  miniCtx.translate(px, py)
  miniCtx.rotate(player.rotation.y)
  miniCtx.fillStyle = '#ffffff'
  miniCtx.strokeStyle = '#55f5ff'
  miniCtx.lineWidth = 1.2
  miniCtx.shadowColor = '#55f5ff'
  miniCtx.shadowBlur = 8
  miniCtx.beginPath()
  miniCtx.moveTo(0, -8)
  miniCtx.lineTo(5.5, 6)
  miniCtx.lineTo(0, 2.7)
  miniCtx.lineTo(-5.5, 6)
  miniCtx.closePath()
  miniCtx.fill()
  miniCtx.stroke()
  miniCtx.restore()
}

let hudTime = 0
function updateHud(dt) {
  hudTime += dt
  if (hudTime < 0.06) return
  hudTime = 0
  const distance = Math.round(Math.hypot(player.position.x - waypointPosition.x, player.position.z - waypointPosition.z))
  if (!state.missionComplete) {
    missionDistance.textContent = distance + ' M'
    waypointDistance.textContent = distance + ' M'
  }
  waypointEl.classList.toggle('show', state.started && !state.driving && !state.missionComplete && distance > 15)
  projected.set(waypointPosition.x, 6.5, waypointPosition.z).project(camera)
  const sx = (projected.x * 0.5 + 0.5) * innerWidth
  const sy = (-projected.y * 0.5 + 0.5) * innerHeight
  if (projected.z < 1 && sx > 60 && sx < innerWidth - 60 && sy > 70 && sy < innerHeight - 100) {
    waypointEl.style.left = sx + 'px'
    waypointEl.style.top = sy + 'px'
  }
  interactEl.classList.toggle('show', state.started && !state.driving && state.nearCar)
  interactLabel.textContent = touchLayout.matches ? 'TAP ENTER TO GET IN' : 'ENTER VEHICLE'
  if (state.driving) {
    vehicleLabel.textContent = 'EXIT'
  } else {
    vehicleLabel.textContent = 'ENTER'
  }
  const kmh = Math.round(Math.abs(state.carSpeed) * 3.6)
  speedEl.textContent = String(kmh).padStart(3, '0')
  gearEl.textContent = state.carSpeed < -0.5 ? 'R' : (state.carSpeed > 0.5 ? 'D' : 'N')
  boostFill.style.width = clamp(50 + Math.abs(state.carSpeed) / 39 * 50, 0, 100) + '%'
  const z = player.position.z
  districtEl.textContent = z > 225 ? 'NEON PIER' : (z > 70 ? 'OCEAN DRIVE' : (z > -110 ? 'VICE CENTER' : 'DOWNTOWN'))
  healthBar.style.width = state.health + '%'
  armorBar.style.width = state.armor + '%'
  drawMinimap()
}

function formatClock() {
  const total = Math.floor(state.clock) % 1440
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0')
}

function animate() {
  requestAnimationFrame(animate)
  const now = performance.now()
  const dt = Math.min(0.05, Math.max(0.001, (now - (animate.last || now)) / 1000))
  animate.last = now
  const t = now * 0.001
  state.clockAcc += dt
  if (state.clockAcc > 1.4) {
    state.clockAcc = 0
    state.clock += 1
    clockEl.textContent = formatClock()
  }
  if (state.started) {
    if (state.driving) updateDriving(dt)
    else updatePlayer(dt)
    updateMission(dt)
  } else {
    state.nearCar = false
  }
  updateTraffic(dt)
  updatePedestrians(dt)
  updateCamera(dt)
  playerFillLight.position.copy(camera.position)
  updateHud(dt)
  if (state.muzzleLife > 0) {
    state.muzzleLife -= dt
    muzzle.material.opacity = clamp(state.muzzleLife / 0.11, 0, 1)
    muzzle.scale.setScalar(0.8 + (1 - state.muzzleLife / 0.11) * 0.7)
  } else {
    muzzle.material.opacity = 0
  }
  for (const item of signFlickers) {
    if (item.rare) {
      const flicker = Math.sin(t * 17 + item.phase) > 0.985 ? 0.38 : 1
      item.material.opacity = flicker
    } else {
      item.material.opacity = 0.9 + Math.sin(t * 1.8 + item.phase) * 0.1
    }
  }
  plazaSculptures.forEach((sculpture, i) => {
    sculpture.rotation.y += dt * (0.25 + i * 0.03)
    sculpture.rotation.z = Math.sin(t * 0.3 + i) * 0.14
  })
  ferrisCenter.rotation.z += dt * 0.055
  gondolas.forEach(gondola => { gondola.rotation.z = -ferrisCenter.rotation.z })
  wheelRing.material.opacity = 0.55 + Math.sin(t * 2.1) * 0.22
  beacon.material.opacity = 0.14 + (Math.sin(t * 2.4) + 1) * 0.08
  reflection.material.opacity = 0.4 + Math.sin(t * 0.8) * 0.07
  stars.material.opacity = 0.45 + Math.sin(t * 0.4) * 0.08
  if (state.started) {
    sunLight.position.set(player.position.x - 90, 110, player.position.z + 180)
    sunLight.target.position.set(player.position.x, 0, player.position.z)
    sunLight.target.updateMatrixWorld()
    const td = new Date()
    td.setMinutes(td.getMinutes() + 0)
  }
  composer.render()
}

startButton.addEventListener('click', startGame)
tiltButton.addEventListener('click', toggleTilt)
vehicleButton.addEventListener('pointerdown', event => {
  event.preventDefault()
  enterVehicle()
  vehicleButton.classList.add('pressed')
  setTimeout(() => vehicleButton.classList.remove('pressed'), 120)
})
attackButton.addEventListener('pointerdown', event => {
  event.preventDefault()
  doAttack()
  attackButton.classList.add('pressed')
  setTimeout(() => attackButton.classList.remove('pressed'), 120)
})
jumpButton.addEventListener('pointerdown', event => {
  event.preventDefault()
  doJump()
  jumpButton.classList.add('pressed')
  setTimeout(() => jumpButton.classList.remove('pressed'), 120)
})

canvas.addEventListener('pointerdown', event => {
  if (!state.started) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  look.dragging = true
  look.lastX = event.clientX
  look.lastY = event.clientY
  canvas.setPointerCapture(event.pointerId)
})
canvas.addEventListener('pointermove', event => {
  if (!look.dragging || !state.started) return
  const dx = event.clientX - look.lastX
  const dy = event.clientY - look.lastY
  look.lastX = event.clientX
  look.lastY = event.clientY
  if (state.driving) state.orbitYaw -= dx * 0.0055
  else look.yaw -= dx * 0.0055
  look.pitch = clamp(look.pitch + dy * 0.0035, 0.08, 0.6)
  state.orbitYaw = clamp(state.orbitYaw, -1.35, 1.35)
})
function endDrag(event) {
  if (!look.dragging) return
  look.dragging = false
  try { canvas.releasePointerCapture(event.pointerId) } catch {}
}
canvas.addEventListener('pointerup', endDrag)
canvas.addEventListener('pointercancel', endDrag)
canvas.addEventListener('contextmenu', event => event.preventDefault())

let joystickPointer = null
function setJoystick(event) {
  const rect = joystick.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  let dx = event.clientX - cx
  let dy = event.clientY - cy
  const max = rect.width * 0.34
  const length = Math.hypot(dx, dy)
  if (length > max) {
    dx = dx / length * max
    dy = dy / length * max
  }
  const nx = dx / max
  const ny = -dy / max
  input.x = nx
  input.y = ny
  joystickKnob.style.transform = `translate(${dx * 0.8}px, ${dy * 0.8}px)`
}
joystick.addEventListener('pointerdown', event => {
  event.preventDefault()
  joystickPointer = event.pointerId
  joystick.classList.add('active')
  joystick.setPointerCapture(event.pointerId)
  setJoystick(event)
})
joystick.addEventListener('pointermove', event => {
  if (event.pointerId !== joystickPointer) return
  setJoystick(event)
})
function endJoystick(event) {
  if (event.pointerId !== joystickPointer) return
  joystickPointer = null
  input.x = 0
  input.y = 0
  joystick.classList.remove('active')
  joystickKnob.style.transform = 'translate(0px, 0px)'
}
joystick.addEventListener('pointerup', endJoystick)
joystick.addEventListener('pointercancel', endJoystick)

window.addEventListener('keydown', event => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault()
  if (event.repeat) return
  keys.add(event.code)
  if (event.code === 'KeyE') enterVehicle()
  if (event.code === 'KeyF') doAttack()
  if (event.code === 'Space') doJump()
  if (event.code === 'Enter' && !state.started) startGame()
})
window.addEventListener('keyup', event => {
  keys.delete(event.code)
})
window.addEventListener('blur', () => {
  keys.clear()
  input.x = 0
  input.y = 0
  joystickKnob.style.transform = 'translate(0px, 0px)'
  joystick.classList.remove('active')
})

window.addEventListener('resize', () => {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, touchMode ? 1.55 : 1.35))
  renderer.setSize(innerWidth, innerHeight)
  composer.setSize(innerWidth, innerHeight)
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
})

clockEl.textContent = formatClock()
updateWanted()
requestAnimationFrame(animate)
window.__game = { state, player, playerCar, colliders, renderer, scene, camera, startGame, enterVehicle, toggleTilt }

